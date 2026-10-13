import { describe, expect, it } from 'vitest';
import { analyzeSectors, closureMargin, flatFoldedRays, panelCrossings, planarity, searchEmbeddings, solveVertex3D, D2R } from '../core/analysis/vertexWinding';
import { GK_CASES } from '../curriculum/gkawasakiCases';

const close = (a: number, b: number, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe('generalized Kawasaki: predefined cases (required values)', () => {
  const expected: Record<string, { T: number; S: number; O: number; E: number; winding: 0 | 1 | -1 | null; intrinsic: string }> = {
    A: { T: 360, S: 0, O: 180, E: 180, winding: 0, intrinsic: 'flat' },
    B: { T: 420, S: 0, O: 210, E: 210, winding: 0, intrinsic: 'saddle' },
    C: { T: 420, S: 360, O: 390, E: 30, winding: 1, intrinsic: 'saddle' },
    D: { T: 420, S: -360, O: 30, E: 390, winding: -1, intrinsic: 'saddle' },
    E: { T: 420, S: 180, O: 300, E: 120, winding: null, intrinsic: 'saddle' },
  };
  for (const c of GK_CASES) {
    it(`case ${c.id}: T, O, E, S, winding, class`, () => {
      const e = expected[c.id];
      const r = analyzeSectors(c.theta);
      close(r.total, e.T);
      close(r.odd, e.O);
      close(r.even, e.E);
      close(r.S, e.S);
      expect(r.winding).toBe(e.winding);
      expect(r.intrinsic).toBe(e.intrinsic);
      expect(r.pass).toBe(e.winding !== null);
      close(r.defect, 360 - e.T);
    });
  }

  it('odd/even indexing is 1-based: θ1, θ3, … are added, θ2, θ4, … subtracted', () => {
    const r = analyzeSectors([130, 10, 130, 10, 130, 10]);
    expect(r.phi).toEqual([0, 130, 120, 250, 240, 370, 360]);
  });

  it('S has a sign: reversing the order of an asymmetric case flips it', () => {
    expect(analyzeSectors([130, 10, 130, 10, 130, 10]).S).toBe(360);
    expect(analyzeSectors([10, 130, 10, 130, 10, 130]).S).toBe(-360);
  });

  it('tolerance: S within ε of ±360° passes, a visible miss does not', () => {
    expect(analyzeSectors([130 + 1e-9, 10, 130, 10, 130, 10]).pass).toBe(true);
    expect(analyzeSectors([130.5, 10, 130, 10, 130, 10]).pass).toBe(false);
  });

  it('odd number of creases never passes', () => {
    expect(analyzeSectors([120, 120, 120]).pass).toBe(false);
  });
});

describe('3D rigid-panel vertex: every panel keeps its sector angle', () => {
  for (const c of GK_CASES) {
    it(`case ${c.id}: solved shape matches θ exactly`, () => {
      const s = solveVertex3D(c.theta);
      expect(s.ok).toBe(true);
      expect(s.residual).toBeLessThan(1e-9);
      s.measured.forEach((m, i) => close(m, c.theta[i], 1e-6));
      const { lambda } = planarity(s.rays);
      if (c.id === 'A') expect(lambda).toBeLessThan(1e-9);
      else if (c.id === 'C' || c.id === 'D') {
        // flat-locked: the six rigid panels have no non-flat closed shape; the one they have is the winding
        expect(s.flatLocked).toBe(true);
        expect(lambda).toBeLessThan(1e-9);
      } else {
        // B and E: a clearly non-flat, crossing-free saddle
        expect(s.flatLocked).toBe(false);
        expect(lambda).toBeGreaterThan(0.02);
        expect(s.crossings).toBe(0);
      }
    });
  }
  it('a cone (T < 360°) is solved too', () => {
    const s = solveVertex3D([80, 80, 80, 80]);
    expect(s.ok).toBe(true);
    s.measured.forEach((m) => close(m, 80, 1e-6));
  });
});

describe('flat-folded state: ray k at φ_(k−1)', () => {
  for (const c of GK_CASES) {
    it(`case ${c.id}: closes exactly when S ∈ {0, ±360°}`, () => {
      const rays = flatFoldedRays(c.theta);
      const r = analyzeSectors(c.theta);
      // every panel keeps its angle inside the plane
      rays.forEach((a, i) => {
        const b = rays[(i + 1) % rays.length];
        const ang = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1]))) / D2R;
        if (i < rays.length - 1 || r.pass) close(ang, c.theta[i], 1e-6);
      });
      // the last panel ends at φ_n = S: back on ray 1 iff S ≡ 0 (mod 360°)
      const end = [Math.cos(r.S * D2R), Math.sin(r.S * D2R)];
      const back = Math.hypot(end[0] - 1, end[1]);
      if (r.pass) expect(back).toBeLessThan(1e-9); else expect(back).toBeGreaterThan(0.5);
    });
  }
});

describe('panel crossing test', () => {
  it('stacked coplanar panels are contact, not crossing', () => {
    expect(panelCrossings(flatFoldedRays([90, 90, 90, 90]))).toBe(0);
  });
});

describe('closure of rigid panels in 3D (Kapovich–Millson)', () => {
  it('margins: A, B, E open in 3D; C and D sit exactly on the flat-locked boundary', () => {
    const m = Object.fromEntries(GK_CASES.map((c) => [c.id, closureMargin(c.theta)]));
    expect(m.B.margin).toBeGreaterThan(1);
    expect(m.E.margin).toBeCloseTo(180, 9);
    expect(m.C.margin).toBeCloseTo(0, 9);
    expect(m.C.subset).toEqual([1, 3, 5]);
    expect(m.D.margin).toBeCloseTo(0, 9);
    expect(m.D.subset).toEqual([2, 4, 6]);
  });
  it('six creases: S ≤ 360° always, so S = +360° is the extreme case', () => {
    for (const th of [[130, 10, 130, 10, 130, 10], [150, 30, 150, 30, 120, 60], [100, 70, 60, 80, 50, 60]]) {
      const { S } = analyzeSectors(th);
      expect(S).toBeLessThanOrEqual(360 + 1e-9);
      // the margin of the odd subset is exactly 360° − S
      const odd = [0, 2, 4].reduce((a, i) => a + th[i], 0), even = [1, 3, 5].reduce((a, i) => a + th[i], 0);
      expect(2 * 180 - (odd - even)).toBeCloseTo(360 - S, 9);
    }
  });
  it('B and E: crossing-free 3D shapes are found by random search', () => {
    for (const id of ['B', 'E']) expect(searchEmbeddings(GK_CASES.find((c) => c.id === id)!.theta, 300).crossingFree).toBeGreaterThan(20);
  });
  it('near case C (odd sectors 130° − ε) the vertex opens, and flattens as ε → 0', () => {
    let prev = Infinity;
    for (const eps of [6, 3, 1, 0.3]) {
      const th = [130 - eps, 10, 130 - eps, 10, 130 - eps, 10];
      const s = solveVertex3D(th);
      expect(s.ok).toBe(true);
      expect(s.flatLocked).toBe(false);
      s.measured.forEach((m, i) => expect(Math.abs(m - th[i])).toBeLessThan(1e-6));
      expect(s.nonPlanarity).toBeLessThan(prev + 1e-9);
      prev = s.nonPlanarity;
    }
  });
  it('winding once does not by itself forbid a 3D shape: a 12-crease S = +360° vertex has one', () => {
    const th = [100, 10, 100, 10, 100, 10, 100, 10, 10, 10, 10, 10];
    expect(analyzeSectors(th).winding).toBe(1);
    expect(searchEmbeddings(th, 400).crossingFree).toBeGreaterThan(0);
  });
});
