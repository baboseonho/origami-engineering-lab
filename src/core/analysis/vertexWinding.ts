/**
 * Generalized Kawasaki for one vertex: intrinsic curvature vs. angular winding.
 *
 * Two different quantities of a single vertex with sector angles θ1 … θn:
 *
 *   T = Σ θi                       intrinsic: how much paper surrounds the vertex.
 *                                  δ = 360° − T is the angular defect (Gaussian
 *                                  curvature concentrated at the vertex):
 *                                  T = 360° flat sheet, T < 360° cone, T > 360° saddle.
 *
 *   S = θ1 − θ2 + θ3 − … − θn      the signed angular closure of the FLAT-FOLDED
 *                                  state. Folding flat lays the sectors on a plane
 *                                  with alternating orientation, so ray k lands at
 *                                  φk = θ1 − θ2 + … ± θk (φ0 = 0). The last ray must
 *                                  land on the first: S ≡ 0 (mod 360°). S = 0 means
 *                                  the walk comes back without a full turn; S = ±360°
 *                                  means it goes once around the vertex (winding ±1).
 *
 * The 3D (unfolded, rigid-panel) shape of the vertex is solved separately:
 * unit radial vectors r_i with r_i · r_{i+1} = cos θi (each panel keeps its
 * sector angle exactly), found by minimum-norm Gauss–Newton from a cone,
 * plane or saddle starting guess. No folding motion between the 3D shape and
 * the flat-folded state is claimed: the flat state is shown as its own exact
 * configuration (ray directions), without a verified path or layer order.
 *
 * All angles in this module's public API are DEGREES unless named *Rad.
 */
import { choleskySolve } from '../numerics/linearAlgebra';
import { tr } from '../../i18n';

export const D2R = Math.PI / 180;
export const R2D = 180 / Math.PI;
/** tolerance (degrees) for "S equals 0 / ±360°" and "T equals 360°" */
export const ANGLE_EPS = 1e-6;

export type IntrinsicClass = 'flat' | 'cone' | 'saddle';

export interface SectorReport {
  n: number;
  /** T = Σθ */
  total: number;
  /** δ = 360° − T (positive: deficit, negative: surplus) */
  defect: number;
  intrinsic: IntrinsicClass;
  /** O = θ1 + θ3 + …, E = θ2 + θ4 + … (1-based odd / even) */
  odd: number;
  even: number;
  /** S = O − E */
  S: number;
  /** cumulative alternating directions φ0 … φn (φn = S) */
  phi: number[];
  /** S / 360° when S ∈ {0, ±360°} (within ANGLE_EPS), else null */
  winding: 0 | 1 | -1 | null;
  /** generalized Kawasaki: n even and S ∈ {0°, ±360°} */
  pass: boolean;
  /** why it fails, for display */
  reason: string | null;
}

export function analyzeSectors(theta: number[], eps = ANGLE_EPS): SectorReport {
  const n = theta.length;
  const total = theta.reduce((a, b) => a + b, 0);
  let odd = 0, even = 0;
  const phi = [0];
  theta.forEach((t, i) => {
    // i is 0-based: θ1 (i = 0) is odd → +, θ2 → −
    if (i % 2 === 0) odd += t; else even += t;
    phi.push(phi[i] + (i % 2 === 0 ? t : -t));
  });
  const S = odd - even;
  let winding: 0 | 1 | -1 | null = null;
  if (Math.abs(S) < eps) winding = 0;
  else if (Math.abs(S - 360) < eps) winding = 1;
  else if (Math.abs(S + 360) < eps) winding = -1;
  const intrinsic: IntrinsicClass = Math.abs(total - 360) < eps ? 'flat' : total < 360 ? 'cone' : 'saddle';
  const reason = n % 2 !== 0
    ? tr('크리스 수가 홀수: 평탄 접힘에서 방향이 번갈아 바뀌지 않는다', 'Odd number of creases: directions cannot alternate in a flat fold')
    : winding === null ? tr(`S = ${fmtSigned(S)} ∉ {0°, ±360°}: 접힌 경로가 시작 광선으로 돌아오지 않는다`, `S = ${fmtSigned(S)} ∉ {0°, ±360°}: the folded path does not return to the first ray`) : null;
  return { n, total, defect: 360 - total, intrinsic, odd, even, S, phi, winding, pass: reason === null, reason };
}

export const fmtSigned = (x: number, d = 1) => `${x > 1e-9 ? '+' : x < -1e-9 ? '−' : ''}${Math.abs(x).toFixed(d)}°`;

// ───────────────────────────────────────────── 3D rigid-panel vertex

export type V3 = [number, number, number];

export interface VertexShape {
  /** unit radial vectors r_1 … r_n (crease directions) */
  rays: V3[];
  /** max |r_i·r_{i+1} − cos θi| and max ||r_i| − 1| */
  residual: number;
  ok: boolean;
  /** sector angle of each panel measured on the solved shape (degrees) */
  measured: number[];
  /** signed fold angle at each crease (degrees; crease i between panel i−1 and panel i) */
  fold: number[];
  /** non-adjacent panel pairs passing through each other in this shape */
  crossings: number;
  /** smallest eigenvalue of Σ r rᵀ: 0 = all creases in one plane */
  nonPlanarity: number;
  /** the rigid panels have no non-flat closed shape at all (closure margin = 0) */
  flatLocked: boolean;
  /** the panels cannot close at all (closure margin < 0) */
  noClosure: boolean;
}

export interface ClosureMargin {
  /** min over odd-size subsets I of (|I| − 1)·180° − (Σ_I θ − Σ_rest θ); degrees */
  margin: number;
  /** the subset (1-based indices) where the minimum is reached */
  subset: number[];
}

/**
 * Closure condition of a vertex made of rigid panels (a closed spherical
 * polygon with side lengths θi < 180°; Kapovich–Millson): for every subset I
 * of the sectors with an odd number of elements
 *     Σ_{i∈I} θi − Σ_{i∉I} θi  ≤  (|I| − 1)·180° .
 * margin > 0: the vertex closes in 3D (a family of non-flat shapes exists);
 * margin = 0: it closes only on one great circle — the panels are flat-locked;
 * margin < 0: it cannot close at all.
 * For six creases, I = {θ1, θ3, θ5} gives S ≤ 360°: S = +360° is exactly the
 * flat-locked boundary (likewise S = −360° with I = {θ2, θ4, θ6}).
 */
export function closureMargin(theta: number[]): ClosureMargin {
  const n = theta.length;
  const total = theta.reduce((a, b) => a + b, 0);
  let margin = Infinity, subset: number[] = [];
  for (let mask = 1; mask < 1 << n; mask++) {
    let k = 0, inSum = 0;
    for (let i = 0; i < n; i++) if (mask & (1 << i)) { k++; inSum += theta[i]; }
    if (k % 2 === 0) continue;
    const m = (k - 1) * 180 - (inSum - (total - inSum));
    if (m < margin) { margin = m; subset = []; for (let i = 0; i < n; i++) if (mask & (1 << i)) subset.push(i + 1); }
  }
  return { margin, subset };
}

/** Residual vector c(x): n unit-length constraints then n sector constraints. */
function constraints(x: Float64Array, cosT: number[]): Float64Array {
  const n = cosT.length;
  const c = new Float64Array(2 * n);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const xi = 3 * i, xj = 3 * j;
    c[i] = x[xi] * x[xi] + x[xi + 1] * x[xi + 1] + x[xi + 2] * x[xi + 2] - 1;
    c[n + i] = x[xi] * x[xj] + x[xi + 1] * x[xj + 1] + x[xi + 2] * x[xj + 2] - cosT[i];
  }
  return c;
}

/**
 * Minimum-norm Gauss–Newton onto the constraint set, starting from x:
 * Δ = −Jᵀ (J Jᵀ + μI)⁻¹ c. It lands on the exact constraint set near the
 * starting shape (the free directions — the mechanism's DoF and the global
 * rotation — are left as close to the start as possible).
 */
export function projectToConstraints(x0: Float64Array, cosT: number[], maxIter = 200, tol = 1e-13): { x: Float64Array; residual: number } {
  const n = cosT.length, m = 2 * n, N = 3 * n;
  const x = new Float64Array(x0);
  let res = Infinity;
  for (let it = 0; it < maxIter; it++) {
    const c = constraints(x, cosT);
    res = 0;
    for (let k = 0; k < m; k++) res = Math.max(res, Math.abs(c[k]));
    if (res < tol) break;
    // Jacobian (m × N)
    const J = new Float64Array(m * N);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      for (let a = 0; a < 3; a++) {
        J[i * N + 3 * i + a] = 2 * x[3 * i + a];
        J[(n + i) * N + 3 * i + a] += x[3 * j + a];
        J[(n + i) * N + 3 * j + a] += x[3 * i + a];
      }
    }
    const A = new Float64Array(m * m);
    for (let r = 0; r < m; r++) for (let s = r; s < m; s++) {
      let v = 0;
      for (let k = 0; k < N; k++) v += J[r * N + k] * J[s * N + k];
      A[r * m + s] = v; A[s * m + r] = v;
    }
    const mu = 1e-12 + 1e-6 * res;
    for (let r = 0; r < m; r++) A[r * m + r] += mu;
    const y = choleskySolve(A, m, c);
    if (!y) break;
    for (let k = 0; k < N; k++) {
      let v = 0;
      for (let r = 0; r < m; r++) v += J[r * N + k] * y[r];
      x[k] -= v;
    }
  }
  return { x, residual: res };
}

const toX = (rays: V3[]) => Float64Array.from(rays.flat());
const fromX = (x: Float64Array): V3[] => Array.from({ length: x.length / 3 }, (_, i) => [x[3 * i], x[3 * i + 1], x[3 * i + 2]] as V3);
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: V3): V3 => { const l = norm(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** Measured panel angles and signed fold angles of a shape. */
export function measureShape(rays: V3[], theta: number[]): { measured: number[]; fold: number[]; residual: number } {
  const n = rays.length;
  const measured = rays.map((r, i) => Math.acos(Math.max(-1, Math.min(1, dot(r, rays[(i + 1) % n]) / (norm(r) * norm(rays[(i + 1) % n]))))) * R2D);
  const normals = rays.map((r, i) => unit(cross(r, rays[(i + 1) % n])));
  const fold = rays.map((r, i) => {
    const a = normals[(i - 1 + n) % n], b = normals[i];
    return Math.atan2(dot(cross(a, b), unit(r)), dot(a, b)) * R2D;
  });
  let residual = 0;
  rays.forEach((r, i) => {
    residual = Math.max(residual, Math.abs(dot(r, r) - 1), Math.abs(dot(r, rays[(i + 1) % n]) - Math.cos(theta[i] * D2R)));
  });
  return { measured, fold, residual };
}

/** Smallest eigenpair of M = Σ r rᵀ (how far the rays are from lying in one plane). */
export function planarity(rays: V3[]): { lambda: number; normal: V3 } {
  const M = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const r of rays) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) M[3 * a + b] += r[a] * r[b];
  // cyclic Jacobi rotations on a symmetric 3×3 matrix
  const V = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  for (let sweep = 0; sweep < 30; sweep++) {
    for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
      const apq = M[3 * p + q];
      if (Math.abs(apq) < 1e-15) continue;
      const th = 0.5 * Math.atan2(2 * apq, M[3 * q + q] - M[3 * p + p]);
      const c = Math.cos(th), sn = Math.sin(th);
      for (let k = 0; k < 3; k++) {
        const mkp = M[3 * k + p], mkq = M[3 * k + q];
        M[3 * k + p] = c * mkp - sn * mkq; M[3 * k + q] = sn * mkp + c * mkq;
      }
      for (let k = 0; k < 3; k++) {
        const mpk = M[3 * p + k], mqk = M[3 * q + k];
        M[3 * p + k] = c * mpk - sn * mqk; M[3 * q + k] = sn * mpk + c * mqk;
      }
      for (let k = 0; k < 3; k++) {
        const vkp = V[3 * k + p], vkq = V[3 * k + q];
        V[3 * k + p] = c * vkp - sn * vkq; V[3 * k + q] = sn * vkp + c * vkq;
      }
    }
  }
  let k = 0;
  if (M[4] < M[3 * k + k]) k = 1;
  if (M[8] < M[3 * k + k]) k = 2;
  return { lambda: M[3 * k + k], normal: [V[k], V[3 + k], V[6 + k]] };
}

/**
 * Starting from an exact shape, move along the constraint set (projected
 * gradient steps) to make the vertex as clearly non-flat as possible: maximize
 * the smallest eigenvalue of Σ r rᵀ. Steps that would make panels pass through
 * each other are rejected, so the shape stays a valid (crossing-free) vertex.
 * Every accepted shape satisfies all panel angles exactly.
 */
function spreadOut(rays: V3[], cosT: number[], iters = 400): V3[] {
  let cur = rays;
  let { lambda, normal } = planarity(cur);
  const crossings = panelCrossings(cur);
  // a planar start has no gradient off the plane: nudge alternate rays up and down
  if (lambda < 1e-6) {
    const nudged = cur.map((r, i) => unit([r[0] + (i % 2 ? -0.08 : 0.08) * normal[0], r[1] + (i % 2 ? -0.08 : 0.08) * normal[1], r[2] + (i % 2 ? -0.08 : 0.08) * normal[2]]));
    const pr = projectToConstraints(toX(nudged), cosT);
    if (pr.residual < 1e-10) { const next = fromX(pr.x).map(unit); if (panelCrossings(next) <= crossings) { cur = next; ({ lambda, normal } = planarity(cur)); } }
  }
  let eta = 0.08;
  for (let it = 0; it < iters && eta > 1e-4; it++) {
    const step = cur.map((r) => { const d = dot(normal, r); return [r[0] + eta * 2 * d * normal[0], r[1] + eta * 2 * d * normal[1], r[2] + eta * 2 * d * normal[2]] as V3; });
    const pr = projectToConstraints(toX(step), cosT);
    if (pr.residual > 1e-10) { eta *= 0.5; continue; }
    const next = fromX(pr.x).map(unit);
    const q = planarity(next);
    if (q.lambda <= lambda + 1e-9 || panelCrossings(next) > crossings) { eta *= 0.5; continue; }
    cur = next; lambda = q.lambda; normal = q.normal;
    eta = Math.min(eta * 1.3, 0.3);
  }
  return cur;
}

/**
 * A closed 3D vertex whose panels have exactly the sector angles θ.
 * Starting guesses: the plane (T = 360°), a cone (T < 360°) or an
 * alternating up/down saddle (T > 360°), azimuths spread in proportion to θ.
 */
export function solveVertex3D(theta: number[], warm?: V3[]): VertexShape {
  const n = theta.length;
  const T = theta.reduce((a, b) => a + b, 0);
  const cosT = theta.map((t) => Math.cos(t * D2R));
  const finish = (shape: V3[], ok: boolean): VertexShape => {
    const m = measureShape(shape, theta);
    return { rays: shape, residual: m.residual, ok: ok && m.residual < 1e-9, measured: m.measured, fold: m.fold, crossings: panelCrossings(shape), nonPlanarity: planarity(shape).lambda, flatLocked: false, noClosure: false };
  };
  const cm = n <= 14 ? closureMargin(theta) : { margin: Infinity, subset: [] };
  if (cm.margin < -ANGLE_EPS) {
    const r = finish(flatFoldedRays(theta), false);
    return { ...r, noClosure: true };
  }
  // closure margin 0: the only closed shapes lie on one great circle; for S ∈ {0, ±360°} that is
  // the flat-folded state (each panel keeps its angle, alternate orientation)
  if (cm.margin < 1e-6 && Math.abs(T - 360) >= ANGLE_EPS) {
    const flat = flatFoldedRays(theta);
    const r = finish(flat, analyzeSectors(theta).pass);
    return { ...r, flatLocked: true };
  }
  // T = 360°: the vertex is ordinary flat paper; the plane is its shape (exact by construction)
  if (Math.abs(T - 360) < ANGLE_EPS) {
    let acc = 0;
    return finish(theta.map((t) => { const p = acc * D2R; acc += t; return [Math.cos(p), Math.sin(p), 0] as V3; }), true);
  }
  const flatEnough = (rays: V3[]) => planarity(rays).lambda;
  // warm start (a slider moved): follow the previous shape so the picture changes continuously
  if (warm && warm.length === n) {
    const pr = projectToConstraints(toX(warm), cosT);
    if (pr.residual < 1e-10) {
      const prevCross = panelCrossings(warm);
      const shape = spreadOut(fromX(pr.x).map(unit), cosT, 80);
      if (panelCrossings(shape) <= prevCross && flatEnough(shape) > 1e-7) return finish(shape, true);
    }
  }
  // cold start: structured guesses (cone / alternating saddle) and seeded random ones; keep the
  // exact, crossing-free shape that is furthest from flat
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const guesses: V3[][] = [];
  for (const tilt of [25, 40, 15, 55]) {
    let acc = 0;
    guesses.push(theta.map((t, i) => {
      const psi = ((acc * 360) / T) * D2R;
      acc += t;
      const beta = (T < 360 ? 90 - tilt : 90 + (i % 2 === 0 ? tilt : -tilt)) * D2R;
      return [Math.sin(beta) * Math.cos(psi), Math.sin(beta) * Math.sin(psi), Math.cos(beta)] as V3;
    }));
  }
  // directions drawn uniformly on the sphere
  for (let k = 0; k < 48; k++) guesses.push(theta.map(() => { const z = rnd() * 2 - 1, p = rnd() * 2 * Math.PI, r = Math.sqrt(1 - z * z); return [r * Math.cos(p), r * Math.sin(p), z] as V3; }));
  // Some sector sets have no crossing-free 3D shape at all (e.g. case C: three 130° panels joined
  // by 10° ones must wrap 60° of extra paper over itself); then the shape with the fewest
  // crossings is shown, and the crossings are reported, not hidden.
  let best: V3[] | null = null, bestKey = [Infinity, -Infinity];
  for (const g of guesses) {
    const pr = projectToConstraints(toX(g), cosT);
    if (pr.residual > 1e-10) continue;
    const shape = spreadOut(fromX(pr.x).map(unit), cosT, 200);
    const key = [panelCrossings(shape), flatEnough(shape)];
    if (key[1] < 1e-7) continue; // flat: not a picture of the 3D vertex (near the flat-locked boundary it is only slightly 3D)
    if (key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] > bestKey[1])) { best = shape; bestKey = key; }
    if (bestKey[0] === 0 && bestKey[1] > 0.12) break;
  }
  if (best) return finish(best, true);
  return finish(guesses[0], false);
}

/**
 * Numerical search (not a proof): project `samples` random direction sets onto
 * the exact constraint set and count the shapes that are clearly 3D and have
 * no crossing panels.
 */
export function searchEmbeddings(theta: number[], samples = 400, seed = 7): { exact: number; crossingFree: number; minCrossings: number } {
  const cosT = theta.map((t) => Math.cos(t * D2R));
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  let exact = 0, crossingFree = 0, minCrossings = Infinity;
  for (let k = 0; k < samples; k++) {
    const g = theta.flatMap(() => { const z = rnd() * 2 - 1, p = rnd() * 2 * Math.PI, r = Math.sqrt(1 - z * z); return [r * Math.cos(p), r * Math.sin(p), z]; });
    const pr = projectToConstraints(Float64Array.from(g), cosT, 120);
    if (pr.residual > 1e-10) continue;
    exact++;
    const rays = fromX(pr.x).map(unit);
    if (planarity(rays).lambda < 0.02) continue;
    const c = panelCrossings(rays);
    minCrossings = Math.min(minCrossings, c);
    if (c === 0) crossingFree++;
  }
  return { exact, crossingFree, minCrossings: Number.isFinite(minCrossings) ? minCrossings : 0 };
}

// ───────────────────────────────────────────── flat-folded state

/**
 * The flat-folded state: ray k lies in the plane at angle φ_{k−1}. Every
 * panel keeps its angle (|φ_k − φ_{k−1}| = θ_k), panels alternate their
 * orientation. It closes only if S ≡ 0 (mod 360°) — otherwise the last ray
 * does not return to the first and there is no flat-folded state.
 */
export function flatFoldedRays(theta: number[]): V3[] {
  const { phi } = analyzeSectors(theta);
  return theta.map((_, k) => [Math.cos(phi[k] * D2R), Math.sin(phi[k] * D2R), 0]);
}

/**
 * Number of non-adjacent panel pairs (triangles O, r_i, r_{i+1}) that pass
 * through each other. Coplanar overlap (stacked layers) counts as contact,
 * not crossing; the shared apex O is ignored.
 */
export function panelCrossings(rays: V3[]): number {
  const n = rays.length;
  const O: V3 = [0, 0, 0];
  const tri = (i: number): [V3, V3, V3] => [O, rays[i], rays[(i + 1) % n]];
  const segHits = (p: V3, q: V3, [a, b, c]: [V3, V3, V3]) => {
    const nrm = cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]]);
    const nl = norm(nrm) || 1;
    const dp = dot([p[0] - a[0], p[1] - a[1], p[2] - a[2]], nrm) / nl, dq = dot([q[0] - a[0], q[1] - a[1], q[2] - a[2]], nrm) / nl;
    const touch = 1e-7;
    if (Math.abs(dp) < touch || Math.abs(dq) < touch || dp * dq > 0) return false;
    const u = dp / (dp - dq);
    const X: V3 = [p[0] + u * (q[0] - p[0]), p[1] + u * (q[1] - p[1]), p[2] + u * (q[2] - p[2])];
    // inside test with a margin away from the shared apex
    const inside = [[a, b], [b, c], [c, a]].every(([s, e]) => dot(cross([e[0] - s[0], e[1] - s[1], e[2] - s[2]], [X[0] - s[0], X[1] - s[1], X[2] - s[2]]), nrm) > 1e-9);
    return inside && norm(X) > 1e-3;
  };
  let count = 0;
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue; // adjacent across the seam
    const A = tri(i), B = tri(j);
    // edges of each triangle, radial edges trimmed away from the shared apex
    const edges = (t: [V3, V3, V3]): [V3, V3][] => [
      [[t[1][0] * 0.02, t[1][1] * 0.02, t[1][2] * 0.02], t[1]],
      [[t[2][0] * 0.02, t[2][1] * 0.02, t[2][2] * 0.02], t[2]],
      [t[1], t[2]],
    ];
    if (edges(A).some(([p, q]) => segHits(p, q, B)) || edges(B).some(([p, q]) => segHits(p, q, A))) count++;
  }
  return count;
}
