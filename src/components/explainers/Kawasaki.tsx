import { tr } from '../../i18n';
import { arc, BAD, EVEN, INK, INK3, Label, ODD, OK, pt, seg, wedge, type Scene } from './Explainer';

const TH = [70, 100, 110, 80];
const CX = 240, CY = 150, R = 105;
const col = (i: number) => (i % 2 === 0 ? ODD : EVEN);
/** ray directions: ray i starts sector i */
const rays = (th: number[]) => th.reduce<number[]>((a, x) => [...a, a[a.length - 1] + x], [0]).slice(0, th.length);

/** The pattern: rays and coloured sectors, drawn in up to `t`. */
function Pattern({ th, t = 1, labels = true }: { th: number[]; t?: number; labels?: boolean }) {
  const r = rays(th);
  return (
    <g>
      {th.map((x, i) => {
        const a0 = r[i];
        const show = seg(t, 0.15 + i * 0.12, 0.35 + i * 0.12);
        return (
          <g key={i} opacity={show}>
            <path d={wedge(CX, CY, R, a0, a0 + x)} fill={col(i)} fillOpacity={0.16} />
            {labels && <Label x={pt(CX, CY, R * 0.62, a0 + x / 2)[0]} y={pt(CX, CY, R * 0.62, a0 + x / 2)[1] + 5} color={col(i)} weight={700}>θ{i + 1} = {x}°</Label>}
          </g>
        );
      })}
      {r.map((a, i) => {
        const k = seg(t, i * 0.1, 0.25 + i * 0.1);
        const [x, y] = pt(CX, CY, R * k, a);
        return <line key={i} x1={CX} y1={CY} x2={x} y2={y} stroke={INK} strokeWidth={2.4} strokeLinecap="round" />;
      })}
      <circle cx={CX} cy={CY} r={4} fill={INK} />
    </g>
  );
}

/**
 * The angular walk: folded flat, the paper turns back at every crease, so the
 * direction goes +θ1, −θ2, +θ3, −θ4. Drawn as arcs that step outwards.
 */
function Walk({ th, t, cx = CX, cy = CY }: { th: number[]; t: number; cx?: number; cy?: number }) {
  const n = th.length;
  const phi = th.reduce<number[]>((a, x, i) => [...a, a[a.length - 1] + (i % 2 === 0 ? x : -x)], [0]);
  const done = t * n;
  const k = Math.min(n - 1, Math.floor(done));
  const p = Math.min(1, done - k);
  const rk = (i: number) => 38 + i * 15;
  const cur = done >= n ? phi[n] : phi[k] + (phi[k + 1] - phi[k]) * p;
  const tip = pt(cx, cy, rk(Math.min(n, k + p)) + 18, cur);
  return (
    <g>
      <line x1={cx} y1={cy} x2={pt(cx, cy, 120, 0)[0]} y2={cy} stroke={INK3} strokeWidth={1.4} strokeDasharray="5 4" />
      <Label x={pt(cx, cy, 128, 0)[0]} y={cy + 5} anchor="start" size={13} color={INK3}>{tr('시작', 'start')}</Label>
      {phi.slice(0, n).map((a, i) => {
        if (i > k) return null;
        const end = i < k || done >= n ? phi[i + 1] : a + (phi[i + 1] - a) * p;
        return <path key={i} d={arc(cx, cy, rk(i + 1), a, end)} fill="none" stroke={col(i)} strokeWidth={4} strokeLinecap="round" />;
      })}
      <line x1={cx} y1={cy} x2={tip[0]} y2={tip[1]} stroke={INK} strokeWidth={2.4} />
      <circle cx={tip[0]} cy={tip[1]} r={5} fill={INK} />
      <circle cx={cx} cy={cy} r={4} fill={INK} />
    </g>
  );
}

const sumText = (th: number[], upto: number) => {
  const parts = th.slice(0, upto).map((x, i) => (i === 0 ? `${x}` : i % 2 ? ` − ${x}` : ` + ${x}`));
  const s = th.slice(0, upto).reduce((a, x, i) => a + (i % 2 ? -x : x), 0);
  return `${parts.join('')} = ${s < 0 ? '−' + -s : s}°`;
};

export const kawasakiScenes = (): Scene[] => [
  {
    duration: 4200,
    caption: () => tr('종이 위 한 점에서 크리스 네 개가 만난다. 크리스 사이의 각을 섹터각 θ라고 한다. 네 각을 더하면 360°, 평평한 종이다.', 'Four creases meet at one point on the paper. The angles between them are the sector angles θ. Together they make 360°: flat paper.'),
    draw: (t) => <Pattern th={TH} t={t} />,
  },
  {
    duration: 6500,
    caption: () => tr('평탄하게 접으면 크리스를 하나 지날 때마다 종이가 뒤집혀 방향이 반대로 바뀐다. 그래서 +θ1, −θ2, +θ3, −θ4 순서로 번갈아 돈다.', 'Folded flat, the paper flips over at every crease, so the direction reverses. It turns +θ1, −θ2, +θ3, −θ4, alternating.'),
    draw: (t) => (
      <g>
        <Walk th={TH} t={seg(t, 0.05, 0.92)} />
        <Label x={240} y={288} size={16} weight={600}>{sumText(TH, Math.min(4, Math.floor(seg(t, 0.05, 0.92) * 4 + 0.999)))}</Label>
      </g>
    ),
  },
  {
    duration: 4200,
    caption: () => tr('끝 방향이 시작 방향과 같아야 종이가 꼭짓점 둘레에서 닫힌다. 이것이 Kawasaki 정리다: θ1 − θ2 + θ3 − θ4 = 0.', 'The paper closes around the vertex only if the walk ends where it started. That is Kawasaki\'s theorem: θ1 − θ2 + θ3 − θ4 = 0.'),
    draw: (t) => (
      <g>
        <Walk th={TH} t={1} />
        <line x1={CX} y1={CY} x2={pt(CX, CY, 120, 0)[0]} y2={CY} stroke={OK} strokeWidth={4} opacity={seg(t, 0, 0.3)} />
        <Label x={240} y={288} size={17} weight={700} color={OK} opacity={seg(t, 0.2, 0.5)}>70 − 100 + 110 − 80 = 0  ✓</Label>
      </g>
    ),
  },
  {
    duration: 5200,
    caption: () => tr('같은 말을 그림으로 하면: 홀수 번째 섹터(θ1, θ3)를 모으면 반원, 짝수 번째(θ2, θ4)를 모아도 반원이다. 각각 180°.', 'The same thing as a picture: gather the odd sectors (θ1, θ3) and they make a half circle; the even ones (θ2, θ4) make the other half. 180° each.'),
    draw: (t) => {
      const k = seg(t, 0.1, 0.7);
      const from = [0, 70, 170, 280];
      const to = [0, 180, 70, 280];
      const dy = [-1, 1, -1, 1].map((s) => s * 12 * k);
      return (
        <g>
          {TH.map((x, i) => {
            const a0 = from[i] + (to[i] - from[i]) * k;
            return (
              <g key={i} transform={`translate(0 ${dy[i]})`}>
                <path d={wedge(CX, CY, R, a0, a0 + x)} fill={col(i)} fillOpacity={0.22} stroke={col(i)} strokeWidth={1.5} />
                <Label x={pt(CX, CY, R * 0.6, a0 + x / 2)[0]} y={pt(CX, CY, R * 0.6, a0 + x / 2)[1] + 5} color={col(i)} weight={700}>θ{i + 1}</Label>
              </g>
            );
          })}
          <Label x={CX} y={CY - R - 22} size={17} weight={700} color={ODD} opacity={seg(t, 0.7, 0.9)}>θ1 + θ3 = 180°</Label>
          <Label x={CX} y={CY + R + 38} size={17} weight={700} color={EVEN} opacity={seg(t, 0.7, 0.9)}>θ2 + θ4 = 180°</Label>
        </g>
      );
    },
  },
  {
    duration: 6000,
    caption: () => tr('θ1을 20° 키우고 θ2를 20° 줄이면? 걸음의 끝이 시작으로 돌아오지 못한다. 빨간 틈만큼 어긋나 이 꼭짓점은 평탄하게 접히지 않는다.', 'Make θ1 20° larger and θ2 20° smaller: the walk no longer returns to the start. It misses by the red gap, so this vertex cannot fold flat.'),
    draw: (t) => {
      const th = [90, 80, 110, 80];
      const w = seg(t, 0.05, 0.75);
      const end = 90 - 80 + 110 - 80;
      return (
        <g>
          <Walk th={th} t={w} />
          {w >= 1 && <path d={arc(CX, CY, 30, end, 0)} fill="none" stroke={BAD} strokeWidth={6} strokeLinecap="round" opacity={seg(t, 0.75, 0.9)} />}
          <Label x={240} y={288} size={17} weight={700} color={BAD} opacity={seg(t, 0.78, 0.95)}>90 − 80 + 110 − 80 = 40° ≠ 0  ✗</Label>
        </g>
      );
    },
  },
];
