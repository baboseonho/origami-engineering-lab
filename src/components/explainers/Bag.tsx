import { useLayoutEffect, useState, type ReactNode } from 'react';
import { tr } from '../../i18n';
import data from './data/bagFold.json';
import { arc, BAD, E, INK, INK2, INK3, Label, lerp, MARK, MOUNTAIN, OK, popScale, seg, TAIL, VALLEY, VIEW, type Beat, type Scene } from './Explainer';
import { cross, dot, Mesh, norm, project, Shadow, sub, type Cam, type Face, type V3 } from './paper3d';

/*
 * The shopping-bag theorem, drawn from the site's own computation.
 *
 * Every bag on screen is `bagFold.json`: the Energy solver's path for the
 * shopping-bag sheet (W 2, D 1, H 2), 41 frames from open (p = 0) to flat
 * (p = 1), with per-vertex strain. The only thing done to it is a rigid
 * shift of the whole body (the bottom stays on the table, as the solver
 * pinned it) and linear interpolation between neighbouring frames.
 * Crease styles come from the data's own M/V; seen from the paper's back a
 * mountain looks like a valley, so a face seen from behind shows the swap.
 * The strain is the site's axial strain: the absolute change of length of
 * the bars, stretch or shrink alike ("변형률", as in the site's toolbar).
 */

// ───────────────────────────── the solver data

type Frame = { p: number; P: number[]; vs: number[]; maxStrain: number };
const FR = data.frames as Frame[];
const FACES = data.faces as number[][];
const NV = FR[0].P.length / 3;
/** whole-body shift so the bag turns about its own middle */
const SHIFT: V3 = [-1, -0.75, 0];
/** the site's strain overlay is full red at 5 % */
const STRAIN_FULL = 0.05;
/** warm red for strain */
const HOT: [number, number, number] = [206, 62, 40];
const HOT_CSS = 'rgb(206 62 40)';
/** --color-ok, for turning the path into the strain colour */
const OK_RGB = [29, 116, 72];
const PAPER_RGB: [number, number, number] = [253, 253, 251];
/** how much strain colour a strain s gets, laid over the shaded paper */
const tintOf = (s: number) => Math.min(1, Math.max(0, s) / STRAIN_FULL) ** 0.6 * 0.85;
/** the worst moment on the solver's path (computed, never typed) */
const PEAK = FR.reduce((m, f) => (f.maxStrain > m.maxStrain ? f : m), FR[0]);
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

/** the bag at fold progress p (0 open … 1 flat): positions, per-vertex strain and the largest strain */
function state(p: number) {
  const x = Math.min(1, Math.max(0, p)) * (FR.length - 1);
  const i = Math.min(FR.length - 2, Math.floor(x)), k = x - i;
  const A = FR[i], B = FR[i + 1];
  const pts: V3[] = [];
  for (let v = 0; v < NV; v++) pts.push([lerp(A.P[3 * v], B.P[3 * v], k) + SHIFT[0], lerp(A.P[3 * v + 1], B.P[3 * v + 1], k) + SHIFT[1], lerp(A.P[3 * v + 2], B.P[3 * v + 2], k) + SHIFT[2]]);
  return { pts, vs: A.vs.map((s, v) => lerp(s, B.vs[v], k)), max: lerp(A.maxStrain, B.maxStrain, k) };
}
const maxAt = (p: number) => state(p).max;

/** creases (not boundary edges), with the faces on either side */
const CREASES = data.edges.filter((e) => e.a !== 'B').map((e) => {
  const [a, b] = e.v;
  const faces = FACES.map((f, i) => ({ f, i })).filter(({ f }) => {
    const ia = f.indexOf(a), ib = f.indexOf(b);
    return ia >= 0 && ib >= 0 && ((ia + 1) % f.length === ib || (ib + 1) % f.length === ia);
  }).map(({ i }) => i);
  return { a, b, mv: e.a as 'M' | 'V', faces };
});
/** the gusset creases of the two side walls: every valley that is not on the back wall */
const GUSSET = new Set(CREASES.filter((c) => c.mv === 'V' && c.faces.every((f) => f >= 4)).map((c) => `${c.a}-${c.b}`));

// ───────────────────────────── painter's order for paper that ends up in layers

type P2 = [number, number];
function inside(q: P2, poly: P2[]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[j];
    if ((y1 > q[1]) !== (y2 > q[1]) && q[0] < x1 + ((q[1] - y1) * (x2 - x1)) / (y2 - y1)) c = !c;
  }
  return c;
}
function crossing(a: P2, b: P2, c: P2, d: P2): P2 | null {
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  return t > 1e-3 && t < 1 - 1e-3 && u > 1e-3 && u < 1 - 1e-3 ? [a[0] + r[0] * t, a[1] + r[1] * t] : null;
}
/** screen polygons and depth planes (depth = a·x + b·y + c, least squares) of every face */
function screenGeom(pts: V3[], cam: Cam) {
  const pr = pts.map((q) => project(q, cam));
  const polys = FACES.map((f) => f.map((v) => [pr[v][0], pr[v][1]] as P2));
  const planes = FACES.map((f) => {
    let sxx = 0, sxy = 0, sx = 0, syy = 0, sy = 0, n = 0, sxd = 0, syd = 0, sd = 0;
    for (const v of f) { const [x, y, d] = pr[v]; sxx += x * x; sxy += x * y; sx += x; syy += y * y; sy += y; n++; sxd += x * d; syd += y * d; sd += d; }
    const det = sxx * (syy * n - sy * sy) - sxy * (sxy * n - sy * sx) + sx * (sxy * sy - syy * sx);
    if (Math.abs(det) < 1e-6) return null;
    const a = (sxd * (syy * n - sy * sy) - sxy * (syd * n - sy * sd) + sx * (syd * sy - syy * sd)) / det;
    const b = (sxx * (syd * n - sd * sy) - sxd * (sxy * n - sy * sx) + sx * (sxy * sd - syd * sx)) / det;
    const c = (sxx * (syy * sd - sy * syd) - sxy * (sxy * sd - sx * syd) + sxd * (sxy * sy - syy * sx)) / det;
    return [a, b, c];
  });
  return { pr, polys, planes };
}
/**
 * Back-to-front order of the faces. Average depth fails here: near flat the
 * walls lie in layers on the bottom. So every pair that overlaps on screen is
 * compared at a shared point, through each face's depth plane, and the
 * pairs are sorted topologically.
 */
function paintOrder(pts: V3[], cam: Cam) {
  const { pr, polys, planes } = screenGeom(pts, cam);
  const n = FACES.length;
  const before: Set<number>[] = FACES.map(() => new Set());
  const mid = (poly: P2[]): P2 => [poly.reduce((s, q) => s + q[0], 0) / poly.length, poly.reduce((s, q) => s + q[1], 0) / poly.length];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const A = polys[i], B = polys[j], pa = planes[i], pb = planes[j];
    if (!pa || !pb) continue;
    const ca = mid(A), cb = mid(B);
    const cand: P2[] = [ca, cb, ...A.map((q) => [q[0] + (ca[0] - q[0]) * 0.03, q[1] + (ca[1] - q[1]) * 0.03] as P2), ...B.map((q) => [q[0] + (cb[0] - q[0]) * 0.03, q[1] + (cb[1] - q[1]) * 0.03] as P2)];
    for (let s = 0; s < A.length; s++) for (let t = 0; t < B.length; t++) {
      const x = crossing(A[s], A[(s + 1) % A.length], B[t], B[(t + 1) % B.length]);
      if (x) cand.push([x[0] + (ca[0] - x[0]) * 0.02 + (cb[0] - x[0]) * 0.02, x[1] + (ca[1] - x[1]) * 0.02 + (cb[1] - x[1]) * 0.02]);
    }
    let best = 0;
    for (const q of cand) {
      if (!inside(q, A) || !inside(q, B)) continue;
      const d = pa[0] * q[0] + pa[1] * q[1] + pa[2] - (pb[0] * q[0] + pb[1] * q[1] + pb[2]);
      if (Math.abs(d) > Math.abs(best)) best = d;
    }
    if (Math.abs(best) > 1e-4) { if (best < 0) before[j].add(i); else before[i].add(j); }
  }
  const mean = FACES.map((f) => f.reduce((s, v) => s + pr[v][2], 0) / f.length);
  const out: number[] = [];
  const rem = new Set(FACES.map((_, i) => i));
  while (rem.size) {
    const all = [...rem];
    const ready = all.filter((k) => ![...before[k]].some((b) => rem.has(b)));
    const k = (ready.length ? ready : all).reduce((m, x) => (mean[x] < mean[m] ? x : m));
    out.push(k); rem.delete(k);
  }
  return out;
}

/** the direction towards the viewer, read off the projection */
function towardsViewer(cam: Cam): V3 {
  const o = project([0, 0, 0], cam)[2];
  return [project([1, 0, 0], cam)[2] - o, project([0, 1, 0], cam)[2] - o, project([0, 0, 1], cam)[2] - o];
}

// ───────────────────────────── the bag

const HANDLE = 0.55;
/**
 * A paper handle on a wall: a curve in the wall's own plane above its top edge,
 * tipped up towards the vertical by `lift` (decoration, not part of the computation).
 */
function handlePath(top0: V3, top1: V3, bot0: V3, bot1: V3, cam: Cam, lift = 0) {
  const w = norm(sub([(top0[0] + top1[0]) / 2, (top0[1] + top1[1]) / 2, (top0[2] + top1[2]) / 2], [(bot0[0] + bot1[0]) / 2, (bot0[1] + bot1[1]) / 2, (bot0[2] + bot1[2]) / 2]));
  const u = norm([lerp(w[0], 0, lift), lerp(w[1], 0, lift), lerp(w[2], 1, lift)]);
  const at = (k: number): V3 => [lerp(top0[0], top1[0], k), lerp(top0[1], top1[1], k), lerp(top0[2], top1[2], k)];
  const A = at(0.3), B = at(0.7);
  const up = (q: V3): V3 => [q[0] + u[0] * HANDLE * 1.33, q[1] + u[1] * HANDLE * 1.33, q[2] + u[2] * HANDLE * 1.33];
  const P = [A, up(A), up(B), B].map((q) => project(q, cam));
  return `M${P[0][0].toFixed(1)},${P[0][1].toFixed(1)} C${P[1][0].toFixed(1)},${P[1][1].toFixed(1)} ${P[2][0].toFixed(1)},${P[2][1].toFixed(1)} ${P[3][0].toFixed(1)},${P[3][1].toFixed(1)}`;
}

const pts2 = (P: P2[]) => P.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ');

/**
 * The solver's bag at progress p.
 * - `strain` (0..1) lays the site's per-vertex strain over the shaded paper, softly, vertex by vertex,
 *   with a pulsing ring (period 600 ms, clock `ms`) at the most strained vertex in view;
 * - `rigid` (0..1) draws the faces as plain plates with a heavy ink edge;
 * - `hi` lights the gussets; `lift` tips the decorative handles up.
 */
function BagView({ p, cam, strain = 0, rigid = 0, hi = 0, ms = 0, lift = 0 }: { p: number; cam: Cam; strain?: number; rigid?: number; hi?: number; ms?: number; lift?: number }) {
  const s = state(p);
  // the last few frames are layers a hair apart: keep the order they had just before
  const order = paintOrder(p > 0.97 ? state(0.97).pts : s.pts, cam);
  const rank: number[] = [];
  order.forEach((f, i) => { rank[f] = i; });
  const view = towardsViewer(cam);
  const pr = s.pts.map((q) => project(q, cam));
  const scr = (v: number): P2 => [pr[v][0], pr[v][1]];
  const ew = lerp(1.1, 3.5, rigid);
  const creaseOp = 1 - rigid;
  const faces: Face[] = FACES.map((f, fi) => ({ pts: f.map((v) => s.pts[v]), key: `f${fi}` }));
  const drawn = order.map((fi) => {
    const f = FACES[fi];
    const pts = faces[fi].pts;
    const nrm = norm(cross(sub(pts[1], pts[0]), sub(pts[pts.length - 1], pts[0])));
    const front = dot(nrm, view) >= 0;
    const poly = f.map(scr);
    // strain, vertex by vertex: each vertex colours the corner of the face around it; blurred and clipped to the face
    let tint: ReactNode = null;
    if (strain > 0) {
      const c: P2 = [poly.reduce((a, q) => a + q[0], 0) / poly.length, poly.reduce((a, q) => a + q[1], 0) / poly.length];
      const big = poly.map((q) => [c[0] + (q[0] - c[0]) * 1.25, c[1] + (q[1] - c[1]) * 1.25] as P2);
      const m = (a: P2, b: P2): P2 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      tint = (
        <g clipPath={`url(#bag-clip-${fi})`}>
          <defs><clipPath id={`bag-clip-${fi}`}><polygon points={pts2(poly)} /></clipPath></defs>
          <g filter="url(#xp-soft)">
            {f.map((v, i) => {
              const a = big[i], nx = big[(i + 1) % f.length], pv = big[(i - 1 + f.length) % f.length];
              const k = tintOf(s.vs[v]) * strain;
              return k > 0.004 ? <polygon key={i} points={pts2([a, m(a, nx), c, m(pv, a)])} fill={HOT_CSS} opacity={k} /> : null;
            })}
          </g>
        </g>
      );
    }
    const lines: ReactNode[] = [];
    for (const cr of CREASES) {
      // each crease is drawn once, on the nearer of its two faces, as seen from that face's visible side
      const owner = cr.faces.reduce((a, b) => (rank[b] > rank[a] ? b : a));
      if (owner !== fi) continue;
      const mv = front ? cr.mv : cr.mv === 'M' ? 'V' : 'M';
      const A = scr(cr.a), B = scr(cr.b);
      if (hi > 0 && mv === 'V' && GUSSET.has(`${cr.a}-${cr.b}`)) lines.push(<line key={`h${cr.a}-${cr.b}`} x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} stroke={MARK} strokeWidth={8} opacity={0.85 * hi} strokeLinecap="round" />);
      if (creaseOp > 0.01) lines.push(<line key={`c${cr.a}-${cr.b}`} x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} stroke={mv === 'M' ? MOUNTAIN : VALLEY} strokeWidth={2.4} strokeDasharray={mv === 'M' ? '9 3 2 3' : '7 4'} opacity={creaseOp} strokeLinecap="round" />);
    }
    return (
      <g key={fi}>
        <Mesh faces={[faces[fi]]} cam={cam} edgeWidth={ew} />
        {tint}
        {strain > 0 && <polygon points={pts2(poly)} fill="none" stroke={INK} strokeWidth={ew} strokeLinejoin="round" />}
        {lines}
      </g>
    );
  });
  // the most strained vertex that is in view (not behind a face)
  let ring: ReactNode = null;
  if (strain > 0) {
    const { polys, planes } = screenGeom(s.pts, cam);
    let best = -1, bs = 0.002;
    for (let v = 0; v < NV; v++) {
      if (s.vs[v] <= bs) continue;
      const q = scr(v);
      const hidden = FACES.some((f, fi) => !f.includes(v) && planes[fi] && inside(q, polys[fi]) && planes[fi]![0] * q[0] + planes[fi]![1] * q[1] + planes[fi]![2] > pr[v][2] + 0.03);
      if (!hidden) { best = v; bs = s.vs[v]; }
    }
    if (best >= 0) {
      const ph = (ms % 600) / 600, q = scr(best);
      ring = <circle cx={q[0]} cy={q[1]} r={4 + 6 * E.out(ph)} fill="none" stroke={BAD} strokeWidth={2.2} opacity={(1 - ph) * strain} />;
    }
  }
  const P = s.pts;
  const backHandle = handlePath(P[7], P[6], P[13], P[10], cam, lift);
  const frontHandle = handlePath(P[4], P[5], P[0], P[1], cam, lift);
  return (
    <g strokeLinejoin="round">
      <Shadow faces={faces} cam={cam} id="bag-shadow" opacity={0.15} />
      <path d={backHandle} fill="none" stroke={INK3} strokeWidth={2.2} strokeLinecap="round" />
      {drawn}
      <path d={frontHandle} fill="none" stroke={INK2} strokeWidth={2.2} strokeLinecap="round" />
      {ring}
    </g>
  );
}

// ───────────────────────────── cameras (one path through all scenes, so joined scenes meet exactly)

const cam = (yaw: number, pitch: number, scale: number, cx: number, cy: number): Cam => ({ yaw, pitch, scale, cx, cy });
const mixCam = (a: Cam, b: Cam, k: number): Cam => cam(lerp(a.yaw, b.yaw, k), lerp(a.pitch, b.pitch, k), lerp(a.scale, b.scale, k), lerp(a.cx, b.cx, k), lerp(a.cy, b.cy, k));
const withYaw = (c: Cam, yaw: number): Cam => ({ ...c, yaw });
/** looking down on the flat bag */
const CAM_FLAT = cam(-14, 66, 74, 236, 200);
/** the bag large, opening and gusset in view */
const CAM_BIG = cam(-56, 40, 78, 228, 218);
/**
 * The bag above the strip, framed to its current shape: as large as the space
 * above the strip allows (up to 84 px a unit): the body (handles may reach the top edge)
 * between y 4 and 197, 8 units above the strip, centred on x 175.
 * The bottom is pinned, so the bag grows from the table as it flattens.
 */
function fitCam(yaw: number, pitch: number, p: number): Cam {
  const unit = cam(yaw, pitch, 1, 0, 0);
  const P = state(p).pts;
  const q = P.map((v) => project(v, unit));
  const x0 = Math.min(...q.map((v) => v[0])), x1 = Math.max(...q.map((v) => v[0]));
  const y0 = Math.min(...q.map((v) => v[1])), y1 = Math.max(...q.map((v) => v[1]));
  const s = Math.min(84, (197 - 4) / (y1 - y0));
  return cam(yaw, pitch, s, 175 - (s * (x0 + x1)) / 2, 197 - s * y1);
}
const YAW = { s1: -48, s2: -44.5, s3a: -41, s3b: -38, s4: -42 };

// ───────────────────────────── labels, arrows, legend

/** a push arrow on screen from a to b (tip at b) */
function Arrow({ a, b, op = 1, color = INK }: { a: P2; b: P2; op?: number; color?: string }) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
  const h = 13, w = 7.5;
  const base: P2 = [b[0] - ux * h, b[1] - uy * h];
  return (
    <g opacity={op}>
      <line x1={a[0]} y1={a[1]} x2={base[0]} y2={base[1]} stroke={color} strokeWidth={4} strokeLinecap="round" />
      <polygon points={`${b[0]},${b[1]} ${base[0] - uy * w},${base[1] + ux * w} ${base[0] + uy * w},${base[1] - ux * w}`} fill={color} />
    </g>
  );
}

/** the strain view's key: the same mapping as the bag, full at the site's 5 % */
function Legend({ op }: { op: number }) {
  if (op <= 0) return null;
  const stops = [0, 0.1, 0.25, 0.5, 0.75, 1];
  return (
    <g opacity={op}>
      <defs>
        <linearGradient id="bag-strain-key" x1="0" x2="1" y1="0" y2="0">
          {stops.map((k) => {
            const a = tintOf(k * STRAIN_FULL);
            return <stop key={k} offset={k} stopColor={`rgb(${[0, 1, 2].map((i) => Math.round(lerp(PAPER_RGB[i], HOT[i], a))).join(' ')})`} />;
          })}
        </linearGradient>
      </defs>
      <Label x={372} y={28} anchor="start" size={14} color={INK2} weight={600}>{tr('변형률', 'strain')}</Label>
      <rect x={372} y={36} width={92} height={10} rx={2} fill="url(#bag-strain-key)" stroke={INK3} strokeWidth={0.8} />
      <Label x={372} y={64} anchor="start" size={13} color={INK3}>0%</Label>
      <Label x={464} y={64} anchor="end" size={13} color={INK3}>{pct(STRAIN_FULL)}</Label>
      <Label x={464} y={86} anchor="end" size={13} color={INK3}>{tr('늘거나 줄어듦', 'stretch or shrink')}</Label>
      <Label x={464} y={108} anchor="end" size={13} color={INK2}><tspan fill={BAD} fontWeight={700}>○</tspan>{tr(' 가장 많이 변한 곳', ' most strained spot')}</Label>
    </g>
  );
}

// ───────────────────────────── the map strip (a diagram), later a graph of the computed strain

const SX0 = 120, SX1 = 360, SY = 258;
/** height of the strain ticks and of the path through their tops (data: TICK at the peak) */
const TICK = 26;
const FENCE = 20, DOT = 6;
const PUSH_DIRS = [0, 62, -58];
const xAt = (u: number) => lerp(SX0, SX1, u);
const strainY = (s: number) => SY - (TICK * s) / PEAK.maxStrain;
/** the fence's gap opens along the path's first direction */
const GAP_DIR = (Math.atan2(SY - strainY(maxAt(0.08)), xAt(0.08) - SX0) * 180) / Math.PI;
/** the path: the computed curve through the tick tops, from open up to progress u1 */
function curveD(u1: number) {
  let d = '';
  for (const f of FR) {
    if (f.p > u1) { d += `L${xAt(u1).toFixed(1)},${strainY(maxAt(u1)).toFixed(1)}`; break; }
    d += `${d ? 'L' : 'M'}${xAt(f.p).toFixed(1)},${strainY(f.maxStrain).toFixed(1)}`;
  }
  return d;
}

interface StripState {
  /** slide in */
  show: number;
  /** the open bag's point is filled while the shape sits there */
  oFill?: boolean;
  popO?: number; popF?: number;
  /** the straight dashed "no path" line, its ✗, and their exit */
  noPath?: number; noX?: number; noOut?: number;
  /** each attempted push of the open point against its fence: 0..1 */
  pushes?: number[];
  /** fence gap, 0..1 → 0..60° */
  gap?: number;
  /** the path drawn up to u (open → flat); `red` turns it from path green to strain red */
  drawn?: number; red?: number;
  /** the moving dot at u (null: none), on the path */
  dot?: number | null;
  readout?: number;
  /** strain ticks laid down up to u, their opacity, and the one-time note naming them */
  ticks?: number; tickOp?: number; tickNote?: number;
  /** 'height = largest strain' beside the map title, while the path is read as heights */
  heightNote?: number;
  /** a ring when the dot comes home to the open bag */
  oPulse?: number;
  fDone?: number;
  peak?: number;
  /** title change: configuration space → strain graph */
  swap?: number;
  axis?: number;
  /** the "no path" beat once more: the ✗ re-stamped (0..1) and the fence flashed in BAD (0..1) */
  noXAgain?: number; fenceFlash?: number;
}

/**
 * The player's label floor (the smallest label size that still reads at the drawing's width),
 * measured here the same way the player does, so a footnote can pick a shorter text on a phone.
 */
function useLabelFloor() {
  const [el, setEl] = useState<SVGGElement | null>(null);
  const [floor, setFloor] = useState(0);
  useLayoutEffect(() => {
    const svg = el?.ownerSVGElement;
    if (!svg || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => { const w = svg.getBoundingClientRect().width; setFloor(w > 0 ? (12.5 * VIEW.w) / w : 0); });
    ro.observe(svg);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, floor] as const;
}

function Strip({ st }: { st: StripState }) {
  const { show, oFill = true, popO = 0, popF = 0, noPath = 0, noX = 0, noOut = 0, pushes = [], gap = 0, drawn = 0, red = 0, dot = null, readout = 0, ticks = 0, tickOp = 1, tickNote = 0, heightNote = 0, oPulse = 0, fDone = 0, peak = 0, swap = 0, axis = 0, noXAgain = 0, fenceFlash = 0 } = st;
  const [floorRef, floor] = useLabelFloor();
  if (show <= 0) return null;
  // the re-stamp: up to 1.15 quickly, then back.out(1.6) down to 1
  const again = noXAgain <= 0 || noXAgain >= 1 ? 1 : noXAgain < 0.3 ? 1 + 0.15 * E.out(noXAgain / 0.3) : 1.15 - 0.15 * E.back(1.6)((noXAgain - 0.3) / 0.7);
  const g = 60 * gap;
  const dp: P2 | null = dot === null ? null : [xAt(dot), strainY(maxAt(dot))];
  const pathCol = red > 0 ? `rgb(${[0, 1, 2].map((i) => Math.round(lerp(OK_RGB[i], HOT[i], red))).join(' ')})` : OK;
  // the readout sits below-right of the dot, and moves above it before it can reach the flat bag's label
  const up = dot === null ? 0 : 1 - (1 - Math.min(1, Math.max(0, (xAt(dot) - (SX1 - 70)) / 15))) ** 2;
  const pk: P2 = [xAt(PEAK.p), strainY(PEAK.maxStrain)];
  // an attempted push: the dot runs to its fence and bounces back (back.out); its rest place never changes
  let off: P2 = [0, 0];
  const flashes: { at: P2; k: number; dir: number }[] = [];
  pushes.forEach((k, i) => {
    if (k <= 0 || k >= 1) return;
    const a = (PUSH_DIRS[i % 3] * Math.PI) / 180, reach = FENCE - DOT - 1;
    const r = k < 0.4 ? reach * (k / 0.4) ** 2 : reach * (1 - E.back(1.8)((k - 0.4) / 0.6));
    off = [r * Math.cos(a), -r * Math.sin(a)];
    if (k >= 0.4) flashes.push({ at: [SX0 + FENCE * Math.cos(a), SY - FENCE * Math.sin(a)], k: (k - 0.4) / 0.6, dir: PUSH_DIRS[i % 3] });
  });
  const titleOld = 1 - seg(swap, 0, 0.4, E.in);
  return (
    <g ref={floorRef} transform={`translate(0 ${(1 - E.out(show)) * 40})`} opacity={Math.min(1, show * 2)}>
      <rect x={12} y={205} width={456} height={89} rx={6} fill="var(--color-paper-2)" stroke={INK3} strokeWidth={1} strokeDasharray="4 4" />
      {titleOld > 0 && <Label x={24} y={224} anchor="start" size={14} color={INK3} weight={600} opacity={titleOld}>{tr('형상 공간', 'configuration space')}</Label>}
      {/* top right of the strip: free in scene 4, and gone before the readout climbs there */}
      {heightNote > 0 && <Label x={456} y={224} anchor="end" size={13} color={INK2} rise={heightNote}>{tr('높이 = 최대 변형률', 'height = largest strain')}</Label>}
      {swap > 0.5 && (
        <g>
          <Label x={24} y={224} anchor="start" size={14} color={INK2} weight={700} rise={seg(swap, 0.5, 0.8, E.out)}>{tr('최대 변형률', 'largest strain')}</Label>
          <Label x={456} y={224} anchor="end" size={13} color={INK3} rise={seg(swap, 0.65, 1, E.out)}>{tr('사이트 모델', 'site model')}</Label>
        </g>
      )}
      {/* no path between the two points while the faces are rigid */}
      {noPath > 0 && noOut < 1 && (
        <g opacity={1 - noOut}>
          <line x1={SX0 + FENCE + 4} y1={SY} x2={lerp(SX0 + FENCE + 4, SX1 - 10, noPath)} y2={SY} stroke={INK3} strokeWidth={2} strokeDasharray="6 6" />
          {fenceFlash > 0 && fenceFlash < 1 && <line x1={SX0 + FENCE + 4} y1={SY} x2={SX1 - 10} y2={SY} stroke={BAD} strokeWidth={2.5} strokeDasharray="6 6" opacity={0.6 * Math.sin(Math.PI * fenceFlash)} />}
          {noX > 0 && <g transform={`translate(240 ${SY + 1}) scale(${popScale(noX) * again})`}><Label x={0} y={8} size={24} weight={700} color={BAD}>✗</Label></g>}
        </g>
      )}
      {/* strain ticks left where the dot has passed: height = that moment's largest strain (computed) */}
      {ticks > 0 && tickOp > 0 && (
        <g stroke={INK3} strokeWidth={1.5} opacity={tickOp}>
          {FR.map((f, i) => {
            if (f.p <= 0 || f.p >= 1 || ticks < f.p) return null;
            const h = (SY - strainY(f.maxStrain)) * E.out(Math.min(1, (ticks - f.p) / 0.03));
            return <line key={i} x1={xAt(f.p)} y1={SY} x2={xAt(f.p)} y2={SY - h} />;
          })}
        </g>
      )}
      {/* the path, drawn at the computed heights: green while it is a way through, strain red once it is read as a graph */}
      {drawn > 0 && <path d={curveD(drawn)} fill="none" stroke={pathCol} strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" />}
      {/* starts right of the open bag's fence; on a phone (larger labels) the shorter text, "site computation" being in the view tag */}
      {tickNote > 0 && <Label x={SX0 + FENCE + 12} y={286} anchor="start" size={13} color={INK2} rise={tickNote}>{floor > 13 ? tr('막대 = 순간 최대 변형률', 'bar = largest strain now') : tr('막대 = 그 순간 최대 변형률 · 사이트 계산', 'bar = largest strain at that moment · site computation')}</Label>}
      {/* the fence around the open bag, which opens a gap towards the path */}
      {popO > 0 && <path d={g > 0.5 ? arc(SX0, SY, FENCE, GAP_DIR + g / 2, GAP_DIR + 360 - g / 2) : `M${SX0 + FENCE},${SY} a${FENCE},${FENCE} 0 1 0 ${-2 * FENCE},0 a${FENCE},${FENCE} 0 1 0 ${2 * FENCE},0`} fill="none" stroke={INK3} strokeWidth={1.6} strokeDasharray="3 3" opacity={popO} />}
      {/* the fence's dots flash once in BAD (with the dashed line above): the same "no way out", said again */}
      {fenceFlash > 0 && fenceFlash < 1 && (
        <g fill="none" stroke={BAD} opacity={0.6 * Math.sin(Math.PI * fenceFlash)}>
          <circle cx={SX0} cy={SY} r={FENCE} strokeWidth={3.5} strokeDasharray="3 3" />
        </g>
      )}
      {flashes.map((fl, i) => (
        <g key={i} opacity={1 - fl.k}>
          <path d={arc(SX0, SY, FENCE, fl.dir - 28, fl.dir + 28)} fill="none" stroke={BAD} strokeWidth={4} strokeLinecap="round" />
          <circle cx={fl.at[0]} cy={fl.at[1]} r={3 + 11 * E.out(fl.k)} fill="none" stroke={BAD} strokeWidth={2} />
        </g>
      ))}
      {/* the two shapes */}
      {popO > 0 && (
        <g>
          {oPulse > 0 && oPulse < 1 && <circle cx={SX0} cy={SY} r={DOT + 12 * E.out(oPulse)} fill="none" stroke={INK} strokeWidth={2} opacity={1 - oPulse} />}
          <circle cx={SX0 + off[0]} cy={SY + off[1]} r={DOT * popScale(popO)} fill={oFill ? INK : 'var(--color-paper)'} stroke={INK} strokeWidth={2} />
          <Label x={SX0 - FENCE - 8} y={SY + 5} anchor="end" size={15} weight={600} rise={popO}>{tr('열린 백', 'open bag')}</Label>
        </g>
      )}
      {popF > 0 && (
        <g>
          <circle cx={SX1} cy={SY} r={DOT * popScale(popF) * (1 + 0.5 * Math.sin(Math.PI * fDone))} fill={fDone > 0.5 ? OK : 'var(--color-paper)'} stroke={fDone > 0.5 ? OK : INK} strokeWidth={2} />
          <Label x={SX1 + 14} y={SY + 5} anchor="start" size={15} weight={600} rise={popF}>{tr('납작한 백', 'flat bag')}</Label>
        </g>
      )}
      {dp && dot !== null && dot > 0.005 && dot < 0.995 && (
        <g>
          <circle cx={dp[0]} cy={dp[1]} r={11} fill={HOT_CSS} opacity={0.35 * Math.min(1, maxAt(dot) / PEAK.maxStrain)} />
          <circle cx={dp[0]} cy={dp[1]} r={DOT} fill={INK} stroke="var(--color-paper)" strokeWidth={1.5} />
          {readout > 0 && <Label x={dp[0] + lerp(12, -28, up)} y={dp[1] + lerp(13, -18, up)} anchor="start" size={14} weight={700} color={BAD} opacity={readout}>{tr(`지금 ${pct(maxAt(dot))}`, `now ${pct(maxAt(dot))}`)}</Label>}
        </g>
      )}
      {peak > 0 && (
        <g>
          <circle cx={pk[0]} cy={pk[1]} r={4.5 * popScale(peak)} fill={BAD} />
          <g transform={`translate(${pk[0]} ${pk[1] - 12}) scale(${popScale(peak)})`}>
            <Label x={0} y={0} size={15} weight={700} color={BAD}>{tr(`최대 ${pct(PEAK.maxStrain)}`, `max ${pct(PEAK.maxStrain)}`)}</Label>
          </g>
        </g>
      )}
      {axis > 0 && <Label x={240} y={287} size={13} color={INK2} rise={axis}>{tr('접는 정도 →', 'how far folded →')}</Label>}
    </g>
  );
}

// ───────────────────────────── scene timing from the caption

/** a scene lasts at least as long as a slow reader (6 characters a second) needs for its caption */
function timed(beats: Beat[], motion: number, lead: number) {
  const chars = beats.reduce((s, b) => s + b.text.length, 0) + beats.length - 1;
  return Math.max(motion, Math.ceil((chars * 1000) / 6) - lead - TAIL);
}
const joinText = (bs: Beat[]) => bs.map((b) => b.text).join(' ');

/** a fold progress that eases one way over [a, b] */
const along = (t: number, a: number, b: number) => seg(t, a, b, E.inOut);

export const bagScenes = (): Scene[] => {
  const siteNote = () => tr('사이트가 계산한 모양, 손잡이는 장식', 'shape computed by the site; handles are decoration');

  // 1. the bag opens: a flat bag springs up along the solver's path
  const b1: Beat[] = [
    { at: 0, text: tr('쇼핑백은 매일 이렇게 열고 접는다.', 'We open and fold paper bags like this every day.') },
    { at: 0.38, text: tr('옆면의 골접기(파랑)가 안으로 접혀 들어간다.', 'The valley folds (blue) on each side tuck inwards.') },
  ];
  const d1 = timed(b1, 6000, 150);
  const HOLD = 300, OPEN = 1800;
  const camS1 = (t: number) => {
    const ms = t * d1;
    const settle = E.inOut3((ms - HOLD) / (OPEN + 200));
    const c = mixCam(CAM_FLAT, CAM_BIG, settle);
    const end = HOLD + OPEN + 200;
    return withYaw(c, c.yaw + (YAW.s1 - CAM_BIG.yaw) * E.sine((ms - end) / (d1 - end)));
  };

  // 2. rigid plates: pushes do nothing
  const b2: Beat[] = [
    { at: 0, text: tr('면이 절대 휘지 않는 판이라고 해 보자.', 'Now suppose every face is a plate that never bends.') },
    { at: 0.48, text: tr('그러면 이 키 큰 백은 납작하게 접히지 않는다.', 'Then this tall bag cannot be folded flat.') },
  ];
  const d2 = timed(b2, 6200, 250);
  const camS2 = (t: number) => withYaw(CAM_BIG, lerp(YAW.s1, YAW.s2, E.sine(t)));

  // 3a. the map: two points, no path
  const b3: Beat[] = [
    { at: 0, text: tr('모양 하나를 점 하나로 찍은 지도다.', 'A map where each shape of the bag is one point.') },
    { at: 0.36, text: tr('판이 단단하면 열린 백에서 납작한 백으로 가는 길이 없다.', 'With rigid plates there is no path from the open bag to the flat one.') },
  ];
  const d3 = timed(b3, 7000, 250);
  const camS3 = (t: number) => {
    const k = seg(t, 0, 0.16, E.inOut3);
    return mixCam(withYaw(CAM_BIG, YAW.s2), fitCam(lerp(-44, YAW.s3a, E.sine((t - 0.16) / 0.84)), 40, 0), k);
  };

  // 3b. bending allowed: the path opens and the bag flattens on the same clock
  const b4: Beat[] = [
    { at: 0, text: tr('실제 종이는 조금 휘고 변형된다.', 'Real paper bends and deforms a little.') },
    { at: 0.22, text: tr('그걸 허용하면 길이 열리고 백이 납작해진다.', 'Allow that, and a path opens: the bag folds flat.') },
  ];
  const d4 = timed(b4, 6800, 250);
  const F0 = 0.14, F1 = 0.9;
  const camS4 = (t: number, u: number) => fitCam(lerp(YAW.s3a, YAW.s3b, E.sine(t)), 40, u);

  // 4. the cost, computed: the ticks join into the strain curve, and the bag opens again
  const b5: Beat[] = [
    { at: 0, text: tr('이것이 쇼핑백 정리다.', 'That is the shopping-bag theorem.') },
    { at: 0.26, text: tr('백이 접히는 건 종이가 조금 휘고 변형되기 때문이다.', 'A bag folds only because the paper bends and deforms a little.') },
  ];
  const d5 = timed(b5, 6600, 250);
  const R0 = 0.3, R1 = 0.88;
  const camS5 = (t: number, u: number) => fitCam(lerp(YAW.s3b, YAW.s4, E.sine(t)), 40, u);

  // the push arrows, in world space on the open bag
  const open = state(0).pts;
  const frontHit: V3 = [(open[4][0] + open[5][0]) / 2, open[4][1], 1.55];
  const sideHit: V3 = [open[11][0], open[11][1], 1.3];
  const push = (c: Cam, hit: V3, dir: V3, k: number, back: number) => {
    // k: 0..1 coming in (power2.in); back: 0..1 bouncing out (back.out)
    const far = 1.25, near = 0.06;
    const d = k < 1 ? lerp(far, near, k * k) : lerp(near, 0.55, E.back(1.8)(back));
    const tip: V3 = [hit[0] - dir[0] * d, hit[1] - dir[1] * d, hit[2] - dir[2] * d];
    const tail: V3 = [tip[0] - dir[0] * 1.0, tip[1] - dir[1] * 1.0, tip[2] - dir[2] * 1.0];
    const a = project(tail, c), b = project(tip, c);
    return { a: [a[0], a[1]] as P2, b: [b[0], b[1]] as P2 };
  };
  const hitMark = (c: Cam, hit: V3, k: number, xk: number, dx: number, dy: number) => {
    const h = project(hit, c);
    return (
      <g>
        {k > 0 && k < 1 && <circle cx={h[0]} cy={h[1]} r={4 + 18 * E.out(k)} fill="none" stroke={BAD} strokeWidth={2.5} opacity={1 - k} />}
        {xk > 0 && <g transform={`translate(${h[0] + dx} ${h[1] + dy}) scale(${popScale(xk)})`}><Label x={0} y={9} size={26} weight={700} color={BAD}>✗</Label></g>}
      </g>
    );
  };
  const rigidLabel = (op: number, r1: number, r2: number) => (
    <g opacity={op}>
      <Label x={22} y={48} anchor="start" size={16} weight={700} color={BAD} rise={r1}>{tr('단단한 판:', 'rigid plates:')}</Label>
      <Label x={22} y={72} anchor="start" size={16} weight={700} color={BAD} rise={r2}>{tr('✗ 접히지 않는다', '✗ it will not fold')}</Label>
    </g>
  );

  return [
    {
      duration: d1, view: 'oblique', viewNote: siteNote,
      beats: () => b1, caption: () => joinText(b1),
      draw: (t) => {
        const ms = t * d1;
        // hold flat while only the (decorative) handles lift, then open along the solver's path
        const p = 1 - E.inOut3((ms - HOLD) / OPEN);
        const lift = 0.6 * E.out(ms / 250) * p;
        const hi = seg(t, 0.39, 0.49, E.out) * (1 - seg(t, 0.9, 1, E.inOut));
        const c = camS1(t);
        // the label sits clear of the side wall, with a leader to its middle crease
        const g = project([open[11][0], open[11][1], 1.35], c);
        const edge = project([open[3][0], open[3][1], 1.35], c);
        const lx = Math.min(g[0], edge[0]) - 22;
        return (
          <g>
            <BagView p={p} cam={c} hi={hi} lift={lift} />
            {hi > 0 && <line x1={lx + 4} y1={g[1]} x2={g[0] - 5} y2={g[1]} stroke={VALLEY} strokeWidth={1.4} opacity={hi} />}
            <Label x={lx} y={g[1] + 5} anchor="end" size={15} weight={600} color={VALLEY} rise={hi}>{tr('골 (V)', 'valley (V)')}</Label>
          </g>
        );
      },
    },
    {
      duration: d2, lead: 250, join: 'none', view: 'oblique', viewNote: () => tr('사이트 계산, 화살표 = 미는 힘', 'site computation; arrows = pushes'),
      beats: () => b2, caption: () => joinText(b2),
      draw: (t) => {
        const c = camS2(t);
        const rigid = seg(t, 0, 0.1, E.out);
        // push 1 on the front wall, push 2 on the side gusset; each: in, hit, bounce back
        const in1 = seg(t, 0.1, 0.22, E.linear), bk1 = seg(t, 0.22, 0.36, E.linear);
        const in2 = seg(t, 0.5, 0.62, E.linear), bk2 = seg(t, 0.62, 0.76, E.linear);
        const a1 = push(c, frontHit, [0, 1, 0], in1, bk1), a2 = push(c, sideHit, [1, 0, 0], in2, bk2);
        const op1 = seg(t, 0.08, 0.12, E.out) * (1 - seg(t, 0.38, 0.44)), op2 = seg(t, 0.48, 0.52, E.out) * (1 - seg(t, 0.8, 0.86));
        return (
          <g>
            <BagView p={0} cam={c} rigid={rigid} />
            <Arrow a={a1.a} b={a1.b} op={op1} />
            <Arrow a={a2.a} b={a2.b} op={op2} />
            {hitMark(c, frontHit, seg(t, 0.22, 0.3, E.linear), seg(t, 0.23, 0.31, E.linear), 16, -20)}
            {hitMark(c, sideHit, seg(t, 0.62, 0.7, E.linear), seg(t, 0.63, 0.71, E.linear), -10, -24)}
            {rigidLabel(1, seg(t, 0.82, 0.9, E.out), seg(t, 0.86, 0.94, E.out))}
          </g>
        );
      },
    },
    {
      duration: d3, lead: 250, join: 'none', view: 'oblique', viewNote: () => tr('백은 사이트 계산, 아래 띠는 개념도', 'bag computed by the site; strip below is a diagram'),
      beats: () => b3, caption: () => joinText(b3),
      draw: (t) => {
        const c = camS3(t);
        const out = seg(t, 0, 0.1, E.out);
        // the same pushes as in the map, on the bag itself: in, hit, bounce back; nothing moves
        const ks = [seg(t, 0.46, 0.6, E.linear), seg(t, 0.6, 0.74, E.linear), seg(t, 0.74, 0.88, E.linear)];
        const where: [V3, V3][] = [[frontHit, [0, 1, 0]], [sideHit, [1, 0, 0]], [frontHit, [0, 1, 0]]];
        return (
          <g>
            <BagView p={0} cam={c} rigid={1} />
            {ks.map((k, i) => {
              if (k <= 0 || k >= 1) return null;
              const a = push(c, where[i][0], where[i][1], Math.min(1, k / 0.4), Math.max(0, (k - 0.4) / 0.6));
              const h = project(where[i][0], c), ring = seg(k, 0.4, 0.75, E.linear);
              return (
                <g key={i}>
                  <Arrow a={a.a} b={a.b} op={Math.min(1, k * 8, (1 - k) * 6)} />
                  {ring > 0 && ring < 1 && <circle cx={h[0]} cy={h[1]} r={4 + 16 * E.out(ring)} fill="none" stroke={BAD} strokeWidth={2.5} opacity={1 - ring} />}
                </g>
              );
            })}
            <g opacity={1 - out}>
              {rigidLabel(1, 1, 1)}
              {hitMark(c, frontHit, 1, 1, 16, -20)}
              {hitMark(c, sideHit, 1, 1, -10, -24)}
            </g>
            <Strip st={{
              show: seg(t, 0.06, 0.2, E.linear),
              popO: seg(t, 0.16, 0.24, E.linear), popF: seg(t, 0.2, 0.28, E.linear),
              noPath: seg(t, 0.36, 0.46, E.out),
              pushes: ks,
              noX: seg(t, 0.86, 0.94, E.linear),
              // one more beat of "no path" in the hold that ends the scene: nothing new, the ✗ and the fence once more
              noXAgain: seg(t * d3, d3 - 350, d3, E.linear),
              fenceFlash: seg(t * d3, d3 - 400, d3, E.linear),
            }} />
          </g>
        );
      },
    },
    {
      duration: d4, lead: 250, join: 'none', view: 'oblique', viewNote: () => tr('백과 색은 사이트 계산, 아래 띠는 개념도', 'bag and colour computed by the site; strip is a diagram'),
      beats: () => b4, caption: () => joinText(b4),
      draw: (t) => {
        const u = along(t, F0, F1);
        const c = camS4(t, u);
        const live = t > F0 && t < F1;
        const on = seg(t, 0.02, 0.14, E.out);
        return (
          <g>
            <BagView p={u} cam={c} rigid={1 - seg(t, 0, 0.12, E.out)} strain={on} ms={t * d4} />
            <Legend op={on} />
            <Strip st={{
              show: 1, popO: 1, popF: 1, noPath: 1, noX: 1, noOut: seg(t, 0.02, 0.12, E.out),
              gap: seg(t, 0.06, 0.13, E.out),
              drawn: u, dot: live ? u : null, oFill: t <= F0, readout: seg(t, F0, F0 + 0.06, E.out),
              ticks: u, tickNote: seg(t, F0 + 0.04, F0 + 0.1, E.out),
              // gone before the readout climbs above the dot, so the two never meet
              heightNote: seg(t, F0 + 0.04, F0 + 0.1, E.out) * (1 - seg(u, 0.62, 0.68, E.linear)),
              fDone: seg(t, F1, F1 + 0.08, E.linear),
            }} />
          </g>
        );
      },
    },
    {
      duration: d5, lead: 250, join: 'none', view: 'oblique', viewNote: () => tr('백과 그래프 모두 사이트 계산', 'bag and graph both computed by the site'),
      beats: () => b5, caption: () => joinText(b5),
      draw: (t) => {
        const back = along(t, R0, R1);
        const u = 1 - back;
        const c = camS5(t, u);
        const moving = t > R0 && t < R1;
        return (
          <g>
            <BagView p={u} cam={c} strain={1} ms={t * d5} />
            <Legend op={1} />
            <Label x={464} y={134} anchor="end" size={14} color={INK2} weight={600} rise={seg(t, 0.06, 0.16, E.out)}>{tr('Balkcom 외 (2004)', 'Balkcom et al. (2004)')}</Label>
            <Strip st={{
              show: 1, popO: 1, popF: 1, gap: 1, drawn: 1, red: seg(t, 0.02, 0.08, E.inOut),
              ticks: 1, tickOp: 1 - 0.7 * seg(t, 0.1, 0.2, E.inOut), tickNote: 1 - seg(t, 0, 0.06, E.in),
              dot: moving ? u : null, fDone: 1, oFill: t >= R1, oPulse: seg(t, R1, R1 + 0.1, E.linear),
              peak: seg(t, 0.1, 0.18, E.linear), swap: seg(t, 0.04, 0.2, E.linear), axis: seg(t, 0.16, 0.26, E.out),
            }} />
          </g>
        );
      },
    },
  ];
};
