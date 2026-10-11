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
