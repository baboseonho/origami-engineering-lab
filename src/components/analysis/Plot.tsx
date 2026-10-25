import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { C, SERIES } from '../../theme/tokens';
import { tr } from '../../i18n';
import { Rich } from '../controls/Rich';
import { Sym, symPlain } from '../controls/sym';

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

/** Whole decades only, for a log axis (10⁻⁹, 10⁻⁶ …, never 10^−9.5). */
function decadeTicks(lo: number, hi: number, n = 4): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [];
  const a = Math.ceil(lo - 1e-9), b = Math.floor(hi + 1e-9);
  if (b < a) return [Math.round((lo + hi) / 2)];
  const step = Math.max(1, Math.ceil((b - a) / n));
  const out: number[] = [];
  for (let v = b; v >= a; v -= step) out.unshift(v);
  return out;
}

const MINUS = '\u2212';
const signed = (s: string) => s.replace(/^-/, MINUS);

/**
 * Tick labels share one power of ten: very large or small ranges are written
 * as plain numbers with a "×10ⁿ" note on the axis, never as "1.0e-3" per tick.
 */
function tickFormat(ticks: number[]): { label: (v: number) => string; exp: number } {
  const big = ticks.reduce((m, t) => Math.max(m, Math.abs(t)), 0);
  const exp = big > 0 && (big >= 1e4 || big < 1e-2) ? Math.floor(Math.log10(big)) : 0;
  const scaled = ticks.map((t) => t / Math.pow(10, exp));
  let d = 0;
  while (d < 4 && scaled.some((t) => Math.abs(+t.toFixed(d) - t) > 1e-6 * Math.max(1, Math.abs(t)))) d++;
  return {
    exp,
    label: (v: number) => {
      const t = v / Math.pow(10, exp);
      const s = t.toFixed(d);
      return Number(s) === 0 ? (0).toFixed(d) : signed(s);
    },
  };
}

/** "10" with a raised exponent, as SVG text. */
function Pow10({ x, y, exp, anchor, prefix = '' }: { x: number; y: number; exp: number; anchor: 'start' | 'end' | 'middle'; prefix?: string }) {
  return (
    <text x={x} y={y} fontSize={12} fill={C.ink3} textAnchor={anchor} className="tnum">
      {prefix}10<tspan dy={-5} fontSize={12}>{signed(String(exp))}</tspan>
    </text>
  );
}

/**
 * Lightweight SVG line plot (no dependencies). Drawn at its real pixel size
 * (the width follows the container) so axis text is a true 12px, never a
 * scaled-down 9px; the title and legend are ordinary HTML above it.
 */
export function Plot({ series, xLabel, yLabel, markerX, height = 190, width = 360, yZero = false, title, logY = false, emptyText = tr('아직 표시할 데이터가 없다', 'No data to show yet') }: {
  series: Series[]; xLabel: string; yLabel: string; markerX?: number; height?: number; width?: number; yZero?: boolean; title?: string; logY?: boolean; emptyText?: string;
}) {
  const box = useRef<HTMLElement>(null);
  const [measured, setMeasured] = useState(width);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setMeasured(Math.max(220, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const FS = 12;
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
    if (logY) {
      // a log axis always spans whole decades, so its ticks are plain powers of ten
      ylo = Math.floor(ylo); yhi = Math.ceil(yhi);
      if (yhi - ylo < 1) { yhi = ylo + 1; }
      return { xlo, xhi, ylo, yhi };
    }
    if (yhi - ylo < 1e-12) { yhi = ylo + 1e-3 + Math.abs(ylo) * 0.1; ylo = ylo - 1e-3; }
    const m = (yhi - ylo) * 0.06;
    return { xlo, xhi, ylo: ylo - m, yhi: yhi + m };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, yZero, logY]);
  const empty = !series.some((s) => s.x.length > 0);
  const yt = empty ? [] : logY ? decadeTicks(ylo, yhi, 4) : niceTicks(ylo, yhi, 4);
  const yf = tickFormat(logY ? [] : yt);
  const yTickText = yt.map((t) => (logY ? `10${signed(String(t))}` : yf.label(t)));
  // the left margin follows the widest tick label, so the axis title never overlaps it
  const tickW = yTickText.reduce((m, s) => Math.max(m, s.length), 1) * 7.4 + (logY ? 4 : 0);
  const pad = { l: Math.round(26 + tickW), r: 12, t: yf.exp ? 22 : 10, b: 38 };
  const W = measured, H = Math.max(height, 190);
  const sx = (x: number) => pad.l + ((x - xlo) / (xhi - xlo)) * (W - pad.l - pad.r);
  const sy = (y: number) => H - pad.b - ((tY(y) - ylo) / (yhi - ylo)) * (H - pad.t - pad.b);
  const syRaw = (yv: number) => H - pad.b - ((yv - ylo) / (yhi - ylo)) * (H - pad.t - pad.b);
  const xTicks = Math.max(3, Math.min(8, Math.floor((W - pad.l - pad.r) / 72)));
  const xt = empty ? [] : niceTicks(xlo, xhi, xTicks);
  const xf = tickFormat(xt);
  const midY = (H - pad.b + pad.t) / 2;
  return (
    <figure ref={box} className="m-0 w-full min-w-0">
      {(title || (!empty && series.length > 0)) && (
        <figcaption className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] leading-snug text-ink-2">
          {title && <span className="font-medium text-ink">{title}</span>}
          {!empty && series.map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1.5">
              <svg width="16" height="6" aria-hidden><line x1="0" x2="16" y1="3" y2="3" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dashed ? '4 2' : undefined} /></svg>
              {s.label.includes('$') ? <Rich text={s.label} /> : <Sym text={s.label} />}
            </span>
          ))}
        </figcaption>
      )}
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="tnum block max-w-full select-none" role="img" aria-label={`${yLabel}${tr(' 대 ', ' vs ')}${xLabel}${title ? ` · ${title}` : ''}${!empty && series.length ? `: ${series.map((s) => symPlain(s.label.replace(/\$/g, ''))).join(', ')}` : ''}`}>
        <rect x={pad.l} y={pad.t} width={W - pad.l - pad.r} height={H - pad.t - pad.b} fill={C.paper} stroke={C.rule} />
        {xt.map((t) => (
          <g key={'x' + t}>
            <line x1={sx(t)} x2={sx(t)} y1={pad.t} y2={H - pad.b} stroke={C.rule} />
            <text x={sx(t)} y={H - pad.b + 15} fontSize={FS} fill={C.ink3} textAnchor="middle">{xf.label(t)}</text>
          </g>
        ))}
        {xf.exp !== 0 && <Pow10 x={W - pad.r} y={H - pad.b + 15} exp={xf.exp} anchor="end" prefix="×" />}
        {yt.map((t, i) => (
          <g key={'y' + t}>
            <line x1={pad.l} x2={W - pad.r} y1={syRaw(t)} y2={syRaw(t)} stroke={C.rule} />
            {logY
              ? <Pow10 x={pad.l - 6} y={syRaw(t) + 4} exp={t} anchor="end" />
              : <text x={pad.l - 6} y={syRaw(t) + 4} fontSize={FS} fill={C.ink3} textAnchor="end">{yTickText[i]}</text>}
          </g>
        ))}
        {yf.exp !== 0 && <Pow10 x={pad.l} y={pad.t - 7} exp={yf.exp} anchor="start" prefix="×" />}
        {!empty && ylo < 0 && yhi > 0 && !logY && <line x1={pad.l} x2={W - pad.r} y1={syRaw(0)} y2={syRaw(0)} stroke={C.rule2} />}
        {series.map((s) => {
          const d = s.x
            .map((x, i) => (Number.isFinite(x) && Number.isFinite(tY(s.y[i])) ? `${sx(x).toFixed(1)},${sy(s.y[i]).toFixed(1)}` : null))
            .filter(Boolean)
            .join(' L');
          return (
            <g key={s.label}>
              {d && <path d={'M' + d} fill="none" stroke={s.color} strokeWidth={1.8} strokeDasharray={s.dashed ? '4 3' : undefined} />}
              {s.points && s.x.map((x, i) => <circle key={i} cx={sx(x)} cy={sy(s.y[i])} r={2.4} fill={s.color} />)}
            </g>
          );
        })}
        {markerX !== undefined && Number.isFinite(markerX) && !empty && (
          <line x1={sx(markerX)} x2={sx(markerX)} y1={pad.t} y2={H - pad.b} stroke={C.ink} strokeDasharray="3 3" opacity={0.7} />
        )}
        {empty && <text x={(W + pad.l) / 2} y={midY} fontSize={13} fill={C.ink3} textAnchor="middle">{emptyText}</text>}
        <text x={(W + pad.l) / 2} y={H - 5} fontSize={FS} fill={C.ink2} textAnchor="middle">{xLabel}</text>
        {yLabel && <text x={13} y={midY} fontSize={FS} fill={C.ink2} textAnchor="middle" transform={`rotate(-90 13 ${midY})`}>{yLabel}</text>}
      </svg>
    </figure>
  );
}

export const PALETTE = SERIES;
