import { useState } from 'react';
import { ASSIGN_COLOR } from '../controls/ui';
import { useModel } from '../../state/modelStore';
import { tr } from '../../i18n';
import { Rich } from '../controls/Rich';

const items = (): [string, string, string | undefined][] => [
  ['M', tr('산접기 M', 'Mountain M'), '6 2.5 1.5 2.5'],
  ['V', tr('골접기 V', 'Valley V'), '5 3'],
  ['F', tr('면', 'Facet'), undefined],
  ['B', tr('경계', 'Boundary'), undefined],
  ['U', tr('미지정', 'Unassigned'), undefined],
];

/**
 * Always-visible M/V legend (folding-diagram line styles) and the fold-angle
 * sign convention. On a phone it would cover a quarter of the model, so it
 * folds into a small "범례" chip that opens the card on a tap.
 */
export function Legend({ compact, position = 'bottom' }: { compact?: boolean; position?: 'bottom' | 'top' }) {
  const model = useModel((s) => s.model);
  const [open, setOpen] = useState(false);
  const present = new Set(model ? model.edges.map((e) => e.assignment) : ['M', 'V']);
  const shown = items().filter(([k]) => k === 'M' || k === 'V' || present.has(k as never));
  const place = position === 'top' ? 'top-[15px]' : 'bottom-[48px] max-md:bottom-[15px]';
  return (
    <>
      {!open && (
        <button type="button" aria-expanded={false} onClick={() => setOpen(true)}
          className={`absolute left-[15px] z-10 flex h-11 items-center gap-1.5 rounded-[3px] border border-ink/50 bg-paper/95 px-3 text-[13px] font-medium text-ink-2 md:hidden ${position === 'top' ? 'top-[15px]' : 'bottom-[15px]'}`}>
          <svg width="14" height="10" aria-hidden><line x1="1" y1="2.5" x2="13" y2="2.5" stroke={ASSIGN_COLOR.M} strokeWidth={2} strokeDasharray="4 1.5 1 1.5" /><line x1="1" y1="7.5" x2="13" y2="7.5" stroke={ASSIGN_COLOR.V} strokeWidth={2} strokeDasharray="3 2" /></svg>
          {tr('범례', 'Legend')}
        </button>
      )}
      <div onClick={() => setOpen(false)}
        className={`absolute left-[15px] max-w-[calc(100%-30px)] rounded-[3px] border border-ink/50 bg-paper/95 px-2.5 py-1.5 text-[12px] leading-tight text-ink-2 md:pointer-events-none ${place} ${open ? 'z-10' : 'max-md:hidden'}`}>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {shown.map(([k, l, dash]) => (
            <span key={k} className="flex items-center gap-1.5">
              <svg width="18" height="6" aria-hidden><line x1="1" y1="3" x2="17" y2="3" stroke={ASSIGN_COLOR[k]} strokeWidth={k === 'F' ? 1 : 2} strokeDasharray={dash} /></svg>
              {l}
            </span>
          ))}
        </div>
        {!compact && (
          <div className="tnum mt-1 text-[12px] text-ink-3">
            <Rich text={tr('$\\rho = 0$ 평면 · $\\rho > 0$ 골 · $\\rho < 0$ 산 · $|\\rho| = 180^\\circ$ 완전 접힘',
              '$\\rho = 0$ flat · $\\rho > 0$ valley · $\\rho < 0$ mountain · $|\\rho| = 180^\\circ$ fully folded')} />
          </div>
        )}
        {open && <div className="mt-1 text-[12px] text-ink-3 md:hidden">{tr('눌러서 닫기', 'Tap to close')}</div>}
      </div>
    </>
  );
}
