import { ChevronsDown, ChevronsUp } from 'lucide-react';
import { useUI, type BottomTab } from '../../state/uiStore';
import { Tabs } from '../controls/ui';
import { lazy, Suspense } from 'react';
import { SheetLoading } from '../layout/SheetLoading';
const TheoryPanel = lazy(() => import('../theory/TheoryPanel').then((m) => ({ default: m.TheoryPanel })));
import { GeometryTab } from './GeometryTab';
import { AnglesTab, ConstraintsTab, DofTab, EnergyTab, StrainTab } from './tabs';

const TABS: { id: BottomTab; label: string }[] = [
  { id: 'angles', label: '접힘각' },
  { id: 'constraints', label: '구속조건' },
  { id: 'dof', label: '자유도 DoF' },
  { id: 'energy', label: '에너지' },
  { id: 'strain', label: '변형률' },
  { id: 'geometry', label: '형상' },
  { id: 'theory', label: '이론' },
];

/** Analysis sheet: folds down to its tab strip (signature fold). */
export function BottomPanel() {
  const tab = useUI((s) => s.bottomTab);
  const folded = useUI((s) => s.bottomFolded);
  return (
    <div className="sheet flex h-full flex-col overflow-hidden rounded-[3px]">
      <div className="flex shrink-0 items-end justify-between gap-2 border-b border-rule-2 bg-paper-2 px-2 pt-1.5">
        <Tabs tabs={TABS} value={tab} onChange={(t) => { useUI.getState().setBottomTab(t); useUI.getState().setBottomFolded(false); }} />
        <button type="button" onClick={() => useUI.getState().setBottomFolded(!folded)} aria-expanded={!folded}
          className="mb-1 flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-[3px] px-2 text-[13px] text-ink-3 hover:bg-paper hover:text-ink">
          {folded ? <ChevronsUp size={15} /> : <ChevronsDown size={15} />}
          {folded ? '분석 열기' : '분석 접기'}
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
          {tab === 'theory' && <Suspense fallback={<SheetLoading label="이론을 불러오는 중" />}><TheoryPanel /></Suspense>}
        </div>
      </div>
    </div>
  );
}
