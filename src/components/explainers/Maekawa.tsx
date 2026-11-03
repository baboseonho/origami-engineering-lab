import type { ReactNode } from 'react';
import { tr } from '../../i18n';
import { arc, BAD, E, EVEN, INK, INK2, INK3, inOut, Label, lerp, MARK, MOUNTAIN, ODD, OK, popScale, pt, rad, steps, TAIL, VALLEY, wedge, type Scene } from './Explainer';
import { FoldedVertex, foldPlan, LAYER_OFF, levels } from './FoldedVertex';

/*
 * Maekawa's theorem, as a walk around the folded circle.
 *
 * Every number on screen is computed below from TH and the mountain/valley
 * lists: the folded directions come from foldPlan, the pulled-apart radius of
 * each layer from its stack level, and the turn of every U-turn from the
 * drawn geometry itself (a semicircle's sweep). The ledger, the dial and the
 * captions read those values; nothing is typed by hand.
 */

type A = 'M' | 'V';
const TH = [70, 100, 110, 80];
const N = TH.length;
/** the vertex: three valleys, one mountain */
const MV: readonly A[] = ['V', 'M', 'V', 'V'];
/** two of each: crease 4 changed */
const BAD_MV: readonly A[] = ['V', 'M', 'V', 'M'];
/** the right count, wrong place: the mountain moved from crease 2 to crease 3 */
const WRONG_MV: readonly A[] = ['V', 'V', 'M', 'V'];
const CX = 128, CY = 150, RP = 100;
const lineCol = (a: A) => (a === 'M' ? MOUNTAIN : VALLEY);
const dash = (a: A) => (a === 'M' ? '9 3 2 3' : '7 4');
const count = (mv: readonly A[], a: A) => mv.filter((x) => x === a).length;
/** sector colours, the same as in the Kawasaki explainer (same vertex) */
const col = (i: number) => (i % 2 === 0 ? ODD : EVEN);
const RAYS = TH.reduce<number[]>((a, x) => [...a, a[a.length - 1] + x], [0]).slice(0, N);

const cl = (x: number) => Math.min(1, Math.max(0, x));
/** progress of [a, a + d] in ms, through an ease */
const win = (ms: number, a: number, d: number, e: (x: number) => number = E.inOut) => e((ms - a) / d);
const bump = (x: number) => (x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x));
const fmt = (d: number) => (d > 0.5 ? `+${Math.round(d)}°` : d < -0.5 ? `−${Math.round(-d)}°` : '0°');
const deg = (r: number) => (r * 180) / Math.PI;

// ───────────────────────────── the folded circle and the walk

const PLAN = foldPlan(TH, MV);
/** stack level of each sector after all folds (0 = bottom): [2, 1, 0, 3] */
const LEVELS = levels(PLAN, N - 1);
const TOP = Math.max(...LEVELS);
/** the folded direction of each sector's two ends, seen from above (unwrapped degrees) */
const PHI = TH.map((x, i) => {
  const s = PLAN.states[N - 1][i];
  return [s.s * RAYS[i] + s.c, s.s * (RAYS[i] + x) + s.c] as const;
});
/** pulled-apart radius of each layer: the stack's order, top layer innermost (as in the folded drawing) */
const R0 = 30, RS = 20;
const rL = (i: number) => R0 + RS * (TOP - LEVELS[i]);

interface Piece {
  kind: 'arc' | 'u';
  /** the sector the arc lies in, or the sector the U-turn leaves */
  sector: number;
  /** the crease of a U-turn */
  crease: number;
  /** signed turn of the heading, degrees (+ = counter-clockwise = left) */
  turn: number;
  pos: (s: number) => [number, number];
  head: (s: number) => number;
  d: (s: number) => string;
}

/**
 * The closed walk: an arc on each layer, then a semicircular U-turn on the
 * crease to the next layer. The U-turn's turn is read off its own geometry:
 * it sweeps from where it starts towards the direction of travel.
 */
function buildWalk(): Piece[] {
  const out: Piece[] = [];
  for (let i = 0; i < N; i++) {
    const [a0, a1] = PHI[i];
    const R = rL(i), dir = Math.sign(a1 - a0);
    out.push({
      kind: 'arc', sector: i, crease: i, turn: a1 - a0,
      pos: (s) => pt(CX, CY, R, lerp(a0, a1, s)),
      head: (s) => lerp(a0, a1, s) + 90 * dir,
      d: (s) => arc(CX, CY, R, a0, lerp(a0, a1, s)),
    });
    const j = (i + 1) % N, ra = R, rb = rL(j);
    const [mx, my] = pt(CX, CY, (ra + rb) / 2, a1);
    const rho = Math.abs(rb - ra) / 2;
    /** from the centre of the U-turn to where it starts */
    const u0 = ra > rb ? a1 : a1 + 180;
    const h0 = a1 + 90 * dir;
    const sw = Math.sign(Math.sin(rad(h0 - u0)));
    const at = (s: number) => pt(mx, my, rho, u0 + 180 * sw * s);
    out.push({
      kind: 'u', sector: i, crease: j, turn: 180 * sw, pos: at,
      head: (s) => u0 + 180 * sw * s + 90 * sw,
      d: (s) => { const [x0, y0] = at(0), [x1, y1] = at(s); return `M${x0.toFixed(2)},${y0.toFixed(2)} A${rho},${rho} 0 0 ${sw > 0 ? 0 : 1} ${x1.toFixed(2)},${y1.toFixed(2)}`; },
    });
  }
  return out;
}
const WALK = buildWalk();
/** heading turned before piece j; CUM[2N] is the whole loop */
const CUM = WALK.reduce<number[]>((a, p) => [...a, a[a.length - 1] + p.turn], [0]);
const H0 = WALK[0].head(0);
const ARC_TURNS = WALK.filter((p) => p.kind === 'arc').map((p) => p.turn);
const U_PIECES = WALK.filter((p) => p.kind === 'u');
/** how a valley and a mountain turn, read off the drawn U-turns */
const TURN_OF = (() => {
  const r: Partial<Record<A, number>> = {};
  for (const p of U_PIECES) r[MV[p.crease]] = p.turn;
  return r as Record<A, number>;
})();
/** the crease order of the U-turns: 2, 3, 4, 1 */
const U_CREASES = U_PIECES.map((p) => p.crease);
const uTurns = (mv: readonly A[]) => U_CREASES.map((c) => TURN_OF[mv[c]]);
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

/** The checks behind the picture: every U-turn turns as the ledger says, and the loop closes after exactly one turn. */
export function maekawaCheck() {
  const dist = (p: [number, number], q: [number, number]) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  const wrap = (x: number) => ((x % 360) + 540) % 360 - 180;
  return {
    levels: LEVELS,
    radii: TH.map((_, i) => rL(i)),
    uTurns: U_PIECES.map((p) => ({ crease: p.crease + 1, a: MV[p.crease], turn: p.turn })),
    /** each U-turn agrees with every other of its kind */
    consistent: U_PIECES.every((p) => p.turn === TURN_OF[MV[p.crease]]),
    arcSum: sum(ARC_TURNS),
    uSum: sum(uTurns(MV)),
    total: CUM[CUM.length - 1],
    /** largest gap between consecutive pieces, and between the end and the start */
    gap: Math.max(...WALK.map((p, j) => dist(p.pos(1), WALK[(j + 1) % WALK.length].pos(0)))),
    /** largest heading mismatch between consecutive pieces, and of the dial against the drawn heading */
    headGap: Math.max(...WALK.map((p, j) => Math.abs(wrap(p.head(1) - WALK[(j + 1) % WALK.length].head(0))))),
    dialGap: Math.max(...WALK.map((p, j) => Math.abs(wrap(p.head(1) - (H0 + CUM[j + 1]))))),
    badUSum: sum(uTurns(BAD_MV)),
  };
}
if (import.meta.env?.DEV) {
  const c = maekawaCheck();
  const ok = c.consistent && c.arcSum === 0 && Math.abs(c.total) === 360 && c.uSum === c.total && c.gap < 1e-6 && c.headGap < 1e-6 && c.dialGap < 1e-6
    && c.uTurns.every((u) => u.turn === (u.a === 'V' ? TURN_OF.V : TURN_OF.M)) && TURN_OF.V === -TURN_OF.M;
  if (!ok) console.error('Maekawa explainer: the drawn walk does not match its ledger', c);
}

// ───────────────────────────── scene timing: reading time first, then motion

const LEAD1 = 150, LEADJ = 200;
const chars = (x: string) => [...x].length;
/**
 * Motion ms, but never shorter than reading needs: the whole caption gets
 * characters × 1000/6 ms on screen, and so does the second sentence from the
 * moment it appears (at2, ms into the motion).
 */
const dur = (ko: string[], lead: number, at2: number, motion: number) =>
  Math.max(motion, Math.ceil((chars(ko.join(' ')) * 1000) / 6) - lead - TAIL, Math.ceil(at2 + (chars(ko[1]) * 1000) / 6) - TAIL);

const nV = count(MV, 'V'), nM = count(MV, 'M');
const bV = count(BAD_MV, 'V'), bM = count(BAD_MV, 'M');
const side = (turn: number) => (turn > 0 ? ['왼쪽', 'left'] : ['오른쪽', 'right']);
const KO = {
  s1: ['평탄하게 접히는 꼭짓점.', `산(M) ${nM}개, 골(V) ${nV}개.`],
  s2: ['Kawasaki 때처럼 크리스 1을 잘라 두고 접는다.', '테두리 원은 여러 겹으로 포개진다.'],
  s3: ['겹을 떼어 놓고 테두리를 따라 한 바퀴 걷는다.', `U턴은 골(V)에서 ${side(TURN_OF.V)[0]}, 산(M)에서 ${side(TURN_OF.M)[0]}이다.`],
  s4: ['호는 서로 지워지고 U턴만 남는다.', `종이는 서로를 뚫지 못하니 고리는 꼬이지 않고 꼭 한 바퀴, V − M = ${nV - nM}다.`],
  s5: [`산 ${bM}, 골 ${bV}면 U턴이 서로 지워져 ${fmt(sum(uTurns(BAD_MV)))}다.`, '한 바퀴가 안 되니 평탄하게 접힐 수 없다.'],
  s6: ['개수가 맞아도 안 될 수 있다.', '가장 작은 섹터 양쪽이 둘 다 V면, 이웃한 두 섹터가 부딪친다.'],
};
const EN = {
  s1: ['A vertex that folds flat.', `${nM} mountain (M), ${nV} valleys (V).`],
  s2: ['As in Kawasaki, cut crease 1 for a moment and fold.', 'The rim circle piles up in layers.'],
  s3: ['Pull the layers apart and walk once round the rim.', `A U-turn goes ${side(TURN_OF.V)[1]} at a valley (V), ${side(TURN_OF.M)[1]} at a mountain (M).`],
  s4: ['The arcs cancel; only the U-turns remain.', `Paper cannot pass through itself, so the loop never crosses and turns exactly once: V − M = ${nV - nM}.`],
  s5: [`With ${bM} mountains and ${bV} valleys the U-turns cancel to ${fmt(sum(uTurns(BAD_MV)))}.`, 'No full turn, so it cannot fold flat.'],
  s6: ['The right count is not enough.', 'If both creases beside the smallest sector are V, the two neighbouring sectors run into each other.'],
};
type Key = keyof typeof KO;
const beats = (k: Key, at2: number, D: number) => () => tr(KO[k], EN[k]).map((text, i) => ({ at: i === 0 ? 0 : at2 / D, text }));
const caption = (k: Key) => () => tr(KO[k], EN[k]).join(' ');

// scene 1: each crease inks out in 300 ms; its letter and the counter pop as it lands
const C1 = (j: number) => 120 + 420 * j;
const C1_END = (j: number) => C1(j) + 300;
const RIM1 = C1_END(N - 1) + 100;
const Q1 = RIM1 + 3 * 260 + 340 + 300;
const B1 = 500;
const D1 = dur(KO.s1, LEAD1, B1, Q1 + 1250);
// scene 2: three folds, each with its own beat
const F0 = 1000, F1 = 5200, FGAP = 300;
const FLEN = (F1 - F0 - FGAP * (N - 2)) / (N - 1);
const B2 = 4700;
const D2 = dur(KO.s2, LEADJ, B2, F1 + 2100);
// scene 3: the walk
const ARC_MS = 700, U_MS = 450, W_GAP = 100, W0 = 1100;
const W_LEN = (j: number) => (WALK[j].kind === 'arc' ? ARC_MS : U_MS);
const W_AT = WALK.reduce<number[]>((a, _, j) => [...a, j ? a[j - 1] + W_LEN(j - 1) + W_GAP : W0], []);
const W_END_OF = (j: number) => W_AT[j] + W_LEN(j);
const W_END = W_END_OF(WALK.length - 1);
const B3 = W_AT[1] - 200;
const ACC3 = W_END + 1000;
const D3 = dur(KO.s3, LEADJ, B3, ACC3 + 500);
// scene 4: the two replays on the dial
const RP_STEP = 560, RP_GAP = 140;
const R4A = 450, R4U = 3450;
const rpEnd = (a: number, n: number) => a + n * (RP_STEP + RP_GAP) - RP_GAP;
const B4 = 3000;
const ACC4 = rpEnd(R4U, N) + 1800;
const D4 = dur(KO.s4, LEADJ, B4, ACC4 + 500);
// scene 5: two of each
const R5U = 2300;
const B5 = rpEnd(R5U, N) - 600;
const ACC5 = rpEnd(R5U, N) + 1900;
const D5 = dur(KO.s5, LEADJ, B5, ACC5 + 450);
// scene 6: the crimp
const B6 = 2900;
/** the dashed rim unrolls into the section */
const M6 = 1000, M6D = 900, M6E = M6 + M6D;
const SW6 = 4900, HIT6 = SW6 + 1950;
/** after contact: two bounces, the circle, then the paper answers with a pulse; only the TAIL is held after it */
const BOUNCE = [4, 1.5], BOUNCE_MS = 160, PULSE6 = HIT6 + 700;
const D6 = dur(KO.s6, LEADJ, B6, PULSE6 + 500);

// ───────────────────────────── drawing pieces

/** a letter that pops (scale) or flips (scaleX through 0) about its own centre */
function Letter({ x, y, a, s = 1, sx = 1 }: { x: number; y: number; a: A; s?: number; sx?: number }) {
  if (s <= 0.001) return null;
  return (
    <g transform={`translate(${x} ${y}) scale(${(s * sx).toFixed(3)} ${s.toFixed(3)}) translate(${-x} ${-y})`}>
      <Label x={x} y={y + 5.5} size={16} weight={700} color={lineCol(a)}>{a}</Label>
    </g>
  );
}

/**
 * The vertex on its paper disc, flat (P = 0) or folded P creases deep, seen
 * from above. It always folds by MV; `show` is what the creases say, and
 * `flip[j]` (0..1) turns crease j from `prev` to `show` with a flip of its letter.
 */
function Paper({ P = 0, cx = CX, cy = CY, r = RP, fill = 1, show = MV, prev, flip, edgeK, pop, pulse, circle, rim = 0, closure = 0, hinge = 0, letters = 1 }: {
  P?: number; cx?: number; cy?: number; r?: number; fill?: number; show?: readonly A[]; prev?: readonly A[]; flip?: (j: number) => number;
  edgeK?: (j: number) => number; pop?: (j: number) => number; pulse?: (j: number) => number; circle?: number; rim?: number; closure?: number; hinge?: number; letters?: number;
}) {
  const fk = (j: number) => (flip ? cl(flip(j)) : 0);
  const at = (j: number): A => (prev && fk(j) < 0.5 ? prev[j] : show[j]);
  return (
    <g>
      <FoldedVertex th={TH} mv={MV} cx={cx} cy={cy} r={r} progress={P} fill={fill} edgeK={edgeK} hinge={hinge}
        edgeStyle={(j) => ({ stroke: lineCol(at(j)), width: 3 + 3 * bump(fk(j)) + 2.5 * (pulse ? pulse(j) : 0), dash: dash(at(j)) })}
        circle={circle !== undefined ? { r, opacity: circle } : undefined} rim={rim > 0 ? col : undefined} rimOpacity={rim} closure={closure}
        rayLabel={(j, x, y) => letters > 0 && (
          <g opacity={letters}>
            <Letter x={x} y={y} a={at(j)} s={(pop ? pop(j) : 1) * (1 + 0.35 * (pulse ? pulse(j) : 0))} sx={flip ? Math.max(0.04, Math.abs(Math.cos(Math.PI * fk(j)))) : 1} />
          </g>
        )} />
      {/* a crease being changed is lit like a hinge */}
      {flip && show.map((_, j) => {
        const b = bump(fk(j));
        if (b < 0.01) return null;
        const [x, y] = pt(cx, cy, r + 4, RAYS[j]);
        return <line key={j} x1={cx} y1={cy} x2={x} y2={y} stroke={MARK} strokeWidth={10} strokeLinecap="round" opacity={0.55 * b} />;
      })}
    </g>
  );
}

/** the layers of the folded circle, from the stack (k = 0, exactly the folded drawing's rim) to the walk's radii (k = 1) */
function Layers({ k, opacity = 1 }: { k: (i: number) => number; opacity?: number }) {
  if (opacity <= 0.001) return null;
  return (
    <g opacity={opacity}>
      {TH.map((_, i) => {
        const kk = k(i);
        return <path key={i} d={arc(CX, CY, lerp(RP - LAYER_OFF * LEVELS[i], rL(i), kk), PHI[i][0], PHI[i][1])} fill="none" stroke={col(i)} strokeWidth={lerp(3.5, 2, kk)} strokeOpacity={lerp(1, 0.32, kk)} strokeLinecap="round" />;
      })}
    </g>
  );
}

/** the walked path: arcs in ink, U-turns in their crease's colour; `prog[j]` is how far piece j is drawn */
function WalkPath({ prog, pulse, glow, dim, arcOp = 1, opacity = 1, mv = MV }: { prog: (j: number) => number; pulse?: (j: number) => number; glow?: (j: number) => number; dim?: (j: number) => number; arcOp?: number; opacity?: number; mv?: readonly A[] }) {
  if (opacity <= 0.001) return null;
  return (
    <g opacity={opacity} fill="none" strokeLinecap="round">
      {WALK.map((p, j) => {
        const s = prog(j);
        if (s < 0.01) return null;
        const d = p.d(s);
        const g = glow ? glow(j) : 0, pu = pulse ? pulse(j) : 0;
        const isArc = p.kind === 'arc';
        return (
          <g key={j}>
            {g > 0.01 && <path d={d} stroke={MARK} strokeWidth={11} opacity={0.75 * g} />}
            <path d={d} stroke={isArc ? col(p.sector) : lineCol(mv[p.crease])} strokeWidth={(isArc ? 3 : 4) + 2.2 * pu} opacity={(isArc ? arcOp : 1) * (dim ? dim(j) : 1)} />
          </g>
        );
      })}
    </g>
  );
}

const arrowHead = (x: number, y: number, h: number, L = 8, W = 4.5) => {
  const [tx, ty] = pt(x, y, L, h);
  const [bx, by] = pt(x, y, -L * 0.3, h);
  const [lx, ly] = pt(bx, by, W, h + 90);
  const [rx, ry] = pt(bx, by, W, h - 90);
  return `M${tx.toFixed(2)},${ty.toFixed(2)} L${lx.toFixed(2)},${ly.toFixed(2)} L${rx.toFixed(2)},${ry.toFixed(2)} Z`;
};

/** the walker: a dot with an arrow for its heading */
function Walker({ x, y, h, s = 1 }: { x: number; y: number; h: number; s?: number }) {
  if (s <= 0.001) return null;
  const [ax, ay] = pt(x, y, 7, h);
  return (
    <g transform={`translate(${x} ${y}) scale(${s.toFixed(3)}) translate(${-x} ${-y})`}>
      <path d={arrowHead(ax, ay, h, 8, 5)} fill={INK} stroke="var(--color-paper)" strokeWidth={1.2} strokeLinejoin="round" />
      <circle cx={x} cy={y} r={5.5} fill={INK} stroke="var(--color-paper)" strokeWidth={2} />
    </g>
  );
}

const START = WALK[0].pos(0);
/** where the walk starts and must end; flashes green when the loop closes */
function StartRing({ op, close = 0, bad = false }: { op: number; close?: number; bad?: boolean }) {
  if (op <= 0.001) return null;
  return (
    <g opacity={op}>
      <circle cx={START[0]} cy={START[1]} r={8} fill="none" stroke={close > 0 ? (bad ? BAD : OK) : INK2} strokeWidth={2} />
      {close > 0 && close < 1 && <circle cx={START[0]} cy={START[1]} r={8 + 12 * close} fill="none" stroke={OK} strokeWidth={3} opacity={1 - close} />}
    </g>
  );
}

// the compass dial, its readout and the ledger, on the right
const DX = 306, DY = 88, DR = 30;
/** the trace: angle = heading so far, radius grows with time, so it winds round the dial once only if the heading turned once */
const TR0 = 34, TRK = 16;
type Trace = [number, number][];
/** sample a running turn f(ms) from a to min(now, b): [turn, time 0..1] */
function sampleTrace(f: (ms: number) => number, a: number, b: number, now: number, step = 25): Trace {
  const e = Math.min(now, b);
  if (e < a) return [];
  const out: Trace = [];
  for (let m = a; m < e; m += step) out.push([f(m), (m - a) / (b - a)]);
  out.push([f(e), (e - a) / (b - a)]);
  return out;
}
const tracePt = ([phi, u]: [number, number]) => pt(DX, DY, TR0 + TRK * u, H0 + phi);
const tracePath = (tr: Trace) => tr.map((q, i) => { const [x, y] = tracePt(q); return `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`; }).join(' ');

/** the heading needle (follows the walker) and the trace of the heading so far */
function Dial({ cum, op = 1, trace, traceOp = 1, traceCol = INK2, closed = 0, flash = 0, pulse = 0 }: {
  cum: number; op?: number; trace?: Trace; traceOp?: number; traceCol?: string; closed?: number; flash?: number; pulse?: number;
}) {
  if (op <= 0.001) return null;
  const a = H0 + cum;
  const [nx, ny] = pt(DX, DY, DR - 9, a);
  const [tx, ty] = pt(DX, DY, TR0 + TRK + 4, H0);
  const [sx, sy] = pt(DX, DY, TR0, H0), [ex, ey] = pt(DX, DY, TR0 + TRK, H0);
  const end = trace && trace.length ? tracePt(trace[trace.length - 1]) : null;
  return (
    <g opacity={op}>
      <circle cx={DX} cy={DY} r={DR} fill="var(--color-paper-2)" stroke={INK3} strokeWidth={1.2} />
      {[0, 90, 180, 270].map((d) => { const [x0, y0] = pt(DX, DY, DR - 5, d), [x1, y1] = pt(DX, DY, DR, d); return <line key={d} x1={x0} y1={y0} x2={x1} y2={y1} stroke={INK3} strokeWidth={1.4} />; })}
      <circle cx={DX} cy={DY} r={TR0} fill="none" stroke="var(--color-rule)" strokeWidth={1.2} />
      {trace && trace.length > 1 && traceOp > 0.001 && (
        <g opacity={traceOp}>
          <path d={tracePath(trace)} fill="none" stroke={traceCol} strokeWidth={1.8 + 1.4 * bump(pulse)} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={sx} cy={sy} r={3} fill={traceCol} />
          {end && <circle cx={end[0]} cy={end[1]} r={3.2} fill={traceCol} />}
          {/* back on the start heading after one full turn: the trace's two ends join */}
          {closed > 0 && <line x1={ex} y1={ey} x2={lerp(ex, sx, closed)} y2={lerp(ey, sy, closed)} stroke={traceCol} strokeWidth={3} strokeLinecap="round" />}
        </g>
      )}
      {flash > 0 && flash < 1 && <circle cx={DX} cy={DY} r={TR0 + TRK / 2} fill="none" stroke={MARK} strokeWidth={TRK + 16 * flash} opacity={0.8 * (1 - flash)} />}
      <path d={`M${tx - 5},${ty - 7} L${tx + 5},${ty - 7} L${tx},${ty - 1} Z`} fill={INK2} />
      <Label x={DX} y={ty - 12} size={13} color={INK3} weight={600}>{tr('출발 방향', 'start heading')}</Label>
      <line x1={DX} y1={DY} x2={nx} y2={ny} stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
      <path d={arrowHead(nx, ny, a, 9, 5)} fill={INK} />
      <circle cx={DX} cy={DY} r={3.5} fill={INK} />
    </g>
  );
}

const RX = 362;
function Readout({ cum, op = 1, valOp = 1, color = INK, sub, subK = 0, subColor = OK }: { cum: number; op?: number; valOp?: number; color?: string; sub?: string; subK?: number; subColor?: string }) {
  if (op <= 0.001) return null;
  return (
    <g opacity={op}>
      <Label x={RX} y={72} anchor="start" size={14} color={INK3} weight={600}>{tr('회전 합', 'total turn')}</Label>
      <Label x={RX} y={104} anchor="start" size={26} weight={700} color={color} opacity={valOp}>{fmt(cum)}</Label>
      {sub && <Label x={RX} y={130} anchor="start" size={15} weight={700} color={subColor} rise={subK}>{sub}</Label>}
    </g>
  );
}

const COL1 = { x0: 276, x1: 364 }, COL2 = { x0: 388, x1: 468 };
const HEAD_Y = 158, ROW_Y = (i: number) => 183 + 23 * i, RULE_Y = 265, TOT_Y = 288;
const flipT = (f: number, cy: number) => (f > 0 && f < 1 ? `translate(0 ${cy}) scale(1 ${Math.max(0.04, Math.abs(Math.cos(Math.PI * f))).toFixed(3)}) translate(0 ${-cy})` : undefined);

/** one ledger row: slides in from the right, can be lit, can flip to a new value */
function Row({ col, y, label, value, color, enter = 1, hi = 0, flip = 0 }: { col: { x0: number; x1: number }; y: number; label: ReactNode; value: string; color: string; enter?: number; hi?: number; flip?: number }) {
  if (enter <= 0.001) return null;
  return (
    <g opacity={enter} transform={`translate(${(12 * (1 - enter)).toFixed(2)} 0)`}>
      {hi > 0.01 && <rect x={col.x0 - 6} y={y - 18} width={col.x1 - col.x0 + 12} height={24} rx={3} fill={MARK} opacity={0.6 * hi} />}
      <g transform={flipT(flip, y - 6)}>
        <Label x={col.x0} y={y} anchor="start" size={17} weight={700} color={color}>{label}</Label>
        <Label x={col.x1} y={y} anchor="end" size={17} weight={700} color={color}>{value}</Label>
      </g>
    </g>
  );
}

/** a column header, lit while its pieces are replayed on the dial */
function Head({ col, text, op, hi = 0 }: { col: { x0: number; x1: number }; text: string; op: number; hi?: number }) {
  if (op <= 0.001) return null;
  return (
    <g opacity={op}>
      {hi > 0.01 && <rect x={col.x0 - 6} y={HEAD_Y - 15} width={col.x1 - col.x0 + 12} height={21} rx={3} fill={MARK} opacity={0.6 * hi} />}
      <Label x={col.x0} y={HEAD_Y} anchor="start" size={14} color={INK3} weight={600}>{text}</Label>
      <line x1={col.x0} x2={col.x1} y1={HEAD_Y + 7} y2={HEAD_Y + 7} stroke="var(--color-rule-2)" strokeWidth={1} />
    </g>
  );
}

/** a column total under a rule */
function Total({ col, value, color, k }: { col: { x0: number; x1: number }; value: string; color: string; k: number }) {
  if (k <= 0.001) return null;
  return (
    <g opacity={k}>
      <line x1={col.x0} x2={col.x1} y1={RULE_Y} y2={RULE_Y} stroke={INK} strokeWidth={1.2} />
      <Label x={col.x0} y={TOT_Y} anchor="start" size={15} color={INK3} weight={600} rise={k}>{tr('합', 'sum')}</Label>
      <Label x={col.x1} y={TOT_Y} anchor="end" size={18} weight={700} color={color} rise={k}>{value}</Label>
    </g>
  );
}

const ArcRow = ({ i, enter, hi }: { i: number; enter: number; hi?: number }) => (
  <Row col={COL1} y={ROW_Y(i)} label={`θ_${i + 1}`} value={fmt(ARC_TURNS[i])} color={col(i)} enter={enter} hi={hi} />
);
function URow({ i, mv, prev, flip = 0, enter, hi }: { i: number; mv: readonly A[]; prev?: readonly A[]; flip?: number; enter: number; hi?: number }) {
  const a = prev && flip < 0.5 ? prev[U_CREASES[i]] : mv[U_CREASES[i]];
  return <Row col={COL2} y={ROW_Y(i)} label={a} value={fmt(TURN_OF[a])} color={lineCol(a)} enter={enter} hi={hi} flip={flip} />;
}

/** bottom left: V − M, worked out; the right-hand side flips when the count changes */
const VM_X = 96, VM_Y = 288;
function Verdict({ mv, prev, flip = 0, k, pulse = 0 }: { mv: readonly A[]; prev?: readonly A[]; flip?: number; k: number; pulse?: number }) {
  if (k <= 0.001) return null;
  const m = prev && flip < 0.5 ? prev : mv;
  const v = count(m, 'V'), mm = count(m, 'M');
  const good = Math.abs(v - mm) === 2;
  // an accent at the end of a scene: the result swells once and settles
  const sc = 1 + 0.08 * bump(pulse);
  return (
    <g opacity={k} transform={sc !== 1 ? `translate(${VM_X} ${VM_Y - 6}) scale(${sc.toFixed(4)}) translate(${-VM_X} ${-(VM_Y - 6)})` : undefined}>
      <Label x={VM_X} y={VM_Y} anchor="end" size={18} weight={700} rise={k}>V − M =</Label>
      <g transform={flipT(flip, VM_Y - 6)}>
        <Label x={VM_X + 8} y={VM_Y} anchor="start" size={18} weight={700} color={good ? OK : BAD} rise={k}>{`${v} − ${mm} = ${v - mm}  ${good ? '✓' : '✗'}`}</Label>
      </g>
    </g>
  );
}

/** scene 1–2: how many of each */
function Tally({ op = 1, nm, nv, popM = 1, popV = 1 }: { op?: number; nm: number; nv: number; popM?: number; popV?: number }) {
  if (op <= 0.001) return null;
  const row = (y: number, a: A, name: string, n: number, p: number) => (
    <g>
      <Label x={300} y={y} anchor="start" size={30} weight={700} color={lineCol(a)}>{a}</Label>
      <Label x={330} y={y - 4} anchor="start" size={14} color={INK3} weight={600}>{name}</Label>
      <g transform={`translate(456 ${y - 10}) scale(${p.toFixed(3)}) translate(-456 ${-(y - 10)})`}>
        <Label x={456} y={y} anchor="end" size={30} weight={700} color={lineCol(a)}>{String(n)}</Label>
      </g>
    </g>
  );
  return (
    <g opacity={op}>
      {row(96, 'M', tr('산접기', 'mountain'), nm, popM)}
      {row(146, 'V', tr('골접기', 'valley'), nv, popV)}
    </g>
  );
}

// ───────────────────────────── the walk's clock (scene 3) and the replays (scenes 4, 5)

function walkAt(ms: number) {
  const prog = WALK.map((_, j) => E.inOut((ms - W_AT[j]) / W_LEN(j)));
  let j = -1;
  prog.forEach((s, k) => { if (s > 0) j = k; });
  if (j < 0) return { prog, x: START[0], y: START[1], h: H0, cum: 0 };
  const s = prog[j], p = WALK[j];
  const [x, y] = p.pos(s);
  return { prog, x, y, h: p.head(s), cum: CUM[j] + p.turn * s };
}

/** step through `vals` one at a time from `a`: the running sum, and how lit each step is */
function replay(ms: number, a: number, vals: number[]) {
  let cum = 0;
  const hi: number[] = [];
  vals.forEach((v, i) => {
    const s0 = a + i * (RP_STEP + RP_GAP);
    cum += v * win(ms, s0, RP_STEP);
    hi.push(inOut(ms, s0 - 60, 160, s0 + RP_STEP, 260));
  });
  return { cum, hi, started: ms >= a };
}

// ───────────────────────────── the crimp, side view of the straightened circle

/** the smallest sector and its neighbours: big–little–big */
const SMALL = TH.indexOf(Math.min(...TH));
const LEFT = (SMALL - 1 + N) % N, RIGHT = (SMALL + 1) % N;
/** drawing units per degree of rim: the lengths keep the sectors' true ratio */
const SK = 1.1;
const SY = 182, SA = 284, SB = SA + SK * TH[SMALL];
const LA = SK * TH[LEFT], LB = SK * TH[RIGHT];
/** both flaps turn at the same rate; the shorter one's tip meets the other flap at this angle */
const TAU_C = 180 - deg(Math.acos((SB - SA) / (2 * Math.min(LA, LB))));
/** the apex of the triangle the two flaps make with the little sector */
const CONTACT: [number, number] = [(SA + SB) / 2, SY - ((SB - SA) / 2) * Math.tan(rad(180 - TAU_C))];

/** one flap of the section: hinged at x = h, turned by tau (degrees) up (V) or down (M) */
function Flap({ h, len, left, a, tau, label }: { h: number; len: number; left: boolean; a: A; tau: number; label: string }) {
  const up = a === 'V';
  const d0 = left ? 180 : 0;
  const dir = d0 + (left === up ? -tau : tau);
  // close to flat, the flap lies one paper thickness above (V) or below (M) the middle
  const w = cl((tau - 140) / 40), off = (up ? -9 : 9) * w;
  const [tx, ty] = pt(h, SY + off, len, dir);
  const sweep = (left && up) || (!left && !up) ? 1 : 0;
  const bend = w > 0.01 ? `A${(Math.abs(off) / 2).toFixed(2)},${(Math.abs(off) / 2).toFixed(2)} 0 0 ${sweep} ${h},${(SY + off).toFixed(2)} ` : '';
  // the flap's own sector name rides along on its outer side (away from the little sector)
  const [mx, my] = pt(h, SY + off, len / 2, dir);
  const mid0: [number, number] = [(SA + SB) / 2, SY];
  const cands = [pt(mx, my, 15, dir + 90), pt(mx, my, 15, dir - 90)];
  const far = (q: [number, number]) => Math.hypot(q[0] - mid0[0], q[1] - mid0[1]);
  const [lx, ly] = far(cands[0]) > far(cands[1]) ? cands[0] : cands[1];
  return (
    <g>
      <path d={`M${h},${SY} ${bend}L${tx.toFixed(2)},${ty.toFixed(2)}`} fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      <Label x={lx} y={ly + 5} size={14} weight={600} color={INK2} opacity={cl((tau - 30) / 25)}>{label}</Label>
    </g>
  );
}

/** a curved arrow at a hinge: which way the flap is about to swing */
function Swing({ h, left, a, k }: { h: number; left: boolean; a: A; k: number }) {
  if (k <= 0.001) return null;
  const up = a === 'V';
  const d0 = left ? 180 : 0, sgn = left === up ? -1 : 1;
  const a1 = d0 + sgn * 55 * k;
  const [ex, ey] = pt(h, SY, 30, a1);
  return (
    <g opacity={Math.min(1, k * 2)}>
      <path d={arc(h, SY, 30, d0 + sgn * 6, a1)} fill="none" stroke={lineCol(a)} strokeWidth={2.2} strokeDasharray="4 3" />
      {k > 0.3 && <path d={arrowHead(ex, ey, a1 + sgn * 90, 8, 4.5)} fill={lineCol(a)} />}
      <Label x={h} y={SY - 22} size={16} weight={700} color={lineCol(a)}>{a}</Label>
    </g>
  );
}

function Section({ draw, labels, la, lb, tauA, tauB, swing = 0 }: { draw: number; labels: number; la: A; lb: A; tauA: number; tauB: number; swing?: number }) {
  if (draw <= 0.001) return null;
  const x0 = SA - LA, x1 = SB + LB, L = x1 - x0;
  return (
    <g>
      {/* the little sector, marked as on the paper */}
      <line x1={SA} y1={SY} x2={SA + (SB - SA) * cl((draw * L - LA) / (SB - SA))} y2={SY} stroke={MARK} strokeWidth={13} strokeLinecap="round" opacity={0.85} />
      {draw < 1 ? (
        <line x1={x0} y1={SY} x2={x0 + L * draw} y2={SY} stroke={INK} strokeWidth={4.5} strokeLinecap="round" />
      ) : (
        <g>
          <line x1={SA} y1={SY} x2={SB} y2={SY} stroke={INK} strokeWidth={4} strokeLinecap="round" />
          {/* the flap that ends on top is drawn last */}
          {(la === 'V' ? [1, 0] : [0, 1]).map((s) => s === 0
            ? <Flap key="a" h={SA} len={LA} left a={la} tau={tauA} label={`θ_${LEFT + 1}`} />
            : <Flap key="b" h={SB} len={LB} left={false} a={lb} tau={tauB} label={`θ_${RIGHT + 1}`} />)}
        </g>
      )}
      {[SA, SB].map((x) => <circle key={x} cx={x} cy={SY} r={3} fill="var(--color-paper)" stroke={INK} strokeWidth={1.5} opacity={draw >= 1 ? 1 : 0} />)}
      {[[LEFT, SA - LA / 2], [SMALL, (SA + SB) / 2], [RIGHT, SB + LB / 2]].map(([i, x]) => (
        <Label key={i} x={x} y={SY + 34} size={14} weight={600} color={i === SMALL ? 'var(--color-mark-ink)' : INK2} opacity={labels}>{`θ_${i + 1} ${TH[i]}°`}</Label>
      ))}
      <Swing h={SA} left a={la} k={swing} />
      <Swing h={SB} left={false} a={lb} k={swing} />
    </g>
  );
}

/** the dashed rim's radius, as a fraction of the paper's */
const BAND = 0.82;
/**
 * The stretch of rim from sector LEFT through SMALL to RIGHT, unrolled from its
 * arc on the paper (k = 0) to the straight section (k = 1): an arc of falling
 * curvature whose middle slides and turns into place, its length growing to
 * the section's (both in the sectors' ratio).
 */
function Unroll({ k, cx, cy, rr }: { k: number; cx: number; cy: number; rr: number }) {
  const a0 = RAYS[LEFT] - 360, span = TH[LEFT] + TH[SMALL] + TH[RIGHT];
  const amid = a0 + span / 2;
  const L1 = SB + LB - (SA - LA);
  const [m0x, m0y] = pt(cx, cy, rr, amid);
  const Mx = lerp(m0x, SA - LA + L1 / 2, k), My = lerp(m0y, SY, k);
  const th = rad(lerp(amid + 90, 0, k));
  const c = (1 - k) / rr;
  const Lk = lerp(rad(span) * rr, L1, k);
  const at = (s: number): [number, number] => {
    const sg = (s - 0.5) * Lk;
    const al = c > 1e-6 ? Math.sin(c * sg) / c : sg, sd = c > 1e-6 ? (1 - Math.cos(c * sg)) / c : 0;
    return [Mx + al * Math.cos(th) - sd * Math.sin(th), My - (al * Math.sin(th) + sd * Math.cos(th))];
  };
  const line = (s0: number, s1: number) => Array.from({ length: 41 }, (_, i) => at(lerp(s0, s1, i / 40))).map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const f0 = TH[LEFT] / span, f1 = (TH[LEFT] + TH[SMALL]) / span;
  return (
    <g fill="none" strokeLinecap="round">
      <path d={line(f0, f1)} stroke={MARK} strokeWidth={lerp(5, 13, k)} opacity={0.85} />
      <path d={line(0, 1)} stroke={INK} strokeWidth={lerp(2, 4.5, k)} strokeDasharray={k < 0.6 ? '3 3' : undefined} />
    </g>
  );
}

// ───────────────────────────── scenes

/** the walk diagram is drawn larger than the folded paper it comes from: one zoom, eased in and out */
const ZC = [165, 130] as const, ZQ = [130, 154] as const, ZS = 1.3;
function Zoom({ k, children }: { k: number; children: ReactNode }) {
  if (k <= 0) return <g>{children}</g>;
  const s = lerp(1, ZS, k), qx = lerp(ZC[0], ZQ[0], k), qy = lerp(ZC[1], ZQ[1], k);
  return <g transform={`translate(${qx.toFixed(2)} ${qy.toFixed(2)}) scale(${s.toFixed(4)}) translate(${-ZC[0]} ${-ZC[1]})`}>{children}</g>;
}

const flatNote = () => tr('펼친 종이', 'flat sheet');
const circleNote = () => tr('층을 떼어 놓은 접힌 원', 'the folded circle, layers pulled apart');
/** where the flat paper sits in scene 5 and 6 */
const P5 = { cx: 124, cy: 130, r: 86 }, P6 = { cx: 86, cy: 108, r: 60 };
const ARC_J = (i: number) => 2 * i, U_J = (i: number) => 2 * i + 1;

/** the question the explainer answers, asked while the creases are counted */
const Question = ({ k, pulse = 0 }: { k: number; pulse?: number }) => (
  <g transform={pulse > 0 && pulse < 1 ? `translate(468 258) scale(${(1 + 0.08 * bump(pulse)).toFixed(4)}) translate(-468 -258)` : undefined}>
    <Label x={468} y={246} anchor="end" size={18} weight={700} color={INK2} rise={k}>{`V − M = ${nV} − ${nM} = ${nV - nM}`}</Label>
    <Label x={468} y={272} anchor="end" size={18} weight={700} color={INK3} rise={win(k, 0.3, 0.7, E.linear)}>{tr('왜?', 'why?')}</Label>
  </g>
);
/** scene 2: crease 1 is cut for the explanation, and meets itself again when the paper lies flat */
function CutNote({ cut, meet, op = 1 }: { cut: number; meet: number; op?: number }) {
  if (op <= 0.001) return null;
  return (
    <g opacity={op}>
      <Label x={CX + RP + 24} y={CY + 40} anchor="start" size={13} color={INK3} weight={600} rise={cut}>{tr('여기를 잘라 둠', 'cut here')}</Label>
      <Label x={CX + RP + 24} y={CY + 62} anchor="start" size={13} color={OK} weight={700} rise={meet}>{tr('→ 접으면 다시 맞닿음 ✓', '→ meets again when folded ✓')}</Label>
    </g>
  );
}

/** scene 5: a small U-turn around a crease's letter, drawn on the dial's clock: which way that crease would turn the walk */
function UGlyph({ cx, cy, r, c, a, k }: { cx: number; cy: number; r: number; c: number; a: A; k: number }) {
  if (k <= 0.001) return null;
  const [lx, ly] = pt(cx, cy, r + 17, RAYS[c]);
  const ccw = TURN_OF[a] > 0;
  const b0 = ccw ? RAYS[c] - 90 : RAYS[c] + 90;
  const b1 = b0 + (ccw ? 180 : -180) * k;
  const [ex, ey] = pt(lx, ly, 14, b1);
  return (
    <g>
      <path d={arc(lx, ly, 14, b0, b1)} fill="none" stroke={lineCol(a)} strokeWidth={2.4} strokeLinecap="round" />
      {k > 0.25 && <path d={arrowHead(ex, ey, b1 + (ccw ? 90 : -90), 7, 4)} fill={lineCol(a)} />}
    </g>
  );
}

const walkCum = (m: number) => walkAt(m).cum;
const repCum = (a: number, vals: number[]) => (m: number) => replay(m, a, vals).cum;
const WALK_TRACE = sampleTrace(walkCum, W0, W_END, Infinity);
const U_TRACE = sampleTrace(repCum(R4U, uTurns(MV)), R4U, rpEnd(R4U, N), Infinity);
const BAD_TRACE = sampleTrace(repCum(R5U, uTurns(BAD_MV)), R5U, rpEnd(R5U, N), Infinity);

/** scene 5's right half as it ends, for scene 6 to take away */
function Panel5({ glyph = 1 }: { glyph?: number }) {
  return (
    <g>
      <Dial cum={0} trace={BAD_TRACE} traceCol={BAD} />
      <Readout cum={0} color={BAD} sub={tr('0바퀴 감김 ✗', 'wound 0 times ✗')} subColor={BAD} subK={1} />
      <Head col={COL2} text={tr('U턴', 'U-turns')} op={1} />
      {TH.map((_, i) => <URow key={'u' + i} i={i} mv={BAD_MV} enter={1} />)}
      <Total col={COL2} value={`${fmt(sum(uTurns(BAD_MV)))} ✗`} color={BAD} k={1} />
      <Verdict mv={BAD_MV} k={1} />
      <Theorem k={1} />
      <g opacity={glyph}>{U_CREASES.map((c) => <UGlyph key={c} {...P5} c={c} a={BAD_MV[c]} k={1} />)}</g>
    </g>
  );
}
const Theorem = ({ k }: { k: number }) => (
  <g opacity={k}>
    <Label x={16} y={262} anchor="start" size={15} weight={600} color={INK2} rise={k}>
      {tr('Maekawa 정리: 평탄하게 접히면 ', 'Maekawa: if it folds flat, ')}<tspan fontWeight={700} fill={INK}>|M − V| = 2</tspan>
    </Label>
  </g>
);

export const maekawaScenes = (): Scene[] => [
  {
    duration: D1, lead: LEAD1, view: 'top', viewNote: flatNote, beats: beats('s1', B1, D1), caption: caption('s1'),
    draw: (t) => {
      const ms = t * D1;
      const landed = (j: number) => ms >= C1_END(j);
      const cnt = (a: A) => MV.filter((x, j) => x === a && landed(j)).length;
      const popOf = (a: A) => { const j = MV.reduce((acc, x, jj) => (x === a && landed(jj) ? jj : acc), -1); return j < 0 ? 1 : popScale(win(ms, C1_END(j), 320, E.linear)); };
      return (
        <g>
          <Paper fill={0.35 + 0.65 * win(ms, 0, 400, E.out)}
            edgeK={(j) => win(ms, C1(j), 300, E.out)}
            pop={(j) => popScale(win(ms, C1_END(j), 320, E.linear))} />
          {/* the rim inks round, sector by sector, in the sector colours of the Kawasaki explainer */}
          {TH.map((x, i) => {
            const k = win(ms, RIM1 + 260 * i, 340, E.inOut);
            return k > 0.005 && <path key={i} d={arc(CX, CY, RP, RAYS[i], RAYS[i] + x * k)} fill="none" stroke={col(i)} strokeWidth={3.5} strokeLinecap="round" />;
          })}
          <circle cx={CX} cy={CY} r={5} fill={INK} transform={`translate(${CX} ${CY}) scale(${(0.6 + 0.4 * E.back(2)(cl(ms / 300))).toFixed(3)}) translate(${-CX} ${-CY})`} />
          <Tally op={win(ms, 0, 300, E.out)} nm={cnt('M')} nv={cnt('V')} popM={popOf('M')} popV={popOf('V')} />
          <Question k={win(ms, Q1, 360, E.out)} pulse={win(ms, Q1 + 900, 350, E.linear)} />
        </g>
      );
    },
  },
  {
    duration: D2, lead: LEADJ, join: 'none', view: 'top', viewNote: () => tr('접는 중', 'folding'), beats: beats('s2', B2, D2), caption: caption('s2'),
    draw: (t) => {
      const ms = t * D2;
      const P = steps(ms, F0, F1, N - 1, FGAP);
      const fs = (k: number) => F0 + k * (FLEN + FGAP);
      // the next fold's hinge lights up just before it turns
      const hinge = Math.max(0, ...Array.from({ length: N - 1 }, (_, k) => win(ms, fs(k) - 280, 240, E.out) * (ms < fs(k) + 1 ? 1 : 0)));
      // after the last fold, the rim layers light up from the bottom of the stack to the top
      const order = TH.map((_, i) => i).sort((a, b) => LEVELS[a] - LEVELS[b]);
      return (
        <g>
          <Paper P={P} rim={1} closure={win(ms, F1 + 100, 300, E.out)} hinge={hinge} />
          {order.map((i, q) => {
            const b = bump((ms - (F1 + 550 + 300 * q)) / 420);
            if (b < 0.01) return null;
            const d = arc(CX, CY, RP - LAYER_OFF * LEVELS[i], PHI[i][0], PHI[i][1]);
            return <g key={i}><path d={d} fill="none" stroke={MARK} strokeWidth={9} strokeLinecap="round" opacity={0.85 * b} /><path d={d} fill="none" stroke={col(i)} strokeWidth={3.5 + 1.5 * b} strokeLinecap="round" /></g>;
          })}
          <CutNote cut={win(ms, 100, 400, E.out)} meet={win(ms, F1 + 150, 360, E.out)} />
          <Tally nm={nM} nv={nV} />
          <Question k={1} />
        </g>
      );
    },
  },
  {
    duration: D3, lead: LEADJ, join: 'none', view: 'diagram', viewNote: circleNote, beats: beats('s3', B3, D3), caption: caption('s3'),
    draw: (t) => {
      const ms = t * D3;
      const fade = win(ms, 0, 650, E.out);
      const leave = 1 - win(ms, 0, 260, E.in);
      // top layer first: it has the furthest to go
      const k = (i: number) => win(ms, 60 + 140 * (TOP - LEVELS[i]), 620, E.out3);
      const w = walkAt(ms);
      const done = ms >= W_END;
      const close = win(ms, W_END, 700, E.out);
      const appear = win(ms, W0 - 250, 260, E.linear);
      const acc = win(ms, ACC3, 320, E.linear);
      return (
        <g>
          <Zoom k={win(ms, 0, 1000, E.inOut3)}>
            <Paper P={N - 1} fill={1 - 0.88 * fade} closure={1 - fade} />
            <Layers k={k} />
            <WalkPath prog={(j) => w.prog[j]} pulse={(j) => bump((ms - W_END_OF(j)) / 380)}
              dim={(j) => {
                // while walking, the piece under way leads; done pieces step back (arcs more than U-turns); when the loop closes, all of it returns
                const back = WALK[j].kind === 'arc' ? 0.55 : 0.7;
                const d = lerp(1, back, win(ms, W_END_OF(j), 300, E.out));
                return lerp(d, 1, win(ms, W_END, 450, E.out));
              }} />
            <StartRing op={appear} close={close} />
            <Walker x={w.x} y={w.y} h={w.h} s={popScale(appear)} />
          </Zoom>
          <g opacity={leave}>
            <Tally nm={nM} nv={nV} />
            <Question k={1} />
            <CutNote cut={1} meet={1} />
          </g>
          <Dial cum={w.cum} op={win(ms, 280, 380, E.out)} trace={sampleTrace(walkCum, W0, W_END, ms)} traceCol={done ? OK : INK2}
            closed={win(ms, W_END, 300, E.out)} flash={win(ms, W_END + 150, 700, E.out)} traceOp={1 - 0.4 * bump(acc)} pulse={acc} />
          <Readout cum={w.cum} op={win(ms, 380, 380, E.out)} color={done ? OK : INK} sub={tr('1바퀴 감김 ✓', 'wound once ✓')} subK={win(ms, W_END + 120, 320, E.out)} />
          <Head col={COL1} text={tr('호 (arc)', 'arcs')} op={win(ms, 420, 300, E.out)} />
          <Head col={COL2} text={tr('U턴', 'U-turns')} op={win(ms, 480, 300, E.out)} />
          {TH.map((_, i) => <ArcRow key={'a' + i} i={i} enter={win(ms, W_END_OF(ARC_J(i)), 260, E.out)} />)}
          {TH.map((_, i) => <URow key={'u' + i} i={i} mv={MV} enter={win(ms, W_END_OF(U_J(i)), 260, E.out)} />)}
        </g>
      );
    },
  },
  {
    duration: D4, lead: LEADJ, join: 'none', view: 'diagram', viewNote: circleNote, beats: beats('s4', B4, D4), caption: caption('s4'),
    draw: (t) => {
      const ms = t * D4;
      const ra = replay(ms, R4A, ARC_TURNS);
      const ru = replay(ms, R4U, uTurns(MV));
      const inU = ms >= R4U - 250;
      const uEnd = rpEnd(R4U, N);
      const uDone = ms >= uEnd;
      // the scene opens on the walk's closed trace; it clears before the first replay
      const first = ms < R4A;
      const cumShown = first ? 360 : inU ? ru.cum : ra.cum;
      const trace = first ? WALK_TRACE : inU ? sampleTrace(repCum(R4U, uTurns(MV)), R4U, uEnd, ms) : sampleTrace(repCum(R4A, ARC_TURNS), R4A, rpEnd(R4A, N), ms);
      const traceOp = first ? 1 - win(ms, 0, 300, E.in) : !inU ? 1 - win(ms, R4U - 450, 200, E.in) : 1;
      const valOp = first ? 1 - win(ms, 0, 260, E.in) : win(ms, R4A - 120, 200, E.out);
      return (
        <g>
          <Zoom k={1}>
            <Paper P={N - 1} fill={0.12} />
            <Layers k={() => 1} />
            <WalkPath prog={() => 1} arcOp={1 - 0.6 * win(ms, rpEnd(R4A, N) + 100, 400)}
              glow={(j) => (WALK[j].kind === 'arc' ? ra.hi[j / 2] : ru.hi[(j - 1) / 2])} />
            <StartRing op={1} close={1} />
            <Walker x={START[0]} y={START[1]} h={H0} />
          </Zoom>
          <Dial cum={cumShown} trace={trace} traceOp={traceOp} traceCol={uDone || first ? OK : INK2}
            closed={first ? 1 : win(ms, uEnd, 300, E.out)} flash={win(ms, uEnd + 150, 700, E.out)} />
          <Readout cum={cumShown} valOp={valOp} color={uDone || first ? OK : INK} sub={tr('1바퀴 감김 ✓', 'wound once ✓')}
            subK={first ? 1 - win(ms, 0, 220, E.in) : win(ms, uEnd + 120, 320, E.out)} />
          <Head col={COL1} text={tr('호 (arc)', 'arcs')} op={1} hi={inOut(ms, R4A - 200, 200, rpEnd(R4A, N), 300)} />
          <Head col={COL2} text={tr('U턴', 'U-turns')} op={1} hi={inOut(ms, R4U - 200, 200, uEnd, 300)} />
          {TH.map((_, i) => <ArcRow key={'a' + i} i={i} enter={1} hi={ra.hi[i]} />)}
          {TH.map((_, i) => <URow key={'u' + i} i={i} mv={MV} enter={1} hi={ru.hi[i]} />)}
          <Total col={COL1} value={fmt(sum(ARC_TURNS))} color={INK3} k={win(ms, rpEnd(R4A, N) + 120, 320, E.out)} />
          <Total col={COL2} value={fmt(sum(uTurns(MV)))} color={OK} k={win(ms, uEnd + 150, 320, E.out)} />
          <Verdict mv={MV} k={win(ms, uEnd + 700, 360, E.out)} pulse={win(ms, ACC4, 350, E.linear)} />
        </g>
      );
    },
  },
  {
    duration: D5, lead: LEADJ, join: 'none', view: 'top', viewNote: () => tr('펼친 종이, 오른쪽은 U턴만 더한 값', 'flat sheet; right: the U-turns only'), beats: beats('s5', B5, D5), caption: caption('s5'),
    draw: (t) => {
      const ms = t * D5;
      const out = 1 - win(ms, 0, 300, E.in);
      // zoom out and move first, so the unfolding paper stays inside the frame
      const m = win(ms, 0, 650, E.inOut3);
      const unfold = steps(ms, 350, 1550, N - 1, 80);
      const flipK = win(ms, 1650, 450, E.inOut);
      // which crease changes: the first where the two lists differ
      const changed = BAD_MV.findIndex((a, j) => a !== MV[j]);
      const changedRow = U_CREASES.indexOf(changed);
      const ru = replay(ms, R5U, uTurns(BAD_MV));
      const end = rpEnd(R5U, N);
      const stepK = (i: number) => win(ms, R5U + i * (RP_STEP + RP_GAP), RP_STEP);
      const cx = lerp(CX, P5.cx, m), cy = lerp(CY, P5.cy, m), r = lerp(RP, P5.r, m);
      return (
        <g>
          <Zoom k={1 - m}>
            <Paper P={N - 1 - unfold} cx={cx} cy={cy} r={r} fill={lerp(0.12, 1, win(ms, 150, 700))}
              show={BAD_MV} prev={MV} flip={(j) => (j === changed ? flipK : 0)}
              pulse={(j) => { const i = U_CREASES.indexOf(j); return i < 0 ? 0 : bump(stepK(i)); }} />
            <Layers k={() => 1} opacity={out} />
            <WalkPath prog={() => 1} arcOp={0.4} opacity={out} />
            <StartRing op={out} close={1} />
            {out > 0 && <Walker x={START[0]} y={START[1]} h={H0} s={out} />}
          </Zoom>
          {U_CREASES.map((c, i) => <UGlyph key={c} cx={cx} cy={cy} r={r} c={c} a={BAD_MV[c]} k={stepK(i)} />)}
          <Dial cum={ms < R5U ? 360 : ru.cum} trace={ms < R5U ? U_TRACE : sampleTrace(repCum(R5U, uTurns(BAD_MV)), R5U, end, ms)}
            traceOp={ms < R5U ? out : 1} traceCol={ms < R5U ? OK : ms >= end ? BAD : INK2} closed={ms < R5U ? 1 : 0} />
          <Readout cum={ms < R5U ? 360 : ru.cum} valOp={ms < R5U ? out : win(ms, R5U - 120, 200, E.out)} color={ms >= end ? BAD : ms < R5U ? OK : INK}
            sub={ms < R5U ? tr('1바퀴 감김 ✓', 'wound once ✓') : tr('0바퀴 감김 ✗', 'wound 0 times ✗')} subColor={ms < R5U ? OK : BAD}
            subK={ms < R5U ? out : win(ms, end + 150, 320, E.out)} />
          <g opacity={out}>
            <Head col={COL1} text={tr('호 (arc)', 'arcs')} op={1} />
            {TH.map((_, i) => <ArcRow key={'a' + i} i={i} enter={1} />)}
            <Total col={COL1} value={fmt(sum(ARC_TURNS))} color={INK3} k={1} />
          </g>
          <Head col={COL2} text={tr('U턴', 'U-turns')} op={1} hi={inOut(ms, R5U - 200, 200, end, 300)} />
          {TH.map((_, i) => <URow key={'u' + i} i={i} mv={BAD_MV} prev={MV} flip={i === changedRow ? flipK : 0} enter={1} hi={ru.hi[i]} />)}
          <Total col={COL2} value={fmt(sum(uTurns(MV)))} color={OK} k={1 - win(ms, 1550, 220, E.in)} />
          <Total col={COL2} value={`${fmt(sum(uTurns(BAD_MV)))} ✗`} color={BAD} k={win(ms, end + 120, 320, E.out)} />
          <Verdict mv={BAD_MV} prev={MV} flip={flipK} k={1} pulse={win(ms, ACC5, 350, E.linear)} />
          <Theorem k={win(ms, end + 800, 400, E.out)} />
        </g>
      );
    },
  },
  {
    duration: D6, lead: LEADJ, join: 'none', view: 'side', viewNote: () => tr('개념도: 원둘레를 펴서 본 단면 (왼쪽 종이는 위에서)', 'diagram: the rim cut open and straightened (paper on the left from above)'),
    beats: beats('s6', B6, D6), caption: caption('s6'),
    draw: (t) => {
      const ms = t * D6;
      const out = 1 - win(ms, 0, 180, E.in);
      const m = win(ms, 0, 600, E.inOut3);
      const cx = lerp(P5.cx, P6.cx, m), cy = lerp(P5.cy, P6.cy, m), r = lerp(P5.r, P6.r, m);
      // back to the real vertex first (crease 4 V again), then the mountain moves from crease 2 to crease 3
      const back = win(ms, 250, 450);
      const swap = win(ms, SW6, 450);
      const shown = ms < SW6 + 225 ? MV : WRONG_MV;
      const flipOf = (j: number) => (ms < 1000 ? (BAD_MV[j] !== MV[j] ? back : 0) : WRONG_MV[j] !== MV[j] ? swap : 0);
      const prevOf: readonly A[] = ms < 1000 ? BAD_MV : MV;
      const showOf: readonly A[] = ms < 1000 ? MV : WRONG_MV;
      // the section: draw, swing arrows, then fold
      const mk = win(ms, M6, M6D, E.inOut);
      const drawK = ms >= M6E ? 1 : 0;
      const bandK = win(ms, 550, 450, E.inOut);
      const labels = win(ms, M6E, 300, E.out) * (1 - win(ms, M6E + 650, 250, E.in));
      const phase2 = ms >= SW6;
      const la = (phase2 ? WRONG_MV : MV)[SMALL], lb = (phase2 ? WRONG_MV : MV)[RIGHT];
      const F2 = HIT6 - 1000;
      let tau = 0;
      if (!phase2) tau = 180 * win(ms, M6E + 650, 1200, E.inOut) * (1 - win(ms, M6E + 2350, 450, E.out));
      else {
        tau = TAU_C * cl((ms - F2) / 1000) ** 2;
        // after the hit the flaps bounce back twice (3°, then 1.5°, 140 ms each) and settle: only away from contact, never through it
        if (ms > HIT6) { const u = (ms - HIT6) / BOUNCE_MS, n = Math.floor(u); tau = n < BOUNCE.length ? TAU_C - BOUNCE[n] * Math.sin(Math.PI * (u - n)) : TAU_C; }
      }
      const swing = phase2 ? win(ms, F2 - 450, 380, E.out) * (1 - win(ms, F2 - 50, 200, E.in)) : win(ms, M6E + 200, 380, E.out) * (1 - win(ms, M6E + 600, 200, E.in));
      const hitK = win(ms, HIT6, 250, E.out);
      const wedgeK = win(ms, 550, 400, E.out);
      // after the hit, the two neighbours light up on the paper too: these are the sectors that ran into each other
      const nb = win(ms, HIT6 + 2 * BOUNCE_MS, 250, E.out);
      const nbPulse = bump(win(ms, PULSE6, 500, E.linear));
      const ringOp = 1 - 0.3 * win(ms, HIT6 + 250, 400);
      const v = count(shown, 'V'), mm = count(shown, 'M');
      return (
        <g>
          <Paper cx={cx} cy={cy} r={r} show={showOf} prev={prevOf} flip={flipOf} />
          {/* the small sector, and the stretch of rim that is straightened on the right */}
          <path d={wedge(cx, cy, r, RAYS[SMALL], RAYS[SMALL] + TH[SMALL])} fill={MARK} opacity={0.45 * wedgeK} />
          {[LEFT, RIGHT].map((i) => nb > 0 && <path key={i} d={wedge(cx, cy, r, RAYS[i], RAYS[i] + TH[i])} fill={BAD} opacity={0.5 * (0.35 * nb + 0.25 * nbPulse)} />)}
          {bandK > 0 && <path d={arc(cx, cy, r * BAND, RAYS[LEFT] - 360, lerp(RAYS[LEFT] - 360, RAYS[RIGHT] + TH[RIGHT], bandK))} fill="none" stroke={INK2} strokeWidth={2} strokeDasharray="3 3" />}
          {/* a copy of that stretch of rim unrolls into the straight section, lengths in the sectors' ratio */}
          {mk > 0 && mk < 1 && <Unroll k={mk} cx={cx} cy={cy} rr={r * BAND} />}
          <Label x={P6.cx} y={210} size={14} weight={600} color="var(--color-mark-ink)" rise={wedgeK}>{tr(`작은 섹터 θ_${SMALL + 1} = ${TH[SMALL]}°`, `small sector θ_${SMALL + 1} = ${TH[SMALL]}°`)}</Label>
          <Label x={P6.cx} y={238} size={15} weight={700} color={Math.abs(v - mm) === 2 ? OK : BAD} rise={win(ms, 900, 300, E.out)}>{`V ${v} · M ${mm}  ${Math.abs(v - mm) === 2 ? '✓' : '✗'}`}</Label>

          {/* the right panel of the last scene leaves to the right */}
          {out > 0.001 && <g opacity={out} transform={`translate(${(20 * (1 - out)).toFixed(2)} 0)`}><Panel5 glyph={0} /></g>}
          {out > 0.001 && <g opacity={out}>{U_CREASES.map((c) => <UGlyph key={c} cx={cx} cy={cy} r={r} c={c} a={BAD_MV[c]} k={1} />)}</g>}

          <Section draw={drawK} labels={labels} la={la} lb={lb} tauA={tau} tauB={tau} swing={swing} />
          <Label x={(SA + SB) / 2 + 10} y={256} size={15} weight={700} color={OK} rise={win(ms, M6E + 1850, 320, E.out)} opacity={phase2 ? 0.45 : 1}>
            {tr(`${MV[SMALL]} · ${MV[RIGHT]} → Z자로 포개짐 ✓`, `${MV[SMALL]} · ${MV[RIGHT]} → nests as a Z ✓`)}
          </Label>
          {hitK > 0 && (
            <g>
              <circle cx={CONTACT[0]} cy={CONTACT[1]} r={14 * hitK} fill="none" stroke={BAD} strokeWidth={2.6} opacity={ringOp} />
              <Label x={CONTACT[0] + 20} y={CONTACT[1] - 8} anchor="start" size={18} weight={700} color={BAD} opacity={hitK}>✗</Label>
            </g>
          )}
          <Label x={(SA + SB) / 2 + 10} y={50} size={16} weight={700} color={BAD} rise={win(ms, HIT6 + 50, 320, E.out)}>
            {tr(`${WRONG_MV[SMALL]} · ${WRONG_MV[RIGHT]} → 큰 두 섹터가 부딪침 ✗`, `${WRONG_MV[SMALL]} · ${WRONG_MV[RIGHT]} → the big sectors collide ✗`)}
          </Label>
        </g>
      );
    },
  },
];
