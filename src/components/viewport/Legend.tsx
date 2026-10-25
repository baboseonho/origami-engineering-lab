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

/** Always-visible M/V legend (folding-diagram line styles) and the fold-angle sign convention. */
export function Legend({ compact, position = 'bottom' }: { compact?: boolean; position?: 'bottom' | 'top' }) {
  const model = useModel((s) => s.model);
  const present = new Set(model ? model.edges.map((e) => e.assignment) : ['M', 'V']);
  const shown = items().filter(([k]) => k === 'M' || k === 'V' || present.has(k as never));
  return (
    <div className={`pointer-events-none absolute left-[15px] max-w-[calc(100%-30px)] rounded-[3px] border border-ink/50 bg-paper/95 px-2.5 py-1.5 text-[12px] leading-tight text-ink-2 ${position === 'top' ? 'top-[15px]' : 'bottom-[48px]'}`}>
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
    </div>
  );
}
