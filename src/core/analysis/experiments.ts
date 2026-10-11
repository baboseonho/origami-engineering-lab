/**
 * Quasi-static, displacement-controlled experiments on the energy model.
 *
 * At each load step the prescribed coordinates are moved and the structure
 * is relaxed to a local minimum of V with FIRE (warm-started from the
 * previous step), i.e. we follow the equilibrium path V_min(u).
 * Reaction force proxies:
 *   F_react  = Σ_top F_z (internal force on the top plate; > 0 resists compression)
 *   F_fd     ≈ dV_min/du  (central differences on the recorded curve)
 * Both are NUMERICAL ESTIMATES of an educational bar-and-hinge model.
 */
import { EnergySolver, type EnergyBreakdown, type EnergyParams } from '../solver/energy/EnergySolver';
import type { OrigamiModel } from '../topology/types';

export interface AxialSweepConfig {
  /** total axial shortening */
  uMax: number;
  steps: number;
  /** if false the top ring rotation is prescribed by `twistPerU`·u */
  twistFree: boolean;
  twistPerU?: number;
  /** prescribed extra twist (radians), applied with twistFree = false */
  params: Partial<EnergyParams>;
  /** fix the top ring laterally (clamped) instead of letting it translate/rotate */
  clampTopXY?: boolean;
  maxIterPerStep?: number;
  /** record positions every k steps (memory) */
  recordEvery?: number;
}

export interface SweepSample {
  u: number;
  energy: EnergyBreakdown;
  reaction: number;
  twist: number;
  maxStrain: number;
  converged: boolean;
  positions?: Float64Array;
}

function ringTwist(x: Float64Array, x0: Float64Array, ids: number[]): number {
  let s = 0;
  for (const i of ids) {
    const a0 = Math.atan2(x0[3 * i + 1], x0[3 * i]);
    const a1 = Math.atan2(x[3 * i + 1], x[3 * i]);
    let d = a1 - a0;
    d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
    s += d;
  }
  return ids.length ? s / ids.length : 0;
}

export function setupAxial(model: OrigamiModel, params: Partial<EnergyParams>): EnergySolver {
  const s = new EnergySolver(model, params);
  const bottom = model.edu.groups?.bottom ?? [];
  s.fixVertices(bottom, 7);
  return s;
}

export function applyTopDisplacement(s: EnergySolver, model: OrigamiModel, u: number, twist: number | null, clampXY = false) {
  const top = model.edu.groups?.top ?? [];
  const x0 = model.vertices;
  for (const i of top) {
    const p = x0[i].referencePosition;
    const z = p[2] - u;
    if (twist === null && !clampXY) {
      s.fixed[3 * i] = 0; s.fixed[3 * i + 1] = 0;
      s.fixed[3 * i + 2] = 1; s.prescribed[3 * i + 2] = z; s.x[3 * i + 2] = z;
    } else {
      const t = twist ?? 0;
      const c = Math.cos(t), sn = Math.sin(t);
      const val: [number, number, number] = [c * p[0] - sn * p[1], sn * p[0] + c * p[1], z];
      for (let k = 0; k < 3; k++) { s.fixed[3 * i + k] = 1; s.prescribed[3 * i + k] = val[k]; s.x[3 * i + k] = val[k]; }
    }
  }
}

/** Torque about the cylinder axis (z) that the structure exerts on the top ring. */
export function topTorque(s: EnergySolver, top: number[]): number {
  const F = new Float64Array(s.x.length);
  s.computeForces(s.x, F, false);
  let t = 0;
  for (const i of top) t += s.x[3 * i] * F[3 * i + 1] - s.x[3 * i + 1] * F[3 * i];
  return t;
}

/**
 * Axial shortening `u` applied through a RIGID top plate that is free to
 * rotate about the axis (the usual test-rig boundary condition): the plate
 * has one degree of freedom, its twist θ, and equilibrium means zero torque.
 * θ is found by a secant iteration on τ(θ), each τ evaluated at a relaxed
 * (FIRE) state; the solver is left in the equilibrium state at the returned θ.
 * Leaving the ring vertices individually free instead would let the plate
 * slide sideways and pass through the tube, which no rig allows.
 */
export function relaxFreeTwist(s: EnergySolver, model: OrigamiModel, u: number, theta0: number, maxIter = 6000): { theta: number; converged: boolean; torque: number } {
  const top = model.edu.groups?.top ?? [];
  const at = (th: number) => {
    applyTopDisplacement(s, model, u, th);
    const r = s.relaxFIRE(maxIter, 1e-6);
    return { th, tau: topTorque(s, top), ok: r.converged };
  };
  const tol = 1e-7 * Math.max(1, top.length);
  let a = at(theta0);
  if (Math.abs(a.tau) < tol) return { theta: a.th, converged: a.ok, torque: a.tau };
  let b = at(theta0 + Math.sign(a.tau) * 0.01);
  let best = Math.abs(b.tau) < Math.abs(a.tau) ? b : a;
  for (let k = 0; k < 14 && Math.abs(b.tau) >= tol; k++) {
    const den = b.tau - a.tau;
    let step = Math.abs(den) > 1e-14 ? (-b.tau * (b.th - a.th)) / den : Math.sign(b.tau) * 0.05;
    // the plate turns towards the torque; keep steps bounded (snap-through branches)
    if (!Number.isFinite(step) || Math.sign(step) !== Math.sign(b.tau)) step = Math.sign(b.tau) * Math.min(0.05, Math.abs(b.th - a.th) || 0.05);
    step = Math.max(-0.25, Math.min(0.25, step));
    if (Math.abs(step) < 1e-7) break;
    a = b;
    b = at(b.th + step);
    if (Math.abs(b.tau) < Math.abs(best.tau)) best = b;
  }
  if (best !== b) b = at(best.th);
  return { theta: b.th, converged: b.ok, torque: b.tau };
}

export function runAxialSweep(model: OrigamiModel, cfg: AxialSweepConfig, onSample?: (s: SweepSample, k: number) => void): SweepSample[] {
  const s = setupAxial(model, cfg.params);
  const top = model.edu.groups?.top ?? [];
  const x0 = Float64Array.from(model.vertices.flatMap((v) => v.referencePosition));
  const out: SweepSample[] = [];
  let theta = 0;
  for (let k = 0; k <= cfg.steps; k++) {
    const u = (cfg.uMax * k) / cfg.steps;
    let r: { converged: boolean };
    if (cfg.twistFree && !cfg.clampTopXY) {
      // rigid top plate, free to rotate: twist from torque equilibrium (warm-started along the path)
      const q = relaxFreeTwist(s, model, u, theta, cfg.maxIterPerStep ?? 6000);
      theta = q.theta;
      r = q;
    } else {
      applyTopDisplacement(s, model, u, cfg.twistFree ? null : (cfg.twistPerU ?? 0) * u, cfg.clampTopXY);
      r = s.relaxFIRE(cfg.maxIterPerStep ?? 6000, 1e-6);
    }
    const e = s.energy();
    const F = s.forceOn(top);
    const strains = s.strains();
    let ms = 0;
    for (const v of strains) ms = Math.max(ms, Math.abs(v));
    const sample: SweepSample = {
      u,
      energy: e,
      reaction: F[2], // force the structure exerts on the top plate (+ = resists compression)
      twist: ringTwist(s.x, x0, top),
      maxStrain: ms,
      converged: r.converged,
      positions: k % (cfg.recordEvery ?? 1) === 0 ? new Float64Array(s.x) : undefined,
    };
    out.push(sample);
    onSample?.(sample, k);
  }
  return out;
}

/** dV/du by central differences along a recorded sweep. */
export function finiteDifferenceForce(samples: SweepSample[]): number[] {
  return samples.map((_, k) => {
    const a = samples[Math.max(0, k - 1)], b = samples[Math.min(samples.length - 1, k + 1)];
    const du = b.u - a.u;
    return du !== 0 ? (b.energy.total - a.energy.total) / du : 0;
  });
}

export interface PrescribedSweepConfig {
  /** vertices held fixed in all coordinates */
  fixed: number[];
  /** moving vertices: displacement = u · dir from the reference position (all coordinates prescribed) */
  moves: { vertex: number; dir: [number, number, number] }[];
  uMax: number;
  steps: number;
  params: Partial<EnergyParams>;
  maxIterPerStep?: number;
}

export interface FoldToSweepConfig {
  /** target fold angle per edge (edges not listed keep their reference angle) */
  targets: Record<number, number>;
  /** vertices held in place (e.g. the base facet) */
  fixed: number[];
  steps: number;
  params: Partial<EnergyParams>;
  maxIterPerStep?: number;
}

/**
 * Fold-to-state sweep: the crease rest angles are moved together from the
 * reference state (u = 0) to a target state (u = 1), relaxing to a local
 * minimum of V at every step. The facets are free to stretch and bend, so the
 * recorded strain and facet energy measure how far the path is from rigid.
 * `reaction` holds the facet (bending) energy share, a dimensionless proxy.
 */
export function runFoldToSweep(model: OrigamiModel, cfg: FoldToSweepConfig, onSample?: (s: SweepSample, k: number) => void): SweepSample[] {
  const s = new EnergySolver(model, cfg.params);
  s.fixVertices(cfg.fixed, 7);
  const out: SweepSample[] = [];
  for (let k = 0; k <= cfg.steps; k++) {
    const u = k / cfg.steps;
    s.setCreaseTargets((id) => {
      const e = model.edges[id];
      const t = cfg.targets[id];
      return t === undefined ? e.referenceFoldAngle : e.referenceFoldAngle + u * (t - e.referenceFoldAngle);
    });
    const r = s.relaxFIRE(cfg.maxIterPerStep ?? 6000, 1e-6);
    const e = s.energy();
    let ms = 0;
    for (const v of s.strains()) ms = Math.max(ms, Math.abs(v));
    const sample: SweepSample = { u, energy: e, reaction: e.total > 1e-12 ? e.facet / e.total : 0, twist: 0, maxStrain: ms, converged: r.converged, positions: new Float64Array(s.x) };
    out.push(sample);
    onSample?.(sample, k);
  }
  return out;
}

/** Generic displacement-controlled sweep (e.g. pushing the bag gussets inward). */
export function runPrescribedSweep(model: OrigamiModel, cfg: PrescribedSweepConfig, onSample?: (s: SweepSample, k: number) => void): SweepSample[] {
  const s = new EnergySolver(model, cfg.params);
  s.fixVertices(cfg.fixed, 7);
  const out: SweepSample[] = [];
  const ids = cfg.moves.map((m) => m.vertex);
  for (let k = 0; k <= cfg.steps; k++) {
    const u = (cfg.uMax * k) / cfg.steps;
    s.fixVertices(ids, 7, (i) => {
      const m = cfg.moves.find((q) => q.vertex === i)!;
      const p = model.vertices[i].referencePosition;
      return [p[0] + u * m.dir[0], p[1] + u * m.dir[1], p[2] + u * m.dir[2]];
    });
    const r = s.relaxFIRE(cfg.maxIterPerStep ?? 6000, 1e-6);
    const e = s.energy();
    let proj = 0;
    cfg.moves.forEach((m) => {
      const f = s.forceOn([m.vertex]);
      proj += -(f[0] * m.dir[0] + f[1] * m.dir[1] + f[2] * m.dir[2]);
    });
    let ms = 0;
    for (const v of s.strains()) ms = Math.max(ms, Math.abs(v));
    const sample: SweepSample = { u, energy: e, reaction: proj, twist: 0, maxStrain: ms, converged: r.converged, positions: new Float64Array(s.x) };
    out.push(sample);
    onSample?.(sample, k);
  }
  return out;
}
