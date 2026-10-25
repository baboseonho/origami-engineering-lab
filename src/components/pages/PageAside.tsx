import { tr } from '../../i18n';
import { LECTURE_TITLES, LESSONS, lessonById } from '../../curriculum/lessons';
import { useModel } from '../../state/modelStore';
import { useUI } from '../../state/uiStore';
import { SheetLink } from './Article';

/** Right-hand sheet of a reading page: where to go next, and the rest of this part. */
export function PageAside() {
  const lessonId = useModel((s) => s.lessonId);
  const lesson = lessonById(lessonId);
  if (!lesson) return null;
  const i = LESSONS.findIndex((l) => l.id === lessonId);
  const next = LESSONS.slice(i + 1, i + 3);
  const same = LESSONS.filter((l) => l.lecture === lesson.lecture && l.id !== lessonId);
  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      <h3 className="lettering text-[12px] text-ink-3">{tr('다음 도면', 'Next')}</h3>
      <div className="mt-2 flex flex-col items-start gap-1.5">{next.map((l) => <SheetLink key={l.id} to={l.id} />)}</div>
      {same.length > 0 && (
        <>
          <h3 className="lettering mt-6 text-[12px] text-ink-3">{tr('이 단원', 'In this part')} · {LECTURE_TITLES[lesson.lecture]}</h3>
          <div className="mt-2 flex flex-col items-start gap-1.5">{same.map((l) => <SheetLink key={l.id} to={l.id} />)}</div>
        </>
      )}
      <h3 className="lettering mt-6 text-[12px] text-ink-3">{tr('언제든', 'Any time')}</h3>
      <div className="mt-2 flex flex-col items-start gap-1.5">
        {lessonId !== 'l0-glossary' && <SheetLink to="l0-glossary" />}
        <button type="button" onClick={() => useUI.getState().setCoverOpen(true)}
          className="rounded-[4px] border border-rule-2 px-2.5 py-1 text-[14px] text-ink hover:border-ink hover:bg-paper-2">{tr('표지에서 전체 도면 보기', 'See every sheet on the cover')}</button>
      </div>
    </div>
  );
}
