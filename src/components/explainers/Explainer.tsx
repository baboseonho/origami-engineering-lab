import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react';
import { tr } from '../../i18n';

/** One scene of a motion explainer: a caption and a drawing at time t ∈ [0, 1]. */
export interface Scene {
  caption: () => ReactNode;
  /** milliseconds at normal speed */
  duration: number;
  draw: (t: number) => ReactNode;
}

export const VIEW = { w: 480, h: 300 };

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * A small motion-graphics player: scenes drawn from a single clock, so any
 * moment can be scrubbed to and replayed exactly. Under reduced motion it
 * does not autoplay; each scene shows its finished drawing.
 */
export function Explainer({ title, scenes, autoPlay = true }: { title: string; scenes: Scene[]; autoPlay?: boolean }) {
  const total = scenes.reduce((s, x) => s + x.duration, 0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(autoPlay && !reduceMotion());
  const last = useRef(0);
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

  // which scene, and how far into it
  let acc = 0, idx = 0;
  for (; idx < scenes.length - 1; idx++) { if (time < acc + scenes[idx].duration) break; acc += scenes[idx].duration; }
  const local = Math.min(1, Math.max(0, (time - acc) / scenes[idx].duration));
  const t = reduceMotion() && !playing ? 1 : local;
  const startOf = (i: number) => scenes.slice(0, i).reduce((s, x) => s + x.duration, 0);
  const go = (i: number) => { const j = Math.max(0, Math.min(scenes.length - 1, i)); setTime(startOf(j) + 1); };
  const done = time >= total;
  const btn = 'flex h-9 w-9 items-center justify-center rounded-[4px] text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink disabled:opacity-30';

  return (
    <figure className="m-0 overflow-hidden rounded-[3px] border border-rule-2 bg-paper" aria-label={title}>
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="block w-full bg-paper" role="img" aria-label={title}>
        <rect width={VIEW.w} height={VIEW.h} fill="var(--color-paper)" />
        {scenes[idx].draw(t)}
      </svg>
      <figcaption className="min-h-[3.6em] border-t border-rule-2 px-4 py-2.5 text-[15px] leading-relaxed text-ink" aria-live="polite">
        <span className="tnum mr-2 text-[13px] text-ink-3">{idx + 1}/{scenes.length}</span>
        {scenes[idx].caption()}
      </figcaption>
      <div className="flex items-center gap-1 border-t border-rule-2 bg-paper-2/60 px-2 py-1.5">
        <button type="button" className={btn} onClick={() => go(idx - 1)} disabled={idx === 0} aria-label={tr('이전 장면', 'Previous scene')}><ChevronLeft size={17} /></button>
        {done ? (
          <button type="button" className={btn} onClick={() => { setTime(0); setPlaying(true); }} aria-label={tr('처음부터 다시', 'Replay')}><RotateCcw size={16} /></button>
        ) : (
          <button type="button" className={btn} onClick={() => setPlaying((p) => !p)} aria-label={playing ? tr('일시정지', 'Pause') : tr('재생', 'Play')}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
        )}
        <button type="button" className={btn} onClick={() => go(idx + 1)} disabled={idx === scenes.length - 1} aria-label={tr('다음 장면', 'Next scene')}><ChevronRight size={17} /></button>
        {/* one segment per scene; click to jump */}
        <div className="ml-2 flex flex-1 gap-1">
          {scenes.map((s, i) => {
            const f = i < idx ? 1 : i > idx ? 0 : local;
            return (
              <button key={i} type="button" onClick={() => go(i)} aria-label={tr(`${i + 1}번 장면`, `Scene ${i + 1}`)}
                className="relative h-2 overflow-hidden rounded-full bg-rule-2/60" style={{ flex: s.duration }}>
                <span className="absolute inset-y-0 left-0 bg-ink" style={{ width: `${f * 100}%` }} />
              </button>
            );
          })}
        </div>
      </div>
    </figure>
  );
}

// ───────────────────────────── drawing helpers shared by the explainers

export const ease = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));
/** progress of a sub-interval [a, b] of the scene */
export const seg = (t: number, a: number, b: number) => ease((t - a) / (b - a));
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

/** SVG text at a fixed 15px-equivalent size of the 480-wide view */
export function Label({ x, y, children, size = 15, color = INK, anchor = 'middle', weight = 500, opacity = 1 }: {
  x: number; y: number; children: ReactNode; size?: number; color?: string; anchor?: 'start' | 'middle' | 'end'; weight?: number; opacity?: number;
}) {
  return <text x={x} y={y} fontSize={size} fill={color} textAnchor={anchor} fontWeight={weight} opacity={opacity} fontFamily="Pretendard Variable, Pretendard, sans-serif" stroke="var(--color-paper)" strokeWidth={3} paintOrder="stroke">{children}</text>;
}
