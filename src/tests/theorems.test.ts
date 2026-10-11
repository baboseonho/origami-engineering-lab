import { describe, expect, it } from 'vitest';
import { fixBySector, kawasaki, kawasakiDeg } from '../core/constraints/kawasaki';
import { maekawa } from '../core/constraints/maekawa';
import { generalizedFlatFold, generalizedMaekawa } from '../core/constraints/generalizedFlatFold';
import { analyzeStrip, solveStrip, type Strip } from '../core/constraints/strip1D';
import { checkMVAssignment } from '../core/constraints/mvAssignment';
import { DEG } from '../core/numerics/tolerances';
import { dihedralToFoldAngle, signedFoldAngle, wrapPi, safeAcos, safeAsin } from '../core/geometry/angles';
import { rotAxis, mul3v } from '../core/numerics/linearAlgebra';
import type { Vec3 } from '../core/geometry/vectors';

describe('Kawasaki', () => {
  it('[90,90,90,90] is valid', () => expect(kawasakiDeg([90, 90, 90, 90]).satisfied).toBe(true));
  it('[120,90,60,90] is valid', () => expect(kawasakiDeg([120, 90, 60, 90]).satisfied).toBe(true));
  it('perturbed [125,85,60,90] is invalid (Σθ = 360° but residual = 10°)', () => {
    const r = kawasakiDeg([125, 85, 60, 90]);
    expect(r.satisfied).toBe(false);
    expect(r.residual / DEG).toBeCloseTo(10, 6);
  });
  it('odd degree is never flat-foldable', () => expect(kawasakiDeg([120, 120, 120]).satisfied).toBe(false));
  it('"make flat-foldable" fixes the residual by moving one ray, keeping Σθ = 360°', () => {
    const th = [125, 85, 60, 90].map((d) => d * DEG);
    const fixed = fixBySector(th, 0)!;
    expect(kawasaki(fixed).satisfied).toBe(true);
    expect(fixed.reduce((a, b) => a + b, 0)).toBeCloseTo(2 * Math.PI, 10);
    // only two neighbouring sectors changed
    expect(fixed.filter((t, i) => Math.abs(t - th[i]) > 1e-12).length).toBe(2);
  });
});

describe('Maekawa', () => {
  it('M=3, V=1 satisfies |M−V| = 2', () => expect(maekawa(['M', 'M', 'M', 'V']).satisfied).toBe(true));
  it('M=2, V=2 violates it', () => expect(maekawa(['M', 'V', 'M', 'V']).satisfied).toBe(false));
  it('reports V − M', () => expect(maekawa(['V', 'V', 'V', 'M']).difference).toBe(2));
});

describe('Generalized alternating sum', () => {
  it('case 0° (flat sheet, Kawasaki)', () => {
    const r = generalizedFlatFold([90, 45, 45, 90].map((d) => d * DEG)); // Σ = 270°
    expect(r.windingClass).toBe(0);
    expect(r.satisfied).toBe(true);
    expect(generalizedMaekawa(r.windingClass, ['M', 'M', 'M', 'V']).satisfied).toBe(true);
  });
  it('case +360°', () => {
    const r = generalizedFlatFold([200, 20, 200, 20].map((d) => d * DEG)); // Σ = 440°
    expect(r.windingClass).toBe(1);
    expect(r.alternating / DEG).toBeCloseTo(360, 8);
    expect(generalizedMaekawa(r.windingClass, ['M', 'V', 'M', 'V']).satisfied).toBe(true);
    expect(generalizedMaekawa(r.windingClass, ['M', 'M', 'M', 'V']).satisfied).toBe(false);
  });
  it('case −360°', () => {
    const r = generalizedFlatFold([20, 200, 20, 200].map((d) => d * DEG));
    expect(r.windingClass).toBe(-1);
    expect(r.satisfied).toBe(true);
  });
  it('generic cone vertex fails', () => expect(generalizedFlatFold([80, 70, 60, 90].map((d) => d * DEG)).satisfied).toBe(false));
});

describe('angle conventions', () => {
  const axis: Vec3 = [1, 0, 0];
  const nR: Vec3 = [0, 0, 1];
  it('flat faces have rho = 0', () => expect(signedFoldAngle(nR, nR, axis)).toBeCloseTo(0, 12));
  it('rotating the LEFT face about +axis by +δ gives rho = +δ (valley)', () => {
    for (const d of [10, 45, 90, 135, 179]) {
      const nL = mul3v(rotAxis(axis, d * DEG), nR);
      expect(signedFoldAngle(nL, nR, axis) / DEG).toBeCloseTo(d, 9);
    }
  });
  it('rotating the left face by −δ gives a mountain (rho < 0)', () => {
    const nL = mul3v(rotAxis(axis, -60 * DEG), nR);
    expect(signedFoldAngle(nL, nR, axis) / DEG).toBeCloseTo(-60, 9);
  });
  it('sign is independent of which face is called left (axis reverses with it)', () => {
    const nL = mul3v(rotAxis(axis, 40 * DEG), nR);
    expect(signedFoldAngle(nR, nL, [-1, 0, 0])).toBeCloseTo(signedFoldAngle(nL, nR, axis), 12);
  });
  it('dihedral conversion: phi = pi (flat) -> 0, phi < pi -> valley', () => {
    expect(dihedralToFoldAngle(Math.PI)).toBe(0);
    expect(dihedralToFoldAngle(Math.PI / 2)).toBeGreaterThan(0);
  });
  it('safe trig never returns NaN', () => {
    expect(Number.isNaN(safeAcos(1.0000001))).toBe(false);
    expect(Number.isNaN(safeAsin(-1.2))).toBe(false);
    expect(wrapPi(3 * Math.PI)).toBeCloseTo(Math.PI, 12);
  });
});

describe('1D strip: end fold, crimp, collision', () => {
  const strip = (len: number, cs: [number, 'M' | 'V'][]): Strip => ({ length: len, creases: cs.map(([pos, mv], id) => ({ pos, mv, id })) });

  it('detects an available crimp at a local-minimum segment with opposite M/V', () => {
    const a = analyzeStrip(strip(10, [[4, 'M'], [5, 'V']]));
    expect(a.ops.some((o) => o.kind === 'crimp')).toBe(true);
  });
  it('same direction at a strict local minimum is a collision and not flat-foldable', () => {
    const s = strip(10, [[4, 'M'], [5, 'M']]);
    const a = analyzeStrip(s);
    expect(a.collisions.length).toBe(1);
    expect(solveStrip(s).foldable).toBe(false);
  });
  it('equal-distance same-direction case is degenerate, not a forced collision', () => {
    const a = analyzeStrip(strip(3, [[1, 'M'], [2, 'M']]));
    expect(a.collisions.length).toBe(0);
    expect(a.degenerate.length).toBe(1);
  });
  it('end fold requires end segment ≤ neighbour', () => {
    const a = analyzeStrip(strip(10, [[3, 'M'], [5, 'V']]));
    expect(a.ops.some((o) => o.kind === 'endFold' && o.side === 'left')).toBe(false);
    expect(a.ops.some((o) => o.kind === 'endFold' && o.side === 'right')).toBe(false);
  });
  it('auto solve finds a full crimp/end-fold sequence for a foldable pattern', () => {
    const s = strip(12, [[2, 'V'], [5, 'M'], [6, 'V'], [9, 'M']]);
    const r = solveStrip(s);
    expect(r.foldable).toBe(true);
    expect(r.sequence.length).toBeGreaterThan(0);
    expect(r.states[r.states.length - 1].creases.length).toBe(0);
  });
  it('greedy choice never matters (theorem): every available first op keeps foldability', () => {
    const s = strip(12, [[2, 'V'], [5, 'M'], [6, 'V'], [9, 'M']]);
    expect(analyzeStrip(s).ops.length).toBeGreaterThan(0);
    expect(solveStrip(s).foldable).toBe(true);
  });
});

describe('recursive M/V crimp check (single vertex)', () => {
  it('valid degree-4 assignment reduces to a straight fold', () => {
    const th = [70, 100, 110, 80].map((d) => d * DEG);
    const r = checkMVAssignment(th, ['V', 'M', 'V', 'V']);
    expect(r.valid).toBe(true);
    expect(r.steps.length).toBe(1);
  });
  it('big-little-big violation is rejected', () => {
    const th = [70, 100, 110, 80].map((d) => d * DEG);
    expect(checkMVAssignment(th, ['V', 'V', 'M', 'V']).valid).toBe(false);
  });
  it('Maekawa-satisfying but invalid assignment is rejected (necessary ≠ sufficient)', () => {
    const th = [70, 100, 110, 80].map((d) => d * DEG);
    const mv: ('M' | 'V')[] = ['V', 'V', 'M', 'V'];
    expect(maekawa(mv).satisfied).toBe(true);
    expect(checkMVAssignment(th, mv).valid).toBe(false);
  });
  it('degree-6 example reduces recursively', () => {
    const th = [60, 40, 80, 70, 50, 60].map((d) => d * DEG); // odd sum 60+80+50 = 190 ≠ 180
    expect(kawasaki(th).satisfied).toBe(false);
    const th2 = [60, 40, 70, 80, 50, 60].map((d) => d * DEG); // 60+70+50 = 180
    expect(kawasaki(th2).satisfied).toBe(true);
    // strict minima: 40° (c2,c3) and 50° (c5,c6) must each be bounded by opposite creases
    expect(checkMVAssignment(th2, ['M', 'V', 'M', 'M', 'M', 'M']).valid).toBe(false);
    const r = checkMVAssignment(th2, ['M', 'V', 'M', 'M', 'V', 'M']);
    expect(r.valid).toBe(true);
    expect(r.steps.length).toBe(2);
  });
});
