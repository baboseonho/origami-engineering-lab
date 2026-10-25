import { useRef } from 'react';
import { useUI } from '../../state/uiStore';
import { C, withAlpha } from '../../theme/tokens';
import { CreasePill, ThetaText, creaseColor, creaseDash, mix, parityColor, useBoxWidth } from './labKit';

/**
 * Interactive flat single vertex, drawn in real pixels. `rays` are crease
 * directions in radians (CCW, increasing); sector i lies between ray i and
 * ray i+1. The drawing fills the width it is given, up to `size` pixels.
 */
export function VertexDiagram({
  rays, mv, onDrag, onRayClick, onSectorClick, selectedSector, highlightRays, rayAlpha, ghostRays, size = 440, showLabels = true,
}: {
  rays: number[];
  mv: ('M' | 'V' | 'U')[];
  onDrag?: (i: number, angle: number) => void;
  onRayClick?: (i: number) => void;
  onSectorClick?: (i: number) => void;
  selectedSector?: number | null;
  highlightRays?: number[];
  /** per-ray opacity (0 … 1), e.g. for creases that a crimp has removed */
  rayAlpha?: number[];
  /** faint dashed rays: where a moving ray started */
  ghostRays?: number[];
  size?: number;
  showLabels?: boolean;
}) {
  const [box, w] = useBoxWidth<HTMLDivElement>(size);
  // never wider than its box: on a phone the box is the limit
  const S = Math.max(220, Math.min(size, w));
  const c = S / 2;
  const R = c - 56; // room for the handles outside the paper
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ i: number; moved: boolean } | null>(null);
  const theoryHover = useUI((s) => s.theoryHover);
  const n = rays.length;
  const sectors = rays.map((a, i) => {
    let b = rays[(i + 1) % n] - a;
    if (i === n - 1) b += 2 * Math.PI;
    return b;
  });
  const P = (a: number, r: number) => [c + r * Math.cos(a), c - r * Math.sin(a)] as const;
  const angleAt = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    let a = Math.atan2(-(e.clientY - r.top - c), e.clientX - r.left - c);
    if (a < 0) a += 2 * Math.PI;
    return a;
  };
  const grab = (i: number) => (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { i, moved: false };
  };
  const interactive = !!(onDrag || onRayClick);
  return (
    <div ref={box} className="w-full min-w-0 overflow-hidden">
      <svg ref={svg} width={S} height={S} viewBox={`0 0 ${S} ${S}`} className="mx-auto block touch-none select-none" role="img"
        onPointerMove={(e) => {
          if (!drag.current || !onDrag) return;
          drag.current.moved = true;
          onDrag(drag.current.i, angleAt(e));
        }}
        onPointerUp={() => {
          if (drag.current && !drag.current.moved) onRayClick?.(drag.current.i);
          drag.current = null;
        }}
        onPointerLeave={() => (drag.current = null)}>
        {/* the paper */}
        <circle cx={c} cy={c} r={R} fill={C.paperFront} stroke={C.ink3} strokeWidth={1} />
        {sectors.map((s, i) => {
          const a0 = rays[i], a1 = a0 + s;
          const large = s > Math.PI ? 1 : 0;
          const [x0, y0] = P(a0, R), [x1, y1] = P(a1, R);
          const path = `M${c},${c} L${x0},${y0} A${R},${R} 0 ${large} 0 ${x1},${y1} Z`;
          const lbl = `θ${i + 1}`;
          const hot = theoryHover === lbl || selectedSector === i;
          const col = parityColor(i);
          const deg = (s * 180) / Math.PI;
          // narrow sectors put their label further out, where there is room
          const lr = R * (deg < 28 ? 0.8 : 0.6);
          const [lx, ly] = P(a0 + s / 2, lr);
          return (
            <g key={'s' + i} onClick={() => onSectorClick?.(i)} style={{ cursor: onSectorClick ? 'pointer' : undefined }}
              onMouseEnter={() => useUI.getState().setTheoryHover(lbl)} onMouseLeave={() => useUI.getState().setTheoryHover(null)}>
              <path d={path} fill={hot ? withAlpha(C.mark, 0.62) : mix(C.paperFront, col, 0.11)} stroke="none" />
              {showLabels && (
                <g pointerEvents="none">
                  <ThetaText x={lx} y={ly - 3} i={i + 1} size={15} fill={col} />
                  <text x={lx} y={ly + 15} fontSize={13} fontWeight={500} fill={C.ink2} textAnchor="middle" className="tnum" stroke={hot ? 'none' : C.paperFront} strokeWidth={3} paintOrder="stroke">{deg.toFixed(1)}°</text>
                </g>
              )}
            </g>
          );
        })}
        {ghostRays?.map((a, i) => {
          const [x, y] = P(a, R);
          return <line key={'g' + i} x1={c} y1={c} x2={x} y2={y} stroke={C.ink3} strokeWidth={1.2} strokeDasharray="2 4" opacity={0.7} />;
        })}
        {rays.map((a, i) => {
          const hl = highlightRays?.includes(i);
          const col = creaseColor(mv[i]);
          const alpha = rayAlpha?.[i] ?? 1;
          const [x, y] = P(a, R);
          const [hx, hy] = P(a, R + 30);
          return (
            <g key={'r' + i} opacity={alpha}>
              {hl && <line x1={c} y1={c} x2={x} y2={y} stroke={C.mark} strokeWidth={11} strokeLinecap="round" opacity={0.85} />}
              <line x1={c} y1={c} x2={x} y2={y} stroke={col} strokeWidth={hl ? 3.4 : 2.6} strokeDasharray={creaseDash(mv[i])} />
              <line x1={x} y1={y} x2={P(a, R + 16)[0]} y2={P(a, R + 16)[1]} stroke={col} strokeWidth={1} />
              {/* a wide invisible hit line, then the handle */}
              <line x1={c} y1={c} x2={x} y2={y} stroke="transparent" strokeWidth={16} style={{ cursor: onDrag ? 'grab' : onRayClick ? 'pointer' : undefined }}
                onPointerDown={interactive ? grab(i) : undefined} />
              <g style={{ cursor: onDrag ? 'grab' : onRayClick ? 'pointer' : undefined }} onPointerDown={interactive ? grab(i) : undefined}>
                <CreasePill x={hx} y={hy} name={`c${i + 1}`} mv={mv[i]} hot={hl} />
              </g>
            </g>
          );
        })}
        <circle cx={c} cy={c} r={3.5} fill={C.ink} />
      </svg>
    </div>
  );
}
