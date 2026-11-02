import type { ReactNode } from 'react';
import { tr } from '../../i18n';
import { BAD, E, INK, INK2, INK3, Label, lerp, MOUNTAIN, OK, popScale, seg, VALLEY, type Beat, type Scene } from './Explainer';
import { add, cross, dot, Mesh, mix3, mul, norm, PAPER_FRONT, project, rotAbout, shadeFor, Shadow, sub, type Cam, type Face, type V3 } from './paper3d';
import data from './data/hyparFold.json';

/**
 * The hypar, drawn from the site's own Energy-solver output for sheet l6-hypar
 * (classic pattern, 6 rings, L = 2): 4 centre triangles + 24 trapezoids, 41
 * frames of the whole-pattern fold. Inside the solver each trapezoid is a pair
 * of triangles hinged along one diagonal (the "alternating asymmetric" layout of
 * Demaine et al. 2011, Fig. 4b), so the faces bend there; edge lengths also
 * change by up to maxStrain. Every number on screen is computed below from
 * these frames.
 */

// ───────────────────────────── data: the solver frames, in a symmetric frame

type Frame = { P: number[]; vs: number[]; maxStrain: number };
const FRAMES = data.frames as Frame[];
const FACES = data.faces as number[][];
const EDGES = data.edges as { v: number[]; a: string }[];
const FLAT = data.flat as number[][];
const NV = FLAT.length; // 29: centre + 7 squares × 4 corners
const NSQ = (NV - 1) / 4; // 7 squares, the last one is the paper edge
const RINGS = NSQ - 1; // 6 crease squares
const HALF = FLAT[NV - 1][0]; // half side of the sheet (2)
/** corner c (0..3 at 45°, 135°, 225°, 315°) of square k (1..NSQ) */
const Qv = (k: number, c: number) => 1 + 4 * (k - 1) + ((c + 4) % 4);
const ekey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
const ASSIGN = new Map(EDGES.map((e) => [ekey(e.v[0], e.v[1]), e.a]));

/**
 * The solver keeps one centre triangle fixed, so its frames are tilted. Re-express
 * each frame with the centre at the origin, the up axis across the two corner
 * diagonals, and the first corner diagonal back on the line y = x: a rigid change of frame only.
 */
function symFrame(P: number[]): V3[] {
  const V = (i: number): V3 => [P[3 * i], P[3 * i + 1], P[3 * i + 2]];
  const a = sub(V(Qv(NSQ, 0)), V(Qv(NSQ, 2))), b = sub(V(Qv(NSQ, 1)), V(Qv(NSQ, 3)));
  const up = norm(cross(a, b));
  const ex = norm(sub(a, mul(up, dot(a, up))));
  const ey = cross(up, ex);
  const X = norm(sub(ex, ey)), Y = norm(add(ex, ey));
  const o = V(0);
  return Array.from({ length: NV }, (_, i) => { const q = sub(V(i), o); return [dot(q, X), dot(q, Y), dot(q, up)] as V3; });
}
const SYM = FRAMES.map((f) => symFrame(f.P));
/** height that puts the lowest point on the table */
const LIFT = SYM.map((Q) => -Math.min(...Q.map((q) => q[2])));
const NF = FRAMES.length - 1;

/** solver shape at fold progress p (0..1), resting on the table */
function shape(p: number): V3[] {
  const x = Math.min(1, Math.max(0, p)) * NF;
  const i = Math.min(NF - 1, Math.floor(x)), k = x - i;
  const lift = lerp(LIFT[i], LIFT[i + 1], k);
  return SYM[i].map((q, v) => { const r = mix3(q, SYM[i + 1][v], k); return [r[0], r[1], r[2] + lift] as V3; });
}
const FINAL = shape(1);
const CENTRE_Z = FINAL[0][2];
const MAX_STRAIN = Math.max(...FRAMES.map((f) => f.maxStrain));
const VS = FRAMES[NF].vs;
const FACE_STRAIN = FACES.map((f) => f.reduce((a, v) => a + VS[v], 0) / f.length);


// ───────────────────────────── the crease pattern and its drawing order

type Style = { stroke: string; width: number; dash?: string };
const styleOf = (a: string | undefined, w = 1.8): Style =>
  a === 'M' ? { stroke: MOUNTAIN, width: w, dash: '9 3 2 3' } : a === 'V' ? { stroke: VALLEY, width: w, dash: '7 4' } : { stroke: INK, width: w * 0.9 };

/** squares are drawn outside in, alternating direction; each edge keeps the direction it was drawn in */
const ringOrder = (k: number) => NSQ - k; // 0 for the paper edge
const ringPath = (k: number) => (ringOrder(k) % 2 ? [0, 3, 2, 1, 0] : [0, 1, 2, 3, 0]);
const DIR = new Map<string, [number, number]>();
for (let k = 1; k <= NSQ; k++) {
  const p = ringPath(k);
  for (let i = 0; i < 4; i++) DIR.set(ekey(Qv(k, p[i]), Qv(k, p[i + 1])), [Qv(k, p[i]), Qv(k, p[i + 1])]);
}
for (let c = 0; c < 4; c++) {
  DIR.set(ekey(0, Qv(1, c)), [0, Qv(1, c)]);
  for (let j = 1; j < NSQ; j++) DIR.set(ekey(Qv(j, c), Qv(j + 1, c)), [Qv(j, c), Qv(j + 1, c)]);
}

/**
 * The diagonal along which the solver bends trapezoid (j, c), the same rule as
 * the site's generator (src/models/generators/hypar.ts). Face index 4 + 4(j−1) + c.
 */
function split(j: number, c: number): [number, number] {
  const P0 = Qv(j, c), P1 = Qv(j, c + 1), Q0 = Qv(j + 1, c), Q1 = Qv(j + 1, c + 1);
  return (c % 2 === 0) === (j % 2 === 1) ? [Q0, P1] : [Q1, P0];
}
const faceOf = (j: number, c: number) => 4 + 4 * (j - 1) + c;
const ADDED = RINGS * 4;
const HIDDEN = 'var(--color-unassigned)';
const MARK_RGB: [number, number, number] = [255, 224, 74];

/** crease lines on a face, in the drawing direction; `extra` adds the hidden diagonal revealed to k */
/** the triangulated pattern keeps only the centre diagonal through corners 0 and 2 */
const GONE_IN_TRI = new Set([ekey(0, Qv(1, 1)), ekey(0, Qv(1, 3))]);
function linesFor(fi: number, P: V3[], w: number, extra = 0, op = 1, tri = 0, glow = 0): NonNullable<Face['lines']> {
  const f = FACES[fi];
  const out: NonNullable<Face['lines']> = [];
  if (extra > 0 && fi >= 4) {
    const j = Math.floor((fi - 4) / 4) + 1, c = (fi - 4) % 4;
    const [u, v] = split(j, c);
    const b = mix3(P[u], P[v], Math.min(1, extra));
    if (glow > 0) out.push({ a: P[u], b, stroke: 'var(--color-mark)', width: 6, opacity: glow });
    out.push({ a: P[u], b, stroke: HIDDEN, width: w * 1.1, dash: '4 3' });
  }
  for (let i = 0; i < f.length; i++) {
    const key = ekey(f[i], f[(i + 1) % f.length]);
    const [a, b] = DIR.get(key)!;
    const s = styleOf(ASSIGN.get(key), w);
    const o = GONE_IN_TRI.has(key) ? op * (1 - tri) : op;
    if (o > 0) out.push({ a: P[a], b: P[b], stroke: s.stroke, width: s.width, dash: s.dash, opacity: o });
  }
  return out;
}

// ───────────────────────────── cameras

const D2R = Math.PI / 180;
const TOP = { pitch: 90, scale: 54, cx: 290, cy: 150 };
const PITCH = 30, SCALE = 58;
/** S1 ends turned to Y0; S2's turntable goes to Y1, where the high corners sit left and right */
const Y0 = 24, Y1 = 62;
/** scene 5 swings back to 35° from frontal, where all four corners stand apart */
/** scene 5 keeps scene 2's saddle view (Y1, pitch 30) and only drifts */
const Y5 = Y1 - 8, P5 = PITCH;
type Basis = { r: V3; u: V3; w: V3 };
function basisOf(yaw: number, pitch: number): Basis {
  const y = yaw * D2R, p = pitch * D2R;
  const r: V3 = [Math.cos(y), Math.sin(y), 0];
  const fwd: V3 = [-Math.sin(y) * Math.cos(p), Math.cos(y) * Math.cos(p), -Math.sin(p)];
  return { r, u: cross(r, fwd), w: mul(fwd, -1) as V3 };
}
/** a camera that puts the paper's centre vertex (height cz) at screen (cx, cyC) */
function camAt(yaw: number, pitch: number, scale: number, cx: number, cyC: number, cz: number): Cam {
  return { yaw, pitch, scale, cx, cy: cyC + cz * Math.cos(pitch * D2R) * scale };
}
/** the folded sheet's screen box is centred at y = 146 (room for two lines of labels below) */
const fitAt = (yaw: number, at = 146, pitch = PITCH) => {
  const b = basisOf(yaw, pitch);
  const ys = FINAL.map((q) => -dot(sub(q, FINAL[0]), b.u) * SCALE);
  return at - (Math.max(...ys) + Math.min(...ys)) / 2;
};
const FIT_CY = fitAt(Y1), FIT_CY5 = fitAt(Y5, 150, P5);
/** scene 5's camera: once the piece is home (1050 ms) it drifts slowly from Y1 to Y5, so the picture never freezes */
const yaw5 = (ms: number) => lerp(Y1, Y5, seg(ms, 1050, 9000, E.linear));
const pitch5 = (_ms: number) => P5;
/**
 * z (0..1) pulls the camera back and right, to clear the top-left corner for text (scene 5);
 * g (0..1) sinks the sheet into a small ghost behind the lifted piece (scenes 3–4).
 */
const mainCam = (yaw: number, z = 0, g = 0, pitch = PITCH) =>
  camAt(yaw, pitch, SCALE * (1 - 0.14 * z) * (1 - 0.2 * g), 240 + 26 * z, lerp(FIT_CY, FIT_CY5, z) + 20 * g, CENTRE_Z);

// ───────────────────────────── rotations (to turn the lifted piece on its own)

type M3 = [V3, V3, V3]; // rows
const I3: M3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const app = (M: M3, p: V3): V3 => [dot(M[0], p), dot(M[1], p), dot(M[2], p)];
const tp = (M: M3): M3 => [[M[0][0], M[1][0], M[2][0]], [M[0][1], M[1][1], M[2][1]], [M[0][2], M[1][2], M[2][2]]];
const mm = (A: M3, B: M3): M3 => { const Bt = tp(B); return A.map((row) => Bt.map((col) => dot(row, col))) as M3; };
/** the rotation taking the orthonormal frame a → b */
const frameTo = (a: V3[], b: V3[]): M3 => [0, 1, 2].map((r) => [0, 1, 2].map((c) => a.reduce((s, ai, i) => s + b[i][r] * ai[c], 0))) as M3;
const rotM = (axis: V3, deg: number): M3 => tp([rotAbout([1, 0, 0], [0, 0, 0], axis, deg), rotAbout([0, 1, 0], [0, 0, 0], axis, deg), rotAbout([0, 0, 1], [0, 0, 0], axis, deg)]);
function axisAngle(M: M3): { axis: V3; deg: number } {
  const c = Math.max(-1, Math.min(1, (M[0][0] + M[1][1] + M[2][2] - 1) / 2));
  const th = Math.acos(c);
  if (th < 1e-6) return { axis: [0, 0, 1], deg: 0 };
  return { axis: norm([M[2][1] - M[1][2], M[0][2] - M[2][0], M[1][0] - M[0][1]]), deg: th / D2R };
}
/** a → b by a fraction k of the turn between them */
function slerpM(a: M3, b: M3, k: number): M3 {
  if (k <= 0) return a;
  const { axis, deg } = axisAngle(mm(b, tp(a)));
  return mm(rotM(axis, deg * Math.min(1, k)), a);
}

// ───────────────────────────── the lifted trapezoid (signature)

/** trapezoid (ring 1, side c = 2): near the viewer, and its bend is the clearest */
const PJ = 1, PC = 2;
const PIECE = faceOf(PJ, PC);
const [DG_U, DG_V] = split(PJ, PC); // the diagonal the solver bends along
const PV = FACES[PIECE]; // [P0, Q0, Q1, P1]
const INNER = [Qv(PJ, PC), Qv(PJ, PC + 1)], OUTER = [Qv(PJ + 1, PC), Qv(PJ + 1, PC + 1)];
/** triangle A: the diagonal and the inner edge; triangle B: the diagonal and the other outer corner */
const keepWinding = (tri: number[]) => PV.filter((v) => tri.includes(v));
const TA = keepWinding([DG_U, DG_V, ...INNER]);
const D_OFF = PV.find((v) => !TA.includes(v))!;
const TB = keepWinding([DG_U, DG_V, D_OFF]);
const C_P = mul(PV.reduce((s, v) => add(s, FINAL[v]), [0, 0, 0] as V3), 1 / PV.length);
const LOCAL = (v: number) => sub(FINAL[v], C_P);
/** front normals (the paper's front, by the quad's winding) */
const nOf = (tri: number[]) => { const [a, b, c] = tri.map((v) => FINAL[v]); return norm(cross(sub(b, a), sub(c, a))); };
const NA = nOf(TA), NB = nOf(TB);
/** Δ: distance of the fourth corner from the plane of the other three (triangle A) */
const DELTA = Math.abs(dot(sub(FINAL[D_OFF], FINAL[TA[0]]), NA));
const BEND = Math.acos(Math.min(1, dot(NA, NB))) / D2R;
/** with a 20 cm sheet (side 2·HALF units) */
const SHEET_CM = 20;
const DELTA_MM = (DELTA / (2 * HALF)) * SHEET_CM * 10;

const PIECE_CAM = basisOf(Y1, PITCH);
/** the turn that lays a plane (normal n, in-plane edge u→v) edge-on and level: n → screen up, edge → screen right; the smallest such turn from `from` */
function levelTurn(n: V3, u: number, v: number, from: M3): M3 {
  const e0 = norm(sub(sub(FINAL[v], FINAL[u]), mul(n, dot(sub(FINAL[v], FINAL[u]), n))));
  const { r, u: up, w } = PIECE_CAM;
  let best = I3, bd = 1e9;
  for (const se of [1, -1]) for (const sn of [1, -1]) {
    const e = mul(e0, se) as V3, nn = mul(n, sn) as V3;
    const M = frameTo([e, nn, cross(e, nn)], [r, up, w]);
    const d = axisAngle(mm(M, tp(from))).deg;
    if (d < bd) { bd = d; best = M; }
  }
  return best;
}
/** the piece seen face-on first (front towards the viewer, outer edge level), so it reads as a trapezoid */
const R_FACE = (() => {
  const n = norm(add(NA, NB));
  const d = sub(FINAL[OUTER[1]], FINAL[OUTER[0]]);
  const e = norm(sub(d, mul(n, dot(d, n))));
  const { r, u, w } = PIECE_CAM;
  const down = mul(u, -1) as V3;
  const a = frameTo([e, n, cross(e, n)], [r, w, down]);
  const eb = mul(e, -1) as V3;
  const b = frameTo([eb, n, cross(eb, n)], [r, w, down]);
  return axisAngle(a).deg <= axisAngle(b).deg ? a : b;
})();
const RA = levelTurn(NA, INNER[0], INNER[1], R_FACE);
/** turning about screen up keeps triangle A edge-on */
const RA_SWING = mm(rotM(PIECE_CAM.u, 16), RA);
const RB = levelTurn(NB, OUTER[0], OUTER[1], RA_SWING);
/**
 * Look straight along the diagonal: both triangles contain it, so both are lines at once,
 * and the angle between the two lines is the true bend between their planes.
 */
const R_HINGE = (() => {
  const h0 = norm(sub(FINAL[DG_V], FINAL[DG_U]));
  const m = norm(add(NA, NB));
  const { r, u, w } = PIECE_CAM;
  let best = I3, bd = 1e9;
  for (const sh of [1, -1]) {
    const h = mul(h0, sh) as V3;
    const M = frameTo([h, m, cross(h, m)], [w, u, mul(r, -1) as V3]);
    const d = axisAngle(mm(M, tp(RB))).deg;
    if (d < bd) { bd = d; best = M; }
  }
  return best;
})();
const PX = 240, PY = 135, PS = SCALE * 3.4;

interface Pose { R: M3; yaw: number; cx: number; cy: number; scale: number }
const camOfPose = (p: Pose): Cam => ({ yaw: p.yaw, pitch: PITCH, scale: p.scale, cx: p.cx, cy: p.cy });
function homePose(yaw: number, z = 0, g = 0): Pose {
  const cam = mainCam(yaw, z, g);
  const [x, y] = project(C_P, cam);
  return { R: I3, yaw, cx: x, cy: y, scale: cam.scale };
}
const mixPose = (a: Pose, b: Pose, k: number): Pose => ({ R: slerpM(a.R, b.R, k), yaw: lerp(a.yaw, b.yaw, k), cx: lerp(a.cx, b.cx, k), cy: lerp(a.cy, b.cy, k), scale: lerp(a.scale, b.scale, k) });
const at = (pose: Pose, q: V3) => project(app(pose.R, q), camOfPose(pose));

const ghost3 = (t: number) => seg(t, 0.04, 0.2, E.inOut);
function pose3(t: number): Pose {
  const home = homePose(Y1, 0, ghost3(t));
  const lifted: Pose = { ...home, cy: home.cy - 40, scale: SCALE * 1.6 };
  const p1 = mixPose(home, lifted, seg(t, 0.02, 0.13, E.out3));
  const p2 = mixPose(p1, { R: R_FACE, yaw: Y1, cx: PX, cy: PY, scale: PS }, seg(t, 0.1, 0.27));
  const p3 = mixPose(p2, { ...p2, R: RA }, seg(t, 0.29, 0.41));
  return mixPose(p3, { ...p3, R: RA_SWING }, seg(t, 0.7, 1, E.linear));
}
const POSE3_END: Pose = { R: RA_SWING, yaw: Y1, cx: PX, cy: PY, scale: PS };
/** scene 4 beats (fractions of the scene) */
const S4 = { split: [0.02, 0.16], shrink: [0.1, 0.165], toB: [0.3, 0.48], toH: [0.58, 0.8] } as const;
/** turning about the line of sight keeps the diagonal end-on */
const R_HINGE_END = mm(rotM(PIECE_CAM.w, 7), R_HINGE);
function pose4(t: number): Pose {
  const a = mixPose(POSE3_END, { ...POSE3_END, R: RB }, seg(t, S4.toB[0], S4.toB[1]));
  const b = mixPose(a, { ...POSE3_END, R: R_HINGE }, seg(t, S4.toH[0], S4.toH[1], E.inOut3));
  return mixPose(b, { ...POSE3_END, R: R_HINGE_END }, seg(t, S4.toH[1], 1, E.linear));
}
const POSE4_END: Pose = { ...POSE3_END, R: R_HINGE_END };

// ───────────────────────────── drawing pieces

const PAPER_TOP = shadeFor([0, 0, 1], PAPER_FRONT);
/** strain colour over the Lambert shade, weight 0.7·clamp(face strain / maxStrain)^1.8: the lower half stays nearly paper */
const HOT_RGB: [number, number, number] = [240, 110, 40];
/** the face with the largest strain (it gets one pulse ring in scene 5) */
const HOT_FACE = FACE_STRAIN.indexOf(Math.max(...FACE_STRAIN));
type PerFace = number | ((fi: number) => number);
const perFace = (v: PerFace, fi: number) => (typeof v === 'number' ? v : v(fi));

/** the whole sheet as shaded faces */
function Sheet({ P, cam, lines = 1, extra = 0, glow = 0, tri = 0, strain = 0, hide = -1, slot = 0, op = 1, shadow = 0.15, seam = 1 }: {
  P: V3[]; cam: Cam; lines?: number; extra?: PerFace; glow?: PerFace; tri?: number; strain?: number; hide?: number; slot?: number; op?: number; shadow?: number; seam?: number;
}) {
  const faces: Face[] = FACES.map((f, i) => {
    const s = strain > 0 ? 0.7 * Math.min(1, Math.max(0, FACE_STRAIN[i] / MAX_STRAIN)) ** 1.8 * strain : 0;
    return {
      key: 'f' + i,
      pts: f.map((v) => P[v]),
      over: i === hide && slot > 0 ? { c: MARK_RGB, k: 0.75 * slot } : s > 0 ? { c: HOT_RGB, k: s } : undefined,
      lines: lines > 0 ? linesFor(i, P, 1.8, perFace(extra, i), lines, tri, perFace(glow, i)) : undefined,
    };
  });
  // flat and seen from above, the seams take the paper's own colour so no ghost rings show
  const edge = seam > 0 ? `rgba(23,32,42,${(0.22 * seam).toFixed(3)})` : PAPER_TOP;
  return (
    <g opacity={op}>
      {shadow > 0 && <Shadow faces={faces} cam={cam} opacity={shadow} id="hy-shadow" />}
      <Mesh faces={faces} cam={cam} edge={edge} edgeWidth={0.6} />
    </g>
  );
}

/** a crease drawn from a to a + k(b − a): the dash pattern starts at a, so a partial line is a prefix of the full one */
function Crease({ a, b, k, s, cam }: { a: V3; b: V3; k: number; s: Style; cam: Cam }) {
  if (k <= 0) return null;
  const A = project(a, cam), B = project(mix3(a, b, Math.min(1, k)), cam);
  return <line x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} stroke={s.stroke} strokeWidth={s.width} strokeDasharray={s.dash} strokeLinecap="round" />;
}

function Arrow({ from, to, color = INK2, op = 1, width = 2 }: { from: [number, number]; to: [number, number]; color?: string; op?: number; width?: number }) {
  const dx = to[0] - from[0], dy = to[1] - from[1], L = Math.hypot(dx, dy);
  if (L < 6 || op <= 0) return null;
  const ux = dx / L, uy = dy / L, h = Math.min(10, L * 0.45);
  const head = `${to[0]},${to[1]} ${to[0] - ux * h - uy * h * 0.55},${to[1] - uy * h + ux * h * 0.55} ${to[0] - ux * h + uy * h * 0.55},${to[1] - uy * h - ux * h * 0.55}`;
  return (
    <g opacity={op}>
      <line x1={from[0]} y1={from[1]} x2={to[0] - ux * h * 0.6} y2={to[1] - uy * h * 0.6} stroke={color} strokeWidth={width} strokeLinecap="round" />
      <polygon points={head} fill={color} />
    </g>
  );
}

const Dot = ({ p, r = 4, color = INK, k = 1 }: { p: number[]; r?: number; color?: string; k?: number }) =>
  k > 0 ? <circle cx={p[0]} cy={p[1]} r={r * popScale(k)} fill={color} stroke="var(--color-paper)" strokeWidth={1.5} /> : null;

function Legend({ k = [1, 1, 1, 1] }: { k?: number[] }) {
  return (
    <g>
      <Label x={28} y={92} anchor="start" size={15} weight={700} rise={k[0]}>{tr(`정사각형 고리 ${RINGS}개`, `${RINGS} square rings`)}</Label>
      <g opacity={k[1]}>
        <line x1={30} y1={124} x2={66} y2={124} stroke={MOUNTAIN} strokeWidth={2.2} strokeDasharray="9 3 2 3" />
        <Label x={74} y={129} anchor="start" size={15}>{tr('산 (M)', 'mountain (M)')}</Label>
      </g>
      <g opacity={k[2]}>
        <line x1={30} y1={154} x2={66} y2={154} stroke={VALLEY} strokeWidth={2.2} strokeDasharray="7 4" />
        <Label x={74} y={159} anchor="start" size={15}>{tr('골 (V)', 'valley (V)')}</Label>
      </g>
      <Label x={28} y={196} anchor="start" size={14} color={INK2} rise={k[3]}>{tr('번갈아 놓인다', 'they alternate')}</Label>
    </g>
  );
}

// ───────────────────────────── scene 1: the crease pattern draws itself

function topCam(t: number, D: number): Cam {
  const turn = seg(t * D, 2000, D, (x) => Math.min(1, Math.max(0, x)) ** 2);
  return { ...TOP, yaw: Y0 * turn, scale: TOP.scale + 2 * turn };
}

function CPDraw({ t, D }: { t: number; D: number }) {
  const ms = t * D;
  const cam = topCam(t, D);
  const P = shape(0);
  const out: ReactNode[] = [];
  // squares, outside in, each 380 ms, 180 ms apart, alternating direction
  for (let k = NSQ; k >= 1; k--) {
    const kk = E.out3((ms - ringOrder(k) * 180) / 380);
    const p = ringPath(k);
    for (let i = 0; i < 4; i++) {
      const a = Qv(k, p[i]), b = Qv(k, p[i + 1]);
      out.push(<Crease key={`r${k}${i}`} a={P[a]} b={P[b]} k={kk * 4 - i} s={styleOf(ASSIGN.get(ekey(a, b)))} cam={cam} />);
    }
  }
  // diagonals last, from the centre out
  const d0 = (NSQ - 1) * 180 + 380 + 60;
  const kd = E.out3((ms - d0) / 520);
  for (let c = 0; c < 4; c++) {
    const chain = [0, ...Array.from({ length: NSQ }, (_, j) => Qv(j + 1, c))];
    for (let j = 0; j < NSQ; j++) out.push(<Crease key={`d${c}${j}`} a={P[chain[j]]} b={P[chain[j + 1]]} k={kd * NSQ - j} s={styleOf(ASSIGN.get(ekey(chain[j], chain[j + 1])))} cam={cam} />);
  }
  const lg = (d: number) => E.out((ms - d) / 320);
  const L0 = d0 + 360;
  // frame 0: a crisp pencil outline of the sheet; the soft shadow only follows the ink
  const rim = [0, 1, 2, 3].map((c) => project(P[Qv(NSQ, c)], cam));
  return (
    <g>
      <Sheet P={P} cam={cam} lines={0} shadow={0.12 * E.out3(ms / 700)} seam={0} />
      <polygon points={rim.map((q) => `${q[0]},${q[1]}`).join(' ')} fill="none" stroke="var(--color-rule-2)" strokeWidth={1} />
      {out}
      <Legend k={[lg(L0 - 200), lg(L0), lg(L0 + 140), lg(L0 + 420)]} />
    </g>
  );
}

// ───────────────────────────── scene 2: tilt, fold along the solver path, turn, the two curves

const S2 = { tilt: 1100, foldA: 900, foldB: 3200, arrowsA: 2700, arrowsB: 3500, turnA: 2800, turnB: 5000, curveA: 3300, curveB: 4100, inset: 4300, label: 4900, end: 6000 };
function s2State(t: number, D: number) {
  const ms = t * D;
  const kt = seg(ms, 0, S2.tilt, E.sine);
  const p = 0.12 * kt + 0.88 * seg(ms, S2.foldA, S2.foldB, E.inOut);
  // the turntable eases to Y1 − 6, then keeps a slow linear turn to Y1 at the scene's end
  const yaw = Y0 + 6 * E.out3(ms / 1100) + (Y1 - Y0 - 12) * seg(ms, S2.turnA, S2.turnB, E.sine) + 6 * seg(ms, S2.turnB, D, E.linear);
  const P = shape(p);
  const fit = lerp(TOP.cy, FIT_CY, kt);
  const cam = camAt(yaw, lerp(TOP.pitch, PITCH, kt), lerp(TOP.scale + 2, SCALE, kt), lerp(TOP.cx, 240, kt), fit, P[0][2]);
  return { P, cam, ms, kt };
}

/** height arrows: from the centre's height to each paper corner, each labelled */
function Heights({ P, cam, k, hideFar = 0 }: { P: V3[]; cam: Cam; k: number; hideFar?: number }) {
  if (k <= 0) return null;
  const z0 = P[0][2];
  const corners = [0, 1, 2, 3].map((c) => Qv(NSQ, c));
  const feet = corners.map((v) => project([P[v][0], P[v][1], z0], cam));
  const tips = corners.map((v) => project(P[v], cam));
  const cz = project(P[0], cam);
  const far = (c: number) => tips[c][2] < cz[2];
  return (
    <g>
      <polygon points={feet.map((f) => `${f[0]},${f[1]}`).join(' ')} fill="none" stroke={INK3} strokeWidth={1} strokeDasharray="3 4" opacity={0.7 * k} />
      {corners.map((v, c) => {
        const tip: [number, number] = [feet[c][0] + (tips[c][0] - feet[c][0]) * k, feet[c][1] + (tips[c][1] - feet[c][1]) * k];
        return <Arrow key={c} from={[feet[c][0], feet[c][1]]} to={tip} color={P[v][2] > z0 ? OK : BAD} op={Math.min(1, k * 1.5)} />;
      })}
      {corners.map((v, c) => {
        const up = P[v][2] > z0;
        const right = tips[c][0] > cz[0];
        const back = !up && far(c);
        const dy = up ? -10 : back ? -18 : 18;
        return (
          <Label key={'l' + c} x={tips[c][0] + (right ? 10 : -10)} y={tips[c][1] + dy} anchor={right ? 'start' : 'end'} size={13} weight={700} color={up ? OK : BAD} opacity={back ? 1 - hideFar : 1} rise={seg(k, 0.4 + 0.1 * c, 0.8 + 0.05 * c, E.out)}>
            {up ? tr('올라감', 'up') : tr('내려감', 'down')}
          </Label>
        );
      })}
    </g>
  );
}

/** the cut along each corner diagonal, through the solver's own vertices: ∪ through the rising corners, ∩ through the sinking ones */
/** ring corners along one diagonal: the corner, the even rings and the centre (the pleat pairs make odd rings a stair) */
const KS = [NSQ, ...Array.from({ length: NSQ }, (_, j) => NSQ - 1 - j).filter((k) => k > 0 && k % 2 === 0)];
const CHAIN = (c: number) => [...KS.map((k) => Qv(k, c + 2)), 0, ...[...KS].reverse().map((k) => Qv(k, c))];
function SaddleCurves({ P, cam, k, kLab }: { P: V3[]; cam: Cam; k: number; kLab: number }) {
  if (k <= 0) return null;
  const draw = (c: number, color: string) => {
    const ch = CHAIN(c), mid = KS.length, reach = k * KS.length;
    const pts: number[][] = [];
    for (let i = 0; i < ch.length; i++) {
      const d = Math.abs(i - mid);
      if (d <= reach) pts.push(project(P[ch[i]], cam));
      else if (d - 1 < reach) {
        // the partial last segment
        const j = i < mid ? i + 1 : i - 1, f = reach - (d - 1);
        const A = project(P[ch[j]], cam), B = project(P[ch[i]], cam);
        const q = [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f];
        if (i < mid) pts.unshift(q); else pts.push(q);
      }
    }
    const d = pts.map((q, i) => `${i ? 'L' : 'M'}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ');
    return (
      <g key={c}>
        <path d={d} fill="none" stroke="var(--color-paper)" strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />
        <path d={d} fill="none" stroke={color} strokeWidth={3.2} strokeLinejoin="round" strokeLinecap="round" />
      </g>
    );
  };
  const rising = P[Qv(NSQ, 0)][2] > P[0][2] ? 0 : 1;
  return (
    <g>
      {draw(rising, OK)}
      {draw(1 - rising, BAD)}
      <Label x={240} y={290} size={15} weight={700} rise={kLab}>
        <tspan fill={OK}>{tr('한쪽은 ∪', 'one way ∪')}</tspan>
        <tspan>{', '}</tspan>
        <tspan fill={BAD}>{tr('다른 쪽은 ∩', 'the other ∩')}</tspan>
        <tspan>{tr(' = 말안장', ' = a saddle')}</tspan>
      </Label>
    </g>
  );
}


/**
 * A small side view of both diagonal cuts, from the solver's own heights: position along the
 * diagonal across, height up (relative to the centre). Green through the rising corners, red through the sinking ones.
 */
function ProfileInset({ P, k }: { P: V3[]; k: number }) {
  if (k <= 0) return null;
  const x0 = 18, y0 = 196, w = 118, h = 66, mid = y0 + h * 0.45;
  const z0 = P[0][2];
  const R0 = Math.hypot(P[Qv(NSQ, 0)][0], P[Qv(NSQ, 0)][1]) || 1;
  const sc = 22;
  const prof = (c: number) => {
    const dir = norm([P[Qv(NSQ, c)][0] - P[Qv(NSQ, c + 2)][0], P[Qv(NSQ, c)][1] - P[Qv(NSQ, c + 2)][1], 0]);
    const ch = CHAIN(c), n = ch.length, reach = k * (n - 1) / 2, m = (n - 1) / 2;
    const pts = ch.map((v) => [x0 + w / 2 + (dot([P[v][0], P[v][1], 0], dir) / R0) * (w / 2 - 8), mid - (P[v][2] - z0) * sc]);
    const vis = pts.filter((_, i) => Math.abs(i - m) <= reach + 1e-9);
    return vis.map((q, i) => `${i ? 'L' : 'M'}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ');
  };
  const rising = P[Qv(NSQ, 0)][2] > z0 ? 0 : 1;
  return (
    <g opacity={Math.min(1, k * 3)}>
      <rect x={x0 - 6} y={y0 - 8} width={w + 12} height={h + 16} rx={4} fill="var(--color-paper)" stroke="var(--color-rule-2)" strokeWidth={1} />
      <line x1={x0} y1={mid} x2={x0 + w} y2={mid} stroke={INK3} strokeWidth={0.8} strokeDasharray="2 3" />
      <path d={prof(rising)} fill="none" stroke={OK} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
      <path d={prof(1 - rising)} fill="none" stroke={BAD} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
      <Label x={x0 - 4} y={y0 - 14} anchor="start" size={12.5} color={INK2} rise={seg(k, 0.5, 1, E.out)}>{tr('대각선 단면 (옆에서)', 'the diagonals, side view')}</Label>
    </g>
  );
}

// ───────────────────────────── scenes 3–4: the piece

/**
 * The lifted trapezoid. `emph` [A, B] (0..1) turns a triangle that is edge-on into a thick
 * ink line (its fill fades, its outline grows 2.5 → 5); `sight` [A, B] draws a dotted sight
 * line 40 units past each end.
 */
function Piece({ pose, split: sp = 0, outline = 1, lift = 1, emph = [0, 0], sight = [0, 0] }: {
  pose: Pose; split?: number; outline?: number; lift?: number; emph?: number[]; sight?: number[];
}) {
  const cam = camOfPose(pose);
  const W: V3[] = []; PV.forEach((v) => { W[v] = app(pose.R, LOCAL(v)); });
  const sw = 1.8 * outline + 0.6;
  const tris = [TA, TB];
  const faces: Face[] = sp > 0
    ? tris.map((tri, i) => ({ key: 'AB'[i], pts: tri.map((v) => W[v]), stroke: INK, strokeWidth: sw, opacity: 1 - emph[i] }))
    : [{ key: 'Q', pts: PV.map((v) => W[v]), stroke: INK, strokeWidth: sw }];
  const scr = (tri: number[]) => tri.map((v) => project(W[v], cam));
  const ends = (q: number[][]) => {
    let a = q[0], b = q[1], best = -1;
    for (const p of q) for (const r of q) { const d = Math.hypot(p[0] - r[0], p[1] - r[1]); if (d > best) { best = d; a = p; b = r; } }
    const L = best || 1;
    return { a, b, ux: (b[0] - a[0]) / L, uy: (b[1] - a[1]) / L };
  };
  return (
    <g>
      {lift > 0 && (
        <g filter="url(#xp-softer)" opacity={0.2 * lift}>
          <polygon points={PV.map((v) => { const p = project(W[v], cam); return `${p[0] + 5},${p[1] + 12}`; }).join(' ')} fill={INK} />
        </g>
      )}
      <Mesh faces={faces} cam={cam} />
      {sp > 0 && <Crease a={W[DG_U]} b={W[DG_V]} k={sp} s={{ stroke: HIDDEN, width: 2.6, dash: '5 3' }} cam={cam} />}
      {sp > 0 && tris.map((tri, i) => (emph[i] > 0 ? (
        <polygon key={'e' + i} points={scr(tri).map((q) => `${q[0]},${q[1]}`).join(' ')} fill="none" stroke={INK} strokeWidth={2.5 + 3.5 * emph[i]} strokeLinejoin="round" opacity={emph[i]} />
      ) : null))}
      {tris.map((tri, i) => {
        if (sight[i] <= 0) return null;
        const { a, b, ux, uy } = ends(scr(tri));
        const e = 40 * sight[i];
        return <line key={'s' + i} x1={a[0] - ux * e} y1={a[1] - uy * e} x2={b[0] + ux * e} y2={b[1] + uy * e} stroke={OK} strokeWidth={1.6} strokeDasharray="2 3" />;
      })}
    </g>
  );
}

/**
 * Triangle ①'s three corners on one line (edge-on, so one plane) and the gap Δ to the fourth
 * corner. `count` runs the number 0 → Δ; `shrink` takes the gap back to 0 once the diagonal makes
 * that corner a corner of triangle ②; `fade` removes the marks.
 */
function GapMarks({ pose, kLine, kGap, count, kLab, fine = 0, fade = 0 }: { pose: Pose; kLine: number; kGap: number; count: number; kLab: number; fine?: number; fade?: number }) {
  if (fade >= 1) return null;
  const three = TA.map((v) => at(pose, LOCAL(v)));
  const xs = three.map((p) => p[0]);
  const a = three[xs.indexOf(Math.min(...xs))], b = three[xs.indexOf(Math.max(...xs))];
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
  const ext = 40 * kLine;
  const l0 = [a[0] - ux * ext, a[1] - uy * ext], l1 = [b[0] + ux * ext, b[1] + uy * ext];
  const Dq = LOCAL(D_OFF);
  const foot = sub(Dq, mul(NA, dot(sub(Dq, LOCAL(TA[0])), NA)));
  const D = at(pose, Dq), F = at(pose, foot);
  // the gap grows from the line to the corner; it never shrinks: the corner does not move
  const G = [F[0] + (D[0] - F[0]) * kGap, F[1] + (D[1] - F[1]) * kGap];
  const below = D[1] > F[1];
  const mmv = Math.round(DELTA_MM);
  const ly = (F[1] + D[1]) / 2 + (below ? 14 : 2);
  const done = fine > 0.5;
  return (
    <g opacity={1 - fade}>
      {kLine > 0 && <line x1={l0[0]} y1={l0[1]} x2={l1[0]} y2={l1[1]} stroke={INK} strokeWidth={1.3} strokeDasharray="2 3" opacity={0.85} />}
      {three.map((p, i) => <Dot key={i} p={p} r={4.6} k={seg(kLine, i * 0.2, 0.4 + i * 0.2, E.linear)} />)}
      {kGap > 0 && <line x1={F[0]} y1={F[1]} x2={G[0]} y2={G[1]} stroke={done ? OK : BAD} strokeWidth={3.6} strokeLinecap="round" />}
      <Dot p={D} r={5} color={done ? OK : BAD} k={kGap} />
      <Label x={l0[0]} y={Math.min(l0[1], l1[1]) - 14} anchor="start" size={15} weight={600} rise={kLine * (1 - fine)}>{tr('세 꼭짓점: 한 평면 (옆에서 한 줄)', 'three corners: one plane (one line, edge-on)')}</Label>
      <Label x={D[0] + 12} y={ly} anchor="start" size={18} weight={700} color={done ? OK : BAD} rise={count}>{`Δ ≈ ${mmv} mm`}</Label>
      <Label x={468} y={ly + 26} anchor="end" size={13} color={INK2} rise={kLab}>{tr(`(세 꼭짓점의 평면에서, 종이 한 변 ${SHEET_CM} cm)`, `(from the three corners' plane, ${SHEET_CM} cm sheet)`)}</Label>
      <Label x={468} y={ly + 52} anchor="end" size={14} weight={700} color={OK} rise={seg(fine, 0.5, 1, E.out)}>{tr('이제 삼각형 ②의 꼭짓점이라 괜찮다 ✓', 'now a corner of triangle ②, so fine ✓')}</Label>
    </g>
  );
}

/** "한 줄 ✓" for a triangle that now shows as one line: back.out(1.8) */
function Tick({ pose, tri, k, label, below, dx = 0 }: { pose: Pose; tri: number[]; k: number; label: string; below: boolean; dx?: number }) {
  if (k <= 0) return null;
  const c = mul(tri.reduce((s, v) => add(s, LOCAL(v)), [0, 0, 0] as V3), 1 / 3);
  const [x0, y] = at(pose, c);
  const x = x0 + dx;
  const yy = y + (below ? 44 : -30);
  const sc = popScale(k);
  return (
    <g transform={`translate(${x} ${yy}) scale(${sc}) translate(${-x} ${-yy})`}>
      <Label x={x} y={yy} size={17} weight={700} color={OK}>{label}</Label>
    </g>
  );
}

/** in the end-on view: line A carried on past the hinge (dotted), and the arc from it to line B */
function BendMark({ pose, k }: { pose: Pose; k: number }) {
  if (k <= 0) return null;
  const Hh = at(pose, mul(add(LOCAL(DG_U), LOCAL(DG_V)), 0.5));
  const off = TA.find((v) => v !== DG_U && v !== DG_V)!;
  const A = at(pose, LOCAL(off)), B = at(pose, LOCAL(D_OFF));
  const LB = Math.hypot(B[0] - Hh[0], B[1] - Hh[1]);
  const ax = Hh[0] - A[0], ay = Hh[1] - A[1], LA = Math.hypot(ax, ay) || 1;
  const ex = [Hh[0] + (ax / LA) * LB * k, Hh[1] + (ay / LA) * LB * k];
  const a0 = Math.atan2(ay, ax), a1 = Math.atan2(B[1] - Hh[1], B[0] - Hh[0]);
  let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
  const rr = Math.min(80, LB * 0.75);
  const p0 = [Hh[0] + rr * Math.cos(a0), Hh[1] + rr * Math.sin(a0)], p1 = [Hh[0] + rr * Math.cos(a0 + da * k), Hh[1] + rr * Math.sin(a0 + da * k)];
  const mid = a0 + da / 2;
  return (
    <g>
      <line x1={Hh[0]} y1={Hh[1]} x2={ex[0]} y2={ex[1]} stroke={INK3} strokeWidth={1.4} strokeDasharray="2 3" />
      <path d={`M${p0[0]},${p0[1]} A${rr},${rr} 0 0 ${da > 0 ? 1 : 0} ${p1[0]},${p1[1]}`} fill="none" stroke={HIDDEN} strokeWidth={2.6} />
      <Label x={Hh[0] + (rr + 10) * Math.cos(mid)} y={Hh[1] + (rr + 10) * Math.sin(mid) + (Math.sin(mid) > 0 ? 16 : -4)} anchor={Math.cos(mid) >= 0 ? 'start' : 'end'} size={17} weight={700} rise={seg(k, 0.5, 1, E.out)}>{tr(`대각선에서 ${BEND.toFixed(0)}° 꺾임`, `bent ${BEND.toFixed(0)}° at the diagonal`)}</Label>
    </g>
  );
}

// ───────────────────────────── captions and timing

/** the reader needs chars × 1000/6 ms on screen; the player adds the lead and a 700 ms hold */
const reading = (ko: string, lead: number) => Math.ceil((ko.length * 1000) / 6 - lead - 700);
type Pair = readonly (readonly [string, string])[];
const C: Record<string, Pair> = {
  s1: [['하이파 전개도.', 'The hypar\'s crease pattern.'], ['정사각형 고리에 산과 골을 번갈아 준다.', 'Square rings, alternately mountain and valley.']],
  s2: [['두 모서리는 오르고 둘은 내려간다.', 'Two corners rise, two sink.'], ['한 대각선은 ∪, 다른 쪽은 ∩: 말안장이다.', 'One diagonal is ∪, the other ∩: a saddle.']],
  s3: [['사다리꼴을 옆에서 본다.', 'Look at one trapezoid edge-on.'], ['평평한 면은 옆에서 한 줄인데, 넷째 꼭짓점만 Δ 떠 있다.', 'A flat face edge-on is one line, but the fourth corner is off by Δ.']],
  s4: [['대각선을 그으면 삼각형 둘.', 'Draw a diagonal: two triangles.'], ['삼각형은 평평해 각각 한 줄이 된다.', 'Triangles are flat, so each one lines up.']],
  s5: [['그려진 선만으로는 접을 수 없다고 증명됐다.', 'It is proved that the drawn creases alone cannot fold it.'], ['실제 종이엔 작은 주름이 더 생기는 듯하다.', 'Real paper seems to add small creases.']],
  s6: [['\'전체 접기\'로 접고', 'Fold it with "Fold all",'], ['\'삼각 분할 하이파\'와 비교하자.', 'then compare "Triangulated hypar".']],
};
const ko = (p: Pair) => p.map((x) => x[0]).join(' ');
const beatsOf = (p: Pair, at: number[]) => (): Beat[] => p.map((x, i) => ({ at: at[i], text: tr(x[0], x[1]) }));
const capOf = (p: Pair) => () => p.map((x) => tr(x[0], x[1])).join(' ');
const durOf = (p: Pair, motion: number, lead: number) => Math.max(motion, reading(ko(p), lead));
/** joined scenes start at once: the 700 ms hold is the only pause between them */
const JOIN_LEAD = 0;

/** hidden diagonals in scene 5: centre ring outward (faces 4.. are ring-major), 40 ms apart, 250 ms each */
const diagK = (ms: number, start: number) => (fi: number) => (fi < 4 ? 0 : E.out3((ms - start - 40 * (fi - 4)) / 250));

export const hyparScenes = (): Scene[] => {
  const D1 = durOf(C.s1, 4150, 150);
  const D2 = durOf(C.s2, S2.end, JOIN_LEAD);
  const D3 = durOf(C.s3, 6000, JOIN_LEAD);
  const D4 = durOf(C.s4, 5200, JOIN_LEAD);
  const D5 = durOf(C.s5, 6600, JOIN_LEAD);
  const D6 = durOf(C.s6, 4600, JOIN_LEAD);
  const zoom = () => tr(`사이트 계산, 조각만 돌려 ${(PS / SCALE).toFixed(1)}배 확대`, `site model; the piece alone turned, ×${(PS / SCALE).toFixed(1)}`);
  const S5_DIAG = 0.36 * D5;
  const s5Yaw = yaw5(D5), s5Cam = mainCam(s5Yaw, 1, 0, P5);
  /** scene 5's text, also faded out at the start of scene 6 */
  const S5Text = ({ t }: { t: number }) => (
    <g>
      <Label x={22} y={30} anchor="start" size={15} weight={700} rise={seg(t, 0.12, 0.2, E.out)}>{tr('Demaine 외 (2011) 증명', 'Demaine et al. (2011), proved')}</Label>
      <Label x={22} y={52} anchor="start" size={15} weight={700} color={BAD} rise={seg(t, 0.18, 0.26, E.out)}>{tr('그려진 선만으로는 접히지 않는다 ✗', 'no fold on the drawn creases alone ✗')}</Label>
      <Label x={240} y={268} size={14} weight={600} color={INK2} rise={seg(t, 0.32, 0.4, E.out)}>{tr(`사이트 계산: 숨은 대각선 ${ADDED}개에서 꺾이고`, `site model: bends at ${ADDED} hidden diagonals`)}</Label>
      <Label x={240} y={290} size={14} weight={600} color={INK} rise={seg(t, 0.58, 0.66, E.out)}>{tr(`이 모델에선 길이도 최대 ${(MAX_STRAIN * 100).toFixed(1)}% 변한다 (최대 변형률)`, `in this model lengths also change by up to ${(MAX_STRAIN * 100).toFixed(1)}% (max strain)`)}</Label>
    </g>
  );
  return [
    {
      duration: D1, lead: 150, view: 'top', viewNote: () => tr(`펼친 종이, 사이트 도면 (고리 ${RINGS}개)`, `flat sheet, the site's pattern (${RINGS} rings)`),
      caption: capOf(C.s1), beats: beatsOf(C.s1, [0, 0.3]),
      draw: (t) => <CPDraw t={t} D={D1} />,
    },
    {
      duration: D2, join: 'none', lead: JOIN_LEAD, view: 'oblique', viewNote: () => tr('사이트 계산, 화살표 기준 = 가운데 높이', 'site model; arrows from the centre\'s height'),
      caption: capOf(C.s2), beats: beatsOf(C.s2, [0, S2.curveA / D2]),
      draw: (t) => {
        const { P, cam, ms, kt } = s2State(t, D2);
        const kLeg = 1 - seg(ms, 0, 400, E.out);
        return (
          <g>
            <Sheet P={P} cam={cam} seam={kt} />
            <Heights P={P} cam={cam} k={seg(ms, S2.arrowsA, S2.arrowsB, E.out3)} hideFar={seg(ms, S2.curveA, S2.curveA + 300, E.out)} />
            <SaddleCurves P={P} cam={cam} k={seg(ms, S2.curveA, S2.curveB, E.inOut)} kLab={seg(ms, S2.label, S2.label + 320, E.out)} />
            <ProfileInset P={P} k={seg(ms, S2.inset, S2.inset + 700, E.inOut)} />
            {kLeg > 0 && <g opacity={kLeg}><Legend /></g>}
          </g>
        );
      },
    },
    {
      duration: D3, join: 'none', lead: JOIN_LEAD, view: 'oblique', viewNote: zoom,
      caption: capOf(C.s3), beats: beatsOf(C.s3, [0, 0.32]),
      draw: (t) => {
        const g = ghost3(t);
        const cam = mainCam(Y1, 0, g);
        const lift = seg(t, 0.02, 0.13, E.out3);
        const p = pose3(t);
        const out = 1 - seg(t, 0, 0.08, E.in);
        const ms = t * D3;
        const c0 = 0.52 * D3;
        return (
          <g>
            <Sheet P={FINAL} cam={cam} hide={PIECE} slot={lift > 0 ? 1 : 0} op={lerp(1, 0.25, g)} shadow={0.15 * (1 - g)} />
            {out > 0 && <g opacity={out}>
              <Heights P={FINAL} cam={cam} k={1} hideFar={1} />
              <SaddleCurves P={FINAL} cam={cam} k={1} kLab={1} />
              <ProfileInset P={FINAL} k={1} />
            </g>}
            {t > 0.02 && <Piece pose={p} outline={seg(t, 0.02, 0.16)} lift={lift} />}
            <Label x={PX} y={PY - 52} size={15} weight={600} opacity={1 - seg(t, 0.28, 0.33, E.in)} rise={seg(t, 0.18, 0.25, E.out)}>{tr('사다리꼴 (꼭짓점 4개)', 'a trapezoid (4 corners)')}</Label>
            <GapMarks pose={p} kLine={seg(t, 0.42, 0.5, E.out3)} kGap={seg(ms, c0, c0 + 400, E.out)} count={seg(ms, c0 + 400, c0 + 700, E.out)} kLab={seg(t, 0.6, 0.68, E.out)} />
          </g>
        );
      },
    },
    {
      duration: D4, join: 'none', lead: JOIN_LEAD, view: 'oblique', viewNote: zoom,
      caption: capOf(C.s4), beats: beatsOf(C.s4, [0, 0.18]),
      draw: (t) => {
        const cam = mainCam(Y1, 0, 1);
        const p = pose4(t);
        const ms = t * D4;
        const sh0 = S4.shrink[0] * D4;
        const fine = seg(ms, sh0, sh0 + 400, E.out);
        const last = (a: number, b: number) => seg(t, b - 0.25 * (b - a), b, E.out3);
        const hingeIn = last(S4.toH[0], S4.toH[1]);
        const eA = Math.max(seg(t, 0.18, 0.26, E.out3) * (1 - seg(t, 0.28, 0.31)), hingeIn);
        const eB = Math.max(last(S4.toB[0], S4.toB[1]) * (1 - seg(t, 0.56, 0.6)), hingeIn);
        const tA = S4.split[1] * D4 + 300, tB = S4.toB[1] * D4;
        return (
          <g>
            <Sheet P={FINAL} cam={cam} hide={PIECE} slot={1} op={0.25} shadow={0} />
            <Piece pose={p} split={seg(t, S4.split[0], S4.split[1], E.inOut)} emph={[eA, eB]}
              sight={[seg(ms, tA, tA + 250, E.out) * (1 - seg(t, 0.28, 0.31)), seg(ms, tB, tB + 250, E.out) * (1 - seg(t, 0.56, 0.6))]} />
            <GapMarks pose={POSE3_END} kLine={1} kGap={1} count={1} kLab={1} fine={fine} fade={seg(t, 0.27, 0.31, E.in)} />
            <Tick pose={p} tri={TA} k={seg(ms, tA, tA + 320, E.linear)} label={tr('① 한 줄 ✓', '① one line ✓')} below dx={-60} />
            <Tick pose={p} tri={TB} k={seg(ms, tB, tB + 320, E.linear)} label={tr('② 한 줄 ✓', '② one line ✓')} below dx={40} />
            <BendMark pose={p} k={seg(t, S4.toH[1], S4.toH[1] + 0.1, E.out3)} />
          </g>
        );
      },
    },
    {
      duration: D5, join: 'none', lead: JOIN_LEAD, view: 'oblique', viewNote: () => tr('사이트 계산, 주황 = 길이 변화 큼', 'site model; orange = lengths changed'),
      caption: capOf(C.s5), beats: beatsOf(C.s5, [0, 0.5]),
      draw: (t) => {
        const ms = t * D5;
        const yaw = yaw5(ms);
        const z = seg(t, 0.04, 0.2, E.inOut);
        const back = seg(ms, 0, 1050, E.inOut3);
        const g = 1 - back;
        const cam = mainCam(yaw, z, g, pitch5(ms));
        const p = mixPose(POSE4_END, homePose(yaw, z, g), back);
        const done = back >= 1;
        const out = 1 - seg(t, 0, 0.07, E.in);
        return (
          <g>
            <Sheet P={FINAL} cam={cam} hide={PIECE} slot={done ? 0 : 1 - back} op={lerp(0.25, 1, back)} shadow={0.15 * back} extra={diagK(ms, S5_DIAG)} strain={seg(ms, S5_DIAG + 1200, S5_DIAG + 2400, E.inOut)} />
            {(() => {
              const k = seg(ms, S5_DIAG + 2400, S5_DIAG + 3000, E.linear);
              if (k <= 0 || k >= 1) return null;
              const f = FACES[HOT_FACE];
              const c = project(mul(f.reduce((a, v) => add(a, FINAL[v]), [0, 0, 0] as V3), 1 / f.length), cam);
              return <circle cx={c[0]} cy={c[1]} r={4 + 6 * E.out(k)} fill="none" stroke={`rgb(${HOT_RGB.join(' ')})`} strokeWidth={2.4} opacity={1 - E.out(k)} />;
            })()}
            {!done && <Piece pose={p} split={1} lift={1 - back} emph={[g, g]} />}
            {out > 0 && <g opacity={out}>
              <Tick pose={POSE4_END} tri={TA} k={1} label={tr('① 한 줄 ✓', '① one line ✓')} below dx={-60} />
              <Tick pose={POSE4_END} tri={TB} k={1} label={tr('② 한 줄 ✓', '② one line ✓')} below dx={40} />
              <BendMark pose={POSE4_END} k={1} />
            </g>}
            {done && <g opacity={1 - seg(ms, S5_DIAG - 400, S5_DIAG, E.in)}>
              <SaddleCurves P={FINAL} cam={cam} k={seg(ms, 1100, 1400, E.out)} kLab={0} />
            </g>}
            <S5Text t={t} />
          </g>
        );
      },
    },
    {
      duration: D6, join: 'none', lead: JOIN_LEAD, view: 'top', viewNote: () => tr('다시 펴서 위에서, 전개도 둘', 'unfolded, from above: two patterns'),
      caption: capOf(C.s6), beats: beatsOf(C.s6, [0, 0.36]),
      draw: (t) => {
        const ms = t * D6;
        const S = 40, CY = 118;
        // unfold along the solver path while the camera rises to the top view
        const ku = seg(ms, 0, 900, E.sine);
        const P = shape(1 - ku);
        const cam = camAt(lerp(s5Yaw, 0, ku), lerp(P5, 90, ku), lerp(s5Cam.scale, S, ku), lerp(s5Cam.cx, 240, ku), lerp(FIT_CY5, CY, ku), P[0][2]);
        // then the copy slides right
        const kS = seg(ms, 900, 1450, E.inOut3);
        const lx = lerp(240, 125, kS), rx = lerp(240, 355, kS);
        const pulse = Math.sin(Math.PI * seg(ms, 3900, 4600, E.linear));
        const flat = shape(0);
        const ring = (fi: number) => (fi < 4 ? 0 : Math.floor((fi - 4) / 4));
        const glow = (fi: number) => (fi < 4 ? 0 : Math.sin(Math.PI * seg(ms, 1750 + 220 * ring(fi), 2250 + 220 * ring(fi), E.linear)));
        const t5 = 1 - seg(ms, 0, 300, E.in);
        const box = (HALF * S + 6) * (1 + 0.05 * pulse);
        return (
          <g>
            {kS <= 0 ? (
              <Sheet P={P} cam={cam} extra={1} strain={1 - seg(ms, 0, 500)} seam={1 - ku} />
            ) : (
              <g>
                <Sheet P={flat} cam={{ yaw: 0, pitch: 90, scale: S, cx: rx, cy: CY }} extra={1} tri={seg(ms, 1250, 1600)} glow={glow} seam={0} shadow={0.12} />
                <Sheet P={flat} cam={{ yaw: 0, pitch: 90, scale: S * (1 + 0.05 * pulse), cx: lx, cy: CY }} extra={1 - seg(ms, 1000, 1350)} seam={0} shadow={0.12} />
                {pulse > 0 && <rect x={lx - box} y={CY - box} width={2 * box} height={2 * box} fill="none" stroke="var(--color-mark-deep)" strokeWidth={3} rx={3} opacity={pulse} />}
              </g>
            )}
            {t5 > 0 && <g opacity={t5}><S5Text t={1} /></g>}
            <Label x={125} y={224} size={15} weight={700} rise={seg(ms, 1250, 1550, E.out)}>{tr('원래 하이파', 'classic hypar')}</Label>
            <Label x={125} y={247} size={14} color={INK2} rise={seg(ms, 1380, 1680, E.out)}>{tr('\'전체 접기\' 버튼', '"Fold all" button')}</Label>
            <Label x={355} y={224} size={15} weight={700} rise={seg(ms, 1560, 1860, E.out)}>{tr('삼각 분할 하이파', 'triangulated hypar')}</Label>
            <Label x={355} y={247} size={14} color={INK2} rise={seg(ms, 1700, 2000, E.out)}>{tr('왼쪽 \'프리셋\' 목록에서', 'from the Presets list')}</Label>
            <Label x={355} y={272} size={14} weight={600} color={HIDDEN} rise={seg(ms, 3300, 3600, E.out)}>{tr(`+ 대각선 ${ADDED}개`, `+ ${ADDED} diagonals`)}</Label>
          </g>
        );
      },
    },
  ];
};

/** the numbers on screen, for tests and the report */
export const hyparFacts = { RINGS, ADDED, DELTA, DELTA_MM, BEND, MAX_STRAIN, piece: PIECE, diagonal: [DG_U, DG_V], triA: TA, triB: TB, off: D_OFF };
