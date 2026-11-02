import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { C, SERIES } from '../../theme/tokens';
import { SUB_MIN } from './num';
import { tr } from '../../i18n';
import { Rich } from '../controls/Rich';
import { Sym, symPlain } from '../controls/sym';

export interface Series {
  label: string;
  color: string;
  x: number[];
  y: number[];
  dashed?: boolean;
  /** an explicit dash pattern (a crease series uses its assignment's: M dash-dot, V dash) */
  dash?: string;
  points?: boolean;
}

/** Series whose values agree everywhere (to rounding) are drawn as one line and named together ("ρ2 = ρ4"). */
function coincidentGroups(series: Series[]): number[][] {
  let lo = Infinity, hi = -Infinity;
  for (const s of series) for (const y of s.y) if (Number.isFinite(y)) { lo = Math.min(lo, y); hi = Math.max(hi, y); }
  const tol = 1e-6 * Math.max(1, hi - lo);
  const same = (a: Series, b: Series) => {
    if (a.x.length !== b.x.length || a.x.length < 2) return false;
    let n = 0;
    for (let i = 0; i < a.x.length; i++) {
      if (a.x[i] !== b.x[i]) return false;
      const fa = Number.isFinite(a.y[i]), fb = Number.isFinite(b.y[i]);
      if (fa !== fb) return false;
      if (!fa) continue;
      if (Math.abs(a.y[i] - b.y[i]) > tol) return false;
      n++;
    }
    return n > 1;
  };
  const groups: number[][] = [];
  const taken = new Set<number>();
  series.forEach((s, i) => {
    if (taken.has(i)) return;
    const g = [i];
    for (let j = i + 1; j < series.length; j++) if (!taken.has(j) && same(s, series[j])) { g.push(j); taken.add(j); }
    groups.push(g);
  });
  return groups;
}

const dashOf = (s: Series, legend = false) => s.dash ?? (s.dashed ? (legend ? '4 2' : '4 3') : undefined);

/** A short stroke in the series' colour and dash, for legends and labels. */
export function SeriesSwatch({ color, dash, w = 18 }: { color: string; dash?: string; w?: number }) {
  return <svg width={w} height="6" aria-hidden className="shrink-0"><line x1="0" x2={w} y1="3" y2="3" stroke={color} strokeWidth="2.5" strokeDasharray={dash} /></svg>;
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
export function Plot({ series, xLabel, yLabel, markerX, height = 190, width = 360, yZero = false, title, logY = false, emptyText = tr('아직 표시할 데이터가 없다', 'No data to show yet'), endLabels = false }: {
  series: Series[]; xLabel: string; yLabel: string; markerX?: number; height?: number; width?: number; yZero?: boolean; title?: string; logY?: boolean; emptyText?: string;
  /** name each line at its right end (used when several series share one colour, e.g. two mountain creases) */
  endLabels?: boolean;
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
  const groups = useMemo(() => coincidentGroups(series), [series]);
  const groupName = (g: number[]) => g.map((i) => series[i].label).join(' = ');
  // line names go at the end where the lines are furthest apart: in the right margin when that is the
  // right end, otherwise just inside the plot at the left end (a sweep to negative angles ends on the left)
  const ends = useMemo(() => groups.map((g) => {
    const s = series[g[0]];
    let iMin = -1, iMax = -1;
    s.x.forEach((x, i) => {
      if (!Number.isFinite(x) || !Number.isFinite(s.y[i])) return;
      if (iMin < 0 || x < s.x[iMin]) iMin = i;
      if (iMax < 0 || x > s.x[iMax]) iMax = i;
    });
    return { left: iMin >= 0 ? s.y[iMin] : NaN, right: iMax >= 0 ? s.y[iMax] : NaN };
  }), [groups, series]);
  const spread = (k: 'left' | 'right') => { const v = ends.map((e) => e[k]).filter(Number.isFinite); return v.length ? Math.max(...v) - Math.min(...v) : 0; };
  const labelSide: 'left' | 'right' = groups.length > 1 && spread('left') > 2 * spread('right') ? 'left' : 'right';
  // room on the right for the end labels (Sym text at 14px, about 8px a character)
  const endW = endLabels && !empty && labelSide === 'right' ? Math.min(110, 14 + groups.reduce((m, g) => Math.max(m, symPlain(groupName(g).replace(/\$/g, '')).length), 0) * 8) : 0;
  const yt = empty ? [] : logY ? decadeTicks(ylo, yhi, 4) : niceTicks(ylo, yhi, 4);
  const yf = tickFormat(logY ? [] : yt);
  const yTickText = yt.map((t) => (logY ? `10${signed(String(t))}` : yf.label(t)));
  // the left margin follows the widest tick label, so the axis title never overlaps it
  const tickW = yTickText.reduce((m, s) => Math.max(m, s.length), 1) * 7.4 + (logY ? 4 : 0);
  const pad = { l: Math.round(26 + tickW), r: 12 + endW, t: yf.exp ? 22 : 10, b: 38 };
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
        <figcaption className={`mb-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] leading-snug text-ink-2 ${SUB_MIN}`}>
          {title && <span className="font-medium text-ink">{title}</span>}
          {!empty && groups.map((g) => {
            // one swatch per distinct line style in the group
            const styles = g.filter((i, k) => g.findIndex((j) => series[j].color === series[i].color && dashOf(series[j], true) === dashOf(series[i], true)) === k);
            return (
              <span key={series[g[0]].label} className="inline-flex items-center gap-1.5" title={g.length > 1 ? tr('모든 점에서 값이 같아 선이 겹친다', 'Equal at every point, so the lines overlap') : undefined}>
                {styles.map((i) => <SeriesSwatch key={i} color={series[i].color} dash={dashOf(series[i], true)} w={16} />)}
                <span>
                  {g.map((i, k) => (
                    <span key={i}>{k > 0 && ' = '}{series[i].label.includes('$') ? <Rich text={series[i].label} /> : <Sym text={series[i].label} />}</span>
                  ))}
                </span>
                {g.length > 1 && <span className="text-ink-3">{tr('(선이 겹침)', '(lines overlap)')}</span>}
              </span>
            );
          })}
        </figcaption>
      )}
      <div className="relative">
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
              {d && <path d={'M' + d} fill="none" stroke={s.color} strokeWidth={s.dash ? 2 : 1.8} strokeDasharray={dashOf(s)} />}
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
      {endLabels && !empty && <EndLabels left={labelSide === 'right' ? W - pad.r + 6 : pad.l + 6} chip={labelSide === 'left'} top={pad.t} bottom={H - pad.b}
        items={groups.map((g, i) => {
          const v = ends[i][labelSide];
          if (!Number.isFinite(tY(v))) return { key: series[g[0]].label, text: groupName(g), y: NaN };
          const y = sy(v);
          // inside the plot the name sits beside its line, on the side towards the middle
          return { key: series[g[0]].label, text: groupName(g), y: labelSide === 'left' ? y + (y < midY ? 13 : -13) : y };
        })} />}
      </div>
    </figure>
  );
}

export const PALETTE = SERIES;

/** Names at the right end of each line, nudged apart so they never overlap (HTML, so subscripts stay real and at least 12px). */
function EndLabels({ items, left, top, bottom, chip }: { items: { key: string; text: string; y: number }[]; left: number; top: number; bottom: number; chip: boolean }) {
  const GAP = 17;
  const placed = items.filter((it) => Number.isFinite(it.y)).sort((a, b) => a.y - b.y).map((it) => ({ ...it, at: it.y }));
  for (let i = 1; i < placed.length; i++) placed[i].at = Math.max(placed[i].at, placed[i - 1].at + GAP);
  const over = placed.length ? placed[placed.length - 1].at - bottom : 0;
  if (over > 0) for (const p of placed) p.at -= over;
  for (let i = 0; i < placed.length; i++) placed[i].at = Math.max(placed[i].at, top + 6 + i * GAP);
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {placed.map((p) => (
        <span key={p.key} className={`absolute -translate-y-1/2 whitespace-nowrap text-[14px] leading-none text-ink ${chip ? 'rounded-[2px] bg-paper/90 px-1 py-0.5' : ''} ${SUB_MIN}`} style={{ left, top: p.at }}>
          {p.text.includes('$') ? <Rich text={p.text} /> : <Sym text={p.text} />}
        </span>
      ))}
    </div>
  );
}
