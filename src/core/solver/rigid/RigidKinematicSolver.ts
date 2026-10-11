/**
 * RigidKinematicSolver: drive ONE crease to a target fold angle and solve for
 * every other fold angle such that all facets stay rigid and every loop
 * closes. Fold angles are coupled; there is no independent per-crease control.
 *
 * Algorithm (predictor–corrector continuation):
 *   for the drive angle stepping from its current value toward the target:
 *     predictor : tangent  dq/dρ_drive  from  J_free δ = −J_drive h
 *                 (at the singular flat state: also an M/V-sign seed)
 *     corrector : Levenberg–Marquardt on ‖C(q)‖² (+ M/V sign, symmetry links)
 *     adaptive step; if the corrector fails at a minimal step the solve
 *     stops at the last VALID configuration and reports infeasibility.
 * The geometry is never deformed to "fake" a solution.
 */
import { choleskySolve } from '../../numerics/linearAlgebra';
import { TOL } from '../../numerics/tolerances';
import { toDeg } from '../../geometry/angles';
import type { OrigamiModel } from '../../topology/types';
import type { OrigamiSolver, SolverResult, SolverState } from '../types';
import { buildRigidSystem, evaluateBlocks, residualNorm, type RigidSystem } from './constraints';
import { analyzeDof, type DofAnalysis } from './jacobian';
import { faceTransforms, positionsFromTransforms } from './kinematics';
import { solveLM } from './nonlinearSolve';

export interface RigidOptions {
  enforceMV: boolean;
  useSymmetryLinks: boolean;
  baseFace?: number;
}

export class RigidKinematicSolver implements OrigamiSolver {
  readonly kind = 'rigid' as const;
  model!: OrigamiModel;
  sys!: RigidSystem;
  /** per-edge fold angles of the last VALID configuration */
  rho!: Float64Array;
  private initialRho!: Float64Array;
  drive: number | null = null;
  target = 0;
  locked = new Set<number>();
  options: RigidOptions = { enforceMV: true, useSymmetryLinks: false };
  lastResult: SolverResult | null = null;

  constructor(model?: OrigamiModel, rho?: Float64Array, options?: Partial<RigidOptions>) {
    if (options) this.options = { ...this.options, ...options };
    if (model) this.initialize(model, rho);
  }

  initialize(model: OrigamiModel, foldAngles?: Float64Array): void {
    this.model = model;
    this.sys = buildRigidSystem(model, this.options.baseFace);
    const r = new Float64Array(model.edges.length);
    for (const e of model.edges) r[e.id] = e.referenceFoldAngle;
    this.initialRho = r;
    this.rho = foldAngles ? new Float64Array(foldAngles) : new Float64Array(r);
  }

  reset(): void {
    this.rho = new Float64Array(this.initialRho);
    this.lastResult = null;
  }

  setDrivingCrease(id: number | null, targetAngle: number): void {
    this.drive = id;
    this.target = targetAngle;
  }

  setLocked(ids: Iterable<number>) {
    this.locked = new Set(ids);
  }

  getState(): SolverState {
    return { positions: this.positions(), foldAngles: new Float64Array(this.rho) };
  }

  step(): SolverState {
    this.solve();
    return this.getState();
  }

  positions(rho: Float64Array = this.rho): Float64Array {
    const ft = faceTransforms(this.model, this.sys.tree, rho);
    return positionsFromTransforms(this.model, ft.T).positions;
  }

  closureResidual(rho: Float64Array = this.rho): number {
    return residualNorm(evaluateBlocks(this.sys, rho, false));
  }

  analyze(rho: Float64Array = this.rho): DofAnalysis {
    return analyzeDof(this.sys, evaluateBlocks(this.sys, rho, true));
  }

  private varVector(rho: Float64Array): Float64Array {
    const { edgeOfVar } = this.sys.vars;
    return Float64Array.from(edgeOfVar, (eid) => rho[eid]);
  }

  private freeMask(): Uint8Array {
    const { edgeOfVar } = this.sys.vars;
    return Uint8Array.from(edgeOfVar, (eid) => (eid === this.drive || this.locked.has(eid) ? 0 : 1));
  }

  private links() {
    return this.options.useSymmetryLinks ? this.model.edu.symmetryLinks : [];
  }

  /** Tangent predictor: least-squares δq_free for a drive increment h. */
  private tangent(rho: Float64Array, free: Uint8Array, h: number): Float64Array | null {
    const { vars } = this.sys;
    const nVar = vars.edgeOfVar.length;
    const dv = this.drive === null ? -1 : vars.varOfEdge[this.drive];
    if (dv < 0) return null;
    const blocks = evaluateBlocks(this.sys, rho, true);
    const pos = new Int32Array(nVar).fill(-1);
    const freeIdx: number[] = [];
    for (let i = 0; i < nVar; i++) if (free[i]) { pos[i] = freeIdx.length; freeIdx.push(i); }
    const nf = freeIdx.length;
    if (nf === 0) return new Float64Array(nVar);
    const A = new Float64Array(nf * nf);
    const b = new Float64Array(nf);
    for (const blk of blocks) {
      const nc = blk.cols.length;
      const dcol = blk.cols.indexOf(dv);
      for (let row = 0; row < blk.rows; row++) {
        const jd = dcol >= 0 ? blk.J[row * nc + dcol] * h : 0;
        for (let x = 0; x < nc; x++) {
          const px = pos[blk.cols[x]];
          if (px < 0) continue;
          const jx = blk.J[row * nc + x];
          b[px] -= jx * jd;
          for (let y = 0; y < nc; y++) {
            const py = pos[blk.cols[y]];
            if (py >= 0) A[px * nf + py] += jx * blk.J[row * nc + y];
          }
        }
      }
    }
    for (const l of this.links()) {
      const ia = vars.varOfEdge[l.a], ib = vars.varOfEdge[l.b];
      const pa = ia >= 0 ? pos[ia] : -1, pb = ib >= 0 ? pos[ib] : -1;
      // derivative rows of (q_a − r q_b); drive contributes if a or b is the drive
      const ca = 1, cb = -l.ratio;
      const rhs = (ia === dv ? ca * h : 0) + (ib === dv ? cb * h : 0);
      if (pa >= 0) { A[pa * nf + pa] += ca * ca; b[pa] -= ca * rhs; }
      if (pb >= 0) { A[pb * nf + pb] += cb * cb; b[pb] -= cb * rhs; }
      if (pa >= 0 && pb >= 0) { A[pa * nf + pb] += ca * cb; A[pb * nf + pa] += ca * cb; }
    }
    let tr = 0;
    for (let i = 0; i < nf; i++) tr += A[i * nf + i];
    const reg = 1e-8 * (tr / nf + 1e-12);
    for (let i = 0; i < nf; i++) A[i * nf + i] += reg;
    const d = choleskySolve(A, nf, b);
    if (!d) return null;
    const out = new Float64Array(nVar);
    freeIdx.forEach((v, k) => (out[v] = d[k]));
    return out;
  }

  private nearReference(q: Float64Array): boolean {
    const { edgeOfVar } = this.sys.vars;
    for (let i = 0; i < q.length; i++) if (Math.abs(q[i] - this.model.edges[edgeOfVar[i]].referenceFoldAngle) > 1e-4) return false;
    return true;
  }

  /** One corrector solve from a set of candidate seeds; picks the best converged candidate. */
  private correct(seeds: Float64Array[], rhoFixed: Float64Array, free: Uint8Array, enforceMV: boolean) {
    let best: { q: Float64Array; residual: number; score: number; iterations: number } | null = null;
    for (const s of seeds) {
      const res = solveLM(this.sys, s, rhoFixed, {
        free, enforceMV, links: this.links(), mu: 1e-7, qRef: s, maxIter: 40,
      });
      // polish without regularization
      const pol = solveLM(this.sys, res.q, rhoFixed, { free, enforceMV, links: this.links(), mu: 0, maxIter: 15 });
      const ok = pol.residual < TOL.constraintFail && pol.mvViolation < 1e-6 && pol.linkViolation < 1e-6;
      if (!ok) continue;
      let dist = 0;
      for (let i = 0; i < s.length; i++) dist += (pol.q[i] - s[i]) ** 2;
      const score = dist;
      if (!best || score < best.score) best = { q: pol.q, residual: pol.residual, score, iterations: res.iterations + pol.iterations };
    }
    return best;
  }

  solve(): SolverResult {
    const reasons: string[] = [];
    if (this.drive === null || this.sys.vars.varOfEdge[this.drive] < 0) {
      const r = this.closureResidual();
      this.lastResult = { success: r < TOL.constraintFail, status: 'idle', iterations: 0, residualNorm: r, message: '구동 크리스가 선택되지 않았다', reasons };
      return this.lastResult;
    }
    const { vars } = this.sys;
    const dv = vars.varOfEdge[this.drive];
    const requested = this.target;
    if (Math.abs(requested) > Math.PI + 1e-9) {
      reasons.push('양립 불가능한 크리스 목표: |ρ|는 180°를 넘을 수 없다');
    }
    const goal = Math.max(-Math.PI, Math.min(Math.PI, requested));
    const free = this.freeMask();
    let rho = new Float64Array(this.rho);
    let q = this.varVector(rho);
    let totalIt = 0;
    let h = TOL.continuationStep;
    let failed = false;

    const startResidual = this.closureResidual(rho);
    if (startResidual > TOL.constraintFail) {
      // try to project the current state first
      const fixed = new Float64Array(rho);
      const best = this.correct([q], fixed, free, this.options.enforceMV);
      if (best) { q = best.q; vars.edgeOfVar.forEach((eid, i) => (rho[eid] = q[i])); }
    }

    let guard = 0;
    // secant predictor state (direction of the last accepted step)
    let qPrevStep: Float64Array | null = null;
    let hPrevStep = 0;
    while (Math.abs(goal - rho[this.drive]) > 1e-12 && guard++ < 5000) {
      const cur = rho[this.drive];
      const remaining = goal - cur;
      const hh = Math.sign(remaining) * Math.min(Math.abs(remaining), h);
      const next = cur + hh;
      const rhoFixed = new Float64Array(rho);
      rhoFixed[this.drive] = next;
      const base = new Float64Array(q);
      base[dv] = next;
      const primary: Float64Array[] = [];
      const tq = this.tangent(rho, free, hh);
      if (tq) {
        const sd = new Float64Array(base);
        for (let i = 0; i < sd.length; i++) if (free[i]) sd[i] += tq[i];
        primary.push(sd);
      }
      if (qPrevStep && hPrevStep !== 0) {
        // secant: continue along the previous step direction (robust near singular states)
        const sd = new Float64Array(base);
        const r = hh / hPrevStep;
        for (let i = 0; i < sd.length; i++) if (free[i]) sd[i] += r * (q[i] - qPrevStep[i]);
        primary.push(sd);
      }
      // M/V-informed seed: every crease moves in its assigned direction, scaled by its current
      // ratio to the drive (≥ 1). Essential when leaving the singular flat state.
      const mvSeed = new Float64Array(base);
      const qd = Math.abs(q[dv] - this.model.edges[this.drive].referenceFoldAngle);
      for (let i = 0; i < mvSeed.length; i++) {
        if (!free[i]) continue;
        const e = this.model.edges[vars.edgeOfVar[i]];
        const ratio = qd > 1e-9 ? Math.max(1, Math.abs(q[i] - e.referenceFoldAngle) / qd) : 1;
        mvSeed[i] += (e.assignment === 'M' ? -1 : e.assignment === 'V' ? 1 : 0) * Math.abs(hh) * ratio;
      }
      if (this.nearReference(q)) primary.push(mvSeed);
      primary.push(base);
      let best = this.correct(primary, rhoFixed, free, this.options.enforceMV);
      if (!best && !this.nearReference(q)) best = this.correct([mvSeed], rhoFixed, free, this.options.enforceMV);
      if (best) {
        qPrevStep = q;
        hPrevStep = hh;
        q = best.q;
        rho = rhoFixed;
        vars.edgeOfVar.forEach((eid, i) => (rho[eid] = q[i]));
        totalIt += best.iterations;
        h = Math.min(h * 1.5, 2 * TOL.continuationStep);
      } else {
        h /= 2;
        if (h < TOL.minContinuationStep) { failed = true; break; }
      }
    }

    this.rho = rho;
    const reached = rho[this.drive];
    const residual = this.closureResidual(rho);
    let dof: DofAnalysis | null = null;
    try { dof = this.analyze(rho); } catch { dof = null; }

    if (failed || reasons.length > 0) {
      if (failed) reasons.push(...this.diagnose(rho, reached + Math.sign(goal - reached) * TOL.minContinuationStep * 4, free, dof));
      this.lastResult = {
        success: false,
        status: Math.abs(reached - (this.drive !== null ? this.initialRho[this.drive] : 0)) > 1e-9 || totalIt > 0 ? 'partial' : 'infeasible',
        iterations: totalIt,
        residualNorm: residual,
        jacobianRank: dof?.fullRank.rank,
        conditionEstimate: dof?.fullRank.condition,
        reachedAngle: reached,
        requestedAngle: requested,
        message: `요청한 ρ = ${toDeg(requested).toFixed(1)}°에서 강체 해가 없다. 마지막 유효 배치 ρ = ${toDeg(reached).toFixed(2)}°에서 멈춤`,
        reasons,
      };
    } else {
      this.lastResult = {
        success: true,
        status: 'converged',
        iterations: totalIt,
        residualNorm: residual,
        jacobianRank: dof?.fullRank.rank,
        conditionEstimate: dof?.fullRank.condition,
        reachedAngle: reached,
        requestedAngle: requested,
        message: '강체 해를 찾았다',
        reasons,
      };
    }
    return this.lastResult;
  }

  /** Classify why the corrector failed beyond `rho`. */
  private diagnose(rho: Float64Array, tryAngle: number, free: Uint8Array, dof: DofAnalysis | null): string[] {
    const out: string[] = [];
    const { vars } = this.sys;
    const drive = this.drive!;
    if (dof && dof.dofLocal === 0) out.push('자유도 잠김: 적합 조건 야코비안이 열 랭크가 가득 차서 이 상태에서 강체 운동이 존재하지 않는다');
    if (dof && dof.dofLocal > 0 && this.drive !== null && Math.abs(rho[this.drive] - this.initialRho[this.drive]) < 1e-6)
      out.push(`1차 가동성만 존재: rank J로는 무한소 DoF가 ${dof.dofLocal}개 남지만 유한한 강체 운동은 존재하지 않는다 (고차 강성)`);
    if (dof && dof.fullRank.condition > 1e7) out.push('특이 배치: 이 지점에서 야코비안이 (거의) 랭크 부족이다 (분기점 또는 전환점)');
    if (this.locked.size > 0) out.push(`잠긴 크리스 ${this.locked.size}개가 가동성을 제거한다. 잠금을 해제하고 시험한다`);
    if (this.options.enforceMV) {
      const rhoFixed = new Float64Array(rho);
      rhoFixed[drive] = tryAngle;
      const q = Float64Array.from(vars.edgeOfVar, (eid) => rhoFixed[eid]);
      const res = solveLM(this.sys, q, rhoFixed, { free, enforceMV: false, links: this.links(), mu: 1e-7, maxIter: 60 });
      if (res.residual < TOL.constraintFail) {
        const flips: string[] = [];
        vars.edgeOfVar.forEach((eid, i) => {
          const a = this.model.edges[eid].assignment;
          if ((a === 'M' && res.q[i] > 1e-4) || (a === 'V' && res.q[i] < -1e-4)) flips.push(`e${eid}`);
        });
        if (flips.length) out.push(`M/V 배정 충돌: ${flips.slice(0, 6).join(', ')}${flips.length > 6 ? '…' : ''} 이(가) 배정과 반대로 접혀야만 강체 운동이 존재한다`);
      }
    }
    if (Math.abs(tryAngle) >= Math.PI - 1e-3) out.push('완전 접힘 한계(|ρ| → 180°)에 도달했다');
    if (out.length === 0) out.push('이 목표까지 메커니즘이 강체 접힘 가능하지 않다 (연속법으로 적합한 배치를 찾지 못했다)');
    return out;
  }

  /** Sweep the drive crease and record every fold angle (for plots). Does not modify this solver. */
  sweep(driveEdge: number, from: number, to: number, samples: number): { drive: number[]; rho: Float64Array[]; positions: Float64Array[]; ok: boolean } {
    // start from the reference configuration so the branch is selected from the flat state
    const s = new RigidKinematicSolver(this.model, undefined, this.options);
    s.locked = new Set(this.locked);
    s.setDrivingCrease(driveEdge, from);
    const r0 = s.solve();
    const drive: number[] = [], rho: Float64Array[] = [], positions: Float64Array[] = [];
    if (!r0.success) return { drive, rho, positions, ok: false };
    let ok = true;
    for (let k = 0; k <= samples; k++) {
      const t = from + ((to - from) * k) / samples;
      s.setDrivingCrease(driveEdge, t);
      const r = s.solve();
      if (!r.success) { ok = false; break; }
      drive.push(t);
      rho.push(new Float64Array(s.rho));
      positions.push(s.positions());
    }
    return { drive, rho, positions, ok };
  }
}
