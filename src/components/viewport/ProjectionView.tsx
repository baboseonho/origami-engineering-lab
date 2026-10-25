import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Assignment } from '../../core/topology/types';
import { engine } from '../../state/engine';
import { useModel } from '../../state/modelStore';
import { useSim } from '../../state/simulationStore';
import { useUI, type Selection } from '../../state/uiStore';
import { ASSIGN_COLOR } from '../controls/ui';
import { C } from '../../theme/tokens';
import { tr } from '../../i18n';
import { DrawingFrame } from './DrawingFrame';
import { HoverCard, PointerTip, edgeTip, vertexTip } from './HoverTip';
import { edgeLength3, useEngineVersion } from './measure';
import { layerLift, layersFor } from './layerCache';

/**
 * Third-angle orthographic projections ("3면도") of the CURRENT folded state:
 * the top view (xy) above the front view (xz), the right side view (yz) to
 * its right, all at one scale and aligned like a drawing. Faces are painted
 * back to front with a light paper fill (front side white, back side the
 * 3D view's blue-grey), so lines behind a face show only faintly. Hovering a
 * crease highlights it in all three views and reads out its true and
 * projected lengths; hovering a vertex reads out its coordinates.
 * Everything is drawn in screen pixels, so text is always ≥ 12px.
 */

type ViewKey = 'top' | 'front' | 'side';
type Ax = 0 | 1 | 2;
interface ViewDef { h: Ax; v: Ax; depth: Ax; sign: 1 | -1; plane: string }
/** h, v: model axes along the sheet's right and up; the viewer looks from `sign` × the depth axis. */
const VIEWS: Record<ViewKey, ViewDef> = {
  top: { h: 0, v: 1, depth: 2, sign: 1, plane: 'xy' },
  front: { h: 0, v: 2, depth: 1, sign: -1, plane: 'xz' },
  side: { h: 1, v: 2, depth: 0, sign: 1, plane: 'yz' },
};
const KEYS: ViewKey[] = ['top', 'front', 'side'];
const AXN = ['x', 'y', 'z'];

const caption = (k: ViewKey) => ({ top: tr('평면도 (xy)', 'Top (xy)'), front: tr('정면도 (xz)', 'Front (xz)'), side: tr('측면도 (yz)', 'Side (yz)') })[k];

interface Rect { x: number; y: number; w: number; h: number }

const PEN: Record<Assignment, { w: number; dash?: string }> = {
  M: { w: 1.3, dash: '7 2.5 1.5 2.5' },
  V: { w: 1.3, dash: '5 3' },
  F: { w: 0.7 },
  B: { w: 1.5 },
  U: { w: 1.3 },
};
const penColor = (a: Assignment, locked: boolean) => (locked ? C.locked : a === 'B' ? C.ink : a === 'F' ? C.rule2 : ASSIGN_COLOR[a]);

/** Rough text width in px at 12px (Hangul is wider than Latin and digits). */
const textW = (s: string, fs = 12) => [...s].reduce((w, ch) => w + (/[ㄱ-힝]/.test(ch) ? 1.0 : 0.56) * fs, 0);

function same(a: Selection, b: Selection) {
  return a === b || (!!a && !!b && a.kind === b.kind && a.id === b.id);
}
function hoverTo(s: Selection) {
  if (!same(useUI.getState().hover, s)) useUI.getState().setHover(s);
}

/** Squared distance from p to segment ab, and the parameter of the foot. */
function segDist2(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  const qx = ax + t * dx - px, qy = ay + t * dy - py;
  return qx * qx + qy * qy;
}

const arrow = (x: number, y: number, ux: number, uy: number, key: string) => {
  const L = 7, W = 2.4;
  return <path key={key} d={`M${x},${y} L${x - ux * L - uy * W},${y - uy * L + ux * W} L${x - ux * L + uy * W},${y - uy * L - ux * W} Z`} fill={C.ink} />;
};

/** Dimension value on a paper chip that breaks the dimension line. */
function DimText({ x, y, text, rotate = false, anchor = 'middle' }: { x: number; y: number; text: string; rotate?: boolean; anchor?: 'middle' | 'start' | 'end' }) {
  const w = textW(text) + 6;
  const rx = anchor === 'middle' ? -w / 2 : anchor === 'start' ? -3 : -w + 3;
  return (
    <g transform={`translate(${x},${y})${rotate ? ' rotate(-90)' : ''}`}>
      <rect x={rx} y={-8} width={w} height={16} fill={C.paper} />
      <text x={0} y={0} dy="0.35em" fontSize={12} fill={C.ink} textAnchor={anchor} className="tnum" fontFamily="Pretendard Variable, Pretendard, sans-serif">{text}</text>
    </g>
  );
}

/** Horizontal overall dimension below the geometry (extension lines from y0 down to y). */
function DimH({ x1, x2, y0, y, text }: { x1: number; x2: number; y0: number; y: number; text: string }) {
  const small = x2 - x1 < textW(text) + 24;
  return (
    <g pointerEvents="none">
      <line x1={x1} y1={y0 + 3} x2={x1} y2={y + 5} stroke={C.ink} strokeWidth={0.6} />
      <line x1={x2} y1={y0 + 3} x2={x2} y2={y + 5} stroke={C.ink} strokeWidth={0.6} />
      {small ? (
        <>
          <line x1={x1 - 14} y1={y} x2={x2 + 14} y2={y} stroke={C.ink} strokeWidth={0.75} />
          {arrow(x1, y, 1, 0, 'a')}{arrow(x2, y, -1, 0, 'b')}
          <DimText x={x2 + 18} y={y} text={text} anchor="start" />
        </>
      ) : (
        <>
          <line x1={x1} y1={y} x2={x2} y2={y} stroke={C.ink} strokeWidth={0.75} />
          {arrow(x1, y, -1, 0, 'a')}{arrow(x2, y, 1, 0, 'b')}
          <DimText x={(x1 + x2) / 2} y={y} text={text} />
        </>
      )}
    </g>
  );
}

/** Vertical overall dimension left of the geometry (extension lines from x0 left to x). */
function DimV({ y1, y2, x0, x, text }: { y1: number; y2: number; x0: number; x: number; text: string }) {
  // y1 < y2 on screen
  const small = y2 - y1 < textW(text) + 24;
  return (
    <g pointerEvents="none">
      <line x1={x0 - 3} y1={y1} x2={x - 5} y2={y1} stroke={C.ink} strokeWidth={0.6} />
      <line x1={x0 - 3} y1={y2} x2={x - 5} y2={y2} stroke={C.ink} strokeWidth={0.6} />
      {small ? (
        <>
          <line x1={x} y1={y1 - 14} x2={x} y2={y2 + 14} stroke={C.ink} strokeWidth={0.75} />
          {arrow(x, y1, 0, 1, 'a')}{arrow(x, y2, 0, -1, 'b')}
          <DimText x={x} y={y1 - 18} text={text} rotate anchor="start" />
        </>
      ) : (
        <>
          <line x1={x} y1={y1} x2={x} y2={y2} stroke={C.ink} strokeWidth={0.75} />
          {arrow(x, y1, 0, -1, 'a')}{arrow(x, y2, 0, 1, 'b')}
          <DimText x={x} y={(y1 + y2) / 2} text={text} rotate />
        </>
      )}
    </g>
  );
}

/** The ISO third-angle projection symbol (frustum and its end view). */
function ThirdAngleSymbol({ cx, cy }: { cx: number; cy: number }) {
  const s = { stroke: C.ink2, strokeWidth: 1, fill: 'none' } as const;
  return (
    <g pointerEvents="none">
      <path d={`M${cx - 34},${cy - 11} L${cx - 6},${cy - 6} L${cx - 6},${cy + 6} L${cx - 34},${cy + 11} Z`} {...s} />
      <line x1={cx - 38} y1={cy} x2={cx + 38} y2={cy} stroke={C.ink3} strokeWidth={0.6} strokeDasharray="8 2 2 2" />
      <circle cx={cx + 20} cy={cy} r={11} {...s} />
      <circle cx={cx + 20} cy={cy} r={6} {...s} />
    </g>
  );
}

export function ProjectionView() {
  const model = useModel((s) => s.model);
  const rho = useSim((s) => s.rho);
  const locked = useSim((s) => s.locked);
  const hover = useUI((s) => s.hover);
  const selection = useUI((s) => s.selection);
  useEngineVersion(15);
  const host = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [px, setPx] = useState({ w: 800, h: 560 });
  const [hv, setHv] = useState<ViewKey | null>(null);
  const hasModel = !!model;
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setPx({ w: e.contentRect.width || 1, h: e.contentRect.height || 1 }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasModel]);
  const pickRef = useRef<(x: number, y: number) => void>(() => {});
  const raf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  if (!model || !model.vertices.length) {
    return (
      <div className="relative h-full w-full">
        <DrawingFrame title={tr('투영도', 'Projections')}>
          <div className="grid h-full place-items-center text-ink-3">{tr('이 레슨에는 3D 모델이 없다', 'This lesson has no 3D model')}</div>
        </DrawingFrame>
      </div>
    );
  }

  // ---- current positions (model coordinates, z up) and their bounding box
  const nV = model.vertices.length;
  const X = engine.positions.length === nV * 3 ? engine.positions : Float64Array.from(model.vertices.flatMap((v) => v.referencePosition));
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < nV; i++) for (let a = 0; a < 3; a++) { const c = X[3 * i + a]; if (c < lo[a]) lo[a] = c; if (c > hi[a]) hi[a] = c; }
  const range = [0, 1, 2].map((a) => hi[a] - lo[a]);
  const minSpan = model.scale * 0.03;
  const span = range.map((r) => Math.max(r, minSpan));
  // the origin of each axis on the sheet, centring a thin extent in its minimum span
  const o = [0, 1, 2].map((a) => lo[a] - (span[a] - range[a]) / 2);

  // ---- sheet layout: top above front, side right of front, one scale
  const pad = { l: 78, r: 26, t: 40, b: 66 };
  const gapX = 52, gapY = 54;
  const s = Math.max(1e-6, Math.min((px.w - pad.l - pad.r - gapX) / (span[0] + span[1]), (px.h - pad.t - pad.b - gapY) / (span[1] + span[2])));
  const totW = (span[0] + span[1]) * s + gapX, totH = (span[1] + span[2]) * s + gapY;
  const ox = pad.l + Math.max(0, (px.w - pad.l - pad.r - totW) / 2);
  const oy = pad.t + Math.max(0, (px.h - pad.t - pad.b - totH) / 2);
  const R: Record<ViewKey, Rect> = {
    top: { x: ox, y: oy, w: span[0] * s, h: span[1] * s },
    front: { x: ox, y: oy + span[1] * s + gapY, w: span[0] * s, h: span[2] * s },
    side: { x: ox + span[0] * s + gapX, y: oy + span[1] * s + gapY, w: span[1] * s, h: span[2] * s },
  };
  const mapH = (k: ViewKey, c: number) => R[k].x + (c - o[VIEWS[k].h]) * s;
  const mapV = (k: ViewKey, c: number) => R[k].y + R[k].h - (c - o[VIEWS[k].v]) * s;

  // projected vertices per view, in px
  const P: Record<ViewKey, Float32Array> = { top: new Float32Array(2 * nV), front: new Float32Array(2 * nV), side: new Float32Array(2 * nV) };
  for (const k of KEYS) {
    const d = VIEWS[k], q = P[k];
    for (let i = 0; i < nV; i++) { q[2 * i] = mapH(k, X[3 * i + d.h]); q[2 * i + 1] = mapV(k, X[3 * i + d.v]); }
  }
  const depthOf = (k: ViewKey, i: number) => VIEWS[k].sign * X[3 * i + VIEWS[k].depth];

  // ---- painter's order per view (stacked flat layers are separated by their recorded layer order)
  const lay = layersFor(model);
  const lift = layerLift(model, lay.tracker);
  const firstTri: number[] = [];
  { let t = 0; for (const f of model.faces) { firstTri.push(t); t += f.triangles.length; } }
  const faceData = model.faces.map((f) => {
    const c = [0, 0, 0];
    for (const v of f.vertices) for (let a = 0; a < 3; a++) c[a] += X[3 * v + a] / f.vertices.length;
    // Newell normal of the current polygon
    const n = [0, 0, 0];
    f.vertices.forEach((v, i) => {
      const w = f.vertices[(i + 1) % f.vertices.length];
      n[0] += (X[3 * v + 1] - X[3 * w + 1]) * (X[3 * v + 2] + X[3 * w + 2]);
      n[1] += (X[3 * v + 2] - X[3 * w + 2]) * (X[3 * v] + X[3 * w]);
      n[2] += (X[3 * v] - X[3 * w]) * (X[3 * v + 1] + X[3 * w + 1]);
    });
    const t = firstTri[f.id];
    const lv = lift ? lay.tracker.level[t] ?? 0 : 0;
    const off = [0, 1, 2].map((a) => (lift ? lay.tracker.normal[3 * t + a] * lift * lv : 0));
    return { c: c.map((x, a) => x + off[a]), n };
  });
  const order: Record<ViewKey, number[]> = { top: [], front: [], side: [] };
  const rank: Record<ViewKey, Int32Array> = { top: new Int32Array(model.faces.length), front: new Int32Array(model.faces.length), side: new Int32Array(model.faces.length) };
  for (const k of KEYS) {
    const d = VIEWS[k];
    order[k] = model.faces.map((f) => f.id).sort((a, b) => d.sign * (faceData[a].c[d.depth] - faceData[b].c[d.depth]));
    order[k].forEach((f, i) => { rank[k][f] = i; });
  }
  // each edge is drawn right after the nearer of its faces, so a nearer face can cover it
  const owned: Record<ViewKey, number[][]> = { top: [], front: [], side: [] };
  for (const k of KEYS) {
    owned[k] = model.faces.map(() => []);
    for (const e of model.edges) {
      const fs = e.faces.filter((f) => f >= 0);
      if (!fs.length) continue;
      const f = fs.reduce((a, b) => (rank[k][b] > rank[k][a] ? b : a));
      owned[k][f].push(e.id);
    }
  }

  const lockedSet = new Set(locked);
  const hovEdge = hover?.kind === 'edge' && model.edges[hover.id] ? hover.id : -1;
  const selEdge = selection?.kind === 'edge' && model.edges[selection.id] ? selection.id : -1;
  const hovVert = hover?.kind === 'vertex' && model.vertices[hover.id] ? hover.id : -1;
  const markFace = (f: number) => (hover?.kind === 'face' && hover.id === f) || (selection?.kind === 'face' && selection.id === f);

  const edgeLine = (k: ViewKey, eid: number, boost = 1) => {
    const e = model.edges[eid];
    const [a, b] = e.vertices;
    const q = P[k];
    const pen = PEN[e.assignment];
    return (
      <line key={`${k}e${eid}${boost > 1 ? 'h' : ''}`} x1={q[2 * a]} y1={q[2 * a + 1]} x2={q[2 * b]} y2={q[2 * b + 1]}
        stroke={penColor(e.assignment, lockedSet.has(eid))} strokeWidth={pen.w * boost} strokeDasharray={pen.dash} strokeLinecap="butt" />
    );
  };

  const views = KEYS.map((k) => {
    const d = VIEWS[k], q = P[k];
    const items: ReactNode[] = [];
    for (const f of order[k]) {
      const face = model.faces[f];
      const n = faceData[f].n[d.depth] * d.sign;
      items.push(
        <polygon key={`${k}f${f}`} points={face.vertices.map((v) => `${q[2 * v].toFixed(1)},${q[2 * v + 1].toFixed(1)}`).join(' ')}
          fill={markFace(f) ? C.markSoft : n >= 0 ? C.paperFront : C.paperBack} fillOpacity={markFace(f) ? 0.95 : 0.74} stroke="none" />,
      );
      for (const eid of owned[k][f]) items.push(edgeLine(k, eid));
    }
    return <g key={k}>{items}</g>;
  });

  // ---- highlights in all three views: selected (strong) and hovered (soft) crease, hovered vertex
  const marks: ReactNode[] = [];
  for (const [eid, strong] of [[selEdge, true], [hovEdge, false]] as const) {
    if (eid < 0 || (!strong && eid === selEdge)) continue;
    const [a, b] = model.edges[eid].vertices;
    for (const k of KEYS) {
      const q = P[k];
      marks.push(<line key={`m${k}${eid}${strong}`} x1={q[2 * a]} y1={q[2 * a + 1]} x2={q[2 * b]} y2={q[2 * b + 1]} stroke={C.mark} strokeOpacity={strong ? 0.85 : 0.5} strokeWidth={9} strokeLinecap="round" />);
      marks.push(edgeLine(k, eid, 1.8));
    }
  }
  if (hovVert >= 0) {
    const t = P.top, f = P.front, sd = P.side, v = hovVert;
    const proj = { stroke: C.ink3, strokeWidth: 0.75, strokeDasharray: '3 3', strokeOpacity: 0.8 } as const;
    // projection lines: top ↔ front share x, front ↔ side share z, top ↔ side meet on the 45° mitre line
    marks.push(<line key="pl1" x1={t[2 * v]} y1={t[2 * v + 1]} x2={f[2 * v]} y2={f[2 * v + 1]} {...proj} />);
    marks.push(<line key="pl2" x1={f[2 * v]} y1={f[2 * v + 1]} x2={sd[2 * v]} y2={sd[2 * v + 1]} {...proj} />);
    marks.push(<polyline key="pl3" points={`${t[2 * v]},${t[2 * v + 1]} ${sd[2 * v]},${t[2 * v + 1]} ${sd[2 * v]},${sd[2 * v + 1]}`} fill="none" {...proj} />);
    for (const k of KEYS) marks.push(<circle key={'hv' + k} cx={P[k][2 * v]} cy={P[k][2 * v + 1]} r={4} fill={C.ink} stroke={C.paper} strokeWidth={1.5} />);
  }

  // ---- overall dimensions: width (x) under the front view, height (z) left of it, depth (y) left of the top view
  const xs = [mapH('front', lo[0]), mapH('front', hi[0])];
  const zs = [mapV('front', hi[2]), mapV('front', lo[2])];
  const ys = [mapV('top', hi[1]), mapV('top', lo[1])];
  const dims = (
    <g>
      <DimH x1={xs[0]} x2={xs[1]} y0={zs[1]} y={R.front.y + R.front.h + 30} text={range[0].toFixed(2)} />
      <DimV y1={zs[0]} y2={zs[1]} x0={xs[0]} x={R.front.x - 30} text={range[2].toFixed(2)} />
      <DimV y1={ys[0]} y2={ys[1]} x0={mapH('top', lo[0])} x={R.top.x - 30} text={range[1].toFixed(2)} />
    </g>
  );

  // ---- captions with small axis glyphs
  const captions = KEYS.map((k) => {
    const r = R[k], d = VIEWS[k];
    const cap = caption(k);
    const gx = r.x + textW(cap) + 14, gy = r.y - 12;
    return (
      <g key={'c' + k} pointerEvents="none" fontFamily="Barlow Semi Condensed, Pretendard Variable, sans-serif" fontWeight={600} letterSpacing="0.06em">
        <text x={r.x} y={r.y - 12} fontSize={12} fill={C.ink2}>{cap}</text>
        <g stroke={C.ink3} strokeWidth={0.9}>
          <line x1={gx} y1={gy} x2={gx + 13} y2={gy} />
          <line x1={gx} y1={gy} x2={gx} y2={gy - 13} />
        </g>
        <path d={`M${gx + 16},${gy} l-5,-2.2 v4.4 Z M${gx},${gy - 16} l-2.2,5 h4.4 Z`} fill={C.ink3} />
        <text x={gx + 19} y={gy + 4} fontSize={12} fill={C.ink3}>{AXN[d.h]}</text>
        <text x={gx + 5} y={gy - 9} fontSize={12} fill={C.ink3}>{AXN[d.v]}</text>
      </g>
    );
  });

  // the empty quadrant (above the side view) carries the projection symbol
  const quad: Rect = { x: R.side.x, y: R.top.y, w: R.side.w, h: R.top.h };
  const symbol = quad.w >= 96 && quad.h >= 64 && (
    <g>
      <ThirdAngleSymbol cx={quad.x + quad.w / 2} cy={quad.y + quad.h / 2 - 8} />
      <text x={quad.x + quad.w / 2} y={quad.y + quad.h / 2 + 22} fontSize={12} fill={C.ink3} textAnchor="middle" fontFamily="Barlow Semi Condensed, Pretendard Variable, sans-serif" fontWeight={600} letterSpacing="0.06em" pointerEvents="none">
        {tr('제3각법', 'Third-angle projection')}
      </text>
    </g>
  );

  // ---- hover picking (nearest vertex, then nearest crease; ties go to the line nearer the viewer)
  pickRef.current = (mx: number, my: number) => {
    let k: ViewKey | null = null;
    for (const key of KEYS) { const r = R[key]; if (mx >= r.x - 10 && mx <= r.x + r.w + 10 && my >= r.y - 10 && my <= r.y + r.h + 10) k = key; }
    if (!k) { setHv(null); hoverTo(null); return; }
    const q = P[k];
    let best: Selection = null, bd = Infinity, bz = -Infinity;
    const better = (d2: number, z: number) => d2 < bd - 2.25 || (d2 < bd + 2.25 && z > bz);
    for (let i = 0; i < nV; i++) {
      const dx = q[2 * i] - mx, dy = q[2 * i + 1] - my, d2 = dx * dx + dy * dy;
      if (d2 <= 36 && better(d2, depthOf(k, i))) { best = { kind: 'vertex', id: i }; bd = d2; bz = depthOf(k, i); }
    }
    if (!best) {
      for (const e of model.edges) {
        const [a, b] = e.vertices;
        const d2 = segDist2(mx, my, q[2 * a], q[2 * a + 1], q[2 * b], q[2 * b + 1]);
        const z = (depthOf(k, a) + depthOf(k, b)) / 2;
        if (d2 <= 36 && better(d2, z)) { best = { kind: 'edge', id: e.id }; bd = d2; bz = z; }
      }
    }
    setHv(k);
    hoverTo(best);
  };

  // ---- hover readout
  let tip = null;
  if (hovEdge >= 0 && hv) {
    const d = VIEWS[hv];
    const [a, b] = model.edges[hovEdge].vertices;
    const proj = Math.hypot(X[3 * b + d.h] - X[3 * a + d.h], X[3 * b + d.v] - X[3 * a + d.v]);
    tip = edgeTip(model, hovEdge, rho, {
      lengthLabel: tr('실제 길이 (3D)', 'True length (3D)'),
      length: edgeLength3(model, hovEdge, X),
      extra: [{ k: tr(`투영 길이 (${d.plane})`, `Projected (${d.plane})`), v: proj.toFixed(3) }],
    });
  } else if (hovVert >= 0 && hv) tip = vertexTip(model, hovVert, { xyz: true });

  return (
    <div ref={host} className="relative h-full w-full" onPointerLeave={() => { setHv(null); hoverTo(null); }}>
      <DrawingFrame title={tr('투영도', 'Projections')}>
        <svg
          ref={svgRef}
          className="h-full w-full"
          viewBox={`0 0 ${px.w} ${px.h}`}
          style={{ cursor: hovEdge >= 0 || hovVert >= 0 ? 'pointer' : 'default' }}
          onPointerMove={(e) => {
            const r = svgRef.current!.getBoundingClientRect();
            const mx = e.clientX - r.left, my = e.clientY - r.top;
            cancelAnimationFrame(raf.current);
            raf.current = requestAnimationFrame(() => pickRef.current(mx, my));
          }}
          onClick={() => {
            const h = useUI.getState().hover;
            useUI.getState().select(h && h.kind !== 'face' ? h : null);
          }}
          role="img"
          aria-label={tr('접힌 모양의 평면도, 정면도, 측면도', 'Top, front and side views of the folded shape')}
        >
          {KEYS.map((k) => <rect key={'bg' + k} x={R[k].x} y={R[k].y} width={R[k].w} height={R[k].h} fill="none" stroke={C.nonphoto} strokeOpacity={0.55} strokeWidth={0.75} strokeDasharray="4 3" />)}
          {views}
          {marks}
          {dims}
          {captions}
          {symbol}
        </svg>
        <PointerTip host={host} show={!!tip}>{tip && <HoverCard {...tip} />}</PointerTip>
      </DrawingFrame>
    </div>
  );
}
