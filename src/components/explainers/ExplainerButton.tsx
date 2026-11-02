import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clapperboard, X } from 'lucide-react';
import { tr } from '../../i18n';
import { Explainer, spans, type Scene } from './Explainer';
import { kawasakiScenes } from './Kawasaki';
import { maekawaScenes } from './Maekawa';
import { bagScenes } from './Bag';
import { hyparScenes } from './Hypar';

interface Entry { title: () => string; scenes: () => Scene[] }

const KAWASAKI: Entry = { title: () => tr('Kawasaki 정리: 접힌 길은 제자리로 돌아와야 한다', 'Kawasaki\'s theorem: the folded walk must come home'), scenes: kawasakiScenes };
const MAEKAWA: Entry = { title: () => tr('Maekawa 정리: 산과 골의 차는 왜 2일까', 'Maekawa\'s theorem: why mountains and valleys differ by two'), scenes: maekawaScenes };
const BAG: Entry = { title: () => tr('쇼핑백 정리: 단단한 종이로는 접히지 않는다', 'The shopping-bag theorem: rigid paper will not fold it'), scenes: bagScenes };
const HYPAR: Entry = { title: () => tr('하이파: 그려진 선만으로는 왜 접히지 않을까', 'The hypar: why the drawn creases alone cannot fold it'), scenes: hyparScenes };

/** Which motion explainer belongs to which sheet. */
export const EXPLAINERS: Record<string, Entry> = {
  'l2-kawasaki': KAWASAKI,
  'l2-single': KAWASAKI,
  'l6-twist': KAWASAKI,
  'l2-maekawa': MAEKAWA,
  'l2-mv': MAEKAWA,
  'l3-bag': BAG,
  'l6-hypar': HYPAR,
};

const minutes = (e: Entry) => Math.max(1, Math.round(spans(e.scenes()).reduce((s, x) => s + x, 0) / 60000));

/** A button that opens the sheet's motion explainer in a large player. */
export function ExplainerButton({ lessonId, variant = 'card' }: { lessonId: string; variant?: 'card' | 'bar' }) {
  const entry = EXPLAINERS[lessonId];
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  if (!entry) return null;
  const label = tr('애니메이션으로 보기', 'Watch it animated');
  return (
    <>
      {variant === 'card' ? (
        <button type="button" onClick={() => setOpen(true)} title={entry.title()}
          className="group mt-3 flex min-h-11 w-full items-center gap-2.5 rounded-[3px] border border-ink bg-paper px-2.5 py-2 text-left transition-colors hover:bg-paper-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-paper"><Clapperboard size={15} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold leading-tight text-ink">{label}</span>
            <span className="block truncate text-[12px] text-ink-3">{tr(`약 ${minutes(entry)}분, 단계별 설명`, `about ${minutes(entry)} min, step by step`)}</span>
          </span>
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)}
          className="mb-3 inline-flex items-center gap-2 rounded-[4px] border border-ink bg-paper px-3 py-1.5 text-[14px] font-semibold text-ink hover:bg-paper-2">
          <Clapperboard size={16} />{label}<span className="font-normal text-ink-3">({tr(`약 ${minutes(entry)}분`, `about ${minutes(entry)} min`)})</span>
        </button>
      )}
      {open && createPortal(
        <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-ink/45 p-3" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label={entry.title()} className="sheet w-full max-w-[860px] rounded-[3px] p-3 sm:p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2.5 flex items-start justify-between gap-3">
              <h2 className="text-[18px] font-semibold leading-snug text-ink">{entry.title()}</h2>
              <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label={tr('닫기', 'Close')} className="-mr-1.5 -mt-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-[4px] text-ink-3 hover:bg-paper-2 hover:text-ink"><X size={20} /></button>
            </div>
            <Explainer title={entry.title()} scenes={entry.scenes()} />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/**
 * The sheet's motion explainer laid open in the page (phone theory tab): the
 * step-by-step argument right under the formula, started by the reader.
 */
export function ExplainerInline({ lessonId }: { lessonId: string }) {
  const entry = EXPLAINERS[lessonId];
  if (!entry) return null;
  return (
    <section aria-label={entry.title()} className="mt-4">
      <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-ink"><Clapperboard size={15} aria-hidden />{tr('애니메이션으로 보기', 'Watch it animated')}<span className="font-normal text-ink-3">({tr(`약 ${minutes(entry)}분`, `about ${minutes(entry)} min`)})</span></h3>
      <p className="mb-2 mt-0.5 text-[14px] leading-snug text-ink-2">{entry.title()}</p>
      <Explainer title={entry.title()} scenes={entry.scenes()} autoPlay={false} />
    </section>
  );
}
