import { useEffect, type ReactNode } from 'react';
import { Box, ChevronLeft, Grid2x2, ChevronRight, Columns2, Languages, Menu, PanelBottomOpen, Pause, Play, Redo2, RotateCcw, Settings, Undo2, Waypoints } from 'lucide-react';
import { LECTURE_TITLES, LESSONS, PARTS, lessonById, sheetNumber } from '../../curriculum/lessons';
import { tr } from '../../i18n';
import { useModel } from '../../state/modelStore';
import { useSim } from '../../state/simulationStore';
import { useUI, type ViewMode } from '../../state/uiStore';
import { loadLesson, redo, resetSimulation, setSolverMode, togglePlay, undo } from '../../state/actions';

/** One cell of the title block: small lettering caption over its content. */
function Cell({ caption, children, className = '' }: { caption: string; children: ReactNode; className?: string }) {
  return (
    <div className={`flex shrink-0 flex-col justify-center gap-0.5 border-rule px-3 md:border-l ${className}`}>
      <span className="lettering text-[12px] leading-none text-ink-3 max-md:hidden">{caption}</span>
      {children}
    </div>
  );
}

const SELECTED = 'bg-paper text-ink font-semibold shadow-[inset_0_0_0_1.5px_var(--color-ink)]';

function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { id: T; label: ReactNode; title?: string }[]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-[4px] border border-rule-2 bg-paper-2 p-0.5">
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} title={o.title}
          onClick={() => onChange(o.id)}
          className={`flex h-7 items-center gap-1.5 whitespace-nowrap rounded-[3px] px-2.5 text-[14px] font-medium transition-colors duration-150 ${value === o.id ? SELECTED : 'text-ink-2 hover:bg-paper hover:text-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function IconAction({ icon, label, onClick, disabled, active }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={label} aria-label={label}
      className={`flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-[4px] px-2 text-[13px] leading-none transition-colors disabled:opacity-35 ${active ? SELECTED : 'text-ink-2 hover:bg-paper-2 hover:text-ink'}`}>
      {icon}
      <span className="hidden whitespace-nowrap 2xl:inline">{label}</span>
    </button>
  );
}

/**
 * The title block across the top. Only what is global lives here: where you
 * are (lecture, sheet, previous/next), how the model is solved and viewed
 * (on model sheets only — lab sheets have their own controls), history.
 */
export function TopBar() {
  const lecture = useUI((s) => s.lecture);
  const lang = useUI((s) => s.lang);
  const viewMode = useUI((s) => s.viewMode);
  const solverMode = useSim((s) => s.solverMode);
  const playing = useSim((s) => s.playing);
  const past = useModel((s) => s.past.length);
  const future = useModel((s) => s.future.length);
  const model = useModel((s) => s.model);
  const lessonId = useModel((s) => s.lessonId);
  const lesson = lessonById(lessonId);
  const idx = LESSONS.findIndex((l) => l.id === lessonId);
  const prev = idx > 0 ? LESSONS[idx - 1] : null;
  const next = idx >= 0 && idx < LESSONS.length - 1 ? LESSONS[idx + 1] : null;

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

  const step = 'flex h-8 w-7 shrink-0 items-center justify-center rounded-[3px] text-ink-2 hover:bg-paper-2 hover:text-ink disabled:opacity-30';
  return (
    <header className="sheet flex min-h-[58px] flex-wrap items-stretch rounded-[3px] pr-2 md:flex-nowrap">
      <button type="button" onClick={() => useUI.getState().setDrawer('index')} aria-label={tr('도면 목록 열기', 'Open the sheet index')}
        className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-[4px] border border-rule-2 text-ink-2 hover:border-ink hover:text-ink xl:hidden">
        <Menu size={17} />
      </button>
      {/* identity cell: opens the drawing index (cover sheet) */}
      <button type="button" onClick={() => useUI.getState().setCoverOpen(true)} title={tr('도면 목록 (표지)', 'Sheet index (cover)')} aria-label={tr('도면 목록 (표지) 열기', 'Open the sheet index (cover)')}
        className="group flex shrink-0 items-center gap-2.5 px-3 text-left max-md:hidden">
        <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden className="transition-transform duration-300 group-hover:-rotate-6">
          <rect x="1.5" y="1.5" width="27" height="27" fill="none" stroke="var(--color-ink)" strokeWidth="1.5" />
          <path d="M1.5 28.5 L28.5 1.5" stroke="var(--color-valley)" strokeWidth="1.4" strokeDasharray="3 2" />
          <path d="M15 1.5 L15 28.5" stroke="var(--color-mountain)" strokeWidth="1.4" strokeDasharray="4 1.6 1 1.6" />
          <path d="M28.5 28.5 L19 28.5 L28.5 19 Z" fill="var(--color-paper-3)" stroke="var(--color-ink)" strokeWidth="1" />
        </svg>
        <div className="hidden leading-tight xl:block">
          <div className="whitespace-nowrap text-[15px] font-semibold tracking-tight text-ink">Origami BaBolaB</div>
          <div className="lettering text-[12px] text-ink-3 group-hover:text-ink">{tr('도면 목록 보기', 'All sheets')}</div>
        </div>
      </button>

      <Cell caption={tr('단원', 'Part')} className="max-xl:hidden">
        <div className="flex gap-0.5">
          {PARTS.map((l) => (
            <button key={l} type="button" aria-pressed={lecture === l} title={`${tr('단원', 'Part')} ${l} · ${LECTURE_TITLES[l]}`} onClick={() => loadLesson(LESSONS.find((x) => x.lecture === l)!.id)}
              className={`h-7 w-7 rounded-[3px] text-[14px] font-semibold tnum transition-colors ${lecture === l ? SELECTED : 'text-ink-2 hover:bg-paper-2'}`}>
              {l}
            </button>
          ))}
        </div>
      </Cell>

      {/* where you are: sheet number + title, with previous / next sheet */}
      <div className="flex min-w-0 shrink items-center gap-0.5 border-rule pl-1.5 pr-2 max-md:flex-1 md:border-l">
        <button type="button" className={step} disabled={!prev} onClick={() => prev && loadLesson(prev.id)} aria-label={prev ? `${tr('이전 도면', 'Previous sheet')}: ${prev.title}` : tr('이전 도면 없음', 'No previous sheet')} title={prev?.title}>
          <ChevronLeft size={17} />
        </button>
        <div className="min-w-0 px-1">
          <div className="lettering truncate text-[12px] leading-none text-ink-3">{tr('도면', 'Sheet')} {lesson ? sheetNumber(lesson.id) : '—'} · {LECTURE_TITLES[lecture]}</div>
          <div className="mt-0.5 max-w-[300px] truncate text-[15px] font-semibold text-ink" title={lesson?.title}>{lesson?.title ?? tr('가져온 모델', 'Imported model')}</div>
        </div>
        <button type="button" className={step} disabled={!next} onClick={() => next && loadLesson(next.id)} aria-label={next ? `${tr('다음 도면', 'Next sheet')}: ${next.title}` : tr('다음 도면 없음', 'No next sheet')} title={next?.title}>
          <ChevronRight size={17} />
        </button>
      </div>

      {/* model sheets only: lab sheets have no solver / view to choose */}
      {model && (
        <div className="flex max-md:order-2 max-md:w-full max-md:items-center max-md:gap-2 max-md:border-t max-md:border-rule max-md:px-2 max-md:py-1.5 md:contents">
          <Cell caption={tr('솔버', 'Solver')} className="max-md:px-0">
            <Segmented<'rigid' | 'energy'> label={tr('솔버', 'Solver')} value={solverMode} onChange={(m) => setSolverMode(m)} options={[
              { id: 'rigid', label: 'Rigid', title: tr('강체 기구학: 면은 변형되지 않고, 불가능한 요청은 거부한다', 'Rigid kinematics: faces never deform, and an impossible request is refused') },
              { id: 'energy', label: 'Energy', title: tr('에너지법: 면의 굽힘·신장을 허용하고 에너지를 최소화한다', 'Energy method: faces may bend and stretch; the energy is minimised') },
            ]} />
          </Cell>
          <Cell caption={tr('보기', 'View')} className="max-md:px-0">
            <Segmented<ViewMode> label={tr('보기', 'View')} value={viewMode} onChange={(m) => useUI.getState().setViewMode(m)} options={[
              { id: '3d', label: <><Box size={14} />3D</>, title: tr('3D 모델', '3D model') },
              { id: '2d', label: <><Waypoints size={14} />{tr('전개도', 'Pattern')}</>, title: tr('2D 전개도 (crease pattern)', '2D crease pattern') },
              { id: 'split', label: <><Columns2 size={14} />{tr('분할', 'Split')}</>, title: tr('전개도와 3D를 나란히', 'Crease pattern and 3D side by side') },
              { id: 'proj', label: <><Grid2x2 size={14} />{tr('투영', 'Proj.')}</>, title: tr('xy·yz·zx 평면에 투영한 3면도', 'Projections onto the xy, yz and zx planes') },
            ]} />
          </Cell>
        </div>
      )}

      <div className="ml-auto flex items-center gap-0.5 border-rule pl-2 md:border-l">
        <span className="md:hidden"><IconAction icon={<PanelBottomOpen size={16} />} label={tr('검사', 'Inspect')} onClick={() => useUI.getState().setDrawer('inspector')} /></span>
        {model && solverMode === 'energy' && (
          <IconAction icon={playing ? <Pause size={16} /> : <Play size={16} />} label={playing ? tr('동역학 정지', 'Stop dynamics') : tr('동역학 재생', 'Run dynamics')} onClick={togglePlay} active={playing} />
        )}
        <span className="contents max-md:hidden"><IconAction icon={<Undo2 size={16} />} label={tr('실행취소', 'Undo')} onClick={undo} disabled={!past} /></span>
        <span className="contents max-md:hidden"><IconAction icon={<Redo2 size={16} />} label={tr('다시실행', 'Redo')} onClick={redo} disabled={!future} /></span>
        {model && <IconAction icon={<RotateCcw size={16} />} label={tr('초기화', 'Reset')} onClick={resetSimulation} />}
        <button type="button" onClick={() => useUI.getState().setLang(lang === 'ko' ? 'en' : 'ko')} title={tr('Switch to English', '한국어로 보기')} aria-label={tr('Switch to English', '한국어로 보기')}
          className="flex h-9 items-center gap-1 rounded-[4px] px-2 text-[13px] font-semibold text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink">
          <Languages size={16} aria-hidden /><span>{lang === 'ko' ? 'EN' : '한'}</span>
        </button>
        <IconAction icon={<Settings size={16} />} label={tr('설정', 'Settings')} onClick={() => useUI.getState().setSettingsOpen(true)} />
      </div>
    </header>
  );
}
