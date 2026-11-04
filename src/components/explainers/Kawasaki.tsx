import type { ReactNode } from 'react';
import { tr } from '../../i18n';
import { arc, BAD, E, EVEN, INK, INK2, INK3, Label, lerp, MARK, MOUNTAIN, ODD, OK, pt, rad, steps, VALLEY, wedge, type Scene } from './Explainer';
import { foldPlan, FoldedVertex, FRONT, LAYER_OFF, levels, type MV } from './FoldedVertex';

/*
 * Kawasaki's theorem, told as one object: the rims of the folded paper.
 * Every number on screen is computed from TH / TH_BAD and the fold plan.
 *
 * Time inside a scene is in milliseconds (ms = t × duration), so the beats
 * read as a timeline: hinge 250 ms → fold → settle, arcs, then their terms.
 */

const TH = [70, 100, 110, 80] as const;
/** how far crease 2 is moved for the vertex that fails */
const SHIFT = 20;
/** the broken vertex: θ1 + 20°, θ2 − 20° */
const TH_BAD = [TH[0] + SHIFT, TH[1] - SHIFT, TH[2], TH[3]] as const;
/** the same mountain/valley assignment as the Maekawa explainer, so both show the same folded paper */
const MVK: readonly MV[] = ['V', 'M', 'V', 'V'];
const N = TH.length;
const CY = 150, R = 105;
/** the view pans a little as the paper folds, so the folded stack sits in the middle */
const cxAt = (P: number) => 240 - 40 * Math.min(1, Math.max(0, P) / 3);
const CXF = cxAt(3);
const col = (i: number) => (i % 2 === 0 ? ODD : EVEN);
const startsOf = (th: readonly number[]) => th.reduce<number[]>((a, x) => [...a, a[a.length - 1] + x], [0]).slice(0, th.length);
/** the walk: direction after each sector, turning +θ1, −θ2, +θ3, −θ4 */
const phiOf = (th: readonly number[]) => th.reduce<number[]>((a, x, i) => [...a, a[a.length - 1] + (i % 2 === 0 ? x : -x)], [0]);
const altSum = (th: readonly number[]) => phiOf(th)[th.length];
const oddSum = (th: readonly number[]) => th.reduce((s, x, i) => s + (i % 2 === 0 ? x : 0), 0);
const evenSum = (th: readonly number[]) => th.reduce((s, x, i) => s + (i % 2 === 1 ? x : 0), 0);
const total = (th: readonly number[]) => th.reduce((s, x) => s + x, 0);
const deg = (x: number) => `${Math.round(x)}°`;

// ───────────────────────────── time helpers (ms)

const cl = (x: number) => Math.min(1, Math.max(0, x));
/** progress over [a, a + d] through an ease */
const win = (ms: number, a: number, d: number, e: (x: number) => number = E.inOut) => e((ms - a) / d);
/** a quick exit starting at a: 1 → 0 (expo.in) */
const gone = (ms: number, a: number, d = 220) => 1 - E.in((ms - a) / d);
/** a single hump 0 → 1 → 0 over [a, a + d] */
const bump = (ms: number, a: number, d: number) => (ms <= a || ms >= a + d ? 0 : Math.sin((Math.PI * (ms - a)) / d));
/** a 350 ms scale accent starting at a: up with back.out(1.6), then back down; 0 outside */
const accent = (ms: number, a: number) => {
  const x = (ms - a) / 350;
  if (x <= 0 || x >= 1) return 0;
  return x < 0.5 ? E.back(1.6)(x / 0.5) : 1 - E.inOut((x - 0.5) / 0.5);
};
/** arrival of a label (for `rise`) */
const arrive = (ms: number, a: number, d = 300) => E.out((ms - a) / d);

/**
 * Fold beats: fold k runs over [starts[k], starts[k] + len]; the hinge lights 300 ms before it.
 * Returns the fold progress (0 … folds), the hinge highlight, and when the last fold landed.
 */
function drive(ms: number, fs: number[], len: number, hl = 300) {
  let P = 0, hinge = 0, landed = -1e9;
  fs.forEach((s) => {
    P += E.inOut((ms - s) / len);
    if (ms >= s - hl && ms < s + len) hinge = Math.max(hinge, E.out((ms - s + hl) / (hl * 0.8)));
    if (ms >= s + len) landed = s + len;
  });
  return { P, hinge, landed };
}

/** a camera push-in: scale s about the origin plus a shift, eased in by k (0 = no zoom) */
interface Zoom { s: number; tx: number; ty: number }
const camT = (z: Zoom, k: number) => `translate(${(z.tx * k).toFixed(2)} ${(z.ty * k).toFixed(2)}) scale(${(1 + (z.s - 1) * k).toFixed(4)})`;
/** scene 2: the folded stack (vertex at 200, 150) is framed at 1.2× with its vertex at (160, 175) */
const Z2: Zoom = { s: 1.2, tx: 160 - 1.2 * 200, ty: 175 - 1.2 * 150 };
/** scene 5: the changed stack (it fans upwards, 0°…120°) at 1.3× with its vertex at (180, 219) */
const Z5: Zoom = { s: 1.3, tx: 180 - 1.3 * 200, ty: 219 - 1.3 * 150 };

// ───────────────────────────── geometry of the folded paper

/** where the start of crease j sits (radius rho) with the paper folded P creases deep; the same maths as FoldedVertex */
function rayXY(th: readonly number[], P: number, j: number, rho: number, cx: number): [number, number] {
  const plan = foldPlan(th, MVK);
  const maxP = th.length - 1;
  const PP = Math.min(maxP, Math.max(0, P));
  let k = Math.floor(PP), p = PP - k;
  if (k >= maxP) { k = maxP - 1; p = 1; }
  const b = plan.states[k][j];
  const al = b.s * plan.starts[j] + b.c;
  if (!(p > 0 && j >= k + 1)) return [cx + rho * Math.cos(rad(al)), CY - rho * Math.sin(rad(al))];
  const psi = plan.axes[k];
  const rel = rad(al - psi);
  const u = rho * Math.cos(rel), v = rho * Math.sin(rel) * Math.cos(Math.PI * p);
  const ps = rad(psi);
  return [cx + u * Math.cos(ps) - v * Math.sin(ps), CY - (u * Math.sin(ps) + v * Math.cos(ps))];
}

/** push badges apart so two creases that end close together never stack their numbers */
function spread(ps: [number, number][], min = 34): [number, number][] {
  const q = ps.map((p) => [...p] as [number, number]);
  for (let it = 0; it < 3; it++) {
    for (let a = 0; a < q.length; a++) for (let b = a + 1; b < q.length; b++) {
      const dx = q[b][0] - q[a][0], dy = q[b][1] - q[a][1];
      const d = Math.hypot(dx, dy);
      if (d >= min) continue;
      const ux = d > 1e-6 ? dx / d : 1, uy = d > 1e-6 ? dy / d : 0;
      const m = (min - d) / 2;
      q[a][0] -= ux * m; q[a][1] -= uy * m; q[b][0] += ux * m; q[b][1] += uy * m;
    }
  }
  return q;
}

/** radius of each sector's rim in the folded stack (layers are offset so they can be counted) */
const rimR = (th: readonly number[]) => levels(foldPlan(th, MVK), th.length - 1).map((l) => R - LAYER_OFF * l);
/** radius of each arc of the walk once the rims are pulled apart */
const rk = (i: number) => 46 + 17 * i;

// ───────────────────────────── pieces

/** a numbered badge at the end of a crease; `lit` when the walk turns there, `ok` when the walk closes on it */
function Badge({ n, x, y, op = 1, lit = 0, pop = 0, ok = 0 }: { n: number; x: number; y: number; op?: number; lit?: number; pop?: number; ok?: number }) {
  if (op <= 0.01) return null;
  const s = 1 + 0.3 * pop;
  return (
    <g opacity={op} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${s.toFixed(3)})`}>
      <circle r={11} fill="var(--color-paper)" />
      {lit > 0 && <circle r={11} fill={MARK} opacity={0.75 * lit * (1 - ok)} />}
      {ok > 0 && <circle r={11} fill={OK} opacity={ok} />}
      <circle r={11} fill="none" stroke={ok > 0.5 ? OK : INK} strokeWidth={1.4 + 1.1 * Math.max(lit, ok)} />
      <Label x={0} y={5} size={14} weight={700} color={ok > 0.5 ? 'var(--color-paper)' : INK}>{String(n)}</Label>
    </g>
  );
}

/** the four crease badges, following the creases as the paper folds */
function Badges({ th, P, cx, op = 1, lit, pop, ok }: {
  th: readonly number[]; P: number; cx: number; op?: number | ((j: number) => number); lit?: (j: number) => number; pop?: (j: number) => number; ok?: (j: number) => number;
}) {
  const ps = spread(th.map((_, j) => rayXY(th, P, j, R + 17, cx)));
  return (
    <g>
      {ps.map(([x, y], j) => (
        <Badge key={j} n={j + 1} x={x} y={y} op={typeof op === 'number' ? op : op(j)} lit={lit?.(j) ?? 0} pop={pop?.(j) ?? 0} ok={ok?.(j) ?? 0} />
      ))}
    </g>
  );
}

/** the paper at the vertex seen from above, flat (P = 0) or folded P creases deep */
function Stack({ th = TH, P, cx = cxAt(P), fill = 1, rim = 1, hinge = 0, cut = false }: {
  th?: readonly number[]; P: number; cx?: number; fill?: number; rim?: number; hinge?: number; cut?: boolean;
}) {
  return (
    <FoldedVertex th={th} mv={MVK} cx={cx} cy={CY} r={R} progress={P} fill={fill} hinge={hinge}
      edgeStyle={(j) => (j === 0 && cut ? { stroke: INK, width: 2, dash: '4 5' } : { stroke: INK, width: 2 })}
      rim={col} rimOpacity={rim} />
  );
}

/** sector-angle labels on the flat sheet; the values are computed from the angles shown */
function SectorLabels({ th, cx, k }: { th: readonly number[]; cx: number; k: (i: number) => number }) {
  const s = startsOf(th);
  return (
    <g>
      {th.map((x, i) => {
        const [lx, ly] = pt(cx, CY, R * 0.6, s[i] + x / 2);
        return <Label key={i} x={lx} y={ly + 5} color={col(i)} weight={700} rise={k(i)}>{`θ_${i + 1} = ${deg(x)}`}</Label>;
      })}
    </g>
  );
}

/** a pair of scissors, tip pointing along `ang` (screen degrees, counter-clockwise), `snip` opens the blades */
function Scissors({ x, y, ang, snip, op }: { x: number; y: number; ang: number; snip: number; op: number }) {
  if (op <= 0.01) return null;
  const a = 0.1 + 0.28 * snip;
  const c = Math.cos(a), s = Math.sin(a);
  return (
    <g opacity={op} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${(-ang).toFixed(2)})`} stroke={INK2} strokeLinecap="round" fill="var(--color-paper)">
      <line x1={-9 * c} y1={9 * s} x2={16 * c} y2={-16 * s} strokeWidth={2.4} />
      <line x1={-9 * c} y1={-9 * s} x2={16 * c} y2={16 * s} strokeWidth={2.4} />
      <circle cx={-12 * c} cy={12 * s + 3.2} r={3.6} strokeWidth={2} />
      <circle cx={-12 * c} cy={-12 * s - 3.2} r={3.6} strokeWidth={2} />
      <circle r={1.4} fill={INK2} stroke="none" />
    </g>
  );
}

/** cutting crease 1 from the rim in to the vertex: a dashed cut follows the scissors */
function Cut({ cx, k, op = 1 }: { cx: number; k: number; op?: number }) {
  const x0 = cx + R + 2;
  const tip = lerp(cx + R + 16, cx + 4, k);
  const xs = Math.min(x0, tip);
  return (
    <g>
      {k > 0 && (
        <g strokeLinecap="butt">
          <line x1={x0} y1={CY} x2={xs} y2={CY} stroke="var(--color-paper)" strokeWidth={3.6} />
          <line x1={x0} y1={CY} x2={xs} y2={CY} stroke={INK} strokeWidth={2} strokeDasharray="4 5" />
        </g>
      )}
      {/* tip points at the vertex (180°), the pivot trails behind it */}
      <Scissors x={tip + 16} y={CY - 0.5} ang={180} snip={0.5 + 0.5 * Math.sin(k * Math.PI * 7)} op={op} />
    </g>
  );
}

/** the green seam where the far edge lands on crease 1, drawn out from the vertex */
function Seam({ cx, k, op = 1 }: { cx: number; k: number; op?: number }) {
  if (k <= 0 || op <= 0.01) return null;
  return <line x1={cx} y1={CY} x2={cx + (R + 8) * k} y2={CY} stroke={OK} strokeWidth={4.5} strokeLinecap="round" opacity={op} />;
}

/** the red gap from the far edge back to crease 1; the arc sweeps it, then its (final) size fades in */
function Gap({ cx, far, k, op = 1, lr = 24 }: { cx: number; far: number; k: number; op?: number; lr?: number }) {
  if (k <= 0 || op <= 0.01) return null;
  const rg = 109;
  // bearing pulled toward crease 2, clear of badge 3 (which sits just above crease 1)
  const [nx, ny] = pt(cx, CY, rg + lr, far * 0.82);
  return (
    <g opacity={op}>
      <path d={wedge(cx, CY, rg, 0, far)} fill={BAD} fillOpacity={0.13 * Math.min(1, 2 * k)} />
      <line x1={cx} y1={CY} x2={pt(cx, CY, rg + 4, far)[0]} y2={pt(cx, CY, rg + 4, far)[1]} stroke={BAD} strokeWidth={3} strokeLinecap="round" opacity={Math.min(1, 3 * k)} />
      <path d={arc(cx, CY, rg, far, far * (1 - k))} fill="none" stroke={BAD} strokeWidth={3.5} strokeLinecap="round" />
      {/* the arc does the counting; the size is only written, at its true value, as the arc nearly closes */}
      <Label x={nx + 4} y={ny + 6} anchor="start" size={17} weight={700} color={BAD} opacity={cl((k - 0.75) / 0.25)}>{deg(far)}</Label>
    </g>
  );
}

// ───────────────────────────── the walk

const LIFT_D = 1000, LIFT_STAGGER = 140;
interface WalkTiming { lift: number; s0: number; arc: number; hop: number; last: number }
/** start and end of arc i of the walk */
const arcStart = (T: WalkTiming, i: number) => T.s0 + i * (T.arc + T.hop);
const arcEnd = (T: WalkTiming, i: number) => arcStart(T, i) + (i === N - 1 ? T.last : T.arc);
/**
 * The last arc: it speeds up, then its final 15° settle with expo.out onto the end.
 * The two pieces meet with the same speed (power2.in, then expo.out whose start slope is 10·ln 2).
 */
function landEase(t: number, L: number) {
  t = cl(t);
  const A = Math.max(0, (L - 15) / L);
  if (A <= 0) return E.out(t);
  const a = (2 * A) / (2 * A + 10 * Math.LN2 * (1 - A));
  return t < a ? A * (t / a) ** 2 : A + (1 - A) * E.out((t - a) / (1 - a));
}
/** where the walker is: how much of each arc is painted, its direction and radius */
function walkAt(th: readonly number[], T: WalkTiming, ms: number) {
  const phi = phiOf(th);
  const painted = th.map((x, i) => (i === N - 1 ? landEase((ms - arcStart(T, i)) / T.last, x) : E.inOut((ms - arcStart(T, i)) / T.arc)));
  let i = 0;
  for (let j = 0; j < N; j++) if (ms >= arcStart(T, j)) i = j;
  const head = phi[i] + (phi[i + 1] - phi[i]) * painted[i];
  // after an arc, the walker steps out along the crease it turned at, to the next arc
  let r = rk(i);
  if (i < N - 1 && ms > arcEnd(T, i)) r = lerp(rk(i), rk(i + 1), E.inOut((ms - arcEnd(T, i)) / T.hop));
  if (ms < arcStart(T, 0)) r = rk(0);
  return { phi, painted, head: ms < arcStart(T, 0) ? phi[0] : head, r };
}

/**
 * The signature: the coloured rims of the folded stack lift out to the walk's
 * radii, then a walker follows them. Each turn lights the badge of the crease it
 * turns at; the end either lands on crease 1 or stops short of it.
 */
function Walk({ th, T, ms, cx = CXF, mode = 'walk', drop = 0 }: { th: readonly number[]; T: WalkTiming; ms: number; cx?: number; mode?: 'walk' | 'drop' | 'head'; drop?: number }) {
  const rr = rimR(th);
  const { phi, painted, head, r } = walkAt(th, T, ms);
  // each rim travels to its walk radius over LIFT_D ms (power3.out), one sector after another
  const ghost = 1 - 0.68 * win(ms, T.lift + 3 * LIFT_STAGGER + LIFT_D + 100, 300);
  const liftK = (i: number) => E.out3((ms - (T.lift + LIFT_STAGGER * i)) / LIFT_D);
  const started = ms >= T.s0 - 250;
  // the arrowhead stops short of the crease badges (they sit at R + 17)
  const nd = pt(cx, CY, Math.min(r + 14, R - 9), head);
  const nameOp = win(ms, T.s0 - 400, 300, E.out) * gone(ms, arcEnd(T, 0) + 250, 300);
  const nameAt = pt(cx, CY, 42, head + 28);
  const wd = pt(cx, CY, r, head);
  const headOp = win(ms, T.s0 - 250, 250, E.out);
  const dropping = mode === 'drop';
  const pulse = (i: number) => bump(ms, arcEnd(T, i) + 60, 380);
  return (
    <g>
      {/* lifted rims: they leave the stack and settle on their own radius (or drop back into it) */}
      {mode !== 'head' && th.map((_, i) => {
        const k = liftK(i);
        const rad0 = dropping ? lerp(rk(i), rr[i], drop) : lerp(rr[i], rk(i), k);
        const up = dropping ? Math.sin(Math.PI * drop) : Math.sin(Math.PI * k);
        const d = arc(cx, CY, rad0, phi[i], phi[i + 1]);
        return (
          <g key={i}>
            {up > 0.02 && <path d={d} transform={`translate(${2 * up} ${4 * up})`} fill="none" stroke={INK} strokeWidth={4} opacity={0.2 * up} filter="url(#xp-soft)" />}
            <path d={d} fill="none" stroke={col(i)} strokeWidth={dropping ? lerp(4.5, 3.5, drop) : 3.5} strokeLinecap="round" opacity={dropping ? 1 : ghost} />
          </g>
        );
      })}
      {!dropping && (
        <g>
          {/* where the walk starts: along crease 1 */}
          <line x1={cx} y1={CY} x2={cx + 124 * win(ms, T.lift + 850, 400, E.out)} y2={CY} stroke={INK3} strokeWidth={1.6} strokeDasharray="5 4" />
          <Label x={cx + 140} y={CY + 5} anchor="start" size={14} color={INK2} weight={600} rise={arrive(ms, T.lift + 1000)}>{tr('출발 = 크리스 1', 'start = crease 1')}</Label>
          {/* the painted walk */}
          {mode === 'walk' && th.map((_, i) => painted[i] > 0 && (
            <path key={i} d={arc(cx, CY, rk(i), phi[i], phi[i] + (phi[i + 1] - phi[i]) * painted[i])} fill="none" stroke={col(i)} strokeWidth={4.5 + 2 * pulse(i)} strokeLinecap="round" />
          ))}
          {started && (
            <g opacity={headOp}>
              <line x1={cx} y1={CY} x2={nd[0]} y2={nd[1]} stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
              <path d="M0,0 L-9,-4.5 L-9,4.5 Z" fill={INK} transform={`translate(${nd[0].toFixed(2)} ${nd[1].toFixed(2)}) rotate(${(-head).toFixed(2)})`} />
              <circle cx={wd[0]} cy={wd[1]} r={5.5} fill={INK} stroke="var(--color-paper)" strokeWidth={1.5} />
              {/* the needle is named while it walks its first arc */}
              {mode === 'walk' && nameOp > 0.01 && (
                <Label x={nameAt[0] - 4} y={nameAt[1] + 4} anchor="end" size={13} weight={600} color={INK2} opacity={nameOp}>{tr('모서리 방향 →', 'edge direction →')}</Label>
              )}
            </g>
          )}
        </g>
      )}
    </g>
  );
}

// ───────────────────────────── formulas in fixed slots

const W = { theta: 22, op: 21, deg: (v: number) => 10 * String(Math.abs(Math.round(v))).length + 8 };
/**
 * Two rows: θ_1 − θ_2 + θ_3 − θ_4 over 70° − 100° + 110° − 80°. Every term has a fixed
 * column, start-anchored, so nothing jumps when a new term arrives.
 */
function rowLayout(th: readonly number[]) {
  const cols: number[] = [];
  const ws: number[] = [];
  th.forEach((x, i) => {
    if (i > 0) ws.push(W.op);
    ws.push(Math.max(W.theta, W.deg(x)) + 4);
  });
  const eqW = 18 + W.deg(altSum(th)) + 18;
  const totalW = ws.reduce((s, x) => s + x, 0) + eqW;
  let x = 240 - totalW / 2;
  ws.forEach((w) => { cols.push(x + w / 2); x += w; });
  return { cols, eqX: x + 6 };
}
const ROW_A = 254, ROW_B = 282;

/** term i (0-based) is column 2i; its operator is column 2i − 1 */
function EqRows({ th, show, eq, green = 0, bad = false, op = 1, opB = 1, rowA = true }: {
  th: readonly number[]; show: (i: number) => number; eq: number; green?: number; bad?: boolean; op?: number; opB?: number; rowA?: boolean;
}) {
  const { cols, eqX } = rowLayout(th);
  const res = altSum(th);
  const sign = (i: number) => (i % 2 ? '−' : '+');
  return (
    <g opacity={op}>
      {th.map((x, i) => {
        const k = show(i);
        if (k <= 0) return null;
        return (
          <g key={i}>
            {rowA && i > 0 && <Label x={cols[2 * i - 1]} y={ROW_A} size={17} weight={600} rise={k}>{sign(i)}</Label>}
            {rowA && <Label x={cols[2 * i]} y={ROW_A} size={17} weight={700} color={col(i)} rise={k}>{`θ_${i + 1}`}</Label>}
            <g opacity={opB}>
              {i > 0 && <Label x={cols[2 * i - 1]} y={ROW_B} size={16} weight={500} color={INK2} rise={k}>{sign(i)}</Label>}
              <Label x={cols[2 * i]} y={ROW_B} size={16} weight={600} color={INK2} rise={k}>{deg(x)}</Label>
            </g>
          </g>
        );
      })}
      {eq > 0 && (() => {
        const dx = 8 * (1 - eq);
        const c = bad ? BAD : OK;
        return (
          <g>
            {rowA && <Label x={eqX + dx} y={ROW_A} anchor="start" size={17} weight={700} rise={eq} color={bad ? BAD : INK}>{bad ? `= ${deg(res)}` : '= 0'}</Label>}
            {rowA && !bad && <Label x={eqX + dx} y={ROW_A} anchor="start" size={17} weight={700} color={c} opacity={green}>= 0</Label>}
            <g opacity={opB}>
              <Label x={eqX + dx} y={ROW_B} anchor="start" size={16} weight={600} rise={eq} color={bad ? BAD : INK2}>{`= ${deg(res)}`}</Label>
              {!bad && <Label x={eqX + dx} y={ROW_B} anchor="start" size={16} weight={600} color={c} opacity={green}>{`= ${deg(res)}`}</Label>}
            </g>
          </g>
        );
      })()}
    </g>
  );
}

// ───────────────────────────── scene 1: the flat sheet draws itself

const S1 = { D: 5700, sweepA: 2300, sweepB: 4700, gap: 140 };
/** when the sum sweep finishes sector i */
const sweepEnd = (i: number) => {
  const len = (S1.sweepB - S1.sweepA - S1.gap * (N - 1)) / N;
  return S1.sweepA + i * (len + S1.gap) + len;
};
/** 70° + 100° + 110° + 80° = 360°, one term per swept sector */
function SumRow({ k, eq }: { k: (i: number) => number; eq: number }) {
  const ws: number[] = [];
  TH.forEach((x, i) => { if (i > 0) ws.push(22); ws.push(W.deg(x) + 4); });
  const eqW = 18 + W.deg(total(TH));
  const tw = ws.reduce((s, x) => s + x, 0) + eqW;
  let x = 240 - tw / 2;
  const cols = ws.map((w) => { const c = x + w / 2; x += w; return c; });
  return (
    <g>
      {TH.map((v, i) => (
        <g key={i}>
          {i > 0 && <Label x={cols[2 * i - 1]} y={288} size={16} weight={500} color={INK2} rise={k(i)}>+</Label>}
          <Label x={cols[2 * i]} y={288} size={16} weight={700} color={col(i)} rise={k(i)}>{deg(v)}</Label>
        </g>
      ))}
      <Label x={x + 4} y={288} anchor="start" size={16} weight={700} rise={eq}>{`= ${deg(total(TH))}`}</Label>
    </g>
  );
}

/** the marker that sweeps once round the vertex, sector by sector */
function Sweep({ s, op = 1 }: { s: number; op?: number }) {
  if (s <= 0 || op <= 0.01) return null;
  const st = startsOf(TH);
  const k = Math.min(N - 1, Math.floor(s));
  const head = s >= N ? 360 : st[k] + TH[k] * (s - k);
  const [hx, hy] = pt(240, CY, 30, head);
  return (
    <g opacity={op}>
      {TH.map((x, i) => {
        const e = i < k || s >= N ? st[i] + x : i === k ? head : null;
        if (e === null || e - st[i] < 0.3) return null;
        return <path key={i} d={arc(240, CY, 30, st[i], Math.min(e, st[i] + x - 0.01))} fill="none" stroke={col(i)} strokeWidth={3.5} strokeLinecap="round" />;
      })}
      {s < N && <circle cx={hx} cy={hy} r={4} fill={col(k)} stroke="var(--color-paper)" strokeWidth={1.2} />}
    </g>
  );
}

function Flat({ ms }: { ms: number }) {
  const st = startsOf(TH);
  const dot = E.back(2)((ms - 0) / 320);
  const crease = (j: number) => win(ms, 120 + 90 * j, 520, E.out);
  const ring = win(ms, 560, 820);
  const rimK = (i: number) => win(ms, 1300 + 120 * i, 520, E.out);
  const sw = steps(ms, S1.sweepA, S1.sweepB, N, S1.gap);
  const flash = (i: number) => bump(ms, sweepEnd(i) - 500, 700);
  return (
    <g>
      {/* the paper fills in as its edge is drawn round */}
      {ring > 0 && (ring < 1
        ? <path d={wedge(240, CY, R, 0, 360 * ring - 0.01)} fill={FRONT} />
        : <circle cx={240} cy={CY} r={R} fill={FRONT} />)}
      {TH.map((x, i) => flash(i) > 0 && <path key={'f' + i} d={wedge(240, CY, R, st[i], st[i] + x)} fill={col(i)} fillOpacity={0.14 * flash(i)} />)}
      <circle transform={`translate(240 ${CY}) scale(1 -1)`} r={R} fill="none" stroke={INK3} strokeWidth={0.9} pathLength={1} strokeDasharray={`${ring} 1`} />
      {TH.map((x, i) => rimK(i) > 0 && <path key={'r' + i} d={arc(240, CY, R, st[i], st[i] + x * rimK(i))} fill="none" stroke={col(i)} strokeWidth={3.5} strokeLinecap="round" />)}
      {st.map((a, j) => {
        const k = crease(j);
        if (k <= 0) return null;
        const [x, y] = pt(240, CY, R * k, a);
        return <line key={'c' + j} x1={240} y1={CY} x2={x} y2={y} stroke={INK} strokeWidth={2} strokeLinecap="round" />;
      })}
      {dot > 0 && <circle cx={240} cy={CY} r={3.5 * dot} fill={INK} />}
      <SectorLabels th={TH} cx={240} k={(i) => arrive(ms, 1450 + 120 * i, 320)} />
      <Sweep s={sw} />
      <SumRow k={(i) => arrive(ms, sweepEnd(i) + 40, 280)} eq={arrive(ms, sweepEnd(N - 1) + 260, 280)} />
    </g>
  );
}

// ───────────────────────────── scene 2: cut, then fold creases 2, 3, 4 with beats

const S2 = { D: 8400, cut: [400, 1100], folds: [1950, 4250, 5950], len: 1200, seam: 7300 };
/** the camera pushes in while the paper folds, so the small folded stack fills the frame */
const camS2 = (ms: number) => win(ms, S2.folds[0] - 250, S2.folds[2] + S2.len - S2.folds[0] + 250, E.sine);
const backLabelPos = () => {
  // the visible part of the turned-over flap after the first fold (between crease 1 and the flap's far side)
  const [x, y] = pt(cxAt(1), CY, 62, -58);
  return { x, y };
};
const CHECK_Y = 284;
const checkText = () => tr('끝 모서리가 크리스 1에 닿았다  ✓', 'the far edge is on crease 1  ✓');

function FoldScene({ ms }: { ms: number }) {
  const { P, hinge, landed } = drive(ms, S2.folds, S2.len);
  const cx = cxAt(P);
  const cutK = win(ms, S2.cut[0], S2.cut[1]);
  const cutDone = cutK >= 1;
  const seam = win(ms, S2.seam, 380, E.out);
  const landFlash = landed > 0 ? bump(ms, landed, 260) : 0;
  const back = backLabelPos();
  // crease 2 is a mountain: the flap goes under sector 1
  // on sector 1's side of crease 2, which stays still while the flap swings under
  const [ux, uy] = [cx + 30, CY - 50];
  return (
    <g>
      <g transform={camT(Z2, camS2(ms))}>
        <Stack P={P} cx={cx} hinge={hinge} cut={cutDone} rim={1 - 0.4 * landFlash} />
        {!cutDone && <Cut cx={cx} k={cutK} op={arrive(ms, S2.cut[0] - 300)} />}
        {cutDone && <Scissors x={cx + 20 - 30 * win(ms, S2.cut[0] + S2.cut[1], 300)} y={CY - 0.5} ang={180} snip={1} op={gone(ms, S2.cut[0] + S2.cut[1], 260)} />}
        <Label x={cx + 76} y={CY - 10} size={14} weight={600} color={INK2} rise={arrive(ms, 1200) * gone(ms, S2.seam - 100)}>{tr('자름', 'cut')}</Label>
        {/* two short lines, so the label fits inside sector 1 and crosses no rim */}
        {[tr('산접기:', 'mountain:'), tr('아래로', 'tucks under')].map((txt, i) => (
          <Label key={'mv' + i} x={ux} y={uy + 18 * i} anchor="start" size={14} weight={700} color={MOUNTAIN} rise={arrive(ms, S2.folds[0] - 250) * gone(ms, S2.folds[0] + S2.len + 150, 250)}>{txt}</Label>
        ))}
        <Label x={back.x} y={back.y} size={14} weight={600} color={INK2} rise={arrive(ms, S2.folds[0] + S2.len + 60) * gone(ms, S2.folds[1] - 250)}>{tr('뒷면', 'back')}</Label>
        <SectorLabels th={TH} cx={240} k={() => gone(ms, 1500, 260)} />
        <Sweep s={N} op={gone(ms, 0, 240)} />
        <g opacity={gone(ms, 0, 240)}><SumRow k={() => 1} eq={1} /></g>
        <Seam cx={cx} k={seam} />
        <Badges th={TH} P={P} cx={cx} op={(j) => arrive(ms, 120 + 90 * j, 320)} pop={(j) => bump(ms, 120 + 90 * j, 320)} />
      </g>
      <Label x={240} y={CHECK_Y} size={16} weight={700} color={OK} rise={arrive(ms, S2.seam + 380)}>{checkText()}</Label>
    </g>
  );
}

// ───────────────────────────── scene 3: the rims become the walk

const S3: { D: number; T: WalkTiming } = { D: 9050, T: { lift: 350, s0: 2000, arc: 1050, hop: 300, last: 1500 } };
const S3_LAND = arcEnd(S3.T, N - 1);

/**
 * The walk over the folded stack. `zoom` is the camera of the scene before, eased out at the start.
 * `extras` draws only what leaves at the next scene (needle, badges and what `after` adds).
 */
function WalkScene({ ms, th, T, landAt, after, zoom, extras = false }: {
  ms: number; th: readonly number[]; T: WalkTiming; landAt: number; after: ReactNode; zoom?: Zoom; extras?: boolean;
}) {
  const P = 3;
  const fill = 1 - 0.72 * win(ms, 100, 600);
  const phiEnd = altSum(th);
  const closes = Math.abs(phiEnd) < 0.5;
  // the badge of the crease the walk turns at lights when it gets there
  const turnAt = (j: number) => (j === 0 ? landAt : arcEnd(T, j - 1));
  const zk = zoom ? 1 - win(ms, 0, 1000, E.inOut3) : 0;
  return (
    <g transform={zoom ? camT(zoom, zk) : undefined}>
      {!extras && <Stack th={th} P={P} cx={CXF} fill={fill} rim={0} cut />}
      <Walk th={th} T={T} ms={ms} mode={extras ? 'head' : 'walk'} />
      {/* seams and gaps go under the badges, so the crease numbers stay whole */}
      {after}
      <Badges th={th} P={P} cx={CXF}
        op={(j) => (ms >= turnAt(j) ? 1 : 1 - 0.4 * win(ms, 100, 400))}
        lit={(j) => win(ms, turnAt(j), 200, E.out) * (j === 0 && !closes ? 0 : 1)}
        pop={(j) => (j === 0 && !closes ? 0 : bump(ms, turnAt(j), 360))}
        ok={(j) => (j === 0 && closes ? win(ms, landAt + 100, 300, E.out) : 0)} />
    </g>
  );
}

function GoodWalkScene({ ms }: { ms: number }) {
  const T = S3.T;
  return (
    <g>
      <WalkScene ms={ms} th={TH} T={T} landAt={S3_LAND} zoom={Z2} after={
        <g>
          <Seam cx={CXF} k={1} op={gone(ms, 0, 300)} />
          <Seam cx={CXF} k={win(ms, S3_LAND + 60, 350, E.out)} />
        </g>
      } />
      <Label x={240} y={CHECK_Y} size={16} weight={700} color={OK} opacity={gone(ms, 0, 220)}>{checkText()}</Label>
      <EqRows th={TH} show={(i) => arrive(ms, arcEnd(T, i) + 80, 280)} eq={arrive(ms, S3_LAND + 450, 280)} green={win(ms, S3_LAND + 800, 300)} />
      <Label x={rowLayout(TH).cols[0] - 12} y={228} anchor="start" size={14} weight={700} color={OK} rise={arrive(ms, S3_LAND + 1000)}>{tr('Kawasaki 정리', 'Kawasaki\'s theorem')}</Label>
    </g>
  );
}

// ───────────────────────────── scene 4: unfold and gather

const S4 = { D: 7600, unfold: [1100, 2600], gather: [2750, 4450], regroup: [4550, 800], l2: 5600, l3: [6100, 6500] };
const GCX = 128;
/** the regrouped formula's tokens; widths are for 16-unit text */
const TOK_W = { th: 21, op: 21, par: 8, eq: 34 };
type Tok = { id: string; w: number };
const LAY_C: Tok[] = [
  { id: 't0', w: TOK_W.th }, { id: 'o1', w: TOK_W.op }, { id: 't1', w: TOK_W.th }, { id: 'o2', w: TOK_W.op },
  { id: 't2', w: TOK_W.th }, { id: 'o3', w: TOK_W.op }, { id: 't3', w: TOK_W.th }, { id: 'eq', w: TOK_W.eq },
];
const LAY_G: Tok[] = [
  { id: 'pa', w: TOK_W.par }, { id: 't0', w: TOK_W.th }, { id: 'o2', w: TOK_W.op }, { id: 't2', w: TOK_W.th }, { id: 'pb', w: TOK_W.par },
  { id: 'o1', w: TOK_W.op },
  { id: 'pc', w: TOK_W.par }, { id: 't1', w: TOK_W.th }, { id: 'o3', w: TOK_W.op }, { id: 't3', w: TOK_W.th }, { id: 'pd', w: TOK_W.par },
  { id: 'eq', w: TOK_W.eq },
];
const RX = 262, RY1 = 100;
const place = (lay: Tok[]) => {
  const m: Record<string, number> = {};
  let x = RX;
  lay.forEach((t) => { m[t.id] = t.id === 'eq' ? x + 4 : x + t.w / 2; x += t.w; });
  return m;
};
const POS_C = place(LAY_C), POS_G = place(LAY_G);

/**
 * The formula on the right: it arrives from the walk's row, then regroups in three steps,
 * each one leaving a true formula behind:
 *   1. "+ θ₃" arcs over θ₂ into its new place:   θ₁ + θ₃ − θ₂ − θ₄ = 0
 *   2. the first brackets rise:                 (θ₁ + θ₃) − θ₂ − θ₄ = 0
 *   3. the second brackets rise while the last − grows into +:  (θ₁ + θ₃) − (θ₂ + θ₄) = 0
 */
const RG = { move: S4.regroup[0], moveD: 350, first: S4.regroup[0] + 450, second: S4.regroup[0] + 750 };
function GatherText({ ms }: { ms: number }) {
  const mv = win(ms, 150, 650, E.inOut3);
  const up = win(ms, 750, 600, E.inOut3);
  const rg = win(ms, RG.move, RG.moveD, E.inOut);
  const { cols, eqX } = rowLayout(TH);
  const from: Record<string, [number, number]> = { t0: [cols[0], ROW_A], o1: [cols[1], ROW_A], t1: [cols[2], ROW_A], o2: [cols[3], ROW_A], t2: [cols[4], ROW_A], o3: [cols[5], ROW_A], t3: [cols[6], ROW_A], eq: [eqX, ROW_A] };
  // θ₃ and its sign jump over θ₂ on an arc; nothing else changes order
  const swap: Record<string, number> = { t2: -18, o2: -18 };
  const at = (id: string): [number, number] => {
    const c = lerp(from[id][0], POS_C[id], mv), y = lerp(from[id][1], RY1, up);
    return [lerp(c, POS_G[id], rg), y + (swap[id] ?? 0) * Math.sin(Math.PI * rg)];
  };
  const size = lerp(17, 16, mv);
  const par1 = arrive(ms, RG.first, 200);
  const par2 = arrive(ms, RG.second, 220);
  const plus = par2;
  return (
    <g>
      {(['t0', 't1', 't2', 't3'] as const).map((id, i) => { const [x, y] = at(id); return <Label key={id} x={x} y={y} size={size} weight={700} color={col(i)}>{`θ_${i + 1}`}</Label>; })}
      {(['o1', 'o2', 'o3'] as const).map((id, i) => {
        const [x, y] = at(id);
        const minus = i % 2 === 0;
        return (
          <g key={id}>
            <Label x={x} y={y} size={size} weight={600}>{minus ? '−' : '+'}</Label>
            {/* the last minus turns into a plus inside the brackets: its vertical bar grows */}
            {id === 'o3' && plus > 0 && <line x1={x} y1={y - 5.6 - 5 * plus} x2={x} y2={y - 5.6 + 5 * plus} stroke={INK} strokeWidth={1.9} />}
          </g>
        );
      })}
      {(['pa', 'pb', 'pc', 'pd'] as const).map((id, i) => <Label key={id} x={POS_G[id]} y={RY1} size={16} weight={500} color={INK2} rise={i < 2 ? par1 : par2}>{i % 2 ? ')' : '('}</Label>)}
      {(() => { const [x, y] = at('eq'); return <Label x={x} y={y} anchor="start" size={size} weight={700} color={OK}>= 0</Label>; })()}
      <Label x={RX} y={142} anchor="start" size={15} weight={600} color={INK2} rise={arrive(ms, S4.l2)}>{tr(`두 묶음을 더하면 ${deg(total(TH))}`, `together: ${deg(total(TH))}`)}</Label>
      <Label x={RX} y={190} anchor="start" size={16} weight={700} color={ODD} rise={arrive(ms, S4.l3[0])}>{`⇒ θ_1 + θ_3 = ${deg(oddSum(TH))}`}</Label>
      <Label x={RX + 20} y={218} anchor="start" size={16} weight={700} color={EVEN} rise={arrive(ms, S4.l3[1])}>{`θ_2 + θ_4 = ${deg(evenSum(TH))}`}</Label>
    </g>
  );
}

function GatherScene({ ms }: { ms: number }) {
  const T = S3.T;
  const out = gone(ms, 0, 240);
  const drop = win(ms, 80, 620, E.inOut3);
  // the folded paper slides left first, so the formula can rise on the right without crossing it
  const cxS = lerp(CXF, GCX, win(ms, 200, 600, E.inOut3));
  const fill = 0.28 + 0.72 * win(ms, 100, 600);
  const unf = steps(ms, S4.unfold[0], S4.unfold[1], 3, 120);
  const P = 3 - unf;
  const flatDone = unf >= 3;
  const g = win(ms, S4.gather[0], S4.gather[1] - S4.gather[0], E.inOut3);
  const tint = win(ms, S4.gather[0], 600);
  // sector labels step aside while the sectors move, and come back where they land
  const labels = flatDone ? arrive(ms, S4.unfold[1] + 40) * gone(ms, S4.gather[0] - 170, 150) + arrive(ms, S4.gather[1] + 40, 250) : 0;
  const pulseTop = bump(ms, S4.l3[0], 700), pulseBot = bump(ms, S4.l3[1], 700);
  return (
    <g>
      {!flatDone ? (
        <g>
          <Stack P={P} cx={cxS} fill={fill} rim={drop >= 1 ? 1 : 0} cut />
          {drop < 1 && <Walk th={TH} T={T} ms={1e9} cx={cxS} mode="drop" drop={drop} />}
        </g>
      ) : (
        <Gather cx={GCX} k={g} tint={tint} labels={labels} pulseTop={pulseTop} pulseBot={pulseBot} />
      )}
      {/* what leaves: the walker, the badges and the number row */}
      {out > 0.01 && (
        <g opacity={out}>
          <Walk th={TH} T={T} ms={1e9} cx={CXF} mode="head" />
          <Seam cx={CXF} k={1} />
          <Badges th={TH} P={3} cx={CXF} lit={() => 1} ok={(j) => (j === 0 ? 1 : 0)} />
          <Label x={rowLayout(TH).cols[0] - 12} y={228} anchor="start" size={14} weight={700} color={OK}>{tr('Kawasaki 정리', 'Kawasaki\'s theorem')}</Label>
          <EqRows th={TH} show={() => 1} eq={1} green={1} rowA={false} />
        </g>
      )}
      <GatherText ms={ms} />
    </g>
  );
}

/** the sectors cut out and moved: odd ones make the top half, even ones the bottom half */
function Gather({ cx, k, tint, labels = 1, pulseTop = 0, pulseBot = 0 }: { cx: number; k: number; tint: number; labels?: number; pulseTop?: number; pulseBot?: number }) {
  const from = startsOf(TH);
  // odd sectors after one another from 0°, even ones from 180°
  const to = [0, 180, TH[0], 180 + TH[1]];
  const lifted = Math.sin(Math.PI * k);
  const sec = (i: number) => {
    const a0 = lerp(from[i], to[i], k);
    const dy = (i % 2 ? 1 : -1) * 12 * k;
    return { a0, dy };
  };
  // draw the even sectors first, so the odd ones pass over them
  const order = [1, 3, 0, 2];
  return (
    <g>
      {order.map((i) => {
        const { a0, dy } = sec(i);
        const x = TH[i];
        const pulse = i % 2 ? pulseBot : pulseTop;
        return (
          <g key={i} transform={`translate(0 ${dy.toFixed(2)})`}>
            {i % 2 === 0 && lifted > 0.02 && <path d={wedge(cx, CY, R, a0, a0 + x)} transform={`translate(${3 * lifted} ${6 * lifted})`} fill={INK} opacity={0.12 * lifted} filter="url(#xp-soft)" />}
            <path d={wedge(cx, CY, R, a0, a0 + x)} fill={FRONT} stroke={INK3} strokeWidth={0.9} />
            <path d={wedge(cx, CY, R, a0, a0 + x)} fill={col(i)} fillOpacity={0.16 * tint + 0.2 * pulse} />
            <path d={arc(cx, CY, R, a0, a0 + x)} fill="none" stroke={col(i)} strokeWidth={3.5 + 2 * pulse} strokeLinecap="round" />
            {/* crease 1 stays drawn as the cut it is */}
            {[a0, a0 + x].map((a, e) => { const [ex, ey] = pt(cx, CY, R, a); const c1 = (i === 0 && e === 0) || (i === N - 1 && e === 1); return <line key={e} x1={cx} y1={CY} x2={ex} y2={ey} stroke={INK} strokeWidth={2} strokeLinecap="round" strokeDasharray={c1 ? '4 5' : undefined} />; })}
          </g>
        );
      })}
      {k < 1 && <circle cx={cx} cy={CY} r={3.5} fill={INK} opacity={1 - k} />}
      {[0, 1, 2, 3].map((i) => {
        const { a0, dy } = sec(i);
        const [lx, ly] = pt(cx, CY, R * 0.6, a0 + TH[i] / 2);
        return <Label key={'l' + i} x={lx} y={ly + 5 + dy} color={col(i)} weight={700} rise={labels}>{`θ_${i + 1} = ${deg(TH[i])}`}</Label>;
      })}
    </g>
  );
}

// ───────────────────────────── scene 5: a changed vertex does not close

/** the halves go back together, crease 2 turns +20°, then three quick folds (the viewer knows them now) */
const S5 = { D: 8200, ret: [100, 800], morph: [1100, 1400], badges: 2650, folds: [3000, 3800, 4600], len: 650, gap: 5450 };
const camS5 = (ms: number) => win(ms, S5.folds[0] - 200, S5.folds[2] + S5.len - S5.folds[0] + 400, E.sine);
const badText = () => tr(`끝 모서리가 크리스 1에 ${deg(altSum(TH_BAD))} 못 미친다  ✗`, `the far edge stops ${deg(altSum(TH_BAD))} short of crease 1  ✗`);

function BadFoldScene({ ms }: { ms: number }) {
  const ret = win(ms, S5.ret[0], S5.ret[1], E.inOut3);
  const back = ret >= 1;
  const m = win(ms, S5.morph[0], S5.morph[1]);
  const th = TH.map((x, i) => lerp(x, TH_BAD[i], m));
  const { P, hinge: h } = drive(ms, S5.folds, S5.len, 220);
  const cx = cxAt(P);
  const morphing = ms > S5.morph[0] - 300 && ms < S5.morph[0] + S5.morph[1] + 250;
  const hinge = Math.max(h, morphing ? win(ms, S5.morph[0] - 300, 250, E.out) * gone(ms, S5.morph[0] + S5.morph[1], 250) : 0);
  const far = altSum(TH_BAD);
  const gk = win(ms, S5.gap, 1250, E.inOut);
  const c2 = startsOf(th)[1];
  const delta = c2 - TH[0];
  const [dx, dy] = pt(240, CY, R + 24, TH[0] + delta / 2 + 2);
  return (
    <g>
      {/* the formula of the gather leaves to the right */}
      {ms < 400 && <g opacity={gone(ms, 0, 220)} transform={`translate(${(12 * E.in(ms / 220)).toFixed(2)} 0)`}><GatherText ms={S4.D} /></g>}
      <g transform={camT(Z5, camS5(ms))}>
        {!back ? (
          <Gather cx={lerp(GCX, 240, ret)} k={1 - ret} tint={1 - ret} labels={gone(ms, 0, 160)} />
        ) : (
          <Stack th={th} P={P} cx={cx} hinge={hinge} cut />
        )}
        {/* how far crease 2 moved */}
        {delta > 0.3 && P === 0 && (
          <g opacity={gone(ms, S5.badges - 150, 200)}>
            <path d={arc(240, CY, R + 9, TH[0], c2)} fill="none" stroke={MARK} strokeWidth={5} strokeLinecap="round" />
            <Label x={dx} y={dy + 4} size={15} weight={700} color={INK}>{`+${deg(delta)}`}</Label>
          </g>
        )}
        <SectorLabels th={th} cx={240} k={() => arrive(ms, S5.ret[0] + S5.ret[1] + 50, 280) * gone(ms, S5.folds[0] - 350, 220)} />
        <Badges th={th} P={P} cx={cx} op={(j) => arrive(ms, S5.badges + 60 * j, 300)} pop={(j) => bump(ms, S5.badges + 60 * j, 320)} />
        {/* scene 5 only: the size sits close to the end of its arc */}
        <Gap cx={CXF} far={far} k={gk} lr={14} />
      </g>
      {/* one small accent in the middle of the end hold */}
      <g transform={`translate(240 266) scale(${(1 + 0.07 * accent(ms, S5.D - 650)).toFixed(4)}) translate(-240 -266)`}>
        <Label x={240} y={272} size={16} weight={700} color={BAD} rise={arrive(ms, S5.gap + 1300)}>{badText()}</Label>
      </g>
    </g>
  );
}

// ───────────────────────────── scene 6: the walk does not come home

const S6: { D: number; T: WalkTiming } = { D: 8850, T: { lift: 250, s0: 1850, arc: 900, hop: 250, last: 1300 } };
const S6_END = arcEnd(S6.T, N - 1);

function BadWalkScene({ ms, extras = false }: { ms: number; extras?: boolean }) {
  const T = S6.T;
  const far = altSum(TH_BAD);
  const gk = win(ms, S6_END + 60, 800, E.inOut);
  const eq = arrive(ms, S6_END + 900, 280);
  return (
    <g>
      <WalkScene ms={ms} th={TH_BAD} T={T} landAt={S6_END} zoom={Z5} extras={extras} after={
        <g>
          {/* the folded paper's red gap leaves; the walk earns it again */}
          <Gap cx={CXF} far={far} k={1} op={gone(ms, 0, 300)} lr={14} />
          {ms > S6_END && <Gap cx={CXF} far={far} k={gk} />}
        </g>
      } />
      <Label x={240} y={272} size={16} weight={700} color={BAD} opacity={gone(ms, 0, 220)}>{badText()}</Label>
      <EqRows th={TH_BAD} bad show={(i) => arrive(ms, arcEnd(T, i) + 80, 280)} eq={eq} />
      <Label x={rowLayout(TH_BAD).eqX + 60} y={ROW_A} anchor="start" size={17} weight={700} color={BAD} rise={arrive(ms, S6_END + 1150, 280)}>✗</Label>
      {/* why 40°: the odd sectors add to 200°, the even ones to 160° (lower left, where the walk leaves room) */}
      <Label x={28} y={186} anchor="start" size={16} weight={700} color={ODD} rise={arrive(ms, S6_END + 1100)}>{`θ_1 + θ_3 = ${deg(oddSum(TH_BAD))}`}</Label>
      <Label x={28} y={212} anchor="start" size={16} weight={700} color={EVEN} rise={arrive(ms, S6_END + 1300)}>{`θ_2 + θ_4 = ${deg(evenSum(TH_BAD))}`}</Label>
    </g>
  );
}

// ───────────────────────────── scene 7: the rule, both vertices side by side

/**
 * The changed stack drops its rims back, unfolds, and shrinks to the right; a copy of it
 * slides left while crease 2 turns back by 20°: the first vertex. Then the sums are swept.
 */
const S7 = { D: 9400, drop: [0, 500], unfold: [550, 1700], move: [1800, 800], copy: [2450, 800], odd: [3300, 1700], even: [5300, 1700], ok: 7200, bad: 7450, mv: 7900 };
const MINI = { cy: 112, r: 70, left: 120, right: 360 };

function MiniVertex({ cx, cy, r, th, oddK, evenK, mvK = 0, labels = 1 }: { cx: number; cy: number; r: number; th: readonly number[]; oddK: number; evenK: number; mvK?: number; labels?: number }) {
  const s = startsOf(th);
  const tintTo = (i: number) => {
    const sweep = i % 2 === 0 ? oddK * oddSum(th) : evenK * evenSum(th);
    const before = i < 2 ? 0 : th[i - 2];
    return Math.max(0, Math.min(th[i], sweep - before));
  };
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={FRONT} stroke={INK3} strokeWidth={0.9} />
      {th.map((x, i) => {
        const e = tintTo(i);
        return (
          <g key={i}>
            {e > 0.3 && <path d={wedge(cx, cy, r, s[i], s[i] + e)} fill={col(i)} fillOpacity={0.26} />}
            <path d={arc(cx, cy, r, s[i], s[i] + x)} fill="none" stroke={col(i)} strokeWidth={3.5} strokeLinecap="round" />
          </g>
        );
      })}
      {s.map((a, j) => {
        const [ex, ey] = pt(cx, cy, r, a);
        const m = MVK[j] === 'M';
        return (
          <g key={j} strokeLinecap="round">
            <line x1={cx} y1={cy} x2={ex} y2={ey} stroke={INK} strokeWidth={2} opacity={1 - mvK} />
            {mvK > 0 && <line x1={cx} y1={cy} x2={ex} y2={ey} stroke={m ? MOUNTAIN : VALLEY} strokeWidth={2.4} strokeDasharray={m ? '8 3 1.5 3' : '5 3.5'} opacity={mvK} />}
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={3} fill={INK} />
      {th.map((x, i) => { const [lx, ly] = pt(cx, cy, r * 0.62, s[i] + x / 2); return <Label key={'l' + i} x={lx} y={ly + 5} size={14} weight={700} color={col(i)} rise={labels}>{`θ_${i + 1}`}</Label>; })}
    </g>
  );
}

function RuleScene({ ms }: { ms: number }) {
  const oddK = win(ms, S7.odd[0], S7.odd[1]);
  const evenK = win(ms, S7.even[0], S7.even[1]);
  const mvK = win(ms, S7.mv, 800);
  const drop = win(ms, S7.drop[0], S7.drop[1] - S7.drop[0], E.inOut);
  const unf = steps(ms, S7.unfold[0], S7.unfold[1], 3, 100);
  const P = 3 - unf;
  const mvk = win(ms, S7.move[0], S7.move[1], E.inOut3);
  const ck = win(ms, S7.copy[0], S7.copy[1], E.inOut);
  const flat = unf >= 3;
  // the changed vertex on the right, reached by moving and shrinking the unfolded sheet
  const right = { cx: lerp(CXF, MINI.right, mvk), cy: lerp(CY, MINI.cy, mvk), r: lerp(R, MINI.r, mvk) };
  const copyTh = TH_BAD.map((x, i) => lerp(x, TH[i], ck));
  const sides = [
    { cx: MINI.left, th: TH as readonly number[], title: tr('처음 꼭짓점', 'the first vertex'), ok: true, at: S7.ok },
    { cx: MINI.right, th: TH_BAD as readonly number[], title: tr(`θ_1 + ${SHIFT}°,  θ_2 − ${SHIFT}°`, `θ_1 + ${SHIFT}°,  θ_2 − ${SHIFT}°`), ok: false, at: S7.bad },
  ];
  return (
    <g>
      {/* what leaves from the failed walk: needle, badges, gap and formulas */}
      {ms < 400 && <g opacity={gone(ms, 0, 240)}><BadWalkScene ms={S6.D} extras /></g>}
      {!flat ? (
        <g>
          <Stack th={TH_BAD} P={P} cx={CXF} fill={0.28 + 0.72 * drop} rim={drop >= 1 ? 1 : 0} cut />
          {drop < 1 && <Walk th={TH_BAD} T={S6.T} ms={1e9} cx={CXF} mode="drop" drop={drop} />}
        </g>
      ) : (
        <g>
          {/* the copy peels off the changed vertex and slides left; crease 2 turns back by 20° on the way */}
          {ck > 0 && <MiniVertex cx={lerp(MINI.right, MINI.left, ck)} cy={MINI.cy} r={MINI.r} th={ck >= 1 ? TH : copyTh} oddK={oddK} evenK={evenK} mvK={mvK} labels={arrive(ms, S7.copy[0] + S7.copy[1])} />}
          <MiniVertex cx={right.cx} cy={right.cy} r={right.r} th={TH_BAD} oddK={oddK} evenK={evenK} labels={arrive(ms, S7.move[0] + S7.move[1])} />
        </g>
      )}
      {sides.map((sd, k) => {
        const v = E.back(1.8)((ms - sd.at) / 360);
        return (
          <g key={k}>
            <Label x={sd.cx} y={26} size={14} weight={600} color={INK2} rise={arrive(ms, k === 0 ? S7.copy[0] + S7.copy[1] : S7.move[0] + S7.move[1])}>{sd.title}</Label>
            {/* the painted sectors do the counting; each sum is written once, at its true value, as its sweep ends */}
            <Label x={sd.cx} y={212} size={16} weight={700} color={ODD} rise={arrive(ms, S7.odd[0] + S7.odd[1] - 150)}>{`θ_1 + θ_3 = ${deg(oddSum(sd.th))}`}</Label>
            <Label x={sd.cx} y={238} size={16} weight={700} color={EVEN} rise={arrive(ms, S7.even[0] + S7.even[1] - 150)}>{`θ_2 + θ_4 = ${deg(evenSum(sd.th))}`}</Label>
            {v > 0 && (
              <g transform={`translate(${sd.cx} 266) scale(${((0.6 + 0.4 * v) * (1 + 0.07 * accent(ms, S7.D - 500))).toFixed(4)})`} opacity={cl(v * 1.5)}>
                <Label x={0} y={0} size={16} weight={700} color={sd.ok ? OK : BAD}>{sd.ok ? tr('평탄하게 접힌다  ✓', 'folds flat  ✓') : tr('접히지 않는다  ✗', 'will not fold flat  ✗')}</Label>
              </g>
            )}
          </g>
        );
      })}
      <Label x={240} y={293} size={16} weight={600} color={INK2} rise={arrive(ms, S7.mv + 300)}>{tr('산·골은 → Maekawa 정리', 'mountains & valleys → Maekawa')}</Label>
    </g>
  );
}

// ───────────────────────────── the scenes

/** a caption as beats; `caption` keeps the joined text */
const say = (ko: string[], en: string[], at: number[]) => ({
  beats: () => tr(ko, en).map((text, i) => ({ at: at[i], text })),
  caption: () => tr(ko, en).join(' '),
});

const walkNote = () => tr('접힌 테두리를 떼어 놓고 따라 걷기', 'the folded rims pulled apart and walked');

export const kawasakiScenes = (): Scene[] => [
  {
    duration: S1.D, view: 'top', viewNote: () => tr('펼친 종이', 'flat sheet'),
    ...say(['크리스 네 개가 한 점에서 만난다.', '사이 각을 모두 더하면 360°다.'],
      ['Four creases meet at one point.', 'The angles between them add up to 360°.'], [0, 2200 / S1.D]),
    draw: (t) => <Flat ms={t * S1.D} />,
  },
  {
    duration: S2.D, view: 'top', viewNote: () => tr('차례로 접는 중', 'folding one crease at a time'), join: 'none',
    ...say(['크리스 1을 잘라 두고 2, 3, 4를 차례로 접는다.', '끝 모서리가 크리스 1에 닿으니 평탄하게 접힌다.'],
      ['Cut along crease 1, then fold creases 2, 3 and 4 in turn.', 'The far edge lands on crease 1, so it folds flat.'], [0, 4100 / S2.D]),
    draw: (t) => <FoldScene ms={t * S2.D} />,
  },
  {
    duration: S3.D, view: 'diagram', viewNote: walkNote, join: 'none', lead: 250,
    ...say(['테두리를 떼어 따라 걸으면, 종이가 뒤집힐 때마다 도는 쪽이 바뀐다.', '출발 방향으로 돌아와야 닫힌다.'],
      ['Pull the rims apart and walk them: each time the paper turns over, the turn reverses.', 'It closes only if the walk comes home.'], [0, arcStart(S3.T, N - 1) / S3.D]),
    draw: (t) => <GoodWalkScene ms={t * S3.D} />,
  },
  {
    duration: S4.D, view: 'diagram', viewNote: () => tr('펼쳐서 섹터를 잘라 모음', 'unfolded, sectors cut out and gathered'), join: 'none',
    ...say(['다시 펼쳐 홀수 섹터와 짝수 섹터를 따로 모으면, 둘 다 반원이 된다.', '위 식과 같은 말이다.'],
      ['Unfold, then gather the odd and the even sectors apart: each makes a half circle.', 'That is the same statement as the formula.'], [0, 4500 / S4.D]),
    draw: (t) => <GatherScene ms={t * S4.D} />,
  },
  {
    duration: S5.D, view: 'top', viewNote: () => tr('섹터를 되붙여 바꾼 꼭짓점을 접는 중', 'sectors put back, folding a changed vertex'), join: 'none', lead: 300,
    ...say(['θ_1은 20° 키우고 θ_2는 20° 줄여 다시 접는다.', '끝 모서리가 크리스 1에 40° 못 미친다.'].map((s) => s.replace(/20°/g, `${SHIFT}°`).replace('40°', deg(altSum(TH_BAD)))),
      ['Make θ_1 20° larger and θ_2 20° smaller, and fold again.', 'The far edge stops 40° short of crease 1.'].map((s) => s.replace(/20°/g, `${SHIFT}°`).replace('40°', deg(altSum(TH_BAD)))), [0, 4100 / S5.D]),
    draw: (t) => <BadFoldScene ms={t * S5.D} />,
  },
  {
    duration: S6.D, view: 'diagram', viewNote: walkNote, join: 'none', lead: 250,
    ...say([`걸음도 출발 방향에 ${deg(altSum(TH_BAD))} 못 미친다.`, '그래서 이 꼭짓점은 평탄하게 접히지 않는다.'],
      [`The walk, too, stops ${deg(altSum(TH_BAD))} short of home.`, 'So this vertex cannot fold flat.'], [0, 4300 / S6.D]),
    draw: (t) => <BadWalkScene ms={t * S6.D} />,
  },
  {
    duration: S7.D, view: 'diagram', viewNote: () => tr('정리', 'the rule'), join: 'none', lead: 300,
    ...say(['하나 건너 더한 합이 180°이면 평탄하게 접을 방법이 있고, 아니면 없다.', '산·골은 Maekawa에서 본다.'],
      ['If every other angle adds to 180°, there is a way to fold it flat; if not, there is none.', 'Mountains and valleys: see Maekawa.'], [0, 6300 / S7.D]),
    draw: (t) => <RuleScene ms={t * S7.D} />,
  },
];
