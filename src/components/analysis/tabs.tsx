import { Pause, Play } from 'lucide-react';
import { useMemo } from 'react';
import { toDeg } from '../../core/geometry/angles';
import { isCrease } from '../../core/topology/types';
import { finiteDifferenceForce } from '../../core/analysis/experiments';
import { useModel } from '../../state/modelStore';
import { useSim } from '../../state/simulationStore';
import { useUI } from '../../state/uiStore';
import { lessonById } from '../../curriculum/lessons';
import {
  applyEnergyPreset, clearExperiment, computeSweep, initEnergy, playExperiment, relaxNow, runExperiment, scrubExperiment, setCreaseRest, setEnergyParams, togglePlay,
} from '../../state/actions';
import { ASSIGN_COLOR, Button, KV, SpeedControl, fmt } from '../controls/ui';
import { PALETTE, Plot, type Series } from './Plot';
import { C, SERIES } from '../../theme/tokens';

export function AnglesTab() {
  const model = useModel((s) => s.model);
  const rho = useSim((s) => s.rho);
  const sweep = useSim((s) => s.sweep);
  const drive = useSim((s) => s.drive);
  const target = useSim((s) => s.target);
  const solverMode = useSim((s) => s.solverMode);
  const selection = useUI((s) => s.selection);
  const creases = useMemo(() => (model ? model.edges.filter((e) => e.faces[1] >= 0 && isCrease(e.assignment)) : []), [model]);
  const series: Series[] = useMemo(() => {
    if (!sweep || !model) return [];
    const labelled = Object.keys(model.edu.creaseLabels).map(Number).filter((e) => e !== sweep.edge);
    const pick = labelled.length ? labelled : creases.map((c) => c.id).filter((e) => e !== sweep.edge)
      .sort((a, b) => Math.abs(sweep.rho[sweep.rho.length - 1]?.[b] ?? 0) - Math.abs(sweep.rho[sweep.rho.length - 1]?.[a] ?? 0)).slice(0, 6);
    return pick.map((eid, i) => ({
      label: model.edu.creaseLabels[eid] ?? `e${eid}`,
      color: PALETTE[i % PALETTE.length],
      x: sweep.drive.map(toDeg),
      y: sweep.rho.map((r) => toDeg(r[eid])),
    }));
  }, [sweep, model, creases]);
  if (!model) return <Empty />;
  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
      <div className="overflow-y-auto">
        <div className="mb-1 text-[11px] text-ink-3">크리스별 부호 있는 접힘각 (ρ &gt; 0 골접기, ρ &lt; 0 산접기). 클릭하면 선택된다.</div>
        <div className="flex flex-wrap gap-1">
          {creases.slice(0, 240).map((e) => {
            const v = toDeg(rho[e.id] ?? 0);
            const sel = selection?.kind === 'edge' && selection.id === e.id;
            return (
              <button key={e.id} type="button" onClick={() => useUI.getState().select({ kind: 'edge', id: e.id })}
                onMouseEnter={() => useUI.getState().setHover({ kind: 'edge', id: e.id })} onMouseLeave={() => useUI.getState().setHover(null)}
                className={`w-[96px] rounded-[3px] border px-2 py-1 text-left text-[12px] tnum transition-colors ${sel ? 'border-ink bg-mark/50' : 'border-rule hover:border-ink-3'} ${e.id === drive && !sel ? 'bg-paper-3' : !sel ? 'bg-paper' : ''}`}>
                <div className="flex justify-between"><span className={model.edu.creaseLabels[e.id] ? 'lbl-greek text-[12px]' : ''} style={{ color: ASSIGN_COLOR[e.assignment] }}>{model.edu.creaseLabels[e.id] ?? `e${e.id}`}</span><span className="text-ink-3">{e.assignment}</span></div>
                <div className="relative mt-1 h-1 rounded bg-paper-3">
                  <div className="absolute top-0 h-1 rounded" style={{ left: v < 0 ? `${50 + v / 3.6}%` : '50%', width: `${Math.abs(v) / 3.6}%`, background: ASSIGN_COLOR[v < 0 ? 'M' : 'V'] }} />
                </div>
                <div className="mt-0.5 text-right font-medium text-ink">{v.toFixed(1)}°</div>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] text-ink-3">구동각에 따른 종속 각도 (Rigid 솔버 스윕)</span>
          <Button onClick={computeSweep} disabled={drive === null || solverMode !== 'rigid'}>스윕 계산</Button>
        </div>
        <Plot series={series} emptyText={drive === null ? '구동 크리스를 지정하면 스윕을 계산할 수 있다' : '"스윕 계산"을 누르면 그래프가 그려진다'} xLabel="구동 ρ (°)" yLabel="ρ_i (°)" markerX={drive !== null && sweep?.edge === drive ? toDeg(target) : undefined} />
        {sweep && <div className="text-[10.5px] text-ink-3">솔버 샘플 {sweep.drive.length}개. 각 점은 정확한 강체 배치이다 (연속법).</div>}
      </div>
    </div>
  );
}

export function ConstraintsTab() {
  const hist = useSim((s) => s.residualHistory);
  const result = useSim((s) => s.result);
  const locked = useSim((s) => s.locked);
  const enforceMV = useSim((s) => s.enforceMV);
  const model = useModel((s) => s.model);
  if (!model) return <Empty />;
  return (
    <div className="grid h-full grid-cols-[1fr_400px] gap-3">
      <div className="space-y-1 text-[12px]">
        <KV k="닫힘 잔차 ‖C(q)‖ (마지막 풀이)" v={fmt(result?.residualNorm)} />
        <KV k="상태" v={result?.status ?? '—'} />
        <KV k="반복 횟수" v={result?.iterations ?? '—'} />
        <KV k="잠긴 크리스" v={locked.length ? locked.map((l) => `e${l}`).join(', ') : '없음'} />
        <KV k="M/V 부호 구속" v={enforceMV ? '적용 (M ≤ 0, V ≥ 0)' : '무시'} />
        <p className="pt-2 text-[11px] text-ink-3">
          C(q)는 꼭짓점 닫힘 곱 Π R(dᵢ, ρᵢ) − I (내부 꼭짓점당 9개 성분)와, 관(tube)의 경우 전역 루프 닫힘
          (회전 + 병진)을 쌓은 것이다. 강체 배치는 ‖C‖ ≈ 0 (허용오차 1e-9)을 만족한다. 연속법이 ‖C‖를 작게 유지하지 못하면
          풀이는 마지막 유효 상태에서 멈추고 실현 불가능을 보고한다.
        </p>
      </div>
      <Plot series={[{ label: '‖C‖', color: SERIES[5], x: hist.map((_, i) => i), y: hist.map((v) => Math.max(v, 1e-16)), points: true }]} xLabel="풀이 번호" yLabel="잔차 (log10)" logY />
    </div>
  );
}

export function DofTab() {
  const dof = useSim((s) => s.dof);
  const model = useModel((s) => s.model);
  if (!model) return <Empty />;
  if (!dof) return <div className="text-ink-3">계산 중…</div>;
  const sv = dof.fullRank.singularValues;
  return (
    <div className="grid h-full grid-cols-[300px_1fr_380px] gap-3">
      <div className="text-[12px]">
        <KV k="N (접힘 변수 수)" v={dof.N} />
        <KV k="M (내부 꼭짓점 수)" v={dof.M} />
        <KV k="N − 3M (강의 추정치)" v={<span className={dof.NMinus3M < 0 ? 'text-warn' : ''}>{dof.NMinus3M}</span>} />
        <KV k="rank J (꼭짓점 닫힘, ≤ 3M)" v={dof.vertexRank.rank} />
        {dof.usesLoops && <KV k="rank J (전역 루프 포함)" v={dof.fullRank.rank} />}
        <KV k="DoF_local = N − rank J" v={<span className="text-info">{dof.dofLocal}</span>} />
        <KV k="중복 꼭짓점 구속" v={dof.redundantVertexConstraints} />
        <KV k="조건수 κ" v={fmt(dof.fullRank.condition, 1)} />
      </div>
      <div className="space-y-1 text-[11.5px]">
        {dof.warnings.length === 0 && <div className="text-ok">여기서는 단순 계수가 야코비안 랭크와 일치한다.</div>}
        {dof.warnings.map((w, i) => <div key={i} className="rounded border border-warn/40 bg-warn-soft p-1.5 text-warn">⚠ {w}</div>)}
        <p className="text-ink-3">DoF_local은 현재 배치에서의 1차(무한소) 가동성을 센다. 특이 상태(예: 평탄 상태)에서는 유한 가동성보다 클 수 있으며, 쇼핑백은 유한 운동이 전혀 없는데도 DoF_local &gt; 0이다.</p>
      </div>
      <Plot series={[{ label: 'σ_i', color: SERIES[4], x: sv.map((_, i) => i + 1), y: sv.map((v) => Math.max(v, 1e-16)), points: true }]} xLabel="인덱스 i" yLabel="특이값 (log10)" logY />
    </div>
  );
}

export function EnergyTab() {
  const model = useModel((s) => s.model);
  const lessonId = useModel((s) => s.lessonId);
  const s = useSim();
  const lesson = lessonById(lessonId);
  if (!model) return <Empty />;
  const p = s.energyParams;
  const logSlider = (key: 'kAxial' | 'kCrease' | 'kFacet', lo: number, hi: number) => (
    <label className="flex items-center gap-2 text-[11.5px]">
      <span className="w-16 tnum text-ink-3">{key}</span>
      <input type="range" min={Math.log10(lo)} max={Math.log10(hi)} step={0.01} value={Math.log10(p[key])}
        onChange={(e) => setEnergyParams({ [key]: Math.pow(10, parseFloat(e.target.value)) })} className="w-36" />
      <span className="w-14 text-right tnum">{fmt(p[key], 3)}</span>
    </label>
  );
  const h = s.energyHistory;
  const ex = s.experiment;
  return (
    <div className="grid h-full grid-cols-[330px_1fr] gap-3 overflow-y-auto">
      <div className="space-y-1.5">
        {s.solverMode !== 'energy' && <div className="rounded border border-info/40 bg-info-soft p-1.5 text-[11px] text-info">Energy 솔버가 비활성 상태이다. 상단 바에서 <b>Energy</b>를 선택한다.</div>}
        <div className="flex flex-wrap gap-1">
          <Button kind={s.playing ? 'danger' : 'primary'} onClick={togglePlay} disabled={s.solverMode !== 'energy'}>{s.playing ? <><Pause size={14} />일시정지</> : <><Play size={14} />동역학 실행</>}</Button>
          <Button onClick={relaxNow} disabled={s.solverMode !== 'energy'} title="준정적 FIRE 최소화">이완 (FIRE)</Button>
          <Button onClick={initEnergy} disabled={s.solverMode !== 'energy'}>재시작</Button>
        </div>
        <div className="flex gap-1">
          {(['rigidLike', 'paperLike', 'veryFlexible'] as const).map((k) => (
            <Button key={k} active={s.energyPreset === k} onClick={() => applyEnergyPreset(k)}>{k === 'rigidLike' ? '강체에 가까움' : k === 'paperLike' ? '종이' : '매우 유연함'}</Button>
          ))}
        </div>
        {logSlider('kAxial', 0.5, 2000)}
        {logSlider('kCrease', 0.001, 20)}
        {logSlider('kFacet', 0.001, 200)}
        <label className="flex items-center gap-2 text-[11.5px]"><span className="w-16 tnum text-ink-3">ζ 감쇠</span>
          <input type="range" min={0.05} max={1} step={0.01} value={p.damping} onChange={(e) => setEnergyParams({ damping: parseFloat(e.target.value) })} className="w-36" /><span className="w-14 text-right tnum">{p.damping.toFixed(2)}</span></label>
        <label className="flex items-center gap-2 text-[11.5px]"><span className="w-16 tnum text-ink-3">dt 배율</span>
          <input type="range" min={0.1} max={1.5} step={0.05} value={p.dtScale} onChange={(e) => setEnergyParams({ dtScale: parseFloat(e.target.value) })} className="w-36" /><span className="w-14 text-right tnum">{p.dtScale.toFixed(2)}</span></label>
        <label className="flex items-center gap-2 text-[11.5px]"><span className="w-16 tnum text-ink-3">스텝/fr</span>
          <input type="range" min={1} max={300} step={1} value={p.stepsPerFrame} onChange={(e) => setEnergyParams({ stepsPerFrame: parseInt(e.target.value) })} className="w-36" /><span className="w-14 text-right tnum">{p.stepsPerFrame}</span></label>
        <div className="flex items-center gap-2 text-[11.5px]">
          <span className="text-ink-3">크리스 정지각</span>
          <select className="rounded border border-rule-2 bg-paper-2 px-1 text-xs" value={s.creaseRest} onChange={(e) => setCreaseRest(e.target.value as typeof s.creaseRest)}>
            <option value="current">현재 (자유 힌지)</option>
            <option value="reference">기준 (종이 기억)</option>
            <option value="foldAll">배정 방향으로 모두 접기 (fold all)</option>
          </select>
        </div>
        {s.creaseRest === 'foldAll' && (
          <label className="flex items-center gap-2 text-[11.5px]"><span className="text-ink-3">접힘 %</span>
            <input type="range" min={0} max={1} step={0.01} value={s.foldPercent} onChange={(e) => setCreaseRest('foldAll', parseFloat(e.target.value))} className="w-40" /><span className="tnum">{(s.foldPercent * 100).toFixed(0)}%</span></label>
        )}
        {s.creaseRest === 'foldAll' && (
          <label className="flex items-center gap-2 text-[11.5px]" title="pct(r) = p·max(0, 1 + g(r − ½)); g > 0이면 가장자리를 더 접고(돔), g < 0이면 중심을 더 접는다(안장)"><span className="text-ink-3">반경 방향 그레이딩 g</span>
            <input type="range" min={-1.5} max={1.5} step={0.05} value={s.foldGrade} onChange={(e) => setCreaseRest('foldAll', undefined, parseFloat(e.target.value))} className="w-32" /><span className="tnum">{s.foldGrade.toFixed(2)}</span></label>
        )}
        <p className="text-[10.5px] text-ink-3">dt는 가장 강성이 큰 막대/힌지로부터 자동으로 결정된다 (반암시적 오일러의 안정 한계) × dt 배율.</p>
      </div>
      <div className={lesson?.experiment ? "grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3" : "grid grid-cols-2 gap-3"}>
        <div>
          <div className="text-[11.5px]">
            {s.energy && <span className="tnum">V = {fmt(s.energy.total)} (축 {fmt(s.energy.axial)}, 크리스 {fmt(s.energy.crease)}, 면 {fmt(s.energy.facet)}), KE {fmt(s.energy.kinetic)}</span>}
            {s.diverged && <div className="text-bad">적분이 발산했다. dt를 자동으로 절반으로 줄이고 마지막 유한 상태를 복원했다.</div>}
          </div>
          <Plot
            series={[
              { label: '전체', color: C.ink, x: h.map((q) => q.t), y: h.map((q) => q.total) },
              { label: '축', color: SERIES[1], x: h.map((q) => q.t), y: h.map((q) => q.axial) },
              { label: '크리스', color: SERIES[0], x: h.map((q) => q.t), y: h.map((q) => q.crease) },
              { label: '면', color: SERIES[2], x: h.map((q) => q.t), y: h.map((q) => q.facet) },
            ]}
            xLabel="시간" yLabel="에너지"
          />
        </div>
        {lesson?.experiment && (
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-1 [&_button]:whitespace-nowrap">
              <Button kind="primary" onClick={() => runExperiment(lesson.experiment!)} disabled={ex?.running} title={lesson.experiment === 'bagCollapse' ? '면의 굽힘·신장을 허용하고 열린 백을 평탄 상태까지 접는다' : undefined}>
                {ex?.running ? `실행 중 ${ex.samples.length}/${ex.total + 1}…` : lesson.experiment === 'kreslingAxial' ? '축 압축 실험 (비틀림 자유)' : lesson.experiment === 'yoshimuraCompression' ? '압축 실험 실행' : '납작하게 접기'}
              </Button>
              {ex && !ex.running && ex.samples.length > 1 && <Button onClick={() => playExperiment()}>다시 재생</Button>}
              {ex && <SpeedControl />}
              {ex && <Button onClick={clearExperiment}>지우기</Button>}
            </div>
            {ex && <ExperimentPlots />}
            {!ex && <p className="text-[11px] text-ink-3">변위 제어 준정적 스윕: 각 단계에서 Web Worker가 에너지를 최소화(FIRE)한다. 결과는 교육용 막대-힌지 모델의 수치 추정치이다.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function ExperimentPlots() {
  const ex = useSim((s) => s.experiment)!;
  const xs = ex.samples.map((q) => q.u);
  const fd = finiteDifferenceForce(ex.samples);
  const cur = ex.samples[ex.index];
  if (ex.kind === 'bagCollapse') {
    // fold-to-state sweep: u is the fold progress, not a displacement
    const peak = ex.samples.reduce((m, q) => Math.max(m, q.maxStrain), 0);
    return (
      <div>
        <input type="range" className="w-full" min={0} max={Math.max(0, ex.samples.length - 1)} value={ex.index} onChange={(e) => scrubExperiment(parseInt(e.target.value))} aria-label="접힘 진행률" />
        <div className="tnum text-[11px] text-ink-3">
          접힘 진행률 {((cur?.u ?? 0) * 100).toFixed(0)}% · V = {fmt(cur?.energy.total)} · 최대 변형률 {(cur ? cur.maxStrain * 100 : 0).toFixed(2)}% (경로 최대 {(peak * 100).toFixed(2)}%)
        </div>
        <div className="grid grid-cols-2 gap-1">
          <Plot height={170} width={380} markerX={cur?.u} series={[
            { label: '전체', color: C.ink, x: xs, y: ex.samples.map((q) => q.energy.total) },
            { label: '축', color: SERIES[1], x: xs, y: ex.samples.map((q) => q.energy.axial) },
            { label: '크리스', color: SERIES[0], x: xs, y: ex.samples.map((q) => q.energy.crease) },
            { label: '면', color: SERIES[2], x: xs, y: ex.samples.map((q) => q.energy.facet) },
          ]} xLabel="접힘 진행률 u (0 열림 → 1 평탄)" yLabel="V_min(u)" />
          <Plot height={170} width={380} markerX={cur?.u} yZero series={[
            { label: '최대 축 변형률 (%)', color: SERIES[3], x: xs, y: ex.samples.map((q) => q.maxStrain * 100) },
          ]} xLabel="접힘 진행률 u" yLabel="변형률 %" />
        </div>
        <p className="mt-1 text-[11px] text-ink-3">모든 크리스의 목표각을 열린 상태에서 평탄 상태로 함께 옮기며 단계마다 에너지를 최소화했다(FIRE). 양 끝은 강체 상태지만 중간에서 면이 늘어나거나 굽혀진다: 키 큰 쇼핑백이 강체로는 접히지 않는다는 정리의 수치적 모습이다.</p>
      </div>
    );
  }
  return (
    <div>
      <input type="range" className="w-full" min={0} max={Math.max(0, ex.samples.length - 1)} value={ex.index} onChange={(e) => scrubExperiment(parseInt(e.target.value))} />
      <div className="tnum text-[10.5px] text-ink-3">
        u = {cur?.u.toFixed(3)} · V = {fmt(cur?.energy.total)} · F = {fmt(cur?.reaction)} · 비틀림 = {cur ? (cur.twist * 180 / Math.PI).toFixed(1) : '—'}° · 최대 변형률 {(cur ? cur.maxStrain * 100 : 0).toFixed(2)}%
      </div>
      <div className="grid grid-cols-2 gap-1">
        <Plot height={170} width={380} markerX={cur?.u} series={[
          { label: '전체', color: C.ink, x: xs, y: ex.samples.map((q) => q.energy.total) },
          { label: '축', color: SERIES[1], x: xs, y: ex.samples.map((q) => q.energy.axial) },
          { label: '크리스', color: SERIES[0], x: xs, y: ex.samples.map((q) => q.energy.crease) },
          { label: '면', color: SERIES[2], x: xs, y: ex.samples.map((q) => q.energy.facet) },
        ]} xLabel="변위 u" yLabel="V_min(u)" />
        <Plot height={170} width={380} markerX={cur?.u} yZero series={ex.kind === 'kreslingAxial'
          ? [{ label: '반력', color: SERIES[3], x: xs, y: ex.samples.map((q) => q.reaction) }, { label: 'dV/du (FD)', color: SERIES[4], x: xs, y: fd, dashed: true }, { label: '비틀림 (rad)', color: SERIES[6], x: xs, y: ex.samples.map((q) => q.twist) }]
          : [{ label: '반력', color: SERIES[3], x: xs, y: ex.samples.map((q) => q.reaction) }, { label: 'dV/du (FD)', color: SERIES[4], x: xs, y: fd, dashed: true }]} xLabel="변위 u" yLabel="힘 근사값" />
      </div>
    </div>
  );
}

export function StrainTab() {
  const s = useSim();
  const model = useModel((st) => st.model);
  if (!model) return <Empty />;
  return (
    <div className="grid h-full grid-cols-[360px_1fr] gap-3 text-[12px]">
      <div>
        <KV k="최대 축 변형률 |l − L₀|/L₀" v={s.solverMode === 'energy' ? `${(s.maxStrain * 100).toFixed(3)} %` : '0 (구성상 강체)'} />
        <KV k="최대 면 굽힘 |α − α₀|" v={s.solverMode === 'energy' ? `${toDeg(s.maxFacetBending).toFixed(3)}°` : '0 (강체)'} />
        <KV k="최대 종이 각 결손" v={fmt(s.paperDefect)} />
        <KV k="충돌 (비인접 삼각형)" v={s.collisionCount} />
        <p className="mt-2 text-[11px] text-ink-3">뷰포트 오버레이에서 축 변형률(Axial strain)을 켜면 꼭짓점이 인접 막대의 평균 변형률로 색칠된다 (파랑 0 → 빨강 ≥ 5%, Origami Simulator와 동일).</p>
      </div>
      <div className="text-[11px] text-ink-3">
        Rigid 모드에서 면은 정확히 강체이다. 변형률과 면 굽힘은 구성상 0이며, 유일한 실패 양상은 실현 불가능이다.
        Energy 모드에서 이 값들은 요청된 운동을 실현하려면 종이가 얼마나 변형되어야 하는지, 즉 비강체 경로의 물리적 대가를 정량화한다.
      </div>
    </div>
  );
}

function Empty() {
  return <div className="text-ink-3">이 탭은 3D 모델 레슨에만 적용된다.</div>;
}
