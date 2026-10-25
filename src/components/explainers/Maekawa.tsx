import { tr } from '../../i18n';
import { arc, wedge, BAD, INK, INK3, Label, MOUNTAIN, OK, pt, seg, VALLEY, type Scene } from './Explainer';

const TH = [70, 100, 110, 80];
const MV = ['V', 'M', 'V', 'V'] as const;
const CX = 165, CY = 150;
const lineCol = (a: 'M' | 'V') => (a === 'M' ? MOUNTAIN : VALLEY);
const dash = (a: 'M' | 'V') => (a === 'M' ? '9 3 2 3' : '7 4');
const rays = TH.reduce<number[]>((a, x) => [...a, a[a.length - 1] + x], [0]).slice(0, 4);

function Pattern({ mv = MV, t = 1, r = 100, cx = CX, cy = CY, bad }: { mv?: readonly ('M' | 'V')[]; t?: number; r?: number; cx?: number; cy?: number; bad?: number }) {
  return (
    <g>
      {bad !== undefined && <path d={wedge(cx, cy, r * 0.55, rays[bad], rays[bad] + TH[bad])} fill={BAD} fillOpacity={0.16} />}
      {rays.map((a, i) => {
        const k = seg(t, i * 0.12, 0.3 + i * 0.12);
        const [x, y] = pt(cx, cy, r * k, a);
        const [lx, ly] = pt(cx, cy, r + 16, a);
        return (
          <g key={i}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke={lineCol(mv[i])} strokeWidth={3} strokeDasharray={dash(mv[i])} strokeLinecap="round" />
            <Label x={lx} y={ly + 5} size={15} weight={700} color={lineCol(mv[i])} opacity={k}>{mv[i]}</Label>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={4} fill={INK} />
    </g>
  );
}

/** heading after each crease: arcs alternate direction (the paper flips) */
const phi = TH.reduce<number[]>((a, x, i) => [...a, a[a.length - 1] + (i % 2 === 0 ? x : -x)], [0]);
const rk = (i: number) => 34 + i * 17;

/**
 * Walk along the folded circle: an arc of ±θ inside each sector, then a
 * U-turn (±180°) at each crease. Valleys turn one way, mountains the other.
 */
function FoldedCircle({ t, mv = MV }: { t: number; mv?: readonly ('M' | 'V')[] }) {
  const steps = 8; // arc, U-turn, arc, U-turn …
  const s = t * steps;
  const out = [];
  for (let i = 0; i < 4; i++) {
    const a = s - 2 * i; // arc progress
    if (a <= 0) break;
    const p = Math.min(1, a);
    out.push(<path key={'a' + i} d={arc(CX, CY, rk(i + 1), phi[i], phi[i] + (phi[i + 1] - phi[i]) * p)} fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />);
    const u = s - 2 * i - 1; // U-turn progress
    if (u > 0) {
      const q = Math.min(1, u);
      const [x0, y0] = pt(CX, CY, rk(i + 1), phi[i + 1]);
      const [x1, y1] = pt(CX, CY, rk(i + 2), phi[i + 1]);
      // a small half loop between the two layers, bulging along the direction of travel
      const dir = i % 2 === 0 ? 1 : -1;
      const bulge = pt(CX, CY, (rk(i + 1) + rk(i + 2)) / 2, phi[i + 1] + dir * 9);
      const mid: [number, number] = [x0 + (bulge[0] - x0) * q, y0 + (bulge[1] - y0) * q];
      const d = q < 1 ? `M${x0},${y0} Q${mid[0]},${mid[1]} ${mid[0]},${mid[1]}` : `M${x0},${y0} Q${bulge[0]},${bulge[1]} ${x1},${y1}`;
      out.push(<path key={'u' + i} d={d} fill="none" stroke={lineCol(mv[(i + 1) % 4])} strokeWidth={4} strokeLinecap="round" />);
    }
  }
  return (
    <g>
      <line x1={CX} y1={CY} x2={pt(CX, CY, 118, 0)[0]} y2={CY} stroke={INK3} strokeWidth={1.4} strokeDasharray="5 4" />
      {out}
      <circle cx={CX} cy={CY} r={4} fill={INK} />
    </g>
  );
}

/** the running total of turns, shown as a ledger on the right */
function Ledger({ rows, n, total, okText }: { rows: { label: string; v: string; color: string }[]; n: number; total?: string; okText?: { text: string; ok: boolean } }) {
  return (
    <g>
      <Label x={318} y={46} anchor="start" size={14} color={INK3} weight={600}>{tr('회전한 각', 'Turning')}</Label>
      {rows.slice(0, n).map((r, i) => (
        <g key={i}>
          <Label x={318} y={72 + i * 22} anchor="start" size={14} color={r.color}>{r.label}</Label>
          <Label x={466} y={72 + i * 22} anchor="end" size={14} color={r.color} weight={700}>{r.v}</Label>
        </g>
      ))}
      {total && <><line x1={318} x2={466} y1={66 + rows.length * 22} y2={66 + rows.length * 22} stroke={INK} strokeWidth={1.2} /><Label x={466} y={88 + rows.length * 22} anchor="end" size={16} weight={700}>{total}</Label></>}
      {okText && <Label x={392} y={118 + rows.length * 22} size={15} weight={700} color={okText.ok ? OK : BAD}>{okText.text}</Label>}
    </g>
  );
}

const ROWS = () => [
  { label: tr('호 +θ1', 'arc +θ1'), v: '+70°', color: INK },
  { label: tr('U턴 (M)', 'U-turn (M)'), v: '−180°', color: MOUNTAIN },
  { label: tr('호 −θ2', 'arc −θ2'), v: '−100°', color: INK },
  { label: tr('U턴 (V)', 'U-turn (V)'), v: '+180°', color: VALLEY },
  { label: tr('호 +θ3', 'arc +θ3'), v: '+110°', color: INK },
  { label: tr('U턴 (V)', 'U-turn (V)'), v: '+180°', color: VALLEY },
  { label: tr('호 −θ4', 'arc −θ4'), v: '−80°', color: INK },
  { label: tr('U턴 (V)', 'U-turn (V)'), v: '+180°', color: VALLEY },
];

export const maekawaScenes = (): Scene[] => [
  {
    duration: 4000,
    caption: () => tr('평탄하게 접히는 꼭짓점 하나. 빨간 일점쇄선은 산접기(M), 파란 점선은 골접기(V)다. 이 꼭짓점은 골이 3개, 산이 1개다.', 'A vertex that folds flat. Red dash-dot lines are mountain folds (M), blue dashed lines valley folds (V). This one has three valleys and one mountain.'),
    draw: (t) => <Pattern t={t} />,
  },
  {
    duration: 3600,
    caption: () => tr('꼭짓점 둘레에 작은 원을 그린다. 종이를 접으면 이 원도 함께 접힌다.', 'Draw a small circle around the vertex. When the paper folds, the circle folds with it.'),
    draw: (t) => {
      const c = 2 * Math.PI * 62;
      return (
        <g>
          <Pattern />
          <circle cx={CX} cy={CY} r={62} fill="none" stroke={INK} strokeWidth={3} strokeDasharray={c} strokeDashoffset={c * (1 - seg(t, 0.05, 0.8))} transform={`rotate(0 ${CX} ${CY})`} />
        </g>
      );
    },
  },
  {
    duration: 8000,
    caption: () => tr('접힌 원을 따라 걸어 보자. 섹터 안에서는 호를 따라 돌고, 크리스를 만나면 종이가 뒤집혀 U턴(180°)한다. 골에서는 한쪽으로, 산에서는 반대쪽으로 돈다.', 'Walk along the folded circle. Inside a sector you follow the arc; at a crease the paper flips and you make a U-turn (180°): one way at a valley, the other way at a mountain.'),
    draw: (t) => {
      const w = seg(t, 0.03, 0.95);
      return (
        <g>
          <FoldedCircle t={w} />
          <Ledger rows={ROWS()} n={Math.min(8, Math.floor(w * 8 + 0.999))} />
        </g>
      );
    },
  },
  {
    duration: 5500,
    caption: () => tr('호는 +θ1 −θ2 +θ3 −θ4 = 0 (Kawasaki!)으로 서로 지운다. 남는 것은 U턴뿐: 골 3번(+540°)과 산 1번(−180°) = 360°, 정확히 한 바퀴. 닫힌 고리는 꼭 한 바퀴를 돌아야 한다.', 'The arcs cancel: +θ1 −θ2 +θ3 −θ4 = 0 (Kawasaki!). Only the U-turns remain: three valleys (+540°) and one mountain (−180°) make 360°, exactly one full turn, as any closed loop must.'),
    draw: (t) => (
      <g>
        <FoldedCircle t={1} />
        <Ledger rows={ROWS()} n={8} total={t > 0.25 ? '= 360°' : undefined} okText={t > 0.55 ? { text: tr('한 바퀴 → V − M = 2', 'one turn → V − M = 2'), ok: true } : undefined} />
      </g>
    ),
  },
  {
    duration: 5200,
    caption: () => tr('산과 골이 2개씩이면? U턴이 서로 상쇄돼 회전의 합이 0°가 된다. 한 바퀴를 돌 수 없으니 닫힌 고리가 안 된다. 그래서 평탄하게 접힌 꼭짓점은 언제나 |M − V| = 2 (Maekawa 정리).', 'Two of each? The U-turns cancel and the total is 0°. Without a full turn the loop cannot close. So a flat-folded vertex always has |M − V| = 2 (Maekawa\'s theorem).'),
    draw: (t) => {
      const bad = ['V', 'M', 'V', 'M'] as const;
      return (
        <g>
          <Pattern mv={bad} r={90} cx={120} />
          <Label x={350} y={110} size={16} weight={600}>2 × (+180°) + 2 × (−180°)</Label>
          <Label x={350} y={142} size={22} weight={700} color={BAD} opacity={seg(t, 0.2, 0.45)}>= 0°  ✗</Label>
          <Label x={350} y={196} size={18} weight={700} opacity={seg(t, 0.55, 0.8)}>|M − V| = 2</Label>
        </g>
      );
    },
  },
  {
    duration: 5600,
    caption: () => tr('하지만 개수만 맞는다고 다 되는 것은 아니다. 가장 작은 섹터(θ1 = 70°)를 둘러싼 두 크리스가 같은 방향이면 큰 섹터들이 작은 섹터를 덮어 버려 접히지 않는다. 이것을 판정하는 것이 crimp(big–little–big) 검사다.', 'Counting is not enough. If the two creases around the smallest sector (θ1 = 70°) point the same way, the big neighbours cover the small one and it will not fold. The crimp (big–little–big) test decides this.'),
    draw: (t) => {
      const wrong = ['V', 'V', 'M', 'V'] as const;
      return (
        <g>
          <Pattern mv={wrong} r={90} cx={120} bad={0} />
          <Label x={350} y={110} size={14} weight={600}>V 3, M 1 → |M − V| = 2  ✓</Label>
          <Label x={350} y={146} size={14} weight={700} color={BAD} opacity={seg(t, 0.3, 0.55)}>{tr('작은 섹터 양쪽이 같은 V  ✗', 'same V on both sides of the small sector  ✗')}</Label>
          <Label x={350} y={196} size={14} color={INK3} opacity={seg(t, 0.6, 0.85)}>{tr('필요조건 ≠ 충분조건', 'necessary ≠ sufficient')}</Label>
        </g>
      );
    },
  },
];
