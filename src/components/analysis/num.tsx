import { toDeg } from '../../core/geometry/angles';

/**
 * Number display for the analysis sheets and the inspector. Only how a value
 * is shown changes here: tabular figures, the Unicode minus, no "−0.000",
 * powers of ten typeset as a superscript, and a value that is zero to
 * machine precision read as "≈ 0" with the exact number in the tooltip.
 */

const MINUS = '−';

/** Below this an energy or a residual is zero to machine precision. */
export const TINY = 1e-12;

/** Fixed decimals with the Unicode minus; never "−0.000". */
export function num(x: number | null | undefined, d = 3, signed = false): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  const s = Math.abs(x).toFixed(d);
  if (Number(s) === 0) return s;
  return (x < 0 ? MINUS : signed ? '+' : '') + s;
}

/** Radians shown as degrees (0.1° by default). */
export const deg = (rad: number | null | undefined, d = 1, signed = false) =>
  rad === null || rad === undefined || !Number.isFinite(rad) ? '—' : `${num(toDeg(rad), d, signed)}°`;

/** Plain-text scientific/fixed form for tooltips and SVG text ("4.09e−10"). */
export function plainNum(x: number | null | undefined, d = 3): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  if (x !== 0 && (Math.abs(x) >= 1e4 || Math.abs(x) < 1e-3)) {
    const [m, e] = x.toExponential(2).split('e');
    return `${num(+m, 2)}e${num(+e, 0)}`;
  }
  return num(x, d);
}

/**
 * A measured value: fixed decimals in the normal range, "m × 10ⁿ" (typeset
 * with <sup>) when very large or small, and "≈ 0" below `zero` when given.
 */
export function Num({ value, d = 3, zero, className = '' }: { value: number | null | undefined; d?: number; zero?: number; className?: string }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return <span className={className}>—</span>;
  if (zero !== undefined && Math.abs(value) < zero) {
    return <span className={`tnum ${className}`} title={value.toExponential(3).replace('-', MINUS)}>≈ 0</span>;
  }
  if (value !== 0 && (Math.abs(value) >= 1e4 || Math.abs(value) < 1e-3)) {
    const [m, e] = value.toExponential(2).split('e');
    return (
      <span className={`tnum whitespace-nowrap ${className}`} title={plainNum(value)}>
        {num(+m, 2)}&thinsp;×&thinsp;10<sup className="text-[0.75em]">{num(+e, 0)}</sup>
      </span>
    );
  }
  return <span className={`tnum ${className}`}>{num(value, d)}</span>;
}

/** Crease names such as "ρ1" are written with a real subscript (ρ₁ set as ρ<sub>1</sub>). */
export function CreaseLabel({ name, className = '' }: { name: string; className?: string }) {
  const m = /^(\D+?)(\d+)$/.exec(name);
  if (!m || m[1] === 'e') return <span className={`tnum ${className}`}>{name}</span>;
  return <span className={`greek ${className}`}>{m[1]}<sub className="text-[0.75em]">{m[2]}</sub></span>;
}
