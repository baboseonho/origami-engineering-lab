import { useEffect, useMemo, useRef, useState } from 'react';
import { isCrease, type OrigamiModel } from '../../core/topology/types';
import { vertexStar } from '../../core/topology/adjacency';
import { creaseName } from '../../core/topology/names';
import { fmtDeg, toDeg } from '../../core/geometry/angles';
import type { Vec2 } from '../../core/geometry/vectors';
import { useModel } from '../../state/modelStore';
import { useSim } from '../../state/simulationStore';
import { useUI } from '../../state/uiStore';
import { beginCreaseDrag, foldDirection } from '../../state/creaseDrag';
import { ASSIGN_COLOR } from '../controls/ui';
import { Legend } from './Legend';
import { DrawingFrame } from './DrawingFrame';
import { C } from '../../theme/tokens';

/** Planar layout helpers: periodic unwrapping for unrolled cylinders. */
function edgePts(model: OrigamiModel, eid: number): [Vec2, Vec2] {
  const ov = model.edu.layout2D?.edgeOverrides?.[eid];
  if (ov) return ov;
  const e = model.edges[eid];
  const a = model.vertices[e.vertices[0]].initialPosition2D;
  let b = model.vertices[e.vertices[1]].initialPosition2D;
  const per = model.edu.layout2D?.periodX;
  if (per) {
    const dx = b[0] - a[0];
    if (dx > per / 2) b = [b[0] - per, b[1]];
    else if (dx < -per / 2) b = [b[0] + per, b[1]];
  }
  return [a, b];
}

function facePts(model: OrigamiModel, fid: number): Vec2[] {
  const ov = model.edu.layout2D?.faceOverrides?.[fid];
  if (ov) return ov;
  const f = model.faces[fid];
  const per = model.edu.layout2D?.periodX;
  const p0 = model.vertices[f.vertices[0]].initialPosition2D;
  return f.vertices.map((v) => {
    const p = model.vertices[v].initialPosition2D;
    if (!per) return p;
    const dx = p[0] - p0[0];
    return dx > per / 2 ? [p[0] - per, p[1]] : dx < -per / 2 ? [p[0] + per, p[1]] : p;
  });
}

/** Detect mirror symmetry of the 2D pattern (geometry + assignment) about the bbox centre lines. */
function symmetryAxes(model: OrigamiModel, cx: number, cy: number): ('x' | 'y')[] {
  const key = (p: Vec2) => `${Math.round(p[0] * 1e5)},${Math.round(p[1] * 1e5)}`;
  const set = new Set(model.vertices.map((v) => key(v.initialPosition2D)));
  const out: ('x' | 'y')[] = [];
  if (model.vertices.every((v) => set.has(key([2 * cx - v.initialPosition2D[0], v.initialPosition2D[1]])))) out.push('x');
  if (model.vertices.every((v) => set.has(key([v.initialPosition2D[0], 2 * cy - v.initialPosition2D[1]])))) out.push('y');
  return out;
}

export function CreasePattern2D() {
  const model = useModel((s) => s.model);
  const modelVersion = useModel((s) => s.modelVersion);
  const selection = useUI((s) => s.selection);
  const hover = useUI((s) => s.hover);
  const overlays = useUI((s) => s.overlays);
  const theoryHover = useUI((s) => s.theoryHover);
  const drive = useSim((s) => s.drive);
  const locked = useSim((s) => s.locked);
  const rho = useSim((s) => s.rho);
  const viewMode = useUI((s) => s.viewMode);

  const bounds = useMemo(() => {
    if (!model) return { x: 0, y: 0, w: 1, h: 1 };
    let lx = Infinity, ly = Infinity, hx = -Infinity, hy = -Infinity;
    const acc = (p: Vec2) => { lx = Math.min(lx, p[0]); ly = Math.min(ly, p[1]); hx = Math.max(hx, p[0]); hy = Math.max(hy, p[1]); };
    model.faces.forEach((f) => facePts(model, f.id).forEach(acc));
    model.edges.forEach((e) => edgePts(model, e.id).forEach(acc));
    return { x: lx, y: ly, w: hx - lx || 1, h: hy - ly || 1 };
  }, [model]);
  const [view, setView] = useState({ x: 0, y: 0, w: 1, h: 1 });
  useEffect(() => {
    const m = Math.max(bounds.w, bounds.h) * 0.16;
    setView({ x: bounds.x - m, y: bounds.y - m, w: bounds.w + 2 * m, h: bounds.h + 2.6 * m });
  }, [bounds]);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  // on-screen size of the drawing, so labels are sized in real pixels (≥ 12px) at any zoom
  const [px, setPx] = useState({ w: 600, h: 400 });
  const hasModel = !!model;
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setPx({ w: e.contentRect.width || 1, h: e.contentRect.height || 1 }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasModel]);

  const axes = useMemo(() => (model ? symmetryAxes(model, bounds.x + bounds.w / 2, bounds.y + bounds.h / 2) : []), [model, bounds]);
  const highlightVs = useMemo(() => {
    if (!model) return [];
    const s = new Set<number>();
    if (selection?.kind === 'vertex') s.add(selection.id);
    return [...s].filter((v) => !model.vertices[v].boundary).slice(0, 40);
  }, [model, selection]);

  if (!model) return <div className="grid h-full place-items-center text-ink-3">전개도가 없다</div>;
  const sc = Math.max(bounds.w, bounds.h);
  const lw = sc * 0.006;
  // drawing units per screen pixel (viewBox "meet"); fs is a 20px base, so every label is 12–15px on screen
  const fs = 20 * Math.max(view.w / px.w, view.h / px.h);

  const onWheel = (e: React.WheelEvent) => {
    const k = e.deltaY > 0 ? 1.12 : 1 / 1.12;
    const r = svgRef.current!.getBoundingClientRect();
    const mx = view.x + ((e.clientX - r.left) / r.width) * view.w;
    const my = view.y + (1 - (e.clientY - r.top) / r.height) * view.h;
    setView({ x: mx - (mx - view.x) * k, y: my - (my - view.y) * k, w: view.w * k, h: view.h * k });
  };

  // y flipped so the crease pattern reads with +y up
  return (
    <div className="relative h-full w-full">
      <DrawingFrame title="전개도">
      <svg
        ref={svgRef}
        className="h-full w-full cursor-crosshair"
        viewBox={`${view.x} ${-view.y - view.h} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
        onWheel={onWheel}
        onPointerDown={(e) => { if (e.button === 1 || e.shiftKey) drag.current = { x: e.clientX, y: e.clientY }; }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const r = svgRef.current!.getBoundingClientRect();
          const dx = ((e.clientX - drag.current.x) / r.width) * view.w, dy = ((e.clientY - drag.current.y) / r.height) * view.h;
          drag.current = { x: e.clientX, y: e.clientY };
          setView((v) => ({ ...v, x: v.x - dx, y: v.y + dy }));
        }}
        onPointerUp={() => (drag.current = null)}
        onClick={(e) => { if (e.target === svgRef.current) useUI.getState().select(null); }}
      >
        <g transform="scale(1,-1)" className="plot-reveal" key={'plot' + modelVersion}>
          {model.faces.map((f) => {
            const pts = facePts(model, f.id);
            const sel = (selection?.kind === 'face' && selection.id === f.id) || (hover?.kind === 'face' && hover.id === f.id);
            return (
              <polygon
                key={'f' + f.id}
                points={pts.map((p) => p.join(',')).join(' ')}
                fill={sel ? C.markSoft : C.paper} fillOpacity={sel ? 0.95 : 0.55}
                stroke="none"
                onPointerEnter={() => useUI.getState().setHover({ kind: 'face', id: f.id })}
                onPointerLeave={() => useUI.getState().setHover(null)}
                onClick={() => useUI.getState().select({ kind: 'face', id: f.id })}
              />
            );
          })}
          {overlays.symmetry && axes.map((a) => a === 'x'
            ? <line key="sx" x1={bounds.x + bounds.w / 2} x2={bounds.x + bounds.w / 2} y1={bounds.y - sc * 0.05} y2={bounds.y + bounds.h + sc * 0.05} stroke={C.ok} strokeWidth={lw * 0.6} strokeDasharray={`${lw * 4} ${lw * 3}`} />
            : <line key="sy" y1={bounds.y + bounds.h / 2} y2={bounds.y + bounds.h / 2} x1={bounds.x - sc * 0.05} x2={bounds.x + bounds.w + sc * 0.05} stroke={C.ok} strokeWidth={lw * 0.6} strokeDasharray={`${lw * 4} ${lw * 3}`} />)}
          {model.edges.map((e) => {
            const [a, b] = edgePts(model, e.id);
            const sel = selection?.kind === 'edge' && selection.id === e.id;
            const hov = hover?.kind === 'edge' && hover.id === e.id;
            const th = theoryHover !== null && model.edu.creaseLabels[e.id] === theoryHover;
            const drivable = isCrease(e.assignment) && e.faces[1] >= 0;
            const w = e.assignment === 'F' ? 0.7 : e.assignment === 'B' ? 1.5 : 1.3; // px
            const color = locked.includes(e.id) ? C.locked : ASSIGN_COLOR[e.assignment];
            return (
              <g key={'e' + e.id}>
                {(sel || th || hov) && <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={C.mark} strokeOpacity={sel || th ? 0.85 : 0.45} strokeWidth={9} vectorEffect="non-scaling-stroke" strokeLinecap="round" />}
                <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={color} strokeWidth={sel || hov || th ? w * 1.8 : e.id === drive ? w * 1.4 : w} vectorEffect="non-scaling-stroke"
                  strokeDasharray={e.assignment === 'M' ? '9 3 1.5 3' : e.assignment === 'V' ? '6 3.5' : undefined} strokeLinecap="butt" opacity={hov && !sel ? 0.85 : 1} />
                <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="transparent" strokeWidth={drivable ? 16 : 10} vectorEffect="non-scaling-stroke"
                  onPointerEnter={() => useUI.getState().setHover({ kind: 'edge', id: e.id })}
                  onPointerLeave={() => useUI.getState().setHover(null)}
                  onPointerDown={(ev) => {
                    // press and drag across the crease to fold it (the pattern's y axis points up on screen)
                    if (ev.button !== 0 || ev.shiftKey || !drivable) return;
                    ev.stopPropagation();
                    ev.preventDefault();
                    beginCreaseDrag(e.id, ev.clientX, ev.clientY, foldDirection([a[0], -a[1]], [b[0], -b[1]]));
                  }}
                  onClick={(ev) => { ev.stopPropagation(); useUI.getState().select({ kind: 'edge', id: e.id }); }}
                  style={{ cursor: drivable ? 'grab' : 'pointer', touchAction: 'none' }} />
              </g>
            );
          })}
          {(overlays.vertices ? model.vertices.map((v) => v.id) : [...new Set([...(model.edu.highlightVertices ?? []).filter((v) => !model.vertices[v].boundary).slice(0, 40), ...highlightVs])]).map((v) => {
            const p = model.vertices[v].initialPosition2D;
            const sel = selection?.kind === 'vertex' && selection.id === v;
            return (
              <circle key={'v' + v} cx={p[0]} cy={p[1]} r={lw * (sel ? 1.6 : 1.15)} fill={sel ? C.markDeep : (model.edu.highlightVertices ?? []).includes(v) ? C.ink : C.ink3} stroke={C.paper} strokeWidth={1} vectorEffect="non-scaling-stroke"
                onClick={(ev) => { ev.stopPropagation(); useUI.getState().select({ kind: 'vertex', id: v }); }}
                onPointerEnter={() => useUI.getState().setHover({ kind: 'vertex', id: v })} style={{ cursor: 'pointer' }} />
            );
          })}
        </g>
        {/* text (unflipped) */}
        {selection?.kind === 'edge' && model.edges[selection.id] && (() => {
          // drafting dimension line parallel to the selected crease: extension lines, arrowheads, value on the line
          const e = model.edges[selection.id];
          const [a, b] = edgePts(model, e.id);
          const dx = b[0] - a[0], dy = b[1] - a[1];
          const L = Math.hypot(dx, dy) || 1;
          const ux = dx / L, uy = dy / L;
          let nx = -uy, ny = ux;
          const off = sc * 0.1;
          const A = [a[0] + nx * off, -(a[1] + ny * off)], B = [b[0] + nx * off, -(b[1] + ny * off)];
          const ext = (p: number[], q: Vec2) => <line x1={q[0] + nx * off * 0.15} y1={-(q[1] + ny * off * 0.15)} x2={p[0] + nx * off * 0.2} y2={p[1] - ny * off * 0.2} stroke={C.ink} strokeWidth={0.6} vectorEffect="non-scaling-stroke" />;
          const ah = lw * 2.4;
          const sx2 = ux, sy2 = -uy; // screen-space direction a→b (y flipped)
          const arrow = (p: number[], dir: number) => <path d={`M${p[0]},${p[1]} l${dir * sx2 * ah - sy2 * ah * 0.35},${dir * sy2 * ah + sx2 * ah * 0.35} l${sy2 * ah * 0.7},${-sx2 * ah * 0.7} Z`} fill={C.ink} />;
          let ang = (Math.atan2(-(B[1] - A[1]), B[0] - A[0]) * 180) / Math.PI;
          if (ang > 90) ang -= 180; else if (ang < -90) ang += 180;
          const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
          const txt = `${creaseName(model, e.id)} ${fmtDeg(rho[e.id] ?? 0, 1)}`;
          void nx; void ny;
          return (
            <g key="dim" pointerEvents="none">
              {ext(A, a)}{ext(B, b)}
              <line x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} stroke={C.ink} strokeWidth={0.75} vectorEffect="non-scaling-stroke" />
              {arrow(A, 1)}{arrow(B, -1)}
              <g transform={`translate(${mx},${my}) rotate(${-ang})`}>
                <rect x={-txt.length * fs * 0.28} y={-fs * 1.05} width={txt.length * fs * 0.56} height={fs * 0.95} fill={C.mark} fillOpacity={0.9} rx={fs * 0.08} />
                <text x={0} y={-fs * 0.3} fontSize={fs * 0.72} fontWeight={700} fill={C.ink} textAnchor="middle" fontFamily="Cambria Math, Pretendard Variable, serif">{txt}</text>
              </g>
            </g>
          );
        })()}
        {overlays.sectorLabels && highlightVs.slice(0, 8).map((v) => {
          const st = vertexStar(model, v);
          const p = model.vertices[v].initialPosition2D;
          const dirs = st.edges.map((eid) => {
            const [a, b] = edgePts(model, eid);
            const o = model.edges[eid].vertices[0] === v ? b : a;
            return Math.atan2(o[1] - p[1], o[0] - p[0]);
          });
          return st.sectors.map((s, i) => {
            const a0 = dirs[i];
            const mid = a0 + s / 2;
            const r = sc * 0.055;
            const lbl = `θ${i + 1}`;
            const th = theoryHover === lbl;
            return (
              <g key={`s${v}-${i}`}>
                {th && <path d={`M${p[0]},${-p[1]} L${p[0] + r * 1.6 * Math.cos(a0)},${-(p[1] + r * 1.6 * Math.sin(a0))} A${r * 1.6},${r * 1.6} 0 ${s > Math.PI ? 1 : 0} 0 ${p[0] + r * 1.6 * Math.cos(a0 + s)},${-(p[1] + r * 1.6 * Math.sin(a0 + s))} Z`} fill={C.mark} fillOpacity={0.55} />}
                {(s >= 0.43 || th) && <text x={p[0] + r * Math.cos(mid)} y={-(p[1] + r * Math.sin(mid))} fontSize={fs * 0.62} fill={th ? C.ink : C.markInk} textAnchor="middle" dominantBaseline="middle" fontFamily="Pretendard Variable, sans-serif" fontWeight={600}>
                  {toDeg(s).toFixed(1)}°
                </text>}
              </g>
            );
          });
        })}
        {overlays.vertexIds && model.vertices.length <= 400 && model.vertices.map((v) => (
          <text key={'vt' + v.id} x={v.initialPosition2D[0] + lw * 2} y={-v.initialPosition2D[1] - lw * 2} fontSize={fs * 0.6} fill={C.locked} fontFamily="Pretendard Variable, sans-serif">v{v.id}</text>
        ))}
        {overlays.edgeIds && model.edges.length <= 500 && model.edges.map((e) => {
          const [a, b] = edgePts(model, e.id);
          return <text key={'et' + e.id} x={(a[0] + b[0]) / 2} y={-(a[1] + b[1]) / 2} fontSize={fs * 0.6} fill={C.ink3} fontFamily="Pretendard Variable, sans-serif" textAnchor="middle">e{e.id}</text>;
        })}
        {overlays.foldLabels && Object.keys(model.edu.creaseLabels).length <= 4 && Object.entries(model.edu.creaseLabels).filter(([k]) => !(selection?.kind === 'edge' && selection.id === +k)).map(([k, lab]) => {
          const [a, b] = edgePts(model, +k);
          return (
            <text key={'cl' + k} x={(a[0] + b[0]) / 2} y={-(a[1] + b[1]) / 2 - fs * 0.4} fontSize={fs * 0.75} fill={C.ink} fontFamily="Cambria Math, Times New Roman, serif" fontWeight={600} textAnchor="middle">
              {lab}{rho.length ? ` ${fmtDeg(rho[+k] ?? 0, 1)}` : ''}
            </text>
          );
        })}
        <text x={bounds.x} y={-(bounds.y - sc * 0.06)} fontSize={fs * 0.65} fill={C.ink3} fontFamily="Barlow Semi Condensed, Pretendard Variable, sans-serif" letterSpacing="0.04em">
          <tspan x={bounds.x}>전개도 {bounds.w.toFixed(2)} × {bounds.h.toFixed(2)}</tspan>
          {model.edu.layout2D?.periodX && <tspan x={bounds.x} dy="1.35em">원통을 펼친 그림 (x 방향 주기)</tspan>}
          {!model.metadata.developable && <tspan x={bounds.x} dy="1.35em">평면 전개가 안 되는 조립체의 개략 전개도</tspan>}
        </text>
      </svg>
      {viewMode === '2d' && <div className="pointer-events-none absolute bottom-[15px] left-[15px] hidden max-w-[45%] text-[12px] leading-snug text-ink-3 sm:block">크리스를 가로질러 끌기: 접기 · 휠: 확대/축소 · Shift+드래그: 이동</div>}
      {viewMode === '2d' && <Legend compact position="top" />}
      <div key={'carriage' + modelVersion} className="plot-carriage pointer-events-none absolute inset-y-[8px] w-[3px] -translate-x-1/2 bg-ink/70 shadow-[0_0_0_3px_rgb(23_32_42/0.08)]" aria-hidden />

      </DrawingFrame>
    </div>
  );
}
