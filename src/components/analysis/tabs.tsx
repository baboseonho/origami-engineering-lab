import { creaseName } from '../../core/topology/names';
import { AlertTriangle, Pause, Play } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
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
import { ASSIGN_COLOR, Badge, Button, KV, SpeedControl } from '../controls/ui';
import { Rich } from '../controls/Rich';
import { PALETTE, Plot, type Series } from './Plot';
import { Caption, Lead, More, Readout } from './parts';
import { CreaseLabel, Num, TINY, deg, num } from './num';
import { SymList } from '../controls/sym';
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
    <div>
      <Lead title={tr('크리스별 접힘각', 'Fold angle of each crease')}>
        <Rich text={tr('부호가 방향이다: $\\rho > 0$ 골접기, $\\rho < 0$ 산접기. 칸을 누르면 그 크리스가 선택된다.', 'The sign is the direction: $\\rho > 0$ valley, $\\rho < 0$ mountain. Click a cell to select its crease.')} />
      </Lead>
      <div className="grid grid-cols-1 gap-5 @2xl:grid-cols-2">
        <div className="flex flex-wrap content-start gap-1">
          {creases.slice(0, 240).map((e) => {
            const v = toDeg(rho[e.id] ?? 0);
            const sel = selection?.kind === 'edge' && selection.id === e.id;
            return (
              <button key={e.id} type="button" onClick={() => useUI.getState().select({ kind: 'edge', id: e.id })}
                onMouseEnter={() => useUI.getState().setHover({ kind: 'edge', id: e.id })} onMouseLeave={() => useUI.getState().setHover(null)}
                className={`w-[96px] rounded-[3px] border px-2 py-1 text-left tnum transition-colors ${sel ? 'border-ink bg-mark/50' : 'border-rule hover:border-ink-3'} ${e.id === drive && !sel ? 'bg-paper-3' : !sel ? 'bg-paper' : ''}`}>
                <div className="flex items-baseline justify-between text-[13px]">
                  <span style={{ color: ASSIGN_COLOR[e.assignment] }}><CreaseLabel name={creaseName(model, e.id)} /></span>
                  <span className="text-[12px] text-ink-3">{e.assignment}</span>
                </div>
                <div className="relative mt-1 h-1 rounded bg-paper-3">
                  <div className="absolute top-0 h-1 rounded" style={{ left: v < 0 ? `${50 + v / 3.6}%` : '50%', width: `${Math.abs(v) / 3.6}%`, background: ASSIGN_COLOR[v < 0 ? 'M' : 'V'] }} />
                </div>
                <div className="mt-0.5 text-right text-[14px] font-medium text-ink">{num(v, 1)}°</div>
              </button>
            );
          })}
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <Caption className="mb-0">{tr('구동각에 따른 다른 접힘각 (강체 스윕)', 'Other fold angles vs. the driving angle (rigid sweep)')}</Caption>
            <Button size="sm" onClick={computeSweep} disabled={drive === null || solverMode !== 'rigid'}>{tr('스윕 계산', 'Compute sweep')}</Button>
          </div>
          <Plot series={series} emptyText={drive === null ? tr('구동 크리스를 정하면 스윕을 계산할 수 있다', 'Set a driving crease to compute a sweep') : solverMode !== 'rigid' ? tr('스윕은 Rigid 솔버에서 계산한다', 'Sweeps are computed in the Rigid solver') : tr('"스윕 계산"을 누르면 그래프가 그려진다', 'Press "Compute sweep" to draw the graph')}
            xLabel={tr('구동 크리스 ρ (°)', 'Driving crease ρ (°)')} yLabel={tr('접힘각 ρ (°)', 'Fold angle ρ (°)')} markerX={drive !== null && sweep?.edge === drive ? toDeg(target) : undefined} />
          {sweep && <p className="mt-1 text-[13px] text-ink-3">{tr(`점 ${sweep.drive.length}개, 모두 정확한 강체 배치다 (연속법).`, `${sweep.drive.length} points, each an exact rigid configuration (continuation).`)}</p>}
        </div>
      </div>
    </div>
  );
}

/** Solver status in words. */
const statusWord = (s: string | undefined) =>
  s === 'converged' ? tr('수렴', 'converged') : s === 'partial' ? tr('중간에 멈춤', 'stopped part-way') : s === 'infeasible' ? tr('해 없음', 'no solution') : s === 'idle' ? tr('대기', 'idle') : '—';

export function ConstraintsTab() {
  const hist = useSim((s) => s.residualHistory);
  const result = useSim((s) => s.result);
  const locked = useSim((s) => s.locked);
  const enforceMV = useSim((s) => s.enforceMV);
  const model = useModel((s) => s.model);
  if (!model) return <Empty />;
  return (
    <div>
      <Lead title={tr('닫힘 조건', 'Closure conditions')}>
        <Rich text={tr('강체 풀이가 모든 꼭짓점을 닫았는가. 닫힘 잔차 $\\|C(q)\\|$가 0에 가까울수록 정확한 강체 배치다.', 'Did the rigid solve close every vertex? The closer the closure residual $\\|C(q)\\|$ is to 0, the more exact the rigid configuration.')} />
      </Lead>
      <div className="grid grid-cols-1 gap-5 @2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div>
          <Readout label={<Rich text={tr('닫힘 잔차 $\\|C(q)\\|$ (마지막 풀이)', 'Closure residual $\\|C(q)\\|$ (last solve)')} />}>
            <Num value={result?.residualNorm} zero={TINY} />
          </Readout>
          <KV k={tr('풀이 결과', 'Solve result')} v={result ? <Badge status={result.success ? 'ok' : 'bad'}>{statusWord(result.status)}</Badge> : '—'} />
          <KV k={tr('반복 횟수', 'Iterations')} v={result?.iterations ?? '—'} />
          <KV k={tr('고정한 크리스', 'Locked creases')} v={locked.length ? <SymList items={locked.map((l) => creaseName(model, l))} /> : tr('없음', 'none')} />
          <KV k={tr('M/V 부호 조건', 'M/V sign condition')} v={enforceMV ? <Rich text={tr('적용 ($\\rho_M \\le 0,\\ \\rho_V \\ge 0$)', 'on ($\\rho_M \\le 0,\\ \\rho_V \\ge 0$)')} /> : tr('무시', 'ignored')} />
          <More>
            <p><Rich text={tr(
              '$C(q)$는 내부 꼭짓점마다의 닫힘 곱 $\\prod_i R(d_i, \\rho_i) - I$ (꼭짓점당 9개 성분)를 쌓은 것이고, 원통형 관이면 전역 루프 닫힘(회전과 이동)도 더한다.',
              '$C(q)$ stacks the closure product $\\prod_i R(d_i, \\rho_i) - I$ of every interior vertex (9 entries each) and, for tubes, the global loop closure (rotation and translation).')} /></p>
            <p><Rich text={tr(
              '강체 배치는 $\\|C\\| \\approx 0$ (허용오차 $10^{-9}$)을 만족한다. 연속법이 $\\|C\\|$를 작게 유지하지 못하면 풀이는 마지막으로 가능했던 상태에서 멈추고 실현 불가능을 보고한다.',
              'A rigid configuration satisfies $\\|C\\| \\approx 0$ (tolerance $10^{-9}$). If continuation cannot keep $\\|C\\|$ small, the solve stops at the last valid state and reports it infeasible.')} /></p>
          </More>
        </div>
        <Plot series={[{ label: tr('풀이마다의 잔차', 'Residual per solve'), color: SERIES[5], x: hist.map((_, i) => i + 1), y: hist.map((v) => Math.max(v, 1e-16)), points: true }]}
          xLabel={tr('풀이 번호', 'Solve number')} yLabel={tr('잔차 (로그 눈금)', 'Residual (log scale)')} logY emptyText={tr('아직 풀이 기록이 없다', 'No solves recorded yet')} />
      </div>
    </div>
  );
}

export function DofTab() {
  const dof = useSim((s) => s.dof);
  const model = useModel((s) => s.model);
  if (!model) return <Empty />;
  if (!dof) return <div className="text-[14px] text-ink-3">{tr('계산 중…', 'Computing…')}</div>;
  const sv = dof.fullRank.singularValues;
  return (
    <div>
      <Lead title={tr('자유도', 'Degrees of freedom')}>
        {tr('지금 배치에서 면을 휘지 않고 움직일 수 있는 방향의 수.', 'How many directions the current configuration can move in without bending a facet.')}
      </Lead>
      <div className="grid grid-cols-1 gap-5 @2xl:grid-cols-2">
        <div>
          <Readout label={<Rich text={tr('국소 자유도 $N - \\operatorname{rank} J$', 'Local DoF $N - \\operatorname{rank} J$')} />}>
            <span className={dof.dofLocal > 0 ? 'text-info' : 'text-warn'}>{dof.dofLocal}</span>
          </Readout>
          <KV k={<Rich text={tr('$N$ 접힘 변수 수', '$N$ fold variables')} />} v={dof.N} />
          <KV k={<Rich text={tr('$M$ 내부 꼭짓점 수', '$M$ interior vertices')} />} v={dof.M} />
          <KV k={<Rich text={tr('$N - 3M$ 단순 계수', '$N - 3M$ simple count')} />} v={<span className={dof.NMinus3M < 0 ? 'text-warn' : ''}>{num(dof.NMinus3M, 0)}</span>} />
          <KV k={<Rich text={tr('$\\operatorname{rank} J$ 꼭짓점 닫힘 ($\\le 3M$)', '$\\operatorname{rank} J$ vertex closure ($\\le 3M$)')} />} v={dof.vertexRank.rank} />
          {dof.usesLoops && <KV k={<Rich text={tr('$\\operatorname{rank} J$ 전역 루프 포함', '$\\operatorname{rank} J$ with global loops')} />} v={dof.fullRank.rank} />}
          <KV k={tr('중복된 꼭짓점 조건', 'Redundant vertex conditions')} v={dof.redundantVertexConstraints} />
          <KV k={<Rich text={tr('조건수 $\\kappa$', 'Condition number $\\kappa$')} />} v={<Num value={dof.fullRank.condition} d={1} />} />
          {dof.warnings.length === 0
            ? <p className="mt-2 text-[14px] text-ok">{tr('여기서는 단순 계수와 야코비안 계수가 같은 답을 준다.', 'Here the simple count and the Jacobian rank agree.')}</p>
            : dof.warnings.map((w, i) => (
              <p key={i} className="mt-2 flex gap-2 rounded-[3px] border border-warn/50 bg-warn-soft px-2.5 py-1.5 text-[14px] leading-snug text-ink-2">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warn" aria-hidden />{w}
              </p>
            ))}
          <More>
            <p><Rich text={tr(
              '$N - \\operatorname{rank} J$는 현재 배치에서의 1차(무한소) 가동성을 센다. 평탄 상태 같은 특이 상태에서는 실제로 끝까지 움직일 수 있는 방향보다 클 수 있다. 쇼핑백은 유한한 운동이 전혀 없는데도 이 값이 0보다 크다.',
              '$N - \\operatorname{rank} J$ counts first-order (infinitesimal) mobility at the current configuration. At singular states such as the flat state it can exceed the real, finite mobility: the shopping bag has no finite motion at all, yet this value is above 0.')} /></p>
          </More>
        </div>
        <Plot series={[{ label: tr('특이값 σ (큰 것부터)', 'Singular values σ (largest first)'), color: SERIES[4], x: sv.map((_, i) => i + 1), y: sv.map((v) => Math.max(v, 1e-16)), points: true }]}
          xLabel={tr('순서', 'Index')} yLabel={tr('특이값 (로그 눈금)', 'Singular value (log scale)')} logY />
      </div>
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
  const energyOn = s.solverMode === 'energy';
  const K_NAME = { kAxial: tr('늘어남 강성', 'Stretch stiffness'), kCrease: tr('크리스 강성', 'Crease stiffness'), kFacet: tr('면 굽힘 강성', 'Facet bending stiffness') };
  const row = 'grid grid-cols-[112px_minmax(0,1fr)_60px] items-center gap-2 text-[13px]';
  const logSlider = (key: 'kAxial' | 'kCrease' | 'kFacet', lo: number, hi: number) => (
    <label className={row}>
      <span className="text-ink-3">{K_NAME[key]}</span>
      <input type="range" min={Math.log10(lo)} max={Math.log10(hi)} step={0.01} value={Math.log10(p[key])}
        onChange={(e) => setEnergyParams({ [key]: Math.pow(10, parseFloat(e.target.value)) })} className="w-full" />
      <span className="text-right tnum text-[14px] text-ink"><Num value={p[key]} d={3} /></span>
    </label>
  );
  const h = s.energyHistory;
  const ex = s.experiment;
  return (
    <div>
      <Lead title={tr('에너지', 'Energy')}>
        {tr('막대-힌지 모델에서 종이가 얼마나 늘어나고 휘는지를 에너지로 본다.', 'How much the paper stretches and bends, read as energy in the bar-and-hinge model.')}
      </Lead>
      {!energyOn && (
        <p className="mb-3 rounded-[3px] border border-info/40 bg-info-soft px-3 py-2 text-[14px] text-ink-2">
          {tr(<>지금은 Rigid 솔버다. 위 제목줄의 <b className="text-ink">솔버 → Energy</b>를 고르면 아래 도구가 켜진다.</>, <>The Rigid solver is active. Choose <b className="text-ink">Solver → Energy</b> in the title bar above to turn on these tools.</>)}
        </p>
      )}
      <div className="grid grid-cols-1 gap-5 @2xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-4">
          <div>
            {s.energy && (
              <div className="mb-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="flex items-baseline gap-2"><span className="text-[13px] text-ink-3">{tr('총 에너지 V', 'Total energy V')}</span><b className="text-[18px] font-semibold text-ink"><Num value={s.energy.total} zero={TINY} /></b></span>
                <span className="flex flex-wrap gap-x-3 text-[13px] text-ink-3">
                  <span>{tr('늘어남', 'stretch')} <Num value={s.energy.axial} zero={TINY} className="text-ink-2" /></span>
                  <span>{tr('크리스', 'crease')} <Num value={s.energy.crease} zero={TINY} className="text-ink-2" /></span>
                  <span>{tr('면 굽힘', 'facet bending')} <Num value={s.energy.facet} zero={TINY} className="text-ink-2" /></span>
                  <span>{tr('운동', 'kinetic')} <Num value={s.energy.kinetic} zero={TINY} className="text-ink-2" /></span>
                </span>
              </div>
            )}
            {s.diverged && <p className="mb-1 rounded-[3px] border border-bad/40 bg-bad-soft px-2.5 py-1.5 text-[14px] text-ink-2">{tr('적분이 발산했다. dt를 자동으로 절반으로 줄이고 마지막 유한 상태를 복원했다.', 'The integration diverged. dt was halved automatically and the last finite state restored.')}</p>}
            <Plot
              series={[
                { label: tr('전체', 'Total'), color: C.ink, x: h.map((q) => q.t), y: h.map((q) => q.total) },
                { label: tr('늘어남', 'Stretch'), color: SERIES[1], x: h.map((q) => q.t), y: h.map((q) => q.axial) },
                { label: tr('크리스', 'Crease'), color: SERIES[0], x: h.map((q) => q.t), y: h.map((q) => q.crease) },
                { label: tr('면 굽힘', 'Facet bending'), color: SERIES[2], x: h.map((q) => q.t), y: h.map((q) => q.facet) },
              ]}
              emptyText={energyOn ? tr('"동역학 실행"이나 "이완"을 누르면 기록된다', 'Press "Run dynamics" or "Relax" to record') : tr('Energy 솔버에서 기록된다', 'Recorded in the Energy solver')}
              xLabel={tr('시간', 'Time')} yLabel={tr('에너지', 'Energy')}
            />
          </div>
          {lesson?.experiment && (
            <div>
              <Caption>{tr('실험', 'Experiment')}</Caption>
              <div className="mb-2 flex flex-wrap items-center gap-1.5 [&_button]:whitespace-nowrap">
                <Button kind="primary" onClick={() => runExperiment(lesson.experiment!)} disabled={ex?.running} title={lesson.experiment === 'bagCollapse' ? tr('면의 굽힘·신장을 허용하고 열린 백을 평탄 상태까지 접는다', 'Allow facet bending and stretching and fold the open bag down to flat') : undefined}>
                  {ex?.running ? tr(`실행 중 ${ex.samples.length}/${ex.total + 1}…`, `Running ${ex.samples.length}/${ex.total + 1}…`) : lesson.experiment === 'kreslingAxial' ? tr('축 압축 실험 (비틀림 자유)', 'Axial compression test (free twist)') : lesson.experiment === 'yoshimuraCompression' ? tr('압축 실험 실행', 'Run compression test') : tr('납작하게 접기', 'Fold flat')}
                </Button>
                {ex && !ex.running && ex.samples.length > 1 && <Button onClick={() => playExperiment()}>{tr('다시 재생', 'Replay')}</Button>}
                {ex && <Button onClick={clearExperiment}>{tr('지우기', 'Clear')}</Button>}
                {ex && <SpeedControl className="ml-auto" />}
              </div>
              {ex ? <ExperimentPlots /> : <p className="text-[14px] leading-relaxed text-ink-3">{tr('변위를 조금씩 주며 단계마다 에너지를 최소화(FIRE)하는 준정적 실험이다. 결과는 교육용 막대-힌지 모델의 수치 추정치다.', 'A quasi-static test: the displacement is stepped and the energy is minimized (FIRE) at each step. Results are numerical estimates from a teaching bar-and-hinge model.')}</p>}
            </div>
          )}
        </div>
        <div className="space-y-3">
          <div>
            <Caption>{tr('실행', 'Run')}</Caption>
            <div className="flex flex-wrap gap-1.5">
              <Button kind={s.playing ? 'danger' : 'primary'} onClick={togglePlay} disabled={!energyOn}>{s.playing ? <><Pause size={14} />{tr('일시정지', 'Pause')}</> : <><Play size={14} />{tr('동역학 실행', 'Run dynamics')}</>}</Button>
              <Button onClick={relaxNow} disabled={!energyOn} title={tr('준정적 FIRE 최소화', 'Quasi-static FIRE minimization')}>{tr('이완 (FIRE)', 'Relax (FIRE)')}</Button>
              <Button onClick={initEnergy} disabled={!energyOn}>{tr('재시작', 'Restart')}</Button>
            </div>
          </div>
          <div>
            <Caption>{tr('재료', 'Material')}</Caption>
            <div className="flex flex-wrap gap-1.5">
              {(['rigidLike', 'paperLike', 'veryFlexible'] as const).map((k) => (
                <Button key={k} active={s.energyPreset === k} onClick={() => applyEnergyPreset(k)}>{k === 'rigidLike' ? tr('강체에 가까움', 'Near-rigid') : k === 'paperLike' ? tr('종이', 'Paper') : tr('매우 유연함', 'Very flexible')}</Button>
              ))}
            </div>
          </div>
          <div>
            <Caption>{tr('크리스 정지각', 'Crease rest angle')}</Caption>
            <select aria-label={tr('크리스 정지각', 'Crease rest angle')} className="h-8 w-full rounded-[3px] border border-rule-2 bg-paper px-2 text-[14px] text-ink" value={s.creaseRest} onChange={(e) => setCreaseRest(e.target.value as typeof s.creaseRest)}>
              <option value="current">{tr('현재 각 (자유 힌지)', 'Current angle (free hinge)')}</option>
              <option value="reference">{tr('기준 형상 (종이의 기억)', 'Reference shape (paper memory)')}</option>
              <option value="foldAll">{tr('배정 방향으로 모두 접기', 'Fold all along the assignment')}</option>
            </select>
            {s.creaseRest === 'foldAll' && (
              <div className="mt-2 space-y-1.5">
                <label className={row}><span className="text-ink-3">{tr('접힘 정도', 'Fold amount')}</span>
                  <input type="range" min={0} max={1} step={0.01} value={s.foldPercent} onChange={(e) => setCreaseRest('foldAll', parseFloat(e.target.value))} className="w-full" />
                  <span className="text-right tnum text-[14px] text-ink">{(s.foldPercent * 100).toFixed(0)}%</span></label>
                <label className={row} title={tr('g > 0이면 가장자리를 더 접고(돔), g < 0이면 중심을 더 접는다(안장)', 'g > 0 folds the edge more (dome), g < 0 folds the centre more (saddle)')}>
                  <span className="text-ink-3">{tr('반경 방향 차등 g', 'Radial grading g')}</span>
                  <input type="range" min={-1.5} max={1.5} step={0.05} value={s.foldGrade} onChange={(e) => setCreaseRest('foldAll', undefined, parseFloat(e.target.value))} className="w-full" />
                  <span className="text-right tnum text-[14px] text-ink">{num(s.foldGrade, 2)}</span></label>
              </div>
            )}
          </div>
          <details className="group rounded-[3px] border border-rule-2 px-2.5 py-1.5">
            <summary className="cursor-pointer select-none text-[13px] font-medium text-ink-2 hover:text-ink">{tr('재료 상세 (강성 · 감쇠 · 시간 간격)', 'Material details (stiffness · damping · time step)')}</summary>
            <div className="mt-2 space-y-1.5">
              {logSlider('kAxial', 0.5, 2000)}
              {logSlider('kCrease', 0.001, 20)}
              {logSlider('kFacet', 0.001, 200)}
              <label className={row}><span className="text-ink-3">{tr('감쇠 ζ', 'Damping ζ')}</span>
                <input type="range" min={0.05} max={1} step={0.01} value={p.damping} onChange={(e) => setEnergyParams({ damping: parseFloat(e.target.value) })} className="w-full" /><span className="text-right tnum text-[14px] text-ink">{p.damping.toFixed(2)}</span></label>
              <label className={row}><span className="text-ink-3">{tr('시간 간격 배율', 'Time-step scale')}</span>
                <input type="range" min={0.1} max={1.5} step={0.05} value={p.dtScale} onChange={(e) => setEnergyParams({ dtScale: parseFloat(e.target.value) })} className="w-full" /><span className="text-right tnum text-[14px] text-ink">{p.dtScale.toFixed(2)}</span></label>
              <label className={row}><span className="text-ink-3">{tr('프레임당 스텝', 'Steps per frame')}</span>
                <input type="range" min={1} max={300} step={1} value={p.stepsPerFrame} onChange={(e) => setEnergyParams({ stepsPerFrame: parseInt(e.target.value) })} className="w-full" /><span className="text-right tnum text-[14px] text-ink">{p.stepsPerFrame}</span></label>
              <p className="text-[13px] leading-relaxed text-ink-3">{tr('시간 간격은 가장 단단한 막대·힌지의 안정 한계로 자동으로 정해지고, 여기에 배율을 곱한다.', 'The time step is set automatically from the stability limit of the stiffest bar or hinge, then multiplied by this scale.')}</p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

/** A short "label value" pair in a readout line. */
function Pair({ k, children }: { k: ReactNode; children: ReactNode }) {
  return <span className="whitespace-nowrap"><span className="text-ink-3">{k}</span> <span className="tnum text-ink">{children}</span></span>;
}

function ExperimentPlots() {
  const ex = useSim((s) => s.experiment)!;
  const xs = ex.samples.map((q) => q.u);
  const fd = finiteDifferenceForce(ex.samples);
  const cur = ex.samples[ex.index];
  const energySeries = [
    { label: tr('전체', 'Total'), color: C.ink, x: xs, y: ex.samples.map((q) => q.energy.total) },
    { label: tr('늘어남', 'Stretch'), color: SERIES[1], x: xs, y: ex.samples.map((q) => q.energy.axial) },
    { label: tr('크리스', 'Crease'), color: SERIES[0], x: xs, y: ex.samples.map((q) => q.energy.crease) },
    { label: tr('면 굽힘', 'Facet bending'), color: SERIES[2], x: xs, y: ex.samples.map((q) => q.energy.facet) },
  ];
  const minE = tr('최소 에너지 V', 'Minimum energy V');
  if (ex.kind === 'bagCollapse') {
    // fold-to-state sweep: u is the fold progress, not a displacement
    const peak = ex.samples.reduce((m, q) => Math.max(m, q.maxStrain), 0);
    return (
      <div>
        <input type="range" className="w-full" min={0} max={Math.max(0, ex.samples.length - 1)} value={ex.index} onChange={(e) => scrubExperiment(parseInt(e.target.value))} aria-label={tr('접힘 진행률', 'Fold progress')} />
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-0.5 text-[14px]">
          <Pair k={tr('접힘 진행률', 'Fold progress')}>{((cur?.u ?? 0) * 100).toFixed(0)}%</Pair>
          <Pair k="V">{cur ? <Num value={cur.energy.total} zero={TINY} /> : '—'}</Pair>
          <Pair k={tr('최대 변형률', 'Max strain')}>{num(cur ? cur.maxStrain * 100 : 0, 2)}%</Pair>
          <Pair k={tr('경로 중 최대', 'Path max')}>{num(peak * 100, 2)}%</Pair>
        </div>
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
          <Plot height={190} markerX={cur?.u} series={energySeries} xLabel={tr('접힘 진행률 u (0 열림 → 1 평탄)', 'Fold progress u (0 open → 1 flat)')} yLabel={minE} />
          <Plot height={190} markerX={cur?.u} yZero series={[
            { label: tr('최대 축 변형률 (%)', 'Max axial strain (%)'), color: SERIES[3], x: xs, y: ex.samples.map((q) => q.maxStrain * 100) },
          ]} xLabel={tr('접힘 진행률 u', 'Fold progress u')} yLabel={tr('변형률 (%)', 'Strain (%)')} />
        </div>
        <More>
          <p>{tr('모든 크리스의 목표각을 열린 상태에서 평탄 상태로 함께 옮기며 단계마다 에너지를 최소화했다(FIRE). 양 끝은 강체 상태지만 중간에서 면이 늘어나거나 굽혀진다: 키 큰 쇼핑백이 강체로는 접히지 않는다는 정리의 수치적 모습이다.', 'All crease targets move together from open to flat, minimizing the energy at each step (FIRE). Both ends are rigid states, but in between the facets stretch or bend: the numerical face of the theorem that a tall shopping bag cannot fold rigidly.')}</p>
        </More>
      </div>
    );
  }
  return (
    <div>
      <input type="range" className="w-full" min={0} max={Math.max(0, ex.samples.length - 1)} value={ex.index} onChange={(e) => scrubExperiment(parseInt(e.target.value))} aria-label={tr('실험 프레임', 'Experiment frame')} />
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-0.5 text-[14px]">
        <Pair k="u">{num(cur?.u, 3)}</Pair>
        <Pair k="V">{cur ? <Num value={cur.energy.total} zero={TINY} /> : '—'}</Pair>
        <Pair k="F">{cur ? <Num value={cur.reaction} zero={TINY} /> : '—'}</Pair>
        <Pair k={tr('비틀림', 'Twist')}>{cur ? deg(cur.twist, 1) : '—'}</Pair>
        <Pair k={tr('최대 변형률', 'Max strain')}>{num(cur ? cur.maxStrain * 100 : 0, 2)}%</Pair>
      </div>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
        <Plot height={190} markerX={cur?.u} series={energySeries} xLabel={tr('변위 u', 'Displacement u')} yLabel={minE} />
        <Plot height={190} markerX={cur?.u} yZero series={[
          { label: tr('반력 F', 'Reaction F'), color: SERIES[3], x: xs, y: ex.samples.map((q) => q.reaction) },
          { label: tr('$dV/du$ (유한 차분)', '$dV/du$ (finite difference)'), color: SERIES[4], x: xs, y: fd, dashed: true },
          ...(ex.kind === 'kreslingAxial' ? [{ label: tr('비틀림 (rad)', 'Twist (rad)'), color: SERIES[6], x: xs, y: ex.samples.map((q) => q.twist) }] : []),
        ]} xLabel={tr('변위 u', 'Displacement u')} yLabel={tr('힘 (근사)', 'Force (estimate)')} />
      </div>
    </div>
  );
}

export function StrainTab() {
  const s = useSim();
  const model = useModel((st) => st.model);
  if (!model) return <Empty />;
  const energy = s.solverMode === 'energy';
  return (
    <div className="max-w-[640px]">
      <Lead title={tr('변형률', 'Strain')}>
        {tr('요청한 운동을 위해 종이가 얼마나 늘어나고 휘었는가. Rigid 모드에서는 구성상 0이다.', 'How much the paper had to stretch and bend for the requested motion. In Rigid mode it is zero by construction.')}
      </Lead>
      <Readout label={<Rich text={tr('최대 축 변형률 $|l - L_0| / L_0$', 'Max axial strain $|l - L_0| / L_0$')} />}>
        {energy ? `${num(s.maxStrain * 100, 2)}%` : '0%'}
      </Readout>
      <KV k={<Rich text={tr('최대 면 굽힘 $|\\alpha - \\alpha_0|$', 'Max facet bending $|\\alpha - \\alpha_0|$')} />} v={energy ? deg(s.maxFacetBending, 2) : tr('0° (강체)', '0° (rigid)')} />
      <KV k={tr('최대 종이 각 결손', 'Max paper angle defect')} v={deg(s.paperDefect, 2)} />
      <KV k={tr('자기 교차 (이웃하지 않은 삼각형 쌍)', 'Self-intersections (non-adjacent triangle pairs)')} v={s.collisionCount} />
      <More>
        <p>{tr('Rigid 모드에서 면은 정확히 강체다. 변형률과 면 굽힘은 구성상 0이고, 실패하는 방식은 "해 없음" 하나뿐이다. Energy 모드에서는 이 값들이 요청한 운동의 물리적 대가, 즉 비강체 경로에서 종이가 얼마나 변형되어야 하는지를 잰다.', 'In Rigid mode the facets are exactly rigid. Strain and facet bending are zero by construction, and the only way to fail is "no solution". In Energy mode these values measure the physical cost of the requested motion: how much the paper must deform on a non-rigid path.')}</p>
        <p>{tr('뷰포트의 "표시 항목"에서 축 변형률을 켜면 꼭짓점이 인접 막대의 평균 변형률로 칠해진다 (파랑 0 → 빨강 5% 이상, Origami Simulator와 같은 방식).', 'Turn on axial strain under "Overlays" in the viewport to colour each vertex by the mean strain of its bars (blue 0 → red 5% or more, as in Origami Simulator).')}</p>
      </More>
    </div>
  );
}

function Empty() {
  return <div className="text-[14px] text-ink-3">{tr('이 탭은 3D 모델 레슨에만 적용된다.', 'This tab applies only to 3D model lessons.')}</div>;
}
