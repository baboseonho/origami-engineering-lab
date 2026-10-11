import { cross2, sub2, type Vec2 } from './vectors';

/**
 * Ear-clipping triangulation of a simple polygon given in CCW order (2D).
 * Returns index triples into `pts`. Falls back to a fan for degenerate input.
 */
export function earClip(pts: Vec2[]): [number, number, number][] {
  const n = pts.length;
  if (n < 3) return [];
  if (n === 3) return [[0, 1, 2]];
  const idx = pts.map((_, i) => i);
  const tris: [number, number, number][] = [];
  const isConvex = (a: Vec2, b: Vec2, c: Vec2) => cross2(sub2(b, a), sub2(c, b)) > 1e-14;
  const inside = (p: Vec2, a: Vec2, b: Vec2, c: Vec2) =>
    cross2(sub2(b, a), sub2(p, a)) >= -1e-14 && cross2(sub2(c, b), sub2(p, b)) >= -1e-14 && cross2(sub2(a, c), sub2(p, c)) >= -1e-14;
  let guard = 0;
  while (idx.length > 3 && guard++ < 10 * n) {
    let clipped = false;
    for (let k = 0; k < idx.length; k++) {
      const i0 = idx[(k + idx.length - 1) % idx.length], i1 = idx[k], i2 = idx[(k + 1) % idx.length];
      const a = pts[i0], b = pts[i1], c = pts[i2];
      if (!isConvex(a, b, c)) continue;
      let ok = true;
      for (const j of idx) {
        if (j === i0 || j === i1 || j === i2) continue;
        if (inside(pts[j], a, b, c)) { ok = false; break; }
      }
      if (!ok) continue;
      tris.push([i0, i1, i2]);
      idx.splice(k, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;
  }
  if (idx.length === 3) tris.push([idx[0], idx[1], idx[2]]);
  else if (idx.length > 3) for (let k = 1; k < idx.length - 1; k++) tris.push([idx[0], idx[k], idx[k + 1]]);
  return tris;
}
