/**
 * 1D flat folding of a strip (Lecture 2).
 *
 * A strip [0, L] carries creases c1 < c2 < … < cn, each Mountain or Valley.
 * Segment lengths: s0 = c1 − 0, s_i = c_{i+1} − c_i, s_n = L − c_n.
 *
 * Theorem (Arkin, Bender, Demaine, Demaine, Mitchell, Sethia, Skiena,
 * "When can you fold a map?", CGTA 2004; Demaine & O'Rourke, GFA §14.1):
 * a 1D M/V pattern is flat-foldable iff it can be folded by a sequence of
 * END FOLDS and CRIMPS; moreover any available operation may be applied
 * greedily without losing foldability.
 *
 * Operations implemented here (inequalities stated explicitly):
 *
 *  END FOLD (left):   s0 ≤ s1        fold c1; the end flap lands inside s1.
 *  END FOLD (right):  s_n ≤ s_{n−1}  fold c_n.
 *     (with a single crease, an end fold is always possible.)
 *
 *  CRIMP (c_i, c_{i+1}), 1 ≤ i < n:
 *     assignment(c_i) ≠ assignment(c_{i+1})      (opposite directions)
 *     s_{i−1} ≥ s_i ≤ s_{i+1}                     (s_i is a local minimum)
 *   After the crimp the two creases disappear and the strip shortens by 2 s_i.
 *
 *  COLLISION (lecture condition, adjacent creases c_i, c_{i+1}):
 *     assignment(c_i) = assignment(c_{i+1})       (same direction)
 *     s_{i−1} > s_i < s_{i+1}                     (STRICT local minimum)
 *   The short middle segment would have to be wrapped from both sides in the
 *   same direction, so the two longer neighbours must penetrate each other
 *   or the folds: this pair can never be folded → not flat-foldable.
 *
 *  EQUAL-DISTANCE (trivial / degenerate) CASE: if the local minimum is not
 *  strict (s_i equals a neighbour) with the same direction, no collision is
 *  forced by this pair alone; the neighbours end exactly flush. We report it
 *  as "degenerate" and let the end-fold/crimp search decide.
 */
import { TOL } from '../numerics/tolerances';

export type MV = 'M' | 'V';

export interface Strip {
  length: number;
  creases: { pos: number; mv: MV; id: number }[];
}

export type StripOp =
  | { kind: 'endFold'; side: 'left' | 'right'; creaseIds: [number] }
  | { kind: 'crimp'; index: number; creaseIds: [number, number] };

export interface StripAnalysis {
  segments: number[];
  ops: StripOp[];
  collisions: { index: number; creaseIds: [number, number] }[];
  degenerate: { index: number; creaseIds: [number, number] }[];
}

export function segments(strip: Strip): number[] {
  const c = strip.creases.map((x) => x.pos);
  const s: number[] = [];
  let prev = 0;
  for (const p of c) { s.push(p - prev); prev = p; }
  s.push(strip.length - prev);
  return s;
}

const le = (a: number, b: number) => a <= b + TOL.strip;
const lt = (a: number, b: number) => a < b - TOL.strip;

export function analyzeStrip(strip: Strip): StripAnalysis {
  const s = segments(strip);
  const cr = strip.creases;
  const n = cr.length;
  const ops: StripOp[] = [];
  const collisions: StripAnalysis['collisions'] = [];
  const degenerate: StripAnalysis['degenerate'] = [];
  if (n === 0) return { segments: s, ops, collisions, degenerate };

  if (n === 1 || le(s[0], s[1])) ops.push({ kind: 'endFold', side: 'left', creaseIds: [cr[0].id] });
  if (n > 1 && le(s[n], s[n - 1])) ops.push({ kind: 'endFold', side: 'right', creaseIds: [cr[n - 1].id] });

  for (let i = 0; i + 1 < n; i++) {
    // creases cr[i], cr[i+1] bound segment s[i+1]; neighbours s[i], s[i+2]
    const left = s[i], mid = s[i + 1], right = s[i + 2];
    const ids: [number, number] = [cr[i].id, cr[i + 1].id];
    const localMin = le(mid, left) && le(mid, right);
    const strictMin = lt(mid, left) && lt(mid, right);
    if (cr[i].mv !== cr[i + 1].mv) {
      if (localMin) ops.push({ kind: 'crimp', index: i, creaseIds: ids });
    } else if (strictMin) {
      collisions.push({ index: i, creaseIds: ids });
    } else if (localMin) {
      degenerate.push({ index: i, creaseIds: ids });
    }
  }
  return { segments: s, ops, collisions, degenerate };
}

/** Apply an operation and return the reduced strip (new coordinates). */
export function applyOp(strip: Strip, op: StripOp): Strip {
  const cr = strip.creases;
  if (op.kind === 'endFold') {
    if (op.side === 'left') {
      const c1 = cr[0].pos;
      // the flap [0,c1] now lies on top of [c1, 2c1] ⊆ [c1, c2]; strip becomes [c1, L]
      return { length: strip.length - c1, creases: cr.slice(1).map((c) => ({ ...c, pos: c.pos - c1 })) };
    }
    const cn = cr[cr.length - 1].pos;
    return { length: cn, creases: cr.slice(0, -1) };
  }
  const i = op.index;
  const si = cr[i + 1].pos - cr[i].pos;
  const out = [...cr.slice(0, i).map((c) => ({ ...c })), ...cr.slice(i + 2).map((c) => ({ ...c, pos: c.pos - 2 * si }))];
  return { length: strip.length - 2 * si, creases: out };
}

export interface SolveResult {
  foldable: boolean;
  sequence: StripOp[];
  /** intermediate strips: states[0] = input, states[k] = after k operations */
  states: Strip[];
}

/**
 * Search for a complete end-fold/crimp sequence. By the theorem a greedy
 * choice suffices, but we perform a memoised DFS so the result does not
 * depend on that fact (and doubles as a check of it in tests).
 */
export function solveStrip(strip: Strip): SolveResult {
  const memo = new Map<string, boolean>();
  const key = (s: Strip) => s.length.toFixed(9) + '|' + s.creases.map((c) => c.pos.toFixed(9) + c.mv).join(',');
  const path: StripOp[] = [];
  const states: Strip[] = [strip];
  const dfs = (s: Strip): boolean => {
    if (s.creases.length === 0) return true;
    const k = key(s);
    if (memo.has(k)) return memo.get(k)!;
    const a = analyzeStrip(s);
    for (const op of a.ops) {
      const next = applyOp(s, op);
      path.push(op);
      states.push(next);
      if (dfs(next)) { memo.set(k, true); return true; }
      path.pop();
      states.pop();
    }
    memo.set(k, false);
    return false;
  };
  const ok = dfs(strip);
  return { foldable: ok, sequence: ok ? [...path] : [], states: ok ? [...states] : [strip] };
}

export const describeOp = (op: StripOp, label: (id: number) => string = (id) => `c${id + 1}`): string =>
  op.kind === 'endFold' ? `EndFold(${label(op.creaseIds[0])})` : `Crimp(${label(op.creaseIds[0])},${label(op.creaseIds[1])})`;

/**
 * Side-view polyline of the strip in the (x, z) plane for visualisation.
 * `angles[i]` is the signed fold angle at crease i (V > 0 bends up).
 */
export function stripPolyline(strip: Strip, angles: number[]): [number, number][] {
  const s = segments(strip);
  const pts: [number, number][] = [[0, 0]];
  let dir = 0;
  let x = 0, z = 0;
  for (let i = 0; i < s.length; i++) {
    x += s[i] * Math.cos(dir);
    z += s[i] * Math.sin(dir);
    pts.push([x, z]);
    if (i < angles.length) dir += angles[i];
  }
  return pts;
}
