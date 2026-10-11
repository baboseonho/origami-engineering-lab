import { useMemo, useRef } from 'react';
import { Anchor, ArrowLeft, ArrowRight, Lock, LockOpen, MousePointerClick, Play, Rewind } from 'lucide-react';
import { analyzeVertex } from '../../core/analysis/metrics';
import { fmtDeg, toDeg, toRad } from '../../core/geometry/angles';
import { isCrease, type Assignment } from '../../core/topology/types';
import { DEG } from '../../core/numerics/tolerances';
import { engine } from '../../state/engine';
import { useModel } from '../../state/modelStore';
import { useSim } from '../../state/simulationStore';
import { useUI } from '../../state/uiStore';
import { animateFoldToState, cancelFoldToState, driveSelected, foldDriveFully, foldToState, pushHistory, setAssignment, setDriveEdge, setEnforceMV, setUseSymmetry, toggleLock } from '../../state/actions';
import { lessonById } from '../../curriculum/lessons';
import { ASSIGN_COLOR, ASSIGN_LABEL, AngleSlider, Badge, Button, KV, NumberField, Section, SpeedControl, Toggle, fmt } from '../controls/ui';
import { FeasibilityBoard } from './FeasibilityBoard';

function SolverResultBox() {
  const result = useSim((s) => s.result);
  const lessonId = useModel((s) => s.lessonId);
  const bagLesson = lessonById(lessonId)?.experiment === 'bagCollapse';
  const solverMode = useSim((s) => s.solverMode);
  if (solverMode !== 'rigid' || !result) return null;
  const ok = result.success;
  return (
    <div className={`mt-3 rounded-[3px] border px-3 py-2.5 text-[13px] ${ok ? 'border-ok/40 bg-ok-soft' : 'border-bad/40 bg-bad-soft'}`} role="status">
      <div className="flex items-center justify-between gap-2">
        {ok ? <Badge status="ok">강체 해 존재</Badge> : <Badge status="bad">강체 해 없음 (infeasible)</Badge>}
        <span className="tnum text-[12px] text-ink-3">‖C‖ {fmt(result.residualNorm)}</span>
      </div>
      <div className="tnum mt-1.5 text-[12px] text-ink-3">
        반복 {result.iterations}
        {result.jacobianRank !== undefined && <> · rank J = {result.jacobianRank}</>}
        {result.conditionEstimate !== undefined && Number.isFinite(result.conditionEstimate) && <> · κ ≈ {fmt(result.conditionEstimate, 1)}</>}
      </div>
      {!ok && (
        <>
          <p className="mt-2 leading-relaxed text-ink">
            요청한 ρ = {fmtDeg(result.requestedAngle ?? 0, 1)} 에서 강체 해를 찾지 못했다. 마지막으로 유효한 배치 ρ = {fmtDeg(result.reachedAngle ?? 0, 2)} 에서 멈췄다.
          </p>
          <div className="mt-2 font-semibold text-ink">가능한 원인</div>
          <ul className="mt-1 list-disc space-y-1 pl-5 leading-relaxed text-ink-2">
            {result.reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
          <p className="mt-2 text-[12.5px] text-ink-3">형상은 변형하지 않았다. 면의 굽힘·신장을 허용하려면 상단의 <b className="text-ink">Energy</b> 솔버로 바꾼다.</p>
          {bagLesson && (
            <div className="mt-2.5 border-t border-dashed border-bad/30 pt-2.5">
              <p className="text-[12.5px] leading-relaxed text-ink-2">실제 종이백은 종이가 휘기 때문에 접힌다. 면의 굽힘을 허용하고 열린 백을 평탄 상태까지 접어 본다.</p>
              <Button kind="primary" className="mt-2" onClick={() => animateFoldToState(1)}>종이를 굽혀 납작하게 접기</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CreaseInspector({ id }: { id: number }) {
  const model = useModel((s) => s.model)!;
  const rho = useSim((s) => s.rho);
  const drive = useSim((s) => s.drive);
  const target = useSim((s) => s.target);
  const locked = useSim((s) => s.locked);
  const effect = useSim((s) => s.effect);
  const solverMode = useSim((s) => s.solverMode);
  const e = model.edges[id];
  if (!e) return null;
  const label = model.edu.creaseLabels[id];
  const crease = isCrease(e.assignment);
  const isDrive = drive === id;
  const isLocked = locked.includes(id);
  const lbl = (eid: number) => model.edu.creaseLabels[eid] ?? `e${eid}`;
  return (
    <>
      <div className="grid grid-cols-[1fr_auto] border-b border-rule-2">
        <div className="px-4 py-3">
          <div className="lettering text-[10.5px] text-ink-3">선택한 크리스</div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="tnum text-[20px] font-bold text-ink">e{id}</span>
            {label && <span className="greek text-[19px] text-ink-2">{label}</span>}
            <span className="tnum text-[12.5px] text-ink-3">v{e.vertices[0]}–v{e.vertices[1]}</span>
          </div>
        </div>
        <div className="flex flex-col justify-center border-l border-rule-2 px-4">
          <div className="lettering text-[10.5px] text-ink-3">길이</div>
          <div className="tnum text-[14px] text-ink">{e.restLength.toFixed(3)}</div>
        </div>
      </div>

      <Section title="M/V 배정">
        <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label="M/V 배정">
          {(['M', 'V', 'F', 'U'] as Assignment[]).map((a) => {
            const on = e.assignment === a;
            return (
              <button key={a} type="button" role="radio" aria-checked={on} disabled={e.faces[1] < 0} onClick={() => setAssignment(id, a)}
                title={ASSIGN_LABEL[a]}
                className={`flex h-10 flex-col items-center justify-center rounded-[4px] border text-[11.5px] leading-tight transition-colors disabled:opacity-40 ${on ? 'border-ink bg-paper-2 font-semibold text-ink' : 'border-rule-2 text-ink-3 hover:border-ink-3 hover:text-ink'}`}>
                <span className="h-[3px] w-6 rounded" style={{ background: ASSIGN_COLOR[a] }} />
                <span className="mt-1">{ASSIGN_LABEL[a]}</span>
              </button>
            );
          })}
        </div>
        {e.faces[1] < 0 && <p className="mt-2 text-[12.5px] text-ink-3">경계선은 접히지 않는다.</p>}
      </Section>

      <Section title="접힘각">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-[3px] border border-rule bg-paper-2 px-3 py-2">
            <div className="text-[12px] text-ink-3">현재 <span className="greek">ρ</span></div>
            <div className="tnum text-[22px] font-semibold leading-tight text-ink">{fmtDeg(rho[id] ?? 0, 2)}</div>
          </div>
          <div className={`rounded-[3px] border px-3 py-2 ${isDrive ? 'border-ink bg-mark/40' : 'border-rule bg-paper-2'}`}>
            <div className="text-[12px] text-ink-3">목표 <span className="greek">ρ</span> (구동)</div>
            <div className="tnum text-[22px] font-semibold leading-tight text-ink">{isDrive ? fmtDeg(target, 2) : '—'}</div>
          </div>
        </div>
        {e.referenceFoldAngle !== 0 && <KV k="기준 형상 ρ⁰" v={fmtDeg(e.referenceFoldAngle, 2)} />}

        {crease && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button kind={isDrive ? 'primary' : 'default'} onClick={() => setDriveEdge(isDrive ? null : id)}
              title="구동 크리스: 이 각도 하나를 지정하면 나머지 접힘각은 폐합 조건으로 결정된다.">
              <Anchor size={15} />{isDrive ? '구동 중' : '이 크리스 구동'}
            </Button>
            <Button active={isLocked} onClick={() => toggleLock(id)} title="고정된 크리스는 풀이 중 현재 각을 유지한다.">
              {isLocked ? <Lock size={15} /> : <LockOpen size={15} />}{isLocked ? '고정됨' : '고정'}
            </Button>
          </div>
        )}

        {crease && (
          <div className="mt-4">
            <div className="flex justify-between text-[11.5px]"><span className="inline-flex items-center gap-0.5" style={{ color: ASSIGN_COLOR.M }}><ArrowLeft size={12} />산접기 M</span><span className="inline-flex items-center gap-0.5" style={{ color: ASSIGN_COLOR.V }}>골접기 V<ArrowRight size={12} /></span></div>
            <AngleSlider value={isDrive ? target : rho[id] ?? 0} onStart={() => { pushHistory(); if (!isDrive) setDriveEdge(id); }} onChange={(r) => driveSelected(id, r)} />
            <div className="mt-1 grid grid-cols-5 gap-1">
              <span className="col-span-5"><NumberField label="목표 접힘각 (도)" value={+toDeg(isDrive ? target : rho[id] ?? 0).toFixed(3)} suffix="°" onCommit={(d) => { pushHistory(); driveSelected(id, toRad(d), true); }} /></span>
              {[-90, -45, 0, 45, 90].map((d) => (
                <button key={d} type="button" className="tnum h-7 rounded-[3px] border border-rule-2 text-[12px] text-ink-2 hover:border-ink hover:text-ink" onClick={() => { pushHistory(); driveSelected(id, d * DEG, true); }}>{d > 0 ? '+' : ''}{d}°</button>
              ))}
            </div>
            <div className="mt-3 rounded-[3px] border border-rule bg-paper-2/70 p-2">
              <div className="grid grid-cols-2 gap-1.5">
                <Button kind="primary" onClick={() => { if (!isDrive) setDriveEdge(id); foldDriveFully(); }} title="배정 방향으로 180°까지 천천히 접는다. 강체 해가 끝나는 곳에서 멈춘다.">
                  <Play size={14} />끝까지 접기
                </Button>
                <Button onClick={() => { if (!isDrive) setDriveEdge(id); foldDriveFully(true); }} title="0°(평면)까지 되돌린다.">
                  <Rewind size={14} />펴기
                </Button>
              </div>
              <SpeedControl className="mt-2 justify-between" />
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-3">
              {!isDrive ? '이 크리스의 각을 움직이면 자동으로 구동 크리스가 된다. 나머지 크리스는 함께 따라 접힌다.' : solverMode === 'rigid' ? '나머지 크리스는 폐합 조건으로 풀린다. 화면에서 크리스를 직접 눌러 위(세로 크리스는 오른쪽)로 끌면 더 접히고, 반대로 끌면 펴진다.' : 'Energy 모드: 이 크리스에 강한 비틀림 스프링을 걸고 나머지는 에너지 최소화로 따라온다.'}
            </p>
          </div>
        )}
        <SolverResultBox />
      </Section>

      {effect.length > 0 && solverMode === 'rigid' && (
        <Section title="연동된 크리스" foldable>
          <table className="tnum w-full text-[12.5px]">
            <thead><tr className="text-ink-3"><th className="pb-1 text-left font-normal">크리스</th><th className="pb-1 text-right font-normal">이전</th><th className="pb-1 text-right font-normal">이후</th><th className="pb-1 text-right font-normal">Δ</th></tr></thead>
            <tbody>
              {effect.map((x) => (
                <tr key={x.edge} className="cursor-pointer border-t border-rule hover:bg-paper-2" onClick={() => useUI.getState().select({ kind: 'edge', id: x.edge })}>
                  <td className="py-1" style={{ color: ASSIGN_COLOR[model.edges[x.edge].assignment] }}><span className={model.edu.creaseLabels[x.edge] ? 'greek' : ''}>{lbl(x.edge)}</span></td>
                  <td className="py-1 text-right text-ink-3">{toDeg(x.before).toFixed(1)}</td>
                  <td className="py-1 text-right text-ink">{toDeg(x.after).toFixed(1)}</td>
                  <td className="py-1 text-right font-medium text-ink-2">{(toDeg(x.after - x.before) >= 0 ? '+' : '') + toDeg(x.after - x.before).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
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
  return (
    <>
      <div className="border-b border-rule-2 px-4 py-3">
        <div className="lettering text-[10.5px] text-ink-3">선택한 꼭짓점</div>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="tnum text-[20px] font-bold text-ink">v{id}</span>
          <span className="text-[12.5px] text-ink-3">{v.boundary ? '경계 꼭짓점' : '내부 꼭짓점'}</span>
        </div>
      </div>
      <Section title="꼭짓점 조건">
        {!r.interior ? <p className="text-[13px] text-ink-3">평탄 접힘 조건은 내부 꼭짓점에만 적용된다.</p> : r.edges.length === 0 ? <p className="text-[13px] text-ink-3">이 꼭짓점에는 접히는 크리스가 없다.</p> : (
          <>
            <table className="tnum w-full text-[12.5px]">
              <thead><tr className="text-ink-3"><th className="pb-1 text-left font-normal">i</th><th className="pb-1 text-left font-normal">크리스</th><th className="pb-1 text-left font-normal">M/V</th><th className="pb-1 text-right font-normal"><span className="greek">θ</span>ᵢ</th><th className="pb-1 text-right font-normal">현재 <span className="greek">ρ</span></th></tr></thead>
              <tbody>
                {r.edges.map((eid, i) => (
                  <tr key={eid} className="cursor-pointer border-t border-rule hover:bg-paper-2" onClick={() => useUI.getState().select({ kind: 'edge', id: eid })}
                    onMouseEnter={() => useUI.getState().setTheoryHover(`θ${i + 1}`)} onMouseLeave={() => useUI.getState().setTheoryHover(null)}>
                    <td className="py-1 text-ink-3">{i + 1}</td>
                    <td className="py-1">e{eid}</td>
                    <td className="py-1 font-semibold" style={{ color: ASSIGN_COLOR[r.assignments[i]] }}>{r.assignments[i]}</td>
                    <td className="py-1 text-right">{toDeg(r.sectors[i]).toFixed(2)}°</td>
                    <td className="py-1 text-right text-ink-2">{fmtDeg(rho[eid] ?? 0, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 space-y-1.5 text-[13px]">
              <KV k={<>합 Σ<span className="greek">θ</span></>} v={`${toDeg(r.generalized.total).toFixed(3)}°`} />
              <div className="flex items-center justify-between gap-2"><span className="text-ink-3">Kawasaki 잔차 Σodd − Σeven</span><span className="tnum flex items-center gap-1.5">{toDeg(r.kawasaki.residual).toFixed(3)}° <Badge status={r.kawasaki.satisfied ? 'ok' : Math.abs(r.generalized.total - 2 * Math.PI) > 1e-6 ? 'na' : 'bad'} /></span></div>
              <div className="flex items-center justify-between gap-2"><span className="text-ink-3">교대합 A</span><span className="tnum flex items-center gap-1.5">{toDeg(r.generalized.alternating).toFixed(3)}° <Badge status={r.generalized.satisfied ? 'ok' : 'bad'}>{r.generalized.windingClass === null ? '∉{0,±360}' : r.generalized.windingClass === 0 ? 'A=0' : r.generalized.windingClass > 0 ? 'A=+360' : 'A=−360'}</Badge></span></div>
              <div className="flex items-center justify-between gap-2"><span className="text-ink-3">Maekawa M={r.maekawa.M}, V={r.maekawa.V}</span><span className="flex items-center gap-1.5">{r.generalizedMaekawa.expected} <Badge status={r.generalizedMaekawa.satisfied ? 'ok' : 'bad'} /></span></div>
              {r.mvCheck && (
                <div className="flex items-center justify-between gap-2"><span className="text-ink-3">크림프 검사 (M/V 유효성)</span><Badge status={r.mvCheck.valid ? 'ok' : 'bad'}>{r.mvCheck.valid ? `크림프 ${r.mvCheck.steps.length}회` : '실패'}</Badge></div>
              )}
              {r.mvCheck && !r.mvCheck.valid && <p className="text-[12.5px] text-bad">{r.mvCheck.reason}</p>}
              <p className="pt-1 text-[12px] leading-relaxed text-ink-3">Kawasaki와 Maekawa는 필요조건이다. 평탄 꼭짓점에서 M/V 배정이 실제로 유효한지는 크림프 검사가 판정한다.</p>
            </div>
          </>
        )}
      </Section>
    </>
  );
}

function FaceInspector({ id }: { id: number }) {
  const model = useModel((s) => s.model)!;
  const f = model.faces[id];
  return (
    <>
      <div className="border-b border-rule-2 px-4 py-3">
        <div className="lettering text-[10.5px] text-ink-3">선택한 면</div>
        <div className="tnum mt-0.5 text-[20px] font-bold text-ink">f{id}</div>
      </div>
      <Section title="면 정보">
        <KV k="꼭짓점" v={f.vertices.map((v) => 'v' + v).join(' ')} />
        <KV k="면적" v={f.area.toFixed(4)} />
        <KV k="삼각형 수" v={f.triangles.length} />
        <KV k="기준면 (강체 트리 루트)" v={(engine.rigid?.sys.tree.baseFace ?? -1) === id ? '예' : '아니오'} />
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
    <Section title="모델" foldable defaultOpen={false}>
      <div className="text-[14px] font-semibold text-ink">{model.metadata.name}</div>
      <p className="mb-2 text-[12.5px] text-ink-3">{model.metadata.description}</p>
      <KV k="꼭짓점 / 모서리 / 면" v={`${model.vertices.length} / ${model.edges.length} / ${model.faces.length}`} />
      <KV k="크리스 (M/V/U)" v={model.edges.filter((e) => e.faces[1] >= 0 && isCrease(e.assignment)).length} />
      <KV k="기준 형상" v={model.metadata.developable ? '평면 종이 (developable)' : '3D 조립체'} mono={false} />
      <KV k="구동 크리스" v={drive === null ? '없음' : `e${drive}`} />
      <KV k="고정" v={locked.length ? locked.map((l) => 'e' + l).join(', ') : '없음'} />
      <div className="mt-2">
        <Toggle checked={enforceMV} onChange={setEnforceMV} label="M/V 배정 준수 (Rigid 솔버)" title="M 크리스는 ρ ≤ 0, V 크리스는 ρ ≥ 0" />
        {model.edu.symmetryLinks.length > 0 && <Toggle checked={useSymmetry} onChange={setUseSymmetry} label={`대칭 구속 (${model.edu.symmetryLinks.length})`} />}
      </div>
    </Section>
  );
}

/**
 * Collective fold for the shopping bag: it is not a mechanism, so no single
 * crease can fold it. One slider folds every crease together (energy model).
 */
function BagFoldPanel() {
  const p = useSim((s) => s.stateFold);
  const solverMode = useSim((s) => s.solverMode);
  const maxStrain = useSim((s) => s.maxStrain);
  const maxBend = useSim((s) => s.maxFacetBending);
  const pending = useRef<number | null>(null);
  const raf = useRef(0);
  const live = solverMode === 'energy';
  const onSlide = (v: number) => {
    cancelFoldToState();
    pending.current = v;
    if (!raf.current) raf.current = requestAnimationFrame(() => { raf.current = 0; if (pending.current !== null) foldToState(pending.current); pending.current = null; });
  };
  return (
    <div className="border-b border-rule-2 bg-paper-2/60 px-4 pb-4 pt-3.5">
      <div className="lettering text-[11px] text-ink-3">쇼핑백 접기</div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">
        쇼핑백은 크리스 <b className="text-ink">하나</b>를 움직여서는 접히지 않는다. 모든 크리스가 <b className="text-ink">동시에</b> 접히고, 그 사이 종이 면이 조금 휘거나 늘어나야 한다. 면을 강체로 두면(Rigid) 이 경로가 아예 없다는 것이 이 정리다.
      </p>
      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-[12.5px] font-medium text-ink">접힘 진행률</span>
        <span className="tnum text-[18px] font-semibold text-ink">{Math.round(p * 100)}%</span>
      </div>
      <input type="range" className="mt-1 w-full" min={0} max={1} step={0.005} value={p} aria-label="쇼핑백 접힘 진행률"
        onChange={(e) => onSlide(parseFloat(e.target.value))} />
      <div className="flex justify-between text-[11px] text-ink-3"><span>열림</span><span>평탄 (납작)</span></div>
      <div className="mt-2 flex gap-1.5">
        <Button kind="primary" onClick={() => animateFoldToState(1)}>납작하게 접기</Button>
        <Button onClick={() => animateFoldToState(0)}>다시 펼치기</Button>
      </div>
      <SpeedControl className="mt-2 justify-between" />
      {live && p > 0 && (
        <div className="mt-2.5 space-y-0.5 text-[12px]">
          <KV k="최대 축 변형률 (면 늘어남)" v={`${(maxStrain * 100).toFixed(2)} %`} />
          <KV k="최대 면 굽힘" v={`${toDeg(maxBend).toFixed(1)}°`} />
          <p className="pt-1 text-[11.5px] leading-relaxed text-ink-3">Energy 솔버(막대-힌지 모델)로 각 단계의 평형을 푼 결과다. 열림과 평탄 상태에서는 변형이 0이고, 중간에서만 면이 변형된다.</p>
        </div>
      )}
    </div>
  );
}

export function Inspector() {
  const model = useModel((s) => s.model);
  const selection = useUI((s) => s.selection);
  const lessonId = useModel((s) => s.lessonId);
  const bag = lessonById(lessonId)?.experiment === 'bagCollapse' && !!model?.edu.referenceStates?.length;
  if (!model) return <div className="p-4 text-[13px] text-ink-3">이 레슨은 전용 실습 화면을 사용한다.</div>;
  return (
    <div className="stable-gutter h-full overflow-y-auto">
      {bag && <BagFoldPanel />}
      {selection?.kind === 'edge' && model.edges[selection.id] && <CreaseInspector id={selection.id} />}
      {selection?.kind === 'vertex' && model.vertices[selection.id] && <VertexInspector id={selection.id} />}
      {selection?.kind === 'face' && model.faces[selection.id] && <FaceInspector id={selection.id} />}
      {!selection && (
        <div className="flex gap-3 border-b border-rule-2 px-4 py-4 text-[13.5px] leading-relaxed text-ink-2">
          <MousePointerClick size={20} className="mt-0.5 shrink-0 text-ink-3" />
          <p>3D 또는 전개도에서 <b className="text-ink">크리스</b>를 클릭하면 접힘각을 보고 구동할 수 있다. <b className="text-ink">꼭짓점</b>을 클릭하면 Kawasaki·Maekawa 조건을 검사한다.</p>
        </div>
      )}
      <Section title="검사">
        <FeasibilityBoard />
      </Section>
      <ModelSummary />
    </div>
  );
}
