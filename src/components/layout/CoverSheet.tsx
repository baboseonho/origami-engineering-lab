import { Play, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { LECTURE_TITLES, LESSONS, PAGE_LABS, PARTS, THEORY_TAG, sheetNumber } from '../../curriculum/lessons';
import { tr } from '../../i18n';
import { useModel } from '../../state/modelStore';
import { useUI } from '../../state/uiStore';
import { coverCurrentSheet, openSheet } from '../../app/navigation';
import { C } from '../../theme/tokens';
import { FeaturedStrip } from '../landing/FeaturedStrip';
import { PatternThumb } from '../landing/PatternThumb';
import { EXPLAINERS } from '../explainers/ExplainerButton';
import { spans } from '../explainers/Explainer';

/** Length of a sheet's motion explainer in whole minutes (at least 1), for the tile's badge. */
const explainerMinutes = (id: string) => {
  const e = EXPLAINERS[id];
  return e ? Math.max(1, Math.round(spans(e.scenes()).reduce((t, x) => t + x, 0) / 60000)) : 0;
};

export { PatternThumb };


/**
 * 표지 · drawing index: every lesson is a plate in the set, shown with its
 * own crease pattern. Opened from the title block or on a first visit.
 */
export function CoverSheet() {
  const open = useUI((s) => s.coverOpen);
  const lang = useUI((s) => s.lang);
  // re-render when the sheet underneath changes; which one is marked "current" comes from the navigation
  useModel((s) => s.lessonId);
  const close = () => useUI.getState().setCoverOpen(false);
  const closeBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); before?.focus?.(); };
  }, [open]);
  if (!open) return null;
  // nothing on a first visit; after Back to the cover, the sheet last opened (not the welcome sheet under the cover)
  const current = coverCurrentSheet();
  let plate = 3;
  return (
    <div className="cover-backdrop fixed inset-0 z-50 overflow-y-auto bg-board/95 p-2 sm:p-4" onClick={close}>
      <div role="dialog" aria-modal="true" aria-label={tr('도면 목록', 'Sheet index')} className="cover-sheet sheet relative mx-auto max-w-[1280px] rounded-[3px]" onClick={(e) => e.stopPropagation()}>
        {/* stays at the top of the screen while the long index scrolls, so it is always one tap away */}
        <div className="sticky top-2 z-20 h-0">
          <div className="absolute right-5 top-3 flex gap-1.5 sm:right-7 sm:top-5">
            {/* the language is visible from the first screen, not only inside a menu */}
            <button type="button" onClick={() => useUI.getState().setLang(lang === 'ko' ? 'en' : 'ko')} aria-label={tr('Switch to English', '한국어로 보기')} lang={lang === 'ko' ? 'en' : 'ko'}
              className="inline-flex h-11 min-w-11 items-center justify-center rounded-[4px] border border-ink bg-paper px-2.5 text-[14px] font-semibold text-ink shadow-[0_1px_1px_rgb(23_32_42/0.06),0_2px_8px_-2px_rgb(23_32_42/0.14)] hover:bg-paper-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
              {lang === 'ko' ? 'EN' : '한'}
            </button>
            <button ref={closeBtn} type="button" onClick={close} aria-label={tr('도면 목록 닫기', 'Close the sheet index')}
              className="inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-[4px] border border-ink bg-paper px-3 text-[14px] font-medium text-ink shadow-[0_1px_1px_rgb(23_32_42/0.06),0_2px_8px_-2px_rgb(23_32_42/0.14)] hover:bg-paper-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
              <X size={18} aria-hidden /><span aria-hidden>{tr('닫기', 'Close')}</span>
            </button>
          </div>
        </div>
        <div className="grid-paper pointer-events-none absolute inset-0 opacity-60" aria-hidden />
        <div className="relative border-[1.5px] border-ink m-2 sm:m-3">
          {/* title block */}
          <header className="flex flex-wrap items-end gap-x-8 gap-y-2 border-b-[1.5px] border-ink px-4 py-4 sm:px-6 sm:py-5">
            <div>
              <div className="lettering text-[12px] text-ink-3">{tr('Origami Engineering · 도면 세트', 'Origami Engineering · drawing set')}</div>
              <h1 className="mt-1 text-[26px] font-semibold leading-none tracking-tight text-ink sm:text-[34px]">Origami BaBolaB</h1>
              <p className="mt-2 max-w-[56ch] break-keep text-[15px] leading-relaxed text-ink-2">
                {tr('종이 한 장이 접힘선(crease)을 따라 움직이는 방식을 직접 움직여 보며 배우는 도면집.', 'A set of drawings for learning how a sheet of paper moves along its creases, by moving it yourself.')}
              </p>
            </div>
            <dl className="ml-auto grid grid-cols-2 border border-rule-2 text-[13px] max-sm:hidden">
              {[[tr('도면', 'Sheets'), String(LESSONS.length)], [tr('단원', 'Parts'), String(PARTS.length)]].map(([k, v]) => (
                <div key={k} className="border-l border-rule-2 px-3 py-1.5 first:border-l-0">
                  <dt className="lettering text-[12px] text-ink-3">{k}</dt>
                  <dd className="tnum text-[18px] font-semibold text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </header>

          <FeaturedStrip delay={120} />

          {PARTS.map((lec) => (
            <section key={lec} className="border-b border-rule-2 px-4 pb-4 pt-3 last:border-b-0 sm:px-6">
              <h2 className="mb-2.5 flex items-baseline gap-3">
                <span className="tnum whitespace-nowrap text-[14px] font-semibold text-ink">{tr('단원', 'Part')} {lec}</span>
                <span className="text-[15px] font-semibold text-ink">{LECTURE_TITLES[lec]}</span>
                <span className="h-px flex-1 self-center border-t border-dashed border-rule-2" aria-hidden />
              </h2>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {LESSONS.filter((l) => l.lecture === lec).map((l) => {
                  plate += 1;
                  const delay = plate * 45;
                  const badge = l.id === current;
                  const mins = explainerMinutes(l.id);
                  return (
                    <button key={l.id} type="button"
                      onClick={() => openSheet(l.id)}
                      className={`plate group flex flex-col overflow-hidden rounded-[2px] border bg-paper text-left transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-ink hover:shadow-[0_6px_14px_-8px_rgb(23_32_42/0.45)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${badge ? 'border-ink ring-2 ring-mark' : 'border-rule-2'}`}
                      style={{ animationDelay: `${delay}ms` }}>
                      <div className="relative aspect-[4/3] shrink-0 border-b border-rule bg-paper-2/60">
                        <div className="absolute inset-x-3 bottom-2.5 top-5"><PatternThumb lesson={l} delay={delay + 180} /></div>
                        <span className="absolute left-1.5 top-1 tnum text-[12px] text-ink-3">{sheetNumber(l.id)}</span>
                        {l.kind === 'lab' && <span className="lettering absolute right-1.5 top-1 text-[12px] text-ink-3">{l.lab && PAGE_LABS.includes(l.lab) ? tr('읽기', 'Read') : tr('실습', 'Lab')}</span>}
                        {badge && <span className="lettering absolute bottom-1 right-1.5 rounded-[2px] bg-mark px-1 text-[12px] text-mark-ink">{tr('현재 도면', 'Current')}</span>}
                        {mins > 0 && <span className="absolute bottom-1 left-1.5 inline-flex items-center gap-0.5 rounded-[2px] border border-rule-2 bg-paper px-1 text-[12px] text-ink-2"><Play size={10} aria-hidden fill="currentColor" />{tr(`${mins}분 애니메이션`, `${mins}-min animation`)}</span>}
                      </div>
                      <div className="px-2.5 py-2">
                        <div className="break-keep text-[14px] font-medium leading-snug text-ink [overflow-wrap:break-word] group-hover:underline group-hover:decoration-mark group-hover:decoration-2 group-hover:underline-offset-2">{l.title}</div>
                        {l.coverNote ? <div className="mt-0.5 truncate text-[12px] text-ink-3">{l.coverNote}</div>
                          : l.theory.some((t) => THEORY_TAG[t]) && <div className="mt-0.5 truncate text-[12px] text-ink-3">{l.theory.map((t) => THEORY_TAG[t]).filter(Boolean).join(' · ')}</div>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          <footer className="flex flex-wrap justify-between gap-2 border-t-[1.5px] border-ink px-4 py-2 text-[12px] text-ink-3 sm:px-6">
            <span><b style={{ color: C.mountain }}>━ ·</b> {tr('산접기', 'Mountain')} &nbsp; <b style={{ color: C.valley }}>‒ ‒</b> {tr('골접기', 'Valley')} &nbsp; <b className="text-ink">━</b> {tr('경계', 'Edge')}</span>
            <span className="max-md:hidden">{tr('Esc로 닫기', 'Esc to close')}</span>
          </footer>
        </div>
      </div>
    </div>
  );
}
