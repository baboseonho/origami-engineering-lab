import { tr } from '../../i18n';
import { arc, wedge, BAD, INK, INK3, Label, lerp, MOUNTAIN, OK, pt, seg, VALLEY, type Scene } from './Explainer';
import { FoldedVertex, foldPlan, LAYER_OFF, levels } from './FoldedVertex';

type A = 'M' | 'V';
const TH = [70, 100, 110, 80];
const MV: readonly A[] = ['V', 'M', 'V', 'V'];
const CX = 165, CY = 150, RP = 100;
const lineCol = (a: A) => (a === 'M' ? MOUNTAIN : VALLEY);
const dash = (a: A) => (a === 'M' ? '9 3 2 3' : '7 4');
const rays = TH.reduce<number[]>((a, x) => [...a, a[a.length - 1] + x], [0]).slice(0, 4);
/** where each layer of the folded circle sits in the folded stack */
const LEVELS = levels(foldPlan(TH, MV), 3);

/**
 * The vertex on its paper disc, flat (P = 0) or folded P creases deep, seen
 * from above. Creases keep their mountain/valley colour as they move.
 */
function Paper({ mv = MV, P = 0, t = 1, r = RP, cx = CX, cy = CY, bad, fill = 1, circle, letters = 1, closure = 0 }: {
  mv?: readonly A[]; P?: number; t?: number; r?: number; cx?: number; cy?: number; bad?: number; fill?: number; circle?: number; letters?: number; closure?: number;
}) {
  return (
    <g>
      <FoldedVertex th={TH} mv={mv} cx={cx} cy={cy} r={r} progress={P} fill={fill * seg(t, 0, 0.2)}
        edgeK={(j) => seg(t, 0.1 + j * 0.12, 0.35 + j * 0.12)}
        edgeStyle={(j) => ({ stroke: lineCol(mv[j]), width: 3, dash: dash(mv[j]) })}
        circle={circle !== undefined ? { r, opacity: circle } : undefined} closure={closure}
        rayLabel={(j, x, y) => <Label x={x} y={y + 5} size={15} weight={700} color={lineCol(mv[j])} opacity={letters * seg(t, 0.25 + j * 0.12, 0.45 + j * 0.12)}>{mv[j]}</Label>} />
      {bad !== undefined && <path d={wedge(cx, cy, r * 0.55, rays[bad], rays[bad] + TH[bad])} fill={BAD} fillOpacity={0.2} />}
    </g>
  );
}

/** heading after each crease: arcs alternate direction (the paper flips) */
const phi = TH.reduce<number[]>((a, x, i) => [...a, a[a.length - 1] + (i % 2 === 0 ? x : -x)], [0]);
const rk = (i: number) => 34 + i * 17;

/** the layers of the folded circle, pulled apart from the stack (k = 0) to the walk's radii (k = 1) */
function Layers({ k, opacity }: { k: number; opacity: number }) {
  return (
    <g opacity={opacity}>
      {TH.map((_, i) => (
        <path key={i} d={arc(CX, CY, lerp(RP - LAYER_OFF * LEVELS[i], rk(i + 1), k), phi[i], phi[i + 1])} fill="none" stroke={INK} strokeWidth={lerp(3, 2, k)} strokeOpacity={lerp(1, 0.3, k)} strokeLinecap="round" />
      ))}
    </g>
  );
}

/**
 * Walk along the folded circle: an arc of ±θ inside each sector, then a
 * U-turn (±180°) at each crease. Valleys turn one way, mountains the other.
 */
function FoldedCircle({ t, mv = MV }: { t: number; mv?: readonly A[] }) {
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
  return <g>{out}<circle cx={CX} cy={CY} r={4} fill={INK} /></g>;
}

const StartLine = ({ opacity = 1 }: { opacity?: number }) => (
  <g opacity={opacity}>
    <line x1={CX} y1={CY} x2={pt(CX, CY, 122, 0)[0]} y2={CY} stroke={INK3} strokeWidth={1.4} strokeDasharray="5 4" />
    <Label x={CX + 127} y={CY + 5} anchor="start" size={13} color={INK3}>{tr('시작', 'start')}</Label>
  </g>
);

/** the running total of turns, shown as a ledger on the right */
function Ledger({ n, total = 0, verdict = 0 }: { n: number; total?: number; verdict?: number }) {
  const rows = ROWS();
  return (
    <g>
      <Label x={336} y={46} anchor="start" size={14} color={INK3} weight={600}>{tr('회전한 각', 'Turning')}</Label>
      {rows.slice(0, n).map((r, i) => (
        <g key={i}>
          <Label x={336} y={72 + i * 22} anchor="start" size={14} color={r.color}>{r.label}</Label>
          <Label x={466} y={72 + i * 22} anchor="end" size={14} color={r.color} weight={700}>{r.v}</Label>
        </g>
      ))}
      <g opacity={total}>
        <line x1={336} x2={466} y1={66 + rows.length * 22} y2={66 + rows.length * 22} stroke={INK} strokeWidth={1.2} />
        <Label x={466} y={88 + rows.length * 22} anchor="end" size={16} weight={700}>= 360°</Label>
      </g>
      <Label x={401} y={118 + rows.length * 22} size={15} weight={700} color={OK} opacity={verdict}>{tr('한 바퀴 → V − M = 2', 'one turn → V − M = 2')}</Label>
    </g>
  );
}

const ROWS = () => [
  { label: tr('호 +θ_1', 'arc +θ_1'), v: '+70°', color: INK },
  { label: tr('U턴 (M)', 'U-turn (M)'), v: '−180°', color: MOUNTAIN },
  { label: tr('호 −θ_2', 'arc −θ_2'), v: '−100°', color: INK },
  { label: tr('U턴 (V)', 'U-turn (V)'), v: '+180°', color: VALLEY },
  { label: tr('호 +θ_3', 'arc +θ_3'), v: '+110°', color: INK },
  { label: tr('U턴 (V)', 'U-turn (V)'), v: '+180°', color: VALLEY },
  { label: tr('호 −θ_4', 'arc −θ_4'), v: '−80°', color: INK },
  { label: tr('U턴 (V)', 'U-turn (V)'), v: '+180°', color: VALLEY },
];

const BAD_MV: readonly A[] = ['V', 'M', 'V', 'M'];
const WRONG_MV: readonly A[] = ['V', 'V', 'M', 'V'];
const flatNote = () => tr('펼친 종이', 'flat sheet');
const circleNote = () => tr('위에서 본 접힌 원', 'the folded circle from above');

/** the right-hand text of the "two of each" scene */
const TwoEach = ({ k, opacity = 1 }: { k: number; opacity?: number }) => (
  <g opacity={opacity}>
    <Label x={350} y={110} size={16} weight={600}>2 × (+180°) + 2 × (−180°)</Label>
    <Label x={350} y={142} size={22} weight={700} color={BAD} opacity={seg(k, 0.2, 0.45)}>= 0°  ✗</Label>
    <Label x={350} y={196} size={18} weight={700} opacity={seg(k, 0.55, 0.8)}>|M − V| = 2</Label>
  </g>
);

export const maekawaScenes = (): Scene[] => [
  {
    duration: 4000, view: 'top', viewNote: flatNote,
    caption: () => tr('평탄하게 접히는 꼭짓점 하나를 펼친 채 위에서 본다. 빨간 일점쇄선은 산접기(M), 파란 점선은 골접기(V)다. 이 꼭짓점은 골이 3개, 산이 1개다.',
      'A vertex that folds flat, seen from above as a flat sheet. Red dash-dot lines are mountain folds (M), blue dashed lines valley folds (V). This one has three valleys and one mountain.'),
    draw: (t) => <Paper t={t} />,
  },
  {
    duration: 3400, view: 'top', viewNote: flatNote,
    caption: () => tr('꼭짓점을 둘러싼 원을 하나 잡는다: 둥근 종이의 가장자리(검은 선)다. 종이를 접으면 이 원도 함께 접힌다.', 'Take a circle around the vertex: the edge of the round sheet (black). When the paper folds, the circle folds with it.'),
    draw: (t) => {
      const c = 2 * Math.PI * RP;
      return (
        <g>
          <Paper />
          <circle cx={CX} cy={CY} r={RP} fill="none" stroke={INK} strokeWidth={3} strokeDasharray={c} strokeDashoffset={c * (1 - seg(t, 0.05, 0.8))} />
        </g>
      );
    },
  },
  {
    duration: 6600, view: 'top', viewNote: () => tr('접는 중', 'folding'),
    caption: () => tr('이 꼭짓점을 평탄하게 접으며 위에서 본다. Kawasaki 애니메이션과 같은 방법이다: 크리스 1(오른쪽)을 잠시 잘라 두고 나머지를 하나씩 접는다(순서는 설명용). 원은 접힌 종이 더미의 가장자리가 되어 겹겹이 놓인다(층마다 조금씩 어긋나게 그렸다). 파란 면이 종이의 뒷면이다.',
      'Fold the vertex flat while looking down on it, the same way as in the Kawasaki animation: imagine crease 1 (right) cut for a moment and fold the others one at a time (the order is only for the explanation). The circle becomes the rim of the folded stack, layer on layer (each layer drawn slightly inset). The blue side is the back of the paper.'),
    draw: (t) => (
      <g>
        <Paper P={3 * seg(t, 0.15, 0.85)} circle={1} closure={seg(t, 0.86, 0.95)} />
        <Label x={CX + RP + 4} y={CY + 30} anchor="start" size={13} color={INK3} weight={600} opacity={seg(t, 0.03, 0.14) * (1 - seg(t, 0.84, 0.92))}>{tr('여기를 잘라 둠', 'cut here')}</Label>
      </g>
    ),
  },
  {
    duration: 8000, view: 'diagram', viewNote: circleNote,
    caption: () => tr('이제 개념도로 바꿔, 겹친 원을 층마다 떼어 놓고 따라 걸어 보자. 섹터 안에서는 호를 따라 돌고, 크리스를 만나면 종이가 뒤집혀 U턴(180°)한다. 골에서는 한쪽으로, 산에서는 반대쪽으로 돈다.',
      'Now as a diagram: pull the layers of the circle apart and walk along it. Inside a sector you follow the arc; at a crease the paper flips and you make a U-turn (180°): one way at a valley, the other way at a mountain.'),
    draw: (t) => {
      const k = seg(t, 0, 0.18);
      const w = seg(t, 0.2, 0.95);
      return (
        <g>
          <Paper P={3} fill={1 - 0.75 * k} circle={1 - seg(t, 0, 0.03)} letters={1 - k} closure={1 - k} />
          <Layers k={k} opacity={seg(t, 0, 0.03)} />
          <StartLine opacity={k} />
          <FoldedCircle t={w} />
          <Ledger n={Math.min(8, Math.floor(w * 8 + 0.999))} />
        </g>
      );
    },
  },
  {
    duration: 5200, view: 'diagram', viewNote: circleNote,
    caption: () => tr('호는 +θ_1 − θ_2 + θ_3 − θ_4 = 0 (Kawasaki!)으로 서로 지운다. 남는 것은 U턴뿐: 골 3번(+540°)과 산 1번(−180°)을 합치면 360°, 정확히 한 바퀴다. 닫힌 고리는 꼭 한 바퀴를 돌아야 한다.',
      'The arcs cancel: +θ_1 − θ_2 + θ_3 − θ_4 = 0 (Kawasaki!). Only the U-turns remain: three valleys (+540°) and one mountain (−180°) make 360°, exactly one full turn, as any closed loop must.'),
    draw: (t) => (
      <g>
        <Paper P={3} fill={0.25} circle={0} letters={0} />
        <Layers k={1} opacity={1} />
        <StartLine />
        <FoldedCircle t={1} />
        <Ledger n={8} total={seg(t, 0.15, 0.35)} verdict={seg(t, 0.45, 0.65)} />
      </g>
    ),
  },
  {
    duration: 5200, view: 'top', viewNote: flatNote,
    caption: () => tr('다시 펼친 종이를 위에서 본다. 산과 골이 2개씩이면? U턴이 서로 상쇄돼 회전의 합이 0°가 된다. 한 바퀴를 돌 수 없으니 닫힌 고리가 안 된다. 그래서 평탄하게 접힌 꼭짓점은 언제나 |M − V| = 2 (Maekawa 정리).',
      'Back to the flat sheet, seen from above. Two of each? The U-turns cancel and the total is 0°. Without a full turn the loop cannot close. So a flat-folded vertex always has |M − V| = 2 (Maekawa\'s theorem).'),
    draw: (t) => (
      <g>
        <Paper mv={BAD_MV} r={90} cx={120} />
        <TwoEach k={t} />
      </g>
    ),
  },
  {
    duration: 5600, view: 'top', viewNote: flatNote,
    caption: () => tr('하지만 개수만 맞는다고 다 되는 것은 아니다. 가장 작은 섹터(θ_1 = 70°)를 둘러싼 두 크리스가 같은 방향이면 큰 섹터들이 작은 섹터를 덮어 버려 접히지 않는다. 이것을 판정하는 것이 crimp(big–little–big) 검사다.',
      'Counting is not enough. If the two creases around the smallest sector (θ_1 = 70°) point the same way, the big neighbours cover the small one and it will not fold. The crimp (big–little–big) test decides this.'),
    draw: (t) => {
      const k = seg(t, 0, 0.18);
      return (
        <g>
          <g opacity={1 - k}><Paper mv={BAD_MV} r={90} cx={120} /></g>
          <g opacity={k}><Paper mv={WRONG_MV} r={90} cx={120} bad={0} /></g>
          <TwoEach k={1} opacity={1 - k} />
          <g opacity={seg(t, 0.1, 0.25)}>
            <Label x={350} y={110} size={14} weight={600}>V 3, M 1 → |M − V| = 2  ✓</Label>
            <Label x={350} y={146} size={14} weight={700} color={BAD} opacity={seg(t, 0.35, 0.55)}>{tr('작은 섹터 양쪽이 같은 V  ✗', 'same V on both sides of the small sector  ✗')}</Label>
            <Label x={350} y={196} size={14} color={INK3} opacity={seg(t, 0.6, 0.85)}>{tr('필요조건 ≠ 충분조건', 'necessary ≠ sufficient')}</Label>
          </g>
        </g>
      );
    },
  },
];
