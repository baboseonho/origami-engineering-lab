import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Eye, Pause, Play, RotateCcw } from 'lucide-react';
import { tr } from '../../i18n';

/** Where a drawing is seen from. Every scene says it, in a tag on the drawing. */
export type ViewKind = 'top' | 'oblique' | 'side' | 'diagram';

/** One scene of a motion explainer: a caption and a drawing at time t ∈ [0, 1]. */
export interface Scene {
  /** a string may mark subscripts with `_`: "θ_1", "e_{12}" */
  caption: () => ReactNode;
  /** milliseconds of motion at normal speed (the player adds a beat before and a hold after) */
  duration: number;
  draw: (t: number) => ReactNode;
  view: ViewKind;
  /** a few words added to the view tag, e.g. "flat sheet" */
  viewNote?: () => string;
}

export const VIEW = { w: 480, h: 300 };

/** crossfade between scenes */
export const FADE = 420;
/** time at the start of a scene before motion begins (includes the crossfade) */
export const LEAD = 1050;
/** time the finished drawing is held at the end of a scene */
export const TAIL = 700;
/** the length of a scene on the timeline */
export const span = (s: Scene) => LEAD + s.duration + TAIL;

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function viewText(s: Scene) {
  const note = s.viewNote?.();
  switch (s.view) {
    case 'top': return tr('위에서 본 모습', 'Seen from above') + (note ? ` · ${note}` : '');
    case 'oblique': return tr('비스듬히 위에서', 'From above at an angle') + (note ? ` · ${note}` : '');
    case 'side': return tr('옆에서', 'Side view') + (note ? ` · ${note}` : '');
    default: return tr('개념도', 'Diagram') + ` · ${note ?? tr('실제 모양이 아님', 'not a real view')}`;
  }
}

function ViewTag({ scene, opacity, hidden }: { scene: Scene; opacity: number; hidden?: boolean }) {
  const diagram = scene.view === 'diagram';
  return (
    <div aria-hidden={hidden || undefined} style={{ opacity }}
      className={`pointer-events-none absolute left-2 top-2 flex max-w-[70%] items-center gap-1.5 rounded-[3px] border bg-paper/90 px-2 py-[3px] text-[13px] font-medium leading-tight text-ink-2 ${diagram ? 'border-dashed border-ink-3' : 'border-rule-2'}`}>
      <Eye size={14} strokeWidth={2} className="shrink-0" aria-hidden />
      <span>{viewText(scene)}</span>
    </div>
  );
}

/**
 * A small motion-graphics player: scenes drawn from a single clock, so any
 * moment can be scrubbed to and replayed exactly. Consecutive scenes
 * crossfade (drawing, caption and view tag) on the timeline itself, so the
 * same time always shows the same frame. Under reduced motion it does not
 * autoplay or fade; each scene shows its finished drawing.
 */
export function Explainer({ title, scenes, autoPlay = true }: { title: string; scenes: Scene[]; autoPlay?: boolean }) {
  const spans = scenes.map(span);
  const total = spans.reduce((s, x) => s + x, 0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(autoPlay && !reduceMotion());
  const [jumps, setJumps] = useState(0);
  const last = useRef(0);
  const drawRef = useRef<SVGGElement>(null);
  const capRef = useRef<HTMLDivElement>(null);
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
    for (const el of [drawRef.current, capRef.current]) el?.animate?.([{ opacity: 0.2 }, { opacity: 1 }], { duration: 360, easing: 'cubic-bezier(.25,.7,.3,1)' });
  }, [jumps]);

  // which scene, and how far into it
  let acc = 0, idx = 0;
  for (; idx < scenes.length - 1; idx++) { if (time < acc + spans[idx]) break; acc += spans[idx]; }
  const into = time - acc;
  const rm = reduceMotion();
  const local = Math.min(1, Math.max(0, (into - LEAD) / scenes[idx].duration));
  const t = rm && !playing ? 1 : local;
  // crossfade from the previous scene's last frame; no dip in brightness where the two agree
  const fade = idx > 0 && !rm && into < FADE ? ease(into / FADE) : 1;
  const prev = fade < 1 ? scenes[idx - 1] : null;
  const prevOp = Math.min(1, 2 * (1 - fade)), curOp = Math.min(1, 2 * fade);
  const textOut = Math.max(0, 1 - 2 * fade), textIn = Math.max(0, 2 * fade - 1);
  const startOf = (i: number) => spans.slice(0, i).reduce((s, x) => s + x, 0);
  const go = (i: number) => { const j = Math.max(0, Math.min(scenes.length - 1, i)); setTime(j === 0 ? 0 : startOf(j) + FADE); setJumps((n) => n + 1); };
  const done = time >= total;
  const btn = 'flex h-9 w-9 items-center justify-center rounded-[4px] text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink disabled:opacity-30';
  const caption = (s: Scene) => { const c = s.caption(); return typeof c === 'string' ? htmlMath(c) : c; };
  const counter = (i: number) => <span className="tnum mr-2 text-[13px] text-ink-3">{i + 1}/{scenes.length}</span>;

  return (
    <figure className="m-0 overflow-hidden rounded-[3px] border border-rule-2 bg-paper" aria-label={title}>
      <div className="relative">
        <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="block w-full bg-paper" role="img" aria-label={`${title}. ${viewText(scenes[idx])}`}>
          <rect width={VIEW.w} height={VIEW.h} fill="var(--color-paper)" />
          <g ref={drawRef}>
            {prev && <g opacity={prevOp}>{prev.draw(1)}</g>}
            <g opacity={curOp}>{scenes[idx].draw(t)}</g>
          </g>
        </svg>
        {prev && <ViewTag scene={prev} opacity={textOut} hidden />}
        <ViewTag scene={scenes[idx]} opacity={prev ? textIn : 1} />
      </div>
      <figcaption className="min-h-[3.6em] border-t border-rule-2 px-4 py-2.5 text-[15px] leading-relaxed text-ink">
        <div ref={capRef} className="grid">
          {/* text does not overlap well: the old caption leaves before the new one arrives */}
          {prev && <div style={{ gridArea: '1 / 1', opacity: textOut }} aria-hidden>{counter(idx - 1)}{caption(prev)}</div>}
          <div style={{ gridArea: '1 / 1', opacity: prev ? textIn : 1 }} aria-live="polite">{counter(idx)}{caption(scenes[idx])}</div>
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
        {/* one segment per scene; click to jump */}
        <div className="ml-2 flex flex-1 gap-1">
          {scenes.map((_, i) => {
            const f = i < idx ? 1 : i > idx ? 0 : into / spans[idx];
            return (
              <button key={i} type="button" onClick={() => go(i)} aria-label={tr(`${i + 1}번 장면`, `Scene ${i + 1}`)}
                className="relative h-2 overflow-hidden rounded-full bg-rule-2/60" style={{ flex: spans[i] }}>
                <span className="absolute inset-y-0 left-0 bg-ink" style={{ width: `${Math.min(1, f) * 100}%` }} />
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
  return parts.map((p, i) => (i % 2 ? <sub key={i} className="text-[0.75em]">{p.startsWith('{') ? p.slice(1, -1) : p}</sub> : p));
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
      out.push(<tspan key={i} dy={low ? 0 : '0.3em'} fontSize="0.75em">{p.startsWith('{') ? p.slice(1, -1) : p}</tspan>);
      low = true;
    } else if (p) {
      out.push(<tspan key={i} dy={low ? '-0.225em' : undefined}>{p}</tspan>);
      low = false;
    }
  });
  return out;
}

// ───────────────────────────── drawing helpers shared by the explainers

export const ease = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));
/** progress of a sub-interval [a, b] of the scene */
export const seg = (t: number, a: number, b: number) => ease((t - a) / (b - a));
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
export const INK3 = 'var(--color-ink-3)';
export const ODD = '#0e7490';
export const EVEN = '#a3541c';
export const MOUNTAIN = 'var(--color-mountain)';
export const VALLEY = 'var(--color-valley)';
export const OK = 'var(--color-ok)';
export const BAD = 'var(--color-bad)';
export const MARK = 'var(--color-mark)';

/** SVG text at a fixed 15px-equivalent size of the 480-wide view; strings may mark subscripts with `_` */
export function Label({ x, y, children, size = 15, color = INK, anchor = 'middle', weight = 500, opacity = 1 }: {
  x: number; y: number; children: ReactNode; size?: number; color?: string; anchor?: 'start' | 'middle' | 'end'; weight?: number; opacity?: number;
}) {
  if (opacity <= 0.001) return null;
  return <text x={x} y={y} fontSize={size} fill={color} textAnchor={anchor} fontWeight={weight} opacity={opacity} fontFamily="Pretendard Variable, Pretendard, sans-serif" stroke="var(--color-paper)" strokeWidth={3} paintOrder="stroke">{typeof children === 'string' ? svgMath(children) : children}</text>;
}
