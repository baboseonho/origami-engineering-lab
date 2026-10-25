import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { tr } from '../../i18n';

/**
 * A sheet that unfolds from the screen edge like a paper flap (hinge on the
 * fixed edge). Used for the drawing index and the inspector on narrow screens.
 */
export function Drawer({ side, open, onClose, label, children }: {
  side: 'left' | 'bottom'; open: boolean; onClose: () => void; label: string; children: ReactNode;
}) {
  const [shown, setShown] = useState(open);
  const [unfolded, setUnfolded] = useState(false);
  useEffect(() => {
    if (open) {
      setShown(true);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setUnfolded(true)));
      return () => cancelAnimationFrame(id);
    }
    setUnfolded(false);
    const t = setTimeout(() => setShown(false), 240);
    return () => clearTimeout(t);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!shown) return null;
  const left = side === 'left';
  const folded = left ? 'perspective(1200px) rotateY(88deg)' : 'perspective(1200px) rotateX(-88deg)';
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={label}>
      <button type="button" aria-label={tr('닫기', 'Close')} onClick={onClose}
        className={`absolute inset-0 bg-ink/30 transition-opacity duration-200 ${unfolded ? 'opacity-100' : 'opacity-0'}`} />
      <div
        className={`absolute flex flex-col overflow-hidden ${left ? 'inset-y-2 left-2 w-[min(340px,88vw)]' : 'inset-x-2 bottom-2 h-[min(78dvh,640px)]'}`}
        style={{
          transformOrigin: left ? 'left center' : 'center bottom',
          transform: unfolded ? 'none' : folded,
          opacity: unfolded ? 1 : 0,
          transition: 'transform 240ms cubic-bezier(0.16, 1, 0.3, 1), opacity 160ms ease-out',
        }}
      >
        <div className="sheet flex min-h-0 flex-1 flex-col overflow-hidden rounded-[3px]">
          <div className="flex shrink-0 items-center justify-between border-b border-rule-2 bg-paper-2 py-1 pl-4 pr-1.5">
            <span className="lettering text-[12px] text-ink-3">{label}</span>
            <button type="button" onClick={onClose} aria-label={tr('닫기', 'Close')}
              className="flex h-8 w-8 items-center justify-center rounded-[4px] text-ink-2 hover:bg-paper hover:text-ink">
              <X size={16} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        </div>
      </div>
    </div>
  );
}
