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
    <div className="grid grid-cols-[300px_1fr_1fr] gap-3 text-[12px]">
      <div>
        <KV k="폭 W (x, 직선 크리스 방향)" v={dims ? dims.W.toFixed(4) : '—'} />
        <KV k="길이 L (y, 지그재그 방향)" v={dims ? dims.L.toFixed(4) : '—'} />
        <KV k="두께 T" v={dims ? dims.T.toFixed(4) : '—'} />
        <KV k="점유 면적 W·L / 평탄" v={dims ? dims.areaRatio.toFixed(4) : '—'} />
        <KV k="θ (면-평면 각 = |ρ_zigzag|/2)" v={`${toDeg(theta).toFixed(2)}°`} />
        <KV k="dW/dρ, dL/dρ (rad당)" v={fd ? `${fd.dW.toFixed(3)}, ${fd.dL.toFixed(3)}` : '—'} />
        <KV k="ν = −d ln L / d ln W (측정값)" v={fd ? fd.nu.toFixed(4) : '—'} />
        <KV k="ν 단위 셀 (Schenk–Guest)" v={Number.isFinite(nuAnalytic) ? nuAnalytic.toFixed(4) : '—'} />
        <div className="mt-1 flex items-center gap-2">
          {fd && <Badge status={fd.nu < 0 ? 'ok' : 'warn'}>{fd.nu < 0 ? '오세틱 (ν < 0)' : '여기서는 오세틱 아님'}</Badge>}
          <Button active={!!auxetic} disabled={!fd} onClick={() => {
            if (auxetic || !fd) { useUI.setState({ auxetic: null }); return; }
            useUI.setState({ auxetic: { axisW: fd.d0.axisW, axisL: fd.d0.axisL, signW: Math.sign(fd.dW), signL: Math.sign(fd.dL) } });
          }}>오세틱 화살표</Button>
        </div>
        <p className="mt-1 text-[10.5px] text-ink-3">화살표와 ν는 손으로 그린 것이 아니라 실제 꼭짓점 위치(두 강체 풀이의 유한 차분)에서 계산된다. 측정 ν는 유한 시트의 경계 중심을 사용하고, 단위 셀 값은 무한 테셀레이션에 대한 값이다.</p>
      </div>
      <Plot series={sweep ? [{ label: 'W', color: SERIES[0], x: xs, y: sweep.dims.map((d) => d.W) }, { label: 'L', color: SERIES[1], x: xs, y: sweep.dims.map((d) => d.L) }] : []} xLabel="구동 ρ (°)" yLabel="전체 치수" markerX={drive !== null ? toDeg(target) : undefined} />
      <Plot series={sweep ? [{ label: '두께 T', color: SERIES[2], x: xs, y: sweep.dims.map((d) => d.T) }, { label: 'W·L / 평탄', color: SERIES[3], x: xs, y: sweep.dims.map((d) => (d.W * d.L) / ((sweep.dims[0].W * sweep.dims[0].L) || 1)) }] : []} xLabel="구동 ρ (°)" yLabel="" markerX={drive !== null ? toDeg(target) : undefined} />
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
    <div className="grid grid-cols-[320px_260px_1fr] gap-3 text-[12px]">
      <div>
        <KV k="종이 각 결손 (최대 |K|)" v={fmt(paperDefect)} />
        <KV k="조대 곡면 K: 평균" v={`${toDeg(mean).toFixed(3)}°`} />
        <KV k="조대 곡면 K: 최대 / 최소" v={`${toDeg(max).toFixed(3)}° / ${toDeg(min).toFixed(3)}°`} />
        <KV k="내부 조대 꼭짓점 수" v={vals.length} />
        <div className="mt-1">{vals.length > 0 && (mean > 1e-4 ? <Badge status="ok">양수: 돔형 (동방향 곡률)</Badge> : mean < -1e-4 ? <Badge status="warn">음수: 안장형</Badge> : <Badge status="na">≈ 0: 전개 가능 / 원통형</Badge>)}</div>
      </div>
      <svg viewBox={`${x0 - 0.5} ${-y1 - 0.5} ${x1 - x0 + 1} ${y1 - y0 + 1}`} className="h-40 w-full rounded bg-paper-2">
        {pts.map((q, i) => {
          const t = q.k / scaleK;
          return <circle key={i} cx={q.p[0]} cy={-q.p[1]} r={0.22} fill={t >= 0 ? `rgba(239,68,68,${0.25 + 0.75 * t})` : `rgba(59,130,246,${0.25 - 0.75 * t})`} />;
        })}
      </svg>
      <p className="text-[11px] text-ink-3">
        이산 곡률 척도: 기저 중심을 지나는 조대(COARSE) 곡면의 각 내부 꼭짓점에서 K ≈ 2π − Σ 각도이다 (빨강 = 양수, 파랑 = 음수).
        종이 자체는 전개 가능 상태를 유지하며(종이의 각 결손은 ≈ 0), 유효 K가 양수이면 접힌 테셀레이션이 돔을 근사한다는 뜻이다.
        이는 교육용 추정치이며 미분기하 솔버가 아니다.
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
    <div className="grid grid-cols-[320px_1fr] gap-3 text-[12px]">
      <div>
        <KV k="상태 0: H₀, φ₀" v={`${P.H.toFixed(3)}, ${toDeg(P.phi).toFixed(1)}°`} />
        <KV k="상태 1 (같은 a, b, c): H₁, φ₁" v={st ? `${st.H.toFixed(3)}, ${toDeg(st.phi).toFixed(1)}°` : '없음 (H₁² < 0)'} />
        <KV k="예측 비틀림 φ₁ − φ₀" v={st ? `${toDeg(st.phi - P.phi).toFixed(1)}°` : '—'} />
        <KV k="b 보존 경로에서 c의 최대 변형률" v={st ? `${(maxS * 100).toFixed(2)} %` : '—'} />
        <p className="mt-1 text-[10.5px] text-ink-3">규정된 기하 경로 (해석적): H가 H₀에서 H₁로 움직이는 동안 산접기 모서리 b의 길이를 유지하고, 골접기 대각선 c에 필요한 길이를 계산한다. 변형률이 0이 아니면 ⇒ 이 상태들을 지나는 강체 경로는 없다. 이는 솔버 결과가 아니다.</p>
      </div>
      <Plot series={[{ label: 'c의 변형률 (%)', color: SERIES[1], x: data.map((d) => d.h), y: data.map((d) => d.cStrain * 100) }]} xLabel="셀 높이 h" yLabel="필요 변형률 (%)" yZero />
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
    <div className="grid grid-cols-[1fr_1fr] gap-4 text-[12px]">
      <div>
        <div className="mb-2 flex items-center gap-3 tnum text-[12px]">
          <button type="button" className={`rounded border px-3 py-2 ${!shown ? 'border-info/40 bg-info-soft' : 'border-rule-2'}`} onClick={() => showReferenceState(null)}>
            [{kind === 'bag' ? '열림' : '펼침'}]
          </button>
          <span className="text-ink-3">• &nbsp; 강체 경로 없음 &nbsp; •</span>
          <button type="button" className={`rounded border px-3 py-2 ${shown ? 'border-ink-2 bg-paper-2' : 'border-rule-2'}`} onClick={() => st && showReferenceState(st.name)}>
            [평탄]
          </button>
        </div>
        <p className="text-[11px] text-ink-3">강체 면 조건에서 형상 공간은 연속적인 슬라이더가 아니라 고립된 두 점이다. 클릭하면 각 정확한 상태를 표시한다.</p>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between"><span>평탄 접힘 가능 (평탄 상태가 닫힘)</span><Badge status={resid !== null && resid < 1e-8 ? 'ok' : 'bad'}>{resid !== null ? `‖C‖ = ${fmt(resid)}` : '—'}</Badge></div>
        <div className="flex items-center justify-between">
          <span>현재 상태에서의 강체 접힘 경로</span>
          {res ? <Badge status={res.movable === 0 ? 'bad' : 'ok'}>{res.movable}/{res.total} 크리스 이동 가능</Badge> : <Button onClick={run}>모든 크리스 ±5° 시험</Button>}
        </div>
        <p className="text-[10.5px] text-ink-3">시험 = 각 크리스를 ±5° 구동하는 완전한 강체 연속 풀이 {enforceMV ? '(M/V 준수)' : '(M/V 무시 — 더 강한 시험)'}.{kind === 'bag' ? ' 이어서 Energy 모드로 전환하여 붕괴 실험을 실행한다: 이 전이에는 면 변형 에너지가 필요하다.' : ''}</p>
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
    <div className="text-[12px]">
      <KV k="검사한 내부 꼭짓점" v={stats.n} />
      <KV k="Kawasaki 만족" v={`${stats.k}/${stats.n}`} />
      <KV k="Maekawa 만족" v={`${stats.m}/${stats.n}`} />
      <KV k="둘 다 (국소적으로 평탄 접힘 가능)" v={`${stats.both}/${stats.n}`} />
      <p className="mt-1 text-[11px] text-ink-3">턱(tuck) 중심(분홍) 또는 격자 꼭짓점을 클릭하면 인스펙터에서 섹터와 배정을 확인할 수 있다.</p>
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
  if (!model) return <div className="text-ink-3">이 탭은 3D 모델 레슨에만 적용된다.</div>;
  return (
    <div className="space-y-3">
      {panels.includes('miuraMetrics') && <MiuraMetrics />}
      {panels.includes('curvature') && <CurvaturePanel />}
      {panels.includes('kreslingCompat') && <KreslingCompat />}
      {panels.includes('bagStates') && <StatesPanel kind="bag" />}
      {panels.includes('flatVsRigid') && <StatesPanel kind="twist" />}
      {panels.includes('reschVertices') && <ReschVertices />}
      <div className="text-[12px] text-ink-3">
        현재 배치의 경계 상자: <span className="tnum text-ink">{bbox ? bbox.map((x) => x.toFixed(3)).join(' × ') : '—'}</span>
      </div>
    </div>
  );
}
