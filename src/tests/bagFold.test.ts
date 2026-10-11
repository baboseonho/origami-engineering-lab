import { describe, expect, it } from 'vitest';
import { buildFromRegistry } from '../models/registry';
import { ENERGY_PRESETS } from '../core/solver/energy/EnergySolver';
import { runFoldToSweep } from '../core/analysis/experiments';

describe('shopping bag: open → flat with bending allowed', () => {
  const m = buildFromRegistry('shoppingBag', { W: 2, D: 1, H: 2 });
  const flat = m.edu.referenceStates![0].foldAngles;
  const out = runFoldToSweep(m, { targets: flat, fixed: m.faces[m.edu.baseFace!].vertices, steps: 24, params: ENERGY_PRESETS.paperLike });

  it('every step reaches equilibrium', () => {
    expect(out.every((q) => q.converged)).toBe(true);
  });
  it('ends in the flat state, strain-free', () => {
    const last = out[out.length - 1];
    expect(last.maxStrain).toBeLessThan(1e-3);
    const x = last.positions!;
    let lo = Infinity, hi = -Infinity;
    for (let i = 2; i < x.length; i += 3) { lo = Math.min(lo, x[i]); hi = Math.max(hi, x[i]); }
    expect(hi - lo).toBeLessThan(1e-2); // collapsed onto a plane
  });
  it('the path in between is not rigid: the facets must stretch (tall-bag theorem)', () => {
    const peak = Math.max(...out.map((q) => q.maxStrain));
    expect(peak).toBeGreaterThan(0.01);
  });
});

describe('shopping bag: flat state and folding order', () => {
  const m = buildFromRegistry('shoppingBag', { W: 2, D: 1, H: 2 });
  const flat = m.edu.referenceStates![0].foldAngles;
  const tris = m.faces.flatMap((f) => f.triangles);

  it('the exact flat state is a valid stack: flat and without crossing facets', async () => {
    const { RigidKinematicSolver } = await import('../core/solver/rigid/RigidKinematicSolver');
    const { detectCollisions } = await import('../core/solver/collision/collision');
    const s = new RigidKinematicSolver(m, undefined, {});
    const rho = Float64Array.from(m.edges, (e) => flat[e.id] ?? e.referenceFoldAngle);
    const x = s.positions(rho);
    let lo = Infinity, hi = -Infinity;
    for (let i = 2; i < x.length; i += 3) { lo = Math.min(lo, x[i]); hi = Math.max(hi, x[i]); }
    expect(hi - lo).toBeLessThan(1e-9);
    expect(detectCollisions(x, tris).count).toBe(0);
  });

  it('folding the gussets first keeps the path free of self-intersection up to 85 %', async () => {
    const { detectCollisions } = await import('../core/solver/collision/collision');
    const out = runFoldToSweep(m, { targets: flat, schedule: m.edu.foldSchedule, fixed: m.faces[m.edu.baseFace!].vertices, steps: 40, params: ENERGY_PRESETS.paperLike });
    for (const q of out) if (q.u <= 0.85) expect(detectCollisions(q.positions!, tris).count).toBe(0);
    expect(detectCollisions(out[out.length - 1].positions!, tris).count).toBe(0);
    expect(Math.max(...out.map((q) => q.maxStrain))).toBeLessThan(0.05);
  });
});
