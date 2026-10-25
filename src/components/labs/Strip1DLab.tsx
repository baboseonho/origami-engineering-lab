import { Check, Pause, Play, RotateCcw, StepBack, StepForward } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { analyzeStrip, applyOp, segments, solveStrip, stripPolyline, type Strip, type StripOp } from '../../core/constraints/strip1D';
import { Badge, Button, SpeedControl } from '../controls/ui';
import { Rich } from '../controls/Rich';
import { C, withAlpha } from '../../theme/tokens';
import { tr } from '../../i18n';
import { useUI } from '../../state/uiStore';

const PRESETS: Record<string, Strip> = {
  foldable: { length: 12, creases: [{ pos: 2, mv: 'V', id: 0 }, { pos: 5, mv: 'M', id: 1 }, { pos: 6, mv: 'V', id: 2 }, { pos: 9, mv: 'M', id: 3 }] },
  collision: { length: 12, creases: [{ pos: 3, mv: 'V', id: 0 }, { pos: 5.5, mv: 'M', id: 1 }, { pos: 6.5, mv: 'M', id: 2 }, { pos: 9, mv: 'V', id: 3 }] },
  noEndFold: { length: 12, creases: [{ pos: 4, mv: 'M', id: 0 }, { pos: 5, mv: 'V', id: 1 }, { pos: 7, mv: 'M', id: 2 }, { pos: 8, mv: 'V', id: 3 }] },
  equal: { length: 9, creases: [{ pos: 3, mv: 'M', id: 0 }, { pos: 6, mv: 'M', id: 1 }] },
};

// functions, not constants, so the text follows the current language
const presetLabels = (): Record<string, string> => ({
  foldable: tr('접힘 가능', 'Foldable'), collision: tr('충돌', 'Collision'), noEndFold: tr('엔드 폴드 없음', 'No end fold'), equal: tr('등간격', 'Equal spacing'),
});
const opName = (op: Step) => op.kind === 'endFold' ? tr('엔드 폴드', 'End fold') : op.kind === 'crimp' ? tr('크림프', 'Crimp') : tr('충돌', 'Collision');
const label = (id: number) => `c${id + 1}`;

/** An operation of the plan, or the collision we demonstrate when the plan gets stuck. */
type Step = StripOp | { kind: 'collision'; creaseIds: [number, number] };

/** Folded creases are drawn a few degrees short of 180° so stacked layers stay visible. */
const SHORT = (7 * Math.PI) / 180;
const ease = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));

/** What "Fold" plays: the solver's sequence, or the greedy ops until stuck plus the colliding pair. */
function planFor(strip: Strip): { steps: Step[]; foldable: boolean } {
  const solved = solveStrip(strip);
  if (solved.foldable) return { steps: solved.sequence, foldable: true };
  const steps: Step[] = [];
  let s = strip;
  for (let guard = 0; guard < 50; guard++) {
    const a = analyzeStrip(s);
    if (a.collisions.length) { steps.push({ kind: 'collision', creaseIds: a.collisions[0].creaseIds }); break; }
    if (!a.ops.length) break;
    steps.push(a.ops[0]);
    s = applyOp(s, a.ops[0]);
  }
  return { steps, foldable: false };
}

/** Side-view polyline with the longest segment held still under its place on the pattern. */
function sideView(strip: Strip, angles: number[], anchor: number): [number, number][] {
  const pts = stripPolyline(strip, angles);
  const [a, b] = [pts[anchor], pts[anchor + 1]];
  const th = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const x0 = anchor === 0 ? 0 : strip.creases[anchor - 1].pos;
  const c = Math.cos(-th), s = Math.sin(-th);
  return pts.map(([x, z]) => {
    const dx = x - a[0], dz = z - a[1];
    return [x0 + dx * c - dz * s, dx * s + dz * c];
  });
}

/** First crossing of two non-neighbouring segments of a polyline (the paper passing through itself). */
function crossing(p: [number, number][]): [number, number] | null {
  const n = p.length - 1;
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    const [a, b, c, d] = [p[i], p[i + 1], p[j], p[j + 1]];
    const den = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]);
    if (Math.abs(den) < 1e-12) continue;
    const t = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / den;
    const u = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / den;
    if (t > 1e-3 && t < 1 - 1e-3 && u > 1e-3 && u < 1 - 1e-3) return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  }
  return null;
}

function useWidth<T extends Element>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(900);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(320, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** A crease marker for the legend and the pattern: a mountain ∧ or a valley ∨ glyph. */
function MVGlyph({ mv, x, y, size = 9 }: { mv: 'M' | 'V'; x: number; y: number; size?: number }) {
  const col = mv === 'M' ? C.mountain : C.valley;
  const d = mv === 'M' ? `M${x - size},${y + size / 2} L${x},${y - size / 2} L${x + size},${y + size / 2}` : `M${x - size},${y - size / 2} L${x},${y + size / 2} L${x + size},${y - size / 2}`;
  return <path d={d} fill="none" stroke={col} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />;
}

export function Strip1DLab() {
  const [strip, setStrip] = useState<Strip>(PRESETS.foldable);
  const [done, setDone] = useState(0); // steps finished
  const [anim, setAnim] = useState<{ k: number; p: number } | null>(null);
  const [auto, setAuto] = useState(false);
  /** the moment a colliding pair first touches: the fold stays frozen there */
  const [stuck, setStuck] = useState<{ k: number; p: number } | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: number; moved: boolean } | null>(null);
  const [box, W] = useWidth<HTMLDivElement>();

  const plan = useMemo(() => planFor(strip), [strip]);
  const steps = plan.steps;
  const current = useMemo(() => steps.slice(0, done).filter((s): s is StripOp => s.kind !== 'collision').reduce((s, op) => applyOp(s, op), strip), [strip, steps, done]);
  const analysis = useMemo(() => analyzeStrip(current), [current]);
  const segs0 = useMemo(() => segments(strip), [strip]);
  const anchor = useMemo(() => segs0.indexOf(Math.max(...segs0)), [segs0]);

  const reset = () => { setDone(0); setAnim(null); setAuto(false); setStuck(null); };
  const edit = (s: Strip) => { setStrip({ ...s, creases: [...s.creases].sort((a, b) => a.pos - b.pos) }); reset(); };

  // the animation clock: one step at a time, at the shared fold speed
  useEffect(() => {
    if (!anim) return;
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const dt = now - last; last = now;
      const speed = useUI.getState().foldSpeed;
      setAnim((a) => {
        if (!a) return a;
        const p = a.p + (dt * speed) / 1400;
        if (p >= 1) return { k: a.k, p: 1 };
        return { k: a.k, p };
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [anim?.k]); // eslint-disable-line react-hooks/exhaustive-deps

  // fold angles of the ORIGINAL strip at this moment
  const sign = (id: number) => (strip.creases.find((c) => c.id === id)!.mv === 'V' ? 1 : -1);
  const angleOf = new Map<number, number>();
  for (let k = 0; k < done; k++) for (const id of steps[k].creaseIds) angleOf.set(id, sign(id) * (Math.PI - SHORT));
  const moving = anim ?? stuck;
  const animStep = moving ? steps[moving.k] : null;
  if (animStep) for (const id of animStep.creaseIds) angleOf.set(id, sign(id) * (Math.PI - SHORT) * ease(moving!.p));
  const angles = strip.creases.map((c) => angleOf.get(c.id) ?? 0);
  const poly = sideView(strip, angles, anchor);
  const cross = animStep?.kind === 'collision' ? crossing(poly) : null;
  const hit = stuck ? cross : null;

  // stop at the first contact of a colliding pair; finish ordinary steps
  useEffect(() => {
    if (!anim) return;
    if (animStep?.kind === 'collision' && cross) { setStuck({ k: anim.k, p: anim.p }); setAnim(null); setAuto(false); return; }
    if (anim.p >= 1) {
      setAnim(null);
      setDone((d) => d + 1);
    }
  }, [anim, cross, animStep]);
  // auto: start the next step when one finishes
  useEffect(() => {
    if (auto && !anim && !stuck) {
      if (done < steps.length) setAnim({ k: done, p: 0 });
      else setAuto(false);
    }
  }, [auto, anim, done, steps.length, stuck]);

  const stepOnce = () => { if (!anim && done < steps.length && !stuck) setAnim({ k: done, p: 0 }); };
  const finished = done >= steps.length && plan.foldable;

  // ── geometry in screen pixels
  const pad = 36;
  const sx = (x: number) => pad + (x / strip.length) * (W - 2 * pad);
  const k = (W - 2 * pad) / strip.length;
  const BAND_Y = 126, BAND_H = 26;
  const cpH = 202;
  // handles of creases closer than a handle's width sit one row higher
  const level: number[] = [];
  strip.creases.forEach((c, i) => { const dx = i ? sx(c.pos) - sx(strip.creases[i - 1].pos) : Infinity; level.push(dx < 56 && level[i - 1] === 0 ? 1 : 0); });
  const maxSeg = Math.max(...segs0);
  const s2 = Math.min(k, 120 / maxSeg);
  const sideH = Math.max(200, 2 * maxSeg * s2 + 60);
  const midX = (W) / 2;
  const cxAnchor = (anchor === 0 ? 0 : strip.creases[anchor - 1].pos) + segs0[anchor] / 2;
  const SX = (x: number) => midX + (x - cxAnchor) * s2 + (sx(cxAnchor) - midX);
  const SZ = (z: number) => sideH / 2 - z * s2;
  const foldedIds = new Set(steps.slice(0, done).flatMap((s) => s.creaseIds));
  const showOps = done === 0 && !anim;

  const group = 'flex flex-wrap items-center gap-1.5 rounded-[4px] border border-rule-2 bg-paper px-2 py-1.5';
  const cap = 'lettering mr-1 text-[12px] text-ink-3';

  return (
    <div className="grid gap-3">
      {/* controls: what pattern, then fold it */}
      <div className="flex flex-wrap items-stretch gap-2">
        <div className={group}>
          <span className={cap}>{tr('패턴', 'Pattern')}</span>
          {Object.keys(PRESETS).map((key) => <Button key={key} size="sm" onClick={() => edit(PRESETS[key])}>{presetLabels()[key]}</Button>)}
          <Button size="sm" onClick={() => {
            const n = 3 + Math.floor(Math.random() * 4);
            const pos = Array.from({ length: n }, () => 1 + Math.random() * 10).sort((a, b) => a - b).map((p) => Math.round(p * 2) / 2);
            edit({ length: 12, creases: [...new Set(pos)].map((p, i) => ({ pos: p, mv: Math.random() < 0.5 ? 'M' : 'V', id: i })) });
          }}>{tr('무작위', 'Random')}</Button>
          <Button size="sm" onClick={() => {
            const id = Math.max(-1, ...strip.creases.map((c) => c.id)) + 1;
            edit({ ...strip, creases: [...strip.creases, { pos: Math.round(strip.length * (0.3 + 0.4 * Math.random()) * 2) / 2, mv: 'V', id }] });
          }}>{tr('+ 크리스', '+ Crease')}</Button>
          <Button size="sm" onClick={() => edit({ ...strip, creases: strip.creases.slice(0, -1) })} disabled={!strip.creases.length}>{tr('− 크리스', '− Crease')}</Button>
        </div>
        <div className={group}>
          <span className={cap}>{tr('접기', 'Fold')}</span>
          <Button kind="primary" size="sm" disabled={finished || !!stuck || steps.length === 0} onClick={() => setAuto((a) => !a)}>
            {auto ? <><Pause size={14} />{tr('멈춤', 'Pause')}</> : <><Play size={14} />{tr('끝까지 접기', 'Fold all the way')}</>}
          </Button>
          <Button size="sm" disabled={!!anim || done >= steps.length || !!stuck} onClick={stepOnce}>{tr('한 단계', 'One step')}<StepForward size={14} /></Button>
          <Button size="sm" disabled={!!anim || (!done && !stuck)} onClick={() => { if (stuck) setStuck(null); else setDone((d) => Math.max(0, d - 1)); }}><StepBack size={14} />{tr('되돌리기', 'Back')}</Button>
          <Button size="sm" onClick={reset}><RotateCcw size={14} />{tr('펼치기', 'Unfold')}</Button>
          <SpeedControl />
        </div>
      </div>

      <div className="grid gap-3">
        <div ref={box} className="min-w-0 rounded-[3px] border border-rule-2 bg-paper">
          {/* ── the pattern, seen from above */}
          <div className="flex items-baseline justify-between px-4 pt-3">
            <span className="lettering text-[12px] text-ink-3">{tr('전개도 · 위에서 본 띠', 'Crease pattern · the strip from above')}</span>
            <span className="text-[13px] text-ink-3">{tr('크리스를 누르면 산 ↔ 골, 끌면 이동', 'Click a crease to swap M ↔ V, drag to move it')}</span>
          </div>
          <svg ref={svg} width={W} height={cpH} className="block touch-none select-none"
            onPointerMove={(e) => {
              if (!drag.current) return;
              drag.current.moved = true;
              const r = svg.current!.getBoundingClientRect();
              const x = ((e.clientX - r.left - pad) / (W - 2 * pad)) * strip.length;
              const pos = Math.max(0.25, Math.min(strip.length - 0.25, Math.round(x * 4) / 4));
              const id = drag.current.id;
              setStrip((s) => ({ ...s, creases: s.creases.map((c) => (c.id === id ? { ...c, pos } : c)).sort((a, b) => a.pos - b.pos) }));
              reset();
            }}
            onPointerUp={() => {
              if (drag.current && !drag.current.moved) {
                const id = drag.current.id;
                edit({ ...strip, creases: strip.creases.map((c) => (c.id === id ? { ...c, mv: c.mv === 'M' ? 'V' : 'M' } : c)) });
              }
              drag.current = null;
            }}>
            <defs>
              <linearGradient id="strip-paper" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={C.paperFront} />
                <stop offset="1" stopColor={withAlpha(C.kraft, 0.55)} />
              </linearGradient>
            </defs>
            {/* operation highlights, before folding starts */}
            {showOps && analysis.ops.map((o, i) => {
              const cs = o.creaseIds.map((id) => strip.creases.find((c) => c.id === id)!);
              const x0 = sx(Math.min(...cs.map((c) => c.pos))) - 14, x1 = sx(Math.max(...cs.map((c) => c.pos))) + 14;
              return (
                <g key={'op' + i}>
                  <rect x={x0} y={BAND_Y - 12} width={x1 - x0} height={BAND_H + 24} fill={withAlpha(C.ok, 0.07)} stroke={C.ok} strokeWidth={1.6} rx={6} />
                  <text x={(x0 + x1) / 2} y={BAND_Y + BAND_H + 28} fontSize={12} fill={C.ok} textAnchor="middle" fontWeight={600}>{opName(o)}</text>
                </g>
              );
            })}
            {(showOps || stuck) && analysis.collisions.map((c, i) => {
              const cs = c.creaseIds.map((id) => strip.creases.find((q) => q.id === id)!);
              const x0 = sx(cs[0].pos) - 14, x1 = sx(cs[1].pos) + 14;
              return (
                <g key={'col' + i}>
                  <rect x={x0} y={BAND_Y - 12} width={x1 - x0} height={BAND_H + 24} fill={withAlpha(C.bad, 0.1)} stroke={C.bad} strokeWidth={1.8} rx={6} />
                  <text x={(x0 + x1) / 2} y={BAND_Y + BAND_H + 28} fontSize={12} fill={C.bad} textAnchor="middle" fontWeight={700}>{tr('충돌', 'Collision')}</text>
                </g>
              );
            })}
            {/* the paper */}
            <rect x={sx(0)} y={BAND_Y} width={sx(strip.length) - sx(0)} height={BAND_H} fill="url(#strip-paper)" stroke={C.ink3} strokeWidth={1} rx={2} />
            {/* dimension line of every segment */}
            {segs0.map((s, i) => {
              const a = i === 0 ? 0 : strip.creases[i - 1].pos;
              const y = BAND_Y + BAND_H + 48;
              const x0 = sx(a) + 3, x1 = sx(a + s) - 3;
              return (
                <g key={'dim' + i} opacity={0.95}>
                  <line x1={x0} x2={x1} y1={y} y2={y} stroke={C.ink3} strokeWidth={1} />
                  <path d={`M${x0},${y} l6,-3 v6 Z M${x1},${y} l-6,-3 v6 Z`} fill={C.ink3} />
                  {x1 - x0 > 30 && <text x={(x0 + x1) / 2} y={y - 5} fontSize={13} fill={C.ink2} textAnchor="middle" className="tnum">{x1 - x0 > 86 ? `s${i} = ${s.toFixed(2)}` : s.toFixed(x1 - x0 > 44 ? 2 : 1)}</text>}
                </g>
              );
            })}
            {/* the creases: a line across the band and a handle above */}
            {strip.creases.map((c, ci) => {
              const x = sx(c.pos);
              const up = level[ci] * 34;
              const col = c.mv === 'M' ? C.mountain : C.valley;
              const folded = foldedIds.has(c.id);
              return (
                <g key={c.id} onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); drag.current = { id: c.id, moved: false }; }} style={{ cursor: 'ew-resize' }} opacity={folded ? 0.45 : 1}>
                  <line x1={x} x2={x} y1={BAND_Y} y2={BAND_Y + BAND_H} stroke={col} strokeWidth={2.6} strokeDasharray={c.mv === 'M' ? '7 2.5 1.5 2.5' : '5 3'} />
                  <line x1={x} x2={x} y1={BAND_Y - 26 - up} y2={BAND_Y} stroke={col} strokeWidth={1} />
                  <rect x={x - 25} y={BAND_Y - 56 - up} width={50} height={30} rx={15} fill={C.paper} stroke={col} strokeWidth={1.6} />
                  <text x={x - 6} y={BAND_Y - 36 - up} fontSize={13} fontWeight={700} fill={col} textAnchor="middle">{label(c.id)}</text>
                  <MVGlyph mv={c.mv} x={x + 12} y={BAND_Y - 41 - up} size={6} />
                  {folded && <path d={`M${x + 18},${BAND_Y - 62 - up} l4,4 l8,-8`} fill="none" stroke={C.ok} strokeWidth={2} />}
                  <rect x={x - 26} y={BAND_Y - 58 - up} width={52} height={BAND_H + 62 + up} fill="transparent" />
                </g>
              );
            })}
          </svg>

          {/* ── the side view, folding */}
          <div className="flex items-baseline justify-between border-t border-dashed border-rule-2 px-4 pt-3">
            <span className="lettering text-[12px] text-ink-3">{tr('측면도 · 접는 모습', 'Side view · folding')}</span>
            <span className="text-[13px] text-ink-3">
              {anim && animStep ? `${opName(animStep)} (${animStep.creaseIds.map(label).join(', ')})` : hit ? tr('여기서 종이가 서로 부딪힌다', 'Here the paper runs into itself') : finished ? tr('완전히 접혔다', 'Folded flat') : tr(`${done}/${steps.length} 단계`, `step ${done} of ${steps.length}`)}
            </span>
          </div>
          <svg width={W} height={sideH} className="block">
            <line x1={pad} x2={W - pad} y1={SZ(0)} y2={SZ(0)} stroke={C.rule} strokeWidth={1} strokeDasharray="2 5" />
            {/* the strip: an ink outline with the paper inside */}
            <polyline points={poly.map(([x, z]) => `${SX(x)},${SZ(z)}`).join(' ')} fill="none" stroke={C.ink2} strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" />
            <polyline points={poly.map(([x, z]) => `${SX(x)},${SZ(z)}`).join(' ')} fill="none" stroke={C.kraft} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
            {poly.slice(1, -1).map(([x, z], i) => {
              const c = strip.creases[i];
              return (
                <g key={i}>
                  <circle cx={SX(x)} cy={SZ(z)} r={6} fill={C.paper} stroke={c.mv === 'M' ? C.mountain : C.valley} strokeWidth={2.4} />
                  <text x={SX(x)} y={SZ(z) - 12} fontSize={12} fontWeight={600} fill={c.mv === 'M' ? C.mountain : C.valley} textAnchor="middle" stroke={C.paper} strokeWidth={3} paintOrder="stroke">{label(c.id)}</text>
                </g>
              );
            })}
            {hit && (
              <g>
                <circle cx={SX(hit[0])} cy={SZ(hit[1])} r={16} fill={withAlpha(C.bad, 0.18)} stroke={C.bad} strokeWidth={2.4} className="animate-pulse" />
                <text x={SX(hit[0])} y={SZ(hit[1]) + 34} fontSize={14} fontWeight={700} fill={C.bad} textAnchor="middle" stroke={C.paper} strokeWidth={3} paintOrder="stroke">{tr('충돌!', 'Collision!')}</text>
              </g>
            )}
          </svg>
          <p className="px-4 pb-3 text-[13px] leading-relaxed text-ink-3">{tr('겹친 층이 보이도록 접힌 크리스를 180°보다 조금 덜 접어 그린다. 길이는 실제 비율이다.', 'Folded creases are drawn a little short of 180° so the stacked layers stay visible. Lengths are to scale.')}</p>
        </div>

        {/* ── verdict, sequence, rules */}
        <div className="grid content-start gap-3 text-[14px] lg:grid-cols-3">
          <section className="rounded-[3px] border border-rule-2 bg-paper px-4 py-3">
            <h3 className="lettering text-[12px] text-ink-3">{tr('판정', 'Verdict')}</h3>
            <div className="mt-1.5">{plan.foldable ? <Badge status="ok">{tr('평탄하게 접힌다', 'Folds flat')}</Badge> : <Badge status="bad">{tr('평탄하게 접히지 않는다', 'Does not fold flat')}</Badge>}</div>
            <p className="mt-2 leading-relaxed text-ink-2">
              {plan.foldable
                ? tr('엔드 폴드와 크림프만으로 끝까지 접는 순서가 있다.', 'There is an order that folds it completely with end folds and crimps alone.')
                : analysis.collisions.length || steps.some((s) => s.kind === 'collision')
                  ? tr('양옆보다 짧은 구간의 두 크리스가 같은 방향이다. 접으면 양쪽 종이가 서로 부딪힌다.', 'Two creases around a segment shorter than both neighbours point the same way. Folding them makes the paper run into itself.')
                  : tr('더 할 수 있는 연산이 없다.', 'No operation is left to do.')}
            </p>
          </section>
          <section className="rounded-[3px] border border-rule-2 bg-paper px-4 py-3">
            <h3 className="lettering text-[12px] text-ink-3">{tr('접는 순서', 'Folding order')}</h3>
            {steps.length ? (
              <ol className="mt-1.5 space-y-1">
                {steps.map((s, i) => {
                  const state = i < done ? 'done' : anim?.k === i ? 'now' : 'todo';
                  return (
                    <li key={i} className={`flex items-center gap-2 rounded-[3px] px-1.5 py-0.5 ${state === 'now' ? 'bg-mark/60' : ''} ${s.kind === 'collision' ? 'text-bad' : state === 'todo' ? 'text-ink-3' : 'text-ink'}`}>
                      <span className="tnum w-5 text-[13px] text-ink-3">{i + 1}</span>
                      <span className="font-medium">{opName(s)}</span>
                      <span className="tnum text-[13px]">{s.creaseIds.map(label).join(', ')}</span>
                      {state === 'done' && <Check size={14} className="ml-auto text-ok" />}
                    </li>
                  );
                })}
              </ol>
            ) : <p className="mt-1.5 text-ink-3">{tr('크리스가 없다.', 'No creases.')}</p>}
          </section>
          <section className="rounded-[3px] border border-rule-2 bg-paper px-4 py-3">
            <h3 className="lettering text-[12px] text-ink-3">{tr('규칙', 'Rules')}</h3>
            <dl className="mt-1.5 space-y-2.5 leading-relaxed">
              <div>
                <dt className="font-semibold text-ink">{tr('엔드 폴드', 'End fold')}</dt>
                <dd className="text-ink-2"><Rich text={tr('끝 구간이 다음 구간보다 짧으면 접어 넘길 수 있다: $s_0 \\le s_1$', 'The end segment folds over if it is no longer than the next: $s_0 \\le s_1$')} /></dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">{tr('크림프', 'Crimp')}</dt>
                <dd className="text-ink-2"><Rich text={tr('방향이 반대인 두 크리스 사이 구간이 양옆보다 길지 않으면 함께 접는다: $s_{i-1} \\ge s_i \\le s_{i+1}$', 'Two creases of opposite direction fold together if the segment between them is no longer than its neighbours: $s_{i-1} \\ge s_i \\le s_{i+1}$')} /></dd>
              </div>
              <div>
                <dt className="font-semibold text-bad">{tr('충돌', 'Collision')}</dt>
                <dd className="text-ink-2"><Rich text={tr('같은 방향의 두 크리스 사이 구간이 양옆보다 엄격히 짧으면 절대 접히지 않는다: $s_{i-1} > s_i < s_{i+1}$', 'Two creases of the same direction around a segment strictly shorter than both neighbours can never fold: $s_{i-1} > s_i < s_{i+1}$')} /></dd>
              </div>
            </dl>
            <p className="mt-2.5 text-[13px] leading-relaxed text-ink-3">{tr('Arkin 외(2004): 1D 패턴은 엔드 폴드와 크림프로 접을 수 있을 때, 그리고 그때에만 평탄하게 접힌다.', 'Arkin et al. (2004): a 1D pattern folds flat exactly when end folds and crimps can fold it.')}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
