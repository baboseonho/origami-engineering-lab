import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Layers, Scan } from 'lucide-react';
import { useUI, type OverlayKey, type ViewMode } from '../../state/uiStore';
import { tr } from '../../i18n';

const overlayItems = (): { k: OverlayKey; label: string }[] => [
  { k: 'foldLabels', label: tr('접힘각 라벨', 'Fold angle labels') },
  { k: 'sectorLabels', label: tr('섹터각 라벨 (전개도)', 'Sector angle labels (crease pattern)') },
  { k: 'vertices', label: tr('꼭짓점 표시·선택', 'Show and pick vertices') },
  { k: 'vertexIds', label: tr('꼭짓점 번호', 'Vertex numbers') },
  { k: 'edgeIds', label: tr('모서리 번호', 'Edge numbers') },
  { k: 'normals', label: tr('면 법선', 'Facet normals') },
  { k: 'axes', label: tr('크리스 축 · 구동 고리', 'Crease axes · drive rings') },
  { k: 'collisions', label: tr('충돌 표시', 'Show collisions') },
  { k: 'strain', label: tr('축 변형률 (Energy)', 'Axial strain (Energy)') },
  { k: 'symmetry', label: tr('대칭축 (전개도)', 'Symmetry axes (crease pattern)') },
];

const views = () => [['top', tr('위 (xy)', 'Top (xy)')], ['front', tr('정면 (xz)', 'Front (xz)')], ['side', tr('측면 (yz)', 'Side (yz)')], ['iso', tr('등각', 'Isometric')]] as const;

/**
 * Phone only: the two views a visitor switches between, 3D and the crease
 * pattern, as one 44px segmented control (the projection view stays in the
 * "⋯" menu). The 2D sheet has no toolbar of its own, so it shows this too.
 */
export function PhoneViewSwitch({ className = '' }: { className?: string }) {
  const viewMode = useUI((s) => s.viewMode);
  // words only: with icons the switch would not fit on the toolbar's one row
  const opts: [ViewMode, ReactNode][] = [['3d', '3D'], ['2d', tr('전개도', 'Pattern')]];
  return (
    <div role="radiogroup" aria-label={tr('보기', 'View')} className={`pointer-events-auto flex h-12 items-center gap-0.5 rounded-[4px] border border-ink/40 bg-paper/95 p-0.5 shadow-sm md:hidden ${className}`}>
      {opts.map(([id, label]) => (
        <button key={id} type="button" role="radio" aria-checked={viewMode === id} onClick={() => useUI.getState().setViewMode(id)}
          className={`flex h-11 min-w-11 items-center justify-center gap-1 whitespace-nowrap rounded-[3px] px-2.5 text-[13px] transition-colors ${viewMode === id ? 'bg-paper font-semibold text-ink shadow-[inset_0_0_0_1.5px_var(--color-ink)]' : 'font-medium text-ink-2 hover:bg-paper-2 hover:text-ink'}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** `notes`: status lines for the view (experiment frame, constructed state), set below the toolbar rows so they never cover it. */
export function ViewToolbar({ notes }: { notes?: ReactNode } = {}) {
  const camera = useUI((s) => s.camera);
  const overlays = useUI((s) => s.overlays);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', onKey); };
  }, [open]);
  // a finger needs 44px on a phone; the desktop keeps the compact 28px row
  const btn = 'h-7 whitespace-nowrap rounded-[3px] px-2 text-[13px] text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink max-md:h-11 max-md:min-w-11 max-md:px-2.5';
  return (
    <div ref={ref} className="pointer-events-none absolute left-[15px] right-[15px] top-[15px] z-10 flex flex-wrap items-start gap-1.5 [&>*]:pointer-events-auto">
      <div className="flex h-8 items-center gap-0.5 rounded-[4px] border border-ink/40 bg-paper/95 px-0.5 shadow-sm max-md:h-12" role="group" aria-label={tr('시점', 'View')}>
        <button type="button" className={btn} onClick={() => useUI.getState().requestView('fit')} title={tr('모델이 화면에 꽉 차게 (더블클릭: 지금 방향 그대로 맞춤)', 'Fit the model to the view (double-click: fit keeping the direction)')}><Scan size={14} className="mr-1 inline align-[-2px]" aria-hidden />{tr('맞춤', 'Fit')}</button>
        <span className="h-4 w-px bg-rule-2" />
        <select aria-label={tr('시점 선택', 'Choose view')} value="" onChange={(e) => { if (e.target.value) useUI.getState().requestView(e.target.value as ReturnType<typeof views>[number][0]); }}
          className="h-7 cursor-pointer rounded-[3px] bg-transparent px-1 text-[13px] text-ink-2 hover:bg-paper-2 hover:text-ink max-md:h-11 max-md:px-2">
          <option value="">{tr('시점…', 'View…')}</option>
          {views().map(([p, l]) => <option key={p} value={p}>{l}</option>)}
        </select>
        {/* a phone keeps one row: this switch moves into "표시 항목" there, making room for 3D | 전개도 */}
        <span className="h-4 w-px bg-rule-2 max-md:hidden" />
        <button type="button" className={`${btn} max-md:hidden`} aria-pressed={camera === 'orthographic'} onClick={() => useUI.getState().setCamera(camera === 'perspective' ? 'orthographic' : 'perspective')}
          title={tr('원근 / 정사영 투영 전환', 'Switch perspective / orthographic projection')}>{camera === 'perspective' ? tr('원근', 'Perspective') : tr('정사영', 'Orthographic')}</button>
      </div>
      <div className="relative">
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} aria-label={tr('표시 항목', 'Overlays')}
          className="flex h-8 items-center gap-1.5 whitespace-nowrap rounded-[4px] border border-ink/40 bg-paper/95 px-2.5 text-[13px] text-ink-2 shadow-sm hover:text-ink max-md:h-12">
          <Layers size={14} aria-hidden /><span className="max-md:hidden">{tr('표시 항목', 'Overlays')}</span><span className="md:hidden">{tr('표시', 'Show')}</span>
        </button>
        {open && (
          <div className="sheet absolute left-0 mt-1 w-56 rounded-[3px] border border-rule-2 p-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-[3px] border-b border-rule px-1.5 py-1 text-[13px] text-ink hover:bg-paper-2 max-md:min-h-11 md:hidden">
              <input type="checkbox" checked={camera === 'orthographic'} onChange={() => useUI.getState().setCamera(camera === 'perspective' ? 'orthographic' : 'perspective')} />
              {tr('정사영으로 보기 (끄면 원근)', 'Orthographic (off: perspective)')}
            </label>
            {overlayItems().map((o) => (
              <label key={o.k} className="flex cursor-pointer items-center gap-2 rounded-[3px] px-1.5 py-1 text-[13px] text-ink hover:bg-paper-2 max-md:min-h-11">
                <input type="checkbox" checked={overlays[o.k]} onChange={() => useUI.getState().toggleOverlay(o.k)} />
                {o.label}
              </label>
            ))}
          </div>
        )}
      </div>
      <PhoneViewSwitch />
      {notes && <div style={{ pointerEvents: 'none' }} className="flex basis-full flex-col items-end gap-1 [&>*]:max-w-[min(100%,360px)]">{notes}</div>}
    </div>
  );
}
