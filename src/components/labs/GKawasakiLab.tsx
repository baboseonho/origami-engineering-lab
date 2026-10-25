import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  analyzeSectors, closureMargin, flatFoldedRays, fmtSigned, solveVertex3D,
  type SectorReport, type V3, type VertexShape,
} from '../../core/analysis/vertexWinding';
import { GK_CASES, type GKCase } from '../../curriculum/gkawasakiCases';
import { useUI } from '../../state/uiStore';
import { tr } from '../../i18n';
import { C } from '../../theme/tokens';
import { Button, SpeedControl } from '../controls/ui';

/** odd sectors (θ1, θ3, …) and even sectors (θ2, θ4, …): kept apart from the M/V red/blue */
const ODD = '#0e7490';
const EVEN = '#a3541c';
const colorOf = (i: number) => (i % 2 === 0 ? ODD : EVEN);
const rad = (d: number) => (d * Math.PI) / 180;
const deg1 = (d: number) => `${Math.round(d * 10) / 10}°`;

/** viewBox units per screen pixel of a square SVG spanning `span` units, so labels stay 12–13px. */
function useUnitPerPx(span: number) {
  const ref = useRef<SVGSVGElement>(null);
  const [u, setU] = useState(span / 320);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setU(span / Math.max(120, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [span]);
  return [ref, u] as const;
}

// ───────────────────────────────────────────── status bar

function Status({ r, shape }: { r: SectorReport; shape: VertexShape | null }) {
  const cls = r.intrinsic === 'flat' ? tr('평평한 종이', 'flat paper') : r.intrinsic === 'cone' ? tr('각 부족 → 원뿔형', 'angle deficit → cone') : tr('각 초과 → 안장형', 'angle surplus → saddle');
  const w = r.winding === null ? null : r.winding > 0 ? '+1' : r.winding < 0 ? '−1' : '0';
  return (
    <div className="grid overflow-hidden rounded-[3px] border border-rule-2 bg-paper md:grid-cols-[1.2fr_1fr_1fr]" role="status" aria-live="polite">
      <div className={`px-3.5 py-2.5 ${r.pass ? 'bg-ok-soft' : 'bg-bad-soft'}`}>
        <div className="lettering text-[12px] text-ink-3">{tr('일반화 Kawasaki (generalized)', 'Generalized Kawasaki')}</div>
        <div className="flex flex-wrap items-baseline gap-x-2.5">
          <span className={`text-[22px] font-bold tracking-tight ${r.pass ? 'text-ok' : 'text-bad'}`}>{r.pass ? tr('PASS · 성립', 'PASS · holds') : tr('FAIL · 위반', 'FAIL · violated')}</span>
        </div>
        <div className="text-[13px] leading-snug text-ink-2">{r.pass ? tr('S ∈ {0°, ±360°}: 접힌 경로가 시작 광선으로 돌아온다 (층 순서는 별도 문제)', 'S ∈ {0°, ±360°}: the folded path returns to the first ray (layer order is a separate question)') : r.reason}</div>
        {shape?.flatLocked && <div className="mt-0.5 text-[13px] font-medium text-ink">{tr('강체 패널은 3D로 열리지 않는다 (평탄 잠금). ① 설명 참고.', 'Rigid panels cannot open in 3D (flat-locked). See ①.')}</div>}
      </div>
      <div className="border-t border-rule-2 px-3.5 py-2.5 md:border-l md:border-t-0">
        <div className="lettering text-[12px] text-ink-3">{tr('교대합 S · 감김 수', 'Alternating sum S · winding')}</div>
        <div className="tnum text-[22px] font-semibold leading-tight text-ink">S = {fmtSigned(r.S)}</div>
        <div className="tnum text-[13px] text-ink-2">
          <span style={{ color: ODD }}>O {deg1(r.odd)}</span> − <span style={{ color: EVEN }}>E {deg1(r.even)}</span> · {tr('감김 수', 'winding')} {w === null ? <b className="text-bad">{tr('정수 아님', 'not an integer')} ({(r.S / 360).toFixed(2)})</b> : <b className="text-ink">{w}</b>}
        </div>
      </div>
      <div className="border-t border-rule-2 px-3.5 py-2.5 md:border-l md:border-t-0">
        <div className="lettering text-[12px] text-ink-3">{tr('종이 양 Σθ (곡률)', 'Paper amount Σθ (curvature)')}</div>
        <div className="tnum text-[22px] font-semibold leading-tight text-ink">T = {deg1(r.total)}</div>
        <div className="tnum text-[13px] text-ink-2">δ = 360° − T = {fmtSigned(r.defect)} · <span className="font-medium text-ink">{cls}</span></div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────── angle controls

function AngleControls({ theta, setTheta }: { theta: number[]; setTheta: (t: number[]) => void }) {
  const set = (i: number, v: number) => setTheta(theta.map((x, j) => (j === i ? Math.max(1, Math.min(179, v)) : x)));
  return (
    <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
      {theta.map((t, i) => (
        <label key={i} className="flex w-[118px] flex-col gap-0.5 text-[13px]">
          <span className="flex items-baseline justify-between">
            <span className="font-semibold" style={{ color: colorOf(i) }}>θ<sub>{i + 1}</sub> {i % 2 === 0 ? tr('(+, 홀수)', '(+, odd)') : tr('(−, 짝수)', '(−, even)')}</span>
          </span>
          <span className="flex items-center gap-1">
            <input type="number" min={1} max={179} step={0.5} value={t} aria-label={`θ${i + 1}`}
              onChange={(e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) set(i, v); }}
              className="tnum h-7 w-[64px] rounded-[3px] border border-rule-2 bg-paper px-1.5 text-[14px]" />
            <span className="text-ink-3">°</span>
          </span>
          <input type="range" min={1} max={179} step={0.5} value={t} aria-label={tr(`θ${i + 1} 슬라이더`, `θ${i + 1} slider`)} onChange={(e) => set(i, parseFloat(e.target.value))} style={{ accentColor: colorOf(i) }} />
        </label>
      ))}
      <div className="flex gap-1 pb-1">
        <Button size="sm" onClick={() => theta.length < 12 && setTheta([...theta, 30])} disabled={theta.length >= 12}>{tr('크리스 +1', 'Crease +1')}</Button>
        <Button size="sm" onClick={() => theta.length > 3 && setTheta(theta.slice(0, -1))} disabled={theta.length <= 3}>{tr('크리스 −1', 'Crease −1')}</Button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────── center: intrinsic sector diagram + O/E bars

function SectorDiagram({ theta, r }: { theta: number[]; r: SectorReport }) {
  const n = theta.length;
  let acc = 0;
  const wedges = theta.map((t, i) => {
    const a0 = acc, a1 = acc + t;
    acc = a1;
    const R = 0.62 + (0.3 * i) / Math.max(1, n - 1); // grow outward so an overlap past 360° stays visible
    return { a0, a1, R, i };
  });
  const pt = (a: number, R: number) => [R * Math.cos(rad(a)), -R * Math.sin(rad(a))];
  const arcPath = (a0: number, a1: number, R: number) => {
    const steps = Math.max(2, Math.ceil((a1 - a0) / 4));
    const pts = Array.from({ length: steps + 1 }, (_, k) => pt(a0 + ((a1 - a0) * k) / steps, R));
    return `M0,0 L${pts.map((p) => p.join(',')).join(' L')} Z`;
  };
  const [svg, u] = useUnitPerPx(2.24);
  const over = r.total - 360;
  const maxBar = Math.max(r.odd, r.even, 360);
  return (
    <div className="flex h-full flex-col">
      <svg ref={svg} viewBox="-1.12 -1.12 2.24 2.24" className="mx-auto aspect-square w-full max-w-[340px]" role="img" aria-label={tr('섹터각 다이어그램', 'Sector-angle diagram')}>
        <circle cx={0} cy={0} r={1} fill="none" stroke={C.rule2} strokeWidth={0.006} />
        {wedges.map((w) => (
          <path key={w.i} d={arcPath(w.a0, w.a1, w.R)} fill={colorOf(w.i)} fillOpacity={w.a0 >= 360 - 1e-9 || w.a1 > 360 + 1e-9 ? 0.32 : 0.2} stroke={colorOf(w.i)} strokeWidth={0.008} />
        ))}
        {/* 360° = one turn of ordinary paper */}
        <line x1={0} y1={0} x2={1.08} y2={0} stroke={C.ink} strokeWidth={0.008} strokeDasharray="0.03 0.02" />
        <text x={1.08} y={-5 * u} fontSize={12 * u} textAnchor="end" fill={C.ink2}>0° = 360°</text>
        {over > 1e-6 && (() => {
          const R = 1.04;
          const steps = Math.max(2, Math.ceil(over / 3));
          const d = Array.from({ length: steps + 1 }, (_, k) => pt(360 + (over * k) / steps, R).join(',')).join(' L');
          const mid = pt(360 + over / 2, 1.1);
          return <g><path d={`M${d}`} fill="none" stroke={C.bad} strokeWidth={0.025} /><text x={mid[0]} y={mid[1] + 0.02} fontSize={13 * u} textAnchor="middle" fill={C.bad} fontWeight={700}>{tr(`+${deg1(over)} 초과`, `+${deg1(over)} surplus`)}</text></g>;
        })()}
        {over < -1e-6 && (() => {
          const steps = Math.max(2, Math.ceil(-over / 3));
          const d = Array.from({ length: steps + 1 }, (_, k) => pt(r.total + (-over * k) / steps, 1.04).join(',')).join(' L');
          const mid = pt(r.total - over / 2, 1.1);
          return <g><path d={`M${d}`} fill="none" stroke={C.info} strokeWidth={0.025} /><text x={mid[0]} y={mid[1] + 0.02} fontSize={13 * u} textAnchor="middle" fill={C.info} fontWeight={700}>{tr(`${deg1(-over)} 부족`, `${deg1(-over)} deficit`)}</text></g>;
        })()}
        {wedges.map((w) => {
          const p = pt((w.a0 + w.a1) / 2, w.R * (w.i % 2 === 0 ? 0.55 : 0.8));
          return <text key={'l' + w.i} x={p[0]} y={p[1] + 4 * u} fontSize={13 * u} textAnchor="middle" fill={colorOf(w.i)} fontWeight={700} stroke={C.paper} strokeWidth={3 * u} paintOrder="stroke">θ{w.i + 1} {deg1(theta[w.i])}</text>;
        })}
      </svg>
      <p className="mt-1 text-center text-[13px] leading-snug text-ink-3">{tr('종이를 자르지 않고 펼친 순서대로 섹터를 이어 붙인 그림. 한 바퀴(360°)를 넘는 부분이 겹치면 각 초과 = 안장, 모자라면 각 부족 = 원뿔.', 'The sectors laid side by side in order, without cutting the paper. Overlap past one turn (360°) is an angle surplus = saddle; a shortfall is an angle deficit = cone.')}</p>
      <div className="mt-2 space-y-1.5 px-1 text-[13px]">
        {[[tr('O (홀수 θ)', 'O (odd θ)'), r.odd, ODD, theta.filter((_, i) => i % 2 === 0)], [tr('E (짝수 θ)', 'E (even θ)'), r.even, EVEN, theta.filter((_, i) => i % 2 === 1)]].map(([label, v, col, parts]) => (
          <div key={label as string}>
            <div className="flex flex-wrap justify-between gap-x-2"><span style={{ color: col as string }} className="whitespace-nowrap font-semibold">{label as string}</span><span className="tnum text-right text-ink">{(parts as number[]).map((p) => deg1(p)).join(' + ')} = <b>{deg1(v as number)}</b></span></div>
            <div className="mt-0.5 h-2.5 rounded-[2px] bg-paper-2"><div className="h-full rounded-[2px]" style={{ width: `${((v as number) / maxBar) * 100}%`, background: col as string }} /></div>
          </div>
        ))}
        <div className="tnum flex flex-wrap justify-between gap-x-2 border-t border-rule pt-1 text-[14px]"><span className="whitespace-nowrap text-ink-2">S = O − E</span><b className="text-ink">{deg1(r.odd)} − {deg1(r.even)} = {fmtSigned(r.S)}</b></div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────── right: angular walk

function AngularWalk({ r }: { r: SectorReport }) {
  const n = r.n;
  const phi = r.phi;
  // animation state: k = finished steps, p = progress of the current step
  const [k, setK] = useState(n);
  const [p, setP] = useState(0);
  const [playing, setPlaying] = useState(false);
  const raf = useRef(0);
  useEffect(() => { cancelAnimationFrame(raf.current); setPlaying(false); setK(n); setP(0); }, [phi.join(','), n]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const play = () => {
    cancelAnimationFrame(raf.current);
    let kk = k >= n ? 0 : k, pp = k >= n ? 0 : p;
    let last = performance.now();
    setPlaying(true);
    const tick = (now: number) => {
      const speed = useUI.getState().foldSpeed;
      const dur = 1000 + Math.abs(phi[kk + 1] - phi[kk]) * 6; // longer turns take a little longer
      pp += (Math.max(0, now - last) * speed) / dur;
      last = now;
      while (pp >= 1 && kk < n) { pp -= 1; kk++; if (kk < n) pp = Math.min(pp, 0); }
      if (kk >= n) { setK(n); setP(0); setPlaying(false); return; }
      setK(kk); setP(pp);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };
  const pause = () => { cancelAnimationFrame(raf.current); setPlaying(false); };
  const step = () => { pause(); if (k >= n) { setK(0); setP(0); } else { setK(k + 1); setP(0); } };
  const reset = () => { pause(); setK(0); setP(0); };

  const ease = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t);
  const cur = k >= n ? phi[n] : phi[k] + (phi[k + 1] - phi[k]) * ease(p);
  const r0 = 0.3, dr = 0.62 / Math.max(1, n);
  const pt = (a: number, R: number) => [R * Math.cos(rad(a)), -R * Math.sin(rad(a))];
  const arc = (a0: number, a1: number, R0: number, R1: number) => {
    const steps = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 3));
    return Array.from({ length: steps + 1 }, (_, j) => { const t = j / steps; return pt(a0 + (a1 - a0) * t, R0 + (R1 - R0) * t).join(','); }).join(' L');
  };
  const [svg, u] = useUnitPerPx(2.24);
  const done = k >= n;
  const turns = cur / 360;
  const endTip = pt(cur, 1.0);
  return (
    <div className="flex h-full flex-col">
      <div className="mb-1 text-center">
        <div className="lettering text-[12px] text-ink-3">{tr('평탄하게 접었을 때 각 광선이 놓이는 방향 φ', 'Direction φ of each ray when folded flat')}</div>
        <div className={`tnum text-[22px] font-semibold leading-tight ${r.winding === null ? 'text-bad' : 'text-ink'}`}>
          {tr('감김 수', 'Winding')} = {r.winding === null ? tr(`${(r.S / 360).toFixed(2)} (정수 아님)`, `${(r.S / 360).toFixed(2)} (not an integer)`) : r.winding > 0 ? '+1' : r.winding < 0 ? '−1' : '0'}
        </div>
      </div>
      <svg ref={svg} viewBox="-1.12 -1.12 2.24 2.24" className="mx-auto aspect-square w-full max-w-[340px]" role="img" aria-label={tr('각도 걸음 (angular walk)', 'Angular walk')}>
        <circle cx={0} cy={0} r={1} fill="none" stroke={C.rule2} strokeWidth={0.006} />
        {[0, 90, 180, 270].map((a) => { const q = pt(a, 1.05); return <text key={a} x={q[0]} y={q[1] + 4 * u} fontSize={12 * u} textAnchor="middle" fill={C.ink3}>{a}°</text>; })}
        {/* start ray */}
        <line x1={0} y1={0} x2={1} y2={0} stroke={C.ink} strokeWidth={0.012} strokeDasharray="0.04 0.025" />
        {/* finished steps */}
        {Array.from({ length: Math.min(k, n) }, (_, j) => (
          <g key={j}>
            <path d={`M${arc(phi[j], phi[j + 1], r0 + dr * j, r0 + dr * (j + 1))}`} fill="none" stroke={colorOf(j)} strokeWidth={0.022} strokeLinecap="round" />
            {(() => { const q = pt(phi[j + 1], r0 + dr * (j + 1)); return <circle cx={q[0]} cy={q[1]} r={0.02} fill={colorOf(j)} />; })()}
          </g>
        ))}
        {/* current step */}
        {!done && <path d={`M${arc(phi[k], cur, r0 + dr * k, r0 + dr * (k + p))}`} fill="none" stroke={colorOf(k)} strokeWidth={0.022} strokeLinecap="round" />}
        {/* pointer: the direction of the ray being laid down */}
        <line x1={0} y1={0} x2={endTip[0]} y2={endTip[1]} stroke={done ? (r.pass ? C.ok : C.bad) : C.ink} strokeWidth={0.02} />
        <circle cx={0} cy={0} r={0.03} fill={C.ink} />
        {done && !r.pass && (() => {
          // the gap between the last ray and the start: the walk does not close
          const end = ((r.S % 360) + 360) % 360;
          const steps = Math.max(2, Math.ceil(Math.min(end, 360 - end) / 3));
          const a1 = end > 180 ? 360 : 0;
          const d = Array.from({ length: steps + 1 }, (_, j) => pt(end + ((a1 - end) * j) / steps, 0.2).join(',')).join(' L');
          return <path d={`M${d}`} fill="none" stroke={C.bad} strokeWidth={0.03} strokeDasharray="0.03 0.02" />;
        })()}

      </svg>
      <div className="tnum text-center text-[15px] font-semibold text-ink">{tr('현재 방향', 'Current direction')} φ = {fmtSigned(cur)}{Math.abs(turns) >= 1 - 1e-9 && <span className="whitespace-nowrap"> ({turns > 0 ? '+' : ''}{turns.toFixed(2)}{tr('바퀴', ' turns')})</span>}</div>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
        {playing ? <Button size="sm" onClick={pause}><Pause size={13} />{tr('정지', 'Pause')}</Button> : <Button size="sm" kind="primary" onClick={play}><Play size={13} />{tr('재생', 'Play')}</Button>}
        <Button size="sm" onClick={step}><SkipForward size={13} />{tr('한 단계', 'Step')}</Button>
        <Button size="sm" onClick={reset}><RotateCcw size={13} />{tr('처음', 'Restart')}</Button>
        <SpeedControl />
      </div>
      {/* the cumulative sequence */}
      <div className="tnum mt-2 flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5 text-[13px]">
        {phi.map((v, j) => (
          <span key={j} className="flex items-center gap-1">
            {j > 0 && <span className="text-[13px]" style={{ color: colorOf(j - 1) }}>{j % 2 === 1 ? '+' : '−'}{deg1(r.phi[j] - r.phi[j - 1] >= 0 ? r.phi[j] - r.phi[j - 1] : r.phi[j - 1] - r.phi[j])}→</span>}
            <span className={`rounded-[2px] px-1 ${j <= k ? 'bg-paper-2 font-semibold text-ink' : 'text-ink-3'}`}>{deg1(v)}</span>
          </span>
        ))}
      </div>
      <p className={`mt-1.5 rounded-[3px] px-2 py-1 text-center text-[13px] leading-snug ${r.pass ? 'bg-paper-2 text-ink-2' : 'bg-bad-soft text-ink-2'}`}>
        {r.winding === 0 && tr('시작 방향 → 끝 방향: 같은 방향으로 돌아오지만 한 바퀴를 돌지 않는다 (S = 0°)', 'Start direction → end direction: it returns to the same direction without a full turn (S = 0°)')}
        {r.winding === 1 && tr('시작 방향 → 반시계 방향으로 정확히 한 바퀴 → 같은 방향 (S = +360°). 끝 방향은 0°일 때와 같지만, 지나온 경로가 꼭짓점을 한 번 감는다.', 'Start direction → exactly one turn counterclockwise → same direction (S = +360°). The end direction matches the 0° case, but the path winds once around the vertex.')}
        {r.winding === -1 && tr('시작 방향 → 시계 방향으로 정확히 한 바퀴 → 같은 방향 (S = −360°).', 'Start direction → exactly one turn clockwise → same direction (S = −360°).')}
        {r.winding === null && tr(`끝 방향 ${fmtSigned(r.S)}: 시작 광선으로 돌아오지 않는다 → 이 각도들로는 평탄 접힘 상태가 닫히지 않는다.`, `End direction ${fmtSigned(r.S)}: it does not return to the first ray → no closed flat-folded state exists for these angles.`)}
      </p>
    </div>
  );
}

// ───────────────────────────────────────────── left: 3D

function labelTexture(text: string, color: string) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 96;
  const g = c.getContext('2d')!;
  g.font = '600 46px Pretendard Variable, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 10; g.strokeStyle = 'rgba(255,255,255,0.92)'; g.strokeText(text, 128, 50);
  g.fillStyle = color; g.fillText(text, 128, 50);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Label({ position, text, color }: { position: V3; text: string; color: string }) {
  const tex = useMemo(() => labelTexture(text, color), [text, color]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <sprite position={position} scale={[0.42, 0.158, 1]}>
      <spriteMaterial map={tex} depthTest={false} transparent />
    </sprite>
  );
}

/** Panels O–r_i–r_{i+1} of a vertex; `lift` separates stacked layers of a flat state (display only). */
function VertexPanels({ rays, theta, lift = 0 }: { rays: V3[]; theta: number[]; lift?: number }) {
  const n = rays.length;
  const geoms = useMemo(() => rays.map((a, i) => {
    const b = rays[(i + 1) % n];
    const z = lift * i;
    const g = new THREE.BufferGeometry();
    const steps = Math.max(2, Math.ceil(theta[i] / 6));
    // a fan of thin triangles along the arc between the two rays (great-circle interpolation)
    const pts: number[] = [];
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const ang = A.angleTo(B);
    for (let k = 0; k < steps; k++) {
      const s0 = k / steps, s1 = (k + 1) / steps;
      const p0 = slerp(A, B, ang, s0), p1 = slerp(A, B, ang, s1);
      pts.push(0, 0, z, p0.x, p0.y, p0.z + z, p1.x, p1.y, p1.z + z);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.computeVertexNormals();
    return g;
  }), [rays, theta, lift, n]);
  useEffect(() => () => geoms.forEach((g) => g.dispose()), [geoms]);
  return (
    <group>
      {geoms.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color={colorOf(i)} transparent opacity={0.55} side={THREE.DoubleSide} roughness={0.8} depthWrite={false} />
        </mesh>
      ))}
      {rays.map((r, i) => {
        const zA = lift * i, zB = lift * ((i - 1 + n) % n);
        return (
          <group key={'c' + i}>
            <lineSegments>
              <bufferGeometry><bufferAttribute attach="attributes-position" args={[new Float32Array([0, 0, zA, r[0], r[1], r[2] + zA]), 3]} /></bufferGeometry>
              <lineBasicMaterial color={C.ink} />
            </lineSegments>
            {lift > 0 && zB !== zA && (
              <lineSegments>
                <bufferGeometry><bufferAttribute attach="attributes-position" args={[new Float32Array([r[0], r[1], r[2] + zB, r[0], r[1], r[2] + zA]), 3]} /></bufferGeometry>
                <lineBasicMaterial color={C.ink3} />
              </lineSegments>
            )}
            <Label position={[r[0] * 1.13, r[1] * 1.13, r[2] * 1.13 + zA]} text={`c${i + 1}`} color={C.ink2} />
          </group>
        );
      })}
      {rays.map((a, i) => {
        const b = rays[(i + 1) % n];
        const m = new THREE.Vector3(a[0] + b[0], a[1] + b[1], a[2] + b[2]);
        if (m.length() < 1e-6) m.set(-a[1], a[0], 0);
        m.normalize().multiplyScalar(0.62);
        return <Label key={'t' + i} position={[m.x, m.y, m.z + lift * i]} text={`θ${i + 1}`} color={colorOf(i)} />;
      })}
    </group>
  );
}

function slerp(A: THREE.Vector3, B: THREE.Vector3, ang: number, s: number) {
  if (ang < 1e-9) return A.clone();
  const sa = Math.sin(ang);
  return A.clone().multiplyScalar(Math.sin((1 - s) * ang) / sa).add(B.clone().multiplyScalar(Math.sin(s * ang) / sa));
}

function Scene({ children }: { children: React.ReactNode }) {
  return (
    <Canvas camera={{ position: [1.9, -2.3, 1.6], up: [0, 0, 1], fov: 38 }} style={{ background: 'transparent' }}>
      <ambientLight intensity={0.75} />
      <directionalLight position={[3, -2, 5]} intensity={0.9} />
      {children}
      <OrbitControls makeDefault enableDamping />
    </Canvas>
  );
}

type View3D = 'vertex' | 'flat';

function Vertex3DPanel({ theta, r, shape }: { theta: number[]; r: SectorReport; shape: VertexShape | null }) {
  const [view, setView] = useState<View3D>('vertex');
  const [eps, setEps] = useState(6);
  const cm = useMemo(() => closureMargin(theta), [theta]);
  // flat-locked vertex: open a nearby vertex (the sectors of the tight subset made ε smaller)
  const near = useMemo(() => {
    if (!shape?.flatLocked) return null;
    const th = theta.map((x, i) => (cm.subset.includes(i + 1) ? x - eps : x));
    return { theta: th, shape: solveVertex3D(th), report: analyzeSectors(th) };
  }, [shape, theta, eps, cm]);
  const flatRays = useMemo(() => flatFoldedRays(theta), [theta]);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div role="tablist" aria-label={tr('3D 보기', '3D view')} className="flex flex-wrap gap-1">
        {([['vertex', tr('3D 꼭짓점', '3D vertex')], ['flat', tr('평탄 접힘 각도 지도', 'Flat-fold angle map')]] as [View3D, string][]).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)}
            className={`h-7 rounded-[3px] px-2.5 text-[13px] font-medium disabled:opacity-35 ${view === id ? 'bg-paper text-ink font-semibold shadow-[inset_0_0_0_1.5px_var(--color-ink)]' : 'border border-rule-2 text-ink-2 hover:text-ink'}`}>{label}</button>
        ))}
      </div>
      <div className="relative mt-1.5 min-h-[260px] flex-1 overflow-hidden rounded-[3px] border border-rule-2 bg-paper-2/50">
        <Scene>
          {view === 'vertex' && shape && !shape.flatLocked && <VertexPanels rays={shape.rays} theta={theta} />}
          {view === 'vertex' && near && <VertexPanels rays={near.shape.rays} theta={near.theta} />}
          {view === 'flat' && <VertexPanels rays={flatRays} theta={theta} lift={0.035} />}
        </Scene>
      </div>
      <div className="mt-1.5 space-y-1 text-[13px] leading-snug text-ink-2">
        {view === 'vertex' && shape && !shape.flatLocked && (
          <p>{tr(<><b className="text-ink">정확한 강체 기하.</b> 각 패널은 θi를 그대로 유지한다 (ri·ri+1 = cos θi, 잔차 {shape.residual.toExponential(1)}).</>, <><b className="text-ink">Exact rigid geometry.</b> Each panel keeps its θi exactly (ri·ri+1 = cos θi, residual {shape.residual.toExponential(1)}).</>)} {r.intrinsic === 'flat' ? tr('T = 360°: 평평한 종이 그대로.', 'T = 360°: plain flat paper.') : r.intrinsic === 'saddle' ? tr('T > 360°: 평면에 놓일 수 없어 위아래로 물결치는 안장 모양.', 'T > 360°: it cannot lie in a plane, so it forms a saddle that waves up and down.') : tr('T < 360°: 원뿔 모양.', 'T < 360°: a cone.')} {tr('마우스로 돌려 볼 수 있다.', 'Drag to rotate.')}
            {shape.crossings > 0 && <b className="text-bad">{tr(<> 이 형상에서는 패널 {shape.crossings}쌍이 서로 통과한다.</>, <> In this shape, {shape.crossings} panel pair(s) pass through each other.</>)}</b>}</p>
        )}
        {view === 'vertex' && shape?.flatLocked && near && (
          <>
            <p className="rounded-[3px] border border-warn/50 bg-warn-soft px-2 py-1.5">{tr(<><b className="text-ink">평탄 잠금: 이 강체 패널들은 3D로 열릴 수 없다.</b> 닫힘 조건 Σ<sub>I</sub>θ − Σ<sub>나머지</sub>θ ≤ (|I|−1)·180°에서 I = {'{'}θ{cm.subset.join(', θ')}{'}'}가 정확히 등호(여유 {deg1(cm.margin)})다. 그래서 유일한 닫힌 모양은 한 평면 위의 상태, 즉 한 바퀴 감긴 평탄 접힘뿐이다. 6장짜리 꼭짓점에서 S = ±360°는 S가 가질 수 있는 최댓값이다.</>,
              <><b className="text-ink">Flat-locked: these rigid panels cannot open in 3D.</b> In the closure condition Σ<sub>I</sub>θ − Σ<sub>rest</sub>θ ≤ (|I|−1)·180°, I = {'{'}θ{cm.subset.join(', θ')}{'}'} is exactly at equality (margin {deg1(cm.margin)}). So the only closed shape lies in one plane: the flat fold wound once around. For a 6-panel vertex, S = ±360° is the largest value S can take.</>)}</p>
            <label className="block">
              <span className="flex justify-between"><span>{tr(<>가까운 꼭짓점 열어 보기: θ{cm.subset.join(', θ')}를 ε만큼 줄임</>, <>Open a nearby vertex: shrink θ{cm.subset.join(', θ')} by ε</>)}</span><b className="tnum text-ink">ε = {eps.toFixed(1)}°</b></span>
              <input type="range" className="w-full" min={0.2} max={12} step={0.1} value={eps} onChange={(e) => setEps(parseFloat(e.target.value))} aria-label="ε" />
            </label>
            <p className="tnum">{tr(<>지금 보이는 것은 <b className="text-ink">다른 꼭짓점</b> θ′ = [{near.theta.map((x) => deg1(x)).join(', ')}] (S′ = {fmtSigned(near.report.S)}, 잔차 {near.shape.residual.toExponential(1)}). ε → 0이면 안장이 납작해지며 한 바퀴 감긴 평탄 상태로 수렴한다.</>,
              <>What you see is a <b className="text-ink">different vertex</b> θ′ = [{near.theta.map((x) => deg1(x)).join(', ')}] (S′ = {fmtSigned(near.report.S)}, residual {near.shape.residual.toExponential(1)}). As ε → 0 the saddle flattens and approaches the flat state wound once around.</>)}</p>
          </>
        )}
        {view === 'flat' && (
          <p className="rounded-[3px] border border-rule-2 bg-paper px-2 py-1.5">
            <b className="text-ink">Flat-fold angular map.</b> {tr(<>광선 k를 평면의 방향 φ<sub>k−1</sub>에 놓은 정확한 평탄 접힘 배치다 (각 패널 = θi, 방향이 번갈아 뒤집힘). 층은 보기 좋게 순서대로 띄워 그렸다.</>, <>The exact flat-folded layout with ray k at direction φ<sub>k−1</sub> in the plane (each panel = θi, orientation alternating). Layers are drawn spaced apart in order for clarity.</>)}{' '}
            {r.pass ? tr('마지막 패널이 첫 광선으로 돌아와 닫힌다.', 'The last panel returns to the first ray and closes.') : <b className="text-bad">{tr(<>마지막 패널이 첫 광선으로 돌아오지 않는다 (S ∉ {'{'}0°, ±360°{'}'}): 닫힌 평탄 상태가 없다.</>, <>The last panel does not return to the first ray (S ∉ {'{'}0°, ±360°{'}'}): there is no closed flat state.</>)}</b>}
            <br /><i>Angular closure visualization. This view illustrates the generalized Kawasaki winding condition; it does not independently verify global layer ordering or collision.</i>
          </p>
        )}
        <p className="text-[13px] text-ink-3">{tr('3D 꼭짓점과 평탄 접힘 상태 사이의 접는 동작(경로)은 계산하지 않는다: 각 창은 그 자체로 정확한 배치이며, 두 상태를 잇는 움직임을 꾸며 넣지 않았다.', 'The folding motion (path) between the 3D vertex and the flat-folded state is not computed: each view is an exact layout on its own, and no motion connecting them is invented.')}</p>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────── the lab

export function GKawasakiLab() {
  const [caseId, setCaseId] = useState<GKCase['id'] | null>('C');
  const [theta, setTheta] = useState<number[]>(GK_CASES.find((c) => c.id === 'C')!.theta);
  const r = useMemo(() => analyzeSectors(theta), [theta]);
  const prevShape = useRef<VertexShape | null>(null);
  const shape = useMemo(() => {
    const s = solveVertex3D(theta, prevShape.current && prevShape.current.rays.length === theta.length && !prevShape.current.flatLocked ? prevShape.current.rays : undefined);
    prevShape.current = s;
    return s;
  }, [theta]);
  const pick = (c: GKCase) => { setCaseId(c.id); prevShape.current = null; setTheta(c.theta); };
  const edit = (t: number[]) => { setCaseId(null); setTheta(t); };
  const current = GK_CASES.find((c) => c.id === caseId);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="lettering mr-1 text-[12px] text-ink-3">{tr('예제', 'Examples')}</span>
        {GK_CASES.map((c) => (
          <button key={c.id} type="button" onClick={() => pick(c)} aria-pressed={caseId === c.id}
            className={`rounded-[3px] border px-2.5 py-1 text-left text-[13px] transition-colors ${caseId === c.id ? 'border-ink bg-paper text-ink font-semibold shadow-[inset_0_0_0_1.5px_var(--color-ink)]' : 'border-rule-2 bg-paper text-ink-2 hover:border-ink hover:text-ink'}`}>
            <b>Case {c.id}</b> <span className="opacity-80">{c.title}</span>
          </button>
        ))}
      </div>
      {current && <p className="text-[14px] text-ink-2"><b className="text-ink">Case {current.id}.</b> {current.note}</p>}
      <Status r={r} shape={shape} />
      <div className="grid gap-3 lg:grid-cols-2 min-[1800px]:grid-cols-[1.15fr_1fr_1fr]">
        <section className="rounded-[3px] border border-rule-2 bg-paper p-2.5 lg:col-span-2 min-[1800px]:col-span-1" aria-label={tr('3D 꼭짓점', '3D vertex')}>
          <h3 className="mb-1.5 text-[14px] font-semibold text-ink">{tr('① 3D 꼭짓점 기하', '① 3D vertex geometry')}</h3>
          <div className="h-[420px]"><Vertex3DPanel theta={theta} r={r} shape={shape} /></div>
        </section>
        <section className="rounded-[3px] border border-rule-2 bg-paper p-2.5" aria-label={tr('섹터각 다이어그램', 'Sector-angle diagram')}>
          <h3 className="mb-1.5 text-[14px] font-semibold text-ink">{tr('② 섹터각: Σθ와 O, E', '② Sector angles: Σθ, O and E')}</h3>
          <SectorDiagram theta={theta} r={r} />
        </section>
        <section className="rounded-[3px] border border-rule-2 bg-paper p-2.5" aria-label={tr('각도 걸음', 'Angular walk')}>
          <h3 className="mb-1.5 text-[14px] font-semibold text-ink">{tr('③ 교대 각도 걸음 (angular walk)', '③ Alternating angular walk')}</h3>
          <AngularWalk r={r} />
        </section>
      </div>
      <section className="rounded-[3px] border border-rule-2 bg-paper-2/60 p-2.5" aria-label={tr('섹터각 입력', 'Sector-angle input')}>
        <h3 className="mb-1.5 text-[14px] font-semibold text-ink">{tr('섹터각 바꾸기', 'Change sector angles')} <span className="font-normal text-ink-3">{tr('(바꾸는 즉시 모든 값과 3D 형상이 다시 계산된다)', '(all values and the 3D shape update immediately)')}</span></h3>
        <AngleControls theta={theta} setTheta={edit} />
      </section>
      <p className="rounded-[3px] border border-rule-2 bg-paper px-3.5 py-2.5 text-[14px] leading-relaxed text-ink-2">
        {tr(<><b className="text-ink">핵심.</b> Σθ는 꼭짓점 둘레의 <b className="text-ink">고유 곡률</b>(종이가 얼마나 있는지)이고, 교대합 S는 <b className="text-ink">평탄하게 접은 경로가 몇 번 감기는지</b>(부호 있는 각도 닫힘)다. 둘은 서로 다른 양이다.</>,
          <><b className="text-ink">Key point.</b> Σθ is the <b className="text-ink">intrinsic curvature</b> around the vertex (how much paper there is), while the alternating sum S is <b className="text-ink">how many times the flat-folded path winds</b> (the signed angular closure). They are different quantities.</>)}
      </p>
    </div>
  );
}
