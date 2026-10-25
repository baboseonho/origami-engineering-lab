import { useEffect, useState } from 'react';
import { Info, X } from 'lucide-react';
import { useUI } from '../../state/uiStore';
import { tr } from '../../i18n';

/**
 * A short note pinned to the bottom of the board when the app changed
 * something by itself (e.g. switched the solver). Hides after a few seconds.
 */
export function Toast() {
  const notice = useUI((s) => s.notice);
  const [hidden, setHidden] = useState(0);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setHidden(notice.n), 5000);
    return () => clearTimeout(t);
  }, [notice]);
  const visible = notice && notice.n !== hidden;
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-2 bottom-14 z-[45] flex justify-center">
      {visible && (
        <div key={notice.n} className="toast sheet pointer-events-auto flex max-w-[min(560px,100%)] items-start gap-2.5 rounded-[3px] border border-ink px-3.5 py-2.5 text-[14px] leading-relaxed text-ink shadow-[0_10px_24px_-14px_rgb(23_32_42/0.6)]">
          <Info size={17} className="mt-0.5 shrink-0 text-info" aria-hidden />
          <span>{notice.text}</span>
          <button type="button" onClick={() => setHidden(notice.n)} aria-label={tr('알림 닫기', 'Dismiss notice')} className="-mr-1 shrink-0 rounded p-0.5 text-ink-3 hover:bg-paper-2 hover:text-ink"><X size={16} /></button>
        </div>
      )}
    </div>
  );
}
