import { buildModel, edgeKey } from '../../core/topology/build';
import type { Assignment, OrigamiModel } from '../../core/topology/types';
import type { Vec2 } from '../../core/geometry/vectors';

export interface TwistParams {
  /** number of sides of the central polygon (3, 4, 6, …) */
  n: number;
  /** twist angle φ (radians); clamped to the valid range, see twistPhiRange */
  phi: number;
  /** apothem (centre-to-side distance) of the central polygon */
  h: number;
  /** apothem of the paper polygon (> h) */
  L: number;
}

const DEG = Math.PI / 180;

/**
 * Valid twist angles for an n-gon twist with the assignment below:
 *  • φ < 180°/n  so every pleat ray reaches its own side of the paper polygon
 *    (the corner region keeps positive width); we keep 2° of margin.
 *  • n = 3 only: φ ≥ 30°. The polygon corner angle 180° − 360/n is the
 *    smallest sector unless φ ≥ 360/n − 90 (= 30° for n = 3). If it were the
 *    strict minimum, big–little–big would force the two polygon edges at each
 *    corner to have opposite M/V, impossible around a triangle (odd cycle).
 *    For n ≥ 4 the bound 360/n − 90 ≤ 0 never binds.
 */
export function twistPhiRange(n: number): [number, number] {
  const lo = Math.max(2 * DEG, (360 / n - 90) * DEG);
  const hi = Math.PI / n - 2 * DEG;
  return [lo, hi];
}

/**
 * Regular n-gon twist fold (generalised from the square twist, Fujimoto;
 * see also R. Lang, "Twists, Tilings, and Tessellations", CRC 2018, ch. 2).
 *
 * Central regular n-gon with corners C_k (apothem h). Side k (C_k → C_{k+1},
 * outward normal ν_k) carries a pleat: two PARALLEL rays, from C_k and from
 * C_{k+1}, both in the direction ν_k + φ, ending on side k of the paper
 * polygon (apothem L, sides parallel to the central polygon's).
 *
 * Sector angles at every corner C_k, counter-clockwise starting from the
 * polygon edge to C_{k−1}:
 *     90° + φ,  360°/n,  90° − φ,  180° − 360°/n
 * Alternating sums: (90 + φ) + (90 − φ) = 180°  → Kawasaki holds for every n, φ.
 * Assignment: polygon edges V, ray leaving C_k on side k (the start of the
 * pleat) M, ray leaving C_k on side k−1 V → 3V : 1M (Maekawa). The M ray
 * borders the 90° − φ sector, whose other crease is a V polygon edge, and the
 * 360/n sector between the two rays (V | M): big–little–big holds whenever
 * either is the smallest sector (the n = 3 case is handled by twistPhiRange).
 * For n = 4 this reproduces squareTwist exactly.
 *
 * Like the square twist this is FLAT-FOLDABLE (every vertex locally; the
 * ±180° state closes) but NOT RIGID-FOLDABLE with this assignment: the rigid
 * solver cannot leave the unfolded state (checked in tests for n = 3, 4, 6).
 */
export function twist(p: TwistParams): OrigamiModel {
  const n = Math.max(3, Math.round(p.n));
  const { h, L } = p;
  const [lo, hi] = twistPhiRange(n);
  const phi = Math.min(hi, Math.max(lo, p.phi));
  const at = (r: number, t: number): Vec2 => [r * Math.cos(t), r * Math.sin(t)];
  const step = (2 * Math.PI) / n;
  const nu = (k: number) => (k + 1) * step; // outward normal of side k (C_k → C_{k+1})
  const reach = (L - h) / Math.cos(phi); // ray length from the inner side to the outer side
  const coords: Vec2[] = [];
  const C: number[] = [], S: number[] = [], E: number[] = [], K: number[] = [];
  for (let k = 0; k < n; k++) { C.push(coords.length); coords.push(at(h / Math.cos(Math.PI / n), (k + 0.5) * step)); }
  for (let k = 0; k < n; k++) {
    const c = coords[C[k]];
    // S_k: ray from C_k along side k (start of pleat k);  E_k: ray from C_k along side k−1 (end of pleat k−1)
    const ds = at(reach, nu(k) + phi), de = at(reach, nu(k - 1) + phi);
    S.push(coords.length); coords.push([c[0] + ds[0], c[1] + ds[1]]);
    E.push(coords.length); coords.push([c[0] + de[0], c[1] + de[1]]);
    K.push(coords.length); coords.push(at(L / Math.cos(Math.PI / n), (k + 0.5) * step));
  }
  const faces: number[][] = [[...C]];
  for (let k = 0; k < n; k++) {
    const k1 = (k + 1) % n;
    faces.push([C[k1], C[k], S[k], E[k1]]); // pleat strip on side k
    faces.push([C[k], E[k], K[k], S[k]]); // corner region
  }
  const assign: Record<string, Assignment> = {};
  for (let k = 0; k < n; k++) {
    assign[edgeKey(C[k], C[(k + 1) % n])] = 'V';
    assign[edgeKey(C[k], E[k])] = 'V';
    assign[edgeKey(C[k], S[k])] = 'M';
  }
  const model = buildModel({
    name: `${n}-gon twist`,
    description: `Regular ${n}-gon twist (φ = ${(phi / DEG).toFixed(1)}°): flat-foldable but not rigid-foldable`,
    generator: 'twist',
    coords2D: coords,
    faces,
    assignment: assign,
    params: { n, phiDeg: phi / DEG, h, L },
  });
  model.edu.baseFace = 0;
  model.edu.highlightVertices = [...C];
  // label the four creases at C_0 in counter-clockwise order (sectors 90+φ, 360/n, 90−φ, 180−360/n follow)
  const find = (a: number, b: number) => model.edges.find((e) => edgeKey(e.vertices[0], e.vertices[1]) === edgeKey(a, b))!;
  [find(C[0], C[n - 1]), find(C[0], E[0]), find(C[0], S[0]), find(C[0], C[1])].forEach((e, i) => (model.edu.creaseLabels[e.id] = `ρ${i + 1}`));
  const drive = find(C[0], E[0]);
  model.edu.defaultDrive = { edge: drive.id, angle: 20 * DEG };
  // Flat-folded state: every crease at ±180° by its assignment (closes by Kawasaki at each vertex)
  const flat: Record<number, number> = {};
  for (const e of model.edges) if (e.faces[1] >= 0) flat[e.id] = e.assignment === 'M' ? -Math.PI : Math.PI;
  model.edu.referenceStates = [{ name: 'Flat-folded state', foldAngles: flat }];
  model.edu.notes = [`φ clamped to [${(lo / DEG).toFixed(1)}°, ${(hi / DEG).toFixed(1)}°] for n = ${n}`];
  return model;
}
