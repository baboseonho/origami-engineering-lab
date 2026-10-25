import { ChevronsDown, ChevronsUp } from 'lucide-react';
import { useUI, type BottomTab } from '../../state/uiStore';
import { Tabs } from '../controls/ui';
import { lazy, Suspense } from 'react';
import { SheetLoading } from '../layout/SheetLoading';
import { tr } from '../../i18n';
const TheoryPanel = lazy(() => import('../theory/TheoryPanel').then((m) => ({ default: m.TheoryPanel })));
import { GeometryTab } from './GeometryTab';
import { AnglesTab, ConstraintsTab, DofTab, EnergyTab, StrainTab } from './tabs';

const tabs = (): { id: BottomTab; label: string }[] => [
  { id: 'angles', label: tr('접힘각', 'Fold angles') },
  { id: 'constraints', label: tr('구속조건', 'Constraints') },
  { id: 'dof', label: tr('자유도 DoF', 'DoF') },
  { id: 'energy', label: tr('에너지', 'Energy') },
  { id: 'strain', label: tr('변형률', 'Strain') },
  { id: 'geometry', label: tr('형상', 'Geometry') },
  { id: 'theory', label: tr('이론', 'Theory') },
];

/** Analysis sheet: folds down to its tab strip (signature fold). */
export function BottomPanel() {
  const tab = useUI((s) => s.bottomTab);
  const folded = useUI((s) => s.bottomFolded);
  return (
    <div className="sheet flex h-full flex-col overflow-hidden rounded-[3px]">
      <div className="flex shrink-0 items-end justify-between gap-2 border-b border-rule-2 bg-paper-2 px-2 pt-1.5">
        <Tabs tabs={tabs()} value={tab} onChange={(t) => { useUI.getState().setBottomTab(t); useUI.getState().setBottomFolded(false); }} />
        <button type="button" onClick={() => useUI.getState().setBottomFolded(!folded)} aria-expanded={!folded}
          className="mb-1 flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-[3px] px-2 text-[13px] text-ink-3 hover:bg-paper hover:text-ink">
          {folded ? <ChevronsUp size={15} /> : <ChevronsDown size={15} />}
          {folded ? tr('분석 열기', 'Open analysis') : tr('분석 접기', 'Fold analysis')}
        </button>
      </div>
      <div className="@container min-h-0 flex-1 overflow-y-auto" inert={folded}>
        <div className="fold-body h-full p-4" data-folded={folded}>
          {tab === 'angles' && <AnglesTab />}
          {tab === 'constraints' && <ConstraintsTab />}
          {tab === 'dof' && <DofTab />}
          {tab === 'energy' && <EnergyTab />}
          {tab === 'strain' && <StrainTab />}
          {tab === 'geometry' && <GeometryTab />}
          {tab === 'theory' && <Suspense fallback={<SheetLoading label={tr('이론을 불러오는 중', 'Loading theory')} />}><TheoryPanel /></Suspense>}
        </div>
      </div>
    </div>
  );
}
