import { ArrowRight } from 'lucide-react';
import { lessonById, sheetNumber } from '../../curriculum/lessons';
import { bi, structureForSheet } from '../../curriculum/structures';
import { tr } from '../../i18n';
import { openSheet } from '../../app/navigation';
import { PatternThumb } from './PatternThumb';

/** The structures shown in the reels, in reel order (waterbomb last, optional). */
export const FEATURED_SHEETS = ['l4-miura', 'l5-yoshimura', 'l3-bag', 'l5-kresling', 'l6-wbtube', 'l4-waterbomb'];

/**
 * On the cover, right under its title block: the structures from the reels,
 * one tap from folding. A sideways row on a phone, a grid on wider sheets.
 */
export function FeaturedStrip({ delay = 0 }: { delay?: number }) {
  const items = FEATURED_SHEETS.map((id) => ({ id, lesson: lessonById(id), s: structureForSheet(id) })).filter((x) => x.lesson && x.s);
  if (!items.length) return null;
  return (
    <section aria-labelledby="featured-title" className="border-b-[1.5px] border-ink bg-paper-2/70 px-4 pb-4 pt-3 sm:px-6">
      <h2 id="featured-title" className="mb-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className="text-[18px] font-semibold text-ink">{tr('릴스에서 보고 왔나요?', 'Saw it on Instagram?')}</span>
        <span className="text-[15px] text-ink-2">{tr('하나를 눌러서 바로 접어 보세요.', 'Tap one and fold it.')}</span>
      </h2>
      {/* phone: one row that scrolls sideways (the next card peeks in); md and up: a grid */}
      <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:scroll-px-6 sm:px-6 md:mx-0 md:grid md:snap-none md:grid-cols-3 md:overflow-visible md:px-0 xl:grid-cols-6">
        {items.map(({ id, lesson, s }, i) => {
          const d = delay + i * 60;
          return (
            <li key={id} className="w-[220px] shrink-0 snap-start md:w-auto">
              <button type="button" onClick={() => openSheet(id)}
                className="plate group flex h-full min-h-[44px] w-full flex-col overflow-hidden rounded-[2px] border border-ink bg-paper text-left transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_14px_-8px_rgb(23_32_42/0.45)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                style={{ animationDelay: `${d}ms` }}>
                <div className="relative aspect-[16/10] shrink-0 border-b border-rule bg-paper-2/60">
                  <div className="absolute inset-x-3 bottom-2.5 top-5"><PatternThumb lesson={lesson!} delay={d + 180} /></div>
                  <span className="tnum absolute left-1.5 top-1 text-[12px] text-ink-3">{sheetNumber(id)}</span>
                </div>
                <div className="flex flex-1 flex-col px-2.5 pb-2.5 pt-2">
                  <div className="text-[15px] font-semibold leading-snug text-ink">{bi(s!.name)}</div>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{bi(s!.hook)}</p>
                  <span className="mt-auto inline-flex items-center gap-1 pt-2 text-[13px] font-medium text-ink group-hover:underline group-hover:decoration-mark group-hover:decoration-2 group-hover:underline-offset-2">
                    {tr('바로 접어 보기', 'Fold it now')}<ArrowRight size={14} aria-hidden />
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
