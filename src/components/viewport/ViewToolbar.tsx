import { useEffect, useRef, useState } from 'react';
import { Layers, Scan } from 'lucide-react';
import { useUI, type OverlayKey } from '../../state/uiStore';

const OVERLAYS: { k: OverlayKey; label: string }[] = [
  { k: 'foldLabels', label: '접힘각 라벨' },
  { k: 'sectorLabels', label: '섹터각 라벨 (전개도)' },
  { k: 'vertices', label: '꼭짓점 표시·선택' },
  { k: 'vertexIds', label: '꼭짓점 번호' },
  { k: 'edgeIds', label: '모서리 번호' },
  { k: 'normals', label: '면 법선' },
  { k: 'axes', label: '크리스 축 · 구동 고리' },
  { k: 'collisions', label: '충돌 표시' },
  { k: 'strain', label: '축 변형률 (Energy)' },
  { k: 'symmetry', label: '대칭축 (전개도)' },
];

const VIEWS = [['top', '위'], ['front', '정면'], ['side', '측면'], ['iso', '등각']] as const;

export function ViewToolbar() {
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
  const btn = 'h-7 whitespace-nowrap rounded-[3px] px-2 text-[13px] text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink';
  return (
    <div ref={ref} className="pointer-events-none absolute left-[15px] right-[15px] top-[15px] z-10 flex flex-wrap items-start gap-1.5 [&>*]:pointer-events-auto">
      <div className="flex h-8 items-center gap-0.5 rounded-[4px] border border-ink/40 bg-paper/95 px-0.5 shadow-sm" role="group" aria-label="시점">
        <button type="button" className={btn} onClick={() => useUI.getState().requestView('fit')} title="모델이 화면에 꽉 차게"><Scan size={14} className="mr-1 inline align-[-2px]" aria-hidden />맞춤</button>
        <span className="h-4 w-px bg-rule-2" />
        <select aria-label="시점 선택" value="" onChange={(e) => { if (e.target.value) useUI.getState().requestView(e.target.value as (typeof VIEWS)[number][0]); }}
          className="h-7 cursor-pointer rounded-[3px] bg-transparent px-1 text-[13px] text-ink-2 hover:bg-paper-2 hover:text-ink">
          <option value="">시점…</option>
          {VIEWS.map(([p, l]) => <option key={p} value={p}>{l}</option>)}
        </select>
        <span className="h-4 w-px bg-rule-2" />
        <button type="button" className={btn} aria-pressed={camera === 'orthographic'} onClick={() => useUI.getState().setCamera(camera === 'perspective' ? 'orthographic' : 'perspective')}
          title="원근 / 정사영 투영 전환">{camera === 'perspective' ? '원근' : '정사영'}</button>
      </div>
      <div className="relative">
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}
          className="flex h-8 items-center gap-1.5 whitespace-nowrap rounded-[4px] border border-ink/40 bg-paper/95 px-2.5 text-[13px] text-ink-2 shadow-sm hover:text-ink">
          <Layers size={14} />표시 항목
        </button>
        {open && (
          <div className="sheet absolute left-0 mt-1 w-56 rounded-[3px] border border-rule-2 p-2">
            {OVERLAYS.map((o) => (
              <label key={o.k} className="flex cursor-pointer items-center gap-2 rounded-[3px] px-1.5 py-1 text-[13px] text-ink hover:bg-paper-2">
                <input type="checkbox" checked={overlays[o.k]} onChange={() => useUI.getState().toggleOverlay(o.k)} />
                {o.label}
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
