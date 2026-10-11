import { buildModel, edgeKey } from '../../core/topology/build';
import type { Assignment, OrigamiModel } from '../../core/topology/types';
import type { Vec2 } from '../../core/geometry/vectors';

export interface SquareTwistParams {
  /** half side of the central square */
  h: number;
  /** twist angle φ (radians, 0 < φ < 45°) */
  phi: number;
  /** half side of the paper */
  L: number;
}

/**
 * Square twist (Fujimoto). Central square with corners C_k; from each corner
 * two pleat rays at angles φ and 90°+φ (rotated with k). Sector angles at
 * every corner vertex: 90 (square), 90+φ, 90, 90−φ → Kawasaki holds.
 * Assignment: square edges V, rays at φ V, rays at 90°+φ M (big–little–big
 * forces the crease pair around the 90−φ sector to differ) → 3V : 1M.
 *
 * This pattern is FLAT-FOLDABLE but NOT RIGID-FOLDABLE with this assignment:
 * the unfolded and the flat-folded states are both valid rigid configurations
 * that are not connected by a continuous rigid motion.
 */
export function squareTwist(p: SquareTwistParams): OrigamiModel {
  const { h, phi, L } = p;
  const rot = (v: Vec2, k: number): Vec2 => {
    const c = Math.cos((k * Math.PI) / 2), s = Math.sin((k * Math.PI) / 2);
    return [c * v[0] - s * v[1], s * v[0] + c * v[1]];
  };
  const C0: Vec2 = [h, h];
  const R0: Vec2 = [L, h + (L - h) * Math.tan(phi)];
  const T0: Vec2 = [h - (L - h) * Math.tan(phi), L];
  const K0: Vec2 = [L, L];
  const coords: Vec2[] = [];
  const C: number[] = [], R: number[] = [], T: number[] = [], K: number[] = [];
  for (let k = 0; k < 4; k++) {
    C.push(coords.length); coords.push(rot(C0, k));
    R.push(coords.length); coords.push(rot(R0, k));
    T.push(coords.length); coords.push(rot(T0, k));
    K.push(coords.length); coords.push(rot(K0, k));
  }
  const faces: number[][] = [[C[0], C[1], C[2], C[3]]];
  for (let k = 0; k < 4; k++) {
    const k1 = (k + 1) % 4;
    faces.push([C[k1], C[k], T[k], R[k1]]); // pleat strip
    faces.push([C[k], R[k], K[k], T[k]]); // corner region
  }
  const assign: Record<string, Assignment> = {};
  for (let k = 0; k < 4; k++) {
    assign[edgeKey(C[k], C[(k + 1) % 4])] = 'V';
    assign[edgeKey(C[k], R[k])] = 'V';
    assign[edgeKey(C[k], T[k])] = 'M';
  }
  const model = buildModel({
    name: 'Square twist',
    description: 'Flat-foldable but not rigid-foldable twist fold',
    generator: 'squareTwist',
    coords2D: coords,
    faces,
    assignment: assign,
    params: { h, phiDeg: (phi * 180) / Math.PI, L },
  });
  model.edu.baseFace = 0;
  const e0 = model.edges.find((e) => edgeKey(e.vertices[0], e.vertices[1]) === edgeKey(C[0], R[0]));
  if (e0) model.edu.defaultDrive = { edge: e0.id, angle: (20 * Math.PI) / 180 };
  model.edu.highlightVertices = [...C];
  // Flat-folded state: every crease at ±180° (sign from its assignment)
  const flat: Record<number, number> = {};
  for (const e of model.edges) if (e.faces[1] >= 0) flat[e.id] = e.assignment === 'M' ? -Math.PI : Math.PI;
  model.edu.referenceStates = [{ name: 'Flat-folded state', foldAngles: flat }];
  return model;
}
