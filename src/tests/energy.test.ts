import { describe, expect, it } from 'vitest';
import { hingeAngleGrad } from '../core/solver/energy/creaseEnergy';
import { EnergySolver, ENERGY_PRESETS } from '../core/solver/energy/EnergySolver';
import { RigidKinematicSolver } from '../core/solver/rigid/RigidKinematicSolver';
import { miura } from '../models/generators/miura';
import { singleVertex } from '../models/generators/singleVertex';
import { DEG } from '../core/numerics/tolerances';

describe('hinge angle gradient', () => {
  it('matches central finite differences for random hinges', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    for (let trial = 0; trial < 20; trial++) {
      const x = new Float64Array([0, 0, 0, 1, 0.1, 0, 0.4 + 0.2 * rnd(), 0.8, 0.3 * rnd(), 0.5 + 0.2 * rnd(), -0.9, 0.4 * rnd()]);
      for (let i = 0; i < 12; i++) x[i] += 0.05 * rnd();
      const r = hingeAngleGrad(x, 0, 1, 2, 3);
      expect(r.ok).toBe(true);
      const h = 1e-6;
      for (let i = 0; i < 12; i++) {
        const xp = new Float64Array(x), xm = new Float64Array(x);
        xp[i] += h; xm[i] -= h;
        const fd = (hingeAngleGrad(xp, 0, 1, 2, 3).rho - hingeAngleGrad(xm, 0, 1, 2, 3).rho) / (2 * h);
        expect(r.grad[i]).toBeCloseTo(fd, 5);
      }
    }
  });
  it('uses the valley-positive convention (wings lifted toward +z → ρ > 0)', () => {
    // a=(0,0,0) b=(1,0,0); left wing on +y, right wing on −y, both lifted
    const x = new Float64Array([0, 0, 0, 1, 0, 0, 0.5, 1, 0.3, 0.5, -1, 0.3]);
    expect(hingeAngleGrad(x, 0, 1, 2, 3).rho).toBeGreaterThan(0);
  });
});

describe('energy solver', () => {
  it('total mechanical energy decreases during damped relaxation', () => {
    const model = singleVertex({ sectors: [70, 100, 110, 80].map((d) => d * DEG), assignment: ['V', 'M', 'V', 'V'] });
    const s = new EnergySolver(model, ENERGY_PRESETS.paperLike);
    s.setCreaseTargets((eid) => model.edges[eid].assignment === 'M' ? -60 * DEG : 60 * DEG);
    // small out-of-plane perturbation to leave the flat (singular) state
    for (let i = 0; i < model.vertices.length; i++) s.x[3 * i + 2] += 0.01 * Math.sin(3.1 * i);
    const E: number[] = [];
    for (let k = 0; k < 60; k++) {
      const e = s.energy();
      E.push(e.total + e.kinetic);
      s.integrate(50);
    }
    expect(E[E.length - 1]).toBeLessThan(E[0]);
    let increases = 0;
    for (let k = 1; k < E.length; k++) if (E[k] > E[k - 1] * (1 + 1e-6) + 1e-12) increases++;
    expect(increases).toBe(0);
  });

  it('FIRE relaxation reduces the potential energy and converges', () => {
    const model = miura({ rows: 2, cols: 2, a: 1, b: 1, alpha: 60 * DEG });
    const s = new EnergySolver(model, ENERGY_PRESETS.paperLike);
    s.setCreaseTargets((eid) => (model.edges[eid].assignment === 'M' ? -1 : 1) * 40 * DEG);
    for (let i = 0; i < model.vertices.length; i++) s.x[3 * i + 2] += 0.02 * Math.cos(1.7 * i);
    const before = s.energy().total;
    const r = s.relaxFIRE(20000, 1e-7);
    expect(r.converged).toBe(true);
    expect(s.energy().total).toBeLessThan(before);
  });

  it('rigid-like energy mode reproduces the rigid Miura kinematics (cross-validation)', () => {
    const model = miura({ rows: 2, cols: 2, a: 1, b: 1, alpha: 60 * DEG });
    const drive = model.edu.defaultDrive!.edge;
    const target = (model.edges[drive].assignment === 'M' ? -1 : 1) * 60 * DEG;
    const rigid = new RigidKinematicSolver(model);
    rigid.setDrivingCrease(drive, target);
    expect(rigid.solve().success).toBe(true);

    const s = new EnergySolver(model, { ...ENERGY_PRESETS.rigidLike, kCrease: 1e-4, driveStiffness: 1e6 });
    // start from the rigid solution slightly perturbed, crease springs nearly free
    s.setPositions(rigid.positions());
    s.setCreaseTargets((eid) => rigid.rho[eid]);
    s.setCreaseTargets((eid) => rigid.rho[eid], (eid) => (eid === drive ? 1e6 : 1e-4));
    for (let i = 0; i < s.x.length; i++) s.x[i] += 1e-3 * Math.sin(i);
    s.relaxFIRE(40000, 1e-9);
    const rho = s.foldAngles();
    for (const e of model.edges) if (e.faces[1] >= 0) expect(Math.abs(rho[e.id] - rigid.rho[e.id])).toBeLessThan(0.5 * DEG);
    const strain = Math.max(...Array.from(s.strains(), Math.abs));
    expect(strain).toBeLessThan(1e-4);
  });
});
