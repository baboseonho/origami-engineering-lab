import { tr } from '../../i18n';
import { BAD, INK, INK3, Label, MOUNTAIN, OK, seg, VALLEY, type Scene } from './Explainer';

type P3 = [number, number, number];
/** isometric projection, z up */
const iso = (p: P3, s: number, ox: number, oy: number): [number, number] => [
  ox + (p[0] - p[1]) * 0.866 * s,
  oy - p[2] * s + (p[0] + p[1]) * 0.5 * s,
];
const poly = (pts: [number, number][]) => pts.map((p) => p.join(',')).join(' ');

// ───────────────────────────── the shopping bag (schematic)

const W = 2, D = 1, H = 2;

/**
 * A paper bag being flattened, drawn as a schematic: the side walls fold in
 * along their centre gusset crease (panel widths stay D/2) while the depth
 * goes to zero. `bend` tints the faces that must bend on the way.
 */
function Bag({ s, ox = 240, oy = 190, scale = 62, bend = 0, wobble = 0 }: { s: number; ox?: number; oy?: number; scale?: number; bend?: number; wobble?: number }) {
  const d = D * (1 - s) * (1 + wobble);
  const a = Math.sqrt(Math.max(0, (D / 2) ** 2 - (d / 2) ** 2)); // how far the gusset crease moves in
  const P = (x: number, y: number, z: number) => iso([x, y, z], scale, ox, oy);
  const tint = (k: number) => `rgba(179,36,27,${(0.5 * k * bend).toFixed(3)})`;
  // corners: front y = 0, back y = d
  const f0 = P(0, 0, 0), f1 = P(W, 0, 0), f2 = P(W, 0, H), f3 = P(0, 0, H);
  const b0 = P(0, d, 0), b1 = P(W, d, 0), b2 = P(W, d, H), b3 = P(0, d, H);
  const gL0 = P(a, d / 2, 0), gL1 = P(a, d / 2, H), gR0 = P(W - a, d / 2, 0), gR1 = P(W - a, d / 2, H);
  return (
    <g strokeLinejoin="round">
      {/* bottom and back (behind) */}
      <polygon points={poly([f0, f1, b1, b0])} fill="var(--color-paper-3)" stroke={INK3} strokeWidth={1} />
      <polygon points={poly([b0, b1, b2, b3])} fill="var(--color-paper-2)" stroke={INK3} strokeWidth={1} />
      {/* side walls: two panels each, meeting at the gusset crease */}
      <polygon points={poly([f0, gL0, gL1, f3])} fill="var(--color-paper)" stroke={INK} strokeWidth={1.4} />
      <polygon points={poly([b0, gL0, gL1, b3])} fill="var(--color-paper-2)" stroke={INK} strokeWidth={1.4} />
      <polygon points={poly([f1, gR0, gR1, f2])} fill="var(--color-paper)" stroke={INK} strokeWidth={1.4} />
      <polygon points={poly([b1, gR0, gR1, b2])} fill="var(--color-paper-2)" stroke={INK} strokeWidth={1.4} />
      {/* bottom gusset triangles: the faces that have to bend */}
      <polygon points={poly([f0, gL0, P(0, 0, D / 2)])} fill={tint(1)} stroke={VALLEY} strokeWidth={1.6} strokeDasharray="6 4" />
      <polygon points={poly([f1, gR0, P(W, 0, D / 2)])} fill={tint(1)} stroke={VALLEY} strokeWidth={1.6} strokeDasharray="6 4" />
      {/* front wall */}
      <polygon points={poly([f0, f1, f2, f3])} fill="var(--color-paper)" fillOpacity={0.88} stroke={INK} strokeWidth={1.8} />
      <polygon points={poly([f0, f1, P(W, 0, D / 2), P(0, 0, D / 2)])} fill={tint(0.8)} stroke="none" />
      {/* gusset creases */}
      <line x1={gL0[0]} y1={gL0[1]} x2={gL1[0]} y2={gL1[1]} stroke={MOUNTAIN} strokeWidth={2.2} strokeDasharray="9 3 2 3" />
      <line x1={gR0[0]} y1={gR0[1]} x2={gR1[0]} y2={gR1[1]} stroke={MOUNTAIN} strokeWidth={2.2} strokeDasharray="9 3 2 3" />
    </g>
  );
}

/** configuration space: every shape is a point; open and flat are isolated */
function ConfigSpace({ path = 0, fail = 0 }: { path?: number; fail?: number }) {
  const A: [number, number] = [120, 160], B: [number, number] = [360, 160];
  const curve = `M${A[0]},${A[1]} C 190,60 290,60 ${B[0]},${B[1]}`;
  return (
    <g>
      <rect x={40} y={40} width={400} height={220} rx={6} fill="var(--color-paper-2)" stroke={INK3} strokeDasharray="4 4" />
      <Label x={52} y={62} anchor="start" size={13} color={INK3}>{tr('형상 공간 (가능한 모든 모양)', 'Configuration space (every possible shape)')}</Label>
      {fail > 0 && (
        <g opacity={fail}>
          <path d={`M${A[0] + 14},${A[1]} L${B[0] - 14},${B[1]}`} stroke={INK3} strokeWidth={2} strokeDasharray="6 6" />
          <Label x={240} y={168} size={26} weight={700} color={BAD}>✗</Label>
          <Label x={240} y={198} size={14} color={BAD}>{tr('면이 단단하면 길이 없다', 'no path with rigid faces')}</Label>
        </g>
      )}
      {path > 0 && <path d={curve} fill="none" stroke={OK} strokeWidth={4} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - path} />}
      {[A, B].map((p, i) => (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r={16} fill="none" stroke={INK3} strokeDasharray="3 3" />
          <circle cx={p[0]} cy={p[1]} r={6} fill={INK} />
          <Label x={p[0]} y={p[1] + 38} size={15} weight={600}>{i === 0 ? tr('열린 백', 'open bag') : tr('납작한 백', 'flat bag')}</Label>
        </g>
      ))}
    </g>
  );
}

export const bagScenes = (): Scene[] => [
  {
    duration: 4200,
    caption: () => tr('보통의 종이 쇼핑백. 옆면 가운데의 산접기(거싯)와 바닥 쪽 삼각형 주름 덕분에 납작하게 접혀서 운반된다.', 'An ordinary paper bag. A mountain fold down the middle of each side (the gusset) and triangle folds near the bottom let it ship flat.'),
    draw: (t) => <g opacity={seg(t, 0, 0.4)}><Bag s={0} /></g>,
  },
  {
    duration: 5200,
    caption: () => tr('그런데 면을 휘지 않는 단단한 판이라고 해 보자. 백은 아주 조금 흔들릴 뿐(1차 가동성), 그 이상은 한 걸음도 접히지 않는다.', 'Now suppose every face is a rigid panel that cannot bend. The bag only wiggles a tiny bit (first-order mobility) and cannot fold any further.'),
    draw: (t) => (
      <g>
        <Bag s={0} wobble={0.04 * Math.sin(t * Math.PI * 6) * (1 - seg(t, 0.7, 1))} />
        <Label x={240} y={282} size={16} weight={700} color={BAD} opacity={seg(t, 0.6, 0.85)}>{tr('강체로는 여기까지', 'rigidly, this is as far as it goes')}</Label>
      </g>
    ),
  },
  {
    duration: 5600,
    caption: () => tr('가능한 모든 모양을 점 하나로 찍은 "형상 공간"으로 보면: 열린 백과 납작한 백은 둘 다 존재하는 모양이지만, 면을 휘지 않고는 둘을 잇는 길이 없는 외딴 점이다.', 'Picture every possible shape as one point in a "configuration space". The open bag and the flat bag both exist, but they are isolated points: no path joins them without bending a face.'),
    draw: (t) => <ConfigSpace fail={seg(t, 0.35, 0.65)} />,
  },
  {
    duration: 6500,
    caption: () => tr('실제 종이는 조금 휜다. 면이 휘는 것을 허용하면 길이 생기고 백이 납작해진다. 붉을수록 많이 휘는 면: 시작과 끝은 평평하고, 중간에서만 휜다.', 'Real paper bends a little. Allow faces to bend and a path appears: the bag flattens. Redder means more bending: none at the start or end, only on the way.'),
    draw: (t) => {
      const s = seg(t, 0.1, 0.9);
      return (
        <g>
          <g transform="translate(145 190) scale(0.82) translate(-240 -190)"><Bag s={s} bend={Math.sin(Math.PI * s)} /></g>
          <g transform="translate(250 30) scale(0.42)"><ConfigSpace path={s} /></g>
        </g>
      );
    },
  },
  {
    duration: 5200,
    caption: () => tr('Balkcom, Demaine, Demaine(2004)의 결과다: 키 큰 종이 쇼핑백은 강체로 접을 수 없다. 우리가 매일 쇼핑백을 접을 수 있는 건 종이가 휘기 때문이다.', 'This is the result of Balkcom, Demaine and Demaine (2004): a tall paper bag cannot be folded rigidly. We fold shopping bags every day only because paper bends.'),
    draw: (t) => (
      <g>
        <g transform="translate(120 200) scale(0.7) translate(-240 -190)"><Bag s={0} /></g>
        <g transform="translate(360 200) scale(0.7) translate(-240 -190)"><Bag s={1} /></g>
        <Label x={240} y={140} size={30} weight={700} opacity={seg(t, 0.1, 0.4)}>→</Label>
        <Label x={240} y={170} size={14} color={BAD} weight={600} opacity={seg(t, 0.2, 0.5)}>{tr('면이 휘어야 함', 'faces must bend')}</Label>
        <Label x={240} y={282} size={13} color={INK3} opacity={seg(t, 0.4, 0.7)}>{tr('그림은 개념도다. 정확한 계산은 이 도면의 3D 모델에서 본다.', 'Schematic drawing; the exact computation is the 3D model on this sheet.')}</Label>
      </g>
    ),
  },
];

// ───────────────────────────── the hypar

const RINGS = [1, 0.75, 0.5, 0.25];
/** saddle z = c·x·y: corners (a,a) and (−a,−a) rise, the other two sink */
const corners = (a: number, c: number): P3[] => [[a, a, c * a * a], [-a, a, -c * a * a], [-a, -a, c * a * a], [a, -a, -c * a * a]];

function HyparCP({ t = 1 }: { t?: number }) {
  const s = 100, cx = 240, cy = 150;
  return (
    <g>
      {RINGS.map((a, i) => {
        const k = seg(t, i * 0.15, 0.3 + i * 0.15);
        return <rect key={i} x={cx - a * s} y={cy - a * s} width={2 * a * s} height={2 * a * s} fill="none"
          stroke={i === 0 ? INK : i % 2 ? MOUNTAIN : VALLEY} strokeWidth={i === 0 ? 2 : 2.2} strokeDasharray={i === 0 ? undefined : i % 2 ? '9 3 2 3' : '7 4'} opacity={k} />;
      })}
      {[[1, 1], [1, -1]].map(([u, v], i) => (
        <line key={i} x1={cx - u * s} y1={cy - v * s} x2={cx + u * s} y2={cy + v * s} stroke={INK3} strokeWidth={1.4} opacity={seg(t, 0.7, 0.95)} />
      ))}
    </g>
  );
}

/** a turned, slightly raised view so the saddle reads (an isometric view looks straight down its diagonal) */
const view = (p: P3, s: number, ox: number, oy: number): [number, number] => {
  const yaw = (28 * Math.PI) / 180;
  const x = p[0] * Math.cos(yaw) - p[1] * Math.sin(yaw);
  const y = p[0] * Math.sin(yaw) + p[1] * Math.cos(yaw);
  return [ox + x * s, oy - p[2] * s * 0.95 + y * s * 0.42];
};

function Hypar3D({ c, highlight = 0, split = 0 }: { c: number; highlight?: number; split?: number }) {
  const s = 118, ox = 240, oy = 150;
  const P = (p: P3) => view(p, s, ox, oy);
  const rings = RINGS.map((a) => corners(a, c));
  // the trapezoid between ring 0 and ring 1 on one side
  const q: P3[] = [rings[0][0], rings[0][1], rings[1][1], rings[1][0]];
  const qs = q.map(P);
  return (
    <g strokeLinejoin="round">
      {rings.map((r, i) => (
        <polygon key={i} points={poly(r.map(P))} fill="none" stroke={i === 0 ? INK : i % 2 ? MOUNTAIN : VALLEY} strokeWidth={2.2} strokeDasharray={i === 0 ? undefined : i % 2 ? '9 3 2 3' : '7 4'} />
      ))}
      {[0, 1, 2, 3].map((k) => <line key={k} x1={P(rings[0][k])[0]} y1={P(rings[0][k])[1]} x2={P([0, 0, 0])[0]} y2={P([0, 0, 0])[1]} stroke={INK3} strokeWidth={1.2} />)}
      {highlight > 0 && <polygon points={poly(qs)} fill={BAD} fillOpacity={0.22 * highlight} stroke={BAD} strokeWidth={2.4 * highlight} />}
      {split > 0 && <line x1={qs[0][0]} y1={qs[0][1]} x2={qs[2][0]} y2={qs[2][1]} stroke={OK} strokeWidth={3} strokeDasharray="6 4" opacity={split} />}
    </g>
  );
}

export const hyparScenes = (): Scene[] => [
  {
    duration: 4200,
    caption: () => tr('하이파의 크리스 패턴: 동심 정사각형에 산과 골을 번갈아 주고, 대각선을 더한다. 직선뿐이다.', 'The hypar\'s crease pattern: concentric squares, alternately mountain and valley, plus the diagonals. Straight lines only.'),
    draw: (t) => <HyparCP t={t} />,
  },
  {
    duration: 5000,
    caption: () => tr('접으면 전체가 말안장(쌍곡포물면)처럼 휜다. 두 모서리는 올라가고 두 모서리는 내려간다. 바우하우스 시절부터 사람들이 접어 온 모양이다.', 'Folded, the whole sheet bends into a saddle (a hyperbolic paraboloid): two corners rise, two sink. People have folded it since the Bauhaus.'),
    draw: (t) => <Hypar3D c={0.55 * seg(t, 0.05, 0.85)} />,
  },
  {
    duration: 6000,
    caption: () => tr('그런데 고리 사이의 사다리꼴 하나를 보자. 네 꼭짓점이 한 평면 위에 있지 않다. 평평한 종이 조각이 이렇게 놓이려면 휘어야 한다. Demaine 외(2011)는 이 크리스만으로는 면을 평평하게 둔 채 접을 수 없음을 증명했다.', 'Look at one trapezoid between two rings: its four corners do not lie in one plane. A flat piece of paper can only sit like that if it bends. Demaine et al. (2011) proved the hypar cannot fold with exactly these creases and flat faces.'),
    draw: (t) => (
      <g>
        <Hypar3D c={0.55} highlight={seg(t, 0.1, 0.4)} />
        <Label x={240} y={286} size={15} weight={700} color={BAD} opacity={seg(t, 0.45, 0.7)}>{tr('네 꼭짓점이 한 평면에 없다 → 면이 휘어야 한다', 'four corners, not one plane → the face must bend')}</Label>
      </g>
    ),
  },
  {
    duration: 5600,
    caption: () => tr('그래서 실제 하이파는 면이 살짝 휘어서 접힌다. 사다리꼴마다 대각선 크리스를 하나 더하면 삼각형 두 개로 나뉘어, 면을 휘지 않고도 접히는 패턴이 된다.', 'So a real hypar folds because its faces bend slightly. Add one diagonal crease per trapezoid and it splits into two flat triangles: a pattern that folds without bending.'),
    draw: (t) => (
      <g>
        <Hypar3D c={0.55} highlight={1 - seg(t, 0.4, 0.7)} split={seg(t, 0.15, 0.45)} />
        <Label x={240} y={286} size={15} weight={700} color={OK} opacity={seg(t, 0.55, 0.8)}>{tr('삼각형은 언제나 평평하다 ✓', 'a triangle is always flat ✓')}</Label>
      </g>
    ),
  },
  {
    duration: 4200,
    caption: () => tr('이 도면에서: Energy로 접어 면이 얼마나 휘는지 보고, "삼각 분할" 프리셋으로 면을 휘지 않는 강체 버전을 접어 보자.', 'On this sheet: fold with Energy to see how much the faces bend, then try the "triangulated" preset, the rigid version with flat faces.'),
    draw: (t) => <g opacity={seg(t, 0, 0.4)}><Hypar3D c={0.55} split={1} /></g>,
  },
];
