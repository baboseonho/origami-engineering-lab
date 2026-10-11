/**
 * Generalized flat-foldability of a single vertex whose total sector angle is
 * not necessarily 2π (cone / non-flat vertex), as presented in Lecture 3.
 *
 * Fold the vertex flat: every sector is laid down on a plane, alternating
 * direction at each crease. Walking around the vertex, the image of ray k is
 * at angle
 *     φ_k = θ1 − θ2 + θ3 − … ± θ_k .
 * The walk must return to the starting ray: the alternating sum
 *     A = Σ (−1)^{i+1} θ_i
 * must be a multiple of 2π. Since each θ_i ∈ (0, 2π) and the image is a
 * closed walk of a single sheet around one point, the attainable values are
 *     A ∈ {0, +2π, −2π}   (lecture statement: 0°, ±360°).
 *
 * Generalized Maekawa (lecture): if A = 0 then |M − V| = 2; if A = ±2π then
 * M = V. (Intuition: A = ±2π means the folded image winds once around the
 * vertex, so the creases' turning contributions cancel in pairs.)
 *
 * Sources: Lecture 3 notes; T. Hull, "Origametry" (2020) ch. on flat
 * vertex folds; Demaine & O'Rourke (2007) §12.
 */
import { TOL } from '../numerics/tolerances';
import type { Assignment } from '../topology/types';

export interface GeneralizedReport {
  n: number;
  total: number;
  alternating: number;
  /** which of 0, +2π, −2π (in units of 2π) A matches, or null */
  windingClass: 0 | 1 | -1 | null;
  satisfied: boolean;
  /** partial alternating sums φ_k (folded image of each ray), for visualization */
  partials: number[];
}

export function alternatingSum(theta: number[]): number {
  return theta.reduce((s, t, i) => s + (i % 2 === 0 ? t : -t), 0);
}

export function generalizedFlatFold(theta: number[], tol: number = TOL.theoremAngle): GeneralizedReport {
  const n = theta.length;
  const total = theta.reduce((a, b) => a + b, 0);
  const A = alternatingSum(theta);
  let windingClass: 0 | 1 | -1 | null = null;
  if (Math.abs(A) < tol) windingClass = 0;
  else if (Math.abs(A - 2 * Math.PI) < tol) windingClass = 1;
  else if (Math.abs(A + 2 * Math.PI) < tol) windingClass = -1;
  const partials: number[] = [0];
  let acc = 0;
  theta.forEach((t, i) => {
    acc += i % 2 === 0 ? t : -t;
    partials.push(acc);
  });
  return { n, total, alternating: A, windingClass, satisfied: n % 2 === 0 && windingClass !== null, partials };
}

export interface GeneralizedMaekawaReport {
  M: number;
  V: number;
  expected: string;
  satisfied: boolean;
}

export function generalizedMaekawa(windingClass: 0 | 1 | -1 | null, assignments: Assignment[]): GeneralizedMaekawaReport {
  const M = assignments.filter((a) => a === 'M').length;
  const V = assignments.filter((a) => a === 'V').length;
  if (windingClass === null) return { M, V, expected: 'n/a (alternating sum ∉ {0, ±360°})', satisfied: false };
  if (windingClass === 0) return { M, V, expected: '|M − V| = 2', satisfied: Math.abs(M - V) === 2 };
  return { M, V, expected: 'M = V', satisfied: M === V };
}
