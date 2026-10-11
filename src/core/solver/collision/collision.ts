/**
 * Self-intersection diagnostics (Level 2): triangle–triangle intersection
 * tests between NON-adjacent triangles (pairs sharing a vertex are skipped,
 * so facets meeting along a crease or at a vertex never count).
 *
 * Broad phase: axis-aligned bounding boxes sorted along x (sweep and prune).
 * Narrow phase: segment–triangle tests in both directions (each triangle's
 * edges against the other), with a small tolerance so that touching
 * coplanar layers of a flat-folded state are not reported as penetration.
 * Run after convergence / at reduced frequency, not every solver iteration.
 */
import { TOL } from '../../numerics/tolerances';

type V = [number, number, number];
const get = (x: Float64Array, i: number): V => [x[3 * i], x[3 * i + 1], x[3 * i + 2]];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Möller–Trumbore style segment/triangle test; strict interior intersection.
 * `touch` is a contact distance: an edge that only grazes the other facet's
 * plane (an endpoint within `touch` of it, as with stacked layers of a
 * flat-folded state carrying numerical noise) is contact, not penetration.
 */
function segmentHitsTriangle(p: V, q: V, a: V, b: V, c: V, eps: number, touch: number): boolean {
  const d = sub(q, p);
  const e1 = sub(b, a), e2 = sub(c, a);
  const nrm = cross(e1, e2);
  const nl = Math.sqrt(dot(nrm, nrm)) || 1;
  const dp = dot(sub(p, a), nrm) / nl, dq = dot(sub(q, a), nrm) / nl;
  if (Math.abs(dp) < touch || Math.abs(dq) < touch || dp * dq > 0) return false;
  const h = cross(d, e2);
  const det = dot(e1, h);
  const scale = Math.sqrt(dot(e1, e1) * dot(e2, e2) * dot(d, d)) || 1;
  if (Math.abs(det) < 1e-10 * scale) return false; // parallel / coplanar: treated as touching, not penetrating
  const inv = 1 / det;
  const s = sub(p, a);
  const u = inv * dot(s, h);
  if (u < eps || u > 1 - eps) return false;
  const qv = cross(s, e1);
  const v = inv * dot(d, qv);
  if (v < eps || u + v > 1 - eps) return false;
  const t = inv * dot(e2, qv);
  return t > eps && t < 1 - eps;
}

export interface CollisionReport {
  count: number;
  pairs: [number, number][];
  /** per-triangle flag */
  triangleHit: Uint8Array;
}

export function detectCollisions(x: Float64Array, tris: [number, number, number][], maxPairs = 500): CollisionReport {
  const n = tris.length;
  const box = new Float64Array(6 * n);
  for (let i = 0; i < n; i++) {
    const t = tris[i];
    for (let k = 0; k < 3; k++) { box[6 * i + k] = Infinity; box[6 * i + 3 + k] = -Infinity; }
    for (const v of t) for (let k = 0; k < 3; k++) {
      box[6 * i + k] = Math.min(box[6 * i + k], x[3 * v + k]);
      box[6 * i + 3 + k] = Math.max(box[6 * i + 3 + k], x[3 * v + k]);
    }
  }
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => box[6 * a] - box[6 * b]);
  const pairs: [number, number][] = [];
  const hit = new Uint8Array(n);
  const eps = TOL.collision * 10;
  // contact distance scales with the model: 1e-4 of its size (flat-folded layers sit closer than that)
  let diag = 0;
  for (let k = 0; k < 3; k++) {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < n; i++) { lo = Math.min(lo, box[6 * i + k]); hi = Math.max(hi, box[6 * i + 3 + k]); }
    if (n) diag += (hi - lo) ** 2;
  }
  const touch = Math.max(TOL.collision, 1e-4 * Math.sqrt(diag));
  for (let ii = 0; ii < n; ii++) {
    const i = order[ii];
    for (let jj = ii + 1; jj < n; jj++) {
      const j = order[jj];
      if (box[6 * j] > box[6 * i + 3] + TOL.collision) break;
      if (box[6 * j + 1] > box[6 * i + 4] || box[6 * i + 1] > box[6 * j + 4]) continue;
      if (box[6 * j + 2] > box[6 * i + 5] || box[6 * i + 2] > box[6 * j + 5]) continue;
      const A = tris[i], B = tris[j];
      if (A.some((v) => B.includes(v))) continue; // adjacent: share an edge or vertex
      const a = A.map((v) => get(x, v)) as [V, V, V];
      const b = B.map((v) => get(x, v)) as [V, V, V];
      let ok = false;
      for (let k = 0; k < 3 && !ok; k++) ok = segmentHitsTriangle(a[k], a[(k + 1) % 3], b[0], b[1], b[2], eps, touch);
      for (let k = 0; k < 3 && !ok; k++) ok = segmentHitsTriangle(b[k], b[(k + 1) % 3], a[0], a[1], a[2], eps, touch);
      if (ok) {
        hit[i] = 1; hit[j] = 1;
        if (pairs.length < maxPairs) pairs.push([i, j]);
      }
    }
  }
  return { count: pairs.length, pairs, triangleHit: hit };
}
