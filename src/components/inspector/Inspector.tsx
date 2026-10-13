import { useMemo, useRef, type ReactNode } from 'react';
import { Anchor, ArrowLeft, ArrowRight, Lock, LockOpen, MousePointerClick, Play, Rewind } from 'lucide-react';
import { analyzeVertex } from '../../core/analysis/metrics';
import { fmtDeg, toDeg, toRad } from '../../core/geometry/angles';
import { creaseName } from '../../core/topology/names';
import { isCrease, type Assignment } from '../../core/topology/types';
import { DEG } from '../../core/numerics/tolerances';
import { engine } from '../../state/engine';
import { useModel } from '../../state/modelStore';
import { useSim } from '../../state/simulationStore';
import { useUI } from '../../state/uiStore';
import { animatePatternFold, applyParams, cancelPatternFold, driveSelected, foldDriveFully, patternFoldMode, patternFoldProgress, setPatternFold, pushHistory, setAssignment, setDriveEdge, setEnforceMV, setUseSymmetry, toggleLock } from '../../state/actions';
import { lessonById } from '../../curriculum/lessons';
import { ASSIGN_COLOR, ASSIGN_LABEL, AngleSlider, Badge, Button, KV, NumberField, Section, SpeedControl, Toggle, fmt } from '../controls/ui';
import { VerdictStrip } from './FeasibilityBoard';
import { layersFor } from '../viewport/layerCache';

/** Closure error in words: an exact rigid solution reads "≈ 0", the number stays in the tooltip. */
function Residual({ value }: { value: number }) {
  const exact = value < 1e-8;
  return <span title={`‖C‖ = ${fmt(value)}`}>{exact ? '≈ 0 (정확한 강체 해)' : fmt(value)}</span>;
}

/** Shown only when the rigid solver refused: what was asked, where it stopped, why. */
function SolverFailure() {
  const result = useSim((s) => s.result);
  const lessonId = useModel((s) => s.lessonId);
  const bagLesson = lessonById(lessonId)?.experiment === 'bagCollapse';
  const solverMode = useSim((s) => s.solverMode);
  if (solverMode !== 'rigid' || !result || result.success) return null;
  return (
    <div className="mt-3 rounded-[3px] border border-bad/40 bg-bad-soft px-3 py-2.5 text-[14px]" role="status">
      <Badge status="bad">강체 해 없음</Badge>
      <p className="mt-2 leading-relaxed text-ink">
        요청한 <span className="greek">ρ</span> = {fmtDeg(result.requestedAngle ?? 0, 1)} 에서 면을 변형하지 않는 배치를 찾지 못했다. 마지막으로 가능했던 <span className="greek">ρ</span> = {fmtDeg(result.reachedAngle ?? 0, 1)} 에서 멈췄다.
      </p>
      {result.reasons.length > 0 && (
        <ul className="mt-1.5 list-disc space-y-1 pl-5 leading-relaxed text-ink-2">
          {result.reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      )}
      <p className="mt-2 text-[13px] text-ink-3">형상은 바꾸지 않았다. 면이 휘는 것을 허용하려면 위의 <b className="text-ink">Energy</b> 솔버로 바꾼다.</p>
      {bagLesson && (
        <div className="mt-2.5 border-t border-dashed border-bad/30 pt-2.5">
          <p className="text-[13px] leading-relaxed text-ink-2">실제 종이백은 종이가 휘기 때문에 접힌다.</p>
          <Button kind="primary" className="mt-2" onClick={() => animatePatternFold(1)}>종이를 굽혀 납작하게 접기</Button>
        </div>
      )}
    </div>
  );
}

/** Iterations, rank and conditioning: for the curious, folded away by default. */
function SolverNumbers() {
  const result = useSim((s) => s.result);
  const solverMode = useSim((s) => s.solverMode);
  if (solverMode !== 'rigid' || !result) return null;
  return (
    <Section title="풀이 수치" foldable defaultOpen={false}>
      <KV k="닫힘 오차 ‖C‖" v={<Residual value={result.residualNorm} />} />
      <KV k="반복 횟수" v={result.iterations} />
      {result.jacobianRank !== undefined && <KV k="야코비안 계수 rank J" v={result.jacobianRank} />}
      {result.conditionEstimate !== undefined && Number.isFinite(result.conditionEstimate) && <KV k="조건수 κ (클수록 불안정)" v={fmt(result.conditionEstimate, 1)} />}
    </Section>
  );
}

function CreaseControls({ id }: { id: number }) {
  const rho = useSim((s) => s.rho);
  const drive = useSim((s) => s.drive);
  const target = useSim((s) => s.target);
  const locked = useSim((s) => s.locked);
  const solverMode = useSim((s) => s.solverMode);
  const dof = useSim((s) => s.dof);
  const isDrive = drive === id;
  const isLocked = locked.includes(id);
  const stuck = solverMode === 'rigid' && dof !== null && dof.dofLocal === 0;
  const value = isDrive ? target : rho[id] ?? 0;
  return (
    <>
      <div className="flex justify-between text-[13px]">
        <span className="inline-flex items-center gap-0.5" style={{ color: ASSIGN_COLOR.M }}><ArrowLeft size={13} />산접기 M</span>
        <span className="inline-flex items-center gap-0.5" style={{ color: ASSIGN_COLOR.V }}>골접기 V<ArrowRight size={13} /></span>
      </div>
      <AngleSlider value={value} onStart={() => { pushHistory(); if (!isDrive) setDriveEdge(id); }} onChange={(r) => driveSelected(id, r)} />
      <NumberField label="목표 접힘각 (도)" value={+toDeg(value).toFixed(3)} suffix="°" onCommit={(d) => { pushHistory(); driveSelected(id, toRad(d), true); }} />
      <div className="mt-1 grid grid-cols-5 gap-1">
        {[-90, -45, 0, 45, 90].map((d) => (
          <button key={d} type="button" className="tnum h-8 rounded-[3px] border border-rule-2 text-[13px] text-ink-2 hover:border-ink hover:text-ink" onClick={() => { pushHistory(); driveSelected(id, d * DEG, true); }}>{d > 0 ? '+' : ''}{d}°</button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <Button kind="primary" disabled={stuck} onClick={() => { if (!isDrive) setDriveEdge(id); foldDriveFully(); }}
          title={stuck ? '자유도 0: 이 배치에서는 강체로 움직일 방향이 없다' : '배정 방향으로 180°까지 접는다. 강체 해가 끝나는 곳에서 멈춘다.'}>
          <Play size={14} />끝까지 접기
        </Button>
        <Button onClick={() => { if (!isDrive) setDriveEdge(id); foldDriveFully(true); }} title="0°(평면)까지 되돌린다.">
          <Rewind size={14} />펴기
        </Button>
      </div>
      {stuck && <p className="mt-1.5 text-[13px] text-warn">자유도가 0이라 강체로는 움직이지 않는다. Energy 솔버에서는 면이 휘며 움직인다.</p>}
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <Button active={isDrive} onClick={() => setDriveEdge(isDrive ? null : id)}
          title="구동 크리스: 이 각도 하나를 정하면 나머지 접힘각은 폐합 조건으로 정해진다.">
          <Anchor size={15} />{isDrive ? '구동 중' : '구동하기'}
        </Button>
        <Button active={isLocked} onClick={() => toggleLock(id)} title="고정된 크리스는 풀이 중 현재 각을 유지한다.">
          {isLocked ? <Lock size={15} /> : <LockOpen size={15} />}{isLocked ? '고정됨' : '고정'}
        </Button>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
        {solverMode === 'rigid'
          ? '나머지 크리스는 폐합 조건으로 함께 접힌다. 화면에서 크리스를 직접 끌어도 된다.'
          : 'Energy: 이 크리스에 강한 비틀림 스프링을 걸고, 나머지는 에너지 최소화로 따라온다.'}
      </p>
    </>
  );
}

function CreaseInspector({ id, patternFold }: { id: number; patternFold: boolean }) {
  const model = useModel((s) => s.model)!;
  const rho = useSim((s) => s.rho);
  const drive = useSim((s) => s.drive);
  const effect = useSim((s) => s.effect);
  const solverMode = useSim((s) => s.solverMode);
  const e = model.edges[id];
  if (!e) return null;
  const name = creaseName(model, id);
  const labelled = name !== `e${id}`;
  const crease = isCrease(e.assignment);
  const boundary = e.faces[1] < 0;
  return (
    <>
      <div className="border-b border-rule-2 px-4 py-3">
        <div className="lettering text-[12px] text-ink-3">선택한 크리스</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className={`text-[22px] font-bold leading-tight text-ink ${labelled ? 'greek' : 'tnum'}`}>{name}</span>
          <span className="inline-flex items-center gap-1.5 text-[14px] text-ink-2">
            <span className="h-[3px] w-5 rounded" style={{ background: ASSIGN_COLOR[e.assignment] }} />{ASSIGN_LABEL[e.assignment]}
          </span>
          {drive === id && <span className="rounded-[3px] border border-ink px-1.5 text-[13px] font-semibold text-ink">구동 중</span>}
        </div>
        <div className="tnum mt-1 text-[13px] text-ink-3">{labelled && <>e{id} · </>}v{e.vertices[0]}–v{e.vertices[1]} · 길이 {e.restLength.toFixed(3)}</div>
        <div className="mt-2.5 flex items-baseline justify-between">
          <span className="text-[14px] text-ink-3">현재 접힘각 <span className="greek">ρ</span></span>
          <span className="tnum text-[22px] font-semibold leading-tight text-ink">{fmtDeg(rho[id] ?? 0, 1)}</span>
        </div>
        {e.referenceFoldAngle !== 0 && <KV k="기준 형상 ρ⁰" v={fmtDeg(e.referenceFoldAngle, 1)} />}
        {boundary && <p className="mt-1 text-[13px] text-ink-3">경계선은 접히지 않는다.</p>}
        <SolverFailure />
      </div>

      {crease && !boundary && (
        patternFold
          ? <Section title="이 크리스 하나만 움직이기" foldable defaultOpen={false}><CreaseControls id={id} /></Section>
          : <Section title="접힘각 조절"><CreaseControls id={id} /><SpeedControl className="mt-2 justify-between" /></Section>
      )}

      {!boundary && (
        <Section title="M/V 배정 바꾸기" foldable defaultOpen={false}>
          <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label="M/V 배정">
            {(['M', 'V', 'F', 'U'] as Assignment[]).map((a) => {
              const on = e.assignment === a;
              return (
                <button key={a} type="button" role="radio" aria-checked={on} onClick={() => setAssignment(id, a)} title={ASSIGN_LABEL[a]}
                  className={`flex h-11 flex-col items-center justify-center rounded-[4px] text-[13px] leading-tight transition-colors ${on ? 'bg-paper font-semibold text-ink shadow-[inset_0_0_0_1.5px_var(--color-ink)]' : 'border border-rule-2 text-ink-3 hover:border-ink-3 hover:text-ink'}`}>
                  <span className="h-[3px] w-6 rounded" style={{ background: ASSIGN_COLOR[a] }} />
                  <span className="mt-1">{ASSIGN_LABEL[a]}</span>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {effect.length > 0 && solverMode === 'rigid' && (
        <Section title={`함께 움직인 크리스 (${effect.length})`} foldable defaultOpen={false}>
          <table className="tnum w-full text-[13px]">
            <thead><tr className="text-ink-3"><th className="pb-1 text-left font-normal">크리스</th><th className="pb-1 text-right font-normal">이전</th><th className="pb-1 text-right font-normal">이후</th><th className="pb-1 text-right font-normal">변화</th></tr></thead>
            <tbody>
              {effect.map((x) => {
                const n = creaseName(model, x.edge);
                const d = toDeg(x.after - x.before);
                return (
                  <tr key={x.edge} className="cursor-pointer border-t border-rule hover:bg-paper-2" onClick={() => useUI.getState().select({ kind: 'edge', id: x.edge })}>
                    <td className="py-1" style={{ color: ASSIGN_COLOR[model.edges[x.edge].assignment] }}><span className={n.startsWith('e') ? '' : 'greek'}>{n}</span></td>
                    <td className="py-1 text-right text-ink-3">{toDeg(x.before).toFixed(1)}°</td>
                    <td className="py-1 text-right text-ink">{toDeg(x.after).toFixed(1)}°</td>
                    <td className="py-1 text-right font-medium text-ink-2">{Math.abs(d) < 0.005 ? '0.00' : (d > 0 ? '+' : '') + d.toFixed(2)}°</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>
      )}
      <SolverNumbers />
    </>
  );
}

function VertexInspector({ id }: { id: number }) {
  const model = useModel((s) => s.model)!;
  const modelVersion = useModel((s) => s.modelVersion);
  const rho = useSim((s) => s.rho);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const r = useMemo(() => analyzeVertex(model, id), [model, id, modelVersion]);
  const v = model.vertices[id];
  const sumIs360 = Math.abs(r.generalized.total - 2 * Math.PI) < 1e-6;
  return (
    <>
      <div className="border-b border-rule-2 px-4 py-3">
        <div className="lettering text-[12px] text-ink-3">선택한 꼭짓점</div>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="tnum text-[22px] font-bold leading-tight text-ink">v{id}</span>
          <span className="text-[14px] text-ink-3">{v.boundary ? '경계 꼭짓점' : '내부 꼭짓점'}</span>
        </div>
      </div>
      <Section title="꼭짓점 조건">
        {!r.interior ? <p className="text-[14px] text-ink-3">평탄 접힘 조건은 내부 꼭짓점에만 적용된다.</p> : r.edges.length === 0 ? <p className="text-[14px] text-ink-3">이 꼭짓점에는 접히는 크리스가 없다.</p> : (
          <>
            <ul className="space-y-1.5 text-[14px]">
              <li className="flex items-center justify-between gap-2">
                <span className="text-ink-2">Kawasaki (교대합 = 0)</span>
                <Badge status={r.kawasaki.satisfied ? 'ok' : sumIs360 ? 'bad' : 'na'}>{r.kawasaki.satisfied ? '성립' : sumIs360 ? '위반' : '해당 없음'}</Badge>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="text-ink-2">일반화 Kawasaki (A ∈ {'{0, ±360°}'})</span>
                <Badge status={r.generalized.satisfied ? 'ok' : 'bad'}>{r.generalized.windingClass === null ? '위반' : r.generalized.windingClass === 0 ? 'A = 0' : r.generalized.windingClass > 0 ? 'A = +360°' : 'A = −360°'}</Badge>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="text-ink-2">Maekawa (M − V = {r.generalizedMaekawa.expected})</span>
                <Badge status={r.generalizedMaekawa.satisfied ? 'ok' : 'bad'}>{r.generalizedMaekawa.satisfied ? '성립' : `위반 (${r.maekawa.M}−${r.maekawa.V})`}</Badge>
              </li>
              {r.mvCheck && (
                <li className="flex items-center justify-between gap-2">
                  <span className="text-ink-2">M/V 배정 (크림프 검사)</span>
                  <Badge status={r.mvCheck.valid ? 'ok' : 'bad'}>{r.mvCheck.valid ? '유효' : '무효'}</Badge>
                </li>
              )}
            </ul>
            {r.mvCheck && !r.mvCheck.valid && <p className="mt-1.5 text-[13px] text-bad">{r.mvCheck.reason}</p>}
            <p className="mt-2 text-[13px] leading-relaxed text-ink-3">Kawasaki와 Maekawa는 필요조건이다. M/V 배정이 실제로 평탄하게 접히는지는 크림프 검사가 판정한다.</p>
          </>
        )}
      </Section>
      {r.interior && r.edges.length > 0 && (
        <Section title="섹터 각과 접힘각" foldable defaultOpen={false}>
          <table className="tnum w-full text-[13px]">
            <thead><tr className="text-ink-3"><th className="pb-1 text-left font-normal">i</th><th className="pb-1 text-left font-normal">크리스</th><th className="pb-1 text-left font-normal">M/V</th><th className="pb-1 text-right font-normal"><span className="greek">θ</span>ᵢ</th><th className="pb-1 text-right font-normal">현재 <span className="greek">ρ</span></th></tr></thead>
            <tbody>
              {r.edges.map((eid, i) => {
                const n = creaseName(model, eid);
                return (
                  <tr key={eid} className="cursor-pointer border-t border-rule hover:bg-paper-2" onClick={() => useUI.getState().select({ kind: 'edge', id: eid })}
                    onMouseEnter={() => useUI.getState().setTheoryHover(`θ${i + 1}`)} onMouseLeave={() => useUI.getState().setTheoryHover(null)}>
                    <td className="py-1 text-ink-3">{i + 1}</td>
                    <td className={`py-1 ${n.startsWith('e') ? '' : 'greek'}`}>{n}</td>
                    <td className="py-1 font-semibold" style={{ color: ASSIGN_COLOR[r.assignments[i]] }}>{r.assignments[i]}</td>
                    <td className="py-1 text-right">{toDeg(r.sectors[i]).toFixed(2)}°</td>
                    <td className="py-1 text-right text-ink-2">{fmtDeg(rho[eid] ?? 0, 1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-2">
            <KV k={<>섹터 각 합 Σ<span className="greek">θ</span></>} v={`${toDeg(r.generalized.total).toFixed(2)}°`} />
            <KV k="교대합 A = Σodd − Σeven" v={`${toDeg(r.generalized.alternating).toFixed(2)}°`} />
          </div>
        </Section>
      )}
    </>
  );
}

function FaceInspector({ id }: { id: number }) {
  const model = useModel((s) => s.model)!;
  const f = model.faces[id];
  return (
    <>
      <div className="border-b border-rule-2 px-4 py-3">
        <div className="lettering text-[12px] text-ink-3">선택한 면</div>
        <div className="tnum mt-0.5 text-[22px] font-bold leading-tight text-ink">f{id}</div>
      </div>
      <Section title="면 정보">
        <KV k="꼭짓점" v={f.vertices.map((v) => 'v' + v).join(' ')} />
        <KV k="면적" v={f.area.toFixed(4)} />
        <KV k="기준면 (강체 풀이의 고정 면)" v={(engine.rigid?.sys.tree.baseFace ?? -1) === id ? '예' : '아니오'} mono={false} />
      </Section>
    </>
  );
}

function ModelSummary() {
  const model = useModel((s) => s.model)!;
  const enforceMV = useSim((s) => s.enforceMV);
  const useSymmetry = useSim((s) => s.useSymmetry);
  const drive = useSim((s) => s.drive);
  const locked = useSim((s) => s.locked);
  return (
    <Section title="모델 정보와 솔버 옵션" foldable defaultOpen={false}>
      <div className="text-[15px] font-semibold text-ink">{model.metadata.name}</div>
      <p className="mb-2 text-[13px] text-ink-3">{model.metadata.description}</p>
      <KV k="꼭짓점 / 모서리 / 면" v={`${model.vertices.length} / ${model.edges.length} / ${model.faces.length}`} />
      <KV k="접히는 크리스" v={model.edges.filter((e) => e.faces[1] >= 0 && isCrease(e.assignment)).length} />
      <KV k="기준 형상" v={model.metadata.developable ? '평면 종이' : '3D 조립체'} mono={false} />
      <KV k="구동 크리스" v={drive === null ? '없음' : creaseName(model, drive)} />
      <KV k="고정" v={locked.length ? locked.map((l) => creaseName(model, l)).join(', ') : '없음'} />
      <div className="mt-2">
        <Toggle checked={enforceMV} onChange={setEnforceMV} label="M/V 배정 준수 (Rigid)" title="M 크리스는 ρ ≤ 0, V 크리스는 ρ ≥ 0" />
        {model.edu.symmetryLinks.length > 0 && <Toggle checked={useSymmetry} onChange={setUseSymmetry} label={`대칭 구속 (${model.edu.symmetryLinks.length})`} />}
      </div>
    </Section>
  );
}

/** Per-pattern wording and sizes of the whole-pattern fold card. */
const PATTERN_FOLD: Record<string, { title: string; text: ReactNode; from: string; to: string; fold: string; unfold: string; sizes?: number[] }> = {
  miura: {
    title: '패턴 전체 접기 · 미우라',
    text: <>자유도 <b className="text-ink">1</b>의 기구다. 크리스 하나의 각만 정하면 나머지가 모두 정확히 따라 접힌다. 모든 단계가 강체 해다 (Rigid).</>,
    from: '평면', to: '완전 접힘', fold: '전체 접기', unfold: '펼치기', sizes: [3, 5, 7],
  },
  waterbomb: {
    title: '패턴 전체 접기 · 워터밤',
    text: <>크리스 하나로는 접히지 않는다. 모든 크리스를 <b className="text-ink">함께</b> 완전 접힘각으로 옮기며 매 단계 평형을 푼다 (Energy). 중간에는 면이 조금 휜다.</>,
    from: '평면', to: '완전 접힘', fold: '전체 접기', unfold: '펼치기', sizes: [3, 4, 6],
  },
  shoppingBag: {
    title: '쇼핑백 접기',
    text: <>모든 크리스가 <b className="text-ink">동시에</b> 접히고, 그 사이 종이 면이 휘어야 한다. 면을 강체로 두면 이 경로가 없다는 것이 이 정리다 (Energy).</>,
    from: '열림', to: '납작', fold: '납작하게 접기', unfold: '다시 펼치기',
  },
};

/**
 * The one primary way to fold this sheet: a 1-DoF pattern (Miura) through its
 * driving crease, a non-mechanism (waterbomb, shopping bag) by moving every
 * crease together in the energy model.
 */
function PatternFoldCard({ mode }: { mode: 'rigid' | 'energy' }) {
  const generator = useModel((s) => s.generator) ?? '';
  const params = useModel((s) => s.params) as Record<string, number>;
  const model = useModel((s) => s.model)!;
  useSim((s) => s.rho); // re-render while the pattern moves
  const stateFold = useSim((s) => s.stateFold);
  const peak = useSim((s) => s.stateFoldPeak);
  const solverMode = useSim((s) => s.solverMode);
  const result = useSim((s) => s.result);
  const maxStrain = useSim((s) => s.maxStrain);
  const collisions = useSim((s) => s.collisionCount);
  const p = mode === 'rigid' ? patternFoldProgress() : stateFold;
  const cfg = PATTERN_FOLD[generator] ?? PATTERN_FOLD.shoppingBag;
  const pending = useRef<number | null>(null);
  const raf = useRef(0);
  const onSlide = (v: number) => {
    cancelPatternFold();
    pending.current = v;
    if (!raf.current) raf.current = requestAnimationFrame(() => { raf.current = 0; if (pending.current !== null) setPatternFold(pending.current); pending.current = null; });
  };
  const layers = layersFor(model).tracker;
  const stack = layers.stacked ? layers.sheetsAtPoint : 1;
  const resize = (n: number) => {
    const keep = p;
    applyParams({ rows: n, cols: n });
    useSim.setState({ stateFold: 0, stateFoldPeak: 0 });
    if (keep > 0) animatePatternFold(keep, 1800);
  };
  return (
    <section aria-label={cfg.title} className="border-b border-rule-2 px-4 pb-4 pt-3.5">
      <h3 className="text-[15px] font-semibold text-ink">{cfg.title}</h3>
      <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{cfg.text}</p>
      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-[14px] text-ink-2">접힘 진행률</span>
        <span className="tnum text-[22px] font-semibold leading-none text-ink">{Math.round(p * 100)}%</span>
      </div>
      <input type="range" className="mt-1.5 w-full" min={0} max={1} step={0.005} value={p} aria-label="패턴 전체 접힘 진행률"
        onChange={(e) => onSlide(parseFloat(e.target.value))} />
      <div className="flex justify-between text-[13px] text-ink-3"><span>{cfg.from}</span><span>{cfg.to}</span></div>
      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
        <Button kind="primary" onClick={() => animatePatternFold(1)}><Play size={14} />{cfg.fold}</Button>
        <Button onClick={() => animatePatternFold(0)}><Rewind size={14} />{cfg.unfold}</Button>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <SpeedControl />
        {cfg.sizes && (
          <div className="flex items-center gap-1.5">
            <span className="lettering shrink-0 text-[12px] text-ink-3">크기</span>
            <div role="radiogroup" aria-label="패턴 크기" className="flex rounded-[3px] border border-rule-2 bg-paper-2 p-0.5">
              {cfg.sizes.map((n) => (
                <button key={n} type="button" role="radio" aria-checked={params.rows === n && params.cols === n} onClick={() => resize(n)}
                  className={`tnum h-7 whitespace-nowrap rounded-[2px] px-2 text-[13px] transition-colors ${params.rows === n && params.cols === n ? 'bg-paper text-ink font-semibold shadow-[inset_0_0_0_1.5px_var(--color-ink)]' : 'text-ink-2 hover:bg-paper hover:text-ink'}`}>
                  {n}×{n}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="mt-2.5 border-t border-dashed border-rule-2 pt-1.5">
        {mode === 'rigid' && result && <KV k="닫힘 오차" v={<Residual value={result.residualNorm} />} />}
        {mode === 'energy' && solverMode === 'energy' && p > 0 && (
          <KV k="면 늘어남 (지금 / 경로 중 최대)" v={`${(maxStrain * 100).toFixed(1)}% / ${(Math.max(peak, maxStrain) * 100).toFixed(1)}%`} />
        )}
        {stack > 1 && <KV k="한 지점에 겹친 종이" v={`최대 ${stack}장`} />}
        {mode === 'energy' && collisions > 0 && (
          <p className="mt-1.5 rounded-[3px] border border-warn/40 bg-warn-soft px-2.5 py-1.5 text-[13px] leading-relaxed text-ink-2">
            <b className="text-ink">자기 교차 {collisions}쌍:</b> 이 구간에서는 종이가 잠깐 서로를 통과한다. 면 수가 적은 이 모델은 면을 크게 늘리지 않고는 이 구간을 지날 수 없다. 솔버에 접촉 모델은 없다.
          </p>
        )}
        {mode === 'energy' && <p className="mt-1 text-[13px] leading-relaxed text-ink-3">막대-힌지 모델로 각 단계의 평형을 푼 결과다. 처음과 완전 접힘에서는 변형이 0이고, 중간에서만 면이 휜다.</p>}
      </div>
    </section>
  );
}

export function Inspector() {
  const model = useModel((s) => s.model);
  const selection = useUI((s) => s.selection);
  const lessonId = useModel((s) => s.lessonId);
  useModel((s) => s.modelVersion); // re-evaluate the pattern-fold mode when the model changes
  const foldMode = lessonId ? patternFoldMode() : null;
  if (!model) return <div className="p-4 text-[14px] text-ink-3">이 레슨은 전용 실습 화면을 사용한다.</div>;
  return (
    <div className="stable-gutter h-full overflow-y-auto">
      <VerdictStrip />
      {foldMode && <PatternFoldCard mode={foldMode} />}
      {selection?.kind === 'edge' && model.edges[selection.id] && <CreaseInspector id={selection.id} patternFold={!!foldMode} />}
      {selection?.kind === 'vertex' && model.vertices[selection.id] && <VertexInspector id={selection.id} />}
      {selection?.kind === 'face' && model.faces[selection.id] && <FaceInspector id={selection.id} />}
      {!selection && (
        <div className="flex gap-3 border-b border-rule-2 px-4 py-4 text-[14px] leading-relaxed text-ink-2">
          <MousePointerClick size={20} className="mt-0.5 shrink-0 text-ink-3" />
          <p>3D 또는 전개도에서 <b className="text-ink">크리스</b>를 누르면 접힘각을 보고 직접 접을 수 있다. <b className="text-ink">꼭짓점</b>을 누르면 Kawasaki·Maekawa 조건을 검사한다.</p>
        </div>
      )}
      <ModelSummary />
    </div>
  );
}
