/** Placeholder shown while a lazily loaded sheet (3D view, lab, theory) arrives. */
export function SheetLoading({ label = '도면을 펼치는 중' }: { label?: string }) {
  return (
    <div className="grid-paper flex h-full w-full items-center justify-center" role="status" aria-live="polite">
      <div className="flex items-center gap-3 rounded-[3px] border border-rule-2 bg-paper/95 px-4 py-3 text-[14px] text-ink-2">
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden className="animate-pulse">
          <rect x="1" y="1" width="20" height="20" fill="none" stroke="var(--color-ink-3)" strokeWidth="1.2" />
          <path d="M1 21 L21 1" stroke="var(--color-valley)" strokeWidth="1.2" strokeDasharray="3 2" />
        </svg>
        {label}…
      </div>
    </div>
  );
}
