import { describe, expect, it } from 'vitest';
import { EnergySolver } from '../core/solver/energy/EnergySolver';
import { relaxFreeTwist, topTorque } from '../core/analysis/experiments';
import { kreslingYoshimuraPair, PAIR_PARAMS, PAIR_U_MAX } from '../models/pairs';
import { detectCollisions } from '../core/solver/collision/collision';

describe('rigid top plate, free to rotate (Kresling vs Yoshimura)', () => {
  const { k, y } = kreslingYoshimuraPair();
  const sweep = (m: typeof k) => {
    const s = new EnergySolver(m, PAIR_PARAMS);
    s.fixVertices(m.edu.groups!.bottom, 7);
    const top = m.edu.groups!.top;
    let th = 0;
    const out: { u: number; th: number; V: number; tau: number; cx: number; cy: number; coll: number }[] = [];
    for (let i = 0; i <= 9; i++) {
      const u = (PAIR_U_MAX * i) / 9;
      th = relaxFreeTwist(s, m, u, th).theta;
      let cx = 0, cy = 0;
      for (const v of top) { cx += s.x[3 * v]; cy += s.x[3 * v + 1]; }
      out.push({ u, th, V: s.energy().total, tau: topTorque(s, top), cx: cx / top.length, cy: cy / top.length, coll: detectCollisions(s.x, m.faces.flatMap((f) => f.triangles)).count });
    }
    return out;
  };
  const K = sweep(k), Y = sweep(y);
  it('the plate is in torque equilibrium and stays on the axis', () => {
    for (const r of [...K, ...Y]) {
      expect(Math.abs(r.tau)).toBeLessThan(1e-4);
      expect(Math.hypot(r.cx, r.cy)).toBeLessThan(1e-6);
    }
  });
  it('Kresling twists monotonically under compression; Yoshimura does not twist', () => {
    for (let i = 1; i < K.length; i++) expect(K[i].th).toBeGreaterThan(K[i - 1].th);
    expect(Math.abs(K[K.length - 1].th)).toBeGreaterThan(0.3);
    for (const r of Y) expect(Math.abs(r.th)).toBeLessThan(1e-6);
  });
  it('Yoshimura stores far more energy at the same shortening', () => {
    const last = K.length - 1;
    expect(Y[last].V).toBeGreaterThan(10 * K[last].V);
  });
  it('no self-intersection within the offered range', () => {
    for (const r of [...K, ...Y]) expect(r.coll).toBe(0);
  });
});
