import { useEffect, useState } from 'react';
import { ArrowRight, ChevronRight, Download, Printer } from 'lucide-react';
import { LECTURE_TITLES, LESSONS, PAGE_LABS, PARTS, lessonById, sheetNumber, type Lesson } from '../../curriculum/lessons';
import { tr } from '../../i18n';
import { downloadCreasePattern, printCreasePattern } from '../pages/printCP';
import { VideoGrid } from '../pages/Article';
import { StructureIntro } from '../pages/StructurePicker';
import { ExplainerButton } from '../explainers/ExplainerButton';
import { useSim } from '../../state/simulationStore';
import { engine } from '../../state/engine';
import { waterbombTubeMetrics } from '../../models/generators/waterbombTube';

import { GENERATORS } from '../../models/registry';
import { useModel } from '../../state/modelStore';
import { useUI, type AppMode } from '../../state/uiStore';
import { applyParams, exportCurrentFold, loadLesson } from '../../state/actions';
import { FoldBody, NumberField, Section } from '../controls/ui';
import { Rich } from '../controls/Rich';

function Navigator() {
  const lessonId = useModel((s) => s.lessonId);
  const lecture = useUI((s) => s.lecture);
  const [open, setOpen] = useState<Record<number, boolean>>({});
  useEffect(() => setOpen({ [lecture]: true }), [lecture]);
  return (
    <nav aria-label={tr('도면 목록', 'Sheet index')} className="border-b border-rule-2 px-2 py-2">
      <div className="flex items-center justify-between px-2 pb-1">
        <span className="lettering text-[12px] text-ink-3">{tr('도면 목록', 'Sheets')}</span>
        <button type="button" onClick={() => { useUI.getState().setDrawer(null); useUI.getState().setCoverOpen(true); }} className="rounded px-1 text-[13px] text-ink-3 hover:bg-paper-2 hover:text-ink">{tr('표지 보기', 'Cover')}</button>
      </div>
      {PARTS.map((l) => (
        <div key={l}>
          <button type="button" aria-expanded={!!open[l]} onClick={() => setOpen((o) => ({ ...o, [l]: !o[l] }))}
            className="flex w-full items-center gap-1.5 rounded-[3px] px-2 py-1.5 text-left text-[14px] hover:bg-paper-2">
            <ChevronRight size={14} className={`shrink-0 text-ink-3 transition-transform duration-200 ${open[l] ? 'rotate-90' : ''}`} />
            <span className="tnum shrink-0 font-semibold text-ink">{l}</span>
            <span className="truncate text-ink-3">{LECTURE_TITLES[l]}</span>
          </button>
          <FoldBody open={!!open[l]}>
            <ul className="mb-1 ml-[18px] border-l border-dashed border-rule-2">
              {LESSONS.filter((x) => x.lecture === l).map((x) => {
                const active = x.id === lessonId;
                return (
                  <li key={x.id}>
                    <button type="button" onClick={() => loadLesson(x.id)} aria-current={active ? 'page' : undefined}
                      className={`group relative flex w-full items-center gap-2 py-1.5 pl-3 pr-2 text-left text-[14px] transition-colors ${active ? 'font-semibold text-ink' : 'text-ink-2 hover:text-ink'}`}>
                      {active && <span className="absolute inset-y-1 left-1 right-1 -z-0 rounded-[2px] bg-mark/70" aria-hidden />}
                      <span className="tnum relative w-7 shrink-0 self-start pt-px text-[12px] text-ink-3">{sheetNumber(x.id)}</span>
                      <span className="relative min-w-0 flex-1 leading-snug [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">{x.title}</span>
                      {x.kind === 'lab' && (x.lab && PAGE_LABS.includes(x.lab)
                        ? <span className="lettering relative shrink-0 self-start rounded-[2px] border border-rule-2 px-1 pt-px text-[12px] text-ink-3" title={tr('읽는 도면', 'Reading page')}>{tr('읽기', 'Read')}</span>
                        : <span className="lettering relative shrink-0 self-start rounded-[2px] border border-rule-2 px-1 pt-px text-[12px] text-ink-3" title={tr('실습 도구 (전용 화면)', 'Lab tool (its own screen)')}>{tr('실습', 'Lab')}</span>)}
                    </button>
                  </li>
                );
              })}
            </ul>
          </FoldBody>
        </div>
      ))}
    </nav>
  );
}

/** Waterbomb tube: the closed-form size next to the measured one, live while it folds. */
function TubeMetrics() {
  const model = useModel((s) => s.model);
  useSim((s) => s.rho);
  useSim((s) => s.stateFold);
  if (!model || model.metadata.generator !== 'waterbombTube' || !engine.positions.length) return null;
  let m;
  try { m = waterbombTubeMetrics(model, engine.positions); } catch { return null; }
  const row = 'grid grid-cols-[1fr_auto_auto] items-baseline gap-x-3 py-1 text-[14px]';
  return (
    <Section title={tr('튜브 치수', 'Tube dimensions')}>
      <div className={`${row} text-[12px] text-ink-3`}><span /><span>{tr('처음 (공식)', 'As rolled (formula)')}</span><span>{tr('지금 (측정)', 'Now (measured)')}</span></div>
      <div className={row}><span className="text-ink-2">{tr('반지름 R', 'Radius R')}</span><span className="tnum text-right">{m.formula.R0.toFixed(3)}</span><span className="tnum text-right font-semibold text-ink">{m.R.toFixed(3)}</span></div>
      <div className={row}><span className="text-ink-2">{tr('길이 L', 'Length L')}</span><span className="tnum text-right">{m.formula.L0.toFixed(3)}</span><span className="tnum text-right font-semibold text-ink">{m.L.toFixed(3)}</span></div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3"><Rich text={tr('$R_0 = d/(4\\sin(\\pi/2n))$, $L_0 = m\\,d$. 접힌 뒤의 값은 측정값이다.', '$R_0 = d/(4\\sin(\\pi/2n))$, $L_0 = m\\,d$. Folded values are measured.')} /></p>
    </Section>
  );
}

function ParamsPanel() {
  const generator = useModel((s) => s.generator);
  const params = useModel((s) => s.params);
  if (!generator) return null;
  const specs = GENERATORS[generator].specs;
  if (!specs.length) return null;
  const field = 'rounded-[4px] border border-rule-2 bg-paper px-2 py-1 text-[14px] text-ink focus:border-ink focus:outline-none';
  return (
    <Section title={tr('치수', 'Dimensions')} foldable>
      <div className="space-y-3">
        {specs.map((sp) => {
          const v = params[sp.key];
          if (sp.kind === 'select')
            return (
              <label key={sp.key} className="flex items-center justify-between gap-2 text-[14px] text-ink-2">
                {sp.label}
                <select className={field} value={String(v)} onChange={(e) => applyParams({ [sp.key]: e.target.value })}>
                  {sp.options!.map((o) => <option key={o}>{o}</option>)}
                </select>
              </label>
            );
          if (sp.kind === 'bool')
            return (
              <label key={sp.key} className="flex items-center gap-2 text-[14px] text-ink-2">
                <input type="checkbox" checked={!!v} onChange={(e) => applyParams({ [sp.key]: e.target.checked })} /> {sp.label}
              </label>
            );
          if (sp.kind === 'list')
            return (
              <label key={sp.key} className="block text-[14px] text-ink-2">
                {sp.label}
                <input key={String(v)} className={`mt-1 w-full tnum ${field}`} defaultValue={String(v)}
                  onKeyDown={(e) => { if (e.key === 'Enter') applyParams({ [sp.key]: (e.target as HTMLInputElement).value }); }}
                  onBlur={(e) => { if (e.target.value !== String(v)) applyParams({ [sp.key]: e.target.value }); }} />
              </label>
            );
          const num = typeof v === 'number' ? v : 0;
          return (
            <div key={sp.key} className="text-[14px] text-ink-2">
              <div className="flex items-center justify-between gap-2">
                <span>{sp.label}</span>
                <NumberField label={sp.label} value={num} step={sp.step ?? 1} min={sp.min} max={sp.max} width="w-16" onCommit={(x) => applyParams({ [sp.key]: sp.kind === 'int' ? Math.round(x) : x })} />
              </div>
              <input type="range" aria-label={sp.label} className="mt-1 w-full" min={sp.min} max={sp.max} step={sp.kind === 'int' ? 1 : sp.step ?? 0.01} value={num}
                onChange={(e) => applyParams({ [sp.key]: sp.kind === 'int' ? parseInt(e.target.value) : parseFloat(e.target.value) })} />
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function Presets({ lesson }: { lesson: Lesson }) {
  if (!lesson.presets?.length) return null;
  return (
    <Section title={tr('프리셋', 'Presets')} foldable>
      <div className="flex flex-wrap gap-1.5">
        {lesson.presets.map((p) => (
          <button key={p.label} type="button" title={p.note} onClick={() => applyParams(p.params, p.generator)}
            className="rounded-[4px] border border-rule-2 bg-paper px-2.5 py-1 text-left text-[13px] text-ink transition-colors hover:border-ink hover:bg-paper-2"><Rich text={p.label} /></button>
        ))}
      </div>
    </Section>
  );
}

const CH_KEY = 'oel-challenges';
function loadDone(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(CH_KEY) ?? '{}'); } catch { return {}; }
}

function Challenges({ lesson, prominent }: { lesson: Lesson; prominent?: boolean }) {
  const [done, setDone] = useState<Record<string, boolean>>(loadDone);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => {
    const next = { ...done, [id]: !done[id] };
    setDone(next);
    try { localStorage.setItem(CH_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  };
  return (
    <Section title={prominent ? tr('도전 과제', 'Challenges') : tr('해 보기', 'Try it')} foldable defaultOpen={!!prominent}>
      <ol className="space-y-3">
        {lesson.challenges.map((c, i) => {
          const key = `${lesson.id}:${c.id}`;
          return (
            <li key={c.id} className="text-[14px] leading-relaxed text-ink-2">
              <label className="flex cursor-pointer gap-2.5">
                <input type="checkbox" className="mt-1" checked={!!done[key]} onChange={() => toggle(key)} />
                <span className={done[key] ? 'text-ink-3 line-through' : ''}><span className="tnum mr-1 text-ink-3">{i + 1}.</span><Rich text={c.text} /></span>
              </label>
              <div className="ml-6 mt-1 flex gap-3 text-[13px]">
                {c.hint && <details className="text-ink-3"><summary className="cursor-pointer hover:text-ink">{tr('힌트', 'Hint')}</summary><p className="mt-1"><Rich text={c.hint} /></p></details>}
                {c.answer && (
                  <button type="button" className="text-info underline-offset-2 hover:underline" onClick={() => setReveal((r) => ({ ...r, [c.id]: !r[c.id] }))}>
                    {reveal[c.id] ? tr('답 숨기기', 'Hide answer') : tr('답 보기', 'Show answer')}
                  </button>
                )}
              </div>
              {reveal[c.id] && <div className="ml-6 mt-1.5 rounded-[3px] border border-ok/30 bg-ok-soft px-2.5 py-1.5 text-[14px] text-ink"><Rich text={c.answer ?? ""} /></div>}
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

function Note({ n, label, text, open = true }: { n: number; label: string; text: string; open?: boolean }) {
  const [o, setO] = useState(open);
  return (
    <div className="border-t border-dashed border-rule first:border-t-0">
      <button type="button" aria-expanded={o} onClick={() => setO((x) => !x)} className="flex w-full items-center gap-2 py-2 text-left">
        <span className="tnum flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-ink-3 text-[12px] text-ink-2">{n}</span>
        <span className="text-[14px] font-semibold text-ink">{label}</span>
        <ChevronRight size={14} className={`ml-auto text-ink-3 transition-transform duration-200 ${o ? 'rotate-90' : ''}`} />
      </button>
      <FoldBody open={o}><p className="pb-3 pl-7 text-[14px] leading-[1.7] text-ink-2"><Rich text={text} /></p></FoldBody>
    </div>
  );
}

function LessonContent({ lesson }: { lesson: Lesson }) {
  const [ans, setAns] = useState(false);
  const page = !!lesson.lab && PAGE_LABS.includes(lesson.lab);
  return (
    <section className="vt-lesson border-b border-dashed border-rule-2 px-4 pb-3 pt-4">
      <h2 className="text-[18px] font-bold leading-snug tracking-tight text-ink">{lesson.title}</h2>
      <StructureIntro sheet={lesson.id} />
      <ExplainerButton lessonId={lesson.id} />
      <p className="mt-3 text-[15px] leading-[1.7] text-ink"><Rich text={lesson.content.concept} /></p>
      {!page && (<>
        <div className="lettering mt-4 text-[12px] text-ink-3">{tr('주기', 'Notes')}</div>
        <Note n={1} label={tr('관찰할 점', 'What to watch')} text={lesson.content.observe} />
        <Note n={2} label={tr('실험해 보기', 'Try this')} text={lesson.content.experiment} />
        <Note n={3} label={tr('의미', 'What it means')} text={lesson.content.meaning} open={false} />
      </>)}
      {lesson.content.question && (
        <div className="mt-2 rounded-[3px] border border-rule-2 bg-paper-2 px-3 py-2.5 text-[14px] leading-relaxed">
          <div className="font-semibold text-ink">{tr('질문', 'Question')}</div>
          <div className="text-ink-2"><Rich text={lesson.content.question} /></div>
          <button type="button" className="mt-1 text-[13px] text-info underline-offset-2 hover:underline" onClick={() => setAns((a) => !a)}>{ans ? tr('결론 숨기기', 'Hide the conclusion') : tr('기대되는 결론 보기', 'Show the expected conclusion')}</button>
          {ans && <div className="mt-1.5 rounded-[3px] bg-ok-soft px-2 py-1.5 text-ink"><Rich text={lesson.content.answer ?? ''} /></div>}
        </div>
      )}
      {lesson.links && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {lesson.links.map((l) => (
            <button key={l.to} type="button" className="inline-flex items-center gap-1 rounded-[4px] border border-rule-2 px-2 py-1 text-[13px] text-info hover:border-info" onClick={() => loadLesson(l.to)}>
              {l.label}<ArrowRight size={13} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

const MODES = (): { id: AppMode; label: string; hint: string }[] => [
  { id: 'learn', label: tr('설명', 'Learn'), hint: tr('개념 설명과 관찰할 점', 'Concepts and what to watch') },
  { id: 'explore', label: tr('탐구', 'Explore'), hint: tr('설명 없이 치수와 프리셋만', 'Dimensions and presets, no text') },
  { id: 'challenge', label: tr('과제', 'Tasks'), hint: tr('도전 과제 중심', 'Challenges first') },
];

/** Print or save the current crease pattern: the bridge from screen to paper. */
function FoldItYourself() {
  const model = useModel((s) => s.model);
  const lessonId = useModel((s) => s.lessonId);
  if (!model) return null;
  const title = lessonById(lessonId)?.title ?? model.metadata.name;
  const btn = 'inline-flex items-center gap-1.5 rounded-[4px] border border-rule-2 bg-paper px-2.5 py-1 text-[13px] text-ink transition-colors hover:border-ink hover:bg-paper-2';
  return (
    <Section title={tr('직접 접어 보기', 'Fold it yourself')} foldable defaultOpen={false}>
      <p className="text-[14px] leading-relaxed text-ink-2">{tr('지금 보이는 전개도를 A4에 인쇄해 직접 접어 본다. 치수를 바꾸면 바뀐 패턴이 인쇄된다.', 'Print the crease pattern on screen on A4 and fold it by hand. Change the dimensions first and the changed pattern is printed.')}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button type="button" className={btn} onClick={() => printCreasePattern(model, title)}><Printer size={14} />{tr('인쇄', 'Print')}</button>
        <button type="button" className={btn} onClick={() => downloadCreasePattern(model, title)}><Download size={14} />{tr('SVG 저장', 'Save SVG')}</button>
        <button type="button" className={btn} title={tr('지금 접힌 상태까지 담은 FOLD 파일. Origami Simulator 같은 다른 도구에서 열 수 있다.', 'A FOLD file with the current folded state. Opens in other tools such as Origami Simulator.')} onClick={() => {
          const text = exportCurrentFold();
          if (!text) return;
          const a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
          a.download = `${model.metadata.generator || 'model'}.fold`;
          a.click();
        }}><Download size={14} />{tr('FOLD 저장', 'Save FOLD')}</button>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-3">{tr('빨간 일점쇄선은 산접기, 파란 점선은 골접기. 모든 선을 한 번씩 미리 접은 뒤 모아 접는다.', 'Red dash-dot lines are mountains, blue dashed lines valleys. Pre-crease every line, then collapse.')}</p>
      <button type="button" onClick={() => loadLesson('l0-first')} className="mt-1 inline-flex items-center gap-1 text-[13px] text-info underline-offset-2 hover:underline">{tr('손으로 접는 요령', 'Folding tips')}<ArrowRight size={13} /></button>
    </Section>
  );
}

/** Videos chosen for this sheet (reading pages show theirs in the page itself). */
function Watch({ lesson }: { lesson: Lesson }) {
  if (!lesson.videos?.length || (lesson.lab && PAGE_LABS.includes(lesson.lab))) return null;
  return (
    <Section title={tr('영상으로 보기', 'Watch')} foldable defaultOpen={false}>
      <div className="-mt-3"><VideoGrid ids={lesson.videos} compact /></div>
    </Section>
  );
}

/** How the lesson column reads: explanation, free exploration or tasks. */
function ModeTabs() {
  const appMode = useUI((s) => s.appMode);
  return (
    <div role="tablist" aria-label={tr('레슨 보기 방식', 'How the lesson reads')} className="sticky top-0 z-10 flex gap-1 border-b border-rule-2 bg-paper px-3 pb-2 pt-2.5">
      {MODES().map((m) => (
        <button key={m.id} type="button" role="tab" aria-selected={appMode === m.id} title={m.hint} onClick={() => useUI.getState().setAppMode(m.id)}
          className={`h-7 flex-1 rounded-[3px] text-[13px] font-medium transition-colors ${appMode === m.id ? 'bg-paper text-ink font-semibold shadow-[inset_0_0_0_1.5px_var(--color-ink)]' : 'text-ink-2 hover:bg-paper-2 hover:text-ink'}`}>
          {m.label}
        </button>
      ))}
    </div>
  );
}

export function Sidebar() {
  const lessonId = useModel((s) => s.lessonId);
  const appMode = useUI((s) => s.appMode);
  const lesson = lessonById(lessonId);
  return (
    <aside className="sheet flex h-full flex-col overflow-hidden rounded-[3px]" aria-label={tr('도면 목록과 레슨', 'Sheets and lesson')}>
      <div className="stable-gutter max-h-[36%] shrink-0 overflow-y-auto"><Navigator /></div>
      <div className="stable-gutter min-h-0 flex-1 overflow-y-auto">
        {lesson && <ModeTabs />}
        {lesson && appMode === 'learn' && <LessonContent lesson={lesson} />}
        {lesson && appMode === 'challenge' && <Challenges lesson={lesson} prominent />}
        {lesson && <Presets lesson={lesson} />}
        <ParamsPanel />
        <TubeMetrics />
        {lesson && <Watch lesson={lesson} />}
        <FoldItYourself />
        {lesson && appMode === 'learn' && lesson.challenges.length > 0 && <Challenges lesson={lesson} />}
        {lesson && appMode === 'explore' && (
          <p className="px-4 py-3 text-[14px] text-ink-3">{tr('탐구 모드: 설명을 숨겼다. 치수를 바꾸고, 크리스를 구동하고, 솔버를 바꿔 보라.', 'Explore mode: the text is hidden. Change dimensions, drive creases, switch solvers.')}</p>
        )}
        {lessonId === 'imported' && <p className="px-4 py-3 text-[14px] text-ink-3">{tr('FOLD 파일에서 가져온 모델', 'Model imported from a FOLD file')}</p>}
      </div>
    </aside>
  );
}
