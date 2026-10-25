import { useEffect, useRef, useState, type ReactNode } from 'react';
import { C } from '../../theme/tokens';
import { useUI } from '../../state/uiStore';

/**
 * Small shared pieces of the vertex and model labs: measuring a box in real
 * pixels, number formatting that never prints "−0.000", crease glyphs and a
 * time-based tween that follows the shared fold speed.
 */

/** odd sectors (θ1, θ3, …) and even sectors (θ2, θ4, …): kept apart from the M/V red and blue */
export const ODD = '#0e7490';
export const EVEN = '#a3541c';
export const parityColor = (i: number) => (i % 2 === 0 ? ODD : EVEN);

/** `#rrggbb` mixed toward `#rrggbb` by t (0 … 1): a solid tint, so overlaps don't darken by accident. */
export function mix(a: string, b: string, t: number) {
  const p = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
  return '#' + [0, 1, 2].map((i) => Math.round(p(a, i) * (1 - t) + p(b, i) * t).toString(16).padStart(2, '0')).join('');
}

/** Width of an element in CSS pixels, kept current with a ResizeObserver. */
export function useBoxWidth<T extends Element>(initial = 640) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
export const ease = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));

/**
 * One tween at a time, timed in real milliseconds and scaled by the shared
 * fold speed. `onFrame` gets the eased progress; with reduced motion it is
 * called once with 1.
 */
export function useTween() {
  const raf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const stop = () => cancelAnimationFrame(raf.current);
  const run = (ms: number, onFrame: (e: number, raw: number) => void, onDone?: () => void) => {
    cancelAnimationFrame(raf.current);
    if (reducedMotion()) { onFrame(1, 1); onDone?.(); return; }
    let t = 0, last = performance.now();
    const tick = (now: number) => {
      t = Math.min(1, t + (Math.max(0, now - last) * useUI.getState().foldSpeed) / ms);
      last = now;
      onFrame(ease(t), t);
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else onDone?.();
    };
    raf.current = requestAnimationFrame(tick);
  };
  return { run, stop };
}

/** A number with a Unicode minus, never "−0.000". */
export function num(x: number, d = 3, signed = false) {
  if (!Number.isFinite(x)) return '—';
  const s = Math.abs(x).toFixed(d);
  const zero = +s === 0;
  return `${zero ? '' : x < 0 ? '−' : signed ? '+' : ''}${s}`;
}
export const degTxt = (x: number, d = 1, signed = false) => `${num(x, d, signed)}°`;

/** Scientific value typeset as m × 10ⁿ with a real superscript; values within `zero` of 0 read "≈ 0". */
export function Sci({ x, d = 2, zero = 0, className }: { x: number | null | undefined; d?: number; zero?: number; className?: string }) {
  if (x === null || x === undefined || !Number.isFinite(x)) return <span className={className}>—</span>;
  if (Math.abs(x) <= zero) return <span className={className} title={x.toExponential(2)}>≈ 0</span>;
  if (x === 0) return <span className={className}>0</span>;
  const a = Math.abs(x);
  if (a >= 1e-3 && a < 1e4) return <span className={className}>{num(x, d + 1)}</span>;
  const [m, e] = x.toExponential(d).split('e');
  const exp = parseInt(e, 10);
  return <span className={`whitespace-nowrap ${className ?? ''}`}>{num(+m, d)} × 10<sup className="text-[0.72em]">{exp < 0 ? `−${-exp}` : exp}</sup></span>;
}

/** Mountain ∧ / valley ∨ glyph. */
export function MVGlyph({ mv, x, y, size = 6 }: { mv: string; x: number; y: number; size?: number }) {
  if (mv !== 'M' && mv !== 'V') return null;
  const col = mv === 'M' ? C.mountain : C.valley;
  const d = mv === 'M'
    ? `M${x - size},${y + size / 2} L${x},${y - size / 2} L${x + size},${y + size / 2}`
    : `M${x - size},${y - size / 2} L${x},${y + size / 2} L${x + size},${y - size / 2}`;
  return <path d={d} fill="none" stroke={col} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />;
}

export const creaseColor = (mv: string) => (mv === 'M' ? C.mountain : mv === 'V' ? C.valley : C.unassigned);
/** mountain: dash-dot, valley: dashed (pixel units) */
export const creaseDash = (mv: string) => (mv === 'M' ? '9 3 2 3' : mv === 'V' ? '6 3.5' : undefined);

/** Rounded handle with the crease name and its ∧/∨ glyph, centred on (x, y). */
export function CreasePill({ x, y, name, mv, opacity = 1, hot = false }: { x: number; y: number; name: string; mv: string; opacity?: number; hot?: boolean }) {
  const col = creaseColor(mv);
  const w = name.length > 2 ? 54 : 48;
  return (
    <g opacity={opacity}>
      {hot && <rect x={x - w / 2 - 4} y={y - 17} width={w + 8} height={34} rx={17} fill={C.mark} opacity={0.8} />}
      <rect x={x - w / 2} y={y - 13} width={w} height={26} rx={13} fill={C.paper} stroke={col} strokeWidth={1.6} />
      <text x={x - 7} y={y + 4.5} fontSize={13} fontWeight={700} fill={col} textAnchor="middle">{name}</text>
      <MVGlyph mv={mv} x={x + w / 2 - 13} y={y} size={5} />
    </g>
  );
}

/** "θ₁" with a real subscript, followed by an optional value, as one SVG text. */
export function ThetaText({ x, y, i, value, size = 14, fill, anchor = 'middle', weight = 700, symbol = 'θ', halo = 3.5 }: {
  x: number; y: number; i: number | string; value?: string; size?: number; fill: string; anchor?: 'start' | 'middle' | 'end'; weight?: number; symbol?: string;
  /** width of the paper-coloured outline, in the same units as `size` */
  halo?: number;
}) {
  const sub = size * 0.72;
  return (
    <text x={x} y={y} fontSize={size} fontWeight={weight} fill={fill} textAnchor={anchor} stroke={C.paper} strokeWidth={halo} paintOrder="stroke" strokeLinejoin="round" className="tnum">
      <tspan fontStyle="italic">{symbol}</tspan>
      <tspan fontSize={sub} dy={size * 0.28}>{i}</tspan>
      {value !== undefined && <tspan dy={-size * 0.28} fontWeight={500}>{' '}{value}</tspan>}
    </text>
  );
}

/** A labelled group of controls (caption + buttons). */
export function Group({ caption, children, className = '' }: { caption: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-1.5 rounded-[4px] border border-rule-2 bg-paper px-2 py-1.5 ${className}`}>
      <span className="lettering mr-1 text-[12px] text-ink-3">{caption}</span>
      {children}
    </div>
  );
}

/** A tidy card below the stage. */
export function Card({ title, children, className = '', label }: { title: ReactNode; children: ReactNode; className?: string; label?: string }) {
  return (
    <section aria-label={label} className={`min-w-0 rounded-[3px] border border-rule-2 bg-paper px-4 py-3 ${className}`}>
      <h3 className="lettering text-[12px] text-ink-3">{title}</h3>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}
