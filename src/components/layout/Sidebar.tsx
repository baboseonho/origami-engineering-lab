import { useEffect, useState } from 'react';
import { ArrowRight, ChevronRight, FlaskConical } from 'lucide-react';
import { LESSONS, lessonById, type Lesson } from '../../curriculum/lessons';
import { GENERATORS } from '../../models/registry';
import { useModel } from '../../state/modelStore';
import { useUI } from '../../state/uiStore';
import { applyParams, loadLesson } from '../../state/actions';
import { FoldBody, NumberField, Section } from '../controls/ui';
import { Rich } from '../controls/Rich';

const LECTURE_TITLES: Record<number, string> = {
  1: '도입 · 용어',
  2: '단순 접기 · 단일 꼭짓점',
  3: '종이접기 기구학',
  4: '대표 모델 I',
  5: '대표 모델 II',
};

function Navigator() {
  const lessonId = useModel((s) => s.lessonId);
  const lecture = useUI((s) => s.lecture);
  const [open, setOpen] = useState<Record<number, boolean>>({});
  useEffect(() => setOpen({ [lecture]: true }), [lecture]);
  return (
    <nav aria-label="도면 목록" className="border-b border-rule-2 px-2 py-2">
      <div className="lettering px-2 pb-1 text-[11.5px] text-ink-3">도면 목록</div>
      {[1, 2, 3, 4, 5].map((l) => (
        <div key={l}>
          <button type="button" aria-expanded={!!open[l]} onClick={() => setOpen((o) => ({ ...o, [l]: !o[l] }))}
            className="flex w-full items-center gap-1.5 rounded-[3px] px-2 py-1.5 text-left text-[13px] hover:bg-paper-2">
            <ChevronRight size={14} className={`shrink-0 text-ink-3 transition-transform duration-200 ${open[l] ? 'rotate-90' : ''}`} />
            <span className="tnum font-semibold text-ink">{l}강</span>
            <span className="truncate text-ink-3">{LECTURE_TITLES[l]}</span>
          </button>
          <FoldBody open={!!open[l]}>
            <ul className="mb-1 ml-[18px] border-l border-dashed border-rule-2">
              {LESSONS.filter((x) => x.lecture === l).map((x, i) => {
                const active = x.id === lessonId;
                return (
                  <li key={x.id}>
                    <button type="button" onClick={() => loadLesson(x.id)} aria-current={active ? 'page' : undefined}
                      className={`group relative flex w-full items-center gap-2 py-1.5 pl-3 pr-2 text-left text-[13px] transition-colors ${active ? 'font-semibold text-ink' : 'text-ink-2 hover:text-ink'}`}>
                      {active && <span className="absolute inset-y-1 left-1 right-1 -z-0 rounded-[2px] bg-mark/70" aria-hidden />}
                      <span className="tnum relative w-7 shrink-0 text-[11px] text-ink-3">{l}.{i + 1}</span>
                      <span className="relative min-w-0 flex-1 truncate">{x.title}</span>
                      {x.kind === 'lab' && <FlaskConical size={13} className="relative shrink-0 text-ink-3" aria-label="실습 도구" />}
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

function ParamsPanel() {
  const generator = useModel((s) => s.generator);
  const params = useModel((s) => s.params);
  if (!generator) return null;
  const specs = GENERATORS[generator].specs;
  if (!specs.length) return null;
  const field = 'rounded-[4px] border border-rule-2 bg-paper px-2 py-1 text-[13px] text-ink focus:border-ink focus:outline-none';
  return (
    <Section title="치수" foldable>
      <div className="space-y-3">
        {specs.map((sp) => {
          const v = params[sp.key];
          if (sp.kind === 'select')
            return (
              <label key={sp.key} className="flex items-center justify-between gap-2 text-[13px] text-ink-2">
                {sp.label}
                <select className={field} value={String(v)} onChange={(e) => applyParams({ [sp.key]: e.target.value })}>
                  {sp.options!.map((o) => <option key={o}>{o}</option>)}
                </select>
              </label>
            );
          if (sp.kind === 'bool')
            return (
              <label key={sp.key} className="flex items-center gap-2 text-[13px] text-ink-2">
                <input type="checkbox" checked={!!v} onChange={(e) => applyParams({ [sp.key]: e.target.checked })} /> {sp.label}
              </label>
            );
          if (sp.kind === 'list')
            return (
              <label key={sp.key} className="block text-[13px] text-ink-2">
                {sp.label}
                <input key={String(v)} className={`mt-1 w-full tnum ${field}`} defaultValue={String(v)}
                  onKeyDown={(e) => { if (e.key === 'Enter') applyParams({ [sp.key]: (e.target as HTMLInputElement).value }); }}
                  onBlur={(e) => { if (e.target.value !== String(v)) applyParams({ [sp.key]: e.target.value }); }} />
              </label>
            );
          const num = typeof v === 'number' ? v : 0;
          return (
            <div key={sp.key} className="text-[13px] text-ink-2">
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
    <Section title="프리셋" foldable>
      <div className="flex flex-wrap gap-1.5">
        {lesson.presets.map((p) => (
          <button key={p.label} type="button" title={p.note} onClick={() => applyParams(p.params, p.generator)}
            className="rounded-[4px] border border-rule-2 bg-paper px-2.5 py-1 text-left text-[12.5px] text-ink transition-colors hover:border-ink hover:bg-paper-2">{p.label}</button>
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
    <Section title={prominent ? '도전 과제' : '해 보기'} foldable defaultOpen={!!prominent}>
      <ol className="space-y-3">
        {lesson.challenges.map((c, i) => {
          const key = `${lesson.id}:${c.id}`;
          return (
            <li key={c.id} className="text-[13.5px] leading-relaxed text-ink-2">
              <label className="flex cursor-pointer gap-2.5">
                <input type="checkbox" className="mt-1" checked={!!done[key]} onChange={() => toggle(key)} />
                <span className={done[key] ? 'text-ink-3 line-through' : ''}><span className="tnum mr-1 text-ink-3">{i + 1}.</span><Rich text={c.text} /></span>
              </label>
              <div className="ml-6 mt-1 flex gap-3 text-[12.5px]">
                {c.hint && <details className="text-ink-3"><summary className="cursor-pointer hover:text-ink">힌트</summary><p className="mt-1"><Rich text={c.hint} /></p></details>}
                {c.answer && (
                  <button type="button" className="text-info underline-offset-2 hover:underline" onClick={() => setReveal((r) => ({ ...r, [c.id]: !r[c.id] }))}>
                    {reveal[c.id] ? '답 숨기기' : '답 보기'}
                  </button>
                )}
              </div>
              {reveal[c.id] && <div className="ml-6 mt-1.5 rounded-[3px] border border-ok/30 bg-ok-soft px-2.5 py-1.5 text-[13px] text-ink"><Rich text={c.answer ?? ""} /></div>}
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
        <span className="tnum flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-ink-3 text-[11px] text-ink-2">{n}</span>
        <span className="text-[13px] font-semibold text-ink">{label}</span>
        <ChevronRight size={14} className={`ml-auto text-ink-3 transition-transform duration-200 ${o ? 'rotate-90' : ''}`} />
      </button>
      <FoldBody open={o}><p className="pb-3 pl-7 text-[13.5px] leading-[1.7] text-ink-2"><Rich text={text} /></p></FoldBody>
    </div>
  );
}

function LessonContent({ lesson }: { lesson: Lesson }) {
  const [ans, setAns] = useState(false);
  return (
    <section className="vt-lesson border-b border-dashed border-rule-2 px-4 pb-3 pt-4">
      <h2 className="text-[17px] font-bold leading-snug tracking-tight text-ink">{lesson.title}</h2>
      <p className="mt-2 text-[14px] leading-[1.7] text-ink"><Rich text={lesson.content.concept} /></p>
      <div className="lettering mt-4 text-[11.5px] text-ink-3">주기</div>
      <Note n={1} label="관찰할 점" text={lesson.content.observe} />
      <Note n={2} label="실험해 보기" text={lesson.content.experiment} />
      <Note n={3} label="의미" text={lesson.content.meaning} open={false} />
      {lesson.content.question && (
        <div className="mt-2 rounded-[3px] border border-rule-2 bg-paper-2 px-3 py-2.5 text-[13.5px] leading-relaxed">
          <div className="font-semibold text-ink">질문</div>
          <div className="text-ink-2"><Rich text={lesson.content.question} /></div>
          <button type="button" className="mt-1 text-[12.5px] text-info underline-offset-2 hover:underline" onClick={() => setAns((a) => !a)}>{ans ? '결론 숨기기' : '기대되는 결론 보기'}</button>
          {ans && <div className="mt-1.5 rounded-[3px] bg-ok-soft px-2 py-1.5 text-ink"><Rich text={lesson.content.answer ?? ''} /></div>}
        </div>
      )}
      {lesson.links && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {lesson.links.map((l) => (
            <button key={l.to} type="button" className="inline-flex items-center gap-1 rounded-[4px] border border-rule-2 px-2 py-1 text-[12.5px] text-info hover:border-info" onClick={() => loadLesson(l.to)}>
              {l.label}<ArrowRight size={13} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export function Sidebar() {
  const lessonId = useModel((s) => s.lessonId);
  const appMode = useUI((s) => s.appMode);
  const lesson = lessonById(lessonId);
  return (
    <aside className="sheet flex h-full flex-col overflow-hidden rounded-[3px]" aria-label="도면 목록과 레슨">
      <div className="max-h-[46%] shrink-0 overflow-y-auto"><Navigator /></div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {lesson && appMode === 'learn' && <LessonContent lesson={lesson} />}
        {lesson && appMode === 'challenge' && <Challenges lesson={lesson} prominent />}
        {lesson && <Presets lesson={lesson} />}
        <ParamsPanel />
        {lesson && appMode === 'learn' && lesson.challenges.length > 0 && <Challenges lesson={lesson} />}
        {lesson && appMode === 'explore' && (
          <p className="px-4 py-3 text-[13px] text-ink-3">탐구 모드: 설명을 숨겼다. 치수를 바꾸고, 크리스를 구동하고, 솔버를 바꿔 보라.</p>
        )}
        {lessonId === 'imported' && <p className="px-4 py-3 text-[13px] text-ink-3">FOLD 파일에서 가져온 모델</p>}
      </div>
    </aside>
  );
}
