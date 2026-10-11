import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type katexType from 'katex';

/**
 * KaTeX is loaded on demand so it stays out of the first bundle. Until it
 * arrives, math segments render as their readable source (never as a blank).
 */
let katexMod: typeof katexType | null = null;
let katexPromise: Promise<typeof katexType> | null = null;
function loadKatex() {
  if (!katexPromise) katexPromise = import('katex').then((m) => (katexMod = m.default));
  return katexPromise;
}
function useKatex() {
  const [k, setK] = useState(katexMod);
  useEffect(() => { if (!k) loadKatex().then(setK); }, [k]);
  return k;
}

const render = (k: typeof katexType, tex: string, display: boolean) => {
  try {
    return k.renderToString(tex, { displayMode: display, throwOnError: false, trust: true, strict: false, output: 'html' });
  } catch {
    return null;
  }
};

/** Readable fallback for TeX source while KaTeX loads. */
const plain = (tex: string) => tex.replace(/\\(text|mathrm|operatorname)\{([^}]*)\}/g, '$2').replace(/\\([a-zA-Z]+)/g, '$1').replace(/[{}]/g, '');

/**
 * Prose with inline math: text between `$...$` is typeset with KaTeX in
 * inline mode and kept on one line (`white-space: nowrap`), so a formula is
 * never broken across lines or split from its operators.
 */
export function Rich({ text, className }: { text: string; className?: string }) {
  const k = useKatex();
  const parts = useMemo(() => text.split(/(\$[^$]+\$)/g).filter(Boolean), [text]);
  return (
    <span className={className}>
      {parts.map((p, i) => {
        if (p.length > 2 && p.startsWith('$') && p.endsWith('$')) {
          const tex = p.slice(1, -1);
          const html = k ? render(k, tex, false) : null;
          return html
            ? <span key={i} className="math-inline" dangerouslySetInnerHTML={{ __html: html }} />
            : <span key={i} className="math-inline">{plain(tex)}</span>;
        }
        return <span key={i}>{p}</span>;
      })}
    </span>
  );
}

/**
 * Split a display formula at its top-level `\quad` / `\qquad` separators
 * (never inside braces or environments) into a centred `gathered` stack.
 * Returns null when there is nothing to split.
 */
function stackAtSeparators(tex: string): string | null {
  const parts: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < tex.length; i++) {
    const ch = tex[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '\\' && depth === 0) {
      const m = /^\\q?quad(?![a-zA-Z])/.exec(tex.slice(i));
      if (m) {
        parts.push(tex.slice(start, i).replace(/,\s*$/, ''));
        i += m[0].length - 1;
        start = i + 1;
      }
    }
  }
  if (!parts.length || /\\begin\{/.test(tex)) return null;
  parts.push(tex.slice(start));
  return `\\begin{gathered}${parts.map((p) => p.trim()).filter(Boolean).join('\\\\')}\\end{gathered}`;
}

/**
 * Display equation that always fits its container: when the typeset formula
 * is wider than the available width it is scaled down (not clipped, not
 * wrapped mid-expression); a floor keeps it legible, beyond which it scrolls.
 */
export function FitTex({ tex, minScale = 0.7 }: { tex: string; minScale?: number }) {
  const k = useKatex();
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>(undefined);
  // a long relation list is stacked at its \quad separators before it is shrunk hard
  const stacked = useMemo(() => stackAtSeparators(tex), [tex]);
  const [useStacked, setUseStacked] = useState(false);
  const flatNeed = useRef(0);
  const shown = useStacked && stacked ? stacked : tex;
  const html = useMemo(() => (k ? render(k, shown, true) : null), [k, shown]);
  const [scroll, setScroll] = useState(false);
  useLayoutEffect(() => {
    const o = outer.current, n = inner.current;
    if (!o || !n) return;
    // Only the available WIDTH drives the fit. Height changes (including the ones this
    // component causes) are ignored, and tiny changes are absorbed, so a scrollbar
    // appearing in a parent cannot start a measure → resize → measure feedback loop.
    let lastW = -1;
    // callbacks from an earlier render (fonts promise, observer) must not measure this DOM:
    // they would record the stacked layout as the flat width and flip the mode forever
    let alive = true;
    const fit = (force = false) => {
      if (!alive) return;
      const have = o.clientWidth;
      if (!have) return;
      if (!force && Math.abs(have - lastW) < 2) return;
      lastW = have;
      const need = n.scrollWidth; // layout width: unaffected by the transform
      if (!useStacked) flatNeed.current = need;
      if (stacked && !useStacked && need > have / 0.85) { setUseStacked(true); return; }
      if (useStacked && flatNeed.current && flatNeed.current <= have * 0.95) { setUseStacked(false); return; }
      const sc = need > have && need > 0 ? Math.max(minScale, have / need) : 1;
      setScale((p) => (Math.abs(p - sc) < 0.004 ? p : sc));
      const h = Math.ceil(n.offsetHeight * sc) + 4;
      setHeight((p) => (p !== undefined && Math.abs(p - h) <= 1 ? p : h));
      setScroll(need * sc > have + 1);
    };
    fit(true);
    const ro = new ResizeObserver(() => fit());
    ro.observe(o);
    // KaTeX fonts change the metrics once they arrive
    document.fonts?.ready.then(() => fit(true));
    return () => { alive = false; ro.disconnect(); };
  }, [html, minScale, stacked, useStacked]);
  return (
    <div ref={outer} className={`fit-tex overflow-y-hidden py-0.5 ${scroll ? 'overflow-x-auto' : 'overflow-x-hidden'}`} style={{ height }}>
      <div ref={inner} className="mx-auto w-max origin-top-left" style={{ transform: scale < 1 ? `scale(${scale})` : undefined }}>
        {html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <div className="py-2 text-center text-ink-2">{plain(tex)}</div>}
      </div>
    </div>
  );
}
