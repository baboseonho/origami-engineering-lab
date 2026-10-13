import { Check, StepBack, StepForward } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { analyzeStrip, applyOp, describeOp, solveStrip, stripPolyline, type Strip, type StripOp } from '../../core/constraints/strip1D';
import { ASSIGN_COLOR, Badge, Button, Section } from '../controls/ui';
import { C, withAlpha } from '../../theme/tokens';

const PRESETS: Record<string, Strip> = {
  foldable: { length: 12, creases: [{ pos: 2, mv: 'V', id: 0 }, { pos: 5, mv: 'M', id: 1 }, { pos: 6, mv: 'V', id: 2 }, { pos: 9, mv: 'M', id: 3 }] },
  collision: { length: 12, creases: [{ pos: 3, mv: 'V', id: 0 }, { pos: 5.5, mv: 'M', id: 1 }, { pos: 6.5, mv: 'M', id: 2 }, { pos: 9, mv: 'V', id: 3 }] },
  noEndFold: { length: 12, creases: [{ pos: 4, mv: 'M', id: 0 }, { pos: 5, mv: 'V', id: 1 }, { pos: 7, mv: 'M', id: 2 }, { pos: 8, mv: 'V', id: 3 }] },
  equal: { length: 9, creases: [{ pos: 3, mv: 'M', id: 0 }, { pos: 6, mv: 'M', id: 1 }] },
};

const PRESET_LABELS: Record<string, string> = { foldable: '접힘 가능', collision: '충돌', noEndFold: '엔드 폴드 없음', equal: '등간격' };

const label = (id: number) => `c${id + 1}`;

export function Strip1DLab() {
  const [strip, setStrip] = useState<Strip>(PRESETS.foldable);
  const [executed, setExecuted] = useState<StripOp[]>([]);
  const [plan, setPlan] = useState<ReturnType<typeof solveStrip> | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: number; moved: boolean } | null>(null);

  // current reduced strip after the executed operations
  const current = useMemo(() => executed.reduce((s, op) => applyOp(s, op), strip), [strip, executed]);
  const analysis = useMemo(() => analyzeStrip(current), [current]);
  const full = useMemo(() => solveStrip(strip), [strip]);
  const W = 540, pad = 26, sx = (x: number) => pad + (x / strip.length) * (W - 2 * pad);

  const edit = (s: Strip) => { setStrip({ ...s, creases: [...s.creases].sort((a, b) => a.pos - b.pos) }); setExecuted([]); setPlan(null); };
  const execute = (op: StripOp) => setExecuted((e) => [...e, op]);
  const firstOp = (kind: 'endFold' | 'crimp') => analysis.ops.find((o) => o.kind === kind);

  // side view of the ORIGINAL strip with executed creases folded (schematic layering)
  const foldedIds = new Set(executed.flatMap((o) => o.creaseIds));
  const angles = strip.creases.map((c) => (foldedIds.has(c.id) ? (c.mv === 'V' ? 1 : -1) * (Math.PI - 0.12) : 0));
  const poly = stripPolyline(strip, angles);
  const xs = poly.map((p) => p[0]), zs = poly.map((p) => p[1]);
  const bx0 = Math.min(...xs), bx1 = Math.max(...xs), bz0 = Math.min(...zs), bz1 = Math.max(...zs);
  const segs = analysis.segments;

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-1">
        {Object.keys(PRESETS).map((k) => <Button key={k} onClick={() => edit(PRESETS[k])}>{PRESET_LABELS[k] ?? k}</Button>)}
        <Button onClick={() => {
          const n = 3 + Math.floor(Math.random() * 4);
          const pos = Array.from({ length: n }, () => 1 + Math.random() * 10).sort((a, b) => a - b).map((p) => Math.round(p * 2) / 2);
          edit({ length: 12, creases: [...new Set(pos)].map((p, i) => ({ pos: p, mv: Math.random() < 0.5 ? 'M' : 'V', id: i })) });
        }}>무작위</Button>
        <Button onClick={() => {
          const id = Math.max(-1, ...strip.creases.map((c) => c.id)) + 1;
          edit({ ...strip, creases: [...strip.creases, { pos: strip.length * (0.3 + 0.4 * Math.random()), mv: 'V', id }] });
        }}>+ 크리스</Button>
        <Button onClick={() => edit({ ...strip, creases: strip.creases.slice(0, -1) })} disabled={!strip.creases.length}>− 크리스</Button>
        <span className="mx-2 h-4 w-px bg-paper-3" />
        <Button disabled={!firstOp('endFold')} onClick={() => execute(firstOp('endFold')!)}>엔드 폴드 실행</Button>
        <Button disabled={!firstOp('crimp')} onClick={() => execute(firstOp('crimp')!)}>크림프 실행</Button>
        <Button kind="primary" onClick={() => { setExecuted([]); setPlan(solveStrip(strip)); }}>자동 풀이</Button>
        <Button disabled={!plan || executed.length >= (plan?.sequence.length ?? 0)} onClick={() => plan && execute(plan.sequence[executed.length])}>단계 <StepForward size={14} /></Button>
        <Button disabled={!executed.length} onClick={() => setExecuted((e) => e.slice(0, -1))}><StepBack size={14} />연산 취소</Button>
        <Button onClick={() => { setExecuted([]); setPlan(null); }}>펼치기</Button>
      </div>
      <div className="grid grid-cols-[1fr_330px] gap-3">
        <div>
          <Section title="크리스 패턴 (크리스 클릭: M/V 전환, 끌기: 이동)">
            <svg ref={svg} viewBox={`0 0 ${W} 110`} className="w-full touch-none select-none"
              onPointerMove={(e) => {
                if (!drag.current) return;
                drag.current.moved = true;
                const r = svg.current!.getBoundingClientRect();
                const x = ((((e.clientX - r.left) / r.width) * W - pad) / (W - 2 * pad)) * strip.length;
                const pos = Math.max(0.1, Math.min(strip.length - 0.1, Math.round(x * 20) / 20));
                const id = drag.current.id;
                setStrip((s) => ({ ...s, creases: s.creases.map((c) => (c.id === id ? { ...c, pos } : c)).sort((a, b) => a.pos - b.pos) }));
                setExecuted([]); setPlan(null);
              }}
              onPointerUp={() => {
                if (drag.current && !drag.current.moved) {
                  const id = drag.current.id;
                  edit({ ...strip, creases: strip.creases.map((c) => (c.id === id ? { ...c, mv: c.mv === 'M' ? 'V' : 'M' } : c)) });
                }
                drag.current = null;
              }}>
              <rect x={sx(0)} y={44} width={sx(strip.length) - sx(0)} height={16} fill={C.kraft} stroke={C.rule2} strokeWidth={1} rx={1} />
              {/* segment lengths of the ORIGINAL strip */}
              {segments(strip).map((s, i) => {
                const x0 = i === 0 ? 0 : strip.creases[i - 1].pos;
                return <text key={i} x={sx(x0 + s / 2)} y={84} fontSize={14} fill={C.ink2} textAnchor="middle" fontFamily="Pretendard Variable, sans-serif">{s.toFixed(2)}</text>;
              })}
              {/* highlights from the CURRENT (reduced) analysis, shown on executed=0 only */}
              {executed.length === 0 && analysis.ops.map((o, k) => {
                const cs = o.creaseIds.map((id) => strip.creases.find((c) => c.id === id)!);
                const x0 = sx(Math.min(...cs.map((c) => c.pos))) - (o.kind === 'endFold' ? 8 : 4), x1 = sx(Math.max(...cs.map((c) => c.pos))) + (o.kind === 'endFold' ? 8 : 4);
                return <rect key={'op' + k} x={x0} y={36} width={x1 - x0} height={32} fill="none" stroke={C.ok} strokeWidth={2} rx={4} />;
              })}
              {executed.length === 0 && analysis.collisions.map((c, k) => {
                const cs = c.creaseIds.map((id) => strip.creases.find((q) => q.id === id)!);
                return <rect key={'col' + k} x={sx(cs[0].pos) - 5} y={33} width={sx(cs[1].pos) - sx(cs[0].pos) + 10} height={38} fill={withAlpha(C.bad, 0.13)} stroke={C.bad} strokeWidth={2} rx={4} />;
              })}
              {executed.length === 0 && analysis.degenerate.map((c, k) => {
                const cs = c.creaseIds.map((id) => strip.creases.find((q) => q.id === id)!);
                return <rect key={'dg' + k} x={sx(cs[0].pos) - 5} y={33} width={sx(cs[1].pos) - sx(cs[0].pos) + 10} height={38} fill="none" stroke={C.warn} strokeDasharray="4 3" strokeWidth={1.5} rx={4} />;
              })}
              {strip.creases.map((c) => (
                <g key={c.id} onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); drag.current = { id: c.id, moved: false }; }} style={{ cursor: 'ew-resize' }}>
                  <line x1={sx(c.pos)} x2={sx(c.pos)} y1={38} y2={66} stroke={ASSIGN_COLOR[c.mv]} strokeWidth={foldedIds.has(c.id) ? 1.5 : 3.5} strokeDasharray={c.mv === 'M' ? '6 3 2 3' : '5 3'} opacity={foldedIds.has(c.id) ? 0.4 : 1} />
                  <rect x={sx(c.pos) - 8} y={30} width={16} height={44} fill="transparent" />
                  <text x={sx(c.pos)} y={24} fontSize={14} fontWeight={600} fill={ASSIGN_COLOR[c.mv]} textAnchor="middle" fontFamily="Pretendard Variable, sans-serif">{label(c.id)} {c.mv}</text>
                </g>
              ))}
            </svg>
            <div className="flex flex-wrap gap-3 text-[12px] text-ink-3">
              <span><span className="text-ok">▭</span> 가능한 연산</span>
              <span><span className="text-bad">▭</span> 충돌 (엄격히 더 짧은 구간 양쪽이 같은 방향)</span>
              <span><span className="text-warn">┄</span> 등거리 퇴화 경우</span>
            </div>
          </Section>
          <Section title={`연산 ${executed.length}회 후 측면도 (개략적 층 간격)`}>
            <svg viewBox={`${bx0 - 1} ${-bz1 - 1} ${bx1 - bx0 + 2} ${bz1 - bz0 + 2}`} className="h-40 w-full" preserveAspectRatio="xMidYMid meet">
              <polyline points={poly.map(([x, z]) => `${x},${-z}`).join(' ')} fill="none" stroke={C.kraft} strokeWidth={0.12} strokeLinejoin="round" />
              {poly.slice(1, -1).map(([x, z], i) => <circle key={i} cx={x} cy={-z} r={0.14} fill={ASSIGN_COLOR[strip.creases[i].mv]} />)}
            </svg>
            <p className="text-[12px] text-ink-3">겹친 층이 보이도록 접힌 크리스를 ±172°로 그린다. 이는 층 적층의 개략도이며 축척 도면이 아니다.</p>
          </Section>
        </div>
        <div>
          <Section title="판정">
            {full.foldable ? <Badge status="ok">평탄 접힘 가능: 완전한 엔드 폴드 / 크림프 순서가 존재한다</Badge> : <Badge status="bad">이 M/V 배정으로는 평탄 접힘 불가능</Badge>}
            {!full.foldable && analysis.collisions.length > 0 && (
              <p className="mt-1 text-[12px] text-bad">충돌 위치 {analysis.collisions.map((c) => `(${label(c.creaseIds[0])}, ${label(c.creaseIds[1])})`).join(', ')}: 양쪽 이웃보다 짧은 구간의 두 크리스가 같은 방향이다.</p>
            )}
            <div className="mt-2 tnum text-[12px] text-ink-3">현재 적층의 구간 길이: [{segs.map((s) => s.toFixed(2)).join(', ')}]</div>
            <div className="mt-1 text-[12px]">현재 가능한 연산: {analysis.ops.length ? analysis.ops.map((o) => describeOp(o, label)).join(', ') : current.creases.length ? '없음' : '완전히 접힘'}</div>
          </Section>
          <Section title="접기 순서">
            {plan ? (
              plan.foldable ? (
                <ol className="space-y-0.5 tnum text-[13px]">
                  {plan.sequence.map((op, i) => (
                    <li key={i} className={i < executed.length ? 'text-ok' : i === executed.length ? 'text-mark-ink' : 'text-ink-3'}>
                      단계 {i + 1}: {describeOp(op, label)} {i < executed.length && <Check size={13} className="inline" />}
                    </li>
                  ))}
                </ol>
              ) : <div className="text-bad">유효한 순서 없음: 이 M/V 배정으로는 평탄 접힘 불가능하다.</div>
            ) : <div className="text-[12px] text-ink-3">자동 풀이를 누른 뒤 "단계" 버튼으로 연산을 하나씩 실행한다.</div>}
          </Section>
          <Section title="규칙 (강의 부등식)">
            <ul className="space-y-1 text-[12px] text-ink-2">
              <li><b>엔드 폴드(end fold)</b> c₁: s₀ ≤ s₁ (플랩이 다음 구간 안에 놓인다)</li>
              <li><b>크림프(crimp)</b> (cᵢ, cᵢ₊₁): M/V가 반대이고 sᵢ₋₁ ≥ sᵢ ≤ sᵢ₊₁</li>
              <li><b>충돌</b>: M/V가 같고 sᵢ₋₁ &gt; sᵢ &lt; sᵢ₊₁ (엄격)</li>
              <li><b>등거리 경우</b>: M/V가 같고 sᵢ가 이웃 하나와 같음 — 강제 충돌이 아니며 탐색으로 처리한다.</li>
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}

function segments(s: Strip) {
  const out: number[] = [];
  let prev = 0;
  for (const c of s.creases) { out.push(c.pos - prev); prev = c.pos; }
  out.push(s.length - prev);
  return out;
}
