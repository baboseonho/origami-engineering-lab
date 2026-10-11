import { useEffect, useId, useState, type ReactNode } from 'react';
import { AlertTriangle, Check, ChevronDown, Info, Minus, X } from 'lucide-react';
import { toDeg, toRad } from '../../core/geometry/angles';
import { C } from '../../theme/tokens';
import { useUI } from '../../state/uiStore';

/** Domain convention: Mountain red pencil, Valley ink blue. */
export const ASSIGN_COLOR: Record<string, string> = {
  M: C.mountain,
  V: C.valley,
  F: C.facet,
  U: C.unassigned,
  B: C.ink2,
};

export const ASSIGN_LABEL: Record<string, string> = {
  M: '산접기 M',
  V: '골접기 V',
  F: '면 내부 F',
  U: '미지정 U',
  B: '경계 B',
};

/**
 * A titled region of a drawing sheet. Optional `foldable`: the body folds
 * away along the title crease (the app's signature move).
 */
export function Section({ title, children, right, dense, foldable, defaultOpen = true }: {
  title: ReactNode; children: ReactNode; right?: ReactNode; dense?: boolean; foldable?: boolean; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const head = (
    <h3 className="lettering text-[11.5px] text-ink-3">{title}</h3>
  );
  return (
    <section className={`border-b border-dashed border-rule-2 ${dense ? 'px-4 py-2.5' : 'px-4 py-3'}`}>
      <div className="mb-2 flex min-h-6 items-center justify-between gap-2">
        {foldable ? (
          <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}
            className="group -ml-1 flex items-center gap-1 rounded px-1 text-left hover:bg-paper-2">
            <ChevronDown size={14} className={`text-ink-3 transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
            {head}
          </button>
        ) : head}
        {right}
      </div>
      {foldable ? <FoldBody id={id} open={open}>{children}</FoldBody> : children}
    </section>
  );
}

/** Collapsible body that folds along its top edge (rotateX hinge + height collapse). */
export function FoldBody({ open, children, id }: { open: boolean; children: ReactNode; id?: string }) {
  return (
    <div id={id} className="grid transition-[grid-template-rows] duration-200 ease-out" style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
      <div className="min-h-0 overflow-hidden">
        <div className="fold-body" data-folded={!open}>{children}</div>
      </div>
    </div>
  );
}

export type Status = 'ok' | 'warn' | 'bad' | 'na' | 'info';
const STAMP: Record<Status, string> = {
  ok: 'text-ok border-ok',
  warn: 'text-warn border-warn',
  bad: 'text-bad border-bad',
  na: 'text-ink-3 border-ink-3/60',
  info: 'text-info border-info',
};
const STAMP_ICON: Record<Status, typeof Check> = { ok: Check, warn: AlertTriangle, bad: X, na: Minus, info: Info };
/** default word carried by every stamp, so a stamp never reads as a checkbox */
export const STAMP_WORD: Record<Status, string> = { ok: '가능', warn: '주의', bad: '불가', na: '해당 없음', info: '참고' };

/** Inspector's ink stamp: thin outline, always carries a word. */
export function Badge({ status, children }: { status: Status; children?: ReactNode }) {
  const Icon = STAMP_ICON[status];
  return (
    <span className={`stamp-in inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-[2px] border-[1.5px] bg-paper px-1.5 py-[1px] text-[12px] font-semibold leading-[1.35] ${STAMP[status]}`}>
      <Icon size={12} strokeWidth={2.75} aria-hidden />
      {children ?? STAMP_WORD[status]}
    </span>
  );
}

export function StatusRow({ label, status, value, title }: { label: ReactNode; status: Status; value?: ReactNode; title?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1" title={title}>
      <span className="min-w-0 text-[13px] leading-snug text-ink-2">{label}</span>
      <span className="flex shrink-0 items-center gap-2">
        {value !== undefined && <span className="tnum text-[12px] text-ink-3">{value}</span>}
        <Badge key={status} status={status} />
      </span>
    </div>
  );
}

export function KV({ k, v, mono = true }: { k: ReactNode; v: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[3px] text-[13px]">
      <span className="text-ink-3">{k}</span>
      <span className={`${mono ? 'tnum' : ''} text-right text-ink`}>{v}</span>
    </div>
  );
}

export function Button({ children, onClick, active, disabled, title, kind = 'default', className = '', size = 'md' }: {
  children: ReactNode; onClick?: () => void; active?: boolean; disabled?: boolean; title?: string;
  kind?: 'default' | 'primary' | 'ghost' | 'danger'; className?: string; size?: 'sm' | 'md';
}) {
  const base = `inline-flex items-center justify-center gap-1.5 rounded-[4px] font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45 ${size === 'sm' ? 'h-7 px-2 text-[12px]' : 'h-8 px-3 text-[13px]'}`;
  const styles = {
    default: active ? 'bg-ink text-paper border border-ink' : 'bg-paper text-ink border border-rule-2 hover:border-ink-3 hover:bg-paper-2',
    primary: 'bg-ink text-paper border border-ink hover:bg-ink-2',
    ghost: active ? 'bg-paper-3 text-ink' : 'text-ink-2 hover:bg-paper-2 hover:text-ink',
    danger: 'bg-bad text-paper border border-bad hover:bg-bad/90',
  }[kind];
  return (
    <button type="button" className={`${base} ${styles} ${className}`} onClick={onClick} disabled={disabled} title={title} aria-pressed={active}>
      {children}
    </button>
  );
}

export function Toggle({ checked, onChange, label, title }: { checked: boolean; onChange: (b: boolean) => void; label: ReactNode; title?: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-1 text-[13px] text-ink-2" title={title}>
      <input type="checkbox" className="h-3.5 w-3.5" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

const inputCls = 'rounded-[4px] border border-rule-2 bg-paper px-2 py-1 tnum text-[13px] text-ink transition-colors focus:border-ink focus:outline-none';

/** Numeric input that commits on Enter/blur. */
export function NumberField({ value, onCommit, step = 1, min, max, suffix, width = 'w-20', label }: {
  value: number; onCommit: (v: number) => void; step?: number; min?: number; max?: number; suffix?: string; width?: string; label?: string;
}) {
  const [txt, setTxt] = useState(value.toString());
  useEffect(() => setTxt(Number.isFinite(value) ? (+value.toFixed(6)).toString() : ''), [value]);
  const commit = () => {
    const v = parseFloat(txt);
    if (Number.isFinite(v)) onCommit(Math.max(min ?? -Infinity, Math.min(max ?? Infinity, v)));
    else setTxt(value.toString());
  };
  return (
    <span className="inline-flex items-center gap-1">
      <input aria-label={label} inputMode="decimal" className={`${width} ${inputCls}`} value={txt} step={step}
        onChange={(e) => setTxt(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); }} />
      {suffix && <span className="text-[12px] text-ink-3">{suffix}</span>}
    </span>
  );
}

/** Angle slider in degrees bound to a radian value, with a ruler scale (−180 … 0 … +180). */
export function AngleSlider({ value, onChange, onStart, min = -180, max = 180, step = 0.5, label = '접힘각 ρ' }: {
  value: number; onChange: (rad: number) => void; onStart?: () => void; min?: number; max?: number; step?: number; label?: string;
}) {
  const ticks = [-180, -135, -90, -45, 0, 45, 90, 135, 180].filter((t) => t >= min && t <= max);
  return (
    <div>
      <input type="range" aria-label={label} className="w-full" min={min} max={max} step={step} value={toDeg(value)}
        onPointerDown={onStart} onKeyDown={onStart} onChange={(e) => onChange(toRad(parseFloat(e.target.value)))} />
      <div className="relative mx-[7px] h-4" aria-hidden>
        {ticks.map((t) => {
          const x = ((t - min) / (max - min)) * 100;
          const major = t % 90 === 0;
          return (
            <span key={t} className="absolute top-0 -translate-x-1/2" style={{ left: `${x}%` }}>
              <span className={`mx-auto block w-px ${major ? 'h-2 bg-ink-3' : 'h-1 bg-rule-2'}`} />
              {major && <span className="tnum block text-[10px] leading-3 text-ink-3">{t > 0 ? `+${t}` : t}</span>}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Drawing-set tabs: the active tab is the sheet on top. */
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div role="tablist" className="no-scrollbar flex min-w-0 gap-0.5 overflow-x-auto">
      {tabs.map((t) => (
        <button key={t.id} role="tab" type="button" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={`-mb-px shrink-0 whitespace-nowrap rounded-t-[4px] border border-b-0 px-3 py-1.5 text-[13px] font-medium transition-colors ${value === t.id ? 'border-rule-2 bg-paper text-ink shadow-[inset_0_2px_0_var(--color-ink)]' : 'border-transparent text-ink-3 hover:text-ink'}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export const fmt = (x: number | undefined | null, d = 3) =>
  x === undefined || x === null || !Number.isFinite(x) ? '—' : Math.abs(x) >= 1e4 || (Math.abs(x) < 1e-3 && x !== 0) ? x.toExponential(2) : x.toFixed(d);

export const FOLD_SPEEDS = [0.1, 0.25, 0.5, 1, 2] as const;

/** Playback speed of every fold motion (shared, remembered). 0.1× shows the folding path slowly. */
export function SpeedControl({ className = '' }: { className?: string }) {
  const v = useUI((s) => s.foldSpeed);
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <span className="lettering shrink-0 text-[10.5px] text-ink-3">속도</span>
      <div role="radiogroup" aria-label="접기 속도" className="flex rounded-[3px] border border-rule-2 bg-paper-2 p-0.5">
        {FOLD_SPEEDS.map((s) => (
          <button key={s} type="button" role="radio" aria-checked={v === s} title={s < 1 ? `${Math.round(1 / s)}배 느리게` : s > 1 ? '2배 빠르게' : '보통 속도'}
            onClick={() => useUI.getState().setFoldSpeed(s)}
            className={`tnum h-6 whitespace-nowrap rounded-[2px] px-1.5 text-[11.5px] transition-colors ${v === s ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-paper hover:text-ink'}`}>
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}
