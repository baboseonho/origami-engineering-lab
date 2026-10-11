import { useMemo } from 'react';
import { C, SERIES } from '../../theme/tokens';

export interface Series {
  label: string;
  color: string;
  x: number[];
  y: number[];
  dashed?: boolean;
  points?: boolean;
}

function niceTicks(lo: number, hi: number, n = 5): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [];
  if (hi - lo < 1e-12) { hi = lo + 1; lo = lo - 1; }
  const raw = (hi - lo) / n;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9 * step; v += step) out.push(+v.toPrecision(10));
  return out;
}

const tickFmt = (v: number) => (Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-2 && v !== 0) ? v.toExponential(1) : +v.toFixed(3) + '');

/** Lightweight SVG line plot (no dependencies). */
export function Plot({ series, xLabel, yLabel, markerX, height = 170, width = 360, yZero = false, title, logY = false, emptyText = '아직 표시할 데이터가 없다' }: {
  series: Series[]; xLabel: string; yLabel: string; markerX?: number; height?: number; width?: number; yZero?: boolean; title?: string; logY?: boolean; emptyText?: string;
}) {
  const pad = { l: 46, r: 10, t: title ? 18 : 8, b: 30 };
  const tY = (v: number) => (logY ? Math.log10(Math.max(v, 1e-16)) : v);
  const { xlo, xhi, ylo, yhi } = useMemo(() => {
    let xlo = Infinity, xhi = -Infinity, ylo = Infinity, yhi = -Infinity;
    for (const s of series)
      s.x.forEach((x, i) => {
        const y = tY(s.y[i]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        xlo = Math.min(xlo, x); xhi = Math.max(xhi, x); ylo = Math.min(ylo, y); yhi = Math.max(yhi, y);
      });
    if (yZero) { ylo = Math.min(ylo, 0); yhi = Math.max(yhi, 0); }
    if (xhi - xlo < 1e-12) { xhi = xlo + 1; }
    if (yhi - ylo < 1e-12) { yhi = ylo + 1e-3 + Math.abs(ylo) * 0.1; ylo = ylo - 1e-3; }
    const m = (yhi - ylo) * 0.06;
    return { xlo, xhi, ylo: ylo - m, yhi: yhi + m };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, yZero, logY]);
  const W = width, H = height;
  const sx = (x: number) => pad.l + ((x - xlo) / (xhi - xlo)) * (W - pad.l - pad.r);
  const sy = (y: number) => H - pad.b - ((tY(y) - ylo) / (yhi - ylo)) * (H - pad.t - pad.b);
  const syRaw = (yt: number) => H - pad.b - ((yt - ylo) / (yhi - ylo)) * (H - pad.t - pad.b);
  const empty = !series.some((s) => s.x.length > 0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none" style={{ maxHeight: H }}>
      {title && <text x={pad.l} y={12} fontSize={10} fill={C.ink2}>{title}</text>}
      <rect x={pad.l} y={pad.t} width={W - pad.l - pad.r} height={H - pad.t - pad.b} fill={C.paper} stroke={C.rule} />
      {!empty && niceTicks(xlo, xhi).map((t) => (
        <g key={'x' + t}>
          <line x1={sx(t)} x2={sx(t)} y1={pad.t} y2={H - pad.b} stroke={C.rule} />
          <text x={sx(t)} y={H - pad.b + 11} fontSize={9} fill={C.ink3} textAnchor="middle">{tickFmt(t)}</text>
        </g>
      ))}
      {!empty && niceTicks(ylo, yhi, 4).map((t) => (
        <g key={'y' + t}>
          <line x1={pad.l} x2={W - pad.r} y1={syRaw(t)} y2={syRaw(t)} stroke={C.rule} />
          <text x={pad.l - 3} y={syRaw(t) + 3} fontSize={9} fill={C.ink3} textAnchor="end">{logY ? `1e${t}` : tickFmt(t)}</text>
        </g>
      ))}
      {!empty && ylo < 0 && yhi > 0 && !logY && <line x1={pad.l} x2={W - pad.r} y1={syRaw(0)} y2={syRaw(0)} stroke={C.rule2} />}
      {series.map((s) => {
        const d = s.x
          .map((x, i) => (Number.isFinite(x) && Number.isFinite(tY(s.y[i])) ? `${sx(x).toFixed(1)},${sy(s.y[i]).toFixed(1)}` : null))
          .filter(Boolean)
          .join(' L');
        return (
          <g key={s.label}>
            {d && <path d={'M' + d} fill="none" stroke={s.color} strokeWidth={1.6} strokeDasharray={s.dashed ? '4 3' : undefined} />}
            {s.points && s.x.map((x, i) => <circle key={i} cx={sx(x)} cy={sy(s.y[i])} r={1.8} fill={s.color} />)}
          </g>
        );
      })}
      {markerX !== undefined && Number.isFinite(markerX) && !empty && (
        <line x1={sx(markerX)} x2={sx(markerX)} y1={pad.t} y2={H - pad.b} stroke={C.ink} strokeDasharray="2 2" opacity={0.7} />
      )}
      {empty && <text x={W / 2} y={H / 2} fontSize={11} fill={C.ink3} textAnchor="middle">{emptyText}</text>}
      <text x={(W + pad.l) / 2} y={H - 3} fontSize={10} fill={C.ink2} textAnchor="middle">{xLabel}</text>
      <text x={10} y={(H - pad.b + pad.t) / 2} fontSize={10} fill={C.ink2} textAnchor="middle" transform={`rotate(-90 10 ${(H - pad.b + pad.t) / 2})`}>{yLabel}</text>
      <g>
        {series.map((s, i) => (
          <g key={s.label} transform={`translate(${pad.l + 6 + (i % 4) * 78}, ${pad.t + 10 + Math.floor(i / 4) * 11})`}>
            <line x1={0} x2={12} y1={-3} y2={-3} stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? '3 2' : undefined} />
            <text x={15} y={0} fontSize={9} fill={C.ink2}>{s.label}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

export const PALETTE = SERIES;
