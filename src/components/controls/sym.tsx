import { Fragment } from 'react';

/**
 * Symbols with an index, written the way a textbook writes them: "ρ1" is set
 * as ρ with a real subscript 1 (ρ₁), "θ3" as θ₃, "n2" as n₂. One rule for
 * the whole app, in three outputs:
 *
 *   <Sym text="ρ1 −70.0°" />     HTML (inline <sub>, line height untouched)
 *   <SvgSym text="ρ1 −70.0°" />  SVG tspans inside a <text>
 *   symPlain("ρ1")               a plain string with Unicode subscript digits
 *                                (ρ₁) for title attributes and aria-labels
 *
 * The rule: a Greek letter, or a single Latin letter, standing alone and
 * followed directly by digits, takes those digits as its subscript. Mesh
 * element ids (e12 edge, v12 vertex, f3 facet) are names of parts, not
 * indexed symbols, so they stay as written ("e12"). Any other text — numbers,
 * "−70.0°", Hangul, "Σθ" — passes through unchanged.
 */

/** Element-id prefixes that stay as plain ids. */
const ID_PREFIX = new Set(['e', 'v', 'f']);
const LETTER = 'A-Za-zͰ-Ͽ';
const GREEK = /[Ͱ-Ͽ]/;
// a letter not preceded by a letter, then digits not followed by a digit, a decimal point or a letter
const TOKEN = new RegExp(`(?<![${LETTER}])([${LETTER}])(\\d+)(?![\\d.${LETTER}])`, 'g');

/** One run of text and the subscript that follows it ('' when none). */
export type SymPart = { text: string; sub: string };

/** Splits `text` into runs, each followed by its subscript (possibly empty). */
export function symParts(text: string): SymPart[] {
  const out: SymPart[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (ID_PREFIX.has(m[1])) continue;
    const at = m.index ?? 0;
    out.push({ text: text.slice(last, at) + m[1], sub: m[2] });
    last = at + m[0].length;
  }
  if (last < text.length || !out.length) out.push({ text: text.slice(last), sub: '' });
  return out;
}

/** True when the text has at least one indexed symbol. */
export const hasSub = (text: string) => symParts(text).some((p) => p.sub !== '');

const SUB_DIGITS = '₀₁₂₃₄₅₆₇₈₉';

/** Plain-string form with Unicode subscript digits ("ρ1" → "ρ₁"), for places that only take a string. */
export function symPlain(text: string): string {
  return symParts(text).map((p) => p.text + [...p.sub].map((d) => SUB_DIGITS[+d]).join('')).join('');
}

/** Class of an HTML subscript that leaves the line height alone. */
export const SUB_CLASS = 'relative -bottom-[0.22em] align-baseline text-[0.75em] leading-[0]';

/** Greek letters in the serif maths face, so ρ and θ match the typeset formulas. */
function Runs({ text }: { text: string }) {
  if (!GREEK.test(text)) return <>{text}</>;
  return <>{text.split(/([Ͱ-Ͽ]+)/).map((s, i) => (i % 2 ? <span key={i} className="greek">{s}</span> : s ? <Fragment key={i}>{s}</Fragment> : null))}</>;
}

/**
 * HTML: indexed symbols with a real subscript. The <sub> is taken out of the
 * line box (line-height 0, shifted with relative positioning), so a label
 * with a subscript is exactly as tall as one without.
 */
export function Sym({ text, className }: { text: string; className?: string }) {
  const parts = symParts(text);
  const body = parts.map((p, i) => (
    <Fragment key={i}>
      <Runs text={p.text} />
      {p.sub && <sub className={SUB_CLASS}>{p.sub}</sub>}
    </Fragment>
  ));
  // always one element, so a flex parent with a gap does not pull the subscript away from its letter
  return <span className={className}>{body}</span>;
}

/** A list of symbols ("ρ1, ρ3") with real subscripts. */
export function SymList({ items, sep = ', ' }: { items: string[]; sep?: string }) {
  return <>{items.map((t, i) => <Fragment key={i}>{i > 0 && sep}<Sym text={t} /></Fragment>)}</>;
}

/**
 * SVG: the same text as tspans for use inside a <text>. The subscript is
 * 0.72em and dropped by 0.22em of the surrounding size with `dy` (rather than
 * `baseline-shift`, which Firefox ignores); the next run moves back up by the
 * same amount, so the rest of the label stays on its baseline.
 */
export function SvgSym({ text }: { text: string }) {
  const parts = symParts(text);
  const DROP = 0.22; // in the surrounding em
  const SIZE = 0.72;
  return (
    <>
      {parts.map((p, i) => {
        const back = i > 0 && parts[i - 1].sub !== '';
        return (
          <Fragment key={i}>
            {(p.text || back) && <tspan dy={back ? `${-DROP}em` : undefined}>{p.text}</tspan>}
            {p.sub && <tspan fontSize={`${SIZE}em`} dy={`${(DROP / SIZE).toFixed(4)}em`}>{p.sub}</tspan>}
          </Fragment>
        );
      })}
    </>
  );
}
