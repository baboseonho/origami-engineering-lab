/**
 * Kawasaki–Justin theorem (flat single vertex).
 *
 * A flat (Σθ = 2π) single vertex with an even number n of creases folds flat
 * iff the alternating sum of the sector angles vanishes:
 *     θ1 − θ2 + θ3 − … − θn = 0   ⇔   Σ odd θi = Σ even θi = π.
 *
 * Sources: T. Kawasaki (1989) "On the relation between mountain-creases and
 * valley-creases of a flat origami"; J. Justin (1986); T. Hull, "The
 * combinatorics of flat folds: a survey" (2002); Demaine & O'Rourke,
 * Geometric Folding Algorithms (2007), §12.2.
 *
 * Angles in this module are radians; θ is indexed from 1 in the lecture
 * (θ1 is "odd"), i.e. index 0 in arrays.
 */
import { TOL } from '../numerics/tolerances';

export interface KawasakiReport {
  n: number;
  evenDegree: boolean;
  total: number;
  sumOdd: number;
  sumEven: number;
  /** Σ odd − Σ even */
  residual: number;
  /** Σθ = 2π (flat sheet) */
  flatSheet: boolean;
  satisfied: boolean;
}

export function kawasaki(theta: number[], tol: number = TOL.theoremAngle): KawasakiReport {
  let sumOdd = 0, sumEven = 0;
  theta.forEach((t, i) => (i % 2 === 0 ? (sumOdd += t) : (sumEven += t)));
  const total = sumOdd + sumEven;
  const evenDegree = theta.length % 2 === 0 && theta.length >= 2;
  const residual = sumOdd - sumEven;
  const flatSheet = Math.abs(total - 2 * Math.PI) < tol;
  return {
    n: theta.length,
    evenDegree,
    total,
    sumOdd,
    sumEven,
    residual,
    flatSheet,
    satisfied: evenDegree && flatSheet && Math.abs(residual) < tol,
  };
}

/**
 * "Make flat-foldable": rotate ONE crease ray (the ray between sector k and
 * sector k+1) so that Kawasaki holds while the total stays 2π.
 * Moving that ray by δ changes θk by +δ and θk+1 by −δ, so the alternating
 * residual changes by ±2δ. This is the minimal single-ray adjustment.
 * Returns null if the required move would make a sector non-positive
 * (in that case the caller may try the other ray of sector k).
 */
export function fixBySector(theta: number[], k: number, minSector = 1e-3): number[] | null {
  const n = theta.length;
  if (n % 2 !== 0 || n < 2) return null;
  const r = kawasaki(theta).residual;
  const tryRay = (left: number): number[] | null => {
    // ray between sector `left` and sector `left+1`
    const right = (left + 1) % n;
    const sign = left % 2 === 0 ? 1 : -1; // increasing an odd-index (0-based even) sector raises the residual
    const delta = -r / (2 * sign);
    const out = [...theta];
    out[left] += delta;
    out[right] -= delta;
    if (out[left] < minSector || out[right] < minSector) return null;
    return out;
  };
  return tryRay(k) ?? tryRay((k - 1 + n) % n);
}

/** Convert degrees -> radians for convenience in UI / tests. */
export const kawasakiDeg = (thetaDeg: number[], tolDeg = 0.01) =>
  kawasaki(thetaDeg.map((d) => (d * Math.PI) / 180), (tolDeg * Math.PI) / 180);
