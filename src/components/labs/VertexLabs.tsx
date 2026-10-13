import { ArrowRight, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { fixBySector, kawasaki } from '../../core/constraints/kawasaki';
import { maekawa } from '../../core/constraints/maekawa';
import { checkMVAssignment } from '../../core/constraints/mvAssignment';
import { generalizedFlatFold, generalizedMaekawa } from '../../core/constraints/generalizedFlatFold';
import { DEG } from '../../core/numerics/tolerances';
import { applyParams, loadLesson } from '../../state/actions';
import { ASSIGN_COLOR, Badge, Button, NumberField, Section } from '../controls/ui';
import { VertexDiagram } from './VertexDiagram';
import { C, withAlpha } from '../../theme/tokens';

const deg = (r: number) => (r * 180) / Math.PI;
type MV = 'M' | 'V';

function raysFromSectors(sectorsDeg: number[]): number[] {
  const out: number[] = [];
  let a = 0;
  for (const s of sectorsDeg) { out.push(a * DEG); a += s; }
  return out;
}
function sectorsFromRays(rays: number[]): number[] {
  return rays.map((a, i) => (i === rays.length - 1 ? 2 * Math.PI - a + rays[0] : rays[i + 1] - a));
}

function useVertex(initial: number[], initialMV: MV[]) {
  const [rays, setRays] = useState(() => raysFromSectors(initial));
  const [mv, setMv] = useState<MV[]>(initialMV);
  const sectors = useMemo(() => sectorsFromRays(rays), [rays]);
  const drag = (i: number, a: number) => {
    setRays((r) => {
      const n = r.length;
      const out = [...r];
      if (i === 0) {
        // ray 0 defines the frame: rotate everything else instead of reordering
        const lo = r[n - 1] - 2 * Math.PI + 0.02, hi = r[1] - 0.02;
        let x = a > Math.PI ? a - 2 * Math.PI : a;
        x = Math.max(lo, Math.min(hi, x));
        const d = x - r[0];
        return out.map((v, k) => (k === 0 ? 0 : v - d)).map((v) => v);
      }
      const lo = r[i - 1] + 0.02, hi = i === n - 1 ? r[0] + 2 * Math.PI - 0.02 : r[i + 1] - 0.02;
      out[i] = Math.max(lo, Math.min(hi, a));
      return out;
    });
  };
  const load = (s: number[], m: MV[]) => { setRays(raysFromSectors(s)); setMv(m); };
  return { rays, setRays, mv, setMv, sectors, drag, load };
}

function SectorTable({ sectors, mv, onEdit }: { sectors: number[]; mv: MV[]; onEdit?: (i: number, d: number) => void }) {
  return (
    <table className="w-full tnum text-[12px]">
      <thead><tr className="text-ink-3"><td>i</td><td>θi</td><td>홀짝</td><td>크리스 c(i) M/V</td></tr></thead>
      <tbody>
        {sectors.map((s, i) => (
          <tr key={i}>
            <td className="text-ink-3">{i + 1}</td>
            <td>{onEdit ? <NumberField value={+deg(s).toFixed(3)} width="w-20" onCommit={(d) => onEdit(i, d)} suffix="°" /> : `${deg(s).toFixed(2)}°`}</td>
            <td className={i % 2 === 0 ? 'text-info' : 'text-ink-2'}>{i % 2 === 0 ? '홀수' : '짝수'}</td>
            <td style={{ color: ASSIGN_COLOR[mv[i]] }}>{mv[i]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function openIn3D(sectors: number[], mv: MV[]) {
  loadLesson('l2-single');
  applyParams({ sectors: sectors.map((s) => deg(s).toFixed(4)).join(','), mv: mv.join(',') });
}

// ───────────────────────────────────────── Kawasaki
export function KawasakiLab() {
  const v = useVertex([120, 90, 60, 90], ['M', 'M', 'M', 'V']);
  const [sel, setSel] = useState<number | null>(0);
  const k = kawasaki(v.sectors);
  const ok = k.satisfied;
  const setN = (n: number) => v.load(Array.from({ length: n }, () => 360 / n), Array.from({ length: n }, (_, i) => (i === 0 ? 'V' : 'M')) as MV[]);
  return (
    <div className="grid grid-cols-[auto_1fr] gap-4">
      <div>
        <VertexDiagram rays={v.rays} mv={v.mv} onDrag={v.drag} onSectorClick={setSel} selectedSector={sel} size={420} />
        <p className="text-center text-[12px] text-ink-3">크리스 광선(또는 끝 표식)을 끌어 움직인다. 섹터를 클릭하면 선택된다.</p>
      </div>
      <div className="space-y-2">
        <Section title="Kawasaki 상태">
          <div className={`rounded border p-3 ${ok ? 'border-ok/40 bg-ok-soft' : 'border-bad/40 bg-bad-soft'}`}>
            <div className="tnum text-[22px]">{(deg(k.residual) >= 0 ? '+' : '') + deg(k.residual).toFixed(3)}°</div>
            <div className="text-[12px] text-ink-3">Kawasaki 잔차 = Σodd θi − Σeven θi</div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1 tnum text-[13px]">
            <div>Σ 홀수 = <span className="text-info">{deg(k.sumOdd).toFixed(3)}°</span></div>
            <div>Σ 짝수 = <span className="text-ink-2">{deg(k.sumEven).toFixed(3)}°</span></div>
            <div>Σ 전체 = {deg(k.total).toFixed(3)}°</div>
            <div>n = {k.n}</div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            <Badge status={k.evenDegree ? 'ok' : 'bad'}>n 짝수</Badge>
            <Badge status={k.flatSheet ? 'ok' : 'warn'}>Σθ = 360°</Badge>
            <Badge status={Math.abs(k.residual) < 1.75e-4 ? 'ok' : 'bad'}>Σodd = Σeven</Badge>
            <Badge status={ok ? 'ok' : 'bad'}>{ok ? '평탄 접힘 가능한 섹터각' : '평탄 접힘 불가능'}</Badge>
          </div>
        </Section>
        <Section title="동작">
          <div className="flex flex-wrap gap-1">
            <Button kind="primary" disabled={sel === null || ok || !k.evenDegree} onClick={() => {
              const f = fixBySector(v.sectors, sel ?? 0);
              if (f) v.load(f.map(deg), v.mv);
            }}>평탄 접힘 가능하게 수정 (θ{(sel ?? 0) + 1}의 광선 하나 이동)</Button>
            <Button onClick={() => v.load([91.5, 88, 90, 90.5], ['V', 'M', 'M', 'M'])}>"정리 깨기" 프리셋</Button>
            <Button onClick={() => v.load([60, 40, 70, 80, 50, 60], ['M', 'V', 'M', 'M', 'V', 'M'])}>6차</Button>
            {[4, 6, 8].map((n) => <Button key={n} onClick={() => setN(n)}>n = {n} (등분)</Button>)}
            <Button onClick={() => setN(5)}>n = 5 (홀수)</Button>
            <Button onClick={() => openIn3D(v.sectors, v.mv)} disabled={!ok}>3D로 접기<ArrowRight size={14} /></Button>
          </div>
          <p className="mt-1 text-[12px] text-ink-3">"평탄 접힘 가능하게 수정"은 선택한 섹터를 둘러싼 광선 하나를 δ = −잔차/2만큼 회전시킨다. θk는 +δ, 이웃 섹터는 −δ만큼 변하므로 Σθ는 360°로 유지되고 교대합은 0이 된다.</p>
        </Section>
        <Section title="섹터"><SectorTable sectors={v.sectors} mv={v.mv} /></Section>
      </div>
    </div>
  );
}

// ───────────────────────────────────────── Maekawa
export function MaekawaLab() {
  const v = useVertex([70, 100, 110, 80], ['V', 'M', 'V', 'V']);
  const m = maekawa(v.mv);
  const k = kawasaki(v.sectors);
  const full = k.satisfied ? checkMVAssignment(v.sectors, v.mv) : null;
  return (
    <div className="grid grid-cols-[auto_1fr] gap-4">
      <div>
        <VertexDiagram rays={v.rays} mv={v.mv} onRayClick={(i) => v.setMv((mv) => mv.map((x, j) => (j === i ? (x === 'M' ? 'V' : 'M') : x)))} size={420} />
        <p className="text-center text-[12px] text-ink-3">크리스(또는 표식)를 클릭하여 산접기 / 골접기를 전환한다.</p>
      </div>
      <div className="space-y-2">
        <Section title="개수 조건 (Maekawa–Justin)">
          <div className="grid grid-cols-3 gap-2 tnum">
            <div className="rounded bg-paper-2 p-2"><div className="text-[12px] text-ink-3">M</div><div className="text-[18px] text-bad">{m.M}</div></div>
            <div className="rounded bg-paper-2 p-2"><div className="text-[12px] text-ink-3">V</div><div className="text-[18px] text-info">{m.V}</div></div>
            <div className="rounded bg-paper-2 p-2"><div className="text-[12px] text-ink-3">V − M</div><div className="text-[18px]">{m.difference > 0 ? '+' : ''}{m.difference}</div></div>
          </div>
          <div className="mt-2"><Badge status={m.satisfied ? 'ok' : 'bad'}>|M − V| = 2 {m.satisfied ? '성립' : '불성립'}</Badge></div>
        </Section>
        <Section title="필요조건 vs 충분조건">
          <div className="space-y-1 text-[13px]">
            <div className="flex justify-between"><span>필요: |M − V| = 2</span><Badge status={m.satisfied ? 'ok' : 'bad'} /></div>
            <div className="flex justify-between"><span>필요: Kawasaki (섹터각)</span><Badge status={k.satisfied ? 'ok' : 'bad'} /></div>
            <div className="flex justify-between"><span>충분 판정: crimp(크림프) / big–little–big 축약</span>{full ? <Badge status={full.valid ? 'ok' : 'bad'}>{full.valid ? '유효' : '무효'}</Badge> : <Badge status="na">Kawasaki 필요</Badge>}</div>
            {full && !full.valid && <p className="text-[12px] text-bad">{full.reason}</p>}
            {m.satisfied && full && !full.valid && <p className="rounded border border-warn/40 bg-warn-soft p-1.5 text-[12px] text-warn">Maekawa는 성립하지만 이 배정은 여전히 평탄 접힘 불가능하다 — 개수 조건만으로는 충분하지 않다.</p>}
          </div>
        </Section>
        <Section title="프리셋">
          <div className="flex flex-wrap gap-1">
            <Button onClick={() => v.load([70, 100, 110, 80], ['V', 'M', 'V', 'V'])}>유효한 4차</Button>
            <Button onClick={() => v.load([70, 100, 110, 80], ['V', 'V', 'M', 'V'])}>|M−V|=2이지만 무효</Button>
            <Button onClick={() => v.load([90, 90, 90, 90], ['M', 'V', 'M', 'V'])}>M=2, V=2</Button>
            <Button onClick={() => v.load([60, 40, 70, 80, 50, 60], ['M', 'V', 'M', 'M', 'V', 'M'])}>6차</Button>
          </div>
        </Section>
        <Section title="섹터"><SectorTable sectors={v.sectors} mv={v.mv} /></Section>
      </div>
    </div>
  );
}

// ───────────────────────────────────────── recursive crimp proof
function LinearVertex({ sectors, mv, creases, mark }: { sectors: number[]; mv: MV[]; creases: number[]; mark?: number }) {
  const total = sectors.reduce((a, b) => a + b, 0);
  const W = 560;
  let x = 0;
  return (
    <svg viewBox={`0 0 ${W} 58`} className="w-full">
      {sectors.map((s, i) => {
        const w = (s / total) * (W - 20);
        const x0 = 10 + x;
        x += w;
        return (
          <g key={i}>
            <rect x={x0} y={20} width={w} height={16} fill={i === mark ? withAlpha(C.mark, 0.6) : i % 2 === 0 ? C.infoSoft : C.badSoft} />
            <text x={x0 + w / 2} y={53} fontSize={13} fill={C.ink2} textAnchor="middle" fontFamily="monospace">{deg(s).toFixed(1)}°</text>
            <line x1={x0} x2={x0} y1={15} y2={40} stroke={ASSIGN_COLOR[mv[i]]} strokeWidth={3} />
            <text x={x0} y={12} fontSize={13} fill={ASSIGN_COLOR[mv[i]]} textAnchor="middle" fontFamily="monospace">c{creases[i] + 1}{mv[i]}</text>
          </g>
        );
      })}
      <text x={W - 10} y={12} fontSize={12} fill={C.ink3} textAnchor="end" fontFamily="monospace">(순환 → c{creases[0] + 1}로 복귀)</text>
    </svg>
  );
}

export function MVCrimpLab() {
  const v = useVertex([60, 40, 70, 80, 50, 60], ['M', 'V', 'M', 'M', 'V', 'M']);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const res = useMemo(() => checkMVAssignment(v.sectors, v.mv), [v.sectors, v.mv]);
  useEffect(() => setStep(0), [v.sectors, v.mv]);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setStep((s) => { if (s >= res.steps.length) { setPlaying(false); return s; } return s + 1; }), 1300);
    return () => clearInterval(t);
  }, [playing, res.steps.length]);
  const states = [{ creases: v.sectors.map((_, i) => i), mv: v.mv, sectors: v.sectors }, ...res.steps.map((s) => s.after)];
  return (
    <div className="grid grid-cols-[auto_1fr] gap-4">
      <div>
        <VertexDiagram rays={v.rays} mv={v.mv} onRayClick={(i) => v.setMv((mv) => mv.map((x, j) => (j === i ? (x === 'M' ? 'V' : 'M') : x)))} size={360}
          highlightRays={res.steps[step]?.removed} />
        <p className="text-center text-[12px] text-ink-3">크리스를 클릭하여 M/V를 전환한다.</p>
        <div className="mt-2 flex flex-wrap justify-center gap-1">
          <Button onClick={() => v.load([60, 40, 70, 80, 50, 60], ['M', 'V', 'M', 'M', 'V', 'M'])}>6차</Button>
          <Button onClick={() => v.load([70, 100, 110, 80], ['V', 'M', 'V', 'V'])}>4차</Button>
          <Button onClick={() => v.load([30, 50, 40, 60, 45, 35, 65, 35], ['V', 'M', 'V', 'V', 'M', 'V', 'V', 'V'])}>8차</Button>
        </div>
      </div>
      <div className="space-y-2">
        <Section title="재귀 증명 보기" right={<span className="flex gap-1"><Button kind="primary" onClick={() => { setStep(0); setPlaying(true); }}><Play size={14} />애니메이션</Button><Button onClick={() => setStep((s) => Math.max(0, s - 1))} title="이전 단계"><ChevronLeft size={14} /></Button><Button onClick={() => setStep((s) => Math.min(res.steps.length, s + 1))} title="다음 단계"><ChevronRight size={14} /></Button></span>}>
          {!kawasaki(v.sectors).satisfied && <p className="text-bad">Kawasaki 불성립: 재귀는 평탄 접힘 가능한 섹터각에만 적용된다.</p>}
          <div className="space-y-2">
            {states.slice(0, step + 1).map((st, i) => (
              <div key={i} className={i === step ? '' : 'opacity-50'}>
                <div className="text-[12px] text-ink-2">
                  {i === 0 ? '원래 패턴' : `단계 ${i}: ${res.steps[i - 1].strict ? '엄격한' : '비엄격'} 국소 최소 섹터 ${deg(res.steps[i - 1].before.sectors[res.steps[i - 1].sectorIndex]).toFixed(1)}°에서 crimp (c${res.steps[i - 1].removed[0] + 1}, c${res.steps[i - 1].removed[1] + 1})`}
                  {i > 0 && <span className="ml-1 tnum text-ink-3">→ θ(i−1) − θi + θ(i+1)</span>}
                </div>
                <LinearVertex sectors={st.sectors} mv={st.mv as MV[]} creases={st.creases} mark={i < res.steps.length ? res.steps[i]?.sectorIndex : undefined} />
              </div>
            ))}
          </div>
          {step >= res.steps.length && (
            <div className={`mt-2 rounded border p-2 text-[13px] ${res.valid ? 'border-ok/40 bg-ok-soft text-ok' : 'border-bad/40 bg-bad-soft text-bad'}`}>
              {res.valid ? '기저 사례: 배정이 같은 두 공선 크리스 (단일 직선 접기). ' : '증명 실패: '}{res.reason}
            </div>
          )}
        </Section>
        <Section title="시험 요약">
          <ol className="ml-4 list-decimal space-y-0.5 text-[13px] text-ink-2">
            <li>Kawasaki를 확인한다 (Σodd = Σeven = 180°).</li>
            <li>국소 최소 섹터 θi를 찾는다 (θi−1 ≥ θi ≤ θi+1). 엄격한 최소이면 양쪽 크리스의 배정은 달라야 한다 (big–little–big).</li>
            <li>Crimp(크림프): 두 크리스를 제거하고 θi−1 − θi + θi+1로 합친다. Kawasaki와 Maekawa는 보존된다.</li>
            <li>두 공선 크리스가 남을 때까지 반복한다. 두 크리스의 배정은 같아야 한다.</li>
          </ol>
        </Section>
      </div>
    </div>
  );
}

// ───────────────────────────────────────── generalized (non-flat) vertex
export function GeneralizedLab() {
  const [sectors, setSectors] = useState<number[]>([90, 45, 45, 90]);
  const [mv, setMv] = useState<MV[]>(['M', 'M', 'M', 'V']);
  const th = sectors.map((s) => s * DEG);
  const g = generalizedFlatFold(th);
  const gm = generalizedMaekawa(g.windingClass, mv);
  const load = (s: number[], m: MV[]) => { setSectors(s); setMv(m); };
  // winding diagram: folded image of ray k at angle φk, drawn on a spiral (radius grows with k)
  const n = sectors.length;
  const pts = g.partials.map((phi, k) => {
    const r = 0.35 + (0.6 * k) / n;
    return [r * Math.cos(phi), -r * Math.sin(phi)] as [number, number];
  });
  return (
    <div className="grid grid-cols-[auto_1fr] gap-4">
      <div>
        <svg viewBox="-1.15 -1.15 2.3 2.3" width={380} height={380}>
          <circle cx={0} cy={0} r={1} fill={C.paper} stroke={C.rule2} strokeWidth={0.008} />
          <line x1={0} y1={0} x2={1.05} y2={0} stroke={C.ink3} strokeWidth={0.006} strokeDasharray="0.03 0.02" />
          {pts.slice(0, -1).map((p, k) => {
            const r0 = 0.35 + (0.6 * k) / n, r1 = 0.35 + (0.6 * (k + 1)) / n;
            const a0 = g.partials[k], a1 = g.partials[k + 1];
            const steps = 24;
            const d = Array.from({ length: steps + 1 }, (_, j) => {
              const t = j / steps, a = a0 + (a1 - a0) * t, r = r0 + (r1 - r0) * t;
              return `${j ? 'L' : 'M'}${r * Math.cos(a)},${-r * Math.sin(a)}`;
            }).join(' ');
            return (
              <g key={k}>
                <path d={d} fill="none" stroke={k % 2 === 0 ? C.valley : C.locked} strokeWidth={0.02} />
                <line x1={0} y1={0} x2={p[0]} y2={p[1]} stroke={ASSIGN_COLOR[mv[k]] ?? '#888'} strokeWidth={0.008} opacity={0.6} />
              </g>
            );
          })}
          {pts.map((p, k) => <circle key={k} cx={p[0]} cy={p[1]} r={0.025} fill={k === n ? (g.satisfied ? C.ok : C.bad) : C.ink} />)}
          <text x={0} y={1.12} fontSize={12 * (2.3 / 380)} fill={C.ink2} textAnchor="middle">각 광선의 접힌 상: φk = θ1 − θ2 + … ± θk</text>
        </svg>
        <p className="w-[380px] max-w-full text-[13px] leading-relaxed text-ink-3">각 섹터를 방향을 번갈아 가며 평평하게 놓는다. 이 경로는 시작 광선(점선)에서 끝나야 한다: A = 0 (되돌아옴) 또는 A = ±360° (한 바퀴 감김). 나선 반지름은 층을 구분하기 위한 것일 뿐이다.</p>
      </div>
      <div className="space-y-2">
        <Section title="일반화 조건">
          <div className="grid grid-cols-2 gap-2 tnum">
            <div className="rounded bg-paper-2 p-2"><div className="text-[12px] text-ink-3">Σθ</div><div className="text-[18px]">{deg(g.total).toFixed(2)}°</div></div>
            <div className={`rounded p-2 ${g.satisfied ? 'bg-ok-soft' : 'bg-bad-soft'}`}><div className="text-[12px] text-ink-3">A = Σ(−1)^(i+1) θi</div><div className="text-[18px]">{deg(g.alternating).toFixed(2)}°</div></div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            <Badge status={n % 2 === 0 ? 'ok' : 'bad'}>n 짝수</Badge>
            <Badge status={g.satisfied ? 'ok' : 'bad'}>A ∈ {'{0°, ±360°}'}{g.windingClass !== null ? ` (A = ${g.windingClass * 360}°)` : ''}</Badge>
            <Badge status={Math.abs(g.total - 2 * Math.PI) < 1e-6 ? 'info' : g.total < 2 * Math.PI ? 'warn' : 'warn'}>{Math.abs(g.total - 2 * Math.PI) < 1e-6 ? '평평한 시트 (Σ = 360°)' : g.total < 2 * Math.PI ? '원뿔 (Σ < 360°)' : '안장 / 초과 (Σ > 360°)'}</Badge>
          </div>
        </Section>
        <Section title="일반화 Maekawa (클릭하여 전환)">
          <div className="mb-1 flex flex-wrap gap-1">
            {mv.map((x, i) => (
              <button key={i} type="button" className="rounded border border-rule-2 px-2 py-0.5 tnum text-[12px]" style={{ color: ASSIGN_COLOR[x] }} onClick={() => setMv((m) => m.map((y, j) => (j === i ? (y === 'M' ? 'V' : 'M') : y)))}>c{i + 1}:{x}</button>
            ))}
          </div>
          <div className="flex items-center justify-between text-[13px]"><span>M = {gm.M}, V = {gm.V}; 기대값 {gm.expected}</span><Badge status={gm.satisfied ? 'ok' : 'bad'} /></div>
        </Section>
        <Section title="섹터각 (°)">
          <div className="flex flex-wrap gap-1">
            {sectors.map((s, i) => <NumberField key={i} value={s} width="w-16" suffix={`θ${i + 1}`} onCommit={(x) => setSectors((ss) => ss.map((y, j) => (j === i ? x : y)))} />)}
          </div>
          <div className="mt-1 flex gap-1">
            <Button onClick={() => { setSectors((s) => [...s, 30, 30]); setMv((m) => [...m, 'M', 'V']); }}>+2 크리스</Button>
            <Button disabled={sectors.length <= 2} onClick={() => { setSectors((s) => s.slice(0, -2)); setMv((m) => m.slice(0, -2)); }}>−2 크리스</Button>
          </div>
        </Section>
        <Section title="프리셋">
          <div className="flex flex-wrap gap-1">
            <Button onClick={() => load([120, 90, 60, 90], ['M', 'M', 'M', 'V'])}>Σθ = 360° (A = 0)</Button>
            <Button onClick={() => load([90, 45, 45, 90], ['M', 'M', 'M', 'V'])}>Σθ = 270° (쇼핑백 모서리, A = 0)</Button>
            <Button onClick={() => load([200, 20, 200, 20], ['M', 'V', 'M', 'V'])}>Σθ = 440° (A = +360°)</Button>
            <Button onClick={() => load([20, 200, 20, 200], ['M', 'V', 'M', 'V'])}>A = −360°</Button>
            <Button onClick={() => load([80, 70, 60, 90], ['M', 'M', 'M', 'V'])}>일반 원뿔 (실패)</Button>
          </div>
          <p className="mt-1 text-[12px] text-ink-3">±360°인 이유: Σθ &gt; 360°이면 홀수 섹터만으로도 한 바퀴를 넘을 수 있으므로, 접힌 경로가 꼭짓점을 한 바퀴 감은 뒤 닫힐 수 있다. 이때 M과 V의 회전이 쌍으로 상쇄되므로 ⇒ M = V이다.</p>
        </Section>
      </div>
    </div>
  );
}
