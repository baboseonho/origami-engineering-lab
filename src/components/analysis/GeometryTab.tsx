import { useMemo, useState } from 'react';
import { analyzeVertex, kreslingCompatibility, sheetDims } from '../../core/analysis/metrics';
import { toDeg } from '../../core/geometry/angles';
import { DEG } from '../../core/numerics/tolerances';
import { RigidKinematicSolver } from '../../core/solver/rigid/RigidKinematicSolver';
import { isCrease } from '../../core/topology/types';
import { kreslingSecondState } from '../../models/generators/kresling';
import { lessonById } from '../../curriculum/lessons';
import { engine } from '../../state/engine';
import { useModel } from '../../state/modelStore';
import { useSim } from '../../state/simulationStore';
import { useUI } from '../../state/uiStore';
import { referenceStateResidual, showReferenceState } from '../../state/actions';
import { Badge, Button, KV } from '../controls/ui';
import { Rich } from '../controls/Rich';
import { Caption, Lead, More, Readout } from './parts';
import { Num, TINY, deg, num, plainNum } from './num';
import { Plot } from './Plot';
import { SERIES } from '../../theme/tokens';
import { tr } from '../../i18n';

/** Schenk & Guest (2013) unit-cell dimensions; θ = facet-to-plane angle, γ = acute angle. */
function miuraCell(a: number, b: number, g: number, th: number) {
  const S = (b * Math.cos(th) * Math.tan(g)) / Math.sqrt(1 + Math.cos(th) ** 2 * Math.tan(g) ** 2);
  const L = a * Math.sqrt(1 - Math.sin(th) ** 2 * Math.sin(g) ** 2);
  return { S, L };
}

function MiuraMetrics() {
  const model = useModel((s) => s.model)!;
  const rho = useSim((s) => s.rho);
  const sweep = useSim((s) => s.sweep);
  const drive = useSim((s) => s.drive);
  const target = useSim((s) => s.target);
  const auxetic = useUI((s) => s.auxetic);
  const dims = useMemo(() => sheetDims(model, engine.positions), [model, rho]); // eslint-disable-line react-hooks/exhaustive-deps
  const P = model.params as Record<string, number>;
  const labels = Object.entries(model.edu.creaseLabels);
  const zig = labels.find(([, l]) => l === 'ρ2');
  const theta = zig ? Math.abs(rho[+zig[0]]) / 2 : 0;
  // finite-difference response at the current state (two extra rigid solves on a clone)
  const fd = useMemo(() => {
    if (drive === null || !engine.rigid) return null;
    const s = new RigidKinematicSolver(model, engine.rigid.rho, engine.rigid.options);
    const h = 0.5 * DEG;
    const cur = engine.rigid.rho[drive];
    const sg = cur >= 0 ? 1 : -1;
    s.setDrivingCrease(drive, cur + sg * h);
    if (!s.solve().success) return null;
    const d1 = sheetDims(model, s.positions());
    const d0 = sheetDims(model, engine.rigid.positions());
    if (!d0 || !d1) return null;
    const dW = (d1.W - d0.W) / h, dL = (d1.L - d0.L) / h;
    return { dW, dL, nu: -((d1.L - d0.L) / d0.L) / ((d1.W - d0.W) / d0.W), d0 };
  }, [model, drive, rho]); // eslint-disable-line react-hooks/exhaustive-deps
  const nuAnalytic = useMemo(() => {
    const g = P.alphaDeg * DEG;
    const h = 1e-5;
    const c0 = miuraCell(P.a, P.b, g, theta), c1 = miuraCell(P.a, P.b, g, theta + h);
    // our W runs along the a-edges (S&G "L"), our L along the zig-zag (S&G "S")
    return -((c1.S - c0.S) / c0.S) / ((c1.L - c0.L) / c0.L);
  }, [P.a, P.b, P.alphaDeg, theta]);
  const xs = sweep?.drive.map(toDeg) ?? [];
  const noSweep = drive === null ? tr('구동 크리스를 정하고 "접힘각" 탭에서 스윕을 계산하면 그려진다', 'Set a driving crease and compute a sweep in the "Fold angles" tab to draw this') : tr('"접힘각" 탭에서 스윕을 계산하면 그려진다', 'Compute a sweep in the "Fold angles" tab to draw this');
  return (
    <div>
      <Lead title={tr('미우라 시트의 크기', 'Size of the Miura sheet')}>
        {tr('접을수록 시트가 두 방향으로 함께 줄어든다 (음의 푸아송비).', 'As it folds, the sheet shrinks in both directions at once (negative Poisson ratio).')}
      </Lead>
      <div className="grid grid-cols-1 gap-5 @2xl:grid-cols-2 @5xl:grid-cols-[300px_minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <Readout label={<Rich text={tr('푸아송비 $\\nu$ (측정)', 'Poisson ratio $\\nu$ (measured)')} />} note={fd ? <Badge status={fd.nu < 0 ? 'ok' : 'warn'}>{fd.nu < 0 ? tr('오세틱', 'auxetic') : tr('오세틱 아님', 'not auxetic')}</Badge> : undefined}>
            {fd ? num(fd.nu, 3) : '—'}
          </Readout>
          <KV k={<Rich text={tr('$\\nu$ 단위 셀 (Schenk–Guest)', '$\\nu$ unit cell (Schenk–Guest)')} />} v={Number.isFinite(nuAnalytic) ? num(nuAnalytic, 3) : '—'} />
          <KV k={tr('폭 W (직선 크리스 방향)', 'Width W (along the straight creases)')} v={dims ? num(dims.W, 3) : '—'} />
          <KV k={tr('길이 L (지그재그 방향)', 'Length L (along the zig-zag)')} v={dims ? num(dims.L, 3) : '—'} />
          <KV k={tr('두께 T', 'Thickness T')} v={dims ? num(dims.T, 3) : '—'} />
          <KV k={tr('점유 면적 / 평면일 때', 'Footprint / when flat')} v={dims ? num(dims.areaRatio, 3) : '—'} />
          <KV k={<Rich text={tr('면-평면 각 $\\theta = |\\rho_{\\text{zigzag}}|/2$', 'Facet-to-plane angle $\\theta = |\\rho_{\\text{zigzag}}|/2$')} />} v={deg(theta, 1)} />
          <KV k={<Rich text={tr('$dW/d\\rho,\\ dL/d\\rho$ (rad당)', '$dW/d\\rho,\\ dL/d\\rho$ (per rad)')} />} v={fd ? `${num(fd.dW, 3)}, ${num(fd.dL, 3)}` : '—'} />
          <div className="mt-2">
            <Button size="sm" active={!!auxetic} disabled={!fd} onClick={() => {
              if (auxetic || !fd) { useUI.setState({ auxetic: null }); return; }
              useUI.setState({ auxetic: { axisW: fd.d0.axisW, axisL: fd.d0.axisL, signW: Math.sign(fd.dW), signL: Math.sign(fd.dL) } });
            }}>{tr('3D에 오세틱 화살표 표시', 'Show auxetic arrows in 3D')}</Button>
          </div>
          <More>
            <p><Rich text={tr('측정 $\\nu = -\\,d\\ln L \\,/\\, d\\ln W$는 두 번의 강체 풀이(유한 차분)로 얻은 실제 꼭짓점 위치에서 계산한다. 화살표도 손으로 그린 것이 아니다.', 'The measured $\\nu = -\\,d\\ln L \\,/\\, d\\ln W$ comes from the actual vertex positions of two rigid solves (a finite difference). The arrows are not hand-drawn either.')} /></p>
            <p>{tr('측정값은 유한한 시트의 경계 중심을 쓰고, 단위 셀 값은 무한히 반복되는 테셀레이션에 대한 값이다. 그래서 둘이 조금 다르다.', 'The measured value uses the boundary centres of the finite sheet; the unit-cell value is for an infinite tessellation, so the two differ slightly.')}</p>
          </More>
        </div>
        <Plot series={sweep ? [{ label: tr('폭 W', 'Width W'), color: SERIES[0], x: xs, y: sweep.dims.map((d) => d.W) }, { label: tr('길이 L', 'Length L'), color: SERIES[1], x: xs, y: sweep.dims.map((d) => d.L) }] : []}
          emptyText={noSweep} xLabel={tr('구동 크리스 ρ (°)', 'Driving crease ρ (°)')} yLabel={tr('시트 크기', 'Sheet size')} markerX={drive !== null ? toDeg(target) : undefined} />
        <Plot series={sweep ? [{ label: tr('두께 T', 'Thickness T'), color: SERIES[2], x: xs, y: sweep.dims.map((d) => d.T) }, { label: tr('면적 / 평면일 때', 'Area / when flat'), color: SERIES[3], x: xs, y: sweep.dims.map((d) => (d.W * d.L) / ((sweep.dims[0].W * sweep.dims[0].L) || 1)) }] : []}
          emptyText={noSweep} xLabel={tr('구동 크리스 ρ (°)', 'Driving crease ρ (°)')} yLabel={tr('두께 · 면적비', 'Thickness · area ratio')} markerX={drive !== null ? toDeg(target) : undefined} />
      </div>
    </div>
  );
}

function CurvaturePanel() {
  const model = useModel((s) => s.model)!;
  const defects = useSim((s) => s.coarseDefects);
  const paperDefect = useSim((s) => s.paperDefect);
  const vals = defects.map(([, k]) => k);
  const max = vals.length ? Math.max(...vals) : 0, min = vals.length ? Math.min(...vals) : 0;
  const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  const pts = defects.map(([v, k]) => ({ p: model.vertices[v].initialPosition2D, k }));
  const xs = pts.map((q) => q.p[0]), ys = pts.map((q) => q.p[1]);
  const x0 = Math.min(...xs, 0), x1 = Math.max(...xs, 1), y0 = Math.min(...ys, 0), y1 = Math.max(...ys, 1);
  const scaleK = Math.max(Math.abs(max), Math.abs(min), 1e-6);
  return (
    <div>
      <Lead title={tr('곡률', 'Curvature')}>
        {tr('접힌 워터밤은 돔처럼 휠까, 안장처럼 휠까. 베이스 중심을 이은 거친 곡면의 곡률로 본다.', 'Does the folded waterbomb curve like a dome or a saddle? Read it from the curvature of the coarse surface through the base centres.')}
      </Lead>
      <div className="grid grid-cols-1 gap-5 @2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <Readout label={tr('거친 곡면 K 평균', 'Coarse surface K, mean')} note={vals.length > 0 ? (mean > 1e-4 ? <Badge status="ok">{tr('돔형 (양수)', 'dome (positive)')}</Badge> : mean < -1e-4 ? <Badge status="warn">{tr('안장형 (음수)', 'saddle (negative)')}</Badge> : <Badge status="na">{tr('평평 / 원통형 (≈ 0)', 'flat / cylindrical (≈ 0)')}</Badge>) : undefined}>
            {vals.length ? deg(mean, 2) : '—'}
          </Readout>
          <KV k={tr('K 최대 / 최소', 'K max / min')} v={vals.length ? `${deg(max, 2)} / ${deg(min, 2)}` : '—'} />
          <KV k={tr('내부 꼭짓점 수 (거친 곡면)', 'Interior vertices (coarse surface)')} v={vals.length} />
          <KV k={tr('종이 자체의 각 결손 (최대 |K|)', 'Angle defect of the paper itself (max |K|)')} v={deg(paperDefect, 2)} />
          <More>
            <p><Rich text={tr('거친 곡면의 각 내부 꼭짓점에서 $K \\approx 2\\pi - \\sum \\theta$ 이다. 종이 자체는 전개 가능하게 남아 있고(종이의 각 결손 $\\approx 0$), 유효 $K$가 양수이면 접힌 테셀레이션이 돔을 근사한다는 뜻이다.', 'At each interior vertex of the coarse surface $K \\approx 2\\pi - \\sum \\theta$. The paper itself stays developable (its angle defect is $\\approx 0$); a positive effective $K$ means the folded tessellation approximates a dome.')} /></p>
            <p>{tr('교육용 추정치이며 미분기하 솔버가 아니다.', 'This is a teaching estimate, not a differential-geometry solver.')}</p>
          </More>
        </div>
        <figure className="m-0">
          <figcaption className="mb-1 flex flex-wrap items-center gap-x-3 text-[13px] text-ink-2">
            <span className="font-medium text-ink">{tr('꼭짓점별 K', 'K at each vertex')}</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: 'rgb(239,68,68)' }} />{tr('양수 (돔)', 'positive (dome)')}</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: 'rgb(59,130,246)' }} />{tr('음수 (안장)', 'negative (saddle)')}</span>
            <span className="text-ink-3">{tr('진할수록 큼', 'darker = larger')}</span>
          </figcaption>
          <svg viewBox={`${x0 - 0.5} ${-y1 - 0.5} ${x1 - x0 + 1} ${y1 - y0 + 1}`} className="h-44 w-full rounded-[3px] border border-rule bg-paper-2" role="img" aria-label={tr('꼭짓점별 곡률 지도', 'Curvature map by vertex')}>
            {pts.map((q, i) => {
              const t = q.k / scaleK;
              return <circle key={i} cx={q.p[0]} cy={-q.p[1]} r={0.22} fill={t >= 0 ? `rgba(239,68,68,${0.25 + 0.75 * t})` : `rgba(59,130,246,${0.25 - 0.75 * t})`}><title>{deg(q.k, 2)}</title></circle>;
            })}
          </svg>
        </figure>
      </div>
    </div>
  );
}

function KreslingCompat() {
  const params = useModel((s) => s.params) as Record<string, number>;
  const P = { n: params.n, R: params.R, H: params.H, phi: params.phi * DEG };
  const st = kreslingSecondState(P);
  const data = useMemo(() => (st ? kreslingCompatibility(P.n, P.R, P.H, P.phi, st.H, 60) : []), [P.n, P.R, P.H, P.phi]); // eslint-disable-line react-hooks/exhaustive-deps
  const maxS = data.reduce((m, d) => Math.max(m, Math.abs(d.cStrain)), 0);
  return (
    <div>
      <Lead title={tr('두 안정 상태 사이의 길', 'The path between the two stable states')}>
        {tr('같은 모서리 길이로 두 상태가 있어도, 그 사이를 강체로 지나가려면 대각선이 늘어나야 한다.', 'Two states share the same edge lengths, yet passing between them rigidly would need the diagonal to stretch.')}
      </Lead>
      <div className="grid grid-cols-1 gap-5 @2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div>
          <Readout label={tr('대각선 c의 최대 변형률', 'Max strain of diagonal c')}>{st ? `${num(maxS * 100, 2)}%` : '—'}</Readout>
          <KV k={<Rich text={tr('상태 0: $H_0,\\ \\varphi_0$', 'State 0: $H_0,\\ \\varphi_0$')} />} v={`${num(P.H, 3)}, ${deg(P.phi, 1)}`} />
          <KV k={<Rich text={tr('상태 1: $H_1,\\ \\varphi_1$ (같은 $a, b, c$)', 'State 1: $H_1,\\ \\varphi_1$ (same $a, b, c$)')} />} v={st ? `${num(st.H, 3)}, ${deg(st.phi, 1)}` : <Rich text={tr('없음 ($H_1^2 < 0$)', 'none ($H_1^2 < 0$)')} />} />
          <KV k={<Rich text={tr('예측 비틀림 $\\varphi_1 - \\varphi_0$', 'Predicted twist $\\varphi_1 - \\varphi_0$')} />} v={st ? deg(st.phi - P.phi, 1, true) : '—'} />
          <More>
            <p><Rich text={tr('해석적으로 정한 경로다: 높이가 $H_0$에서 $H_1$로 움직이는 동안 산접기 모서리 $b$의 길이를 지키고, 골접기 대각선 $c$에 필요한 길이를 계산한다. 변형률이 0이 아니면 이 두 상태를 잇는 강체 경로는 없다.', 'An analytic, prescribed path: as the height moves from $H_0$ to $H_1$, keep the mountain edge $b$ at its length and compute the length the valley diagonal $c$ needs. Nonzero strain means no rigid path joins the two states.')} /></p>
            <p>{tr('솔버 결과가 아니다. 솔버로 확인하려면 Energy 솔버에서 에너지 탭의 축 압축 실험을 실행한다.', 'This is not a solver result. To check it with the solver, run the axial compression test in the Energy tab under the Energy solver.')}</p>
          </More>
        </div>
        <Plot series={[{ label: tr('c의 필요 변형률 (%)', 'Strain c needs (%)'), color: SERIES[1], x: data.map((d) => d.h), y: data.map((d) => d.cStrain * 100) }]} xLabel={tr('셀 높이 h', 'Cell height h')} yLabel={tr('변형률 (%)', 'Strain (%)')} yZero emptyText={tr('두 번째 상태가 없다', 'There is no second state')} />
      </div>
    </div>
  );
}

/** Try to move every crease ±5° from the current state; summarises rigid mobility. */
function useMobilityTest() {
  const [res, setRes] = useState<{ movable: number; total: number } | null>(null);
  const run = () => {
    const model = engine.model, rigid = engine.rigid;
    if (!model || !rigid) return;
    let movable = 0, total = 0;
    for (const e of model.edges) {
      if (e.faces[1] < 0 || !isCrease(e.assignment)) continue;
      total++;
      let ok = false;
      for (const sg of [1, -1]) {
        const s = new RigidKinematicSolver(model, rigid.rho, rigid.options);
        s.setDrivingCrease(e.id, rigid.rho[e.id] + sg * 5 * DEG);
        const r = s.solve();
        if (r.success) { ok = true; break; }
      }
      if (ok) movable++;
    }
    setRes({ movable, total });
  };
  return { res, run };
}

function StatesPanel({ kind }: { kind: 'bag' | 'twist' }) {
  const model = useModel((s) => s.model)!;
  const shown = useSim((s) => s.shownState);
  const enforceMV = useSim((s) => s.enforceMV);
  const { res, run } = useMobilityTest();
  const st = model.edu.referenceStates?.[0];
  const resid = st ? referenceStateResidual(st.name) : null;
  const closes = resid !== null && resid < 1e-8;
  const seg = (on: boolean) => `h-9 shrink-0 rounded-[3px] border px-3 text-[14px] transition-colors ${on ? 'border-ink bg-paper font-semibold text-ink shadow-[inset_0_0_0_1px_var(--color-ink)]' : 'border-rule-2 bg-paper text-ink-2 hover:border-ink-3 hover:text-ink'}`;
  return (
    <div>
      <Lead title={tr('두 상태, 그 사이의 길', 'Two states and the path between them')}>
        {tr('강체 면으로는 두 상태가 각각 존재하지만 둘을 잇는 연속 경로는 없다.', 'With rigid facets each state exists on its own, but no continuous path joins them.')}
      </Lead>
      <div className="grid grid-cols-1 gap-5 @2xl:grid-cols-2">
        <div>
          <Caption>{tr('상태 보기', 'Show a state')}</Caption>
          <div className="flex items-center gap-2">
            <button type="button" aria-pressed={!shown} className={seg(!shown)} onClick={() => showReferenceState(null)}>
              {kind === 'bag' ? tr('열린 상태', 'Open state') : tr('펼친 상태', 'Unfolded state')}
            </button>
            <span className="min-w-0 flex-1 text-center text-[13px] text-ink-3">
              <span className="block border-t border-dashed border-rule-2" />
              <span className="relative -top-2.5 bg-paper px-1.5">{tr('강체 경로 없음', 'no rigid path')}</span>
            </span>
            <button type="button" aria-pressed={!!shown} className={seg(!!shown)} onClick={() => st && showReferenceState(st.name)}>
              {tr('평탄 상태', 'Flat state')}
            </button>
          </div>
          <p className="mt-1 text-[14px] leading-relaxed text-ink-3">{tr('형상 공간은 연속된 슬라이더가 아니라 떨어진 두 점이다. 누르면 그 정확한 상태를 보여 준다.', 'The configuration space is two separate points, not a continuous slider. Click to show each exact state.')}</p>
        </div>
        <div>
          <Caption>{tr('검사', 'Checks')}</Caption>
          <div className="flex items-center justify-between gap-3 py-1">
            <span className="text-[14px] text-ink-2">{tr('평탄 상태가 강체로 닫힘', 'The flat state closes rigidly')}</span>
            <span className="flex shrink-0 items-center gap-2">
              {resid !== null && <span className="tnum text-[13px] text-ink-3" title={`‖C‖ = ${plainNum(resid)}`}>{resid < TINY ? '‖C‖ ≈ 0' : <>‖C‖ = <Num value={resid} /></>}</span>}
              <Badge status={resid === null ? 'na' : closes ? 'ok' : 'bad'}>{resid === null ? '—' : closes ? tr('성립', 'holds') : tr('위반', 'fails')}</Badge>
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 py-1">
            <span className="text-[14px] text-ink-2">{tr('지금 상태에서 강체로 접히는 길', 'A rigid folding path from here')}</span>
            {res ? <Badge status={res.movable === 0 ? 'bad' : 'ok'}>{tr(`${res.movable}/${res.total} 크리스 이동 가능`, `${res.movable}/${res.total} creases can move`)}</Badge> : <Button size="sm" onClick={run}>{tr('모든 크리스 ±5° 시험', 'Test all creases ±5°')}</Button>}
          </div>
          <More>
            <p>{tr('시험: 크리스마다 ±5°를 구동하는 완전한 강체 연속 풀이를 돌린다', 'The test runs a full rigid continuation solve driving each crease by ±5°')} {enforceMV ? tr('(M/V 배정 준수).', '(M/V assignment respected).') : tr('(M/V 배정 무시: 더 강한 시험).', '(M/V assignment ignored: a stronger test).')}</p>
            {kind === 'bag' && <p>{tr('다음으로 Energy 솔버에서 에너지 탭의 "납작하게 접기"를 실행해 보자. 이 전이에는 면 변형 에너지가 든다.', 'Next, run "Fold flat" in the Energy tab with the Energy solver: this transition costs facet deformation energy.')}</p>}
          </More>
        </div>
      </div>
    </div>
  );
}

function ReschVertices() {
  const model = useModel((s) => s.model)!;
  const stats = useMemo(() => {
    let k = 0, m = 0, both = 0, n = 0;
    for (const v of model.vertices) {
      if (v.boundary) continue;
      const r = analyzeVertex(model, v.id);
      if (!r.edges.length) continue;
      n++;
      if (r.kawasaki.satisfied) k++;
      if (r.maekawa.satisfied) m++;
      if (r.kawasaki.satisfied && r.maekawa.satisfied) both++;
    }
    return { k, m, both, n };
  }, [model]);
  return (
    <div className="max-w-[560px]">
      <Lead title={tr('꼭짓점 검사', 'Vertex check')}>
        {tr('각 내부 꼭짓점이 평탄 접힘 조건을 만족하는가.', 'Does each interior vertex satisfy the flat-fold conditions?')}
      </Lead>
      <Readout label={tr('둘 다 성립 (국소적으로 평탄 접힘 가능)', 'Both hold (locally flat-foldable)')}>{stats.both}/{stats.n}</Readout>
      <KV k={tr('Kawasaki 성립', 'Kawasaki holds')} v={`${stats.k}/${stats.n}`} />
      <KV k={tr('Maekawa 성립', 'Maekawa holds')} v={`${stats.m}/${stats.n}`} />
      <p className="mt-2 text-[14px] text-ink-3">{tr('턱(tuck) 중심(분홍)이나 격자 꼭짓점을 누르면 오른쪽 패널에서 섹터 각과 배정을 볼 수 있다.', 'Click a tuck centre (pink) or a grid vertex to see its sectors and assignment in the right panel.')}</p>
    </div>
  );
}

const GEOMETRY_PANELS = ['miuraMetrics', 'curvature', 'kreslingCompat', 'bagStates', 'flatVsRigid', 'reschVertices'];

export function GeometryTab() {
  const model = useModel((s) => s.model);
  const lessonId = useModel((s) => s.lessonId);
  const rho = useSim((s) => s.rho);
  const lesson = lessonById(lessonId);
  const panels: string[] = lesson?.panels ?? [];
  const bbox = useMemo(() => {
    if (!model || engine.positions.length !== model.vertices.length * 3) return null;
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < model.vertices.length; i++) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], engine.positions[3 * i + k]); hi[k] = Math.max(hi[k], engine.positions[3 * i + k]); }
    return hi.map((h, k) => h - lo[k]);
  }, [model, rho]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!model) return <div className="text-[14px] text-ink-3">{tr('이 탭은 3D 모델 레슨에만 적용된다.', 'This tab applies only to 3D model lessons.')}</div>;
  const has = GEOMETRY_PANELS.some((k) => panels.includes(k));
  return (
    <div className="space-y-6">
      {!has && <Lead title={tr('형상', 'Shape')}>{tr('지금 접힌 형상의 전체 크기.', 'The overall size of the current folded shape.')}</Lead>}
      {panels.includes('miuraMetrics') && <MiuraMetrics />}
      {panels.includes('curvature') && <CurvaturePanel />}
      {panels.includes('kreslingCompat') && <KreslingCompat />}
      {panels.includes('bagStates') && <StatesPanel kind="bag" />}
      {panels.includes('flatVsRigid') && <StatesPanel kind="twist" />}
      {panels.includes('reschVertices') && <ReschVertices />}
      <div className={`max-w-[560px] ${has ? 'border-t border-dashed border-rule-2 pt-2' : ''}`}>
        <KV k={tr('지금 형상의 경계 상자 (x × y × z)', 'Bounding box of the current shape (x × y × z)')} v={bbox ? bbox.map((x) => num(x, 3)).join(' × ') : '—'} />
      </div>
    </div>
  );
}
