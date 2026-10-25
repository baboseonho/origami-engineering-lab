import { ArrowRight, Check, Pause, Play, RotateCcw, StepBack, StepForward } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { fixBySector, kawasaki } from '../../core/constraints/kawasaki';
import { maekawa } from '../../core/constraints/maekawa';
import { checkMVAssignment, type VertexState } from '../../core/constraints/mvAssignment';
import { generalizedFlatFold, generalizedMaekawa } from '../../core/constraints/generalizedFlatFold';
import { DEG } from '../../core/numerics/tolerances';
import { applyParams, loadLesson } from '../../state/actions';
import { Badge, Button, NumberField, SpeedControl } from '../controls/ui';
import { Rich } from '../controls/Rich';
import { VertexDiagram } from './VertexDiagram';
import { C } from '../../theme/tokens';
import { tr } from '../../i18n';
import {
  Card, CreasePill, EVEN, Group, ODD, ThetaText, creaseColor, creaseDash, degTxt, mix, parityColor, useBoxWidth, useTween,
} from './labKit';

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
        return out.map((v, k) => (k === 0 ? 0 : v - d));
      }
      const lo = r[i - 1] + 0.02, hi = i === n - 1 ? r[0] + 2 * Math.PI - 0.02 : r[i + 1] - 0.02;
      out[i] = Math.max(lo, Math.min(hi, a));
      return out;
    });
  };
  const load = (s: number[], m: MV[]) => { setRays(raysFromSectors(s)); setMv(m); };
  const toggle = (i: number) => setMv((m) => m.map((x, j) => (j === i ? (x === 'M' ? 'V' : 'M') : x)));
  return { rays, setRays, mv, setMv, sectors, drag, load, toggle };
}

// ───────────────────────────────────────── shared pieces

const th = (i: number | string) => `$\\theta_{${i}}$`;
const holds = (ok: boolean) => (ok ? tr('성립', 'holds') : tr('위반', 'fails'));

/** A crease name with its ∧/∨ glyph, in running text. */
function CreaseTag({ i, mv }: { i: number; mv: string }) {
  const col = creaseColor(mv);
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap font-semibold" style={{ color: col }}>
      c{i + 1}
      <svg width="12" height="9" viewBox="0 0 12 9" aria-hidden>
        <path d={mv === 'M' ? 'M1,7.5 L6,1.5 L11,7.5' : 'M1,1.5 L6,7.5 L11,1.5'} fill="none" stroke={col} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="sr-only">{mv === 'M' ? tr('산', 'mountain') : tr('골', 'valley')}</span>
    </span>
  );
}

/** One condition and its verdict word. */
function Cond({ label, ok, word }: { label: ReactNode; ok: boolean | null; word?: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-1">
      <span className="min-w-0 text-[14px] leading-snug text-ink-2">{label}</span>
      {ok === null ? <Badge status="na">{word ?? tr('해당 없음', 'n/a')}</Badge> : <Badge status={ok ? 'ok' : 'bad'}>{word ?? holds(ok)}</Badge>}
    </li>
  );
}

function SectorTable({ sectors, mv }: { sectors: number[]; mv: MV[] }) {
  return (
    <table className="w-full text-[14px]">
      <thead>
        <tr className="text-left text-[12px] text-ink-3">
          <th className="pb-1 font-medium">{tr('섹터', 'Sector')}</th>
          <th className="pb-1 text-right font-medium">{tr('각', 'Angle')}</th>
          <th className="pb-1 pl-3 font-medium">{tr('홀짝', 'Parity')}</th>
          <th className="pb-1 font-medium">{tr('시작 크리스', 'From crease')}</th>
        </tr>
      </thead>
      <tbody>
        {sectors.map((s, i) => (
          <tr key={i} className="border-t border-rule">
            <td className="py-1" style={{ color: parityColor(i) }}><Rich text={th(i + 1)} /></td>
            <td className="tnum py-1 text-right text-ink">{deg(s).toFixed(2)}°</td>
            <td className="py-1 pl-3" style={{ color: parityColor(i) }}>{i % 2 === 0 ? tr('홀수', 'odd') : tr('짝수', 'even')}</td>
            <td className="py-1"><CreaseTag i={i} mv={mv[i]} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The drawing area: a caption, a hint and the drawing. */
function Stage({ caption, hint, children }: { caption: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-[3px] border border-rule-2 bg-paper">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 pt-3">
        <span className="lettering text-[12px] text-ink-3">{caption}</span>
        {hint && <span className="text-[13px] text-ink-3">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

/** Odd and even sums against the 180° each must reach. */
function Balance({ odd, even }: { odd: number; even: number }) {
  return (
    <div className="space-y-2.5">
      {([['odd', odd, ODD], ['even', even, EVEN]] as const).map(([key, v, col]) => (
        <div key={key}>
          <div className="flex items-baseline justify-between gap-2 text-[14px]">
            <span style={{ color: col }}><Rich text={`$\\sum_{\\text{${key}}} \\theta_i$`} /></span>
            <span className="tnum font-semibold text-ink">{deg(v).toFixed(3)}°</span>
          </div>
          <div className="relative mt-1 h-2.5 rounded-[2px] bg-paper-2">
            <div className="h-full rounded-[2px] transition-[width] duration-100" style={{ width: `${Math.min(100, (deg(v) / 360) * 100)}%`, background: col }} />
            <div className="absolute -top-1 -bottom-1 left-1/2 w-px bg-ink" title="180°" />
          </div>
        </div>
      ))}
      <div className="flex justify-between text-[12px] text-ink-3"><span>0°</span><span>180°</span><span>360°</span></div>
    </div>
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
  const [moving, setMoving] = useState<{ ray: number; from: number } | null>(null);
  const tween = useTween();
  const k = kawasaki(v.sectors);
  const ok = k.satisfied;
  const balanced = Math.abs(k.residual) < 1.75e-4;
  const halt = () => { tween.stop(); setMoving(null); };
  const load = (s: number[], m: MV[]) => { halt(); v.load(s, m); };
  const setN = (n: number) => load(Array.from({ length: n }, () => 360 / n), Array.from({ length: n }, (_, i) => (i === 0 ? 'V' : 'M')) as MV[]);
  const target = sel ?? 0;

  /** Rotate the one ray that the fix moves, smoothly, so the sum is seen going to zero. */
  const fix = () => {
    const s = v.sectors, n = s.length;
    const f = fixBySector(s, target);
    if (!f) return;
    let left = -1;
    for (let i = 0; i < n; i++) if (Math.abs(f[i] - s[i]) > 1e-12 && Math.abs(f[(i + 1) % n] - s[(i + 1) % n]) > 1e-12) { left = i; break; }
    if (left < 0) return;
    const ray = (left + 1) % n, delta = f[left] - s[left];
    const from = [...v.rays];
    setMoving({ ray, from: from[ray] });
    tween.run(1300, (e) => v.setRays(from.map((a, i) => (i === ray ? a + delta * e : a))), () => setMoving(null));
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-stretch gap-2">
        <Group caption={tr('패턴', 'Pattern')}>
          <Button size="sm" onClick={() => load([91.5, 88, 90, 90.5], ['V', 'M', 'M', 'M'])}>{tr('"정리 깨기" 프리셋', '"Break the theorem" preset')}</Button>
          <Button size="sm" onClick={() => load([60, 40, 70, 80, 50, 60], ['M', 'V', 'M', 'M', 'V', 'M'])}>{tr('6차', 'Degree 6')}</Button>
          {[4, 6, 8].map((n) => <Button size="sm" key={n} onClick={() => setN(n)}>n = {n} {tr('(등분)', '(equal)')}</Button>)}
          <Button size="sm" onClick={() => setN(5)}>n = 5 {tr('(홀수)', '(odd)')}</Button>
        </Group>
        <Group caption={tr('고치기', 'Fix')}>
          <Button kind="primary" size="sm" disabled={sel === null || ok || !k.evenDegree || !!moving} onClick={fix}>
            {tr('평탄 접힘 가능하게 수정', 'Make flat-foldable')} <span className="font-normal opacity-80">· <Rich text={th(target + 1)} />{tr(' 옆 광선 하나 이동', ': move one of its rays')}</span>
          </Button>
          <Button size="sm" onClick={() => openIn3D(v.sectors, v.mv)} disabled={!ok}>{tr('3D로 접기', 'Fold in 3D')}<ArrowRight size={14} /></Button>
          <SpeedControl />
        </Group>
      </div>

      <Stage caption={tr('꼭짓점 · 위에서 본 크리스 패턴', 'Vertex · crease pattern from above')} hint={tr('광선이나 손잡이를 끌어 움직이고, 섹터를 눌러 고른다', 'Drag a ray or its handle to move it; click a sector to select it')}>
        <div className="grid items-center gap-4 px-4 pb-4 md:grid-cols-[minmax(0,1fr)_240px]">
          <VertexDiagram rays={v.rays} mv={v.mv} onDrag={(i, a) => { halt(); v.drag(i, a); }} onSectorClick={setSel} selectedSector={sel}
            highlightRays={moving ? [moving.ray] : undefined} ghostRays={moving ? [moving.from] : undefined} size={460} />
          <div className="grid content-center gap-4">
            <div>
              <div className="lettering text-[12px] text-ink-3">{tr('교대합 (잔차)', 'Alternating sum (residual)')}</div>
              <div className="mt-0.5 text-[14px] text-ink-2"><Rich text="$\theta_1 - \theta_2 + \theta_3 - \cdots$" /></div>
              <div className={`tnum text-[26px] font-semibold leading-tight ${balanced ? 'text-ok' : 'text-bad'}`}>{degTxt(deg(k.residual), 3, true)}</div>
            </div>
            <Balance odd={k.sumOdd} even={k.sumEven} />
            <div className="tnum flex justify-between border-t border-rule pt-2 text-[14px] text-ink-2">
              <span><Rich text="$\sum \theta_i$" /> = {deg(k.total).toFixed(3)}°</span>
              <span>n = {k.n}</span>
            </div>
          </div>
        </div>
      </Stage>

      <div className="grid items-start gap-3 lg:grid-cols-3">
        <Card title={tr('판정', 'Verdict')}>
          <Badge status={ok ? 'ok' : 'bad'}>{ok ? tr('평탄 접힘 가능한 섹터각', 'Flat-foldable sector angles') : tr('평탄 접힘 불가능', 'Not flat-foldable')}</Badge>
          <ul className="mt-2">
            <Cond label={tr(`크리스 수가 짝수 (n = ${k.n})`, `Even number of creases (n = ${k.n})`)} ok={k.evenDegree} />
            <Cond label={<Rich text="$\sum \theta_i = 360^\circ$" />} ok={k.flatSheet} />
            <Cond label={<Rich text="$\sum_{\text{odd}} \theta_i = \sum_{\text{even}} \theta_i$" />} ok={balanced} />
          </ul>
        </Card>
        <Card title={tr('섹터각', 'Sector angles')}><SectorTable sectors={v.sectors} mv={v.mv} /></Card>
        <Card title={tr('규칙', 'Rule')}>
          <p className="text-[14px] leading-relaxed text-ink-2"><Rich text={tr(
            '짝수 차수의 평평한 꼭짓점은 교대합이 0일 때, 그리고 그때에만 평탄하게 접힌다: $\\theta_1 - \\theta_2 + \\cdots - \\theta_n = 0$, 즉 $\\sum_{\\text{odd}} \\theta_i = \\sum_{\\text{even}} \\theta_i = 180^\\circ$.',
            'A flat vertex of even degree folds flat exactly when the alternating sum is zero: $\\theta_1 - \\theta_2 + \\cdots - \\theta_n = 0$, i.e. $\\sum_{\\text{odd}} \\theta_i = \\sum_{\\text{even}} \\theta_i = 180^\\circ$.',
          )} /></p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-3"><Rich text={tr(
            '"평탄 접힘 가능하게 수정"은 고른 섹터 옆의 광선 하나를 $\\delta = -r/2$만큼 돌린다 ($r$ = 잔차). 한 섹터는 $+\\delta$, 이웃 섹터는 $-\\delta$만큼 변하므로 합은 360°로 남고 교대합은 0이 된다.',
            '"Make flat-foldable" turns one ray next to the selected sector by $\\delta = -r/2$ ($r$ = residual). One sector grows by $\\delta$ and its neighbour shrinks by $\\delta$, so the total stays 360° and the alternating sum becomes 0.',
          )} /></p>
        </Card>
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
    <div className="grid gap-3">
      <div className="flex flex-wrap items-stretch gap-2">
        <Group caption={tr('패턴', 'Pattern')}>
          <Button size="sm" onClick={() => v.load([70, 100, 110, 80], ['V', 'M', 'V', 'V'])}>{tr('유효한 4차', 'Valid degree 4')}</Button>
          <Button size="sm" onClick={() => v.load([70, 100, 110, 80], ['V', 'V', 'M', 'V'])}>{tr('|M − V| = 2지만 접히지 않음', '|M − V| = 2 but does not fold')}</Button>
          <Button size="sm" onClick={() => v.load([90, 90, 90, 90], ['M', 'V', 'M', 'V'])}>M = 2, V = 2</Button>
          <Button size="sm" onClick={() => v.load([60, 40, 70, 80, 50, 60], ['M', 'V', 'M', 'M', 'V', 'M'])}>{tr('6차', 'Degree 6')}</Button>
        </Group>
      </div>

      <Stage caption={tr('꼭짓점 · 산접기와 골접기', 'Vertex · mountains and valleys')} hint={tr('크리스나 손잡이를 누르면 산 ↔ 골이 바뀐다', 'Click a crease or its handle to swap mountain ↔ valley')}>
        <div className="grid items-center gap-4 px-4 pb-4 md:grid-cols-[minmax(0,1fr)_240px]">
          <VertexDiagram rays={v.rays} mv={v.mv} onRayClick={v.toggle} size={460} />
          <div className="grid content-center gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-[3px] border border-rule-2 px-3 py-2">
                <div className="text-[13px] font-semibold" style={{ color: C.mountain }}>{tr('산 M', 'Mountain M')}</div>
                <div className="tnum text-[26px] font-semibold leading-tight text-ink">{m.M}</div>
              </div>
              <div className="rounded-[3px] border border-rule-2 px-3 py-2">
                <div className="text-[13px] font-semibold" style={{ color: C.valley }}>{tr('골 V', 'Valley V')}</div>
                <div className="tnum text-[26px] font-semibold leading-tight text-ink">{m.V}</div>
              </div>
            </div>
            <div>
              <div className="lettering text-[12px] text-ink-3">{tr('차이', 'Difference')}</div>
              <div className={`tnum text-[22px] font-semibold ${m.satisfied ? 'text-ok' : 'text-bad'}`}>|M − V| = {Math.abs(m.difference)}</div>
              <div className="text-[13px] text-ink-3">{tr('평탄 접힘에는 2가 되어야 한다', 'Must be 2 to fold flat')}</div>
            </div>
          </div>
        </div>
      </Stage>

      <div className="grid items-start gap-3 lg:grid-cols-3">
        <Card title={tr('판정', 'Verdict')}>
          <ul>
            <Cond label={tr('필요: |M − V| = 2', 'Necessary: |M − V| = 2')} ok={m.satisfied} />
            <Cond label={tr('필요: Kawasaki (섹터각)', 'Necessary: Kawasaki (sector angles)')} ok={k.satisfied} />
            <Cond label={tr('충분: 크림프로 끝까지 축약', 'Sufficient: crimps reduce it fully')} ok={full ? full.valid : null}
              word={full ? (full.valid ? tr('접힌다', 'folds') : tr('접히지 않는다', 'does not fold')) : tr('Kawasaki 먼저', 'needs Kawasaki')} />
          </ul>
          {full && !full.valid && <p className="mt-1.5 text-[13px] leading-snug text-bad">{full.reason}</p>}
          {m.satisfied && full && !full.valid && (
            <p className="mt-2 rounded-[3px] border border-warn/50 bg-warn-soft px-2.5 py-1.5 text-[13px] leading-snug text-ink-2">{tr('개수는 맞지만 이 배정은 평탄하게 접히지 않는다. 개수 조건만으로는 충분하지 않다.', 'The count is right, but this assignment does not fold flat. The counting condition alone is not enough.')}</p>
          )}
        </Card>
        <Card title={tr('섹터각', 'Sector angles')}><SectorTable sectors={v.sectors} mv={v.mv} /></Card>
        <Card title={tr('규칙', 'Rule')}>
          <p className="text-[14px] leading-relaxed text-ink-2">{tr('평탄하게 접히는 꼭짓점에서는 산과 골의 개수가 정확히 2 차이 난다: |M − V| = 2 (Maekawa–Justin).', 'At a vertex that folds flat, the numbers of mountains and valleys differ by exactly 2: |M − V| = 2 (Maekawa–Justin).')}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-3">{tr('이 조건과 Kawasaki는 필요조건일 뿐이다. 배정이 실제로 접히는지는 크림프 축약으로 판정한다 (다음 도면).', 'This and Kawasaki are only necessary. Whether an assignment really folds is decided by crimp reduction (next sheet).')}</p>
        </Card>
      </div>
    </div>
  );
}

// ───────────────────────────────────────── recursive crimp proof

/** indices of a state's sectors in display order, starting at crease `startId` */
function rotation(st: VertexState, startId: number) {
  const m = st.creases.length;
  const i0 = Math.max(0, st.creases.indexOf(startId));
  return Array.from({ length: m }, (_, j) => (i0 + j) % m);
}

/**
 * The cyclic sequence of sectors around the vertex, unrolled into a band at a
 * fixed scale (px per degree). A crimp folds the small middle sector under:
 * its two neighbours slide over it until they overlap by its width, and the
 * three become one sector of θ(i−1) − θi + θ(i+1).
 */
function CrimpBand({ st, ord, original, anim, mark }: {
  st: VertexState; ord: number[]; original: number[];
  anim: { pos: number; p: number } | null; mark: number | null;
}) {
  const [box, W] = useBoxWidth<HTMLDivElement>(700);
  const pad = 34;
  const k = (W - 2 * pad) / 360;
  const m = st.creases.length;
  const n0 = original.length;
  const BY = 64, BH = 34;
  const blocks: { j: number; idx: number; x: number; w: number; d: number }[] = [];
  let x = pad;
  for (let j = 0; j < m; j++) {
    const idx = ord[j];
    const d = deg(st.sectors[idx]);
    const w = anim && j === anim.pos + 1 ? d * k * (1 - 2 * anim.p) : d * k;
    blocks.push({ j, idx, x, w, d });
    x += w;
  }
  const end = x;
  const p = anim?.p ?? 0;
  const inTriple = (j: number) => !!anim && j >= anim.pos && j <= anim.pos + 2;
  const fade = (j: number) => (anim && (j === anim.pos + 1 || j === anim.pos + 2) ? 1 - p : 1);
  // creases at the left edge of every block, and the first one again at the right end (one full turn)
  const creases = blocks.map((b) => ({ x: b.x, id: st.creases[b.idx], mv: st.mv[b.idx], o: fade(b.j) }));
  creases.push({ x: end, id: st.creases[ord[0]], mv: st.mv[ord[0]], o: 0.45 });
  const level: number[] = [];
  creases.forEach((c, i) => level.push(i && c.x - creases[i - 1].x < 52 && level[i - 1] === 0 && creases[i - 1].o > 0.3 && c.o > 0.3 ? 1 : 0));
  const tint = (idx: number) => mix(C.paperFront, parityColor(st.creases[idx] % 2), 0.16);
  const isOriginal = (idx: number) => st.creases[(idx + 1) % m] === (st.creases[idx] + 1) % n0 && Math.abs(st.sectors[idx] - original[st.creases[idx]]) < 1e-9;
  return (
    <div ref={box} className="w-full">
      <svg width={W} height={140} className="block select-none" role="img" aria-label={tr('꼭짓점을 한 바퀴 돈 섹터의 띠', 'The sectors around the vertex, unrolled')}>
        <defs>
          <pattern id="crimp-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke={C.ink2} strokeWidth={1.4} />
          </pattern>
        </defs>
        {blocks.map((b) => b.w > 0.5 && (
          <rect key={'b' + b.j} x={b.x} y={BY} width={b.w} height={BH}
            fill={(anim && b.j === anim.pos + 1) || (!anim && mark === b.j) ? C.mark : tint(b.idx)} opacity={anim && b.j === anim.pos + 1 ? 0.35 + 0.65 * (1 - p) : 1} />
        ))}
        {/* the folded-under layer while the crimp closes */}
        {anim && p > 0.5 && (() => {
          const mid = blocks[anim.pos + 1];
          const x1 = mid.x, x0 = mid.x + mid.w;
          return <rect x={x0} y={BY} width={x1 - x0} height={BH} fill="url(#crimp-hatch)" opacity={0.55 * Math.sin(Math.PI * Math.min(1, (p - 0.5) / 0.5))} />;
        })()}
        <rect x={pad} y={BY} width={Math.max(0, end - pad)} height={BH} fill="none" stroke={C.ink3} strokeWidth={1} />
        {/* angle values */}
        {blocks.map((b) => {
          let o = 1;
          if (anim && inTriple(b.j)) o = Math.max(0, 1 - 2.2 * p); // the three values give way to their sum
          if (b.w < 34 || o <= 0.02) return null;
          return <text key={'v' + b.j} x={b.x + b.w / 2} y={BY + BH / 2 + 5} fontSize={14} fontWeight={600} fill={C.ink} textAnchor="middle" className="tnum" opacity={o}>{b.d.toFixed(1)}°</text>;
        })}
        {anim && (() => {
          const a = blocks[anim.pos], c = blocks[anim.pos + 2];
          const merged = a.d - blocks[anim.pos + 1].d + c.d;
          return <text x={(a.x + c.x + c.w) / 2} y={BY + BH / 2 + 5} fontSize={14} fontWeight={700} fill={C.ink} textAnchor="middle" className="tnum" stroke={C.paperFront} strokeWidth={4} paintOrder="stroke" opacity={Math.max(0, 2 * p - 1)}>{merged.toFixed(1)}°</text>;
        })()}
        {/* which original sector each block is */}
        {blocks.map((b) => {
          if (b.w < 26 || (anim && inTriple(b.j))) return null;
          const cx = b.x + b.w / 2;
          return isOriginal(b.idx)
            ? <ThetaText key={'t' + b.j} x={cx} y={BY + BH + 22} i={st.creases[b.idx] + 1} size={14} fill={parityColor(st.creases[b.idx] % 2)} />
            : <text key={'t' + b.j} x={cx} y={BY + BH + 21} fontSize={12} fill={C.ink3} textAnchor="middle">{tr('합친 섹터', 'merged')}</text>;
        })}
        {/* creases */}
        {creases.map((c, i) => (
          <g key={'c' + i} opacity={c.o}>
            <line x1={c.x} x2={c.x} y1={BY - 4} y2={BY + BH + 4} stroke={creaseColor(c.mv)} strokeWidth={2.6} strokeDasharray={creaseDash(c.mv)} />
            <line x1={c.x} x2={c.x} y1={(level[i] ? 14 : 40) + 13} y2={BY - 4} stroke={creaseColor(c.mv)} strokeWidth={1} />
            <CreasePill x={c.x} y={level[i] ? 14 : 40} name={`c${c.id + 1}`} mv={c.mv} />
          </g>
        ))}
      </svg>
    </div>
  );
}

export function MVCrimpLab() {
  const v = useVertex([60, 40, 70, 80, 50, 60], ['M', 'V', 'M', 'M', 'V', 'M']);
  const res = useMemo(() => checkMVAssignment(v.sectors, v.mv), [v.sectors, v.mv]);
  const kOk = kawasaki(v.sectors).satisfied;
  const steps = res.steps;
  const [done, setDone] = useState(0);
  const [anim, setAnim] = useState<{ k: number; p: number } | null>(null);
  const [auto, setAuto] = useState(false);
  const tween = useTween();
  const states: VertexState[] = useMemo(() => [{ creases: v.sectors.map((_, i) => i), mv: v.mv, sectors: v.sectors }, ...steps.map((s) => s.after)], [v.sectors, v.mv, steps]);

  // display rotation of every state, so the three merging sectors never wrap around the band's ends
  const plan = useMemo(() => {
    let start = 0;
    const perStep = steps.map((s) => {
      const st = s.before, mm = st.creases.length;
      const prev = (s.sectorIndex - 1 + mm) % mm;
      let ord = rotation(st, start);
      if (ord.indexOf(prev) > mm - 3) { start = st.creases[prev]; ord = rotation(st, start); }
      return { ord, pos: ord.indexOf(prev) };
    });
    return { perStep, finalStart: start };
  }, [steps]);

  useEffect(() => { tween.stop(); setDone(0); setAnim(null); setAuto(false); }, [v.sectors, v.mv]); // eslint-disable-line react-hooks/exhaustive-deps

  const startStep = (k: number) => {
    setAnim({ k, p: 0 });
    tween.run(1600, (e) => setAnim({ k, p: e }), () => { setAnim(null); setDone(k + 1); });
  };
  useEffect(() => {
    if (!auto || anim) return;
    if (done >= steps.length) { setAuto(false); return; }
    const t = setTimeout(() => startStep(done), done === 0 ? 0 : 350);
    return () => clearTimeout(t);
  }, [auto, anim, done, steps.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const reset = () => { tween.stop(); setAnim(null); setAuto(false); setDone(0); };

  const shownK = anim ? anim.k : done;
  const st = states[shownK];
  const ord = shownK < steps.length ? plan.perStep[shownK].ord : rotation(st, plan.finalStart);
  const next = !anim && done < steps.length ? plan.perStep[done].pos + 1 : null;
  const removedBefore = new Set(steps.slice(0, done).flatMap((s) => s.removed));
  const cur = anim ? steps[anim.k] : done < steps.length ? steps[done] : null;
  const rayAlpha = v.rays.map((_, i) => (removedBefore.has(i) ? 0.2 : anim && steps[anim.k].removed.includes(i) ? 1 - 0.8 * anim.p : 1));
  const finished = done >= steps.length;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-stretch gap-2">
        <Group caption={tr('패턴', 'Pattern')}>
          <Button size="sm" onClick={() => v.load([70, 100, 110, 80], ['V', 'M', 'V', 'V'])}>{tr('4차', 'Degree 4')}</Button>
          <Button size="sm" onClick={() => v.load([60, 40, 70, 80, 50, 60], ['M', 'V', 'M', 'M', 'V', 'M'])}>{tr('6차', 'Degree 6')}</Button>
          <Button size="sm" onClick={() => v.load([30, 50, 40, 60, 45, 35, 65, 35], ['V', 'M', 'V', 'V', 'M', 'V', 'V', 'V'])}>{tr('8차', 'Degree 8')}</Button>
        </Group>
        <Group caption={tr('증명', 'Proof')}>
          <Button kind="primary" size="sm" disabled={steps.length === 0 || (finished && !auto)} onClick={() => setAuto((a) => !a)}>
            {auto ? <><Pause size={14} />{tr('멈춤', 'Pause')}</> : <><Play size={14} />{tr('끝까지 크림프', 'Crimp to the end')}</>}
          </Button>
          <Button size="sm" disabled={!!anim || finished} onClick={() => startStep(done)}>{tr('한 단계', 'One step')}<StepForward size={14} /></Button>
          <Button size="sm" disabled={!!anim || done === 0} onClick={() => { setAuto(false); setDone((d) => Math.max(0, d - 1)); }}><StepBack size={14} />{tr('되돌리기', 'Back')}</Button>
          <Button size="sm" onClick={reset}><RotateCcw size={14} />{tr('처음', 'Restart')}</Button>
          <SpeedControl />
        </Group>
      </div>

      <Stage caption={tr('꼭짓점과 펼친 띠', 'The vertex and its unrolled band')} hint={tr('크리스나 손잡이를 누르면 산 ↔ 골이 바뀐다', 'Click a crease or its handle to swap mountain ↔ valley')}>
        <div className="grid items-center gap-2 px-4 pb-1 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <VertexDiagram rays={v.rays} mv={v.mv} onRayClick={v.toggle} size={360} highlightRays={cur && kOk ? cur.removed : undefined} rayAlpha={rayAlpha} />
          <div className="text-[14px] leading-relaxed text-ink-2">
            {!kOk ? (
              <p className="text-bad">{tr('Kawasaki 조건이 성립하지 않아 크림프 증명을 시작할 수 없다.', 'Kawasaki fails, so the crimp proof cannot start.')}</p>
            ) : cur ? (
              <>
                <div className="lettering text-[12px] text-ink-3">{anim ? tr(`단계 ${anim.k + 1} · 접는 중`, `Step ${anim.k + 1} · folding`) : tr(`다음 단계 ${done + 1} / ${steps.length}`, `Next: step ${done + 1} of ${steps.length}`)}</div>
                <p className="mt-1">
                  <CreaseTag i={cur.removed[0]} mv={cur.before.mv[cur.sectorIndex]} />{tr('와 ', ' and ')}<CreaseTag i={cur.removed[1]} mv={cur.before.mv[(cur.sectorIndex + 1) % cur.before.mv.length]} />{tr('를 크림프한다. 그 사이 섹터 ', ' are crimped. The sector between them, ')}
                  <b className="tnum text-ink">{deg(cur.before.sectors[cur.sectorIndex]).toFixed(1)}°</b>{tr(cur.strict ? '는 양옆보다 작다 (엄격한 국소 최소).' : '는 양옆보다 크지 않다 (국소 최소).', cur.strict ? ', is smaller than both neighbours (strict local minimum).' : ', is no larger than its neighbours (local minimum).')}
                </p>
                <p className="tnum mt-1.5 text-[15px] text-ink">{(() => {
                  const b = cur.before, mm = b.sectors.length, i = cur.sectorIndex;
                  const a = deg(b.sectors[(i - 1 + mm) % mm]), mid = deg(b.sectors[i]), c = deg(b.sectors[(i + 1) % mm]);
                  return `${a.toFixed(1)}° − ${mid.toFixed(1)}° + ${c.toFixed(1)}° = ${(a - mid + c).toFixed(1)}°`;
                })()}</p>
              </>
            ) : (
              <>
                <div className="lettering text-[12px] text-ink-3">{tr('끝', 'Done')}</div>
                <p className="mt-1">{res.valid
                  ? tr('공선인 두 크리스만 남았고 배정이 같다: 한 번의 직선 접기다.', 'Two collinear creases remain with the same assignment: a single straight fold.')
                  : res.reason}</p>
              </>
            )}
          </div>
        </div>
        <div className="border-t border-dashed border-rule-2 px-4 pt-2">
          <span className="lettering text-[12px] text-ink-3">{tr('꼭짓점 둘레를 펼친 띠 · 1°당 같은 길이', 'Around the vertex, unrolled · same length per degree')}</span>
        </div>
        <div className="px-4">
          <CrimpBand st={st} ord={ord} original={v.sectors} anim={anim ? { pos: plan.perStep[anim.k].pos, p: anim.p } : null} mark={kOk ? next : null} />
        </div>
        <p className="px-4 pb-3 text-[13px] leading-relaxed text-ink-3"><Rich text={tr(
          '노란 섹터가 접혀 들어가면 양옆 섹터가 그 위로 겹쳐, 세 섹터가 $\\theta_{i-1} - \\theta_i + \\theta_{i+1}$ 하나가 된다. 띠의 오른쪽 끝은 왼쪽 끝과 같은 크리스다.',
          'As the yellow sector folds under, its neighbours slide over it and the three become one sector of $\\theta_{i-1} - \\theta_i + \\theta_{i+1}$. The right end of the band is the same crease as the left end.',
        )} /></p>
      </Stage>

      <div className="grid items-start gap-3 lg:grid-cols-3">
        <Card title={tr('판정', 'Verdict')}>
          {res.valid ? <Badge status="ok">{tr('평탄하게 접힌다', 'Folds flat')}</Badge> : <Badge status="bad">{tr('평탄하게 접히지 않는다', 'Does not fold flat')}</Badge>}
          <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{res.valid
            ? tr('크림프만으로 공선인 두 크리스까지 줄어들고, 남은 둘의 배정이 같다.', 'Crimps alone reduce it to two collinear creases, and those two have the same assignment.')
            : res.reason}</p>
        </Card>
        <Card title={tr('증명 단계', 'Proof steps')}>
          {steps.length ? (
            <ol className="space-y-1 text-[14px]">
              {steps.map((s, i) => {
                const state = i < done ? 'done' : anim?.k === i ? 'now' : 'todo';
                return (
                  <li key={i} className={`flex items-center gap-2 rounded-[3px] px-1.5 py-0.5 ${state === 'now' ? 'bg-mark/60' : ''} ${state === 'todo' ? 'text-ink-3' : 'text-ink'}`}>
                    <span className="tnum w-4 text-[13px] text-ink-3">{i + 1}</span>
                    <span className="font-medium">{tr('크림프', 'Crimp')}</span>
                    <span className="tnum">c{s.removed[0] + 1}, c{s.removed[1] + 1}</span>
                    <span className="tnum text-[13px] text-ink-3">{deg(s.before.sectors[s.sectorIndex]).toFixed(1)}°</span>
                    {state === 'done' && <Check size={14} className="ml-auto text-ok" />}
                  </li>
                );
              })}
            </ol>
          ) : <p className="text-[14px] text-ink-3">{tr('크림프할 단계가 없다.', 'There is nothing to crimp.')}</p>}
        </Card>
        <Card title={tr('규칙', 'Rules')}>
          <ol className="ml-4 list-decimal space-y-1.5 text-[14px] leading-relaxed text-ink-2">
            <li><Rich text={tr('Kawasaki: $\\sum_{\\text{odd}} \\theta_i = \\sum_{\\text{even}} \\theta_i = 180^\\circ$.', 'Kawasaki: $\\sum_{\\text{odd}} \\theta_i = \\sum_{\\text{even}} \\theta_i = 180^\\circ$.')} /></li>
            <li><Rich text={tr('국소 최소 섹터 $\\theta_{i-1} \\ge \\theta_i \\le \\theta_{i+1}$를 찾는다. 엄격한 최소이면 양쪽 크리스의 배정이 달라야 한다 (big–little–big).', 'Find a local-minimum sector $\\theta_{i-1} \\ge \\theta_i \\le \\theta_{i+1}$. If it is strict, its two creases must differ (big–little–big).')} /></li>
            <li><Rich text={tr('크림프: 두 크리스를 지우고 세 섹터를 $\\theta_{i-1} - \\theta_i + \\theta_{i+1}$로 합친다. Kawasaki와 Maekawa는 그대로 유지된다.', 'Crimp: remove the two creases and merge the three sectors into $\\theta_{i-1} - \\theta_i + \\theta_{i+1}$. Kawasaki and Maekawa still hold.')} /></li>
            <li>{tr('공선인 두 크리스가 남을 때까지 반복한다. 그 둘의 배정은 같아야 한다.', 'Repeat until two collinear creases remain. Those two must have the same assignment.')}</li>
          </ol>
        </Card>
      </div>
    </div>
  );
}

// ───────────────────────────────────────── generalized (non-flat) vertex

/** The folded image of each ray, φk, drawn as a walk around the vertex on a widening spiral. */
function WindingDiagram({ partials, mv, satisfied, walk }: { partials: number[]; mv: MV[]; satisfied: boolean; walk: { k: number; p: number } }) {
  const [box, w] = useBoxWidth<HTMLDivElement>(440);
  const S = Math.max(280, Math.min(460, w));
  const c = S / 2, R = c - 30;
  const n = partials.length - 1;
  const rad = (k: number) => R * (0.26 + (0.68 * k) / Math.max(1, n));
  const P = (a: number, r: number) => [c + r * Math.cos(a), c - r * Math.sin(a)] as const;
  const arc = (a0: number, a1: number, r0: number, r1: number) => {
    const steps = Math.max(2, Math.ceil(Math.abs(a1 - a0) / (3 * DEG)));
    return Array.from({ length: steps + 1 }, (_, j) => { const t = j / steps; const [x, y] = P(a0 + (a1 - a0) * t, r0 + (r1 - r0) * t); return `${j ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`; }).join(' ');
  };
  const { k, p } = walk;
  const done = k >= n;
  const tipA = done ? partials[n] : partials[k] + (partials[k + 1] - partials[k]) * p;
  const tipR = done ? rad(n) : rad(k + p);
  const [tx, ty] = P(tipA, tipR);
  const endCol = satisfied ? C.ok : C.bad;
  return (
    <div ref={box} className="w-full">
      <svg width={S} height={S} className="mx-auto block" role="img" aria-label={tr('감김 다이어그램', 'Winding diagram')}>
        <circle cx={c} cy={c} r={R} fill={C.paperFront} stroke={C.ink3} strokeWidth={1} />
        {[0, 90, 180, 270].map((a) => {
          const [x, y] = P(a * DEG, R + 15);
          return <text key={a} x={x} y={y + 4} fontSize={12} fill={C.ink3} textAnchor="middle" className="tnum">{a}°</text>;
        })}
        {/* the start ray: the walk has to end on it */}
        <line x1={c} y1={c} x2={c + R} y2={c} stroke={C.ink} strokeWidth={1.4} strokeDasharray="6 4" />
        {/* finished sectors */}
        {Array.from({ length: Math.min(k, n) }, (_, j) => (
          <path key={'a' + j} d={arc(partials[j], partials[j + 1], rad(j), rad(j + 1))} fill="none" stroke={parityColor(j)} strokeWidth={3.5} strokeLinecap="round" />
        ))}
        {!done && <path d={arc(partials[k], tipA, rad(k), tipR)} fill="none" stroke={parityColor(k)} strokeWidth={3.5} strokeLinecap="round" />}
        {/* folded images of the creases reached so far */}
        {partials.slice(0, Math.min(k, n - 1) + 1).map((a, j) => {
          const [x, y] = P(a, rad(j));
          return <line key={'r' + j} x1={c} y1={c} x2={x} y2={y} stroke={creaseColor(mv[j])} strokeWidth={1.6} strokeDasharray={creaseDash(mv[j])} opacity={0.75} />;
        })}
        {partials.slice(0, Math.min(k, n - 1) + 1).map((a, j) => {
          const [x, y] = P(a, rad(j));
          // beside the point, a little counter-clockwise, so it never sits on a ray
          const [lx, ly] = [x - 15 * Math.sin(a) + 7 * Math.cos(a), y - 15 * Math.cos(a) - 7 * Math.sin(a)];
          return (
            <g key={'p' + j}>
              <circle cx={x} cy={y} r={4.5} fill={C.paper} stroke={creaseColor(mv[j])} strokeWidth={2} />
              <text x={lx} y={ly + 4} fontSize={13} fontWeight={700} fill={creaseColor(mv[j])} textAnchor="middle" stroke={C.paperFront} strokeWidth={3.5} paintOrder="stroke">c{j + 1}</text>
            </g>
          );
        })}
        {/* where the walk is now */}
        <line x1={c} y1={c} x2={tx} y2={ty} stroke={done ? endCol : C.ink} strokeWidth={2} />
        <circle cx={tx} cy={ty} r={6} fill={done ? endCol : C.ink} />
        {done && !satisfied && (() => {
          const goal = Math.round(partials[n] / (2 * Math.PI)) * 2 * Math.PI;
          return <path d={arc(partials[n], goal, rad(n), rad(n))} fill="none" stroke={C.bad} strokeWidth={2.5} strokeDasharray="4 3" />;
        })()}
        <circle cx={c} cy={c} r={3.5} fill={C.ink} />
      </svg>
    </div>
  );
}

export function GeneralizedLab() {
  const [sectors, setSectors] = useState<number[]>([90, 45, 45, 90]);
  const [mv, setMv] = useState<MV[]>(['M', 'M', 'M', 'V']);
  const th0 = sectors.map((s) => s * DEG);
  const g = generalizedFlatFold(th0);
  const gm = generalizedMaekawa(g.windingClass, mv);
  const n = sectors.length;
  const [walk, setWalk] = useState({ k: n, p: 0 });
  const [walking, setWalking] = useState(false);
  const tween = useTween();
  const load = (s: number[], m: MV[]) => { setSectors(s); setMv(m); };
  // a changed vertex shows its whole walk at once; "draw" replays it sector by sector
  useEffect(() => { tween.stop(); setWalking(false); setWalk({ k: sectors.length, p: 0 }); }, [sectors.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const draw = () => {
    setWalking(true);
    tween.run(900 * n, (_e, t) => {
      const u = t * n, k = Math.min(n, Math.floor(u));
      setWalk({ k, p: k >= n ? 0 : 0.5 - 0.5 * Math.cos(Math.PI * (u - k)) });
    }, () => { setWalking(false); setWalk({ k: n, p: 0 }); });
  };
  const flat = Math.abs(g.total - 2 * Math.PI) < 1e-6;
  const shape = flat ? tr('평평한 종이', 'flat paper') : g.total < 2 * Math.PI ? tr('원뿔 (각 부족)', 'cone (angle deficit)') : tr('안장 (각 초과)', 'saddle (angle surplus)');
  const curA = walk.k >= n ? g.partials[n] : g.partials[walk.k] + (g.partials[walk.k + 1] - g.partials[walk.k]) * walk.p;
  const expected = g.windingClass === null ? null : g.windingClass === 0 ? '|M − V| = 2' : 'M = V';

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-stretch gap-2">
        <Group caption={tr('패턴', 'Pattern')}>
          <Button size="sm" onClick={() => load([120, 90, 60, 90], ['M', 'M', 'M', 'V'])}>Σθ = 360° · A = 0</Button>
          <Button size="sm" onClick={() => load([90, 45, 45, 90], ['M', 'M', 'M', 'V'])}>{tr('Σθ = 270° · 쇼핑백 모서리', 'Σθ = 270° · shopping-bag corner')}</Button>
          <Button size="sm" onClick={() => load([200, 20, 200, 20], ['M', 'V', 'M', 'V'])}>Σθ = 440° · A = +360°</Button>
          <Button size="sm" onClick={() => load([20, 200, 20, 200], ['M', 'V', 'M', 'V'])}>A = −360°</Button>
          <Button size="sm" onClick={() => load([80, 70, 60, 90], ['M', 'M', 'M', 'V'])}>{tr('일반 원뿔 (위반)', 'Generic cone (fails)')}</Button>
        </Group>
        <Group caption={tr('경로', 'Walk')}>
          <Button kind="primary" size="sm" disabled={walking} onClick={draw}><Play size={14} />{tr('한 섹터씩 그리기', 'Draw sector by sector')}</Button>
          <SpeedControl />
        </Group>
      </div>

      <Stage caption={tr('평탄하게 접었을 때 각 크리스가 놓이는 방향', 'Where each crease lies when folded flat')} hint={tr('섹터를 차례로 놓되, 방향을 번갈아 뒤집는다', 'Lay the sectors down in turn, flipping direction each time')}>
        <div className="grid items-center gap-4 px-4 pb-3 md:grid-cols-[minmax(0,1fr)_250px]">
          <WindingDiagram partials={g.partials} mv={mv} satisfied={g.satisfied} walk={walk} />
          <div className="grid content-center gap-4">
            <div>
              <div className="lettering text-[12px] text-ink-3">{tr('교대합', 'Alternating sum')}</div>
              <div className="mt-0.5 text-[14px] text-ink-2"><Rich text="$A = \theta_1 - \theta_2 + \theta_3 - \cdots$" /></div>
              <div className={`tnum text-[26px] font-semibold leading-tight ${walk.k < n ? 'text-ink' : g.satisfied ? 'text-ok' : 'text-bad'}`}>{degTxt(deg(curA), 2, true)}</div>
              <div className="text-[13px] text-ink-3">{walk.k < n ? tr(`${walk.k + 1}번째 섹터를 놓는 중`, `laying sector ${walk.k + 1}`) : tr('끝 방향 = 시작 광선이어야 한다: 0° 또는 ±360°', 'The end must be the start ray: 0° or ±360°')}</div>
            </div>
            <div className="border-t border-rule pt-2">
              <div className="lettering text-[12px] text-ink-3">{tr('종이 양', 'Amount of paper')}</div>
              <div className="tnum text-[20px] font-semibold text-ink"><Rich text="$\sum \theta_i$" /> = {deg(g.total).toFixed(2)}°</div>
              <div className="text-[13px] text-ink-2">{shape}</div>
            </div>
          </div>
        </div>
        <p className="px-4 pb-3 text-[13px] leading-relaxed text-ink-3"><Rich text={tr(
          '점 $c_k$는 크리스 $k$가 놓이는 방향 $\\varphi_{k-1} = \\theta_1 - \\theta_2 + \\cdots \\pm \\theta_{k-1}$이다. 나선의 반지름은 층을 구분하려는 것일 뿐이다.',
          'Point $c_k$ is the direction $\\varphi_{k-1} = \\theta_1 - \\theta_2 + \\cdots \\pm \\theta_{k-1}$ where crease $k$ lies. The spiral radius only keeps the layers apart.',
        )} /></p>
      </Stage>

      <div className="grid items-start gap-3 lg:grid-cols-3">
        <Card title={tr('판정', 'Verdict')}>
          <Badge status={g.satisfied ? 'ok' : 'bad'}>{g.satisfied ? tr('일반화 조건 성립', 'Generalized condition holds') : tr('일반화 조건 위반', 'Generalized condition fails')}</Badge>
          <ul className="mt-2">
            <Cond label={tr(`크리스 수가 짝수 (n = ${n})`, `Even number of creases (n = ${n})`)} ok={n % 2 === 0} />
            <Cond label={<Rich text="$A \in \{0^\circ, \pm 360^\circ\}$" />} ok={g.windingClass !== null}
              word={g.windingClass === null ? tr('위반', 'fails') : g.windingClass === 0 ? tr('성립 · A = 0°', 'holds · A = 0°') : g.windingClass > 0 ? tr('성립 · +360°', 'holds · +360°') : tr('성립 · −360°', 'holds · −360°')} />
          </ul>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">{tr('A = ±360°이면 접힌 경로가 꼭짓점을 한 바퀴 감고 닫힌다. Σθ > 360°일 때만 가능하다.', 'A = ±360° means the folded path closes after winding once around the vertex. It needs Σθ > 360°.')}</p>
        </Card>
        <Card title={tr('일반화 Maekawa', 'Generalized Maekawa')}>
          <div className="flex flex-wrap gap-1.5">
            {mv.map((x, i) => (
              <button key={i} type="button" aria-label={tr(`c${i + 1}: ${x === 'M' ? '산' : '골'}, 눌러서 바꾸기`, `c${i + 1}: ${x === 'M' ? 'mountain' : 'valley'}, click to swap`)}
                className="rounded-full border-[1.5px] bg-paper px-2.5 py-0.5 text-[13px] hover:bg-paper-2" style={{ borderColor: creaseColor(x) }}
                onClick={() => setMv((m) => m.map((y, j) => (j === i ? (y === 'M' ? 'V' : 'M') : y)))}>
                <CreaseTag i={i} mv={x} />
              </button>
            ))}
          </div>
          <ul className="mt-2">
            <Cond label={<><span className="tnum block font-semibold text-ink">M = {gm.M}, V = {gm.V}</span><span className="block text-[13px] text-ink-3">{expected ? tr(`필요: ${expected}`, `needs ${expected}`) : tr('A가 0°나 ±360°가 아니다', 'A is not 0° or ±360°')}</span></>} ok={expected ? gm.satisfied : null} />
          </ul>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">{tr('A = 0이면 |M − V| = 2, A = ±360°이면 M = V. 한 바퀴 감기면 산과 골의 회전이 쌍으로 상쇄된다.', 'A = 0 needs |M − V| = 2; A = ±360° needs M = V. Winding once around, the mountain and valley turns cancel in pairs.')}</p>
        </Card>
        <Card title={tr('섹터각', 'Sector angles')}>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {sectors.map((s, i) => (
              <label key={i} className="flex items-center gap-2 text-[14px]">
                <span className="w-7" style={{ color: parityColor(i) }}><Rich text={th(i + 1)} /></span>
                <NumberField value={s} width="w-20" suffix="°" label={`θ${i + 1}`} onCommit={(x) => setSectors((ss) => ss.map((y, j) => (j === i ? x : y)))} />
              </label>
            ))}
          </div>
          <div className="mt-2 flex gap-1.5">
            <Button size="sm" onClick={() => { setSectors((s) => [...s, 30, 30]); setMv((m) => [...m, 'M', 'V']); }}>{tr('+2 크리스', '+2 creases')}</Button>
            <Button size="sm" disabled={sectors.length <= 2} onClick={() => { setSectors((s) => s.slice(0, -2)); setMv((m) => m.slice(0, -2)); }}>{tr('−2 크리스', '−2 creases')}</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
