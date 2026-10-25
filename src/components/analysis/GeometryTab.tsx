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
import { Badge, Button, KV, fmt } from '../controls/ui';
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
  return (
    <div className="grid grid-cols-1 @2xl:grid-cols-2 @5xl:grid-cols-[280px_minmax(0,1fr)_minmax(0,1fr)] gap-3 text-[13px]">
      <div>
        <KV k={tr('폭 W (x, 직선 크리스 방향)', 'Width W (x, along straight creases)')} v={dims ? dims.W.toFixed(4) : '—'} />
        <KV k={tr('길이 L (y, 지그재그 방향)', 'Length L (y, along zig-zag)')} v={dims ? dims.L.toFixed(4) : '—'} />
        <KV k={tr('두께 T', 'Thickness T')} v={dims ? dims.T.toFixed(4) : '—'} />
        <KV k={tr('점유 면적 W·L / 평탄', 'Footprint W·L / flat')} v={dims ? dims.areaRatio.toFixed(4) : '—'} />
        <KV k={tr('θ (면-평면 각 = |ρ_zigzag|/2)', 'θ (facet-to-plane angle = |ρ_zigzag|/2)')} v={`${toDeg(theta).toFixed(2)}°`} />
        <KV k={tr('dW/dρ, dL/dρ (rad당)', 'dW/dρ, dL/dρ (per rad)')} v={fd ? `${fd.dW.toFixed(3)}, ${fd.dL.toFixed(3)}` : '—'} />
        <KV k={tr('ν = −d ln L / d ln W (측정값)', 'ν = −d ln L / d ln W (measured)')} v={fd ? fd.nu.toFixed(4) : '—'} />
        <KV k={tr('ν 단위 셀 (Schenk–Guest)', 'ν unit cell (Schenk–Guest)')} v={Number.isFinite(nuAnalytic) ? nuAnalytic.toFixed(4) : '—'} />
        <div className="mt-1 flex items-center gap-2">
          {fd && <Badge status={fd.nu < 0 ? 'ok' : 'warn'}>{fd.nu < 0 ? tr('오세틱 (ν < 0)', 'auxetic (ν < 0)') : tr('여기서는 오세틱 아님', 'not auxetic here')}</Badge>}
          <Button active={!!auxetic} disabled={!fd} onClick={() => {
            if (auxetic || !fd) { useUI.setState({ auxetic: null }); return; }
            useUI.setState({ auxetic: { axisW: fd.d0.axisW, axisL: fd.d0.axisL, signW: Math.sign(fd.dW), signL: Math.sign(fd.dL) } });
          }}>{tr('오세틱 화살표', 'Auxetic arrows')}</Button>
        </div>
        <p className="mt-1 text-[12px] text-ink-3">{tr('화살표와 ν는 손으로 그린 것이 아니라 실제 꼭짓점 위치(두 강체 풀이의 유한 차분)에서 계산된다. 측정 ν는 유한 시트의 경계 중심을 사용하고, 단위 셀 값은 무한 테셀레이션에 대한 값이다.', 'The arrows and ν are not hand-drawn: they come from the actual vertex positions (finite difference of two rigid solves). The measured ν uses the boundary centres of the finite sheet; the unit-cell value is for an infinite tessellation.')}</p>
      </div>
      <Plot series={sweep ? [{ label: 'W', color: SERIES[0], x: xs, y: sweep.dims.map((d) => d.W) }, { label: 'L', color: SERIES[1], x: xs, y: sweep.dims.map((d) => d.L) }] : []} xLabel={tr('구동 ρ (°)', 'Driving ρ (°)')} yLabel={tr('전체 치수', 'Overall size')} markerX={drive !== null ? toDeg(target) : undefined} />
      <Plot series={sweep ? [{ label: tr('두께 T', 'Thickness T'), color: SERIES[2], x: xs, y: sweep.dims.map((d) => d.T) }, { label: tr('W·L / 평탄', 'W·L / flat'), color: SERIES[3], x: xs, y: sweep.dims.map((d) => (d.W * d.L) / ((sweep.dims[0].W * sweep.dims[0].L) || 1)) }] : []} xLabel={tr('구동 ρ (°)', 'Driving ρ (°)')} yLabel="" markerX={drive !== null ? toDeg(target) : undefined} />
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
    <div className="grid grid-cols-1 @2xl:grid-cols-2 @5xl:grid-cols-[300px_240px_minmax(0,1fr)] gap-3 text-[13px]">
      <div>
        <KV k={tr('종이 각 결손 (최대 |K|)', 'Paper angle defect (max |K|)')} v={fmt(paperDefect)} />
        <KV k={tr('조대 곡면 K: 평균', 'Coarse surface K: mean')} v={`${toDeg(mean).toFixed(3)}°`} />
        <KV k={tr('조대 곡면 K: 최대 / 최소', 'Coarse surface K: max / min')} v={`${toDeg(max).toFixed(3)}° / ${toDeg(min).toFixed(3)}°`} />
        <KV k={tr('내부 조대 꼭짓점 수', 'Interior coarse vertices')} v={vals.length} />
        <div className="mt-1">{vals.length > 0 && (mean > 1e-4 ? <Badge status="ok">{tr('양수: 돔형 (동방향 곡률)', 'positive: dome (synclastic)')}</Badge> : mean < -1e-4 ? <Badge status="warn">{tr('음수: 안장형', 'negative: saddle')}</Badge> : <Badge status="na">{tr('≈ 0: 전개 가능 / 원통형', '≈ 0: developable / cylindrical')}</Badge>)}</div>
      </div>
      <svg viewBox={`${x0 - 0.5} ${-y1 - 0.5} ${x1 - x0 + 1} ${y1 - y0 + 1}`} className="h-40 w-full rounded bg-paper-2">
        {pts.map((q, i) => {
          const t = q.k / scaleK;
          return <circle key={i} cx={q.p[0]} cy={-q.p[1]} r={0.22} fill={t >= 0 ? `rgba(239,68,68,${0.25 + 0.75 * t})` : `rgba(59,130,246,${0.25 - 0.75 * t})`} />;
        })}
      </svg>
      <p className="text-[12px] text-ink-3">
        {tr(<>이산 곡률 척도: 기저 중심을 지나는 조대(COARSE) 곡면의 각 내부 꼭짓점에서 K ≈ 2π − Σ 각도이다 (빨강 = 양수, 파랑 = 음수).
        종이 자체는 전개 가능 상태를 유지하며(종이의 각 결손은 ≈ 0), 유효 K가 양수이면 접힌 테셀레이션이 돔을 근사한다는 뜻이다.
        이는 교육용 추정치이며 미분기하 솔버가 아니다.</>,
        <>Discrete curvature: at each interior vertex of the COARSE surface through the base centres, K ≈ 2π − Σ angles (red = positive, blue = negative).
        The paper itself stays developable (its angle defect is ≈ 0); a positive effective K means the folded tessellation approximates a dome.
        This is a teaching estimate, not a differential-geometry solver.</>)}
      </p>
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
    <div className="grid grid-cols-1 @2xl:grid-cols-[300px_minmax(0,1fr)] gap-3 text-[13px]">
      <div>
        <KV k={tr('상태 0: H₀, φ₀', 'State 0: H₀, φ₀')} v={`${P.H.toFixed(3)}, ${toDeg(P.phi).toFixed(1)}°`} />
        <KV k={tr('상태 1 (같은 a, b, c): H₁, φ₁', 'State 1 (same a, b, c): H₁, φ₁')} v={st ? `${st.H.toFixed(3)}, ${toDeg(st.phi).toFixed(1)}°` : tr('없음 (H₁² < 0)', 'none (H₁² < 0)')} />
        <KV k={tr('예측 비틀림 φ₁ − φ₀', 'Predicted twist φ₁ − φ₀')} v={st ? `${toDeg(st.phi - P.phi).toFixed(1)}°` : '—'} />
        <KV k={tr('b 보존 경로에서 c의 최대 변형률', 'Max strain of c on the b-preserving path')} v={st ? `${(maxS * 100).toFixed(2)} %` : '—'} />
        <p className="mt-1 text-[12px] text-ink-3">{tr('규정된 기하 경로 (해석적): H가 H₀에서 H₁로 움직이는 동안 산접기 모서리 b의 길이를 유지하고, 골접기 대각선 c에 필요한 길이를 계산한다. 변형률이 0이 아니면 ⇒ 이 상태들을 지나는 강체 경로는 없다. 이는 솔버 결과가 아니다.', 'Prescribed geometric path (analytic): as H moves from H₀ to H₁, keep the mountain edge b at its length and compute the length the valley diagonal c needs. Nonzero strain ⇒ no rigid path passes through these states. This is not a solver result.')}</p>
      </div>
      <Plot series={[{ label: tr('c의 변형률 (%)', 'Strain of c (%)'), color: SERIES[1], x: data.map((d) => d.h), y: data.map((d) => d.cStrain * 100) }]} xLabel={tr('셀 높이 h', 'Cell height h')} yLabel={tr('필요 변형률 (%)', 'Required strain (%)')} yZero />
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
  return (
    <div className="grid grid-cols-1 @2xl:grid-cols-2 gap-4 text-[13px]">
      <div>
        <div className="mb-2 flex items-center gap-3 tnum text-[13px]">
          <button type="button" className={`rounded border px-3 py-2 ${!shown ? 'border-info/40 bg-info-soft' : 'border-rule-2'}`} onClick={() => showReferenceState(null)}>
            [{kind === 'bag' ? tr('열림', 'open') : tr('펼침', 'unfolded')}]
          </button>
          <span className="text-ink-3">• &nbsp; {tr('강체 경로 없음', 'no rigid path')} &nbsp; •</span>
          <button type="button" className={`rounded border px-3 py-2 ${shown ? 'border-ink-2 bg-paper-2' : 'border-rule-2'}`} onClick={() => st && showReferenceState(st.name)}>
            [{tr('평탄', 'flat')}]
          </button>
        </div>
        <p className="text-[12px] text-ink-3">{tr('강체 면 조건에서 형상 공간은 연속적인 슬라이더가 아니라 고립된 두 점이다. 클릭하면 각 정확한 상태를 표시한다.', 'With rigid facets the configuration space is two isolated points, not a continuous slider. Click to show each exact state.')}</p>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between"><span>{tr('평탄 접힘 가능 (평탄 상태가 닫힘)', 'Flat-foldable (flat state closes)')}</span><Badge status={resid !== null && resid < 1e-8 ? 'ok' : 'bad'}>{resid !== null ? `‖C‖ = ${fmt(resid)}` : '—'}</Badge></div>
        <div className="flex items-center justify-between">
          <span>{tr('현재 상태에서의 강체 접힘 경로', 'Rigid folding path from the current state')}</span>
          {res ? <Badge status={res.movable === 0 ? 'bad' : 'ok'}>{tr(`${res.movable}/${res.total} 크리스 이동 가능`, `${res.movable}/${res.total} creases can move`)}</Badge> : <Button onClick={run}>{tr('모든 크리스 ±5° 시험', 'Test all creases ±5°')}</Button>}
        </div>
        <p className="text-[12px] text-ink-3">{tr('시험 = 각 크리스를 ±5° 구동하는 완전한 강체 연속 풀이', 'Test = a full rigid continuation solve driving each crease ±5°')} {enforceMV ? tr('(M/V 준수)', '(M/V respected)') : tr('(M/V 무시 — 더 강한 시험)', '(M/V ignored — a stronger test)')}.{kind === 'bag' ? tr(' 이어서 Energy 모드로 전환하여 붕괴 실험을 실행한다: 이 전이에는 면 변형 에너지가 필요하다.', ' Next, switch to Energy mode and run the collapse experiment: this transition needs facet deformation energy.') : ''}</p>
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
    <div className="text-[13px]">
      <KV k={tr('검사한 내부 꼭짓점', 'Interior vertices checked')} v={stats.n} />
      <KV k={tr('Kawasaki 만족', 'Kawasaki holds')} v={`${stats.k}/${stats.n}`} />
      <KV k={tr('Maekawa 만족', 'Maekawa holds')} v={`${stats.m}/${stats.n}`} />
      <KV k={tr('둘 다 (국소적으로 평탄 접힘 가능)', 'Both (locally flat-foldable)')} v={`${stats.both}/${stats.n}`} />
      <p className="mt-1 text-[12px] text-ink-3">{tr('턱(tuck) 중심(분홍) 또는 격자 꼭짓점을 클릭하면 인스펙터에서 섹터와 배정을 확인할 수 있다.', 'Click a tuck centre (pink) or a grid vertex to see its sectors and assignment in the inspector.')}</p>
    </div>
  );
}

export function GeometryTab() {
  const model = useModel((s) => s.model);
  const lessonId = useModel((s) => s.lessonId);
  const rho = useSim((s) => s.rho);
  const lesson = lessonById(lessonId);
  const panels = lesson?.panels ?? [];
  const bbox = useMemo(() => {
    if (!model || engine.positions.length !== model.vertices.length * 3) return null;
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < model.vertices.length; i++) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], engine.positions[3 * i + k]); hi[k] = Math.max(hi[k], engine.positions[3 * i + k]); }
    return hi.map((h, k) => h - lo[k]);
  }, [model, rho]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!model) return <div className="text-ink-3">{tr('이 탭은 3D 모델 레슨에만 적용된다.', 'This tab applies only to 3D model lessons.')}</div>;
  return (
    <div className="space-y-3">
      {panels.includes('miuraMetrics') && <MiuraMetrics />}
      {panels.includes('curvature') && <CurvaturePanel />}
      {panels.includes('kreslingCompat') && <KreslingCompat />}
      {panels.includes('bagStates') && <StatesPanel kind="bag" />}
      {panels.includes('flatVsRigid') && <StatesPanel kind="twist" />}
      {panels.includes('reschVertices') && <ReschVertices />}
      <div className="text-[13px] text-ink-3">
        {tr('현재 배치의 경계 상자:', 'Bounding box of the current configuration:')} <span className="tnum text-ink">{bbox ? bbox.map((x) => x.toFixed(3)).join(' × ') : '—'}</span>
      </div>
    </div>
  );
}
