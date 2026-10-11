import { ASSIGN_COLOR } from '../controls/ui';
import { useModel } from '../../state/modelStore';

const ITEMS: [string, string, string | undefined][] = [
  ['M', '산접기 M', '6 2.5 1.5 2.5'],
  ['V', '골접기 V', '5 3'],
  ['F', '면', undefined],
  ['B', '경계', undefined],
  ['U', '미지정', undefined],
];

/** Always-visible M/V legend (folding-diagram line styles) and the fold-angle sign convention. */
export function Legend({ compact, position = 'bottom' }: { compact?: boolean; position?: 'bottom' | 'top' }) {
  const model = useModel((s) => s.model);
  const present = new Set(model ? model.edges.map((e) => e.assignment) : ['M', 'V']);
  const items = ITEMS.filter(([k]) => k === 'M' || k === 'V' || present.has(k as never));
  return (
    <div className={`pointer-events-none absolute left-[15px] max-w-[calc(100%-30px)] rounded-[3px] border border-ink/50 bg-paper/95 px-2.5 py-1.5 text-[11.5px] leading-tight text-ink-2 ${position === 'top' ? 'top-[15px]' : 'bottom-[48px]'}`}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        {items.map(([k, l, dash]) => (
          <span key={k} className="flex items-center gap-1.5">
            <svg width="18" height="6" aria-hidden><line x1="1" y1="3" x2="17" y2="3" stroke={ASSIGN_COLOR[k]} strokeWidth={k === 'F' ? 1 : 2} strokeDasharray={dash} /></svg>
            {l}
          </span>
        ))}
      </div>
      {!compact && (
        <div className="tnum mt-1 text-[11px] text-ink-3">
          <span className="greek">ρ</span> = 0 평면 · <span className="greek">ρ</span> &gt; 0 골 · <span className="greek">ρ</span> &lt; 0 산 · |<span className="greek">ρ</span>| → 180° 완전 접힘
        </div>
      )}
    </div>
  );
}
