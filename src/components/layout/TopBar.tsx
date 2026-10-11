import { useEffect, type ReactNode } from 'react';
import { Box, Columns2, Menu, PanelBottomOpen, Pause, Play, Redo2, RotateCcw, Settings, Undo2, Waypoints } from 'lucide-react';
import { LESSONS, lessonById } from '../../curriculum/lessons';
import { useModel } from '../../state/modelStore';
import { useSim } from '../../state/simulationStore';
import { useUI, type AppMode, type ViewMode } from '../../state/uiStore';
import { loadLesson, redo, resetSimulation, setSolverMode, togglePlay, undo } from '../../state/actions';

/** One cell of the title block: small lettering caption over its content. */
function Cell({ caption, children, className = '' }: { caption: string; children: ReactNode; className?: string }) {
  return (
    <div className={`flex shrink-0 flex-col justify-center gap-0.5 border-l border-rule px-2.5 min-[1500px]:px-3 ${className}`}>
      <span className="lettering text-[11px] leading-none text-ink-3">{caption}</span>
      {children}
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange, disabled, label }: {
  value: T; options: { id: T; label: ReactNode; title?: string }[]; onChange: (v: T) => void; disabled?: boolean; label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-[4px] border border-rule-2 bg-paper-2 p-0.5">
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} disabled={disabled} title={o.title}
          onClick={() => onChange(o.id)}
          className={`flex h-7 items-center gap-1.5 whitespace-nowrap rounded-[3px] px-2.5 text-[13px] font-medium transition-colors duration-150 disabled:opacity-40 ${value === o.id ? 'bg-ink text-paper shadow-sm' : 'text-ink-2 hover:bg-paper hover:text-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function IconAction({ icon, label, onClick, disabled, active }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={label} aria-label={label}
      className={`flex h-9 min-w-9 flex-col items-center justify-center gap-0.5 rounded-[4px] px-2 text-[10.5px] leading-none transition-colors disabled:opacity-35 ${active ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-paper-2 hover:text-ink'}`}>
      {icon}
      <span className="hidden whitespace-nowrap min-[1500px]:inline">{label}</span>
    </button>
  );
}

export function TopBar() {
  const lecture = useUI((s) => s.lecture);
  const appMode = useUI((s) => s.appMode);
  const viewMode = useUI((s) => s.viewMode);
  const solverMode = useSim((s) => s.solverMode);
  const playing = useSim((s) => s.playing);
  const past = useModel((s) => s.past.length);
  const future = useModel((s) => s.future.length);
  const model = useModel((s) => s.model);
  const lessonId = useModel((s) => s.lessonId);
  const lesson = lessonById(lessonId);
  const lectureLessons = LESSONS.filter((l) => l.lecture === lecture);
  const sheetNo = lesson ? lectureLessons.findIndex((l) => l.id === lesson.id) + 1 : 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
      if (e.key === ' ' && useSim.getState().solverMode === 'energy') { e.preventDefault(); togglePlay(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="sheet flex min-h-[58px] flex-wrap items-stretch rounded-[3px] pr-2 md:flex-nowrap">
      <button type="button" onClick={() => useUI.getState().setDrawer('index')} aria-label="도면 목록 열기"
        className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-[4px] border border-rule-2 text-ink-2 hover:border-ink hover:text-ink xl:hidden">
        <Menu size={17} />
      </button>
      {/* identity cell: opens the drawing index (cover sheet) */}
      <button type="button" onClick={() => useUI.getState().setCoverOpen(true)} title="도면 목록 (표지)" aria-label="도면 목록 (표지) 열기"
        className="group flex shrink-0 items-center gap-2.5 px-3 text-left">
        <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden className="transition-transform duration-300 group-hover:-rotate-6">
          <rect x="1.5" y="1.5" width="27" height="27" fill="none" stroke="var(--color-ink)" strokeWidth="1.5" />
          <path d="M1.5 28.5 L28.5 1.5" stroke="var(--color-valley)" strokeWidth="1.4" strokeDasharray="3 2" />
          <path d="M15 1.5 L15 28.5" stroke="var(--color-mountain)" strokeWidth="1.4" strokeDasharray="4 1.6 1 1.6" />
          <path d="M28.5 28.5 L19 28.5 L28.5 19 Z" fill="var(--color-paper-3)" stroke="var(--color-ink)" strokeWidth="1" />
        </svg>
        <div className="hidden leading-tight xl:block">
          <div className="whitespace-nowrap text-[15px] font-semibold tracking-tight text-ink">Origami Engineering Lab</div>
          <div className="lettering text-[11px] text-ink-3 group-hover:text-ink">AE53006 · 도면 목록 ▾</div>
        </div>
      </button>

      <Cell caption="강의" className="max-md:flex md:max-xl:hidden">
        <div className="flex gap-0.5">
          {([1, 2, 3, 4, 5] as const).map((l) => (
            <button key={l} type="button" aria-pressed={lecture === l} onClick={() => loadLesson(LESSONS.find((x) => x.lecture === l)!.id)}
              className={`h-7 w-8 rounded-[3px] text-[13px] font-semibold tnum transition-colors ${lecture === l ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-paper-2'}`}>
              L{l}
            </button>
          ))}
        </div>
      </Cell>

      <Cell caption={`도면 ${sheetNo}/${lectureLessons.length}`} className="min-w-0 max-w-[260px] shrink">
        <div className="truncate text-[13.5px] font-semibold text-ink" title={lesson?.title}>{lesson?.title ?? '가져온 모델'}</div>
      </Cell>

      <Cell caption="학습 방식">
        <Segmented<AppMode> label="학습 방식" value={appMode} onChange={(m) => useUI.getState().setAppMode(m)} options={[
          { id: 'learn', label: '학습', title: 'Learn: 개념 설명 표시' },
          { id: 'explore', label: '탐구', title: 'Explore: 설명 숨김, 매개변수 중심' },
          { id: 'challenge', label: '도전', title: 'Challenge: 과제 중심' },
        ]} />
      </Cell>

      <Cell caption="솔버">
        <Segmented<'rigid' | 'energy'> label="솔버" value={solverMode} disabled={!model} onChange={setSolverMode} options={[
          { id: 'rigid', label: 'Rigid', title: '강체 기구학: 면은 변형되지 않고, 불가능한 요청은 거부한다' },
          { id: 'energy', label: 'Energy', title: '에너지법: 면의 굽힘·신장을 허용하고 에너지를 최소화한다' },
        ]} />
      </Cell>

      <Cell caption="보기">
        <Segmented<ViewMode> label="보기" value={viewMode} disabled={!model} onChange={(m) => useUI.getState().setViewMode(m)} options={[
          { id: '3d', label: <><Box size={14} />3D</>, title: '3D 모델' },
          { id: '2d', label: <><Waypoints size={14} /><span className="hidden min-[1400px]:inline">전개도</span></>, title: '2D 전개도 (crease pattern)' },
          { id: 'split', label: <><Columns2 size={14} /><span className="hidden min-[1400px]:inline">분할</span></>, title: '전개도와 3D를 나란히' },
        ]} />
      </Cell>

      <div className="ml-auto flex items-center gap-0.5 border-l border-rule pl-2">
        <span className="md:hidden"><IconAction icon={<PanelBottomOpen size={16} />} label="검사" onClick={() => useUI.getState().setDrawer('inspector')} /></span>
        <IconAction icon={<Undo2 size={16} />} label="실행취소" onClick={undo} disabled={!past} />
        <IconAction icon={<Redo2 size={16} />} label="다시실행" onClick={redo} disabled={!future} />
        <IconAction icon={<RotateCcw size={16} />} label="초기화" onClick={resetSimulation} disabled={!model} />
        <IconAction icon={playing ? <Pause size={16} /> : <Play size={16} />} label={playing ? '정지' : '재생'} onClick={togglePlay} disabled={solverMode !== 'energy'} active={playing} />
        <IconAction icon={<Settings size={16} />} label="설정" onClick={() => useUI.getState().setSettingsOpen(true)} />
      </div>
    </header>
  );
}
