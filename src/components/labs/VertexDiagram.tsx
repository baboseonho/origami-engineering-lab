import { useRef } from 'react';
import { useUI } from '../../state/uiStore';
import { ASSIGN_COLOR } from '../controls/ui';
import { C, withAlpha } from '../../theme/tokens';

/**
 * Interactive flat single vertex. `rays` are crease directions in radians
 * (CCW, increasing); sector i lies between ray i and ray i+1.
 */
export function VertexDiagram({
  rays, mv, onDrag, onRayClick, onSectorClick, selectedSector, highlightRays, size = 360, showLabels = true,
}: {
  rays: number[];
  mv: ('M' | 'V' | 'U')[];
  onDrag?: (i: number, angle: number) => void;
  onRayClick?: (i: number) => void;
  onSectorClick?: (i: number) => void;
  selectedSector?: number | null;
  highlightRays?: number[];
  size?: number;
  showLabels?: boolean;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ i: number; moved: boolean } | null>(null);
  const theoryHover = useUI((s) => s.theoryHover);
  const R = 1;
  const n = rays.length;
  const sectors = rays.map((a, i) => {
    let b = rays[(i + 1) % n] - a;
    if (i === n - 1) b += 2 * Math.PI;
    return b;
  });
  const angleAt = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 2.6 - 1.3;
    const y = -(((e.clientY - r.top) / r.height) * 2.6 - 1.3);
    let a = Math.atan2(y, x);
    if (a < 0) a += 2 * Math.PI;
    return a;
  };
  return (
    <svg ref={svg} viewBox="-1.3 -1.3 2.6 2.6" width={size} height={size} className="touch-none select-none"
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
      <circle cx={0} cy={0} r={R} fill={C.paper} stroke={C.rule2} strokeWidth={0.008} />
      {sectors.map((s, i) => {
        const a0 = rays[i], a1 = a0 + s;
        const large = s > Math.PI ? 1 : 0;
        const rr = 0.92;
        const path = `M0,0 L${rr * Math.cos(a0)},${-rr * Math.sin(a0)} A${rr},${rr} 0 ${large} 0 ${rr * Math.cos(a1)},${-rr * Math.sin(a1)} Z`;
        const lbl = `θ${i + 1}`;
        const hot = theoryHover === lbl || selectedSector === i;
        return (
          <g key={'s' + i} onClick={() => onSectorClick?.(i)} style={{ cursor: onSectorClick ? 'pointer' : undefined }}
            onMouseEnter={() => useUI.getState().setTheoryHover(lbl)} onMouseLeave={() => useUI.getState().setTheoryHover(null)}>
            <path d={path} fill={hot ? withAlpha(C.mark, 0.6) : i % 2 === 0 ? withAlpha(C.valley, 0.13) : withAlpha(C.mountain, 0.09)} stroke="none" />
            {showLabels && (
              <text x={0.62 * Math.cos(a0 + s / 2)} y={-0.62 * Math.sin(a0 + s / 2)} fontSize={0.075} textAnchor="middle" dominantBaseline="middle" fill={i % 2 === 0 ? C.info : C.locked} fontFamily="monospace">
                <tspan x={0.62 * Math.cos(a0 + s / 2)} dy="-0.04">θ{i + 1}</tspan>
                <tspan x={0.62 * Math.cos(a0 + s / 2)} dy="0.09">{((s * 180) / Math.PI).toFixed(1)}°</tspan>
              </text>
            )}
          </g>
        );
      })}
      {rays.map((a, i) => {
        const hl = highlightRays?.includes(i);
        const col = ASSIGN_COLOR[mv[i]] ?? C.unassigned;
        return (
          <g key={'r' + i}>
            <line x1={0} y1={0} x2={R * Math.cos(a)} y2={-R * Math.sin(a)} stroke={col} strokeWidth={hl ? 0.03 : 0.018}
              strokeDasharray={mv[i] === 'M' ? '0.06 0.025 0.012 0.025' : mv[i] === 'V' ? '0.05 0.03' : undefined} />
            <line x1={0} y1={0} x2={R * Math.cos(a)} y2={-R * Math.sin(a)} stroke="transparent" strokeWidth={0.09} style={{ cursor: onDrag ? 'grab' : onRayClick ? 'pointer' : undefined }}
              onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); drag.current = { i, moved: false }; }} />
            <circle cx={1.1 * Math.cos(a)} cy={-1.1 * Math.sin(a)} r={0.075} fill={C.paper} stroke={col} strokeWidth={0.012}
              onPointerDown={() => { drag.current = { i, moved: false }; }} style={{ cursor: 'pointer' }} />
            <text x={1.1 * Math.cos(a)} y={-1.1 * Math.sin(a)} fontSize={0.07} textAnchor="middle" dominantBaseline="central" fill={col} fontFamily="monospace" pointerEvents="none">
              {mv[i]}{i + 1}
            </text>
          </g>
        );
      })}
      <circle cx={0} cy={0} r={0.02} fill={C.ink} />
    </svg>
  );
}
