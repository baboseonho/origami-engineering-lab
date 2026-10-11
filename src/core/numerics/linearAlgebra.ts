import { TOL } from './tolerances';
import type { Vec3 } from '../geometry/vectors';

/** Row-major 3x3 matrix stored as a length-9 array. */
export type Mat3 = number[];

export const I3 = (): Mat3 => [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function mul3(a: Mat3, b: Mat3): Mat3 {
  const r = new Array<number>(9);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return r;
}

export const mul3v = (a: Mat3, v: Vec3): Vec3 => [
  a[0] * v[0] + a[1] * v[1] + a[2] * v[2],
  a[3] * v[0] + a[4] * v[1] + a[5] * v[2],
  a[6] * v[0] + a[7] * v[1] + a[8] * v[2],
];

export const transpose3 = (a: Mat3): Mat3 => [a[0], a[3], a[6], a[1], a[4], a[7], a[2], a[5], a[8]];

/** Skew-symmetric cross-product matrix [w]x. */
export const skew = (w: Vec3): Mat3 => [0, -w[2], w[1], w[2], 0, -w[0], -w[1], w[0], 0];

/** Rodrigues rotation about unit axis u by angle t. */
export function rotAxis(u: Vec3, t: number): Mat3 {
  const c = Math.cos(t), s = Math.sin(t), C = 1 - c;
  const [x, y, z] = u;
  return [
    c + x * x * C, x * y * C - z * s, x * z * C + y * s,
    y * x * C + z * s, c + y * y * C, y * z * C - x * s,
    z * x * C - y * s, z * y * C + x * s, c + z * z * C,
  ];
}

/** Rigid transform x -> R x + t. */
export interface Rigid {
  R: Mat3;
  t: Vec3;
}
export const rigidIdentity = (): Rigid => ({ R: I3(), t: [0, 0, 0] });
export const applyRigid = (T: Rigid, p: Vec3): Vec3 => {
  const q = mul3v(T.R, p);
  return [q[0] + T.t[0], q[1] + T.t[1], q[2] + T.t[2]];
};
/** Composition (A ∘ B)(x) = A(B(x)). */
export function composeRigid(A: Rigid, B: Rigid): Rigid {
  const R = mul3(A.R, B.R);
  const t = applyRigid(A, B.t);
  return { R, t };
}
/** Rotation by angle t about the line through point p with unit direction u. */
export function rigidRotationAbout(p: Vec3, u: Vec3, t: number): Rigid {
  const R = rotAxis(u, t);
  const Rp = mul3v(R, p);
  return { R, t: [p[0] - Rp[0], p[1] - Rp[1], p[2] - Rp[2]] };
}

// ---------------------------------------------------------------------------
// Dense matrices (row-major Float64Array with explicit shape)
// ---------------------------------------------------------------------------
export interface Mat {
  rows: number;
  cols: number;
  data: Float64Array;
}
export const zeros = (rows: number, cols: number): Mat => ({ rows, cols, data: new Float64Array(rows * cols) });

/** Solve (A) x = b for symmetric positive definite A (n x n, row-major) via Cholesky.
 *  Returns null if A is not numerically SPD. */
export function choleskySolve(A: Float64Array, n: number, b: Float64Array): Float64Array | null {
  const L = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i * n + j];
      for (let k = 0; k < j; k++) s -= L[i * n + k] * L[j * n + k];
      if (i === j) {
        if (!(s > 0) || !Number.isFinite(s)) return null;
        L[i * n + i] = Math.sqrt(s);
      } else {
        L[i * n + j] = s / L[j * n + j];
      }
    }
  }
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = b[i];
    for (let k = 0; k < i; k++) s -= L[i * n + k] * y[k];
    y[i] = s / L[i * n + i];
  }
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i];
    for (let k = i + 1; k < n; k++) s -= L[k * n + i] * x[k];
    x[i] = s / L[i * n + i];
  }
  for (let i = 0; i < n; i++) if (!Number.isFinite(x[i])) return null;
  return x;
}

/**
 * Singular values of an m x n matrix via one-sided Jacobi (Hestenes).
 * Accurate for small/medium dense matrices; O(sweeps * n^2 * m).
 * Returns singular values sorted descending (length = min(m, n) padded with zeros to n).
 */
export function singularValues(M: Mat, maxSweeps = 40): number[] {
  const { rows: m, cols: n } = M;
  // Work on columns: copy into column-major arrays
  const cols: Float64Array[] = [];
  for (let j = 0; j < n; j++) {
    const c = new Float64Array(m);
    for (let i = 0; i < m; i++) c[i] = M.data[i * n + j];
    cols.push(c);
  }
  const eps = 1e-15;
  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let off = 0;
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        const cp = cols[p], cq = cols[q];
        let alpha = 0, beta = 0, gamma = 0;
        for (let i = 0; i < m; i++) {
          alpha += cp[i] * cp[i];
          beta += cq[i] * cq[i];
          gamma += cp[i] * cq[i];
        }
        if (Math.abs(gamma) <= eps * Math.sqrt(alpha * beta) || gamma === 0) continue;
        off = Math.max(off, Math.abs(gamma) / Math.sqrt(alpha * beta));
        const zeta = (beta - alpha) / (2 * gamma);
        const t = Math.sign(zeta || 1) / (Math.abs(zeta) + Math.sqrt(1 + zeta * zeta));
        const c = 1 / Math.sqrt(1 + t * t);
        const s = c * t;
        for (let i = 0; i < m; i++) {
          const a = cp[i], b = cq[i];
          cp[i] = c * a - s * b;
          cq[i] = s * a + c * b;
        }
      }
    }
    if (off < 1e-14) break;
  }
  const sv = cols.map((c) => {
    let s = 0;
    for (let i = 0; i < m; i++) s += c[i] * c[i];
    return Math.sqrt(s);
  });
  sv.sort((a, b) => b - a);
  return sv;
}

export interface RankInfo {
  rank: number;
  singularValues: number[];
  /** sigma_max / sigma_min over the numerically nonzero singular values. */
  condition: number;
  /** smallest singular value overall (0 if rank deficient). */
  sigmaMin: number;
}

export function numericalRank(M: Mat): RankInfo {
  if (M.rows === 0 || M.cols === 0) return { rank: 0, singularValues: [], condition: 1, sigmaMin: 0 };
  const sv = singularValues(M);
  const smax = sv[0] ?? 0;
  const tol = Math.max(TOL.rankAbsolute, TOL.rankRelative * smax);
  const nz = sv.filter((s) => s > tol);
  const rank = nz.length;
  const condition = rank > 0 ? smax / nz[nz.length - 1] : Infinity;
  const k = Math.min(M.rows, M.cols);
  return { rank, singularValues: sv.slice(0, Math.max(k, 0)), condition, sigmaMin: sv[Math.min(k, sv.length) - 1] ?? 0 };
}
