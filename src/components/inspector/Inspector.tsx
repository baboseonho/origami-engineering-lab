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
import { TUBE_SYMMETRY_NOTE } from '../../models/generators/waterbombTube';
import { ASSIGN_COLOR, ASSIGN_LABEL, AngleSlider, Badge, Button, KV, NumberField, Section, SpeedControl, Toggle, fmt } from '../controls/ui';
import { VerdictStrip } from './FeasibilityBoard';
import { layersFor } from '../viewport/layerCache';
import { getLang, tr } from '../../i18n';

/** Closure error in words: an exact rigid solution reads "≈ 0", the number stays in the tooltip. */
function Residual({ value }: { value: number }) {
  const exact = value < 1e-8;
  return <span title={`‖C‖ = ${fmt(value)}`}>{exact ? tr('≈ 0 (정확한 강체 해)', '≈ 0 (exact rigid solution)') : fmt(value)}</span>;
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
      <Badge status="bad">{tr('강체 해 없음', 'no rigid solution')}</Badge>
      <p className="mt-2 leading-relaxed text-ink">
        {tr(<>요청한 <span className="greek">ρ</span> = {fmtDeg(result.requestedAngle ?? 0, 1)} 에서 면을 변형하지 않는 배치를 찾지 못했다. 마지막으로 가능했던 <span className="greek">ρ</span> = {fmtDeg(result.reachedAngle ?? 0, 1)} 에서 멈췄다.</>,
          <>No configuration without facet deformation was found at the requested <span className="greek">ρ</span> = {fmtDeg(result.requestedAngle ?? 0, 1)}. Stopped at <span className="greek">ρ</span> = {fmtDeg(result.reachedAngle ?? 0, 1)}, the last reachable angle.</>)}
      </p>
      {result.reasons.length > 0 && (
        <ul className="mt-1.5 list-disc space-y-1 pl-5 leading-relaxed text-ink-2">
          {result.reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      )}
      <p className="mt-2 text-[13px] text-ink-3">{tr(<>형상은 바꾸지 않았다. 면이 휘는 것을 허용하려면 위의 <b className="text-ink">Energy</b> 솔버로 바꾼다.</>, <>The shape was left unchanged. To let the facets bend, switch to the <b className="text-ink">Energy</b> solver above.</>)}</p>
      {bagLesson && (
        <div className="mt-2.5 border-t border-dashed border-bad/30 pt-2.5">
          <p className="text-[13px] leading-relaxed text-ink-2">{tr('실제 종이백은 종이가 휘기 때문에 접힌다.', 'A real paper bag folds because the paper bends.')}</p>
          <Button kind="primary" className="mt-2" onClick={() => animatePatternFold(1)}>{tr('종이를 굽혀 납작하게 접기', 'Bend the paper and fold flat')}</Button>
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
    <Section title={tr('풀이 수치', 'Solver numbers')} foldable defaultOpen={false}>
      <KV k={tr('닫힘 오차 ‖C‖', 'Closure error ‖C‖')} v={<Residual value={result.residualNorm} />} />
      <KV k={tr('반복 횟수', 'Iterations')} v={result.iterations} />
      {result.jacobianRank !== undefined && <KV k={tr('야코비안 계수 rank J', 'Jacobian rank J')} v={result.jacobianRank} />}
      {result.conditionEstimate !== undefined && Number.isFinite(result.conditionEstimate) && <KV k={tr('조건수 κ (클수록 불안정)', 'Condition number κ (larger = less stable)')} v={fmt(result.conditionEstimate, 1)} />}
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
        <span className="inline-flex items-center gap-0.5" style={{ color: ASSIGN_COLOR.M }}><ArrowLeft size={13} />{tr('산접기 M', 'Mountain M')}</span>
        <span className="inline-flex items-center gap-0.5" style={{ color: ASSIGN_COLOR.V }}>{tr('골접기 V', 'Valley V')}<ArrowRight size={13} /></span>
      </div>
      <AngleSlider value={value} onStart={() => { pushHistory(); if (!isDrive) setDriveEdge(id); }} onChange={(r) => driveSelected(id, r)} />
      <NumberField label={tr('목표 접힘각 (도)', 'Target fold angle (degrees)')} value={+toDeg(value).toFixed(3)} suffix="°" onCommit={(d) => { pushHistory(); driveSelected(id, toRad(d), true); }} />
      <div className="mt-1 grid grid-cols-5 gap-1">
        {[-90, -45, 0, 45, 90].map((d) => (
          <button key={d} type="button" className="tnum h-8 rounded-[3px] border border-rule-2 text-[13px] text-ink-2 hover:border-ink hover:text-ink" onClick={() => { pushHistory(); driveSelected(id, d * DEG, true); }}>{d > 0 ? '+' : ''}{d}°</button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <Button kind="primary" disabled={stuck} onClick={() => { if (!isDrive) setDriveEdge(id); foldDriveFully(); }}
          title={stuck ? tr('자유도 0: 이 배치에서는 강체로 움직일 방향이 없다', 'DoF 0: this configuration has no rigid direction to move') : tr('배정 방향으로 180°까지 접는다. 강체 해가 끝나는 곳에서 멈춘다.', 'Folds to 180° along the assignment. Stops where the rigid solution ends.')}>
          <Play size={14} />{tr('끝까지 접기', 'Fold fully')}
        </Button>
        <Button onClick={() => { if (!isDrive) setDriveEdge(id); foldDriveFully(true); }} title={tr('0°(평면)까지 되돌린다.', 'Returns to 0° (flat).')}>
          <Rewind size={14} />{tr('펴기', 'Unfold')}
        </Button>
      </div>
      {stuck && <p className="mt-1.5 text-[13px] text-warn">{tr('자유도가 0이라 강체로는 움직이지 않는다. Energy 솔버에서는 면이 휘며 움직인다.', 'DoF is 0, so it does not move rigidly. In the Energy solver it moves as the facets bend.')}</p>}
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <Button active={isDrive} onClick={() => setDriveEdge(isDrive ? null : id)}
          title={tr('구동 크리스: 이 각도 하나를 정하면 나머지 접힘각은 폐합 조건으로 정해진다.', 'Driving crease: set this one angle and the closure conditions fix the other fold angles.')}>
          <Anchor size={15} />{isDrive ? tr('구동 중', 'Driving') : tr('구동하기', 'Drive')}
        </Button>
        <Button active={isLocked} onClick={() => toggleLock(id)} title={tr('고정된 크리스는 풀이 중 현재 각을 유지한다.', 'A locked crease keeps its current angle while solving.')}>
          {isLocked ? <Lock size={15} /> : <LockOpen size={15} />}{isLocked ? tr('고정됨', 'Locked') : tr('고정', 'Lock')}
        </Button>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
        {solverMode === 'rigid'
          ? tr('나머지 크리스는 폐합 조건으로 함께 접힌다. 화면에서 크리스를 직접 끌어도 된다.', 'The other creases fold along through the closure conditions. You can also drag a crease on screen.')
          : tr('Energy: 이 크리스에 강한 비틀림 스프링을 걸고, 나머지는 에너지 최소화로 따라온다.', 'Energy: a stiff torsion spring holds this crease, and the rest follow by energy minimization.')}
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
        <div className="lettering text-[12px] text-ink-3">{tr('선택한 크리스', 'Selected crease')}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className={`text-[22px] font-bold leading-tight text-ink ${labelled ? 'greek' : 'tnum'}`}>{name}</span>
          <span className="inline-flex items-center gap-1.5 text-[14px] text-ink-2">
            <span className="h-[3px] w-5 rounded" style={{ background: ASSIGN_COLOR[e.assignment] }} />{ASSIGN_LABEL[e.assignment]}
          </span>
          {drive === id && <span className="rounded-[3px] border border-ink px-1.5 text-[13px] font-semibold text-ink">{tr('구동 중', 'Driving')}</span>}
        </div>
        <div className="tnum mt-1 text-[13px] text-ink-3">{labelled && <>e{id} · </>}v{e.vertices[0]}–v{e.vertices[1]} · {tr('길이', 'length')} {e.restLength.toFixed(3)}</div>
        <div className="mt-2.5 flex items-baseline justify-between">
          <span className="text-[14px] text-ink-3">{tr('현재 접힘각', 'Current fold angle')} <span className="greek">ρ</span></span>
          <span className="tnum text-[22px] font-semibold leading-tight text-ink">{fmtDeg(rho[id] ?? 0, 1)}</span>
        </div>
        {e.referenceFoldAngle !== 0 && <KV k={tr('기준 형상 ρ⁰', 'Reference shape ρ⁰')} v={fmtDeg(e.referenceFoldAngle, 1)} />}
        {boundary && <p className="mt-1 text-[13px] text-ink-3">{tr('경계선은 접히지 않는다.', 'Boundary edges do not fold.')}</p>}
        <SolverFailure />
      </div>

      {crease && !boundary && (
        patternFold
          ? <Section title={tr('이 크리스 하나만 움직이기', 'Move only this crease')} foldable defaultOpen={false}><CreaseControls id={id} /></Section>
          : <Section title={tr('접힘각 조절', 'Fold angle')}><CreaseControls id={id} /><SpeedControl className="mt-2 justify-between" /></Section>
      )}

      {!boundary && (
        <Section title={tr('M/V 배정 바꾸기', 'Change M/V assignment')} foldable defaultOpen={false}>
          <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label={tr('M/V 배정', 'M/V assignment')}>
            {(['M', 'V', 'F', 'U'] as Assignment[]).map((a) => {
              const on = e.assignment === a;
              return (
                <button key={a} type="button" role="radio" aria-checked={on} onClick={() => setAssignment(id, a)} title={ASSIGN_LABEL[a]}
                  className={`flex h-11 flex-col items-center justify-center rounded-[4px] text-[13px] leading-tight transition-colors ${on ? 'bg-paper font-semibold text-ink shadow-[inset_0_0_0_1.5px_var(--color-ink)]' : 'border border-rule-2 text-ink-3 hover:border-ink-3 hover:text-ink'}`}>
                  <span className="h-[3px] w-6 rounded" style={{ background: ASSIGN_COLOR[a] }} />
                  <span className="mt-1 max-w-full truncate px-0.5">{ASSIGN_LABEL[a]}</span>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {effect.length > 0 && solverMode === 'rigid' && (
        <Section title={tr(`함께 움직인 크리스 (${effect.length})`, `Creases that moved along (${effect.length})`)} foldable defaultOpen={false}>
          <table className="tnum w-full text-[13px]">
            <thead><tr className="text-ink-3"><th className="pb-1 text-left font-normal">{tr('크리스', 'Crease')}</th><th className="pb-1 text-right font-normal">{tr('이전', 'Before')}</th><th className="pb-1 text-right font-normal">{tr('이후', 'After')}</th><th className="pb-1 text-right font-normal">{tr('변화', 'Change')}</th></tr></thead>
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
        <div className="lettering text-[12px] text-ink-3">{tr('선택한 꼭짓점', 'Selected vertex')}</div>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="tnum text-[22px] font-bold leading-tight text-ink">v{id}</span>
          <span className="text-[14px] text-ink-3">{v.boundary ? tr('경계 꼭짓점', 'Boundary vertex') : tr('내부 꼭짓점', 'Interior vertex')}</span>
        </div>
      </div>
      <Section title={tr('꼭짓점 조건', 'Vertex conditions')}>
        {!r.interior ? <p className="text-[14px] text-ink-3">{tr('평탄 접힘 조건은 내부 꼭짓점에만 적용된다.', 'Flat-fold conditions apply only to interior vertices.')}</p> : r.edges.length === 0 ? <p className="text-[14px] text-ink-3">{tr('이 꼭짓점에는 접히는 크리스가 없다.', 'No folding creases meet at this vertex.')}</p> : (
          <>
            <ul className="space-y-1.5 text-[14px]">
              <li className="flex items-center justify-between gap-2">
                <span className="min-w-0 text-ink-2">{tr('Kawasaki (교대합 = 0)', 'Kawasaki (alternating sum = 0)')}</span>
                <Badge status={r.kawasaki.satisfied ? 'ok' : sumIs360 ? 'bad' : 'na'}>{r.kawasaki.satisfied ? tr('성립', 'holds') : sumIs360 ? tr('위반', 'violated') : tr('해당 없음', 'n/a')}</Badge>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="min-w-0 text-ink-2">{tr('일반화 Kawasaki', 'Generalized Kawasaki')} (A ∈ {'{0, ±360°}'})</span>
                <Badge status={r.generalized.satisfied ? 'ok' : 'bad'}>{r.generalized.windingClass === null ? tr('위반', 'violated') : r.generalized.windingClass === 0 ? 'A = 0' : r.generalized.windingClass > 0 ? 'A = +360°' : 'A = −360°'}</Badge>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="min-w-0 text-ink-2">Maekawa (M − V = {r.generalizedMaekawa.expected})</span>
                <Badge status={r.generalizedMaekawa.satisfied ? 'ok' : 'bad'}>{r.generalizedMaekawa.satisfied ? tr('성립', 'holds') : tr(`위반 (${r.maekawa.M}−${r.maekawa.V})`, `violated (${r.maekawa.M}−${r.maekawa.V})`)}</Badge>
              </li>
              {r.mvCheck && (
                <li className="flex items-center justify-between gap-2">
                  <span className="min-w-0 text-ink-2">{tr('M/V 배정 (크림프 검사)', 'M/V assignment (crimp check)')}</span>
                  <Badge status={r.mvCheck.valid ? 'ok' : 'bad'}>{r.mvCheck.valid ? tr('유효', 'valid') : tr('무효', 'invalid')}</Badge>
                </li>
              )}
            </ul>
            {r.mvCheck && !r.mvCheck.valid && <p className="mt-1.5 text-[13px] text-bad">{r.mvCheck.reason}</p>}
            <p className="mt-2 text-[13px] leading-relaxed text-ink-3">{tr('Kawasaki와 Maekawa는 필요조건이다. M/V 배정이 실제로 평탄하게 접히는지는 크림프 검사가 판정한다.', 'Kawasaki and Maekawa are necessary conditions. The crimp check decides whether the M/V assignment actually folds flat.')}</p>
          </>
        )}
      </Section>
      {r.interior && r.edges.length > 0 && (
        <Section title={tr('섹터 각과 접힘각', 'Sector and fold angles')} foldable defaultOpen={false}>
          <table className="tnum w-full text-[13px]">
            <thead><tr className="text-ink-3"><th className="pb-1 text-left font-normal">i</th><th className="pb-1 text-left font-normal">{tr('크리스', 'Crease')}</th><th className="pb-1 text-left font-normal">M/V</th><th className="pb-1 text-right font-normal"><span className="greek">θ</span>ᵢ</th><th className="pb-1 text-right font-normal">{tr('현재', 'Current')} <span className="greek">ρ</span></th></tr></thead>
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
            <KV k={<>{tr('섹터 각 합', 'Sector angle sum')} Σ<span className="greek">θ</span></>} v={`${toDeg(r.generalized.total).toFixed(2)}°`} />
            <KV k={tr('교대합 A = Σodd − Σeven', 'Alternating sum A = Σodd − Σeven')} v={`${toDeg(r.generalized.alternating).toFixed(2)}°`} />
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
        <div className="lettering text-[12px] text-ink-3">{tr('선택한 면', 'Selected facet')}</div>
        <div className="tnum mt-0.5 text-[22px] font-bold leading-tight text-ink">f{id}</div>
      </div>
      <Section title={tr('면 정보', 'Facet info')}>
        <KV k={tr('꼭짓점', 'Vertices')} v={f.vertices.map((v) => 'v' + v).join(' ')} />
        <KV k={tr('면적', 'Area')} v={f.area.toFixed(4)} />
        <KV k={tr('기준면 (강체 풀이의 고정 면)', 'Base facet (held fixed by the rigid solve)')} v={(engine.rigid?.sys.tree.baseFace ?? -1) === id ? tr('예', 'yes') : tr('아니오', 'no')} mono={false} />
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
    <Section title={tr('모델 정보와 솔버 옵션', 'Model info and solver options')} foldable defaultOpen={false}>
      <div className="text-[15px] font-semibold text-ink">{model.metadata.name}</div>
      <p className="mb-2 text-[13px] text-ink-3">{model.metadata.description}</p>
      <KV k={tr('꼭짓점 / 모서리 / 면', 'Vertices / edges / facets')} v={`${model.vertices.length} / ${model.edges.length} / ${model.faces.length}`} />
      <KV k={tr('접히는 크리스', 'Folding creases')} v={model.edges.filter((e) => e.faces[1] >= 0 && isCrease(e.assignment)).length} />
      <KV k={tr('기준 형상', 'Reference shape')} v={model.metadata.developable ? tr('평면 종이', 'flat paper') : tr('3D 조립체', '3D assembly')} mono={false} />
      <KV k={tr('구동 크리스', 'Driving crease')} v={drive === null ? tr('없음', 'none') : creaseName(model, drive)} />
      <KV k={tr('고정', 'Locked')} v={locked.length ? locked.map((l) => creaseName(model, l)).join(', ') : tr('없음', 'none')} />
      <div className="mt-2">
        <Toggle checked={enforceMV} onChange={setEnforceMV} label={tr('M/V 배정 준수 (Rigid)', 'Respect M/V assignment (Rigid)')} title={tr('M 크리스는 ρ ≤ 0, V 크리스는 ρ ≥ 0', 'M creases ρ ≤ 0, V creases ρ ≥ 0')} />
        {model.edu.symmetryLinks.length > 0 && <Toggle checked={useSymmetry} onChange={setUseSymmetry} label={tr(`대칭 구속 (${model.edu.symmetryLinks.length})`, `Symmetry constraints (${model.edu.symmetryLinks.length})`)} />}
      </div>
    </Section>
  );
}

/** Per-pattern wording and sizes of the whole-pattern fold card (a function, so the text follows the language). */
const patternFoldText = (): Record<string, { title: string; text: ReactNode; from: string; to: string; fold: string; unfold: string; sizes?: number[] }> => ({
  miura: {
    title: tr('패턴 전체 접기 · 미우라', 'Fold the whole pattern · Miura-ori'),
    text: tr(<>자유도 <b className="text-ink">1</b>의 기구다. 크리스 하나의 각만 정하면 나머지가 모두 정확히 따라 접힌다. 모든 단계가 강체 해다 (Rigid).</>,
      <>A mechanism with <b className="text-ink">1</b> DoF. Set the angle of one crease and all the others follow exactly. Every step is a rigid solution (Rigid).</>),
    from: tr('평면', 'flat'), to: tr('완전 접힘', 'fully folded'), fold: tr('전체 접기', 'Fold all'), unfold: tr('펼치기', 'Unfold'), sizes: [3, 5, 7],
  },
  waterbomb: {
    title: tr('패턴 전체 접기 · 워터밤', 'Fold the whole pattern · Waterbomb'),
    text: tr(<>크리스 하나로는 접히지 않는다. 모든 크리스를 <b className="text-ink">함께</b> 완전 접힘각으로 옮기며 매 단계 평형을 푼다 (Energy). 중간에는 면이 조금 휜다.</>,
      <>One crease alone will not fold it. All creases move <b className="text-ink">together</b> to their fully folded angles, solving for equilibrium at each step (Energy). The facets bend a little on the way.</>),
    from: tr('평면', 'flat'), to: tr('완전 접힘', 'fully folded'), fold: tr('전체 접기', 'Fold all'), unfold: tr('펼치기', 'Unfold'), sizes: [3, 4, 6],
  },
  shoppingBag: {
    title: tr('쇼핑백 접기', 'Fold the shopping bag'),
    text: tr(<>모든 크리스가 <b className="text-ink">동시에</b> 접히고, 그 사이 종이 면이 휘어야 한다. 면을 강체로 두면 이 경로가 없다는 것이 이 정리다 (Energy).</>,
      <>All creases fold <b className="text-ink">at once</b>, and the paper facets must bend on the way. The theorem says that with rigid facets this path does not exist (Energy).</>),
    from: tr('열림', 'open'), to: tr('납작', 'flat'), fold: tr('납작하게 접기', 'Fold flat'), unfold: tr('다시 펼치기', 'Unfold again'),
  },
});

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
  const cfgs = patternFoldText();
  const generic = mode === 'rigid'
    ? { title: tr('구조 전체 접기', 'Fold the whole structure'), text: tr(<>이 구조는 <b className="text-ink">한 가지 방식</b>으로만 움직인다. 진행률이 곧 접힘 정도이고, 모든 단계가 면을 휘지 않는 정확한 강체 해다 (Rigid).</>, <>This structure moves in <b className="text-ink">one way</b> only. Progress is how far it is folded, and every step is an exact rigid solution with no face bending (Rigid).</>), from: tr('평면', 'flat'), to: tr('완전 접힘', 'fully folded'), fold: tr('전체 접기', 'Fold all'), unfold: tr('펼치기', 'Unfold') }
    : { title: tr('구조 전체 접기', 'Fold the whole structure'), text: tr(<>모든 크리스를 <b className="text-ink">함께</b> 목표 각도로 옮기며 매 단계 평형을 푼다 (Energy). 크리스를 하나씩 맞출 필요가 없고, 면이 휘어야 하는 곳은 그만큼 휜다.</>, <>Every crease moves <b className="text-ink">together</b> towards its target, solving for equilibrium at each step (Energy). No need to set creases one by one; faces bend where they have to.</>), from: tr('평면', 'flat'), to: tr('접힘', 'folded'), fold: tr('전체 접기', 'Fold all'), unfold: tr('펼치기', 'Unfold') };
  const cfg = cfgs[generator] ?? generic;
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
        <span className="text-[14px] text-ink-2">{tr('접힘 진행률', 'Fold progress')}</span>
        <span className="tnum text-[22px] font-semibold leading-none text-ink">{Math.round(p * 100)}%</span>
      </div>
      <input type="range" className="mt-1.5 w-full" min={0} max={1} step={0.005} value={p} aria-label={tr('패턴 전체 접힘 진행률', 'Whole-pattern fold progress')}
        onChange={(e) => onSlide(parseFloat(e.target.value))} />
      <div className="flex justify-between text-[13px] text-ink-3"><span>{cfg.from}</span><span>{cfg.to}</span></div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">{tr('어디서든 멈추면 그 순간의 모양이 그대로 남는다. 투영 보기와 아래 분석 탭으로 그 상태를 살펴보자.', 'Stop anywhere and that exact shape stays. Inspect it with the Projections view and the analysis tabs below.')}</p>
      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
        <Button kind="primary" onClick={() => animatePatternFold(1)}><Play size={14} />{cfg.fold}</Button>
        <Button onClick={() => animatePatternFold(0)}><Rewind size={14} />{cfg.unfold}</Button>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <SpeedControl />
        {cfg.sizes && (
          <div className="flex items-center gap-1.5">
            <span className="lettering shrink-0 text-[12px] text-ink-3">{tr('크기', 'Size')}</span>
            <div role="radiogroup" aria-label={tr('패턴 크기', 'Pattern size')} className="flex rounded-[3px] border border-rule-2 bg-paper-2 p-0.5">
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
        {mode === 'rigid' && result && <KV k={tr('닫힘 오차', 'Closure error')} v={<Residual value={result.residualNorm} />} />}
        {mode === 'energy' && solverMode === 'energy' && p > 0 && (
          <KV k={tr('면 늘어남 (지금 / 경로 중 최대)', 'Facet stretch (now / path max)')} v={`${(maxStrain * 100).toFixed(1)}% / ${(Math.max(peak, maxStrain) * 100).toFixed(1)}%`} />
        )}
        {stack > 1 && <KV k={tr('한 지점에 겹친 종이', 'Paper layers at one point')} v={tr(`최대 ${stack}장`, `up to ${stack}`)} />}
        {mode === 'energy' && collisions > 0 && (
          <p className="mt-1.5 rounded-[3px] border border-warn/40 bg-warn-soft px-2.5 py-1.5 text-[13px] leading-relaxed text-ink-2">
            {tr(<><b className="text-ink">자기 교차 {collisions}쌍:</b> 이 구간에서는 종이가 잠깐 서로를 통과한다. 면 수가 적은 이 모델은 면을 크게 늘리지 않고는 이 구간을 지날 수 없다. 솔버에 접촉 모델은 없다.</>,
              <><b className="text-ink">{collisions} self-intersecting pairs:</b> in this stretch the paper briefly passes through itself. With so few facets this model cannot get through here without stretching them a lot. The solver has no contact model.</>)}
          </p>
        )}
        {mode === 'energy' && <p className="mt-1 text-[13px] leading-relaxed text-ink-3">{tr('막대-힌지 모델로 각 단계의 평형을 푼 결과다. 면이 얼마나 늘어나거나 휘어야 하는지는 위의 값으로 확인한다.', 'Each step is an equilibrium of the bar-and-hinge model. How much the faces must stretch or bend is shown above.')}</p>}
        {mode === 'energy' && engine.energy?.symmetric && <p className="mt-1 text-[13px] leading-relaxed text-ink-3">{getLang() === 'en' ? TUBE_SYMMETRY_NOTE.en : TUBE_SYMMETRY_NOTE.ko}</p>}
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
  if (!model) return <div className="p-4 text-[14px] text-ink-3">{tr('이 레슨은 전용 실습 화면을 사용한다.', 'This lesson uses its own lab screen.')}</div>;
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
          <p>{tr(<>3D 또는 전개도에서 <b className="text-ink">크리스</b>를 누르면 접힘각을 보고 직접 접을 수 있다. <b className="text-ink">꼭짓점</b>을 누르면 Kawasaki·Maekawa 조건을 검사한다.</>,
            <>Click a <b className="text-ink">crease</b> in 3D or the crease pattern to see its fold angle and fold it yourself. Click a <b className="text-ink">vertex</b> to check the Kawasaki and Maekawa conditions.</>)}</p>
        </div>
      )}
      <ModelSummary />
    </div>
  );
}
