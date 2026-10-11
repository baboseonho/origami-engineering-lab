/**
 * Damped Gauss–Newton / Levenberg–Marquardt on the block-sparse constraint
 * system, restricted to the free fold-angle variables.
 *
 * minimize  ½‖C(q)‖² + ½ w_mv² Σ penalty(M/V sign)² + ½ Σ (symmetry links)²
 *           + ½ μ ‖q − q_ref‖²       (tiny; only resolves null-space directions)
 *
 * The normal matrix JᵀJ is accumulated block by block (each vertex block
 * touches only its own creases), then solved densely with Cholesky.
 * Steps are clamped per variable and every iterate is checked for NaN.
 */
import { choleskySolve } from '../../numerics/linearAlgebra';
import { TOL } from '../../numerics/tolerances';
import { evaluateBlocks, type RigidSystem } from './constraints';

export interface LMOptions {
  /** per-variable flag: true = solve for it */
  free: Uint8Array;
  maxIter?: number;
  tol?: number;
  /** enforce assignment sign: M ⇒ rho ≤ 0, V ⇒ rho ≥ 0 */
  enforceMV?: boolean;
  /** symmetry links rho_a = ratio rho_b (edge ids) */
  links?: { a: number; b: number; ratio: number }[];
  /** null-space regularization toward qRef */
  mu?: number;
  qRef?: Float64Array;
}

export interface LMResult {
  q: Float64Array;
  converged: boolean;
  iterations: number;
  /** ‖C(q)‖ closure residual */
  residual: number;
  /** largest M/V sign violation (radians) */
  mvViolation: number;
  linkViolation: number;
}

const W_MV = 1.0;
const W_LINK = 1.0;

/** q is indexed by VARIABLE (see VariableMap). rhoFull holds every edge's angle (fixed ones included). */
export function solveLM(sys: RigidSystem, q0: Float64Array, rhoFixed: Float64Array, opts: LMOptions): LMResult {
  const { vars, model } = sys;
  const nVar = vars.edgeOfVar.length;
  const freeIdx: number[] = [];
  const pos = new Int32Array(nVar).fill(-1);
  for (let i = 0; i < nVar; i++) if (opts.free[i]) { pos[i] = freeIdx.length; freeIdx.push(i); }
  const nf = freeIdx.length;
  const maxIter = opts.maxIter ?? 60;
  const tol = opts.tol ?? TOL.constraint;
  const mu = opts.mu ?? 0;
  const qRef = opts.qRef ?? q0;
  const links = (opts.links ?? []).map((l) => ({ a: vars.varOfEdge[l.a], b: vars.varOfEdge[l.b], ratio: l.ratio })).filter((l) => l.a >= 0 && l.b >= 0);
  const assign = vars.edgeOfVar.map((eid) => model.edges[eid].assignment);

  const rho = new Float64Array(rhoFixed);
  const setRho = (q: Float64Array) => { for (let i = 0; i < nVar; i++) rho[vars.edgeOfVar[i]] = q[i]; };

  const mvRes = (q: Float64Array, i: number): number => {
    if (!opts.enforceMV || !opts.free[i]) return 0;
    if (assign[i] === 'M') return Math.max(0, q[i]);
    if (assign[i] === 'V') return Math.max(0, -q[i]);
    return 0;
  };

  const evalAll = (q: Float64Array, jac: boolean) => {
    setRho(q);
    const blocks = evaluateBlocks(sys, rho, jac);
    let closure = 0;
    for (const b of blocks) for (let i = 0; i < b.r.length; i++) closure += b.r[i] * b.r[i];
    let mv = 0, mvMax = 0;
    for (let i = 0; i < nVar; i++) { const r = mvRes(q, i); mv += (W_MV * r) ** 2; mvMax = Math.max(mvMax, r); }
    let lk = 0, lkMax = 0;
    for (const l of links) { const r = q[l.a] - l.ratio * q[l.b]; lk += (W_LINK * r) ** 2; lkMax = Math.max(lkMax, Math.abs(r)); }
    let reg = 0;
    for (const i of freeIdx) reg += mu * (q[i] - qRef[i]) ** 2;
    return { blocks, closure: Math.sqrt(closure), hard: closure + mv + lk, cost: closure + mv + lk + reg, mvMax, lkMax };
  };

  let q = new Float64Array(q0);
  let cur = evalAll(q, true);
  let lambda = 1e-3;
  let it = 0;
  const hardTol = tol * tol;
  for (; it < maxIter; it++) {
    if (cur.hard < hardTol && (mu === 0 || it > 0)) break;
    if (nf === 0) break;
    // Normal equations on free variables
    const A = new Float64Array(nf * nf);
    const g = new Float64Array(nf);
    for (const b of cur.blocks) {
      const nc = b.cols.length;
      const fc: number[] = [], fcLocal: number[] = [];
      for (let c = 0; c < nc; c++) { const p = pos[b.cols[c]]; if (p >= 0) { fc.push(p); fcLocal.push(c); } }
      for (let row = 0; row < b.rows; row++) {
        const rr = b.r[row];
        for (let x = 0; x < fc.length; x++) {
          const jx = b.J[row * nc + fcLocal[x]];
          if (jx === 0) continue;
          g[fc[x]] += jx * rr;
          for (let y = 0; y < fc.length; y++) A[fc[x] * nf + fc[y]] += jx * b.J[row * nc + fcLocal[y]];
        }
      }
    }
    for (let i = 0; i < nVar; i++) {
      const p = pos[i];
      if (p < 0) continue;
      const r = mvRes(q, i);
      if (r > 0) {
        const d = assign[i] === 'M' ? W_MV : -W_MV;
        A[p * nf + p] += d * d;
        g[p] += d * W_MV * r;
      }
    }
    for (const l of links) {
      const r = W_LINK * (q[l.a] - l.ratio * q[l.b]);
      const ja = pos[l.a], jb = pos[l.b];
      const da = W_LINK, db = -W_LINK * l.ratio;
      if (ja >= 0) { g[ja] += da * r; A[ja * nf + ja] += da * da; }
      if (jb >= 0) { g[jb] += db * r; A[jb * nf + jb] += db * db; }
      if (ja >= 0 && jb >= 0) { A[ja * nf + jb] += da * db; A[jb * nf + ja] += da * db; }
    }
    for (let x = 0; x < nf; x++) {
      A[x * nf + x] += mu;
      g[x] += mu * (q[freeIdx[x]] - qRef[freeIdx[x]]);
    }

    let accepted = false;
    for (let tries = 0; tries < 12; tries++) {
      const Ad = new Float64Array(A);
      for (let x = 0; x < nf; x++) Ad[x * nf + x] += lambda * (A[x * nf + x] + 1e-9) + 1e-12;
      const negG = g.map((v) => -v);
      const delta = choleskySolve(Ad, nf, negG);
      if (!delta) { lambda *= 10; continue; }
      let maxStep = 0;
      for (let x = 0; x < nf; x++) maxStep = Math.max(maxStep, Math.abs(delta[x]));
      const scl = maxStep > TOL.maxNewtonStep ? TOL.maxNewtonStep / maxStep : 1;
      const qn = new Float64Array(q);
      for (let x = 0; x < nf; x++) qn[freeIdx[x]] += scl * delta[x];
      if (!qn.every(Number.isFinite)) { lambda *= 10; continue; }
      const nxt = evalAll(qn, true);
      if (Number.isFinite(nxt.cost) && nxt.cost < cur.cost) {
        q = qn;
        cur = nxt;
        lambda = Math.max(lambda / 3, 1e-9);
        accepted = true;
        break;
      }
      lambda *= 4;
    }
    if (!accepted) break;
  }
  return {
    q,
    converged: cur.hard < hardTol * 100,
    iterations: it,
    residual: cur.closure,
    mvViolation: cur.mvMax,
    linkViolation: cur.lkMax,
  };
}
