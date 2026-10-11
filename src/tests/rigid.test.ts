import { describe, expect, it } from 'vitest';
import { RigidKinematicSolver } from '../core/solver/rigid/RigidKinematicSolver';
import { miura } from '../models/generators/miura';
import { singleVertex } from '../models/generators/singleVertex';
import { validateModel } from '../core/topology/validation';
import { DEG } from '../core/numerics/tolerances';

const edgeLen = (pos: Float64Array, a: number, b: number) =>
  Math.hypot(pos[3 * a] - pos[3 * b], pos[3 * a + 1] - pos[3 * b + 1], pos[3 * a + 2] - pos[3 * b + 2]);

describe('rigid solver: generic flat-foldable degree-4 vertex', () => {
  // sectors α=70°, β=100°, π−α, π−β ; mode-1 assignment (V,M,V,V)
  const a = 70 * DEG, b = 100 * DEG;
  const model = singleVertex({ sectors: [a, b, Math.PI - a, Math.PI - b], assignment: ['V', 'M', 'V', 'V'] });
  const ids = Object.keys(model.edu.creaseLabels).map(Number);

  it('model validates', () => expect(validateModel(model).errors).toEqual([]));

  it('closes with residual < tol and has DoF_local = N − 3M = 1 (full-rank Jacobian)', () => {
    const s = new RigidKinematicSolver(model);
    s.setDrivingCrease(ids[0], 50 * DEG);
    const r = s.solve();
    expect(r.success).toBe(true);
    expect(r.residualNorm).toBeLessThan(1e-8);
    expect(Math.abs(s.rho[ids[0]] - 50 * DEG)).toBeLessThan(1e-9);
    const dof = s.analyze();
    expect(dof.N).toBe(4);
    expect(dof.M).toBe(1);
    expect(dof.NMinus3M).toBe(1);
    expect(dof.fullRank.rank).toBe(3);
    expect(dof.dofLocal).toBe(1);
  });

  it('matches the closed-form degree-4 relation tan(ρ2/2) = −cos((α+β)/2)/cos((α−β)/2) · tan(ρ1/2)', () => {
    const s = new RigidKinematicSolver(model);
    for (const t of [10, 45, 90, 150]) {
      s.setDrivingCrease(ids[0], t * DEG);
      expect(s.solve().success).toBe(true);
      const r1 = s.rho[ids[0]], r2 = s.rho[ids[1]], r3 = s.rho[ids[2]], r4 = s.rho[ids[3]];
      const f = -Math.cos((a + b) / 2) / Math.cos((a - b) / 2);
      expect(Math.tan(r2 / 2)).toBeCloseTo(f * Math.tan(r1 / 2), 8);
      expect(r3).toBeCloseTo(r1, 8); // opposite creases fold equally
      expect(r4).toBeCloseTo(-r2, 8);
    }
  });

  it('flat state is a singular configuration (rank drops)', () => {
    const s = new RigidKinematicSolver(model);
    const dof = s.analyze();
    expect(dof.fullRank.rank).toBeLessThan(3);
  });
});

describe('rigid solver: Miura-ori', () => {
  const model = miura({ rows: 3, cols: 3, a: 1, b: 1, alpha: 60 * DEG });
  const drive = model.edu.defaultDrive!;

  it('model validates', () => expect(validateModel(model).errors).toEqual([]));

  it('one driving angle determines all others; edge lengths preserved; M/V respected', () => {
    const s = new RigidKinematicSolver(model);
    s.setDrivingCrease(drive.edge, drive.angle);
    const r = s.solve();
    expect(r.success).toBe(true);
    expect(r.residualNorm).toBeLessThan(1e-8);
    const pos = s.positions();
    for (const e of model.edges) expect(Math.abs(edgeLen(pos, e.vertices[0], e.vertices[1]) - e.restLength)).toBeLessThan(1e-7);
    for (const eid of Object.keys(model.edu.creaseLabels).map(Number)) expect(Math.abs(s.rho[eid])).toBeGreaterThan(10 * DEG);
    for (const e of model.edges) {
      if (e.assignment === 'M') expect(s.rho[e.id]).toBeLessThanOrEqual(1e-6);
      if (e.assignment === 'V') expect(s.rho[e.id]).toBeGreaterThanOrEqual(-1e-6);
    }
    const dof = s.analyze();
    expect(dof.dofLocal).toBe(1);
    expect(dof.NMinus3M).toBe(0); // naive count says rigid; redundancy gives 1 DoF
  });

  it('is path independent: going up and back returns the same state', () => {
    const s = new RigidKinematicSolver(model);
    const sg = Math.sign(drive.angle);
    s.setDrivingCrease(drive.edge, sg * 80 * DEG); s.solve();
    const a = new Float64Array(s.rho);
    s.setDrivingCrease(drive.edge, sg * 30 * DEG); s.solve();
    s.setDrivingCrease(drive.edge, sg * 80 * DEG); s.solve();
    for (let i = 0; i < a.length; i++) expect(Math.abs(a[i] - s.rho[i])).toBeLessThan(1e-6);
  });

  it('every crease pair obeys Miura symmetry: |ρ| equal on all minor creases', () => {
    const s = new RigidKinematicSolver(model);
    s.setDrivingCrease(drive.edge, drive.angle); s.solve();
    const minors = model.edges.filter((e) => e.faces[1] >= 0 && Math.abs(model.vertices[e.vertices[0]].initialPosition2D[1] - model.vertices[e.vertices[1]].initialPosition2D[1]) < 1e-9);
    for (const e of minors) expect(Math.abs(s.rho[e.id])).toBeCloseTo(Math.abs(drive.angle), 6);
  });
});

describe('stepwise analytic derivation (Lecture 3) matches the generic solver', () => {
  it('symmetric Miura vertex: projection / symmetry / law of cosines reproduce |ρ2|', async () => {
    const { miuraStepwise } = await import('../core/analysis/metrics');
    for (const alphaDeg of [45, 60, 75]) {
      const a = alphaDeg * DEG;
      const m = singleVertex({ sectors: [a, Math.PI - a, Math.PI - a, a], assignment: ['V', 'M', 'M', 'M'] });
      const ids = Object.keys(m.edu.creaseLabels).map(Number);
      const s = new RigidKinematicSolver(m);
      for (const r1 of [20, 70, 140]) {
        s.setDrivingCrease(ids[0], r1 * DEG);
        expect(s.solve().success).toBe(true);
        const d = miuraStepwise(a, r1 * DEG);
        expect(Math.abs(s.rho[ids[1]])).toBeCloseTo(d.rho2Magnitude, 7);
        expect(s.rho[ids[2]]).toBeCloseTo(-s.rho[ids[0]], 7);
      }
    }
  });
});
