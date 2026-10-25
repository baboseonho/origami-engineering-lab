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
import { Badge, Button, KV, Section, SpeedControl } from '../controls/ui';
import { Group, Sci, degTxt, num } from './labKit';
import { Rich } from '../controls/Rich';
import { tr } from '../../i18n';
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
// a function, not a constant, so the text follows the current language
const applications = () => [
  [tr('소형 수납', 'Compact storage'), tr('면이 강체로 유지되는 동안 점유 면적 W·L이 크게 줄어든다 (비율 참조).', 'The footprint W·L shrinks a lot while the facets stay rigid (see the ratio).')],
  [tr('전개 구조물', 'Deployable structures'), tr('구동기 하나(1 DoF)로 전체 면을 전개한다: 태양 전지판, 막, 안테나.', 'One actuator (1 DoF) deploys the whole surface: solar panels, membranes, antennas.')],
  [tr('변형 메커니즘', 'Shape-changing mechanisms'), tr('형상 공간은 곡선이다. 접힌 상태는 조형물이 아니라 메커니즘이다.', 'The configuration space is a curve. A folded state is a mechanism, not a sculpture.')],
  [tr('경량 구조', 'Lightweight structures'), tr('접힌 얇은 판은 면외 깊이 T로부터 굽힘 강성을 얻는다.', 'A folded thin sheet gains bending stiffness from its out-of-plane depth T.')],
  [tr('재구성 시스템', 'Reconfigurable systems'), tr('하나의 크리스 패턴, 여러 상태: 같은 시트가 여러 기능을 수행한다.', 'One crease pattern, many states: the same sheet serves several functions.')],
  [tr('소프트 로보틱스', 'Soft robotics'), tr('크리스 패턴이 단순한 입력(압력, 텐던)을 규정된 운동으로 바꾼다.', 'The crease pattern turns a simple input (pressure, tendon) into a prescribed motion.')],
  [tr('메타물질', 'Metamaterials'), tr('기하가 유효 물성을 결정한다: 여기서는 음의 포아송비(오세틱).', 'Geometry sets the effective properties: here, a negative Poisson ratio (auxetic).')],
  [tr('키네틱 구조', 'Kinetic architecture'), tr('설계된 접기 경로를 따라 열리고 닫히는 파사드와 지붕.', 'Facades and roofs that open and close along a designed folding path.')],
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
        <Section title={tr('형상 (Rigid 솔버, 1 DoF)', 'Shape (Rigid solver, 1 DoF)')}>
          <Group caption={tr('접기', 'Fold')} className="mb-3">
            <Button kind="primary" size="sm" onClick={() => animate(1)}><Play size={14} />{tr('수납', 'Stow')}</Button>
            <Button size="sm" onClick={() => animate(0.5)}>{tr('중간', 'Middle')}</Button>
            <Button size="sm" onClick={() => animate(0)}><Play size={14} className="-scale-x-100" />{tr('펼치기', 'Unfold')}</Button>
            <SpeedControl className="w-full pt-1" />
          </Group>
          <div className="flex justify-between text-[13px] text-ink-3"><span>{tr('펼침 (평탄)', 'Unfolded (flat)')}</span><span>{tr('수납 (압축)', 'Stowed (compact)')}</span></div>
          <input type="range" className="w-full" min={0} max={1} step={0.002} value={pct} aria-label={tr('형상 (펼침 → 수납)', 'Shape (unfolded → stowed)')} onChange={(e) => { cancelAnimationFrame(anim.current); go(parseFloat(e.target.value)); }} />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-[3px] border border-rule-2 px-3 py-2">
              <div className="text-[13px] text-ink-3">{tr('점유 면적 W·L / 평탄', 'Footprint W·L / flat')}</div>
              <div className="tnum text-[22px] font-semibold leading-tight text-ink">{dims ? `${Math.round(dims.areaRatio * 100)}%` : '—'}</div>
            </div>
            <div className="rounded-[3px] border border-rule-2 px-3 py-2">
              <div className="text-[13px] text-ink-3">{tr('두께 T', 'Thickness T')}</div>
              <div className="tnum text-[22px] font-semibold leading-tight text-ink">{dims ? dims.T.toFixed(3) : '—'}</div>
            </div>
          </div>
          <div className="mt-2">
            <KV k={tr('구동 접힘각', 'Driven fold angle')} v={drive !== null ? degTxt(toDeg(rho[drive] ?? 0), 1) : '—'} />
            <KV k={tr('닫힘 잔차', 'Closure residual')} v={<Sci x={result?.residualNorm} d={1} />} />
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-3">{tr('애니메이션의 모든 프레임은 보간이 아니라 정확한 강체 해(기구학 솔버의 연속법)이다.', 'Every animation frame is an exact rigid solution (continuation with the kinematic solver), not an interpolation.')}</p>
        </Section>
        <Section title={tr('하나의 사상, 다양한 응용', 'One idea, many applications')}>
          <ul className="space-y-1.5 text-[14px] leading-snug">
            {applications().map(([t, d]) => <li key={t}><b className="font-semibold text-ink">{t}</b> <span className="text-ink-2">— {d}</span></li>)}
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
  // [step, statement, symbol of the result (TeX), value]
  const rows: [string, string, string, string][] = [
    [tr('1. 기준 면', '1. Reference facet'), tr('$c_1$과 $c_2$ 사이의 면을 고정한다 (강체 트리의 뿌리)', 'Fix the facet between $c_1$ and $c_2$ (root of the rigid tree)'), '', ''],
    [tr('2. $c_1$에서 코사인 법칙', '2. Law of cosines at $c_1$'), '$\\cos\\delta = \\cos^2\\alpha - \\sin^2\\alpha\\,\\cos\\rho_1$', '$\\delta$', degTxt(toDeg(d.delta), 4)],
    [tr('3. 대칭', '3. Symmetry'), tr('$c_2$와 $c_4$는 $c_1$, $c_3$를 포함하는 평면 $M$에 대해 거울상이다', '$c_2$ and $c_4$ are mirror images across the plane $M$ containing $c_1$ and $c_3$'), '', ''],
    [tr('4. 사영 + 직교성', '4. Projection + orthogonality'), '$p = \\operatorname{proj}_M(c_2)$, $|p| = \\cos(\\delta/2)$, $\\cos\\theta_1 = \\cos\\alpha / \\cos(\\delta/2)$', '$\\theta_1$', degTxt(toDeg(d.theta1), 4)],
    [tr('5. 대칭', '5. Symmetry'), '$\\gamma = \\angle(c_1, c_3) = \\pi - 2\\theta_1$', '$\\gamma$', degTxt(toDeg(d.gamma), 4)],
    [tr('6. $c_2$에서 코사인 법칙', '6. Law of cosines at $c_2$'), '$\\cos\\rho_2 = -(\\cos\\gamma + \\cos^2\\alpha)/\\sin^2\\alpha$', '$|\\rho_2|$', degTxt(toDeg(d.rho2Magnitude), 4)],
    [tr('7. 배정 / 대칭', '7. Assignment / symmetry'), tr('$\\rho_3 = -\\rho_1$ ($c_1$ 골, $c_3$ 산), $\\rho_4 = \\rho_2$', '$\\rho_3 = -\\rho_1$ ($c_1$ valley, $c_3$ mountain), $\\rho_4 = \\rho_2$'), '', ''],
  ];
  const agree = Math.abs(solver2 - d.rho2Magnitude) < 1e-6;
  return (
    <div className="grid h-full grid-rows-[minmax(300px,1fr)_auto] overflow-y-auto lg:grid-cols-[minmax(0,1fr)_400px] lg:grid-rows-1 lg:overflow-hidden min-[1500px]:grid-cols-[minmax(0,1fr)_460px]">
      <div className="relative min-h-0 min-w-0"><Viewport3D /></div>
      <div className="border-t border-rule bg-paper lg:overflow-y-auto lg:border-l lg:border-t-0">
        <Section title={tr('입력', 'Input')}>
          <label className="block text-[14px] text-ink-2"><b className="tnum font-semibold text-ink">α = {alpha}°</b> <span className="text-[13px] text-ink-3">{tr('(섹터 α, 180° − α, 180° − α, α)', '(sectors α, 180° − α, 180° − α, α)')}</span>
            <input type="range" className="w-full" min={30} max={85} step={1} value={alpha} onChange={(e) => setAlpha(parseInt(e.target.value))} />
          </label>
          <label className="mt-2 block text-[14px] text-ink-2"><b className="tnum font-semibold text-ink"><Rich text="$|\rho_1|$" /> = {toDeg(Math.abs(target)).toFixed(1)}°</b> <span className="text-[13px] text-ink-3">{tr('(구동 크리스 ', '(driven crease ')}<Rich text="$c_1$" />{tr(', 골접기)', ', valley)')}</span>
            <input type="range" className="w-full" min={0} max={175} step={0.5} value={Math.abs(toDeg(target))} disabled={drive === null}
              onChange={(e) => setTarget(parseFloat(e.target.value) * DEG)} />
          </label>
        </Section>
        <Section title={tr('실시간 유도', 'Live derivation')}>
          <ol className="space-y-0">
            {rows.map(([a, b, sym, val]) => (
              <li key={a} className="border-b border-rule py-1.5 last:border-b-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-semibold text-ink-2"><Rich text={a} /></span>
                  {sym && <span className="tnum whitespace-nowrap text-[14px] font-semibold text-ink"><Rich text={sym} /> = {val}</span>}
                </div>
                <div className="mt-0.5 text-[14px] leading-relaxed text-ink-2"><Rich text={b} /></div>
              </li>
            ))}
          </ol>
        </Section>
        <Section title={tr('해석해 vs 범용 수치 솔버', 'Analytic solution vs general numerical solver')}>
          <div className="space-y-0.5 tnum">
            <KV k={<>{tr('해석해', 'Analytic')} <Rich text="$|\rho_2|$" /></>} v={degTxt(toDeg(d.rho2Magnitude), 6)} />
            <KV k={<>{tr('솔버', 'Solver')} <Rich text="$|\rho_2|$" /></>} v={degTxt(toDeg(solver2), 6)} />
            <KV k={<>{tr('솔버', 'Solver')} <Rich text="$\rho_3$" /> vs <Rich text="$-\rho_1$" /></>} v={e3 >= 0 ? `${degTxt(toDeg(rho[e3]), 4)} vs ${degTxt(toDeg(-(rho[e1] ?? 0)), 4)}` : '—'} />
            <KV k={<>{tr('솔버', 'Solver')} <Rich text="$\rho_4$" /> vs <Rich text="$\rho_2$" /></>} v={e4 >= 0 ? `${degTxt(toDeg(rho[e4]), 4)} vs ${degTxt(toDeg(rho[e2]), 4)}` : '—'} />
            <KV k={<Rich text="$\tan(|\rho_1|/2) \,/\, \tan(|\rho_2|/2)$" />} v={num(Math.tan(r1 / 2) / Math.tan(solver2 / 2), 6)} />
            <KV k={<Rich text="$\cos\alpha$" />} v={num(Math.cos(alpha * DEG), 6)} />
          </div>
          <div className="mt-1.5">{agree ? <Badge status="ok">{tr('일치', 'Agree')} · Δ &lt; 10<sup>−6</sup> rad</Badge> : r1 < 1e-6 ? <Badge status="na">{tr('비교하려면 c1을 접는다', 'Fold c1 to compare')}</Badge> : <Badge status="warn">{tr('불일치', 'Differ')} · Δ = <Sci x={Math.abs(solver2 - d.rho2Magnitude)} d={1} /> rad</Badge>}</div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">{tr('설명되지 않은 상수는 없다. 모든 값은 위 단계에 따라 α와 ρ1로부터 계산되며, 오른쪽 열은 범용 Levenberg–Marquardt 닫힘 솔버의 결과이다.', 'There are no unexplained constants. Every value is computed from α and ρ1 by the steps above; the right column is the result of the general Levenberg–Marquardt closure solver.')}</p>
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
        <div className="min-w-0"><b className="text-[15px] text-ink">{title}</b> <span className="text-[13px] text-ink-3">{sub}</span></div>
        {tube && tube.collisions > 0 && <Badge status="warn">{tr('자기 교차', 'Self-intersections')} {tube.collisions}</Badge>}
      </div>
      <MiniView model={model} positions={tube?.positions ?? fallback} height="min(44vh, 400px)" />
      <dl className="grid grid-cols-3 border-t border-rule text-[13px]">
        {[
          [tr('에너지 V', 'Energy V'), tube ? <Sci x={tube.energy} d={2} zero={1e-9} /> : '—'],
          [tr('상판 비틀림', 'Top twist'), tube ? degTxt(toDeg(tube.twist), 1) : '—'],
          [tr('최대 변형률', 'Max strain'), tube ? `${(tube.maxStrain * 100).toFixed(1)}%` : '—'],
        ].map(([k, v]) => (
          <div key={k as string} className="border-l border-rule px-3 py-1.5 first:border-l-0">
            <dt className="lettering text-[12px] text-ink-3">{k}</dt>
            <dd className="tnum text-[18px] font-semibold text-ink">{v}</dd>
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
    w.onerror = (e) => { running.current = false; setBusy(false); setError(e.message || tr('계산 워커 오류', 'Computation worker error')); };
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
        <TubeCard title="Kresling" sub={tr('비틀림 좌굴', 'twist buckling')} model={k} tube={res?.k} fallback={ref.k} />
        <TubeCard title="Yoshimura" sub={tr('압축 좌굴', 'compression buckling')} model={y} tube={res?.y} fallback={ref.y} />
      </div>

      <div className="rounded-[3px] border border-rule-2 bg-paper-2/60 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="lettering text-[12px] text-ink-3">{tr('공통 하중 · 강체 상판, 매 프레임 에너지 최소(FIRE)', 'Shared load · rigid top plate, energy minimized every frame (FIRE)')}</div>
          <span className={`tnum text-[13px] ${busy ? 'text-ink-2' : 'text-ink-3'}`}>{busy ? tr('계산 중…', 'Computing…') : error ? '' : tr('평형 상태', 'At equilibrium')}</span>
        </div>
        <div className="grid gap-4 text-[13px] md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div>
            <div className="flex items-baseline justify-between"><span className="font-medium text-ink">{tr('축 압축 u', 'Axial compression u')}</span><span className="tnum text-[18px] font-semibold text-ink">{u.toFixed(3)} <span className="text-[13px] font-normal text-ink-3">/ H = 1.2 ({Math.round((u / 1.2) * 100)}%)</span></span></div>
            <input type="range" className="mt-1 w-full" min={0} max={PAIR_U_MAX} step={0.005} value={u} aria-label={tr('축 압축 u', 'Axial compression u')}
              onChange={(e) => { stop(); setU(parseFloat(e.target.value)); }} />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {playing
                ? <Button onClick={stop}>{tr('정지', 'Stop')}</Button>
                : <Button kind="primary" onClick={play}><Play size={14} />{tr('자동 압축', 'Auto compress')}</Button>}
              <Button onClick={() => { stop(); setU(0); }}>{tr('처음으로', 'Reset')}</Button>
              <SpeedControl className="ml-auto" />
            </div>
          </div>
          <div>
            <label className="flex items-center gap-2 font-medium text-ink">
              <input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} /> {tr('상판 회전 자유', 'Top plate free to rotate')}
            </label>
            <div className={`mt-2 ${free ? 'opacity-40' : ''}`}>
              <div className="flex justify-between"><span>{tr('규정 비틀림', 'Prescribed twist')}</span><span className="tnum">{degTxt(twist, 0)}</span></div>
              <input type="range" className="w-full" min={-45} max={45} step={1} value={twist} disabled={free} aria-label={tr('규정 비틀림', 'Prescribed twist')}
                onChange={(e) => setTwist(parseInt(e.target.value))} />
            </div>
            {ratio !== null && <p className="mt-2 text-[13px] text-ink-2">{tr(<>같은 압축에서 Yoshimura의 에너지가 Kresling의 <b className="tnum text-ink">{ratio >= 100 ? ratio.toFixed(0) : ratio.toFixed(1)}배</b>이다.</>, <>At the same compression, Yoshimura's energy is <b className="tnum text-ink">{ratio >= 100 ? ratio.toFixed(0) : ratio.toFixed(1)}×</b> Kresling's.</>)}</p>}
          </div>
        </div>
        {error && <p className="mt-2 text-[13px] text-bad">{tr('계산 실패', 'Computation failed')}: {error}</p>}
        <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
          {tr(<>
          반지름, 높이, 다각형, 강성은 같다. 상판은 강체 판으로 축 방향으로 눌리며, "회전 자유"이면 토크가 0이 되는 각까지 스스로 돈다.
          Kresling은 압축되며 비틀린다(카이랄성에서 오는 압축–비틀림 연성). Yoshimura는 비틀리지 않는다: 강체로 접히지 않아 처음에는 면이 압축되며 에너지를 쌓다가, 약 34% 압축에서 다이아몬드 모양으로 좌굴하며(스냅) 에너지가 급감한다. 다시 펴면 한참 동안 좌굴 상태가 유지된다(쌍안정·히스테리시스).
          비틀림을 규정하면(회전 자유 해제) Kresling의 선호 방향과 반대로 돌릴 때 에너지가 커진다.
          접촉(층 간 충돌) 모델은 없으므로 압축 범위를 자기 교차가 생기지 않는 {Math.round((PAIR_U_MAX / 1.2) * 100)}%까지로 둔다.
          </>, <>
          Radius, height, polygon and stiffness are the same. The top is a rigid plate pressed along the axis; with "free to rotate" it turns by itself to the angle where the torque is zero.
          Kresling twists as it compresses (compression–twist coupling from its chirality). Yoshimura does not twist: it cannot fold rigidly, so at first its facets compress and store energy, then at about 34% compression it buckles into a diamond shape (snap) and the energy drops sharply. When released, it stays buckled for a long while (bistability, hysteresis).
          With a prescribed twist (rotation not free), turning against Kresling's preferred direction raises the energy.
          There is no contact (layer collision) model, so compression is limited to {Math.round((PAIR_U_MAX / 1.2) * 100)}%, before any self-intersection appears.
          </>)}
        </p>
      </div>
    </div>
  );
}
