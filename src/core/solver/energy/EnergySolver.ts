/**
 * EnergySolver: bar-and-hinge potential-energy relaxation.
 *
 *   V_total = Σ_bars   ½ k_axial/L0 (l − L0)²                 (axial stretching)
 *           + Σ_creases ½ k_crease m_e L0 (ρ − ρ_target)²     (crease torsion)
 *           + Σ_facets  ½ k_facet L0 (ρ − ρ0)²                (facet bending)
 *   F = −∇V  (+ bar damping)
 *
 * Two integrators:
 *  • dynamics: semi-implicit (symplectic) Euler  v ← v + dt F/m ; x ← x + dt v
 *    with relative-velocity bar damping c = 2ζ√(k m). Engineering deviation
 *    from naive explicit Euler: updating x with the NEW velocity is
 *    conditionally stable for stiff springs at no extra cost.
 *  • quasi-static: FIRE (Bitzek et al., PRL 97, 2006) — inertial descent that
 *    converges to a local minimum of V, used for load/displacement sweeps.
 *
 * Material constants are educational, not calibrated. The method is the same
 * family as Amanda Ghassaei et al., "Fast, interactive origami simulation
 * using GPU computation", 7OSME (2018) (Origami Simulator, MIT licence) —
 * re-derived and written fresh here; no source code was copied.
 */
import type { CyclicSymmetry, OrigamiModel } from '../../topology/types';
import type { OrigamiSolver, SolverResult, SolverState } from '../types';
import { hingeAngleGrad } from './creaseEnergy';
import { buildTriMesh, type TriMesh } from './mesh';
import { alignRigid, buildSymmetryGroup, projectSymmetric, symmetryError, type SymmetryGroup } from './symmetry';

export interface EnergyParams {
  kAxial: number;
  kCrease: number;
  kFacet: number;
  /** damping ratio ζ */
  damping: number;
  /** multiplier on the automatically chosen stable time step */
  dtScale: number;
  stepsPerFrame: number;
  /** stiffness multiplier for the driven crease */
  driveStiffness: number;
}

export const ENERGY_PRESETS: Record<'rigidLike' | 'paperLike' | 'veryFlexible', EnergyParams> = {
  rigidLike: { kAxial: 200, kCrease: 0.7, kFacet: 20, damping: 0.45, dtScale: 1, stepsPerFrame: 160, driveStiffness: 40 },
  paperLike: { kAxial: 40, kCrease: 0.7, kFacet: 2, damping: 0.45, dtScale: 1, stepsPerFrame: 100, driveStiffness: 40 },
  veryFlexible: { kAxial: 8, kCrease: 0.7, kFacet: 0.08, damping: 0.45, dtScale: 1, stepsPerFrame: 60, driveStiffness: 40 },
};

export interface EnergyBreakdown {
  axial: number;
  crease: number;
  facet: number;
  total: number;
  kinetic: number;
}

export class EnergySolver implements OrigamiSolver {
  readonly kind = 'energy' as const;
  model!: OrigamiModel;
  mesh!: TriMesh;
  params: EnergyParams = { ...ENERGY_PRESETS.paperLike };
  x!: Float64Array;
  v!: Float64Array;
  F!: Float64Array;
  mass!: Float64Array;
  fixed!: Uint8Array;
  prescribed!: Float64Array;
  /** per-hinge target angle and stiffness multiplier */
  hingeTarget!: Float64Array;
  hingeMult!: Float64Array;
  /** per-hinge unwrapped current angle */
  hingeRho!: Float64Array;
  dt = 0.01;
  time = 0;
  diverged = false;
  private x0!: Float64Array;
  private gradBuf = new Float64Array(12);
  drive: number | null = null;
  /** active symmetry group (symmetric mode), see setSymmetry */
  private sym: SymmetryGroup | null = null;
  /** the vertex clamp that symmetric mode replaced (restored when it ends) */
  private symSavedFixed: Uint8Array | null = null;
  private symTmp = new Float64Array(0);

  constructor(model?: OrigamiModel, params?: Partial<EnergyParams>) {
    if (params) this.params = { ...this.params, ...params };
    if (model) this.initialize(model);
  }

  initialize(model: OrigamiModel, _foldAngles?: Float64Array, positions?: Float64Array): void {
    this.model = model;
    this.mesh = buildTriMesh(model);
    const n = model.vertices.length;
    this.x0 = new Float64Array(3 * n);
    model.vertices.forEach((v, i) => { this.x0[3 * i] = v.referencePosition[0]; this.x0[3 * i + 1] = v.referencePosition[1]; this.x0[3 * i + 2] = v.referencePosition[2]; });
    this.x = positions ? new Float64Array(positions) : new Float64Array(this.x0);
    this.v = new Float64Array(3 * n);
    this.F = new Float64Array(3 * n);
    this.mass = Float64Array.from(model.vertices, (v) => v.mass);
    this.fixed = new Uint8Array(3 * n);
    this.prescribed = new Float64Array(this.x);
    const H = this.mesh.hinges.length;
    this.hingeTarget = new Float64Array(H);
    this.hingeMult = new Float64Array(H).fill(1);
    this.hingeRho = new Float64Array(H);
    this.mesh.hinges.forEach((h, i) => { this.hingeTarget[i] = h.rho0; this.hingeRho[i] = h.rho0; });
    this.refreshHingeAngles();
    this.updateTimeStep();
    this.time = 0;
    this.diverged = false;
    this.sym = null;
    this.symSavedFixed = null;
  }

  /** True while the solver is restricted to the declared symmetric subspace. */
  get symmetric(): boolean { return this.sym !== null; }

  /**
   * Symmetric mode: restrict the configuration to the subspace invariant under
   * the model's declared symmetry group (see symmetry.ts). Positions, velocities
   * and forces are projected (orbit-averaged) at every step, so FIRE and the
   * dynamics converge to an equilibrium WITHIN that subspace, which by
   * symmetric criticality is a true equilibrium of the whole bar-and-hinge
   * model: the idealised, imperfection-free structure. The symmetry also fixes
   * the rigid-body gauge (the axis is the z-axis), so the vertex clamp is
   * released while the mode is on and restored (at the current positions)
   * when it ends. The mode turns itself off whenever the loading stops being
   * symmetric (non-invariant crease targets or stiffnesses, a driven crease,
   * a new vertex clamp), so it can never symmetrise an asymmetric problem.
   * Returns whether the mode is on.
   */
  setSymmetry(decl: CyclicSymmetry | null | undefined): boolean {
    if (!decl) {
      if (this.sym) {
        this.sym = null;
        if (this.symSavedFixed) {
          this.fixed = this.symSavedFixed;
          for (let i = 0; i < this.x.length; i++) if (this.fixed[i]) this.prescribed[i] = this.x[i];
        }
        this.symSavedFixed = null;
      }
      return false;
    }
    if (this.sym) return true;
    const G = buildSymmetryGroup(this.model, this.mesh, decl);
    if (!G) return false;
    this.sym = G;
    if (!this.loadsSymmetric()) { this.sym = null; return false; }
    this.symSavedFixed = this.fixed;
    this.fixed = new Uint8Array(this.x.length);
    this.symTmp = new Float64Array(this.x.length);
    // bring the current shape into the symmetry frame (a rigid motion: no energy change), then project
    if (symmetryError(G, this.x) > 1e-9 * this.model.scale) alignRigid(this.x, this.x0);
    projectSymmetric(G, this.x, true, this.symTmp);
    this.v.fill(0);
    this.refreshHingeAngles();
    return true;
  }

  /** Are the crease targets and stiffnesses invariant under the active group? */
  private loadsSymmetric(): boolean {
    const G = this.sym;
    if (!G) return true;
    if (this.drive !== null && this.mesh.hingeOfEdge[this.drive] >= 0) return false;
    for (const hp of G.hingePerm)
      for (let i = 0; i < hp.length; i++) {
        const j = hp[i];
        if (Math.abs(this.hingeTarget[i] - this.hingeTarget[j]) > 1e-12 || Math.abs(this.hingeMult[i] - this.hingeMult[j]) > 1e-12) return false;
      }
    return true;
  }

  private symCheckLoads() {
    if (this.sym && !this.loadsSymmetric()) this.setSymmetry(null);
  }

  /** Max-norm symmetry error of the current positions (0 when not in symmetric mode). */
  symmetryError(): number {
    return this.sym ? symmetryError(this.sym, this.x) : 0;
  }

  /** max |F| over the free coordinates of the FULL (unprojected) model at the current positions. */
  residual(): number {
    const F = new Float64Array(this.x.length);
    this.computeForces(this.x, F, false);
    let m = 0;
    for (let i = 0; i < F.length; i++) if (!this.fixed[i]) m = Math.max(m, Math.abs(F[i]));
    return m;
  }

  reset(): void {
    this.x = new Float64Array(this.x0);
    this.v.fill(0);
    this.mesh.hinges.forEach((h, i) => (this.hingeRho[i] = h.rho0));
    this.refreshHingeAngles();
    this.time = 0;
    this.diverged = false;
  }

  setParams(p: Partial<EnergyParams>) {
    this.params = { ...this.params, ...p };
    this.updateTimeStep();
  }

  setPositions(pos: Float64Array) {
    this.x = new Float64Array(pos);
    this.v.fill(0);
    if (this.sym) {
      if (symmetryError(this.sym, this.x) > 1e-9 * this.model.scale) alignRigid(this.x, this.x0);
      projectSymmetric(this.sym, this.x, true, this.symTmp);
    }
    this.refreshHingeAngles();
  }

  /** Set the crease targets (per MODEL edge, radians) and stiffness multipliers. */
  setCreaseTargets(targets: Float64Array | ((edgeId: number) => number), mult?: (edgeId: number) => number) {
    this.mesh.hinges.forEach((h, i) => {
      if (h.kind !== 'crease') return;
      this.hingeTarget[i] = typeof targets === 'function' ? targets(h.modelEdge) : targets[h.modelEdge];
      this.hingeMult[i] = mult ? mult(h.modelEdge) : 1;
    });
    this.symCheckLoads();
    this.updateTimeStep();
  }

  /** Energy-mode driving crease: strong torsion spring on one crease toward the target. Others keep their targets. */
  setDrivingCrease(id: number | null, targetAngle: number): void {
    if (this.drive !== null) {
      const h0 = this.mesh.hingeOfEdge[this.drive];
      if (h0 >= 0) this.hingeMult[h0] = 1;
    }
    this.drive = id;
    if (id === null) return;
    const h = this.mesh.hingeOfEdge[id];
    if (h < 0) return;
    this.hingeTarget[h] = targetAngle;
    this.hingeMult[h] = this.params.driveStiffness;
    this.symCheckLoads();
    this.updateTimeStep();
  }

  /** Fix (or prescribe) some coordinates. mask bit 1=x, 2=y, 4=z. */
  fixVertices(ids: number[], mask = 7, values?: (id: number) => [number, number, number]) {
    if (this.sym) this.setSymmetry(null); // a clamp is not a symmetric load
    for (const i of ids) {
      const val = values ? values(i) : [this.x[3 * i], this.x[3 * i + 1], this.x[3 * i + 2]];
      for (let k = 0; k < 3; k++) if (mask & (1 << k)) {
        this.fixed[3 * i + k] = 1;
        this.prescribed[3 * i + k] = val[k];
        this.x[3 * i + k] = val[k];
        this.v[3 * i + k] = 0;
      }
    }
  }

  clearFixed() {
    this.fixed.fill(0);
    this.symSavedFixed?.fill(0);
  }

  private refreshHingeAngles() {
    this.mesh.hinges.forEach((h, i) => {
      const r = hingeAngleGrad(this.x, h.a, h.b, h.l, h.r, this.hingeRho[i], this.gradBuf);
      if (r.ok) this.hingeRho[i] = r.rho;
    });
  }

  private hingeK(i: number): number {
    const h = this.mesh.hinges[i];
    return (h.kind === 'crease' ? this.params.kCrease * this.hingeMult[i] : this.params.kFacet) * h.l0;
  }

  /**
   * Stable time step from the CURRENT geometry.
   * λ_max(M⁻¹K) ≤ max_i Σ_j |K_ij| / m_i  (Gershgorin). Rows:
   *   bar  k = k_a/L0          contributes 2k to both endpoints
   *   hinge K = k_h g gᵀ       contributes k_h |g_i| Σ_j |g_j| to vertex i
   * Bar damping rows (2c per bar) bound γ; damped semi-implicit Euler is
   * stable for ω dt < 2(√(1+β²) − β), β = γ/2ω; a 0.7
   * safety factor covers the geometric (∂²ρ) stiffness not included here.
   */
  updateTimeStep() {
    if (!this.mesh) return;
    const n = this.mesh.nV;
    const S = new Float64Array(n);
    const C = new Float64Array(n);
    for (const b of this.mesh.bars) {
      const k = this.params.kAxial / Math.max(b.l0, 1e-9);
      S[b.a] += 2 * k; S[b.b] += 2 * k;
      const c = 2 * this.params.damping * Math.sqrt(k * Math.min(this.mass[b.a], this.mass[b.b]));
      C[b.a] += 2 * c; C[b.b] += 2 * c;
    }
    this.mesh.hinges.forEach((h, i) => {
      const r = hingeAngleGrad(this.x, h.a, h.b, h.l, h.r, undefined, this.gradBuf);
      if (!r.ok) return;
      const k = this.hingeK(i);
      const gn = [0, 1, 2, 3].map((j) => Math.hypot(r.grad[3 * j], r.grad[3 * j + 1], r.grad[3 * j + 2]));
      const sum = gn[0] + gn[1] + gn[2] + gn[3];
      [h.a, h.b, h.l, h.r].forEach((v, j) => (S[v] += k * gn[j] * sum));
    });
    let lmax = 1e-12, gmax = 0;
    for (let i = 0; i < n; i++) { lmax = Math.max(lmax, S[i] / this.mass[i]); gmax = Math.max(gmax, C[i] / this.mass[i]); }
    // x'' = −ω²x − γx' (ω² = λ_K, γ = λ_C): semi-implicit Euler stable for dt < (2/ω)(√(1+β²) − β), β = γ/(2ω)
    const w = Math.sqrt(lmax), beta = gmax / (2 * w);
    const dt = (this.params.dtScale * 0.7 * 2 * (Math.sqrt(1 + beta * beta) - beta)) / w;
    if (Number.isFinite(dt) && dt > 0) this.dt = dt;
  }

  /** Accumulate conservative forces into F; returns the energy breakdown (kinetic omitted). */
  computeForces(x: Float64Array = this.x, F: Float64Array = this.F, updateAngles = true): EnergyBreakdown {
    F.fill(0);
    let axial = 0, crease = 0, facet = 0;
    for (const b of this.mesh.bars) {
      const dx = x[3 * b.b] - x[3 * b.a], dy = x[3 * b.b + 1] - x[3 * b.a + 1], dz = x[3 * b.b + 2] - x[3 * b.a + 2];
      const l = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (!(l > 1e-14)) continue;
      const k = this.params.kAxial / b.l0;
      const ext = l - b.l0;
      axial += 0.5 * k * ext * ext;
      const f = (k * ext) / l;
      F[3 * b.a] += f * dx; F[3 * b.a + 1] += f * dy; F[3 * b.a + 2] += f * dz;
      F[3 * b.b] -= f * dx; F[3 * b.b + 1] -= f * dy; F[3 * b.b + 2] -= f * dz;
    }
    const g = this.gradBuf;
    for (let i = 0; i < this.mesh.hinges.length; i++) {
      const h = this.mesh.hinges[i];
      const r = hingeAngleGrad(x, h.a, h.b, h.l, h.r, this.hingeRho[i], g);
      if (!r.ok) continue;
      if (updateAngles) this.hingeRho[i] = r.rho;
      const k = this.hingeK(i);
      const target = h.kind === 'crease' ? this.hingeTarget[i] : h.rho0;
      const d = r.rho - target;
      const e = 0.5 * k * d * d;
      if (h.kind === 'crease') crease += e; else facet += e;
      const tau = -k * d;
      const vs = [h.a, h.b, h.l, h.r];
      for (let j = 0; j < 4; j++) {
        const v = vs[j];
        F[3 * v] += tau * g[3 * j]; F[3 * v + 1] += tau * g[3 * j + 1]; F[3 * v + 2] += tau * g[3 * j + 2];
      }
    }
    return { axial, crease, facet, total: axial + crease + facet, kinetic: 0 };
  }

  kineticEnergy(): number {
    let k = 0;
    for (let i = 0; i < this.mesh.nV; i++)
      k += 0.5 * this.mass[i] * (this.v[3 * i] ** 2 + this.v[3 * i + 1] ** 2 + this.v[3 * i + 2] ** 2);
    return k;
  }

  energy(): EnergyBreakdown {
    const tmp = new Float64Array(this.F.length);
    const e = this.computeForces(this.x, tmp, false);
    e.kinetic = this.kineticEnergy();
    return e;
  }

  private addDamping() {
    const zeta = this.params.damping;
    for (const b of this.mesh.bars) {
      const k = this.params.kAxial / b.l0;
      const c = 2 * zeta * Math.sqrt(k * Math.min(this.mass[b.a], this.mass[b.b]));
      for (let q = 0; q < 3; q++) {
        const dv = this.v[3 * b.b + q] - this.v[3 * b.a + q];
        this.F[3 * b.a + q] += c * dv;
        this.F[3 * b.b + q] -= c * dv;
      }
    }
  }

  /** One semi-implicit Euler step (dynamics with damping). */
  /** Largest |axial strain| over all bars (cheap sanity measure). */
  private maxAbsStrain(): number {
    let m = 0;
    for (const b of this.mesh.bars) {
      const l = Math.hypot(this.x[3 * b.b] - this.x[3 * b.a], this.x[3 * b.b + 1] - this.x[3 * b.a + 1], this.x[3 * b.b + 2] - this.x[3 * b.a + 2]);
      const e = Math.abs(l - b.l0) / b.l0;
      if (!(e <= m)) m = Number.isFinite(e) ? e : Infinity;
    }
    return m;
  }

  private checkpoint: Float64Array | null = null;
  private stepCount = 0;

  /**
   * Semi-implicit Euler steps (dynamics with damping).
   * Robustness: the stable dt is re-estimated from the CURRENT geometry every
   * 20 steps (hinge stiffness grows like 1/h² as facets fold), and a verified
   * checkpoint is kept; on divergence (non-finite or > 300 % strain) the
   * state rolls back to it and dt is halved (flagged via `diverged`).
   */
  integrate(n = 1): void {
    const N = this.x.length;
    for (let s = 0; s < n; s++) {
      if (this.stepCount % 20 === 0) this.updateTimeStep();
      if (this.stepCount % 50 === 0) {
        const ms = this.maxAbsStrain();
        const ke = this.kineticEnergy();
        // runaway guard: strain > 300 % or kinetic energy far above any plausible elastic scale
        if (ms < 3 && ke < 1e3 * (1 + this.params.kAxial)) this.checkpoint = new Float64Array(this.x);
        else { this.rollback(); return; }
      }
      this.stepCount++;
      this.computeForces();
      this.addDamping();
      if (this.sym) projectSymmetric(this.sym, this.F, false, this.symTmp);
      const dt = this.dt;
      for (let i = 0; i < N; i++) {
        if (this.fixed[i]) { this.v[i] = 0; this.x[i] = this.prescribed[i]; continue; }
        this.v[i] += (dt * this.F[i]) / this.mass[(i / 3) | 0];
        this.x[i] += dt * this.v[i];
      }
      if (this.sym) { projectSymmetric(this.sym, this.v, false, this.symTmp); projectSymmetric(this.sym, this.x, true, this.symTmp); }
      let finite = true;
      for (let i = 0; i < N; i++) if (!Number.isFinite(this.x[i])) { finite = false; break; }
      if (!finite) { this.rollback(); return; }
      this.time += dt;
    }
  }

  private rollback() {
    if (this.checkpoint) this.x = new Float64Array(this.checkpoint);
    this.v.fill(0);
    this.diverged = true;
    this.params.dtScale *= 0.5;
    this.mesh.hinges.forEach((h, i) => (this.hingeRho[i] = h.rho0));
    this.refreshHingeAngles();
    this.updateTimeStep();
  }

  /**
   * FIRE minimisation toward a local minimum of V with the current
   * constraints. Returns iterations used and the final max |F| on free dofs.
   */
  relaxFIRE(maxIter = 4000, fTol = 1e-6): { iterations: number; maxForce: number; converged: boolean } {
    const N = this.x.length;
    let dt = this.dt, alpha = 0.1, npos = 0;
    const dtMax = this.dt * 4, Nmin = 5, finc = 1.1, fdec = 0.5, alpha0 = 0.1, falpha = 0.99;
    this.v.fill(0);
    let maxF = Infinity;
    let it = 0;
    for (; it < maxIter; it++) {
      this.computeForces();
      // symmetric mode: F is equivariant, so this only removes round-off; the minimum found is one of V on the subspace
      if (this.sym) projectSymmetric(this.sym, this.F, false, this.symTmp);
      maxF = 0;
      let P = 0, vn = 0, fn = 0;
      for (let i = 0; i < N; i++) {
        if (this.fixed[i]) { this.F[i] = 0; this.v[i] = 0; continue; }
        maxF = Math.max(maxF, Math.abs(this.F[i]));
        P += this.F[i] * this.v[i];
        vn += this.v[i] * this.v[i];
        fn += this.F[i] * this.F[i];
      }
      if (maxF < fTol) break;
      vn = Math.sqrt(vn); fn = Math.sqrt(fn);
      if (P > 0) {
        for (let i = 0; i < N; i++) if (!this.fixed[i]) this.v[i] = (1 - alpha) * this.v[i] + (alpha * vn * this.F[i]) / (fn || 1);
        if (++npos > Nmin) { dt = Math.min(dt * finc, dtMax); alpha *= falpha; }
      } else {
        npos = 0;
        dt *= fdec;
        alpha = alpha0;
        this.v.fill(0);
      }
      for (let i = 0; i < N; i++) {
        if (this.fixed[i]) { this.x[i] = this.prescribed[i]; continue; }
        this.v[i] += (dt * this.F[i]) / this.mass[(i / 3) | 0];
        this.x[i] += dt * this.v[i];
      }
      if (this.sym) { projectSymmetric(this.sym, this.v, false, this.symTmp); projectSymmetric(this.sym, this.x, true, this.symTmp); }
      if (!Number.isFinite(this.x[0])) { this.diverged = true; break; }
    }
    this.v.fill(0);
    return { iterations: it, maxForce: maxF, converged: maxF < fTol };
  }

  /** Current fold angle per MODEL edge (radians). */
  foldAngles(): Float64Array {
    const out = new Float64Array(this.model.edges.length);
    this.model.edges.forEach((e) => {
      const h = this.mesh.hingeOfEdge[e.id];
      out[e.id] = h >= 0 ? this.hingeRho[h] : 0;
    });
    return out;
  }

  /** Axial strain (l − L0)/L0 per bar. */
  strains(): Float64Array {
    return Float64Array.from(this.mesh.bars, (b) => {
      const l = Math.hypot(this.x[3 * b.b] - this.x[3 * b.a], this.x[3 * b.b + 1] - this.x[3 * b.a + 1], this.x[3 * b.b + 2] - this.x[3 * b.a + 2]);
      return (l - b.l0) / b.l0;
    });
  }

  /** |ρ − ρ0| for each facet hinge (facet bending measure). */
  facetBending(): { hinge: number; value: number }[] {
    const out: { hinge: number; value: number }[] = [];
    this.mesh.hinges.forEach((h, i) => { if (h.kind === 'facet') out.push({ hinge: i, value: Math.abs(this.hingeRho[i] - h.rho0) }); });
    return out;
  }

  /** Internal (conservative) force sum on a vertex set — the reaction is its negative. */
  forceOn(ids: number[]): [number, number, number] {
    const F = new Float64Array(this.x.length);
    this.computeForces(this.x, F, false);
    const s: [number, number, number] = [0, 0, 0];
    for (const i of ids) { s[0] += F[3 * i]; s[1] += F[3 * i + 1]; s[2] += F[3 * i + 2]; }
    return s;
  }

  getState(): SolverState {
    return { positions: new Float64Array(this.x), foldAngles: this.foldAngles(), time: this.time };
  }

  step(): SolverState {
    this.integrate(this.params.stepsPerFrame);
    return this.getState();
  }

  solve(): SolverResult {
    const r = this.relaxFIRE();
    const e = this.energy();
    return {
      success: r.converged && !this.diverged,
      status: this.diverged ? 'diverged' : r.converged ? 'converged' : 'partial',
      iterations: r.iterations,
      residualNorm: r.maxForce,
      message: r.converged ? `Energy minimum reached (V = ${e.total.toExponential(3)})` : 'Relaxation not fully converged',
      reasons: [],
    };
  }
}
