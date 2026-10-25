import { useState } from 'react';
import { ArrowRight, ChevronDown, ChevronUp, Cog, Compass, Cylinder, Grid3x3, Layers, Lightbulb, Shapes, Sparkles, type LucideIcon } from 'lucide-react';
import { tr } from '../../i18n';
import { LECTURE_TITLES, PAGE_LABS, lessonById, sheetNumber, type LabId, type Lesson } from '../../curriculum/lessons';
import { PatternThumb } from './CoverSheet';
import { useModel } from '../../state/modelStore';
import { useUI } from '../../state/uiStore';
import { loadLesson } from '../../state/actions';
import { Rich } from '../controls/Rich';
import { StructureHook, StructureIntro } from '../pages/StructurePicker';
import { ExplainerButton } from '../explainers/ExplainerButton';

/** One icon per part, so each chapter has its own face. */
const PART_ICON: Record<number, LucideIcon> = { 0: Sparkles, 1: Lightbulb, 2: Layers, 3: Cog, 4: Grid3x3, 5: Cylinder, 6: Shapes, 7: Compass };

/** The part badge and the sheet's crease pattern as a small plate, drawn in by a pen. */
function PartBadge({ lesson }: { lesson: Lesson }) {
  const Icon = PART_ICON[lesson.lecture] ?? Sparkles;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-rule-2 bg-paper-2 py-0.5 pl-1 pr-2.5 text-[12px] text-ink-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink text-paper"><Icon size={12} /></span>
      <span className="lettering">{tr('단원', 'Part')} {lesson.lecture} · {LECTURE_TITLES[lesson.lecture]}</span>
    </span>
  );
}

function Plate({ lesson }: { lesson: Lesson }) {
  return (
    <figure className="group relative m-0 hidden h-[84px] w-[118px] shrink-0 @sm:block @lg:h-[104px] @lg:w-[148px] overflow-hidden rounded-[3px] border border-rule-2 bg-paper-2/60 shadow-[0_1px_0_rgb(23_32_42/0.06)]" aria-hidden>
      <div className="grid-paper absolute inset-0 opacity-50" />
      <div className="absolute inset-x-3 bottom-3 top-4 transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105"><PatternThumb lesson={lesson} delay={120} /></div>
      <span className="tnum absolute left-1.5 top-1 text-[12px] text-ink-3">{sheetNumber(lesson.id)}</span>
    </figure>
  );
}

/** Labs that bring their own full-sheet layout keep their explanation in the lesson column. */
const OWN_LAYOUT: LabId[] = ['conceptLab', 'stepwise'];

/**
 * Whether the lesson's explanation is shown in the main area (then the lesson
 * column does not repeat it): on model sheets in the split view, and on labs.
 */
export function useBriefInMain(): boolean {
  const lessonId = useModel((s) => s.lessonId);
  const viewMode = useUI((s) => s.viewMode);
  const lesson = lessonById(lessonId);
  if (!lesson) return false;
  if (lesson.kind === 'lab') return !!lesson.lab && !PAGE_LABS.includes(lesson.lab) && !OWN_LAYOUT.includes(lesson.lab);
  return viewMode === 'split';
}

function NoteCard({ n, title, text }: { n: number; title: string; text: string }) {
  if (!text) return null;
  return (
    <div className="rounded-[3px] border border-rule-2 bg-paper px-3.5 py-3">
      <div className="flex items-center gap-2">
        <span className="tnum flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ink-3 text-[13px] text-ink-2">{n}</span>
        <span className="text-[15px] font-semibold text-ink">{title}</span>
      </div>
      <p className="mt-1.5 text-[15px] leading-[1.7] text-ink-2"><Rich text={text} /></p>
    </div>
  );
}

/**
 * The lesson's explanation, laid out to be read: the question that opens it,
 * the idea, then what to watch, what to try and what it means, side by side
 * when there is room. It folds away to one line to give the drawing space.
 */
export function LessonBrief({ lesson }: { lesson: Lesson }) {
  const open = useUI((s) => s.briefOpen);
  const [ans, setAns] = useState(false);
  const toggle = (
    <button type="button" onClick={() => useUI.getState().setBriefOpen(!open)} aria-expanded={open}
      className="flex shrink-0 items-center gap-1 rounded-[4px] px-2 py-1 text-[13px] text-ink-3 hover:bg-paper-2 hover:text-ink">
      {open ? <><ChevronUp size={15} />{tr('설명 접기', 'Hide')}</> : <><ChevronDown size={15} />{tr('설명 펼치기', 'Show explanation')}</>}
    </button>
  );
  if (!open) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-2">
        <div className="min-w-0 truncate"><span className="tnum mr-2 text-[13px] text-ink-3">{sheetNumber(lesson.id)}</span><span className="text-[15px] font-semibold text-ink">{lesson.title}</span></div>
        {toggle}
      </div>
    );
  }
  return (
    <section className="@container vt-lesson px-4 pb-4 pt-3" aria-label={tr('설명', 'Explanation')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <PartBadge lesson={lesson} />
          <h2 className="mt-1.5 text-[20px] font-bold leading-snug tracking-tight text-ink">{lesson.title}</h2>
          <div className="mt-1">{toggle}</div>
        </div>
        <Plate lesson={lesson} />
      </div>
      <StructureHook sheet={lesson.id} />
      <div className="mt-2 grid gap-x-6 @3xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div>
          <p className="text-[16px] leading-[1.75] text-ink"><Rich text={lesson.content.concept} /></p>
          <ExplainerButton lessonId={lesson.id} />
        </div>
        <div className="max-w-[560px]"><StructureIntro sheet={lesson.id} showHook={false} /></div>
      </div>
      <div className="mt-4 grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        <NoteCard n={1} title={tr('관찰할 점', 'What to watch')} text={lesson.content.observe} />
        <NoteCard n={2} title={tr('실험해 보기', 'Try this')} text={lesson.content.experiment} />
        <NoteCard n={3} title={tr('의미', 'What it means')} text={lesson.content.meaning} />
      </div>
      {lesson.content.question && (
        <div className="mt-3 rounded-[3px] border border-rule-2 bg-paper-2 px-3.5 py-3 text-[15px] leading-relaxed">
          <div className="font-semibold text-ink">{tr('질문', 'Question')}</div>
          <div className="text-ink-2"><Rich text={lesson.content.question} /></div>
          <button type="button" className="mt-1 text-[14px] text-info underline-offset-2 hover:underline" onClick={() => setAns((a) => !a)}>{ans ? tr('결론 숨기기', 'Hide the conclusion') : tr('기대되는 결론 보기', 'Show the expected conclusion')}</button>
          {ans && <div className="mt-1.5 rounded-[3px] bg-ok-soft px-2.5 py-1.5 text-ink"><Rich text={lesson.content.answer ?? ''} /></div>}
        </div>
      )}
      {lesson.links && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {lesson.links.map((l) => (
            <button key={l.to} type="button" className="inline-flex items-center gap-1 rounded-[4px] border border-rule-2 px-2.5 py-1 text-[14px] text-info hover:border-info" onClick={() => loadLesson(l.to)}>
              {l.label}<ArrowRight size={14} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
