import { Play } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { miuraStepwise, sheetDims } from '../../core/analysis/metrics';
import { toDeg } from '../../core/geometry/angles';
import { DEG } from '../../core/numerics/tolerances';
import type { OrigamiModel } from '../../core/topology/types';
import { kreslingYoshimuraPair, PAIR_U_MAX } from '../../models/pairs';
import type { PairRequest, PairResponse, PairTube } from '../../workers/pair.worker';
import { engine } from '../../state/engine';
import { useModel } from '../../state/modelStore';
import { useSim } from '../../state/simulationStore';
import { useUI } from '../../state/uiStore';
import { applyParams, setDriveEdge, setSolverMode, setTarget } from '../../state/actions';
import { Badge, Button, KV, Section, SpeedControl, fmt } from '../controls/ui';
import { Rich } from '../controls/Rich';
import { Viewport3D } from '../viewport/Viewport3D';
import { MiniView } from '../viewport/MiniView';

function useLabModel(generator: string, params: Record<string, number | string | boolean>, deps: unknown[] = []) {
  useEffect(() => {
    setSolverMode('rigid');
    applyParams(params, generator);
    const d = engine.model?.edu.defaultDrive;
    if (d) setDriveEdge(d.edge);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// ───────────────────────────────────────── Lecture 1 concept lab
const APPLICATIONS = [
  ['소형 수납', '면이 강체로 유지되는 동안 점유 면적 W·L이 크게 줄어든다 (비율 참조).'],
  ['전개 구조물', '구동기 하나(1 DoF)로 전체 면을 전개한다: 태양 전지판, 막, 안테나.'],
  ['변형 메커니즘', '형상 공간은 곡선이다. 접힌 상태는 조형물이 아니라 메커니즘이다.'],
  ['경량 구조', '접힌 얇은 판은 면외 깊이 T로부터 굽힘 강성을 얻는다.'],
  ['재구성 시스템', '하나의 크리스 패턴, 여러 상태: 같은 시트가 여러 기능을 수행한다.'],
  ['소프트 로보틱스', '크리스 패턴이 단순한 입력(압력, 텐던)을 규정된 운동으로 바꾼다.'],
  ['메타물질', '기하가 유효 물성을 결정한다: 여기서는 음의 포아송비(오세틱).'],
  ['키네틱 구조', '설계된 접기 경로를 따라 열리고 닫히는 파사드와 지붕.'],
];

export function ConceptLab() {
  useLabModel('miura', { rows: 4, cols: 6, a: 1, b: 1, alpha: 60 });
  const model = useModel((s) => s.model);
  const result = useSim((s) => s.result);
  const rho = useSim((s) => s.rho);
  const drive = useSim((s) => s.drive);
  const [pct, setPct] = useState(0);
  const anim = useRef(0);
  const go = (p: number) => {
    const d = useSim.getState().drive;
    const sign = d !== null && engine.model?.edges[d]?.assignment === 'M' ? -1 : 1;
    setPct(p);
    setTarget(sign * p * 172 * DEG);
  };
  useEffect(() => { go(0.35); useUI.getState().requestView('fit'); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const animate = (to: number) => {
    cancelAnimationFrame(anim.current);
    const from = pct;
    let t = 0, last = performance.now();
    const step = (now: number) => {
      // same speed setting as every other fold motion (0.1× … 2×)
      t = Math.min(1, t + (Math.max(0, now - last) * useUI.getState().foldSpeed) / 2500);
      last = now;
      go(from + (to - from) * (0.5 - 0.5 * Math.cos(Math.PI * t)));
      if (t < 1) anim.current = requestAnimationFrame(step);
      else useUI.getState().requestView('fit');
    };
    anim.current = requestAnimationFrame(step);
  };
  useEffect(() => () => cancelAnimationFrame(anim.current), []);
  const dims = useMemo(() => (model ? sheetDims(model, engine.positions) : null), [model, rho]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="grid h-full grid-rows-[minmax(300px,1fr)_auto] overflow-y-auto lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-1 lg:overflow-hidden min-[1500px]:grid-cols-[minmax(0,1fr)_380px]">
      <div className="relative min-h-0 min-w-0"><Viewport3D /></div>
      <div className="border-t border-rule bg-paper lg:overflow-y-auto lg:border-l lg:border-t-0">
        <Section title="형상 (Rigid 솔버, 1 DoF)">
          <div className="flex justify-between text-[11px] text-ink-3"><span>펼침 (평탄)</span><span>중간</span><span>수납 (압축)</span></div>
          <input type="range" className="w-full" min={0} max={1} step={0.002} value={pct} aria-label="형상 (펼침 → 수납)" onChange={(e) => { cancelAnimationFrame(anim.current); go(parseFloat(e.target.value)); }} />
          <div className="mt-1 flex gap-1">
            <Button onClick={() => animate(1)}><Play size={14} />수납</Button>
            <Button onClick={() => animate(0.5)}>중간</Button>
            <Button onClick={() => animate(0)}><Play size={14} />펼치기</Button>
          </div>
          <SpeedControl className="mt-2" />
          <div className="mt-2 text-[12px]">
            <KV k="구동 접힘각" v={drive !== null ? `${toDeg(rho[drive] ?? 0).toFixed(1)}°` : '—'} />
            <KV k="점유 면적 W·L / 평탄" v={dims ? dims.areaRatio.toFixed(3) : '—'} />
            <KV k="두께 T" v={dims ? dims.T.toFixed(3) : '—'} />
            <KV k="닫힘 잔차" v={fmt(result?.residualNorm)} />
          </div>
          <p className="mt-1 text-[11px] text-ink-3">애니메이션의 모든 프레임은 보간이 아니라 정확한 강체 해(기구학 솔버의 연속법)이다.</p>
        </Section>
        <Section title="하나의 사상, 다양한 응용">
          <ul className="space-y-1 text-[12px]">
            {APPLICATIONS.map(([t, d]) => <li key={t}><b className="text-ink">{t}</b> <span className="text-ink-3">— {d}</span></li>)}
          </ul>
        </Section>
      </div>
    </div>
  );
}

// ───────────────────────────────────────── Lecture 3 stepwise kinematics
export function StepwiseLab() {
  const [alpha, setAlpha] = useState(60);
  // c1 lies between the two acute sectors: Miura assignment V (c1), M, M, M
  useLabModel('singleVertex', { sectors: `${alpha},${180 - alpha},${180 - alpha},${alpha}`, mv: 'V,M,M,M' }, [alpha]);
  const model = useModel((s) => s.model);
  const rho = useSim((s) => s.rho);
  const drive = useSim((s) => s.drive);
  const target = useSim((s) => s.target);
  const lab = (l: string) => Number(Object.entries(model?.edu.creaseLabels ?? {}).find(([, x]) => x === l)?.[0] ?? -1);
  const [e1, e2, e3, e4] = ['ρ1', 'ρ2', 'ρ3', 'ρ4'].map(lab);
  const r1 = e1 >= 0 ? Math.abs(rho[e1] ?? 0) : 0;
  const d = miuraStepwise(alpha * DEG, r1);
  const solver2 = e2 >= 0 ? Math.abs(rho[e2] ?? 0) : NaN;
  const rows: [string, string, string][] = [
    ['1. 기준 면', 'c1과 c2 사이의 면을 고정한다 (강체 트리의 루트)', ''],
    ['2. c1에서의 코사인 법칙', '$\\cos\\delta = \\cos^2\\alpha - \\sin^2\\alpha\\,\\cos\\rho_1$', `δ = ${toDeg(d.delta).toFixed(4)}°`],
    ['3. 대칭', 'c2와 c4는 c1, c3를 포함하는 평면 M에 대해 거울상이다', ''],
    ['4. 사영 + 직교성', '$p = \\operatorname{proj}_M(c_2)$, $|p| = \\cos(\\delta/2)$, $\\cos\\theta_1 = \\cos\\alpha / \\cos(\\delta/2)$', `θ1 = ${toDeg(d.theta1).toFixed(4)}°`],
    ['5. 대칭', '$\\gamma = \\angle(c_1, c_3) = \\pi - 2\\theta_1$', `γ = ${toDeg(d.gamma).toFixed(4)}°`],
    ['6. c2에서의 코사인 법칙', '$\\cos\\rho_2 = -(\\cos\\gamma + \\cos^2\\alpha)/\\sin^2\\alpha$', `|ρ2| = ${toDeg(d.rho2Magnitude).toFixed(4)}°`],
    ['7. 배정 / 대칭', '$\\rho_3 = -\\rho_1$ (c1 V, c3 M), $\\rho_4 = \\rho_2$', ''],
  ];
  return (
    <div className="grid h-full grid-rows-[minmax(300px,1fr)_auto] overflow-y-auto lg:grid-cols-[minmax(0,1fr)_400px] lg:grid-rows-1 lg:overflow-hidden min-[1500px]:grid-cols-[minmax(0,1fr)_460px]">
      <div className="relative min-h-0 min-w-0"><Viewport3D /></div>
      <div className="border-t border-rule bg-paper lg:overflow-y-auto lg:border-l lg:border-t-0">
        <Section title="입력">
          <label className="block text-[12px]">α = {alpha}° (섹터 α, 180−α, 180−α, α)
            <input type="range" className="w-full" min={30} max={85} step={1} value={alpha} onChange={(e) => setAlpha(parseInt(e.target.value))} />
          </label>
          <label className="block text-[12px]">|ρ1| = {toDeg(Math.abs(target)).toFixed(1)}° (구동 크리스 c1, 골접기)
            <input type="range" className="w-full" min={0} max={175} step={0.5} value={Math.abs(toDeg(target))} disabled={drive === null}
              onChange={(e) => setTarget(parseFloat(e.target.value) * DEG)} />
          </label>
        </Section>
        <Section title="실시간 유도">
          <table className="w-full text-[11.5px]">
            <tbody>
              {rows.map(([a, b, c]) => (
                <tr key={a} className="border-b border-rule align-top">
                  <td className="py-1 pr-2 font-semibold text-ink-2">{a}</td>
                  <td className="py-1 pr-2 text-ink-2"><Rich text={b} /></td>
                  <td className="py-1 text-right tnum text-warn">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
        <Section title="해석해 vs 범용 수치 솔버">
          <div className="space-y-0.5 tnum text-[12px]">
            <KV k="|ρ2| 해석해" v={`${toDeg(d.rho2Magnitude).toFixed(6)}°`} />
            <KV k="|ρ2| 솔버" v={`${toDeg(solver2).toFixed(6)}°`} />
            <KV k="ρ3 솔버 vs −ρ1" v={e3 >= 0 ? `${toDeg(rho[e3]).toFixed(4)}° vs ${toDeg(-(rho[e1] ?? 0)).toFixed(4)}°` : '—'} />
            <KV k="ρ4 솔버 vs ρ2" v={e4 >= 0 ? `${toDeg(rho[e4]).toFixed(4)}° vs ${toDeg(rho[e2]).toFixed(4)}°` : '—'} />
            <KV k="tan(|ρ1|/2) / tan(|ρ2|/2)" v={`${(Math.tan(r1 / 2) / Math.tan(solver2 / 2)).toFixed(6)} (cos α = ${Math.cos(alpha * DEG).toFixed(6)})`} />
          </div>
          <div className="mt-1">{Math.abs(solver2 - d.rho2Magnitude) < 1e-6 ? <Badge status="ok">&lt; 1e-6 rad 이내로 일치</Badge> : r1 < 1e-6 ? <Badge status="na">비교하려면 ρ1을 구동한다</Badge> : <Badge status="warn">Δ = {fmt(Math.abs(solver2 - d.rho2Magnitude))} rad</Badge>}</div>
          <p className="mt-1 text-[11px] text-ink-3">설명되지 않은 상수는 없다. 모든 값은 위 단계에 따라 α와 ρ1로부터 계산되며, 오른쪽 열은 범용 Levenberg–Marquardt 닫힘 솔버의 결과이다.</p>
        </Section>
      </div>
    </div>
  );
}

// ───────────────────────────────────────── Lecture 5 Kresling vs Yoshimura
type PairResult = PairResponse | null;

function TubeCard({ title, sub, model, tube, fallback }: { title: string; sub: string; model: OrigamiModel; tube: PairTube | undefined; fallback: Float64Array }) {
  return (
    <div className="min-w-0 rounded-[3px] border border-rule-2 bg-paper">
      <div className="flex items-baseline justify-between gap-2 border-b border-rule px-3 py-1.5">
        <div className="min-w-0"><b className="text-[13px] text-ink">{title}</b> <span className="text-[11.5px] text-ink-3">{sub}</span></div>
        {tube && tube.collisions > 0 && <Badge status="warn">자기 교차 {tube.collisions}</Badge>}
      </div>
      <MiniView model={model} positions={tube?.positions ?? fallback} height="min(44vh, 400px)" />
      <dl className="grid grid-cols-3 border-t border-rule text-[12px]">
        {[
          ['에너지 V', tube ? fmt(tube.energy) : '—'],
          ['상판 비틀림', tube ? `${toDeg(tube.twist).toFixed(1)}°` : '—'],
          ['최대 변형률', tube ? `${(tube.maxStrain * 100).toFixed(1)}%` : '—'],
        ].map(([k, v]) => (
          <div key={k} className="border-l border-rule px-3 py-1.5 first:border-l-0">
            <dt className="lettering text-[10.5px] text-ink-3">{k}</dt>
            <dd className="tnum text-[15px] font-semibold text-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function KreslingVsYoshimuraLab() {
  const { k, y } = useMemo(kreslingYoshimuraPair, []);
  const ref = useMemo(() => ({
    k: Float64Array.from(k.vertices.flatMap((v) => v.referencePosition)),
    y: Float64Array.from(y.vertices.flatMap((v) => v.referencePosition)),
  }), [k, y]);
  const [u, setU] = useState(0);
  const [twist, setTwist] = useState(0);
  const [free, setFree] = useState(true);
  const [res, setRes] = useState<PairResult>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // the worker relaxes both tubes; only the newest request is kept while one is running
  const worker = useRef<Worker | null>(null);
  const running = useRef(false);
  const pending = useRef<Omit<PairRequest, 'id'> | null>(null);
  const reqId = useRef(0);
  const send = useRef((r: Omit<PairRequest, 'id'>) => {
    if (!worker.current) return;
    if (running.current) { pending.current = r; return; }
    running.current = true;
    setBusy(true);
    worker.current.postMessage({ ...r, id: ++reqId.current });
  });
  useEffect(() => {
    const w = new Worker(new URL('../../workers/pair.worker.ts', import.meta.url), { type: 'module' });
    worker.current = w;
    w.onmessage = (ev: MessageEvent<PairResponse | { id: number; error: string }>) => {
      running.current = false;
      if ('error' in ev.data) setError(ev.data.error);
      else { setRes(ev.data); setError(null); }
      const next = pending.current;
      pending.current = null;
      if (next) send.current(next);
      else setBusy(false);
    };
    w.onerror = (e) => { running.current = false; setBusy(false); setError(e.message || '계산 워커 오류'); };
    return () => { w.terminate(); worker.current = null; running.current = false; };
  }, []);
  useEffect(() => { send.current({ u, twist: free ? null : twist * DEG }); }, [u, twist, free]);

  // compress automatically at the shared fold speed
  const anim = useRef(0);
  const [playing, setPlaying] = useState(false);
  const play = () => {
    cancelAnimationFrame(anim.current);
    const from = u >= PAIR_U_MAX - 1e-6 ? 0 : u;
    let t = 0, last = performance.now();
    setPlaying(true);
    const step = (now: number) => {
      t = Math.min(1, t + (Math.max(0, now - last) * useUI.getState().foldSpeed) / (5000 * (1 - from / PAIR_U_MAX) || 1));
      last = now;
      setU(+(from + (PAIR_U_MAX - from) * t).toFixed(4));
      if (t < 1) anim.current = requestAnimationFrame(step);
      else setPlaying(false);
    };
    anim.current = requestAnimationFrame(step);
  };
  const stop = () => { cancelAnimationFrame(anim.current); setPlaying(false); };
  useEffect(() => () => cancelAnimationFrame(anim.current), []);

  const ratio = res && res.k.energy > 1e-9 ? res.y.energy / res.k.energy : null;
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <TubeCard title="Kresling" sub="비틀림 좌굴" model={k} tube={res?.k} fallback={ref.k} />
        <TubeCard title="Yoshimura" sub="축 압축" model={y} tube={res?.y} fallback={ref.y} />
      </div>

      <div className="rounded-[3px] border border-rule-2 bg-paper-2/60 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="lettering text-[11px] text-ink-3">공통 하중 · 강체 상판, 매 프레임 에너지 최소(FIRE)</div>
          <span className={`tnum text-[11.5px] ${busy ? 'text-ink-2' : 'text-ink-3'}`}>{busy ? '계산 중…' : error ? '' : '평형 상태'}</span>
        </div>
        <div className="grid gap-4 text-[12.5px] md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div>
            <div className="flex items-baseline justify-between"><span className="font-medium text-ink">축 압축 u</span><span className="tnum text-[16px] font-semibold text-ink">{u.toFixed(3)} <span className="text-[11.5px] font-normal text-ink-3">/ H = 1.2 ({Math.round((u / 1.2) * 100)}%)</span></span></div>
            <input type="range" className="mt-1 w-full" min={0} max={PAIR_U_MAX} step={0.005} value={u} aria-label="축 압축 u"
              onChange={(e) => { stop(); setU(parseFloat(e.target.value)); }} />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {playing
                ? <Button onClick={stop}>정지</Button>
                : <Button kind="primary" onClick={play}><Play size={14} />자동 압축</Button>}
              <Button onClick={() => { stop(); setU(0); }}>처음으로</Button>
              <SpeedControl className="ml-auto" />
            </div>
          </div>
          <div>
            <label className="flex items-center gap-2 font-medium text-ink">
              <input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} /> 상판 회전 자유
            </label>
            <div className={`mt-2 ${free ? 'opacity-40' : ''}`}>
              <div className="flex justify-between"><span>규정 비틀림</span><span className="tnum">{twist}°</span></div>
              <input type="range" className="w-full" min={-45} max={45} step={1} value={twist} disabled={free} aria-label="규정 비틀림"
                onChange={(e) => setTwist(parseInt(e.target.value))} />
            </div>
            {ratio !== null && <p className="mt-2 text-[12px] text-ink-2">같은 압축에서 Yoshimura의 에너지가 Kresling의 <b className="tnum text-ink">{ratio >= 100 ? ratio.toFixed(0) : ratio.toFixed(1)}배</b>이다.</p>}
          </div>
        </div>
        {error && <p className="mt-2 text-[12px] text-bad">계산 실패: {error}</p>}
        <p className="mt-2 text-[11.5px] leading-relaxed text-ink-3">
          반지름, 높이, 다각형, 강성은 같다. 상판은 강체 판으로 축 방향으로 눌리며, "회전 자유"이면 토크가 0이 되는 각까지 스스로 돈다.
          Kresling은 압축되며 비틀린다(카이랄성에서 오는 압축–비틀림 연성). Yoshimura는 비틀리지 않고, 강체로 접히지 않으므로 면과 막대가 변형되며 에너지를 저장한다.
          비틀림을 규정하면(회전 자유 해제) Kresling의 선호 방향과 반대로 돌릴 때 에너지가 커진다.
          접촉(층 간 충돌) 모델은 없으므로 압축 범위를 자기 교차가 생기지 않는 {Math.round((PAIR_U_MAX / 1.2) * 100)}%까지로 둔다.
        </p>
      </div>
    </div>
  );
}
