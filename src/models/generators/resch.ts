import { buildModel, edgeKey } from '../../core/topology/build';
import type { Assignment, OrigamiModel } from '../../core/topology/types';
import type { Vec2 } from '../../core/geometry/vectors';

export interface ReschParams {
  /** lattice triangle side */
  s: number;
  /** tuck cells along the two lattice directions */
  m: number;
  n: number;
  /** 'valid' = standard Resch; 'perturbed' = tuck centres displaced (breaks Kawasaki) */
  variant: 'valid' | 'perturbed';
}

/**
 * Ron Resch triangle pattern (recipe decoded from the Origami Simulator
 * asset and checked numerically; cf. T. Tachi, "Designing freeform origami
 * tessellations by generalizing Resch's patterns", J. Mech. Des. 135 (2013)).
 *
 *  • equilateral lattice of side s: p(i,j) = i e1 + j e2
 *  • tuck = up-pointing triangle of side 2s (4 lattice triangles) centred at
 *    c = (s/2, −s/(2√3)) + m(e1+e2) + n(−e1+2e2)
 *      valley spokes  c → 3 corners       (target +180°)
 *      mountain spokes c → 3 edge midpts  (target −60°)
 *      the central small triangle's edges are NOT creases
 *  • every other lattice edge: mountain (target −90°)
 *  • surface: down-pointing triangles of side s (2 per tuck cell)
 * Vertex types: tuck centre (60°×6, 3M/3V), lattice vertex
 * (90,90,60,30,30,60; 5M/1V): Kawasaki holds, Maekawa does not, so the
 * pattern is NOT flat-foldable — it folds to a 3D (sandwich) surface.
 */
export function resch(p: ReschParams): OrigamiModel {
  const { s } = p;
  const e1: Vec2 = [s, 0], e2: Vec2 = [s / 2, (s * Math.sqrt(3)) / 2];
  const L = (i: number, j: number): Vec2 => [i * e1[0] + j * e2[0], i * e1[1] + j * e2[1]];
  const coords: Vec2[] = [];
  const latId = new Map<string, number>();
  const lat = (i: number, j: number) => {
    const k = `${i},${j}`;
    let v = latId.get(k);
    if (v === undefined) { v = coords.length; coords.push(L(i, j)); latId.set(k, v); }
    return v;
  };
  const faces: number[][] = [];
  const assign: Record<string, Assignment> = {};
  const targets: Record<string, number> = {};
  const tuckInterior = new Set<string>();
  const coveredUp = new Set<string>();
  const centralDown = new Set<string>();
  const tuckVerts = new Set<number>();
  const centres: number[] = [];
  let seed = 99;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let a = 0; a < p.m; a++)
    for (let b = 0; b < p.n; b++) {
      const oi = a - b, oj = a + 2 * b;
      const corners = [lat(oi, oj + 1), lat(oi, oj - 1), lat(oi + 2, oj - 1)];
      const mids = [lat(oi + 1, oj), lat(oi, oj), lat(oi + 1, oj - 1)]; // 30°, 150°, 270°
      const cBase = L(oi, oj);
      let c: Vec2 = [cBase[0] + s / 2, cBase[1] - s / (2 * Math.sqrt(3))];
      if (p.variant === 'perturbed') c = [c[0] + 0.12 * s * rnd(), c[1] + 0.12 * s * rnd()];
      const ci = coords.length;
      coords.push(c);
      centres.push(ci);
      // six triangles around c, CCW: corner(90°)→mid(150°)→corner(210°)→mid(270°)→corner(330°)→mid(30°)
      const ring = [corners[0], mids[1], corners[1], mids[2], corners[2], mids[0]];
      for (let k = 0; k < 6; k++) {
        faces.push([ci, ring[k], ring[(k + 1) % 6]]);
        tuckInterior.add(edgeKey(ring[k], ring[(k + 1) % 6]));
      }
      for (const v of ring) tuckVerts.add(v);
      corners.forEach((v) => { assign[edgeKey(ci, v)] = 'V'; targets[edgeKey(ci, v)] = Math.PI; });
      mids.forEach((v) => { assign[edgeKey(ci, v)] = 'M'; targets[edgeKey(ci, v)] = -Math.PI / 3; });
      coveredUp.add(`${oi},${oj - 1}`); coveredUp.add(`${oi + 1},${oj - 1}`); coveredUp.add(`${oi},${oj}`);
      centralDown.add(`${oi},${oj - 1}`);
    }
  // surface (down) triangles: (i+1,j), (i+1,j+1), (i,j+1) — include if all vertices belong to tucks
  const cand = new Set<string>();
  for (const k of latId.keys()) {
    const [i, j] = k.split(',').map(Number);
    for (const [di, dj] of [[0, 0], [-1, 0], [0, -1], [-1, -1], [-1, 1], [0, 1], [1, -1]]) cand.add(`${i + di},${j + dj}`);
  }
  for (const k of cand) {
    if (centralDown.has(k)) continue;
    const [i, j] = k.split(',').map(Number);
    const vs = [[i + 1, j], [i + 1, j + 1], [i, j + 1]];
    if (!vs.every(([a, b]) => latId.has(`${a},${b}`) && tuckVerts.has(latId.get(`${a},${b}`)!))) continue;
    const ids = vs.map(([a, b]) => latId.get(`${a},${b}`)!);
    faces.push(ids);
    for (let q = 0; q < 3; q++) {
      const key = edgeKey(ids[q], ids[(q + 1) % 3]);
      if (!(key in assign)) { assign[key] = 'M'; targets[key] = -Math.PI / 2; }
    }
  }
  // mark tuck boundary lattice edges (shared with surface triangles) as M −90°
  for (const key of tuckInterior) if (!(key in assign)) { assign[key] = 'M'; targets[key] = -Math.PI / 2; }
  const model = buildModel({
    name: `Ron Resch ${p.m}×${p.n} (${p.variant})`,
    description: 'Ron Resch triangle tessellation',
    generator: 'resch',
    coords2D: coords,
    faces,
    assignment: assign,
    targets,
    params: { s, m: p.m, n: p.n, variant: p.variant },
  });
  model.edu.highlightVertices = centres;
  model.edu.baseFace = 0;
  return model;
}
