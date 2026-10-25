import { creaseName } from '../../core/topology/names';
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
import { tr } from '../../i18n';

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
      label: creaseName(model, eid),
      color: PALETTE[i % PALETTE.length],
      x: sweep.drive.map(toDeg),
      y: sweep.rho.map((r) => toDeg(r[eid])),
    }));
  }, [sweep, model, creases]);
  if (!model) return <Empty />;
  return (
    <div className="grid h-full grid-cols-1 @2xl:grid-cols-2 gap-4">
      <div className="overflow-y-auto">
        <div className="mb-1 text-[12px] text-ink-3">{tr('크리스별 부호 있는 접힘각 (ρ > 0 골접기, ρ < 0 산접기). 클릭하면 선택된다.', 'Signed fold angle per crease (ρ > 0 valley, ρ < 0 mountain). Click to select.')}</div>
        <div className="flex flex-wrap gap-1">
          {creases.slice(0, 240).map((e) => {
            const v = toDeg(rho[e.id] ?? 0);
            const sel = selection?.kind === 'edge' && selection.id === e.id;
            return (
              <button key={e.id} type="button" onClick={() => useUI.getState().select({ kind: 'edge', id: e.id })}
                onMouseEnter={() => useUI.getState().setHover({ kind: 'edge', id: e.id })} onMouseLeave={() => useUI.getState().setHover(null)}
                className={`w-[96px] rounded-[3px] border px-2 py-1 text-left text-[13px] tnum transition-colors ${sel ? 'border-ink bg-mark/50' : 'border-rule hover:border-ink-3'} ${e.id === drive && !sel ? 'bg-paper-3' : !sel ? 'bg-paper' : ''}`}>
                <div className="flex justify-between"><span className={model.edu.creaseLabels[e.id] ? 'lbl-greek text-[13px]' : ''} style={{ color: ASSIGN_COLOR[e.assignment] }}>{creaseName(model, e.id)}</span><span className="text-ink-3">{e.assignment}</span></div>
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
          <span className="text-[12px] text-ink-3">{tr('구동각에 따른 종속 각도 (Rigid 솔버 스윕)', 'Dependent angles vs. driving angle (Rigid solver sweep)')}</span>
          <Button onClick={computeSweep} disabled={drive === null || solverMode !== 'rigid'}>{tr('스윕 계산', 'Compute sweep')}</Button>
        </div>
        <Plot series={series} emptyText={drive === null ? tr('구동 크리스를 지정하면 스윕을 계산할 수 있다', 'Set a driving crease to compute a sweep') : tr('"스윕 계산"을 누르면 그래프가 그려진다', 'Press "Compute sweep" to draw the graph')} xLabel={tr('구동 ρ (°)', 'Driving ρ (°)')} yLabel="ρ_i (°)" markerX={drive !== null && sweep?.edge === drive ? toDeg(target) : undefined} />
        {sweep && <div className="text-[12px] text-ink-3">{tr(`솔버 샘플 ${sweep.drive.length}개. 각 점은 정확한 강체 배치이다 (연속법).`, `${sweep.drive.length} solver samples. Each point is an exact rigid configuration (continuation).`)}</div>}
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
    <div className="grid h-full grid-cols-1 @2xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)] gap-3">
      <div className="space-y-1 text-[13px]">
        <KV k={tr('닫힘 잔차 ‖C(q)‖ (마지막 풀이)', 'Closure residual ‖C(q)‖ (last solve)')} v={fmt(result?.residualNorm)} />
        <KV k={tr('상태', 'Status')} v={result?.status ?? '—'} />
        <KV k={tr('반복 횟수', 'Iterations')} v={result?.iterations ?? '—'} />
        <KV k={tr('잠긴 크리스', 'Locked creases')} v={locked.length ? locked.map((l) => creaseName(model, l)).join(', ') : tr('없음', 'none')} />
        <KV k={tr('M/V 부호 구속', 'M/V sign constraint')} v={enforceMV ? tr('적용 (M ≤ 0, V ≥ 0)', 'on (M ≤ 0, V ≥ 0)') : tr('무시', 'ignored')} />
        <p className="pt-2 text-[12px] text-ink-3">
          {tr(<>C(q)는 꼭짓점 닫힘 곱 Π R(dᵢ, ρᵢ) − I (내부 꼭짓점당 9개 성분)와, 관(tube)의 경우 전역 루프 닫힘
          (회전 + 병진)을 쌓은 것이다. 강체 배치는 ‖C‖ ≈ 0 (허용오차 1e-9)을 만족한다. 연속법이 ‖C‖를 작게 유지하지 못하면
          풀이는 마지막 유효 상태에서 멈추고 실현 불가능을 보고한다.</>,
          <>C(q) stacks the vertex closure products Π R(dᵢ, ρᵢ) − I (9 entries per interior vertex) and, for tubes, the global loop closure
          (rotation + translation). A rigid configuration satisfies ‖C‖ ≈ 0 (tolerance 1e-9). If continuation cannot keep ‖C‖ small,
          the solve stops at the last valid state and reports infeasible.</>)}
        </p>
      </div>
      <Plot series={[{ label: '‖C‖', color: SERIES[5], x: hist.map((_, i) => i), y: hist.map((v) => Math.max(v, 1e-16)), points: true }]} xLabel={tr('풀이 번호', 'Solve #')} yLabel={tr('잔차 (log10)', 'Residual (log10)')} logY />
    </div>
  );
}

export function DofTab() {
  const dof = useSim((s) => s.dof);
  const model = useModel((s) => s.model);
  if (!model) return <Empty />;
  if (!dof) return <div className="text-ink-3">{tr('계산 중…', 'Computing…')}</div>;
  const sv = dof.fullRank.singularValues;
  return (
    <div className="grid h-full grid-cols-1 @2xl:grid-cols-2 @5xl:grid-cols-[280px_minmax(0,1fr)_minmax(0,360px)] gap-3">
      <div className="text-[13px]">
        <KV k={tr('N (접힘 변수 수)', 'N (fold variables)')} v={dof.N} />
        <KV k={tr('M (내부 꼭짓점 수)', 'M (interior vertices)')} v={dof.M} />
        <KV k={tr('N − 3M (개수 추정치)', 'N − 3M (counting estimate)')} v={<span className={dof.NMinus3M < 0 ? 'text-warn' : ''}>{dof.NMinus3M}</span>} />
        <KV k={tr('rank J (꼭짓점 닫힘, ≤ 3M)', 'rank J (vertex closure, ≤ 3M)')} v={dof.vertexRank.rank} />
        {dof.usesLoops && <KV k={tr('rank J (전역 루프 포함)', 'rank J (with global loops)')} v={dof.fullRank.rank} />}
        <KV k="DoF_local = N − rank J" v={<span className="text-info">{dof.dofLocal}</span>} />
        <KV k={tr('중복 꼭짓점 구속', 'Redundant vertex constraints')} v={dof.redundantVertexConstraints} />
        <KV k={tr('조건수 κ', 'Condition number κ')} v={fmt(dof.fullRank.condition, 1)} />
      </div>
      <div className="space-y-1 text-[12px]">
        {dof.warnings.length === 0 && <div className="text-ok">{tr('여기서는 단순 계수가 야코비안 랭크와 일치한다.', 'Here the simple count matches the Jacobian rank.')}</div>}
        {dof.warnings.map((w, i) => <div key={i} className="rounded border border-warn/40 bg-warn-soft p-1.5 text-warn">⚠ {w}</div>)}
        <p className="text-ink-3">{tr('DoF_local은 현재 배치에서의 1차(무한소) 가동성을 센다. 특이 상태(예: 평탄 상태)에서는 유한 가동성보다 클 수 있으며, 쇼핑백은 유한 운동이 전혀 없는데도 DoF_local > 0이다.', 'DoF_local counts first-order (infinitesimal) mobility at the current configuration. At singular states (e.g. flat) it can exceed the finite mobility: the shopping bag has DoF_local > 0 though it has no finite motion at all.')}</p>
      </div>
      <Plot series={[{ label: 'σ_i', color: SERIES[4], x: sv.map((_, i) => i + 1), y: sv.map((v) => Math.max(v, 1e-16)), points: true }]} xLabel={tr('인덱스 i', 'Index i')} yLabel={tr('특이값 (log10)', 'Singular value (log10)')} logY />
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
  const K_NAME = { kAxial: tr('늘어남 강성', 'Stretch stiffness'), kCrease: tr('크리스 강성', 'Crease stiffness'), kFacet: tr('면 굽힘 강성', 'Facet bending stiffness') };
  const row = 'grid grid-cols-[96px_minmax(0,1fr)_52px] items-center gap-2 text-[13px]';
  const logSlider = (key: 'kAxial' | 'kCrease' | 'kFacet', lo: number, hi: number) => (
    <label className={row} title={key}>
      <span className="text-ink-3">{K_NAME[key]}</span>
      <input type="range" min={Math.log10(lo)} max={Math.log10(hi)} step={0.01} value={Math.log10(p[key])}
        onChange={(e) => setEnergyParams({ [key]: Math.pow(10, parseFloat(e.target.value)) })} className="w-full" />
      <span className="text-right tnum">{fmt(p[key], 3)}</span>
    </label>
  );
  const h = s.energyHistory;
  const ex = s.experiment;
  return (
    <div className="grid h-full grid-cols-1 gap-4 overflow-y-auto @2xl:grid-cols-[300px_minmax(0,1fr)]">
      <div className="space-y-2">
        {s.solverMode !== 'energy' && <div className="rounded-[3px] border border-info/40 bg-info-soft px-2.5 py-1.5 text-[13px] text-ink-2">{tr(<>지금은 Rigid 솔버다. 위 제목줄의 <b className="text-ink">솔버 → Energy</b>를 고르면 이 도구가 켜진다.</>, <>The Rigid solver is active. Choose <b className="text-ink">Solver → Energy</b> in the title bar above to turn on these tools.</>)}</div>}
        <div className="flex flex-wrap gap-1">
          <Button kind={s.playing ? 'danger' : 'primary'} onClick={togglePlay} disabled={s.solverMode !== 'energy'}>{s.playing ? <><Pause size={14} />{tr('일시정지', 'Pause')}</> : <><Play size={14} />{tr('동역학 실행', 'Run dynamics')}</>}</Button>
          <Button onClick={relaxNow} disabled={s.solverMode !== 'energy'} title={tr('준정적 FIRE 최소화', 'Quasi-static FIRE minimization')}>{tr('이완 (FIRE)', 'Relax (FIRE)')}</Button>
          <Button onClick={initEnergy} disabled={s.solverMode !== 'energy'}>{tr('재시작', 'Restart')}</Button>
        </div>
        <div className="lettering pt-1 text-[12px] text-ink-3">{tr('재료', 'Material')}</div>
        <div className="flex flex-wrap gap-1">
          {(['rigidLike', 'paperLike', 'veryFlexible'] as const).map((k) => (
            <Button key={k} active={s.energyPreset === k} onClick={() => applyEnergyPreset(k)}>{k === 'rigidLike' ? tr('강체에 가까움', 'Near-rigid') : k === 'paperLike' ? tr('종이', 'Paper') : tr('매우 유연함', 'Very flexible')}</Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1 text-[13px]">
          <span className="text-ink-3">{tr('크리스 정지각', 'Crease rest angle')}</span>
          <select className="h-7 rounded-[3px] border border-rule-2 bg-paper-2 px-1.5 text-[13px]" value={s.creaseRest} onChange={(e) => setCreaseRest(e.target.value as typeof s.creaseRest)}>
            <option value="current">{tr('현재 (자유 힌지)', 'Current (free hinge)')}</option>
            <option value="reference">{tr('기준 (종이 기억)', 'Reference (paper memory)')}</option>
            <option value="foldAll">{tr('배정 방향으로 모두 접기 (fold all)', 'Fold all along assignment')}</option>
          </select>
        </div>
        {s.creaseRest === 'foldAll' && (
          <label className="flex items-center gap-2 text-[13px]"><span className="text-ink-3">{tr('접힘 %', 'Fold %')}</span>
            <input type="range" min={0} max={1} step={0.01} value={s.foldPercent} onChange={(e) => setCreaseRest('foldAll', parseFloat(e.target.value))} className="w-40" /><span className="tnum">{(s.foldPercent * 100).toFixed(0)}%</span></label>
        )}
        {s.creaseRest === 'foldAll' && (
          <label className="flex items-center gap-2 text-[13px]" title={tr('pct(r) = p·max(0, 1 + g(r − ½)); g > 0이면 가장자리를 더 접고(돔), g < 0이면 중심을 더 접는다(안장)', 'pct(r) = p·max(0, 1 + g(r − ½)); g > 0 folds the edge more (dome), g < 0 folds the centre more (saddle)')}><span className="text-ink-3">{tr('반경 방향 그레이딩 g', 'Radial grading g')}</span>
            <input type="range" min={-1.5} max={1.5} step={0.05} value={s.foldGrade} onChange={(e) => setCreaseRest('foldAll', undefined, parseFloat(e.target.value))} className="w-32" /><span className="tnum">{s.foldGrade.toFixed(2)}</span></label>
        )}
        <details className="group rounded-[3px] border border-rule-2 px-2.5 py-1.5">
          <summary className="cursor-pointer select-none text-[13px] font-medium text-ink-2 hover:text-ink">{tr('재료 상세 (강성 · 감쇠 · 시간 간격)', 'Material details (stiffness · damping · time step)')}</summary>
          <div className="mt-2 space-y-1.5">
            {logSlider('kAxial', 0.5, 2000)}
            {logSlider('kCrease', 0.001, 20)}
            {logSlider('kFacet', 0.001, 200)}
            <label className={row}><span className="text-ink-3">{tr('감쇠 ζ', 'Damping ζ')}</span>
              <input type="range" min={0.05} max={1} step={0.01} value={p.damping} onChange={(e) => setEnergyParams({ damping: parseFloat(e.target.value) })} className="w-full" /><span className="text-right tnum">{p.damping.toFixed(2)}</span></label>
            <label className={row}><span className="text-ink-3">{tr('dt 배율', 'dt scale')}</span>
              <input type="range" min={0.1} max={1.5} step={0.05} value={p.dtScale} onChange={(e) => setEnergyParams({ dtScale: parseFloat(e.target.value) })} className="w-full" /><span className="text-right tnum">{p.dtScale.toFixed(2)}</span></label>
            <label className={row}><span className="text-ink-3">{tr('프레임당 스텝', 'Steps per frame')}</span>
              <input type="range" min={1} max={300} step={1} value={p.stepsPerFrame} onChange={(e) => setEnergyParams({ stepsPerFrame: parseInt(e.target.value) })} className="w-full" /><span className="text-right tnum">{p.stepsPerFrame}</span></label>
            <p className="text-[13px] leading-relaxed text-ink-3">{tr('시간 간격 dt는 가장 단단한 막대·힌지의 안정 한계로 자동으로 정해지고, 여기에 dt 배율을 곱한다.', 'The time step dt is set automatically from the stability limit of the stiffest bar or hinge, then multiplied by the dt scale.')}</p>
          </div>
        </details>
      </div>
      <div className={lesson?.experiment ? "grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]" : "grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]"}>
        <div>
          <div className="mb-1 text-[13px]">
            {s.energy && (
              <div className="tnum flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span><span className="text-ink-3">{tr('총 에너지 V', 'Total energy V')}</span> <b className="text-[15px] text-ink">{fmt(s.energy.total)}</b></span>
                <span className="text-ink-3">{tr('늘어남', 'stretch')} {fmt(s.energy.axial)} · {tr('크리스', 'crease')} {fmt(s.energy.crease)} · {tr('면 굽힘', 'facet bending')} {fmt(s.energy.facet)} · {tr('운동', 'kinetic')} {fmt(s.energy.kinetic)}</span>
              </div>
            )}
            {s.diverged && <div className="text-bad">{tr('적분이 발산했다. dt를 자동으로 절반으로 줄이고 마지막 유한 상태를 복원했다.', 'The integration diverged. dt was halved automatically and the last finite state restored.')}</div>}
          </div>
          <Plot
            series={[
              { label: tr('전체', 'Total'), color: C.ink, x: h.map((q) => q.t), y: h.map((q) => q.total) },
              { label: tr('축', 'Axial'), color: SERIES[1], x: h.map((q) => q.t), y: h.map((q) => q.axial) },
              { label: tr('크리스', 'Crease'), color: SERIES[0], x: h.map((q) => q.t), y: h.map((q) => q.crease) },
              { label: tr('면', 'Facet'), color: SERIES[2], x: h.map((q) => q.t), y: h.map((q) => q.facet) },
            ]}
            xLabel={tr('시간', 'Time')} yLabel={tr('에너지', 'Energy')}
          />
        </div>
        {lesson?.experiment && (
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-1 [&_button]:whitespace-nowrap">
              <Button kind="primary" onClick={() => runExperiment(lesson.experiment!)} disabled={ex?.running} title={lesson.experiment === 'bagCollapse' ? tr('면의 굽힘·신장을 허용하고 열린 백을 평탄 상태까지 접는다', 'Allow facet bending and stretching and fold the open bag down to flat') : undefined}>
                {ex?.running ? tr(`실행 중 ${ex.samples.length}/${ex.total + 1}…`, `Running ${ex.samples.length}/${ex.total + 1}…`) : lesson.experiment === 'kreslingAxial' ? tr('축 압축 실험 (비틀림 자유)', 'Axial compression test (free twist)') : lesson.experiment === 'yoshimuraCompression' ? tr('압축 실험 실행', 'Run compression test') : tr('납작하게 접기', 'Fold flat')}
              </Button>
              {ex && !ex.running && ex.samples.length > 1 && <Button onClick={() => playExperiment()}>{tr('다시 재생', 'Replay')}</Button>}
              {ex && <SpeedControl />}
              {ex && <Button onClick={clearExperiment}>{tr('지우기', 'Clear')}</Button>}
            </div>
            {ex && <ExperimentPlots />}
            {!ex && <p className="text-[13px] leading-relaxed text-ink-3">{tr('변위 제어 준정적 스윕: 각 단계에서 Web Worker가 에너지를 최소화(FIRE)한다. 결과는 교육용 막대-힌지 모델의 수치 추정치이다.', 'Displacement-controlled quasi-static sweep: at each step a Web Worker minimizes the energy (FIRE). Results are numerical estimates from a teaching bar-and-hinge model.')}</p>}
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
        <input type="range" className="w-full" min={0} max={Math.max(0, ex.samples.length - 1)} value={ex.index} onChange={(e) => scrubExperiment(parseInt(e.target.value))} aria-label={tr('접힘 진행률', 'Fold progress')} />
        <div className="tnum text-[13px] text-ink-3">
          {tr('접힘 진행률', 'Fold progress')} {((cur?.u ?? 0) * 100).toFixed(0)}% · V = {fmt(cur?.energy.total)} · {tr('최대 변형률', 'max strain')} {(cur ? cur.maxStrain * 100 : 0).toFixed(2)}% ({tr('경로 최대', 'path max')} {(peak * 100).toFixed(2)}%)
        </div>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
          <Plot height={170} width={380} markerX={cur?.u} series={[
            { label: tr('전체', 'Total'), color: C.ink, x: xs, y: ex.samples.map((q) => q.energy.total) },
            { label: tr('축', 'Axial'), color: SERIES[1], x: xs, y: ex.samples.map((q) => q.energy.axial) },
            { label: tr('크리스', 'Crease'), color: SERIES[0], x: xs, y: ex.samples.map((q) => q.energy.crease) },
            { label: tr('면', 'Facet'), color: SERIES[2], x: xs, y: ex.samples.map((q) => q.energy.facet) },
          ]} xLabel={tr('접힘 진행률 u (0 열림 → 1 평탄)', 'Fold progress u (0 open → 1 flat)')} yLabel="V_min(u)" />
          <Plot height={170} width={380} markerX={cur?.u} yZero series={[
            { label: tr('최대 축 변형률 (%)', 'Max axial strain (%)'), color: SERIES[3], x: xs, y: ex.samples.map((q) => q.maxStrain * 100) },
          ]} xLabel={tr('접힘 진행률 u', 'Fold progress u')} yLabel={tr('변형률 %', 'Strain %')} />
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-3">{tr('모든 크리스의 목표각을 열린 상태에서 평탄 상태로 함께 옮기며 단계마다 에너지를 최소화했다(FIRE). 양 끝은 강체 상태지만 중간에서 면이 늘어나거나 굽혀진다: 키 큰 쇼핑백이 강체로는 접히지 않는다는 정리의 수치적 모습이다.', 'All crease targets move together from open to flat, minimizing the energy at each step (FIRE). Both ends are rigid states, but in between the facets stretch or bend: the numerical face of the theorem that a tall shopping bag cannot fold rigidly.')}</p>
      </div>
    );
  }
  return (
    <div>
      <input type="range" className="w-full" min={0} max={Math.max(0, ex.samples.length - 1)} value={ex.index} onChange={(e) => scrubExperiment(parseInt(e.target.value))} />
      <div className="tnum text-[13px] text-ink-3">
        u = {cur?.u.toFixed(3)} · V = {fmt(cur?.energy.total)} · F = {fmt(cur?.reaction)} · {tr('비틀림', 'twist')} = {cur ? (cur.twist * 180 / Math.PI).toFixed(1) : '—'}° · {tr('최대 변형률', 'max strain')} {(cur ? cur.maxStrain * 100 : 0).toFixed(2)}%
      </div>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
        <Plot height={170} width={380} markerX={cur?.u} series={[
          { label: tr('전체', 'Total'), color: C.ink, x: xs, y: ex.samples.map((q) => q.energy.total) },
          { label: tr('축', 'Axial'), color: SERIES[1], x: xs, y: ex.samples.map((q) => q.energy.axial) },
          { label: tr('크리스', 'Crease'), color: SERIES[0], x: xs, y: ex.samples.map((q) => q.energy.crease) },
          { label: tr('면', 'Facet'), color: SERIES[2], x: xs, y: ex.samples.map((q) => q.energy.facet) },
        ]} xLabel={tr('변위 u', 'Displacement u')} yLabel="V_min(u)" />
        <Plot height={170} width={380} markerX={cur?.u} yZero series={ex.kind === 'kreslingAxial'
          ? [{ label: tr('반력', 'Reaction'), color: SERIES[3], x: xs, y: ex.samples.map((q) => q.reaction) }, { label: 'dV/du (FD)', color: SERIES[4], x: xs, y: fd, dashed: true }, { label: tr('비틀림 (rad)', 'Twist (rad)'), color: SERIES[6], x: xs, y: ex.samples.map((q) => q.twist) }]
          : [{ label: tr('반력', 'Reaction'), color: SERIES[3], x: xs, y: ex.samples.map((q) => q.reaction) }, { label: 'dV/du (FD)', color: SERIES[4], x: xs, y: fd, dashed: true }]} xLabel={tr('변위 u', 'Displacement u')} yLabel={tr('힘 근사값', 'Force estimate')} />
      </div>
    </div>
  );
}

export function StrainTab() {
  const s = useSim();
  const model = useModel((st) => st.model);
  if (!model) return <Empty />;
  return (
    <div className="grid h-full grid-cols-1 @2xl:grid-cols-[320px_minmax(0,1fr)] gap-3 text-[13px]">
      <div>
        <KV k={tr('최대 축 변형률 |l − L₀|/L₀', 'Max axial strain |l − L₀|/L₀')} v={s.solverMode === 'energy' ? `${(s.maxStrain * 100).toFixed(3)} %` : tr('0 (구성상 강체)', '0 (rigid by construction)')} />
        <KV k={tr('최대 면 굽힘 |α − α₀|', 'Max facet bending |α − α₀|')} v={s.solverMode === 'energy' ? `${toDeg(s.maxFacetBending).toFixed(3)}°` : tr('0 (강체)', '0 (rigid)')} />
        <KV k={tr('최대 종이 각 결손', 'Max paper angle defect')} v={fmt(s.paperDefect)} />
        <KV k={tr('충돌 (비인접 삼각형)', 'Collisions (non-adjacent triangles)')} v={s.collisionCount} />
        <p className="mt-2 text-[12px] text-ink-3">{tr('뷰포트 오버레이에서 축 변형률(Axial strain)을 켜면 꼭짓점이 인접 막대의 평균 변형률로 색칠된다 (파랑 0 → 빨강 ≥ 5%, Origami Simulator와 동일).', 'Turn on Axial strain in the viewport overlays to colour each vertex by the mean strain of its bars (blue 0 → red ≥ 5%, as in Origami Simulator).')}</p>
      </div>
      <div className="text-[12px] text-ink-3">
        {tr(<>Rigid 모드에서 면은 정확히 강체이다. 변형률과 면 굽힘은 구성상 0이며, 유일한 실패 양상은 실현 불가능이다.
        Energy 모드에서 이 값들은 요청된 운동을 실현하려면 종이가 얼마나 변형되어야 하는지, 즉 비강체 경로의 물리적 대가를 정량화한다.</>,
        <>In Rigid mode the facets are exactly rigid. Strain and facet bending are zero by construction; the only failure mode is infeasibility. In Energy mode these values measure how much the paper must deform to make the requested motion, i.e. the physical cost of a non-rigid path.</>)}
      </div>
    </div>
  );
}

function Empty() {
  return <div className="text-ink-3">{tr('이 탭은 3D 모델 레슨에만 적용된다.', 'This tab applies only to 3D model lessons.')}</div>;
}
