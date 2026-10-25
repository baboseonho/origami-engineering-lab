import { Fragment, lazy, Suspense, useEffect, useRef, useState, type ComponentType } from 'react';
import { lessonById, PAGE_LABS, type LabId } from '../curriculum/lessons';
import { tr } from '../i18n';
import { PageAside } from '../components/pages/PageAside';
import { ExplainerButton } from '../components/explainers/ExplainerButton';
import { useModel } from '../state/modelStore';
import { useUI } from '../state/uiStore';
import { loadLesson } from '../state/actions';
import { TopBar } from '../components/layout/TopBar';
import { Sidebar } from '../components/layout/Sidebar';
import { SettingsModal } from '../components/layout/SettingsModal';
import { Drawer } from '../components/layout/Drawer';
import { SheetLoading } from '../components/layout/SheetLoading';
import { CoverSheet } from '../components/layout/CoverSheet';
import { Toast } from '../components/layout/Toast';
import { SheetBoundary } from '../components/layout/SheetBoundary';
import { Inspector } from '../components/inspector/Inspector';
import { BottomPanel } from '../components/analysis/BottomPanel';
import { CreasePattern2D } from '../components/viewport/CreasePattern2D';
import { DrawingFrame } from '../components/viewport/DrawingFrame';
import { DEFAULT_LESSON } from './routes';

// Heavy sheets load on demand: Three.js (3D view), KaTeX (theory) and the labs.
const named = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));
const Viewport3D = named(() => import('../components/viewport/Viewport3D'), 'Viewport3D');
const TheoryPanel = named(() => import('../components/theory/TheoryPanel'), 'TheoryPanel');
const ProjectionView = named(() => import('../components/viewport/ProjectionView'), 'ProjectionView');
const LABS: Record<LabId, ReturnType<typeof named>> = {
  conceptLab: named(() => import('../components/labs/ModelLabs'), 'ConceptLab'),
  stepwise: named(() => import('../components/labs/ModelLabs'), 'StepwiseLab'),
  kreslingVsYoshimura: named(() => import('../components/labs/ModelLabs'), 'KreslingVsYoshimuraLab'),
  strip1D: named(() => import('../components/labs/Strip1DLab'), 'Strip1DLab'),
  kawasaki: named(() => import('../components/labs/VertexLabs'), 'KawasakiLab'),
  maekawa: named(() => import('../components/labs/VertexLabs'), 'MaekawaLab'),
  mvCrimp: named(() => import('../components/labs/VertexLabs'), 'MVCrimpLab'),
  generalized: named(() => import('../components/labs/VertexLabs'), 'GeneralizedLab'),
  gkawasaki: named(() => import('../components/labs/GKawasakiLab'), 'GKawasakiLab'),
  welcome: named(() => import('../components/pages/Welcome'), 'WelcomePage'),
  atlas: named(() => import('../components/pages/Atlas'), 'AtlasPage'),
  glossary: named(() => import('../components/pages/Glossary'), 'GlossaryPage'),
  firstFolds: named(() => import('../components/pages/FirstFolds'), 'FirstFoldsPage'),
  beyond: named(() => import('../components/pages/Beyond'), 'BeyondPage'),
  tools: named(() => import('../components/pages/Tools'), 'ToolsPage'),
  hobby: named(() => import('../components/pages/Hobby'), 'HobbyPage'),
};

const FOLDED_STRIP = 41;
/** Labs that embed the 3D sheet (already framed) fill the whole sheet. */
const FULL_BLEED: LabId[] = ['conceptLab', 'stepwise'];

function View3D() {
  const lessonId = useModel((s) => s.lessonId);
  return <SheetBoundary label={tr('3D 모델', '3D model')} resetKey={lessonId}><Suspense fallback={<SheetLoading label={tr('3D 모델을 펼치는 중', 'Unfolding the 3D model')} />}><Viewport3D /></Suspense></SheetBoundary>;
}

function ModelWorkspace() {
  const viewMode = useUI((s) => s.viewMode);
  const bottomHeight = useUI((s) => s.bottomHeight);
  const folded = useUI((s) => s.bottomFolded);
  const dragging = useRef(false);
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="sheet min-h-0 flex-1 overflow-hidden rounded-[3px]">
        {viewMode === '3d' && <View3D />}
        {viewMode === '2d' && <SheetBoundary label={tr('전개도', 'Crease pattern')}><CreasePattern2D /></SheetBoundary>}
        {viewMode === 'proj' && <SheetBoundary label={tr('투영도', 'Projections')}><Suspense fallback={<SheetLoading label={tr('투영도를 그리는 중', 'Drawing the projections')} />}><ProjectionView /></Suspense></SheetBoundary>}
        {viewMode === 'split' && (
          // side by side on wide sheets, stacked on narrow ones
          <div className="grid h-full grid-rows-2 md:grid-cols-2 md:grid-rows-1">
            <div className="min-h-0 min-w-0 border-b border-rule-2 md:border-b-0 md:border-r"><SheetBoundary label={tr('전개도', 'Crease pattern')}><CreasePattern2D /></SheetBoundary></div>
            <div className="min-h-0 min-w-0"><View3D /></div>
          </div>
        )}
      </div>
      <div style={{ height: folded ? FOLDED_STRIP : `min(${bottomHeight}px, 55dvh)` }} className="relative shrink-0 transition-[height] duration-200 ease-out">
        {!folded && (
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label={tr('분석 패널 높이 조절', 'Resize the analysis panel')}
            className="absolute -top-2 left-0 right-0 z-10 h-2 cursor-row-resize"
            onPointerDown={(e) => { dragging.current = true; (e.target as Element).setPointerCapture(e.pointerId); }}
            onPointerMove={(e) => {
              if (!dragging.current) return;
              const h = Math.max(160, Math.min(window.innerHeight - 260, window.innerHeight - e.clientY - 8));
              useUI.getState().setBottomHeight(h);
            }}
            onPointerUp={() => (dragging.current = false)}
          />
        )}
        <SheetBoundary label={tr('분석 패널', 'Analysis panel')}><BottomPanel /></SheetBoundary>
      </div>
    </div>
  );
}

function SideSheet({ isLab }: { isLab: boolean }) {
  const lessonId = useModel((s) => s.lessonId);
  const lab = lessonById(lessonId)?.lab;
  if (lab && PAGE_LABS.includes(lab)) return <SheetBoundary label={tr('다음 도면', 'Next sheets')} resetKey={lessonId}><PageAside /></SheetBoundary>;
  return (
    <SheetBoundary label={isLab ? tr('이론', 'Theory') : tr('검사 패널', 'Inspector')} resetKey={lessonId}>
      {isLab ? (
        <div className="theory-aside h-full overflow-y-auto p-4">
          <Suspense fallback={<SheetLoading label={tr('이론을 불러오는 중', 'Loading the theory')} />}><TheoryPanel /></Suspense>
        </div>
      ) : <Inspector />}
    </SheetBoundary>
  );
}

/**
 * The right-hand sheet. Below xl the lesson column is not on screen, so the
 * sheet carries two tabs: the lesson (text, presets, tasks) and the inspector.
 */
function AsideSheet({ isLab }: { isLab: boolean }) {
  const [tab, setTab] = useState<'lesson' | 'side'>('side');
  const page = PAGE_LABS.includes(lessonById(useModel.getState().lessonId)?.lab as LabId);
  const tabs = [['lesson', tr('레슨', 'Lesson')], ['side', page ? tr('다음', 'Next') : isLab ? tr('이론', 'Theory') : tr('검사', 'Inspect')]] as const;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div role="tablist" aria-label={tr('오른쪽 패널', 'Right panel')} className="flex shrink-0 gap-1 border-b border-rule-2 bg-paper-2 p-1.5 xl:hidden">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`h-8 flex-1 rounded-[3px] text-[14px] font-medium transition-colors ${tab === id ? 'bg-paper text-ink font-semibold shadow-[inset_0_0_0_1.5px_var(--color-ink)]' : 'text-ink-2 hover:bg-paper hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'lesson' && <div className="min-h-0 flex-1 xl:hidden"><Sidebar /></div>}
      <div className={`min-h-0 flex-1 ${tab === 'lesson' ? 'max-xl:hidden' : ''}`}><SideSheet isLab={isLab} /></div>
    </div>
  );
}

export default function App() {
  const coverOpen = useUI((s) => s.coverOpen);
  // a language switch remounts the whole board so every text is read again
  const lang = useUI((s) => s.lang);
  const lessonId = useModel((s) => s.lessonId);
  const drawer = useUI((s) => s.drawer);
  useEffect(() => {
    const fromHash = window.location.hash.replace('#', '');
    loadLesson(lessonById(fromHash) ? fromHash : DEFAULT_LESSON);
    // a first visit (no sheet in the address) opens on the cover: the drawing index
    if (!fromHash) useUI.getState().setCoverOpen(true);
    // a lesson link edited or pasted while the app is open (#l4-miura …) opens that sheet
    const onHash = () => {
      const id = window.location.hash.replace('#', '');
      if (lessonById(id) && id !== useModel.getState().lessonId) loadLesson(id);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    if (lessonId && lessonId !== 'imported') history.replaceState(null, '', `#${lessonId}`);
    useUI.getState().setDrawer(null);
  }, [lessonId]);
  const lesson = lessonById(lessonId);
  const Lab = lesson?.kind === 'lab' && lesson.lab ? LABS[lesson.lab] : null;
  const closeDrawer = () => useUI.getState().setDrawer(null);
  return (
    <Fragment key={lang}>
    <div className="grid h-[100dvh] grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr] gap-2 overflow-hidden bg-board p-2" inert={coverOpen}>
      <TopBar />
      <div className="grid min-h-0 grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[256px_minmax(0,1fr)_318px] min-[1500px]:grid-cols-[300px_minmax(0,1fr)_350px]">
        <div className="hidden min-h-0 xl:block"><Sidebar /></div>
        <main className="vt-main min-h-0 min-w-0">
          {Lab ? (
            <div className="sheet h-full min-h-0 overflow-hidden rounded-[3px]">
              {FULL_BLEED.includes(lesson!.lab!) ? (
                <SheetBoundary label={tr('실습', 'Lab')} resetKey={lessonId}><Suspense fallback={<SheetLoading label={tr('도면을 펼치는 중', 'Unfolding the sheet')} />}><Lab key={lessonId} /></Suspense></SheetBoundary>
              ) : (
                <DrawingFrame title={lesson!.title}>
                  <div className="absolute inset-[8px] overflow-y-auto px-3 pb-16 pt-3">
                    <ExplainerButton lessonId={lessonId} variant="bar" />
                    <SheetBoundary label={tr('실습', 'Lab')} resetKey={lessonId}><Suspense fallback={<SheetLoading label={tr('도면을 펼치는 중', 'Unfolding the sheet')} />}><Lab key={lessonId} /></Suspense></SheetBoundary>
                  </div>
                </DrawingFrame>
              )}
            </div>
          ) : <ModelWorkspace />}
        </main>
        <aside className="sheet hidden min-h-0 overflow-hidden rounded-[3px] md:block">
          <AsideSheet isLab={!!Lab} />
        </aside>
      </div>
      <Drawer side="left" open={drawer === 'index'} onClose={closeDrawer} label={tr('도면 목록', 'Sheet index')}>
        <Sidebar />
      </Drawer>
      <Drawer side="bottom" open={drawer === 'inspector'} onClose={closeDrawer} label={Lab ? tr('이론', 'Theory') : tr('검사', 'Inspect')}>
        <SideSheet isLab={!!Lab} />
      </Drawer>
      <SettingsModal />
    </div>
    <CoverSheet />
    <Toast />
    </Fragment>
  );
}
