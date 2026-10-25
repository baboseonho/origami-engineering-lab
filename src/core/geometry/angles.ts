import { TOL } from '../numerics/tolerances';
import { cross, dot, normalize, type Vec3 } from './vectors';

/**
 * ANGLE CONVENTION (used everywhere in this project)
 *
 *  theta_i : sector angle between consecutive crease rays in the unfolded
 *            (reference) crease pattern.
 *  rho     : signed fold angle about a crease.
 *            rho = 0        -> unfolded / coplanar
 *            rho > 0        -> VALLEY  (faces rotate toward the paper's front
 *                                       side, i.e. toward the reference normal)
 *            rho < 0        -> MOUNTAIN
 *            |rho| -> pi    -> fully folded, faces nearly coincident
 *
 *  The conventional geometric "dihedral angle" (angle measured inside the
 *  paper between the two faces, = pi when flat) is NOT rho. Use
 *  `dihedralToFoldAngle` to convert explicitly.
 */

export const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);

/** acos with domain clamping: never produces NaN for slightly out-of-range input. */
export const safeAcos = (x: number): number => Math.acos(clamp(Number.isFinite(x) ? x : 1, -1, 1));
/** asin with domain clamping. */
export const safeAsin = (x: number): number => Math.asin(clamp(Number.isFinite(x) ? x : 0, -1, 1));

/** Wrap an angle to (-pi, pi]. */
export function wrapPi(a: number): number {
  if (!Number.isFinite(a)) return 0;
  let r = a % (2 * Math.PI);
  if (r <= -Math.PI) r += 2 * Math.PI;
  else if (r > Math.PI) r -= 2 * Math.PI;
  return r;
}

/** Wrap an angle to [0, 2pi). */
export function wrap2Pi(a: number): number {
  let r = a % (2 * Math.PI);
  if (r < 0) r += 2 * Math.PI;
  return r;
}

/** Unwrap `raw` (in (-pi,pi]) so that it is continuous with `prev`. */
export const unwrapNear = (raw: number, prev: number): number => prev + wrapPi(raw - prev);

/**
 * Signed fold angle rho of a hinge from the two face normals.
 *
 * Orientation: the crease direction `axis` runs from vertex a to vertex b,
 * and the LEFT face L is the face in whose counter-clockwise boundary the
 * edge appears as a->b. nL, nR are the (front-side) normals of L and R.
 *
 *     rho = atan2( (nR x nL) . axis , nR . nL )
 *
 * Flat check: nL = nR -> rho = 0. Rotating L about +axis by +delta (right-hand
 * rule) lifts it toward the front side and increases rho by delta (valley).
 */
export function signedFoldAngle(nL: Vec3, nR: Vec3, axis: Vec3): number {
  const a = normalize(axis);
  const s = dot(cross(nR, nL), a);
  const c = dot(nR, nL);
  if (Math.abs(s) < TOL.geometry && Math.abs(c) < TOL.geometry) return 0;
  return Math.atan2(s, c);
}

/**
 * Convert the conventional interior dihedral angle phi in [0, 2pi]
 * (phi = pi when flat, measured through the paper on the FRONT side)
 * into the signed fold angle rho.
 *
 * On the front side a valley closes the front-side interior angle, so
 *   rho = pi - phi   (phi < pi -> valley, rho > 0).
 */
export const dihedralToFoldAngle = (phiFront: number): number => Math.PI - phiFront;
export const foldAngleToDihedral = (rho: number): number => Math.PI - rho;

export const toDeg = (r: number): number => (r * 180) / Math.PI;
export const toRad = (d: number): number => (d * Math.PI) / 180;

export function fmtDeg(r: number, digits = 1): string {
  if (!Number.isFinite(r)) return '—';
  const d = toDeg(r);
  const s = d.toFixed(digits);
  if (Number(s) === 0) return (0).toFixed(digits) + '°'; // no "−0.000°"
  // a typographic minus, not a hyphen
  return (d > 0 ? '+' : '') + s.replace('-', '−') + '°';
}
