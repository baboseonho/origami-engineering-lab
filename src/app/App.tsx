import { lazy, Suspense, useEffect, useRef, type ComponentType } from 'react';
import { lessonById, type LabId } from '../curriculum/lessons';
import { useModel } from '../state/modelStore';
import { useUI } from '../state/uiStore';
import { loadLesson } from '../state/actions';
import { TopBar } from '../components/layout/TopBar';
import { Sidebar } from '../components/layout/Sidebar';
import { SettingsModal } from '../components/layout/SettingsModal';
import { Drawer } from '../components/layout/Drawer';
import { SheetLoading } from '../components/layout/SheetLoading';
import { CoverSheet } from '../components/layout/CoverSheet';
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
};

const FOLDED_STRIP = 41;
/** Labs that embed the 3D sheet (already framed) fill the whole sheet. */
const FULL_BLEED: LabId[] = ['conceptLab', 'stepwise'];

function View3D() {
  const lessonId = useModel((s) => s.lessonId);
  return <SheetBoundary label="3D 모델" resetKey={lessonId}><Suspense fallback={<SheetLoading label="3D 모델을 펼치는 중" />}><Viewport3D /></Suspense></SheetBoundary>;
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
        {viewMode === '2d' && <SheetBoundary label="전개도"><CreasePattern2D /></SheetBoundary>}
        {viewMode === 'split' && (
          // side by side on wide sheets, stacked on narrow ones
          <div className="grid h-full grid-rows-2 md:grid-cols-2 md:grid-rows-1">
            <div className="min-h-0 min-w-0 border-b border-rule-2 md:border-b-0 md:border-r"><SheetBoundary label="전개도"><CreasePattern2D /></SheetBoundary></div>
            <div className="min-h-0 min-w-0"><View3D /></div>
          </div>
        )}
      </div>
      <div style={{ height: folded ? FOLDED_STRIP : `min(${bottomHeight}px, 55dvh)` }} className="relative shrink-0 transition-[height] duration-200 ease-out">
        {!folded && (
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="분석 패널 높이 조절"
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
        <SheetBoundary label="분석 패널"><BottomPanel /></SheetBoundary>
      </div>
    </div>
  );
}

function SideSheet({ isLab }: { isLab: boolean }) {
  const lessonId = useModel((s) => s.lessonId);
  return (
    <SheetBoundary label={isLab ? '이론' : '검사 패널'} resetKey={lessonId}>
      {isLab ? (
        <div className="theory-aside h-full overflow-y-auto p-4">
          <Suspense fallback={<SheetLoading label="이론을 불러오는 중" />}><TheoryPanel /></Suspense>
        </div>
      ) : <Inspector />}
    </SheetBoundary>
  );
}

export default function App() {
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
    <div className="grid h-[100dvh] grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr] gap-2 overflow-hidden bg-board p-2">
      <TopBar />
      <div className="grid min-h-0 grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[256px_minmax(0,1fr)_318px] min-[1500px]:grid-cols-[300px_minmax(0,1fr)_350px]">
        <div className="hidden min-h-0 xl:block"><Sidebar /></div>
        <main className="vt-main min-h-0 min-w-0">
          {Lab ? (
            <div className="sheet h-full min-h-0 overflow-hidden rounded-[3px]">
              {FULL_BLEED.includes(lesson!.lab!) ? (
                <SheetBoundary label="실습" resetKey={lessonId}><Suspense fallback={<SheetLoading label="실습 도구를 펼치는 중" />}><Lab key={lessonId} /></Suspense></SheetBoundary>
              ) : (
                <DrawingFrame title={lesson!.title}>
                  <div className="absolute inset-[8px] overflow-y-auto px-3 pb-12 pt-3">
                    <SheetBoundary label="실습" resetKey={lessonId}><Suspense fallback={<SheetLoading label="실습 도구를 펼치는 중" />}><Lab key={lessonId} /></Suspense></SheetBoundary>
                  </div>
                </DrawingFrame>
              )}
            </div>
          ) : <ModelWorkspace />}
        </main>
        <aside className="sheet hidden min-h-0 overflow-hidden rounded-[3px] md:block">
          <SideSheet isLab={!!Lab} />
        </aside>
      </div>
      <Drawer side="left" open={drawer === 'index'} onClose={closeDrawer} label="도면 목록">
        <Sidebar />
      </Drawer>
      <Drawer side="bottom" open={drawer === 'inspector'} onClose={closeDrawer} label={Lab ? '이론' : '검사'}>
        <SideSheet isLab={!!Lab} />
      </Drawer>
      <SettingsModal />
      <CoverSheet />
    </div>
  );
}
