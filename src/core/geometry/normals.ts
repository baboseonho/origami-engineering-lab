import { cross, normalize, sub, type Vec3 } from './vectors';

/** Newell's method: robust polygon normal (unnormalized, |n| = 2*area). */
export function newellNormal(pts: Vec3[]): Vec3 {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return [nx, ny, nz];
}

export const polygonNormal = (pts: Vec3[]): Vec3 => normalize(newellNormal(pts), [0, 0, 1]);

export const triangleNormal = (a: Vec3, b: Vec3, c: Vec3): Vec3 => normalize(cross(sub(b, a), sub(c, a)), [0, 0, 1]);

export function polygonArea(pts: Vec3[]): number {
  const n = newellNormal(pts);
  return 0.5 * Math.hypot(n[0], n[1], n[2]);
}

/** Read vertex i from an interleaved position buffer. */
export const getP = (pos: Float64Array | number[], i: number): Vec3 => [pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]];
