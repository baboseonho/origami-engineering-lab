import { useMemo, useState } from 'react';
import { ArrowRight, Bot, Building2, Car, HeartPulse, Palette, Satellite, Search, ShoppingBag, type LucideIcon } from 'lucide-react';
import { tr } from '../../i18n';
import { lessonById, sheetNumber } from '../../curriculum/lessons';
import { FIELDS, STRUCTURES, bi, structureForSheet, type Field, type Structure } from '../../curriculum/structures';
import { loadLesson } from '../../state/actions';
import { FIELD_USES } from '../../curriculum/resources';
import { getLang } from '../../i18n';
import { PatternThumb } from '../layout/CoverSheet';

const ICON: Record<string, LucideIcon> = { ShoppingBag, Satellite, HeartPulse, Building2, Bot, Car, Palette };

function Level({ n }: { n: number }) {
  const word = n === 1 ? tr('입문', 'Beginner') : n === 2 ? tr('중급', 'Intermediate') : tr('심화', 'Advanced');
  return <span className="lettering rounded-[2px] border border-rule-2 px-1.5 pt-px text-[12px] text-ink-3">{word}</span>;
}

/** One structure: the question that opens it, where it is used, what it teaches. */
export function StructureCard({ s, field }: { s: Structure; field?: Field | null }) {
  const lesson = lessonById(s.sheet);
  if (!lesson) return null;
  const fieldNames = s.fields.map((f) => FIELDS.find((x) => x.id === f)!).filter(Boolean);
  return (
    <button type="button" onClick={() => loadLesson(s.sheet)}
      className="group flex flex-col overflow-hidden rounded-[3px] border border-rule-2 bg-paper text-left transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-ink hover:shadow-[0_6px_14px_-8px_rgb(23_32_42/0.45)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
      <div className="relative aspect-[16/9] shrink-0 border-b border-rule bg-paper-2/60">
        <div className="absolute inset-x-4 bottom-3 top-6"><PatternThumb lesson={lesson} delay={0} /></div>
        <span className="tnum absolute left-2 top-1.5 text-[12px] text-ink-3">{sheetNumber(s.sheet)}</span>
        <span className="absolute right-2 top-1.5"><Level n={s.level} /></span>
      </div>
      <div className="flex flex-1 flex-col px-3.5 py-3">
        <div className="text-[16px] font-semibold text-ink">{bi(s.name)}</div>
        <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{bi(s.hook)}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {fieldNames.map((f) => (
            <span key={f.id} className={`rounded-[2px] px-1.5 text-[12px] ${field === f.id ? 'bg-mark text-mark-ink' : 'bg-paper-2 text-ink-3'}`}>{bi(f)}</span>
          ))}
        </div>
        <div className="mt-auto flex items-center gap-1 pt-2.5 text-[13px] font-medium text-ink group-hover:underline">
          {tr('이 구조 열기', 'Open this structure')}<ArrowRight size={14} />
        </div>
      </div>
    </button>
  );
}

/**
 * Choose by interest: pick a field to see the structures used there, or
 * search by name. Structures whose sheet does not exist yet are skipped.
 */
export function StructurePicker({ search = false, limit }: { search?: boolean; limit?: number }) {
  const [field, setField] = useState<Field | null>(null);
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return STRUCTURES
      .filter((x) => lessonById(x.sheet))
      .filter((x) => !field || x.fields.includes(field))
      .filter((x) => !s || [x.name.ko, x.name.en, x.hook.ko, x.hook.en].some((t) => t.toLowerCase().includes(s)))
      // a field's own structures first, easier ones first
      .sort((a, b) => (field ? a.fields.indexOf(field) - b.fields.indexOf(field) : 0) || a.level - b.level);
  }, [field, q]);
  const shown = limit && !field && !q ? list.slice(0, limit) : list;
  const chip = (on: boolean) => `inline-flex items-center gap-1.5 rounded-[4px] border px-2.5 py-1.5 text-[14px] transition-colors ${on ? 'border-ink bg-paper font-semibold text-ink shadow-[inset_0_0_0_1px_var(--color-ink)]' : 'border-rule-2 bg-paper text-ink-2 hover:border-ink hover:text-ink'}`;
  return (
    <div>
      <div role="radiogroup" aria-label={tr('관심 분야', 'Field of interest')} className="mt-3 flex flex-wrap gap-1.5">
        <button type="button" role="radio" aria-checked={field === null} onClick={() => setField(null)} className={chip(field === null)}>{tr('전체', 'All')}</button>
        {FIELDS.map((f) => {
          const Icon = ICON[f.icon];
          return (
            <button key={f.id} type="button" role="radio" aria-checked={field === f.id} onClick={() => setField(field === f.id ? null : f.id)} className={chip(field === f.id)}>
              <Icon size={15} aria-hidden />{bi(f)}
            </button>
          );
        })}
      </div>
      {search && (
        <label className="mt-3 flex items-center gap-2 rounded-[4px] border border-rule-2 bg-paper px-3 py-2 focus-within:border-ink">
          <Search size={16} className="text-ink-3" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('구조 이름으로 찾기', 'Find a structure by name')}
            aria-label={tr('구조 찾기', 'Find a structure')} className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3" />
        </label>
      )}
      <div className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
        {shown.map((s) => <StructureCard key={s.id} s={s} field={field} />)}
      </div>
      {shown.length < list.length && (
        <button type="button" onClick={() => loadLesson('l0-atlas')} className="mt-3 inline-flex items-center gap-1 text-[14px] text-info underline-offset-2 hover:underline">
          {tr(`구조 ${list.length}개 모두 보기`, `See all ${list.length} structures`)}<ArrowRight size={14} />
        </button>
      )}
      {list.length === 0 && <p className="mt-4 text-ink-3">{tr('맞는 구조가 없다.', 'No matching structure.')}</p>}
    </div>
  );
}

/** The everyday question that opens a structure's sheet. */
export function StructureHook({ sheet }: { sheet: string }) {
  const s = structureForSheet(sheet);
  if (!s) return null;
  return <p className="mt-3 rounded-[3px] border border-mark-deep/40 bg-mark/45 px-3.5 py-2.5 text-[16px] font-medium leading-relaxed text-ink">{bi(s.hook)}</p>;
}

/** On a structure's own sheet: the question, where it is used and the theory it teaches. */
export function StructureIntro({ sheet, showHook = true }: { sheet: string; showHook?: boolean }) {
  const s = structureForSheet(sheet);
  if (!s) return null;
  return (
    <div className="mt-3 space-y-3">
      {showHook && <p className="rounded-[3px] border border-mark-deep/40 bg-mark/45 px-3 py-2 text-[15px] leading-relaxed text-ink">{bi(s.hook)}</p>}
      <div>
        <div className="lettering text-[12px] text-ink-3">{tr('어떻게 접히나', 'How it folds')}</div>
        <p className="mt-0.5 text-[14px] leading-relaxed text-ink-2">{bi(s.motion)}</p>
      </div>
      <div>
        <div className="lettering text-[12px] text-ink-3">{tr('어디에 쓰이나', 'Where it is used')}</div>
        <ul className="mt-1 list-disc space-y-1 pl-4 text-[14px] leading-relaxed text-ink-2">
          {s.uses.map((u) => <li key={u.en}>{bi(u)}</li>)}
          {FIELD_USES.filter((f) => f.structure === s.id).map((f) => (
            <li key={f.example.en}>
              {getLang() === 'en' ? f.example.en : f.example.ko}
              {f.source && <span className="text-ink-3"> ({f.url ? <a href={f.url} target="_blank" rel="noreferrer noopener" className="underline underline-offset-2 hover:text-ink">{f.source}</a> : f.source})</span>}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="lettering text-[12px] text-ink-3">{tr('함께 배우는 이론', 'Theory behind it')}</div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {s.theory.filter((t) => lessonById(t.sheet)).map((t) => (
            <button key={t.label.en} type="button" onClick={() => loadLesson(t.sheet)} disabled={t.sheet === sheet}
              className="inline-flex items-center gap-1 rounded-[4px] border border-rule-2 px-2 py-1 text-left text-[13px] text-info hover:border-info disabled:cursor-default disabled:border-transparent disabled:text-ink-3">
              {bi(t.label)}{t.sheet !== sheet && <ArrowRight size={13} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
