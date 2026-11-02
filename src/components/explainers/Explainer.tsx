import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Eye, Pause, Play, RotateCcw } from 'lucide-react';
import { tr } from '../../i18n';

/** Where a drawing is seen from. Every scene says it, in a tag above the drawing. */
export type ViewKind = 'top' | 'oblique' | 'side' | 'diagram';

/** One sentence of a caption, shown from local scene time `at` (0..1) on. */
export interface Beat { at: number; text: string }

/** One scene of a motion explainer: a caption and a drawing at time t ∈ [0, 1]. */
export interface Scene {
  /** a string may mark subscripts with `_`: "θ_1", "e_{12}". Used when there are no beats. */
  caption: () => ReactNode;
  /** the caption as sentences that appear with the drawing; the first should have at = 0 */
  beats?: () => Beat[];
  /** milliseconds of motion at normal speed (the player adds a lead before and a hold after) */
  duration: number;
  /** time before the motion starts; default 150 ms for the first scene, 600 ms after */
  lead?: number;
  /** 'none': the drawing continues from the previous scene's last frame, so there is no crossfade */
  join?: 'fade' | 'none';
  draw: (t: number) => ReactNode;
  view: ViewKind;
  /** a few words added to the view tag, e.g. "flat sheet" */
  viewNote?: () => string;
}

export const VIEW = { w: 480, h: 300 };

/** crossfade between scenes */
export const FADE = 380;
/** default lead of the first scene and of the others */
export const LEAD_FIRST = 150;
export const LEAD = 600;
/** time the finished drawing is held at the end of a scene */
export const TAIL = 700;
const leadOf = (s: Scene, i: number) => s.lead ?? (i === 0 ? LEAD_FIRST : LEAD);
/** the length of scene i on the timeline */
export const span = (s: Scene, i = 1) => leadOf(s, i) + s.duration + TAIL;
export const spans = (sc: Scene[]) => sc.map((s, i) => span(s, i));

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function viewText(s: Scene) {
  const note = s.viewNote?.();
  switch (s.view) {
    case 'top': return tr('위에서 본 모습', 'Seen from above') + (note ? `, ${note}` : '');
    case 'oblique': return tr('비스듬히 위에서', 'From above at an angle') + (note ? `, ${note}` : '');
    case 'side': return tr('옆에서', 'Side view') + (note ? `, ${note}` : '');
    default: return tr('개념도', 'Diagram') + `, ${note ?? tr('실제 모양이 아님', 'not a real view')}`;
  }
}

/** The smallest label size, in drawing units, that still reads at the drawing's current width. */
const LabelFloor = createContext(0);

/**
 * A small motion-graphics player: scenes drawn from a single clock, so any
 * moment can be scrubbed to and replayed exactly. Consecutive scenes
 * crossfade on the timeline itself (or join without one), so the same time
 * always shows the same frame. Captions arrive sentence by sentence with the
 * drawing. Under reduced motion it does not autoplay or fade; each scene shows
 * its finished drawing and whole caption.
 */
export function Explainer({ title, scenes, autoPlay = true }: { title: string; scenes: Scene[]; autoPlay?: boolean }) {
  const sp = spans(scenes);
  const total = sp.reduce((s, x) => s + x, 0);
  // a player that waits for the reader opens on the finished first drawing, not on a blank sheet
  const [time, setTime] = useState(() => (autoPlay ? 0 : Math.min(leadOf(scenes[0], 0) + scenes[0].duration, sp[0] - 1)));
  const [playing, setPlaying] = useState(autoPlay && !reduceMotion());
  const [jumps, setJumps] = useState(0);
  const last = useRef(0);
  const drawRef = useRef<SVGGElement>(null);
  const capRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [floor, setFloor] = useState(0);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => { const w = e.contentRect.width; setFloor(w > 0 ? (12.5 * VIEW.w) / w : 0); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    last.current = performance.now();
    const tick = (now: number) => {
      const dt = now - last.current;
      last.current = now;
      setTime((t) => {
        const n = t + dt;
        if (n >= total) { setPlaying(false); return total; }
        return n;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, total]);
  // a jump lands on an exact frame; a quick fade-in only softens the cut
  useEffect(() => {
    if (!jumps || reduceMotion()) return;
    for (const el of [drawRef.current, capRef.current]) el?.animate?.([{ opacity: 0.25 }, { opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.16,1,.3,1)' });
  }, [jumps]);

  // which scene, and how far into it
  let acc = 0, idx = 0;
  for (; idx < scenes.length - 1; idx++) { if (time < acc + sp[idx]) break; acc += sp[idx]; }
  const into = time - acc;
  const scene = scenes[idx];
  const rm = reduceMotion();
  const local = Math.min(1, Math.max(0, (into - leadOf(scene, idx)) / scene.duration));
  const t = rm && !playing ? 1 : local;
  // crossfade from the previous scene's last frame; joined scenes simply continue
  const joined = scene.join === 'none';
  const fade = idx > 0 && !rm && into < FADE ? E.sine(into / FADE) : 1;
  const prev = fade < 1 && !joined ? scenes[idx - 1] : null;
  // a dip, not an overlap: the old drawing leaves before the new one arrives, so two pictures never sit on top of each other
  const prevOp = Math.max(0, 1 - 2 * fade), curOp = Math.max(0, 2 * fade - 1);
  const capPrev = fade < 1 ? scenes[idx - 1] : null;
  const textOut = Math.max(0, 1 - 2 * fade), textIn = Math.max(0, 2 * fade - 1);
  const startOf = (i: number) => sp.slice(0, i).reduce((s, x) => s + x, 0);
  const go = (i: number) => { const j = Math.max(0, Math.min(scenes.length - 1, i)); setTime(j === 0 ? 0 : startOf(j) + FADE); setJumps((n) => n + 1); };
  const done = time >= total;
  const btn = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink disabled:opacity-30 max-md:h-11 max-md:w-11';
  const counter = (i: number) => <span className="tnum mr-2 text-[13px] text-ink-3">{i + 1}/{scenes.length}</span>;
  /** the caption at local time tt (ms into the motion, may be negative during the lead) */
  const caption = (s: Scene, tt: number, whole: boolean) => {
    const bs = s.beats?.();
    if (!bs) { const c = s.caption(); return typeof c === 'string' ? htmlMath(c) : c; }
    let cur = 0;
    bs.forEach((b, k) => { if (whole || tt >= b.at * s.duration) cur = k; });
    // every sentence keeps its place, so the caption never reflows; unread ones wait invisibly
    return bs.map((b, k) => {
      const since = whole ? 1e9 : tt - b.at * s.duration;
      const shown = k === 0 || since >= 0;
      const a = shown ? (k === 0 || whole ? 1 : E.out(Math.min(1, since / 320))) : 0;
      return (
        <span key={k} style={{ opacity: a, color: k < cur && !whole ? 'var(--color-ink-2)' : undefined, transition: 'color 300ms' }} aria-hidden={a === 0 || undefined}>
          {htmlMath(b.text)}{k < bs.length - 1 ? ' ' : ''}
        </span>
      );
    });
  };
  const tMs = into - leadOf(scene, idx);
  const whole = rm && !playing;

  return (
    <figure className="m-0 overflow-hidden rounded-[3px] border border-rule-2 bg-paper" aria-label={title}>
      {/* the view tag sits above the drawing, so it never covers a label */}
      <div className="grid border-b border-rule bg-paper-2/50 px-2.5 py-1 text-[13px] font-medium leading-tight text-ink-2">
        {/* every tag sits invisibly in the cell, so a long one that wraps on a phone never pushes the drawing down mid-explainer */}
        {scenes.map((s, i) => <div key={'h' + i} style={{ gridArea: '1 / 1', visibility: 'hidden' }} aria-hidden className="flex items-center gap-1.5"><Eye size={14} className="shrink-0" /><span>{viewText(s)}</span></div>)}
        {[...(capPrev ? [{ s: capPrev, op: textOut, hidden: true }] : []), { s: scene, op: capPrev ? textIn : 1, hidden: false }].map(({ s, op, hidden }, k) => (
          <div key={k} style={{ gridArea: '1 / 1', opacity: op }} aria-hidden={hidden || undefined} className="flex items-center gap-1.5">
            <Eye size={14} strokeWidth={2} className={`shrink-0 ${s.view === 'diagram' ? 'text-ink-3' : ''}`} aria-hidden />
            <span className={s.view === 'diagram' ? 'border-b border-dashed border-ink-3' : ''}>{viewText(s)}</span>
          </div>
        ))}
      </div>
      <div ref={boxRef} className="relative">
        <LabelFloor.Provider value={floor}>
          <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="block w-full bg-paper" role="img" aria-label={`${title}. ${viewText(scene)}`}>
            <defs>
              <filter id="xp-soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation={3} /></filter>
              <filter id="xp-softer" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation={6} /></filter>
            </defs>
            <rect width={VIEW.w} height={VIEW.h} fill="var(--color-paper)" />
            <g ref={drawRef}>
              {prev && <g opacity={prevOp}>{prev.draw(1)}</g>}
              <g opacity={prev ? curOp : 1}>{scene.draw(t)}</g>
            </g>
          </svg>
        </LabelFloor.Provider>
      </div>
      <figcaption className="min-h-[3.6em] border-t border-rule-2 px-4 py-2.5 text-[15px] leading-relaxed text-ink">
        <div ref={capRef} className="grid">
          {/* every caption sits invisibly in the same cell, so the box is as tall as the longest one and the controls never jump */}
          {scenes.map((s, i) => <div key={'h' + i} style={{ gridArea: '1 / 1', visibility: 'hidden' }} aria-hidden>{counter(i)}{caption(s, 1e9, true)}</div>)}
          {/* text does not overlap well: the old caption leaves before the new one arrives */}
          {capPrev && <div style={{ gridArea: '1 / 1', opacity: textOut }} aria-hidden>{counter(idx - 1)}{caption(capPrev, 1e9, true)}</div>}
          <div style={{ gridArea: '1 / 1', opacity: capPrev ? textIn : 1 }} aria-live="polite">{counter(idx)}{caption(scene, tMs, whole)}</div>
        </div>
      </figcaption>
      <div className="flex items-center gap-1 border-t border-rule-2 bg-paper-2/60 px-2 py-1.5">
        <button type="button" className={btn} onClick={() => go(idx - 1)} disabled={idx === 0} aria-label={tr('이전 장면', 'Previous scene')}><ChevronLeft size={17} /></button>
        {done ? (
          <button type="button" className={btn} onClick={() => { setTime(0); setJumps((n) => n + 1); setPlaying(true); }} aria-label={tr('처음부터 다시', 'Replay')}><RotateCcw size={16} /></button>
        ) : (
          <button type="button" className={btn} onClick={() => setPlaying((p) => !p)} aria-label={playing ? tr('일시정지', 'Pause') : tr('재생', 'Play')}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
        )}
        <button type="button" className={btn} onClick={() => go(idx + 1)} disabled={idx === scenes.length - 1} aria-label={tr('다음 장면', 'Next scene')}><ChevronRight size={17} /></button>
        {/* phone: scenes are too many for 44px each, so the whole bar is one slider; tick marks show where scenes begin */}
        <div className="relative ml-1 min-w-0 flex-1 md:hidden">
          <input type="range" className="range-touch block w-full" min={0} max={total} step={10} value={Math.round(time)}
            aria-label={tr('장면 위치', 'Position in the explainer')} aria-valuetext={tr(`${idx + 1}/${scenes.length} 장면`, `Scene ${idx + 1} of ${scenes.length}`)}
            style={{ '--p': `${(time / total) * 100}%` } as CSSProperties}
            onPointerDown={() => setPlaying(false)}
            onChange={(e) => { setPlaying(false); setTime(Math.min(total, Math.max(0, parseFloat(e.target.value)))); }} />
          <div className="pointer-events-none absolute inset-x-[14px] bottom-[6px] h-1.5" aria-hidden>
            {scenes.slice(1).map((_, i) => <span key={i} className="absolute top-0 h-full w-px bg-ink-3" style={{ left: `${(startOf(i + 1) / total) * 100}%` }} />)}
          </div>
        </div>
        {/* one segment per scene; click to jump. The bar is thin, the hit area is the full row height. */}
        <div className="ml-1.5 flex min-w-0 flex-1 max-md:hidden">
          {scenes.map((_, i) => {
            const f = i < idx ? 1 : i > idx ? 0 : into / sp[idx];
            return (
              <button key={i} type="button" onClick={() => go(i)} aria-label={tr(`${i + 1}번 장면`, `Scene ${i + 1}`)} aria-current={i === idx ? 'step' : undefined}
                className="group flex h-9 min-w-0 items-center px-0.5 max-md:h-11" style={{ flex: sp[i] }}>
                <span className="relative block h-2 w-full overflow-hidden rounded-full bg-rule-2/60 transition-[height] group-hover:h-2.5">
                  <span className="absolute inset-y-0 left-0 bg-ink" style={{ width: `${Math.min(1, f) * 100}%` }} />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </figure>
  );
}

// ───────────────────────────── subscripts

const SUB = /_(\{[^}]*\}|.)/;

/** "θ_1 + θ_{12}" → text with real subscripts, for HTML (captions) */
export function htmlMath(s: string): ReactNode {
  const parts = s.split(new RegExp(SUB.source, 'g'));
  if (parts.length === 1) return s;
  return parts.map((p, i) => (i % 2 ? <sub key={i} className="text-[0.85em]">{p.startsWith('{') ? p.slice(1, -1) : p}</sub> : p));
}

/**
 * The same for SVG text. Subscripts are lowered with `dy` (supported by every
 * browser, unlike baseline-shift) and the baseline is restored after them.
 */
export function svgMath(s: string): ReactNode {
  const parts = s.split(new RegExp(SUB.source, 'g'));
  if (parts.length === 1) return s;
  const out: ReactNode[] = [];
  let low = false;
  parts.forEach((p, i) => {
    if (i % 2) {
      out.push(<tspan key={i} dy={low ? 0 : '0.3em'} fontSize="0.85em">{p.startsWith('{') ? p.slice(1, -1) : p}</tspan>);
      low = true;
    } else if (p) {
      out.push(<tspan key={i} dy={low ? '-0.255em' : undefined}>{p}</tspan>);
      low = false;
    }
  });
  return out;
}

// ───────────────────────────── motion helpers shared by the explainers

const cl = (x: number) => Math.min(1, Math.max(0, x));
/** named eases (GSAP names), all mapping [0, 1] → [0, 1] */
export const E = {
  linear: (x: number) => cl(x),
  sine: (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * cl(x)),
  /** power2.inOut: folds and moves */
  inOut: (x: number) => { x = cl(x); return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2; },
  /** power3.inOut: heavier moves */
  inOut3: (x: number) => { x = cl(x); return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2; },
  /** expo.out: arrivals, labels */
  out: (x: number) => { x = cl(x); return x >= 1 ? 1 : 1 - 2 ** (-10 * x); },
  /** power3.out: settling moves */
  out3: (x: number) => 1 - (1 - cl(x)) ** 3,
  /** expo.in: exits */
  in: (x: number) => { x = cl(x); return x <= 0 ? 0 : 2 ** (10 * x - 10); },
  /** back.out(s): pops that overshoot a little and settle */
  back: (s = 1.6) => (x: number) => { x = cl(x); const c = s + 1; return 1 + c * (x - 1) ** 3 + s * (x - 1) ** 2; },
};
/** the older name, kept for drawings that still use it */
export const ease = E.sine;
/** progress of a sub-interval [a, b] of the scene, through an ease (power2.inOut by default) */
export const seg = (t: number, a: number, b: number, e: (x: number) => number = E.inOut) => e((t - a) / (b - a));
/** fade in over [a, a + d] and out over [b, b + d2] (exits are quicker) */
export const inOut = (t: number, a: number, d: number, b = 2, d2 = d * 0.65) => seg(t, a, a + d, E.out) * (1 - seg(t, b, b + d2, E.in));
/**
 * n equal steps inside [a, b] with a held gap between them: 0 … n.
 * Each step eases on its own, so a fold sequence has beats instead of one long slide.
 */
export function steps(t: number, a: number, b: number, n: number, gap = 0.1, e: (x: number) => number = E.inOut) {
  const len = (b - a - gap * (n - 1)) / n;
  for (let k = 0; k < n; k++) {
    const s0 = a + k * (len + gap);
    if (t < s0) return k;
    if (t < s0 + len) return k + e((t - s0) / len);
  }
  return n;
}
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const rad = (d: number) => (d * Math.PI) / 180;
/** point at angle `deg` (counter-clockwise, y up on screen) and radius r around (cx, cy) */
export const pt = (cx: number, cy: number, r: number, deg: number): [number, number] => [cx + r * Math.cos(rad(deg)), cy - r * Math.sin(rad(deg))];

/** a filled wedge (pie slice) from a0 to a1 degrees */
export function wedge(cx: number, cy: number, r: number, a0: number, a1: number) {
  const [x0, y0] = pt(cx, cy, r, a0);
  const [x1, y1] = pt(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const sweep = a1 > a0 ? 0 : 1;
  return `M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${large} ${sweep} ${x1},${y1} Z`;
}

/** an arc path from a0 to a1 degrees at radius r */
export function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const [x0, y0] = pt(cx, cy, r, a0);
  const [x1, y1] = pt(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const sweep = a1 > a0 ? 0 : 1;
  return `M${x0},${y0} A${r},${r} 0 ${large} ${sweep} ${x1},${y1}`;
}

export const INK = 'var(--color-ink)';
export const INK2 = 'var(--color-ink-2)';
export const INK3 = 'var(--color-ink-3)';
export const ODD = '#0e7490';
export const EVEN = '#a3541c';
export const MOUNTAIN = 'var(--color-mountain)';
export const VALLEY = 'var(--color-valley)';
export const OK = 'var(--color-ok)';
export const BAD = 'var(--color-bad)';
export const MARK = 'var(--color-mark)';

/**
 * SVG text, sized in drawing units of the 480-wide view but never smaller than
 * about 12.5 css px on screen; strings may mark subscripts with `_`.
 * `rise` (0..1) lets a label arrive: it slides up 6 units and fades in.
 */
export function Label({ x, y, children, size = 15, color = INK, anchor = 'middle', weight = 500, opacity = 1, rise }: {
  x: number; y: number; children: ReactNode; size?: number; color?: string; anchor?: 'start' | 'middle' | 'end'; weight?: number; opacity?: number; rise?: number;
}) {
  const floor = useContext(LabelFloor);
  const op = opacity * (rise === undefined ? 1 : rise);
  if (op <= 0.001) return null;
  const dy = rise === undefined ? 0 : 6 * (1 - rise);
  return <text x={x} y={y + dy} fontSize={Math.max(size, floor)} fill={color} textAnchor={anchor} fontWeight={weight} opacity={op} fontFamily="Pretendard Variable, Pretendard, sans-serif" stroke="var(--color-paper)" strokeWidth={3} paintOrder="stroke">{typeof children === 'string' ? svgMath(children) : children}</text>;
}

/** a scale-in for badges, dots and ticks: back.out from 0.6 */
export const popScale = (k: number) => (k <= 0 ? 0 : 0.6 + 0.4 * E.back(1.8)(k));
