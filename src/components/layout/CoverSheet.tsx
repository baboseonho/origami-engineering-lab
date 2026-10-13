import { X } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { LESSONS, type LabId, type Lesson } from '../../curriculum/lessons';
import type { Vec2 } from '../../core/geometry/vectors';
import type { Assignment } from '../../core/topology/types';
import { buildFromRegistry, type Params } from '../../models/registry';
import { useModel } from '../../state/modelStore';
import { useUI } from '../../state/uiStore';
import { loadLesson } from '../../state/actions';
import { C } from '../../theme/tokens';

const LECTURE_NAME: Record<number, string> = {
  1: '도입 · 형상과 기능',
  2: '평탄 접기의 정리',
  3: '강체 접기와 자유도',
  4: '테셀레이션',
  5: '원통과 응용 패턴',
};

/** The crease pattern each lab sheet is about (labs have no generator of their own). */
const LAB_PATTERN: Partial<Record<LabId, { generator: string; params: Params }>> = {
  conceptLab: { generator: 'miura', params: { rows: 4, cols: 6, a: 1, b: 1, alpha: 60 } },
  stepwise: { generator: 'singleVertex', params: { sectors: '60,120,120,60', mv: 'V,M,M,M' } },
  kreslingVsYoshimura: { generator: 'kresling', params: {} },
  kawasaki: { generator: 'singleVertex', params: { sectors: '70,100,110,80', mv: 'V,M,V,V' } },
  maekawa: { generator: 'singleVertex', params: { sectors: '60,40,70,80,50,60', mv: 'M,V,M,M,V,M' } },
  mvCrimp: { generator: 'singleVertex', params: { sectors: '60,40,70,80,50,60', mv: 'M,V,M,M,V,M' } },
  generalized: { generator: 'singleVertex', params: { sectors: '80,100,90,70', mv: 'V,M,V,V' } },
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
function PatternThumb({ lesson, delay }: { lesson: Lesson; delay: number }) {
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

/**
 * 표지 · drawing index: every lesson is a plate in the set, shown with its
 * own crease pattern. Opened from the title block or on a first visit.
 */
export function CoverSheet() {
  const open = useUI((s) => s.coverOpen);
  const current = useModel((s) => s.lessonId);
  const close = () => useUI.getState().setCoverOpen(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  if (!open) return null;
  let plate = 0;
  return (
    <div className="cover-backdrop fixed inset-0 z-50 overflow-y-auto bg-board/95 p-2 sm:p-4" onClick={close}>
      <div role="dialog" aria-modal="true" aria-label="도면 목록" className="cover-sheet sheet relative mx-auto max-w-[1280px] rounded-[3px]" onClick={(e) => e.stopPropagation()}>
        <div className="grid-paper pointer-events-none absolute inset-0 opacity-60" aria-hidden />
        <div className="relative border-[1.5px] border-ink m-2 sm:m-3">
          {/* title block */}
          <header className="flex flex-wrap items-end gap-x-8 gap-y-2 border-b-[1.5px] border-ink px-4 py-4 sm:px-6 sm:py-5">
            <div>
              <div className="lettering text-[11px] text-ink-3">AE53006 · KAIST · 도면 세트</div>
              <h1 className="mt-1 text-[26px] font-semibold leading-none tracking-tight text-ink sm:text-[34px]">Origami BaBolaB</h1>
              <p className="mt-2 max-w-[56ch] text-[14px] leading-relaxed text-ink-2">
                한 장의 종이가 접힘선(crease)을 따라 움직이는 방식을 강의 순서대로 따라가는 실습 도면집. 도면을 고르면 그 전개도가 펼쳐진다.
              </p>
            </div>
            <dl className="ml-auto grid grid-cols-3 border border-rule-2 text-[12px]">
              {[['도면', String(LESSONS.length)], ['강의', '5'], ['척도', '1:1']].map(([k, v]) => (
                <div key={k} className="border-l border-rule-2 px-3 py-1.5 first:border-l-0">
                  <dt className="lettering text-[10.5px] text-ink-3">{k}</dt>
                  <dd className="tnum text-[17px] font-semibold text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <button type="button" onClick={close} aria-label="도면 목록 닫기"
              className="absolute right-2 top-2 rounded-[4px] p-1.5 text-ink-3 hover:bg-paper-2 hover:text-ink"><X size={18} /></button>
          </header>

          {([1, 2, 3, 4, 5] as const).map((lec) => (
            <section key={lec} className="border-b border-rule-2 px-4 pb-4 pt-3 last:border-b-0 sm:px-6">
              <h2 className="mb-2.5 flex items-baseline gap-3">
                <span className="tnum text-[13px] font-semibold text-ink">L{lec}</span>
                <span className="text-[14px] font-semibold text-ink">{LECTURE_NAME[lec]}</span>
                <span className="h-px flex-1 self-center border-t border-dashed border-rule-2" aria-hidden />
              </h2>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {LESSONS.filter((l) => l.lecture === lec).map((l, i) => {
                  plate += 1;
                  const delay = plate * 45;
                  const here = l.id === current;
                  return (
                    <button key={l.id} type="button"
                      onClick={() => { close(); if (!here) loadLesson(l.id); }}
                      className={`plate group flex flex-col overflow-hidden rounded-[2px] border bg-paper text-left transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-ink hover:shadow-[0_6px_14px_-8px_rgb(23_32_42/0.45)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${here ? 'border-ink ring-2 ring-mark' : 'border-rule-2'}`}
                      style={{ animationDelay: `${delay}ms` }}>
                      <div className="relative aspect-[4/3] shrink-0 border-b border-rule bg-paper-2/60">
                        <div className="absolute inset-x-3 bottom-2.5 top-5"><PatternThumb lesson={l} delay={delay + 180} /></div>
                        <span className="absolute left-1.5 top-1 tnum text-[10.5px] text-ink-3">{lec}-{String(i + 1).padStart(2, '0')}</span>
                        {l.kind === 'lab' && <span className="lettering absolute right-1.5 top-1 text-[10px] text-ink-3">실습</span>}
                        {here && <span className="lettering absolute bottom-1 right-1.5 rounded-[2px] bg-mark px-1 text-[10px] text-mark-ink">현재 도면</span>}
                      </div>
                      <div className="px-2.5 py-2 text-[13px] font-medium leading-snug text-ink group-hover:underline group-hover:decoration-mark group-hover:decoration-2 group-hover:underline-offset-2">{l.title}</div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          <footer className="flex flex-wrap justify-between gap-2 border-t-[1.5px] border-ink px-4 py-2 text-[11.5px] text-ink-3 sm:px-6">
            <span><b style={{ color: C.mountain }}>━ ·</b> 산접기 Mountain &nbsp; <b style={{ color: C.valley }}>‒ ‒</b> 골접기 Valley &nbsp; <b className="text-ink">━</b> 경계</span>
            <span>Esc로 닫기</span>
          </footer>
        </div>
      </div>
    </div>
  );
}
