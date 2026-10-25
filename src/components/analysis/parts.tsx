import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { tr } from '../../i18n';

/** One line that says what a tab (or panel) is for: a short heading and a sentence. */
export function Lead({ title, children, right }: { title: ReactNode; children?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <p className="min-w-0 text-[14px] leading-snug text-ink-2">
        <span className="mr-2 text-[15px] font-semibold text-ink">{title}</span>
        {children}
      </p>
      {right}
    </div>
  );
}

/** Lettering caption over a group of controls or a block of numbers. */
export function Caption({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`lettering mb-1.5 text-[12px] text-ink-3 ${className}`}>{children}</div>;
}

/** The one number a panel is about, set large. */
export function Readout({ label, children, note }: { label: ReactNode; children: ReactNode; note?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3 border-b border-dashed border-rule-2 pb-2">
      <span className="text-[13px] text-ink-3">{label}</span>
      <span className="text-right">
        <span className="tnum text-[22px] font-semibold leading-none text-ink">{children}</span>
        {note && <span className="ml-2 text-[13px] text-ink-3">{note}</span>}
      </span>
    </div>
  );
}

/** Long explanations stay folded behind "자세히 / Details". */
export function More({ children, summary }: { children: ReactNode; summary?: ReactNode }) {
  return (
    <details className="group mt-2">
      <summary className="inline-flex cursor-pointer select-none list-none items-center gap-1 rounded px-1 -ml-1 text-[13px] text-ink-3 hover:bg-paper-2 hover:text-ink [&::-webkit-details-marker]:hidden">
        <ChevronRight size={14} className="transition-transform group-open:rotate-90" aria-hidden />
        {summary ?? tr('자세히', 'Details')}
      </summary>
      <div className="mt-1.5 space-y-1.5 text-[14px] leading-relaxed text-ink-2">{children}</div>
    </details>
  );
}
