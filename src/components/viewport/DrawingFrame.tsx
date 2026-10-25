import type { ReactNode } from 'react';
import { tr } from '../../i18n';

const ZONES_X = ['A', 'B', 'C', 'D', 'E', 'F'];
const ZONES_Y = ['1', '2', '3', '4'];

/**
 * Engineering-drawing border around a view: inner frame line with zone
 * references on the margins and a small title block naming the view.
 * Purely visual; pointer events pass through to the view.
 */
export function DrawingFrame({ title, subtitle, children, grid = true, status, statusTone = 'info' }: { title: string; subtitle?: string; children: ReactNode; grid?: boolean; status?: string; statusTone?: 'info' | 'ok' }) {
  return (
    <div className={`relative h-full w-full overflow-hidden ${grid ? "grid-paper" : "bg-paper"}`}>
      {children}
      <div className="pointer-events-none absolute inset-[7px] border border-ink/70" aria-hidden>
        {ZONES_X.map((z, i) => (
          <span key={'x' + z} className="absolute top-0 flex h-full flex-col justify-between" style={{ left: `${((i + 0.5) / ZONES_X.length) * 100}%` }}>
            <span className="lettering -mt-[7px] -translate-x-1/2 text-[12px] leading-none text-ink-3/55">{z}</span>
            <span className="lettering -mb-[7px] -translate-x-1/2 text-[12px] leading-none text-ink-3/55">{z}</span>
          </span>
        ))}
        {ZONES_X.slice(1).map((_, i) => (
          <span key={'tx' + i} className="absolute top-0 h-[5px] w-px bg-ink/60" style={{ left: `${((i + 1) / ZONES_X.length) * 100}%` }} />
        ))}
        {ZONES_Y.map((z, i) => (
          <span key={'y' + z} className="lettering absolute -left-[6px] -translate-y-1/2 text-[12px] leading-none text-ink-3/55" style={{ top: `${((i + 0.5) / ZONES_Y.length) * 100}%` }}>{z}</span>
        ))}
        {ZONES_Y.slice(1).map((_, i) => (
          <span key={'ty' + i} className="absolute left-0 h-px w-[5px] bg-ink/60" style={{ top: `${((i + 1) / ZONES_Y.length) * 100}%` }} />
        ))}
        <div className="absolute bottom-0 right-0 flex border-l border-t border-ink/70 bg-paper/95 text-ink">
          {status && (
            <div className={`border-r border-ink/40 px-2 py-1 ${statusTone === 'ok' ? 'bg-ok-soft text-ok' : 'bg-info-soft text-info'}`}>
              <div className="lettering text-[12px] leading-none opacity-80">{tr('솔버', 'Solver')}</div>
              <div className="whitespace-nowrap text-[13px] font-semibold leading-tight">{status}</div>
            </div>
          )}
          <div className="border-r border-ink/40 px-2 py-1">
            <div className="lettering text-[12px] leading-none text-ink-3">{tr('보기', 'View')}</div>
            <div className="whitespace-nowrap text-[13px] font-semibold leading-tight">{title}</div>
          </div>
          {subtitle && (
            <div className="px-2 py-1">
              <div className="lettering text-[12px] leading-none text-ink-3">{tr('모델', 'Model')}</div>
              <div className="max-w-[220px] truncate text-[13px] leading-tight text-ink-2">{subtitle}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
