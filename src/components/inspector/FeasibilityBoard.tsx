import { AlertTriangle, Check, ChevronDown, Info, Minus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { analyzeVertex } from '../../core/analysis/metrics';
import type { OrigamiModel } from '../../core/topology/types';
import { lessonById } from '../../curriculum/lessons';
import { useModel } from '../../state/modelStore';
import { useSim } from '../../state/simulationStore';
import { Badge, type Status } from '../controls/ui';
import { plainNum } from '../analysis/num';
import { Rich } from '../controls/Rich';
import { tr } from '../../i18n';

export interface FlatFoldSummary {
  checked: number;
  failing: number[];
  ok: boolean;
  /** vertices where only Maekawa fails (Kawasaki/generalized ok) */
  maekawaOnly: number[];
}

export function flatFoldSummary(model: OrigamiModel): FlatFoldSummary {
  const failing: number[] = [];
  const maekawaOnly: number[] = [];
  let checked = 0;
  for (const v of model.vertices) {
    if (v.boundary) continue;
    const r = analyzeVertex(model, v.id);
    if (r.edges.length === 0) continue; // vertex inside a flat region (only F creases)
    checked++;
    const geomOk = r.generalized.satisfied;
    const countOk = r.generalizedMaekawa.satisfied;
    const mvOk = r.mvCheck ? r.mvCheck.valid : countOk;
    if (!(geomOk && countOk && mvOk)) failing.push(v.id);
    if (geomOk && !countOk) maekawaOnly.push(v.id);
  }
  return { checked, failing, ok: failing.length === 0 && checked > 0, maekawaOnly };
}

interface VerdictRow {
  key: string;
  /** short label for the strip */
  label: string;
  /** what the stamp says — the word matches the question (성립, 있음, 없음 …) */
  word: string;
  status: Status;
  /** the measured value behind it */
  detail: string;
  /** one sentence: what this row checks */
  explain: string;
}

/**
 * The five separate properties of the current state. They are never merged
 * into one "valid origami" label: flat-foldable, infinitesimally mobile,
 * currently rigid-feasible, collision-free and elastically feasible are
 * different statements.
 */
function useVerdict(): { rows: VerdictRow[]; maekawaOnly: number } | null {
  const model = useModel((s) => s.model);
  const modelVersion = useModel((s) => s.modelVersion);
  const result = useSim((s) => s.result);
  const dof = useSim((s) => s.dof);
  const collisions = useSim((s) => s.collisionCount);
  const solverMode = useSim((s) => s.solverMode);
  const maxStrain = useSim((s) => s.maxStrain);
  const diverged = useSim((s) => s.diverged);
  const shownState = useSim((s) => s.shownState);
  const generator = useModel((s) => s.generator);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ff = useMemo(() => (model ? flatFoldSummary(model) : null), [model, modelVersion]);
  if (!model || !ff) return null;
  const rigid = solverMode === 'rigid';
  const rigidStatus: Status = !rigid ? 'na' : shownState ? 'ok' : !result ? (dof ? 'ok' : 'na') : result.success ? 'ok' : 'bad';
  // The (tall) shopping bag is rigid: its open shape is a solution, but an isolated one. A bare green
  // "있음" next to the theorem would read as "it folds", so the stamp says which solution it means.
  const isolated = generator === 'shoppingBag' && rigidStatus === 'ok';
  const rows: VerdictRow[] = [
    {
      key: 'flat', label: tr('평탄 접힘 조건', 'Flat-fold conditions'),
      status: ff.checked === 0 ? 'na' : ff.ok ? 'ok' : 'bad',
      word: ff.checked === 0 ? tr('해당 없음', 'n/a') : ff.ok ? tr('성립', 'holds') : tr('위반', 'violated'),
      detail: ff.checked ? tr(`${ff.checked - ff.failing.length}/${ff.checked} 꼭짓점`, `${ff.checked - ff.failing.length}/${ff.checked} vertices`) : tr('내부 꼭짓점 없음', 'no interior vertices'),
      explain: tr('모든 내부 꼭짓점에서 Kawasaki(교대합)·Maekawa·크림프 검사. 평탄하게 접히기 위한 필요조건이다.', 'Kawasaki (alternating sum), Maekawa and crimp checks at every interior vertex. Necessary conditions for folding flat.'),
    },
    {
      key: 'rigid', label: tr('현재 강체 해', 'Current rigid solution'),
      status: rigidStatus,
      word: isolated ? tr('있음 (지금 이 모양만)', 'yes (this shape only)')
        : !rigid ? tr('Rigid에서', 'in Rigid') : shownState ? tr('있음', 'yes') : !result ? (dof ? tr('있음', 'yes') : '—') : result.success ? tr('있음', 'yes') : tr('없음', 'none'),
      detail: rigid && result ? (result.residualNorm < 1e-8 ? tr('닫힘 오차 ≈ 0', 'closure error ≈ 0') : tr(`닫힘 오차 ${plainNum(result.residualNorm)}`, `closure error ${plainNum(result.residualNorm)}`)) : '',
      explain: tr('지금 요청한 접힘각에서 면을 변형하지 않고 모든 꼭짓점이 닫히는 배치가 있는가.', 'Is there a configuration at the requested fold angles where every vertex closes without deforming the facets?'),
    },
    {
      key: 'mobility', label: tr('1차(무한소) 가동성', 'First-order (infinitesimal) mobility'),
      status: !rigid || !dof ? 'na' : dof.dofLocal > 0 ? 'info' : 'warn',
      word: !rigid || !dof ? tr('Rigid에서', 'in Rigid') : dof.dofLocal > 0 ? tr(`있음 (${dof.dofLocal})`, `yes (${dof.dofLocal})`) : tr('없음 (0)', 'none (0)'),
      detail: rigid && dof ? `$N - \\operatorname{rank} J = ${dof.dofLocal}$` : '',
      explain: tr('현재 배치에서 아주 조금 움직일 수 있는 방향의 수. 있다고 해서 끝까지 접힌다는 뜻은 아니다.', 'The number of directions the current configuration can move a tiny amount. Having some does not mean it folds all the way.'),
    },
    {
      key: 'collide', label: tr('자기 교차', 'Self-intersection'),
      status: collisions === 0 ? 'ok' : 'bad',
      word: collisions === 0 ? tr('없음', 'none') : tr(`있음 (${collisions}쌍)`, `yes (${collisions} pairs)`),
      detail: '',
      explain: tr('서로 이웃하지 않은 면이 관통하는가. 겹쳐 맞닿은 층은 교차로 세지 않는다.', 'Do non-adjacent facets pass through each other? Stacked layers that touch do not count as intersections.'),
    },
    {
      key: 'elastic', label: tr('면 변형 (Energy)', 'Facet deformation (Energy)'),
      status: rigid ? 'na' : diverged ? 'bad' : maxStrain < 0.02 ? 'ok' : maxStrain < 0.08 ? 'warn' : 'bad',
      word: rigid ? tr('Energy에서', 'in Energy') : diverged ? tr('발산', 'diverged') : maxStrain < 0.02 ? tr('작음', 'small') : maxStrain < 0.08 ? tr('보통', 'medium') : tr('큼', 'large'),
      detail: rigid ? '' : tr(`최대 변형률 ${(maxStrain * 100).toFixed(1)}%`, `max strain ${(maxStrain * 100).toFixed(1)}%`),
      explain: tr('Energy 솔버에서 면이 얼마나 늘어났는가 (막대 길이 변화율).', 'How much the facets stretched in the Energy solver (relative change in bar length).'),
    },
  ];
  return { rows, maekawaOnly: ff.maekawaOnly.length };
}

const SUMMARY_ICON: Record<Status, typeof Check> = { ok: Check, info: Info, warn: AlertTriangle, bad: X, na: Minus };
const SUMMARY_TONE: Record<Status, string> = { ok: 'text-ok', info: 'text-info', warn: 'text-warn', bad: 'text-bad', na: 'text-ink-3' };
const SUMMARY_WORD: Record<Status, () => string> = {
  ok: () => tr('통과', 'pass'), info: () => tr('참고', 'note'), warn: () => tr('주의', 'caution'), bad: () => tr('실패', 'fail'), na: () => tr('해당 없음', 'n/a'),
};

/**
 * The verdict: one stamp per property with a word that answers its own
 * question, a lesson note when the lesson needs one, and the details on
 * demand. On the desktop it is pinned at the top of the inspector. On a phone
 * it sits under the fold card as one summary row (counts per stamp kind) that
 * opens to the same five separate rows with their evidence; the lesson note
 * comes first there, so a theorem is read before the stamps.
 */
export function VerdictStrip({ phone = false }: { phone?: boolean } = {}) {
  const v = useVerdict();
  const lessonId = useModel((s) => s.lessonId);
  const note = lessonById(lessonId)?.verdictNote;
  const [open, setOpen] = useState(false);
  if (!v) return null;
  const noteEl = note && <p className={`rounded-[3px] bg-paper-2 px-2.5 py-1.5 text-[13px] leading-relaxed text-ink-2 ${phone ? 'mb-2' : 'mt-2'}`}><Rich text={note} /></p>;
  const maekawa = v.maekawaOnly > 0 && <p className="text-[13px] text-warn">{tr(`꼭짓점 ${v.maekawaOnly}개에서 Kawasaki는 성립하지만 Maekawa가 실패한다 → 이 꼭짓점들은 평탄하게 접히지 않는다.`, `At ${v.maekawaOnly} vertices Kawasaki holds but Maekawa fails → these vertices do not fold flat.`)}</p>;
  if (phone) {
    const order: Status[] = ['ok', 'info', 'warn', 'bad', 'na'];
    const counts = order.map((st) => [st, v.rows.filter((r) => r.status === st).length] as const).filter(([, n]) => n > 0);
    const spoken = counts.map(([st, n]) => `${SUMMARY_WORD[st]()} ${n}`).join(', ');
    return (
      <section aria-label={tr('판정', 'Verdict')} className="border-b border-rule-2 px-4 pb-2 pt-3">
        {noteEl}
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}
          aria-label={`${tr('판정', 'Verdict')}: ${spoken}. ${open ? tr('근거 접기', 'Hide evidence') : tr('근거 보기', 'Show evidence')}`}
          className="-mx-2 flex min-h-11 w-[calc(100%+16px)] items-center gap-2 rounded-[4px] px-2 text-left hover:bg-paper-2">
          <span className="lettering text-[12px] text-ink-3">{tr('판정', 'Verdict')}</span>
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-0.5" aria-hidden>
            {counts.map(([st, n]) => {
              const Icon = SUMMARY_ICON[st];
              return <span key={st} className={`tnum inline-flex items-center gap-0.5 text-[14px] font-semibold ${SUMMARY_TONE[st]}`}><Icon size={14} strokeWidth={2.75} />{n}</span>;
            })}
          </span>
          <span className="flex shrink-0 items-center gap-0.5 border-l border-rule pl-2.5 text-[13px] text-ink-2" aria-hidden>
            {open ? tr('근거 접기', 'Hide evidence') : tr('근거 보기', 'Show evidence')}<ChevronDown size={15} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </span>
        </button>
        {open && (
          <ul className="mt-1 space-y-2.5 border-t border-dashed border-rule-2 pb-1 pt-2.5">
            {v.rows.map((r) => (
              <li key={r.key}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`min-w-0 text-[14px] leading-snug ${r.status === 'na' ? 'text-ink-3' : 'text-ink-2'}`}>{r.label}</span>
                  <Badge key={r.status + r.word} status={r.status}>{r.word}</Badge>
                </div>
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-3">
                  {r.detail && <span className="tnum mr-1.5 text-ink-2"><Rich text={r.detail} /></span>}{r.explain}
                </p>
              </li>
            ))}
            {maekawa && <li>{maekawa}</li>}
          </ul>
        )}
      </section>
    );
  }
  return (
    <section aria-label={tr('판정', 'Verdict')} className="sticky top-0 z-10 border-b border-rule-2 bg-paper/95 px-4 pb-2.5 pt-3 backdrop-blur-[2px]">
      <div className="flex items-center justify-between">
        <h3 className="lettering text-[12px] text-ink-3">{tr('판정', 'Verdict')}</h3>
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex items-center gap-0.5 rounded px-1 text-[13px] text-ink-3 hover:bg-paper-2 hover:text-ink">
          {open ? tr('근거 접기', 'Hide evidence') : tr('근거 보기', 'Show evidence')}<ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      <ul className="mt-1.5 grid grid-cols-1 gap-x-3 gap-y-1 min-[1500px]:grid-cols-2">
        {v.rows.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-2" title={r.explain}>
            <span className={`min-w-0 text-[14px] leading-snug ${r.status === 'na' ? 'text-ink-3' : 'text-ink-2'}`}>{r.label}</span>
            <Badge key={r.status + r.word} status={r.status}>{r.word}</Badge>
          </li>
        ))}
      </ul>
      {noteEl}
      {open && (
        <dl className="mt-2 space-y-1.5 border-t border-dashed border-rule-2 pt-2 text-[13px]">
          {v.rows.map((r) => (
            <div key={r.key}>
              <dt className="flex justify-between gap-2 text-ink"><span className="font-medium">{r.label}</span><span className="tnum shrink-0 text-ink-3"><Rich text={r.detail} /></span></dt>
              <dd className="text-ink-3">{r.explain}</dd>
            </div>
          ))}
          {maekawa}
        </dl>
      )}
    </section>
  );
}
