import { useMemo } from 'react';
import type { LabId, Lesson } from '../../curriculum/lessons';
import type { Vec2 } from '../../core/geometry/vectors';
import type { Assignment } from '../../core/topology/types';
import { buildFromRegistry, type Params } from '../../models/registry';
import { C } from '../../theme/tokens';

/** The crease pattern each lab sheet is about (labs have no generator of their own). */
const LAB_PATTERN: Partial<Record<LabId, { generator: string; params: Params }>> = {
  conceptLab: { generator: 'miura', params: { rows: 4, cols: 6, a: 1, b: 1, alpha: 60 } },
  stepwise: { generator: 'singleVertex', params: { sectors: '60,120,120,60', mv: 'V,M,M,M' } },
  kreslingVsYoshimura: { generator: 'kresling', params: {} },
  kawasaki: { generator: 'singleVertex', params: { sectors: '70,100,110,80', mv: 'V,M,V,V' } },
  maekawa: { generator: 'singleVertex', params: { sectors: '60,40,70,80,50,60', mv: 'M,V,M,M,V,M' } },
  mvCrimp: { generator: 'singleVertex', params: { sectors: '60,40,70,80,50,60', mv: 'M,V,M,M,V,M' } },
  generalized: { generator: 'singleVertex', params: { sectors: '80,100,90,70', mv: 'V,M,V,V' } },
  gkawasaki: { generator: 'singleVertex', params: { sectors: '110,10,110,10,110,10', mv: 'M,V,M,V,M,V' } },
  // reading pages get a pattern that hints at their subject
  welcome: { generator: 'miura', params: { rows: 3, cols: 4, a: 1, b: 1, alpha: 60 } },
  firstFolds: { generator: 'waterbombBase', params: {} },
  atlas: { generator: 'waterbomb', params: { cols: 3, rows: 2 } },
  glossary: { generator: 'singleVertex', params: { sectors: '45,45,45,45,45,45,45,45', mv: 'M,V,M,V,M,V,M,M' } },
  beyond: { generator: 'resch', params: { m: 2, n: 2 } },
  tools: { generator: 'boxpleat', params: { n: 4, preset: 'grid' } },
  hobby: { generator: 'squareTwist', params: {} },
};

interface Thumb { segs: { a: Vec2; b: Vec2; as: Assignment }[]; box: [number, number, number, number] }

const thumbCache = new Map<string, Thumb | null>();

function thumbFor(lesson: Lesson): Thumb | null {
  if (thumbCache.has(lesson.id)) return thumbCache.get(lesson.id)!;
  let out: Thumb | null = null;
  const src = lesson.generator ? { generator: lesson.generator, params: lesson.params ?? {} } : lesson.lab ? LAB_PATTERN[lesson.lab] : undefined;
  if (src) {
    try {
      const m = buildFromRegistry(src.generator, src.params);
      const over = m.edu.layout2D?.edgeOverrides ?? {};
      const segs = m.edges.map((e) => {
        const [a, b] = over[e.id] ?? [m.vertices[e.vertices[0]].initialPosition2D, m.vertices[e.vertices[1]].initialPosition2D];
        return { a, b, as: e.assignment };
      });
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const { a, b } of segs) for (const p of [a, b]) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
      out = { segs, box: [x0, y0, x1 - x0, y1 - y0] };
    } catch { out = null; }
  }
  thumbCache.set(lesson.id, out);
  return out;
}

const STROKE: Record<Assignment, string> = { M: C.mountain, V: C.valley, B: C.ink, F: C.rule2, U: C.unassigned };

/** A crease pattern thumbnail whose lines are drawn in by a pen, boundary first. */
export function PatternThumb({ lesson, delay }: { lesson: Lesson; delay: number }) {
  const t = useMemo(() => thumbFor(lesson), [lesson]);
  if (!t) {
    // the 1D strip lab: a strip of paper with alternating parallel creases
    return (
      <svg viewBox="0 0 100 60" className="h-full w-full" aria-hidden>
        <rect x="6" y="20" width="88" height="20" fill={C.paperFront} stroke={C.ink} strokeWidth="0.8" className="pen-draw" pathLength={1} style={{ animationDelay: `${delay}ms` }} />
        {[22, 38, 51, 69, 80].map((x, i) => (
          <line key={x} x1={x} y1="20" x2={x} y2="40" stroke={i % 2 ? C.mountain : C.valley} strokeWidth="1.1" pathLength={1}
            className="pen-draw" style={{ animationDelay: `${delay + 200 + i * 60}ms` }} />
        ))}
      </svg>
    );
  }
  const [x, y, w, h] = t.box;
  const pad = Math.max(w, h) * 0.08;
  const lw = Math.max(w, h) / 90;
  const order = [...t.segs].sort((p, q) => (p.as === 'B' ? -1 : 0) - (q.as === 'B' ? -1 : 0));
  return (
    <svg viewBox={`${x - pad} ${-(y + h) - pad} ${w + 2 * pad} ${h + 2 * pad}`} className="h-full w-full" aria-hidden preserveAspectRatio="xMidYMid meet">
      <g transform="scale(1,-1)">
        {order.map((s, i) => (
          <line key={i} x1={s.a[0]} y1={s.a[1]} x2={s.b[0]} y2={s.b[1]} pathLength={1}
            stroke={STROKE[s.as]} strokeWidth={s.as === 'B' ? lw * 1.1 : s.as === 'F' ? lw * 0.5 : lw * 0.9} strokeLinecap="round"
            className="pen-draw" style={{ animationDelay: `${delay + Math.min(i, 60) * 9}ms` }} />
        ))}
      </g>
    </svg>
  );
}
