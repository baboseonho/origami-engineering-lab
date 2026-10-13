/**
 * Application actions: the only place where stores, the engine (solver
 * instances) and the worker meet. Components call these; solvers never live
 * inside React components.
 */
import { flushSync } from 'react-dom';
import { RigidKinematicSolver } from '../core/solver/rigid/RigidKinematicSolver';
import { EnergySolver, ENERGY_PRESETS, type EnergyParams } from '../core/solver/energy/EnergySolver';
import { detectCollisions } from '../core/solver/collision/collision';
import { angleDefects, paperAngleDefects, sheetDims } from '../core/analysis/metrics';
import type { AxialSweepConfig, FoldToSweepConfig, SweepSample } from '../core/analysis/experiments';
import { kreslingSecondState } from '../models/generators/kresling';
import { buildFromRegistry, GENERATORS, type Params } from '../models/registry';
import { lessonById } from '../curriculum/lessons';
import type { Assignment, OrigamiModel } from '../core/topology/types';
import { isCrease } from '../core/topology/types';
import { engine } from './engine';
import { useModel, type Snapshot } from './modelStore';
import { useSim, type CreaseRest } from './simulationStore';
import { useUI } from './uiStore';
import { DEG } from '../core/numerics/tolerances';
import { exportFold } from '../core/fold/exportFold';
import { importFold } from '../core/fold/importFold';
import type { FoldFile } from '../core/fold/foldTypes';

const AUTO_DRIVE = new Set(['miura', 'singleVertex', 'waterbombBase']);

// ───────────────────────────────────────────── model construction
function buildModelFor(generator: string, params: Params, overrides: Record<number, Assignment>): OrigamiModel {
  const m = buildFromRegistry(generator, params);
  applyOverrides(m, overrides);
  return m;
}

function applyOverrides(m: OrigamiModel, overrides: Record<number, Assignment>) {
  for (const [k, a] of Object.entries(overrides)) {
    const e = m.edges[+k];
    if (!e || e.faces[1] < 0) continue;
    e.assignment = a;
    e.defaultTarget = a === 'M' ? -Math.PI : a === 'V' ? Math.PI : e.referenceFoldAngle;
  }
}

function triCount(m: OrigamiModel) {
  return m.faces.reduce((a, f) => a + f.triangles.length, 0);
}

/**
 * Ids held by the UI (selection, hover) and the simulation (drive, locks)
 * refer to the model they were picked on. When the model changes (new
 * lesson, new parameters, a lab swapping its sheet) the ones that no longer
 * exist, or no longer are fold lines, are dropped before anything renders.
 */
function sanitizeIdsFor(model: OrigamiModel) {
  const okEdge = (id: number) => id >= 0 && id < model.edges.length;
  const okCrease = (id: number) => okEdge(id) && model.edges[id].faces[1] >= 0 && isCrease(model.edges[id].assignment);
  const okItem = (it: { kind: 'edge' | 'vertex' | 'face'; id: number } | null) =>
    !it || (it.kind === 'edge' ? okEdge(it.id) : it.kind === 'vertex' ? it.id >= 0 && it.id < model.vertices.length : it.id >= 0 && it.id < model.faces.length);
  const ui = useUI.getState();
  if (!okItem(ui.selection)) ui.select(null);
  if (!okItem(ui.hover)) ui.setHover(null);
  const s = useSim.getState();
  const drive = s.drive !== null && okCrease(s.drive) ? s.drive : null;
  const locked = s.locked.filter(okCrease);
  if (drive !== s.drive || locked.length !== s.locked.length) useSim.setState({ drive, locked, ...(drive === null ? { target: 0 } : {}) });
}

function installModel(model: OrigamiModel, rho?: Float64Array) {
  stopPlaying();
  sanitizeIdsFor(model);
  const s = useSim.getState();
  engine.model = model;
  engine.rigid = new RigidKinematicSolver(model, rho, { enforceMV: s.enforceMV, useSymmetryLinks: s.useSymmetry });
  engine.rigid.setLocked(s.locked);
  engine.energy = null;
  engine.triangleHit = new Uint8Array(triCount(model));
  engine.vertexScalar = null;
  engine.setPositions(engine.rigid.positions());
  useSim.setState({
    rho: new Float64Array(engine.rigid.rho),
    result: null, effect: [], residualHistory: [], energyHistory: [], sweep: null, experiment: null, shownState: null,
    energy: null, maxStrain: 0, maxFacetBending: 0, collisionCount: 0, diverged: false, stateFold: 0,
  });
  useModel.setState((st) => ({ model, modelVersion: st.modelVersion + 1 }));
  if (s.solverMode === 'energy') initEnergy();
  scheduleDiagnostics();
}

// ───────────────────────────────────────────── history
function snapshot(): Snapshot {
  const m = useModel.getState(), s = useSim.getState();
  return {
    lessonId: m.lessonId, generator: m.generator, params: { ...m.params }, overrides: { ...m.overrides },
    drive: s.drive, target: s.target, locked: [...s.locked], rho: engine.rigid ? new Float64Array(engine.rigid.rho) : null, solverMode: s.solverMode,
  };
}

export function pushHistory() {
  useModel.setState((st) => ({ past: [...st.past.slice(-80), snapshot()], future: [] }));
}

function restore(snap: Snapshot) {
  const m = useModel.getState();
  const needRebuild = snap.generator !== m.generator || JSON.stringify(snap.params) !== JSON.stringify(m.params) || JSON.stringify(snap.overrides) !== JSON.stringify(m.overrides);
  useModel.setState({ lessonId: snap.lessonId, generator: snap.generator, params: snap.params, overrides: snap.overrides });
  useSim.setState({ drive: snap.drive, target: snap.target, locked: snap.locked, solverMode: snap.solverMode });
  if (snap.generator && (needRebuild || !engine.model)) installModel(buildModelFor(snap.generator, snap.params, snap.overrides), snap.rho ?? undefined);
  else if (engine.rigid && snap.rho) {
    engine.rigid.rho = new Float64Array(snap.rho);
    engine.rigid.setLocked(snap.locked);
    engine.setPositions(engine.rigid.positions());
    useSim.setState({ rho: new Float64Array(snap.rho), shownState: null });
    if (snap.solverMode === 'energy') initEnergy();
    scheduleDiagnostics();
  }
}

export function undo() {
  const { past } = useModel.getState();
  if (!past.length) return;
  const cur = snapshot();
  const prev = past[past.length - 1];
  useModel.setState((st) => ({ past: st.past.slice(0, -1), future: [cur, ...st.future] }));
  restore(prev);
}

export function redo() {
  const { future } = useModel.getState();
  if (!future.length) return;
  const cur = snapshot();
  const next = future[0];
  useModel.setState((st) => ({ future: st.future.slice(1), past: [...st.past, cur] }));
  restore(next);
}

// ───────────────────────────────────────────── lessons & params
type VT = { ready: Promise<void>; finished: Promise<void>; updateCallbackDone: Promise<void> };
type VTDocument = Document & { startViewTransition?: (cb: () => void) => VT };

/** Run a state change inside a View Transition (sheet folds away / unfolds) when supported. */
export function withSheetTransition(fn: () => void) {
  const d = typeof document !== 'undefined' ? (document as VTDocument) : null;
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!d?.startViewTransition || reduced) { fn(); return; }
  const vt = d.startViewTransition(() => flushSync(fn));
  // a transition interrupted by the next one rejects: that is expected, not an error
  for (const p of [vt.ready, vt.finished, vt.updateCallbackDone]) p?.catch(() => {});
}

/** Open a lesson with the sheet-unfold transition. */
export function loadLesson(id: string) {
  withSheetTransition(() => loadLessonNow(id));
}

function loadLessonNow(id: string) {
  const lesson = lessonById(id);
  if (!lesson) return;
  stopPlaying();
  useUI.setState({ lecture: lesson.lecture, selection: null, hover: null });
  const energyParams: EnergyParams = {
    ...ENERGY_PRESETS.paperLike,
    ...(lesson.id === 'l5-kresling' || lesson.id === 'l5-compare' ? { kCrease: 0.02, kAxial: 60 } : {}),
    // thin shell: bending must be cheap relative to membrane stretching for buckling to appear
    ...(lesson.id === 'l5-yoshimura' ? { kFacet: 0.3, kCrease: 0.3 } : {}),
  };
  const creaseRest: CreaseRest = lesson.id === 'l5-yoshimura' || lesson.id === 'l5-kresling' ? 'reference' : lesson.solver === 'energy' && lesson.id !== 'l3-energy' ? 'foldAll' : 'current';
  useSim.setState({
    solverMode: lesson.solver ?? 'rigid', enforceMV: lesson.enforceMV ?? true, useSymmetry: lesson.useSymmetry ?? false,
    locked: [], drive: null, target: 0, energyParams, energyPreset: 'paperLike', creaseRest, dof: null,
    foldPercent: lesson.id === 'l4-waterbomb' ? 0.3 : 0.5,
    foldGrade: lesson.id === 'l4-waterbomb' ? 1.2 : 0,
  });
  const generator = lesson.generator ?? null;
  const params = generator ? { ...GENERATORS[generator].defaults, ...(lesson.params ?? {}) } : {};
  useModel.setState({ lessonId: id, generator, params, overrides: {}, past: [], future: [] });
  if (!generator) {
    engine.model = null;
    engine.rigid = null;
    engine.energy = null;
    useModel.setState((st) => ({ model: null, modelVersion: st.modelVersion + 1 }));
    return;
  }
  const model = buildModelFor(generator, params, {});
  installModel(model);
  // energy lessons start without a driving crease: a drive spring at its current angle would pin it
  if (useSim.getState().solverMode === 'rigid') applyDefaultDrive(model, AUTO_DRIVE.has(generator));
  useUI.getState().requestView('fit');
  if (lesson.patternFold === 'energy' && lesson.solver === 'energy') {
    // fold in from flat: every frame an equilibrium, at the shared speed
    animatePatternFold(lesson.patternFoldStart ?? 0, 2600 / Math.max(0.05, lesson.patternFoldStart ?? 1));
  } else if (useSim.getState().solverMode === 'energy' && creaseRest === 'foldAll') play();
}

function applyDefaultDrive(model: OrigamiModel, solveNow: boolean) {
  const dd = model.edu.defaultDrive;
  if (!dd) return;
  useSim.setState({ drive: dd.edge, target: engine.rigid?.rho[dd.edge] ?? 0 });
  useUI.setState({ selection: { kind: 'edge', id: dd.edge } });
  if (solveNow && useSim.getState().solverMode === 'rigid') {
    const sweep = engine.rigid && engine.rigid.sys.vars.edgeOfVar.length < 120;
    animateTarget(dd.angle, undefined, () => { if (sweep) computeSweep(); });
  }
}

export function applyParams(partial: Params, generatorOverride?: string) {
  const m = useModel.getState();
  const generator = generatorOverride ?? m.generator;
  if (!generator) return;
  pushHistory();
  const params = generatorOverride && generatorOverride !== m.generator ? { ...GENERATORS[generator].defaults, ...partial } : { ...m.params, ...partial };
  useModel.setState({ generator, params, overrides: {} });
  useSim.setState({ locked: [], drive: null });
  let model: OrigamiModel;
  try {
    model = buildModelFor(generator, params, {});
  } catch (e) {
    console.error(e);
    return;
  }
  installModel(model);
  applyDefaultDrive(model, AUTO_DRIVE.has(generator));
  useUI.getState().requestView('fit');
}

export function setAssignment(edge: number, a: Assignment) {
  const m = useModel.getState();
  if (!m.generator || !engine.model) return;
  const e = engine.model.edges[edge];
  if (!e || e.faces[1] < 0) return;
  pushHistory();
  const overrides = { ...m.overrides, [edge]: a };
  useModel.setState({ overrides });
  const rho = engine.rigid ? new Float64Array(engine.rigid.rho) : undefined;
  if (rho && !isCrease(a)) rho[edge] = e.referenceFoldAngle;
  const s = useSim.getState();
  if (s.drive === edge && !isCrease(a)) useSim.setState({ drive: null });
  installModel(buildModelFor(m.generator, m.params, overrides), rho);
}

// ───────────────────────────────────────────── driving & solving
export function setDriveEdge(edge: number | null) {
  if (edge !== null && (!engine.model || engine.model.edges[edge].faces[1] < 0 || !isCrease(engine.model.edges[edge].assignment))) return;
  pushHistory();
  const cur = edge !== null ? (useSim.getState().solverMode === 'energy' && engine.energy ? engine.energy.foldAngles()[edge] : engine.rigid?.rho[edge] ?? 0) : 0;
  const locked = useSim.getState().locked.filter((l) => l !== edge);
  useSim.setState({ drive: edge, target: cur, locked });
  engine.rigid?.setLocked(locked);
}

export function toggleLock(edge: number) {
  pushHistory();
  const s = useSim.getState();
  const locked = s.locked.includes(edge) ? s.locked.filter((l) => l !== edge) : [...s.locked, edge];
  useSim.setState({ locked, drive: s.drive === edge ? null : s.drive });
  engine.rigid?.setLocked(locked);
}

let anim = 0;
/** Stop an in-flight fold animation (e.g. when the student grabs a crease). */
export function cancelFoldAnimation() { cancelAnimationFrame(anim); }
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Global playback speed of fold motions (read every frame, so it can change mid-motion). */
export const foldSpeed = () => Math.max(0.02, useUI.getState().foldSpeed);
const easeInOut = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t);

/**
 * Speed-aware animation clock: advances t from 0 to 1 over `ms` at 1× speed
 * (ms / speed at other speeds) and calls `frame(eased t)` once per frame.
 * `frame` returns false to stop early. `setId` receives the rAF handle.
 */
function runTimeline(ms: number, frame: (k: number, t: number) => boolean | void, setId: (id: number) => void, done?: () => void) {
  let t = 0;
  let last = performance.now();
  const step = (now: number) => {
    t = Math.min(1, t + (Math.max(0, now - last) * foldSpeed()) / ms);
    last = now;
    if (frame(easeInOut(t), t) === false) { done?.(); return; }
    if (t < 1) setId(requestAnimationFrame(step));
    else done?.();
  };
  setId(requestAnimationFrame(step));
}

/** Angular speed of a fold motion at 1×: 140°/s (minimum 0.45 s). */
const foldDuration = (dRad: number) => Math.max(450, (Math.abs(dRad) * 180 / Math.PI / 140) * 1000);

/**
 * Fold the driving crease to `angle` with visible motion. In Rigid mode every
 * frame is a full rigid solve (continuation), so the motion is the actual
 * kinematic path, not an interpolation of end states. It stops at the first
 * frame without a rigid solution. Energy mode already animates through its
 * dynamics, so the target is set directly.
 */
export function animateTarget(angle: number, ms?: number, done?: () => void) {
  cancelAnimationFrame(anim);
  const s = useSim.getState();
  if (s.drive === null || s.solverMode !== 'rigid' || reducedMotion() || !engine.rigid) {
    setTarget(angle);
    done?.();
    return;
  }
  const from = engine.rigid.rho[s.drive];
  runTimeline(ms ?? foldDuration(angle - from), (k) => {
    setTarget(from + (angle - from) * k);
    const r = useSim.getState().result;
    return !r || r.success;
  }, (id) => (anim = id), done);
}

/** Fold the driving crease all the way in its assigned sense (valley +180°, mountain −180°), or back to flat. */
export function foldDriveFully(unfold = false) {
  const s = useSim.getState();
  if (s.drive === null || !engine.model) return;
  pushHistory();
  const a = engine.model.edges[s.drive].assignment;
  const cur = s.solverMode === 'rigid' && engine.rigid ? engine.rigid.rho[s.drive] : s.target;
  const sense = a === 'M' ? -1 : a === 'V' ? 1 : Math.sign(cur) || 1;
  animateTarget(unfold ? 0 : sense * Math.PI);
}

/** Make `edge` the driving crease (if it is not already) and fold it — one step for the student. */
export function driveSelected(edge: number, angle: number, animate = false) {
  const s = useSim.getState();
  if (s.drive !== edge) setDriveEdge(edge);
  if (useSim.getState().drive !== edge) return;
  if (animate) animateTarget(angle);
  else setTarget(angle);
}

export function setTarget(angle: number) {
  const s = useSim.getState();
  if (s.drive === null || !engine.model) return;
  const target = Math.max(-Math.PI * 1.25, Math.min(Math.PI * 1.25, angle));
  useSim.setState({ target, shownState: null });
  if (s.solverMode === 'energy') {
    if (!engine.energy) initEnergy();
    driveActive = true;
    engine.energy!.setDrivingCrease(s.drive, Math.max(-Math.PI, Math.min(Math.PI, target)));
    if (!useSim.getState().playing) play();
    return;
  }
  const rigid = engine.rigid!;
  rigid.options.enforceMV = s.enforceMV;
  rigid.options.useSymmetryLinks = s.useSymmetry;
  rigid.setLocked(s.locked);
  const before = new Float64Array(rigid.rho);
  rigid.setDrivingCrease(s.drive, target);
  const res = rigid.solve();
  const after = rigid.rho;
  const effect = engine.model.edges
    .filter((e) => e.id !== s.drive && e.faces[1] >= 0 && isCrease(e.assignment))
    .map((e) => ({ edge: e.id, before: before[e.id], after: after[e.id] }))
    .sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before))
    .slice(0, 12);
  engine.setPositions(rigid.positions());
  useSim.setState((st) => ({ result: res, rho: new Float64Array(after), effect, residualHistory: [...st.residualHistory.slice(-199), res.residualNorm] }));
  scheduleDiagnostics();
}

export function setEnforceMV(b: boolean) {
  useSim.setState({ enforceMV: b });
  if (engine.rigid) engine.rigid.options.enforceMV = b;
}
export function setUseSymmetry(b: boolean) {
  useSim.setState({ useSymmetry: b });
  if (engine.rigid) engine.rigid.options.useSymmetryLinks = b;
}

export function resetSimulation() {
  pushHistory();
  stopPlaying();
  if (!engine.model || !engine.rigid) return;
  engine.rigid.reset();
  useSim.setState({ drive: null, target: 0, locked: [], result: null, effect: [], shownState: null, experiment: null });
  engine.rigid.setLocked([]);
  engine.setPositions(engine.rigid.positions());
  useSim.setState({ rho: new Float64Array(engine.rigid.rho) });
  if (useSim.getState().solverMode === 'energy') initEnergy();
  scheduleDiagnostics();
}

/** Switch the solver; `reason` (an automatic switch) is announced to the student. */
export function setSolverMode(mode: 'rigid' | 'energy', reason?: string) {
  if (reason && useSim.getState().solverMode !== mode) useUI.getState().notify(`${mode === 'energy' ? 'Energy' : 'Rigid'} 솔버로 바꿨다: ${reason}`);
  const s = useSim.getState();
  if (s.solverMode === mode) return;
  pushHistory();
  stopPlaying();
  useSim.setState({ solverMode: mode, shownState: null });
  if (!engine.model) return;
  if (mode === 'energy') {
    initEnergy();
  } else {
    engine.energy = null;
    engine.vertexScalar = null;
    if (engine.rigid) {
      engine.setPositions(engine.rigid.positions());
      useSim.setState({ rho: new Float64Array(engine.rigid.rho) });
    }
  }
  scheduleDiagnostics();
}

/** Display a constructed exact state (e.g. the flat-folded state). */
export function showReferenceState(name: string | null) {
  if (!engine.model || !engine.rigid) return;
  stopPlaying();
  if (name === null) {
    engine.setPositions(engine.rigid.positions());
    useSim.setState({ shownState: null, rho: new Float64Array(engine.rigid.rho) });
    scheduleDiagnostics();
    return;
  }
  const st = engine.model.edu.referenceStates?.find((r) => r.name === name);
  if (!st) return;
  const rho = new Float64Array(engine.rigid.rho);
  for (const e of engine.model.edges) rho[e.id] = e.referenceFoldAngle;
  for (const [k, v] of Object.entries(st.foldAngles)) rho[+k] = v;
  // exact state; stacked layers are drawn apart by the layer-order display (viewport/layerCache)
  engine.setPositions(engine.rigid.positions(rho));
  useSim.setState({ shownState: name, rho });
  scheduleDiagnostics();
}

export function referenceStateResidual(name: string): number | null {
  if (!engine.model || !engine.rigid) return null;
  const st = engine.model.edu.referenceStates?.find((r) => r.name === name);
  if (!st) return null;
  const rho = new Float64Array(engine.model.edges.length);
  for (const e of engine.model.edges) rho[e.id] = e.referenceFoldAngle;
  for (const [k, v] of Object.entries(st.foldAngles)) rho[+k] = v;
  return engine.rigid.closureResidual(rho);
}

export function computeSweep() {
  const s = useSim.getState();
  if (!engine.rigid || !engine.model || s.drive === null) return;
  const e = engine.model.edges[s.drive];
  const sign = e.assignment === 'M' ? -1 : e.assignment === 'V' ? 1 : Math.sign(s.target || 1);
  const sw = engine.rigid.sweep(s.drive, 0, sign * 175 * DEG, 70);
  const dims = sw.positions.map((p) => {
    const d = sheetDims(engine.model!, p);
    return d ? { W: d.W, L: d.L, T: d.T } : { W: 0, L: 0, T: 0 };
  });
  useSim.setState({ sweep: { edge: s.drive, drive: sw.drive, rho: sw.rho, dims } });
}

// ───────────────────────────────────────────── energy mode
function creaseTargets(model: OrigamiModel, rest: CreaseRest, pct: number, cur: Float64Array, grade = 0): (eid: number) => number {
  // pattern centre / radius in crease-pattern coordinates (for radial grading)
  let lx = Infinity, ly = Infinity, hx = -Infinity, hy = -Infinity;
  for (const v of model.vertices) { const [x, y] = v.initialPosition2D; lx = Math.min(lx, x); ly = Math.min(ly, y); hx = Math.max(hx, x); hy = Math.max(hy, y); }
  const cx = (lx + hx) / 2, cy = (ly + hy) / 2, R = Math.max(Math.hypot(hx - cx, hy - cy), 1e-9);
  return (eid) => {
    const e = model.edges[eid];
    if (rest === 'reference') return e.referenceFoldAngle;
    if (rest === 'foldAll') {
      const a = model.vertices[e.vertices[0]].initialPosition2D, b = model.vertices[e.vertices[1]].initialPosition2D;
      const r = Math.hypot((a[0] + b[0]) / 2 - cx, (a[1] + b[1]) / 2 - cy) / R;
      const p = pct * Math.max(0, 1 + grade * (r - 0.5));
      return e.referenceFoldAngle + p * (e.defaultTarget - e.referenceFoldAngle);
    }
    return cur[eid];
  };
}

/** fold-all targets are ramped in gradually (a sudden full target on a flat, singular sheet crumples it) */
let rampPct = 0;
function applyFoldTargets(e: EnergySolver, model: OrigamiModel, pct: number) {
  const s = useSim.getState();
  const cur = engine.rigid ? engine.rigid.rho : new Float64Array(model.edges.length);
  e.setCreaseTargets(creaseTargets(model, s.creaseRest, pct, cur, s.foldGrade));
  if (s.drive !== null && s.target !== undefined && driveActive) e.setDrivingCrease(s.drive, Math.max(-Math.PI, Math.min(Math.PI, s.target)));
}
let driveActive = false;

export function initEnergy() {
  const model = engine.model;
  if (!model) return;
  const s = useSim.getState();
  const e = new EnergySolver(model, s.energyParams);
  e.setPositions(engine.positions.length === model.vertices.length * 3 ? engine.positions : Float64Array.from(model.vertices.flatMap((v) => v.referencePosition)));
  rampPct = s.creaseRest === 'foldAll' ? 0 : s.foldPercent;
  applyFoldTargets(e, model, rampPct);
  const g = model.edu.groups;
  if (g?.bottom && model.metadata.generator !== 'miura') e.fixVertices(g.bottom, 7);
  else {
    const bf = model.edu.baseFace ?? 0;
    e.fixVertices(model.faces[bf].vertices, 7);
  }
  driveActive = s.drive !== null;
  if (s.drive !== null) e.setDrivingCrease(s.drive, Math.max(-Math.PI, Math.min(Math.PI, s.target)));
  engine.energy = e;
  engine.setPositions(e.x);
  useSim.setState({ energyHistory: [], diverged: false });
  updateEnergyStats();
}

export function setEnergyParams(p: Partial<EnergyParams>, preset: keyof typeof ENERGY_PRESETS | 'custom' = 'custom') {
  const energyParams = { ...useSim.getState().energyParams, ...p };
  useSim.setState({ energyParams, energyPreset: preset });
  engine.energy?.setParams(energyParams);
}

export function applyEnergyPreset(name: keyof typeof ENERGY_PRESETS) {
  setEnergyParams({ ...ENERGY_PRESETS[name] }, name);
}

export function setCreaseRest(rest: CreaseRest, pct?: number, grade?: number) {
  useSim.setState({ creaseRest: rest, ...(pct !== undefined ? { foldPercent: pct } : {}), ...(grade !== undefined ? { foldGrade: grade } : {}) });
  const model = engine.model, e = engine.energy;
  if (!model || !e) return;
  const s = useSim.getState();
  if (rest !== 'foldAll') rampPct = s.foldPercent;
  applyFoldTargets(e, model, rest === 'foldAll' ? rampPct : s.foldPercent);
  if (!s.playing) play();
}

let raf = 0;
let frame = 0;
export function play() {
  if (useSim.getState().solverMode !== 'energy') return;
  if (!engine.energy) initEnergy();
  if (useSim.getState().playing) return;
  useSim.setState({ playing: true, shownState: null });
  const loop = () => {
    const e = engine.energy;
    if (!e || !useSim.getState().playing) return;
    const st = useSim.getState();
    if (st.creaseRest === 'foldAll' && engine.model && Math.abs(rampPct - st.foldPercent) > 1e-9) {
      const dp = 0.004 * Math.min(2, foldSpeed());
      rampPct = rampPct < st.foldPercent ? Math.min(st.foldPercent, rampPct + dp) : Math.max(st.foldPercent, rampPct - dp);
      applyFoldTargets(e, engine.model, rampPct);
    }
    e.integrate(Math.max(1, Math.round(e.params.stepsPerFrame * Math.min(2, foldSpeed()))));
    engine.setPositions(e.x);
    if (e.diverged) useSim.setState({ diverged: true });
    if (++frame % 6 === 0) updateEnergyStats();
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
}

// ───────────────────────────────────────────── fold the whole pattern

/** How the current lesson folds its whole pattern (see Lesson.patternFold), if it offers it. */
export function patternFoldMode(): 'rigid' | 'energy' | null {
  const l = lessonById(useModel.getState().lessonId);
  if (!l?.patternFold || !engine.model) return null;
  if (l.patternFold === 'rigid' && !engine.model.edu.defaultDrive) return null;
  return l.patternFold;
}

/** Fully folded angle of every edge: the model's flat reference state if it has one, else ±180° by M/V. */
function foldedTarget(model: OrigamiModel): (id: number) => number {
  const flat = model.edu.referenceStates?.[0]?.foldAngles;
  return (id) => {
    const e = model.edges[id];
    if (flat) return flat[id] ?? e.referenceFoldAngle;
    return e.faces[1] >= 0 && isCrease(e.assignment) ? e.defaultTarget : e.referenceFoldAngle;
  };
}

/** Current fold progress of the whole pattern (0 = as built, 1 = fully folded). */
export function patternFoldProgress(): number {
  const mode = patternFoldMode();
  const model = engine.model;
  if (mode === 'rigid' && model && engine.rigid) {
    const dd = model.edu.defaultDrive!;
    return Math.min(1, Math.abs(engine.rigid.rho[dd.edge] - model.edges[dd.edge].referenceFoldAngle) / Math.PI);
  }
  return useSim.getState().stateFold;
}

/** Rigid pattern fold: drive the default crease of a 1-DoF pattern to p·180° in its M/V sense. */
function foldRigidTo(q: number) {
  const model = engine.model!;
  const dd = model.edu.defaultDrive!;
  if (useSim.getState().solverMode !== 'rigid') setSolverMode('rigid', '이 패턴은 강체 기구로 접는다');
  if (useSim.getState().drive !== dd.edge) setDriveEdge(dd.edge);
  const e = model.edges[dd.edge];
  const sense = e.assignment === 'M' ? -1 : 1;
  setTarget(e.referenceFoldAngle + sense * q * Math.PI);
  useSim.setState({ stateFold: q });
}

/**
 * Energy pattern fold: ALL creases move together toward their fully folded
 * angles, ρ = ρ_ref + p·(ρ_folded − ρ_ref), warm-started from the current shape
 * and relaxed (FIRE) to equilibrium; the facets bend/stretch as much as the
 * bar-and-hinge model needs. For patterns that are not 1-DoF mechanisms (the
 * waterbomb tessellation, the tall shopping bag) no single crease can do this.
 * Large jumps are taken in steps of 0.05 so the path is followed, not skipped.
 */
function foldEnergyTo(q: number) {
  const model = engine.model!;
  if (useSim.getState().solverMode !== 'energy') setSolverMode('energy', '모든 크리스를 함께 접으려면 면이 휘어야 한다');
  stopPlaying();
  if (useSim.getState().experiment) clearExperiment();
  if (!engine.energy) initEnergy();
  const e = engine.energy!;
  // a single driven crease would fight the collective fold: release it
  if (useSim.getState().drive !== null) useSim.setState({ drive: null });
  e.setDrivingCrease(null, 0);
  driveActive = false;
  const target = foldedTarget(model);
  const sched = model.edu.foldSchedule;
  const from = useSim.getState().stateFold;
  const n = Math.max(1, Math.ceil(Math.abs(q - from) / 0.05));
  for (let k = 1; k <= n; k++) {
    const p = from + ((q - from) * k) / n;
    e.setCreaseTargets((id) => {
      const r = model.edges[id].referenceFoldAngle;
      const w = sched?.[id];
      const pe = w ? Math.max(0, Math.min(1, (p - w[0]) / (w[1] - w[0]))) : p;
      return r + pe * (target(id) - r);
    });
    e.relaxFIRE(4000, 1e-6);
  }
  engine.setPositions(e.x);
  updateEnergyStats();
  const st = useSim.getState();
  useSim.setState({ stateFold: q, stateFoldPeak: q < 1e-9 ? 0 : Math.max(st.stateFoldPeak, st.maxStrain) });
  scheduleDiagnostics();
}

/** Fold the whole pattern to progress p ∈ [0, 1] (rigid or energy, per lesson). */
export function setPatternFold(p: number) {
  const mode = patternFoldMode();
  if (!mode) return;
  const q = Math.max(0, Math.min(1, p));
  if (mode === 'rigid') foldRigidTo(q);
  else foldEnergyTo(q);
}

let foldStateRaf = 0;
/** Animate the whole-pattern fold to `to` at the shared fold speed (every frame is a solution). */
export function animatePatternFold(to: number, ms = 2600) {
  cancelAnimationFrame(foldStateRaf);
  const mode = patternFoldMode();
  if (!mode) return;
  const from = patternFoldProgress();
  if (reducedMotion()) { setPatternFold(to); return; }
  runTimeline(ms * Math.max(0.25, Math.abs(to - from)), (k) => {
    setPatternFold(from + (to - from) * k);
    if (mode === 'rigid') { const r = useSim.getState().result; return !r || r.success; }
    return true;
  }, (id) => (foldStateRaf = id), () => useUI.getState().requestView('fit'));
}
export function cancelPatternFold() { cancelAnimationFrame(foldStateRaf); }

export function stopPlaying() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  if (useSim.getState().playing) useSim.setState({ playing: false });
  if (engine.energy) updateEnergyStats();
}

export function togglePlay() {
  if (useSim.getState().playing) stopPlaying();
  else play();
}

/** One-shot quasi-static relaxation (FIRE) to the current energy minimum. */
export function relaxNow() {
  const e = engine.energy;
  if (!e) return;
  e.relaxFIRE(20000, 1e-6);
  engine.setPositions(e.x);
  updateEnergyStats();
}

function updateEnergyStats() {
  const e = engine.energy;
  if (!e) return;
  const en = e.energy();
  const strains = e.strains();
  let ms = 0;
  const vs = new Float64Array(e.mesh.nV);
  const cnt = new Float64Array(e.mesh.nV);
  e.mesh.bars.forEach((b, i) => {
    const a = Math.abs(strains[i]);
    ms = Math.max(ms, a);
    vs[b.a] += a; vs[b.b] += a; cnt[b.a]++; cnt[b.b]++;
  });
  for (let i = 0; i < vs.length; i++) vs[i] = cnt[i] ? vs[i] / cnt[i] : 0;
  engine.vertexScalar = vs;
  let mf = 0;
  for (const f of e.facetBending()) mf = Math.max(mf, f.value);
  useSim.setState((st) => ({
    energy: en,
    rho: e.foldAngles(),
    maxStrain: ms,
    maxFacetBending: mf,
    energyHistory: [...st.energyHistory.slice(-299), { t: e.time, total: en.total, axial: en.axial, crease: en.crease, facet: en.facet, kinetic: en.kinetic }],
  }));
  scheduleDiagnostics();
}

// ───────────────────────────────────────────── diagnostics (throttled)
let diagTimer: ReturnType<typeof setTimeout> | null = null;
export function scheduleDiagnostics() {
  if (diagTimer) return;
  diagTimer = setTimeout(() => {
    diagTimer = null;
    runDiagnostics();
  }, 120);
}

function runDiagnostics() {
  const model = engine.model;
  if (!model) return;
  const s = useSim.getState();
  const patch: Partial<ReturnType<typeof useSim.getState>> = {};
  if (engine.rigid && engine.rigid.sys.vars.edgeOfVar.length <= 400) {
    try {
      const rho = s.solverMode === 'energy' && engine.energy ? engine.energy.foldAngles() : s.shownState ? s.rho : engine.rigid.rho;
      patch.dof = engine.rigid.analyze(rho);
    } catch { /* ignore */ }
  }
  const tris = model.faces.flatMap((f) => f.triangles);
  if (useUI.getState().overlays.collisions && tris.length <= 4000 && engine.positions.length === model.vertices.length * 3) {
    const c = detectCollisions(engine.positions, tris);
    engine.triangleHit = c.triangleHit;
    patch.collisionCount = c.count;
  }
  if (engine.positions.length === model.vertices.length * 3) {
    patch.paperDefect = paperAngleDefects(model, engine.positions);
    const cs = model.edu.coarseSurface;
    if (cs) patch.coarseDefects = [...angleDefects(engine.positions, cs.triangles, cs.vertices).entries()];
  }
  useSim.setState(patch);
  engine.version++;
}

// ───────────────────────────────────────────── experiments (worker)
let worker: Worker | null = null;
let reqId = 0;

export function runExperiment(kind: 'kreslingAxial' | 'yoshimuraCompression' | 'bagCollapse') {
  const m = useModel.getState();
  const model = engine.model;
  if (!model || !m.generator) return;
  stopPlaying();
  if (useSim.getState().solverMode !== 'energy') setSolverMode('energy', '실험은 에너지법으로 계산한다');
  const params = useSim.getState().energyParams;
  worker?.terminate();
  worker = new Worker(new URL('../workers/solver.worker.ts', import.meta.url), { type: 'module' });
  const id = ++reqId;
  let total = 30;
  if (kind === 'kreslingAxial') {
    const P = m.params as Record<string, number>;
    const st = kreslingSecondState({ n: P.n, R: P.R, H: P.H, phi: P.phi * DEG });
    const cells = P.cells ?? 1;
    const uMax = st ? (P.H - st.H) * cells * 1.25 : P.H * cells * 0.5;
    const config: AxialSweepConfig = { uMax, steps: (total = 36), twistFree: true, params };
    worker.postMessage({ type: 'axial', id, generator: m.generator, params: m.params, overrides: m.overrides, config });
  } else if (kind === 'yoshimuraCompression') {
    const P = m.params as Record<string, number>;
    const config: AxialSweepConfig = { uMax: 0.2 * P.height, steps: (total = 32), twistFree: false, clampTopXY: true, params };
    worker.postMessage({ type: 'axial', id, generator: m.generator, params: m.params, overrides: m.overrides, config });
  } else {
    // open bag → its flat (collapsed) state: every crease moves to its flat angle together,
    // the facets may bend/stretch (the tall-bag theorem says they must, somewhere on the way)
    const flat = model.edu.referenceStates?.[0]?.foldAngles ?? {};
    const config: FoldToSweepConfig = { targets: flat, schedule: model.edu.foldSchedule, fixed: model.faces[model.edu.baseFace ?? 0].vertices, steps: (total = 48), params };
    worker.postMessage({ type: 'foldTo', id, generator: m.generator, params: m.params, overrides: m.overrides, config });
  }
  useSim.setState({ experiment: { kind, running: true, samples: [], index: 0, total } });
  worker.onmessage = (ev: MessageEvent<{ type: string; id: number; sample?: SweepSample; message?: string }>) => {
    if (ev.data.id !== id) return;
    const ex = useSim.getState().experiment;
    if (!ex) return;
    if (ev.data.type === 'sample' && ev.data.sample) {
      const samples = [...ex.samples, ev.data.sample];
      useSim.setState({ experiment: { ...ex, samples, index: samples.length - 1 } });
      if (ev.data.sample.positions) engine.setPositions(ev.data.sample.positions);
    } else if (ev.data.type === 'done') {
      useSim.setState({ experiment: { ...ex, running: false } });
      if (kind === 'bagCollapse') playExperiment();
      scheduleDiagnostics();
    } else if (ev.data.type === 'error') {
      useSim.setState({ experiment: { ...ex, running: false, error: ev.data.message } });
    }
  };
}

let playRaf = 0;
/** Play a recorded sweep back as a motion from its first to its last sample. */
export function playExperiment(ms = 2600) {
  cancelAnimationFrame(playRaf);
  const ex = useSim.getState().experiment;
  if (!ex || ex.samples.length < 2) return;
  const n = ex.samples.length - 1;
  if (reducedMotion()) { scrubExperiment(n); return; }
  runTimeline(ms, (k) => { scrubExperiment(Math.round(k * n)); }, (id) => (playRaf = id));
}

export function scrubExperiment(i: number) {
  const ex = useSim.getState().experiment;
  if (!ex || !ex.samples[i]) return;
  useSim.setState({ experiment: { ...ex, index: i } });
  const p = ex.samples[i].positions;
  if (p) engine.setPositions(p);
  scheduleDiagnostics();
}

export function clearExperiment() {
  worker?.terminate();
  worker = null;
  useSim.setState({ experiment: null });
  if (engine.energy) engine.setPositions(engine.energy.x);
}

// ───────────────────────────────────────────── FOLD I/O
export function exportCurrentFold(): string | null {
  if (!engine.model) return null;
  const s = useSim.getState();
  return JSON.stringify(exportFold(engine.model, s.rho, engine.positions), null, 1);
}

export function importFoldText(text: string): string | null {
  try {
    const f = JSON.parse(text) as FoldFile;
    const { model, foldAngles } = importFold(f);
    stopPlaying();
    useModel.setState({ lessonId: 'imported', generator: null, params: {}, overrides: {}, past: [], future: [] });
    useSim.setState({ locked: [], drive: null, solverMode: 'rigid' });
    installModel(model, foldAngles ?? undefined);
    useUI.getState().requestView('fit');
    return null;
  } catch (e) {
    return String(e);
  }
}
