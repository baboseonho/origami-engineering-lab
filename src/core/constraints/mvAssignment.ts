/**
 * Recursive M/V-assignment check for a flat single vertex by crimping
 * (Lecture 2, "crimp theorem").
 *
 * For a flat-foldable vertex (Kawasaki holds) with sectors θ1..θn between
 * creases c1..cn (θi lies between ci and c(i+1), cyclically):
 *
 *  Big–Little–Big lemma: if θi is a STRICT local minimum
 *      θ(i−1) > θi < θ(i+1)
 *  then ci and c(i+1) must have OPPOSITE assignments.
 *
 *  Crimp reduction: if θi is a (non-strict) local minimum and ci, c(i+1)
 *  have opposite assignments, crimp them away. The three sectors merge into
 *      θ(i−1) − θi + θ(i+1)
 *  and the vertex keeps satisfying Kawasaki (and Maekawa with two fewer
 *  creases). Repeat until the base case n = 2: two collinear creases
 *  (θ = π, π) with the SAME assignment (a single straight fold).
 *
 * The assignment is valid iff this reduction reaches a valid base case.
 *
 * Sources: Demaine & O'Rourke, Geometric Folding Algorithms (2007) §12.2.2
 * (crimps and the single-vertex characterization); T. Hull, "Counting
 * mountain-valley assignments for flat folds", Ars Combinatoria (2003);
 * Bern & Hayes, SODA 1996.
 */
import { TOL } from '../numerics/tolerances';
import { kawasaki } from './kawasaki';
import { tr } from '../../i18n';

export type MV = 'M' | 'V';

export interface VertexState {
  /** crease ids still present, in cyclic order */
  creases: number[];
  mv: MV[];
  /** sectors[i] lies between creases[i] and creases[i+1] */
  sectors: number[];
}

export interface CrimpStep {
  before: VertexState;
  after: VertexState;
  /** index into before.sectors that was the local minimum */
  sectorIndex: number;
  removed: [number, number];
  strict: boolean;
}

export interface MVCheckResult {
  valid: boolean;
  reason: string;
  steps: CrimpStep[];
  final: VertexState;
}

const leq = (a: number, b: number) => a <= b + TOL.theoremAngle;
const less = (a: number, b: number) => a < b - TOL.theoremAngle;

export function crimpAt(s: VertexState, i: number): VertexState {
  const n = s.creases.length;
  const prev = (i - 1 + n) % n, next = (i + 1) % n;
  const merged = s.sectors[prev] - s.sectors[i] + s.sectors[next];
  // remove creases i and i+1 (indices i and next), and sectors prev,i,next -> merged
  const keepC: number[] = [], keepMV: MV[] = [], keepS: number[] = [];
  // rebuild starting after `next`
  for (let k = 1; k <= n - 2; k++) {
    const idx = (next + k) % n;
    keepC.push(s.creases[idx]);
    keepMV.push(s.mv[idx]);
  }
  // sectors: for remaining creases in order, sector after each one
  for (let k = 1; k <= n - 2; k++) {
    const idx = (next + k) % n;
    if (idx === prev) keepS.push(merged);
    else keepS.push(s.sectors[idx]);
  }
  return { creases: keepC, mv: keepMV, sectors: keepS };
}

export function checkMVAssignment(sectors: number[], mv: MV[], creaseIds?: number[]): MVCheckResult {
  const n = sectors.length;
  const ids = creaseIds ?? sectors.map((_, i) => i);
  let state: VertexState = { creases: [...ids], mv: [...mv], sectors: [...sectors] };
  const steps: CrimpStep[] = [];
  const k = kawasaki(sectors);
  if (!k.satisfied) return { valid: false, reason: tr('Kawasaki 조건 불성립: 섹터각이 평탄 접힘 가능하지 않다', 'Kawasaki condition fails: the sector angles cannot fold flat'), steps, final: state };
  if (mv.length !== n) return { valid: false, reason: tr('배정 길이가 크리스 수와 일치하지 않는다', 'The assignment length does not match the number of creases'), steps, final: state };

  while (state.creases.length > 2) {
    const m = state.creases.length;
    let chosen = -1, chosenStrict = false;
    for (let i = 0; i < m; i++) {
      const a = state.sectors[(i - 1 + m) % m], b = state.sectors[i], c = state.sectors[(i + 1) % m];
      const isMin = leq(b, a) && leq(b, c);
      const strict = less(b, a) && less(b, c);
      if (!isMin) continue;
      if (state.mv[i] === state.mv[(i + 1) % m]) {
        if (strict)
          return {
            valid: false,
            reason: tr(
              `Big–little–big 위반: ${label(state.creases[i])}, ${label(state.creases[(i + 1) % m])} 사이 섹터가 엄격한 국소 최소인데 두 크리스가 모두 ${state.mv[i]}이다`,
              `Big–little–big violated: the sector between ${label(state.creases[i])} and ${label(state.creases[(i + 1) % m])} is a strict local minimum, but both creases are ${state.mv[i]}`,
            ),
            steps,
            final: state,
          };
        continue;
      }
      if (chosen < 0 || (strict && !chosenStrict)) { chosen = i; chosenStrict = strict; }
    }
    if (chosen < 0)
      return { valid: false, reason: tr('M/V가 반대인 두 크리스 사이에 crimp 가능한 국소 최소 섹터가 없다', 'No local-minimum sector between two creases of opposite M/V can be crimped'), steps, final: state };
    const after = crimpAt(state, chosen);
    steps.push({
      before: state,
      after,
      sectorIndex: chosen,
      removed: [state.creases[chosen], state.creases[(chosen + 1) % m]],
      strict: chosenStrict,
    });
    state = after;
  }
  if (state.creases.length === 2) {
    const ok = state.mv[0] === state.mv[1];
    return {
      valid: ok,
      reason: ok
        ? tr('단일 직선 접기로 축약됨 (기저 사례): 배정 유효', 'Reduced to a single straight fold (base case): assignment valid')
        : tr('기저 사례의 두 공선 크리스 배정이 서로 다르다', 'In the base case, the two collinear creases have different assignments'),
      steps,
      final: state,
    };
  }
  return { valid: false, reason: tr('예상치 못한 홀수 차수', 'Unexpected odd degree'), steps, final: state };
}

const label = (id: number) => `c${id + 1}`;
