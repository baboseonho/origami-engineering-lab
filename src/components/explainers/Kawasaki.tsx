import { tr } from '../../i18n';
import { arc, BAD, EVEN, INK, INK3, Label, lerp, ODD, OK, pt, seg, wedge, type Scene } from './Explainer';
import { FoldedVertex, FRONT, type MV } from './FoldedVertex';

const TH = [70, 100, 110, 80];
/** the broken vertex: θ1 + 20°, θ2 − 20° */
const TH_BAD = [90, 80, 110, 80];
/** the same mountain/valley assignment as the Maekawa explainer, so both show the same folded paper */
const MVK: readonly MV[] = ['V', 'M', 'V', 'V'];
const CY = 150, R = 105;
/** the view pans a little as the paper folds, so the folded stack sits in the middle */
const cxAt = (P: number) => 240 - 40 * Math.min(1, Math.max(0, P) / 3);
const CXF = cxAt(3);
const col = (i: number) => (i % 2 === 0 ? ODD : EVEN);
const starts = (th: readonly number[]) => th.reduce<number[]>((a, x) => [...a, a[a.length - 1] + x], [0]).slice(0, th.length);

/** a small numbered badge at the end of a crease */
function Badge({ n, x, y, opacity }: { n: number; x: number; y: number; opacity: number }) {
  if (opacity <= 0) return null;
  return (
    <g opacity={opacity}>
      <circle cx={x} cy={y} r={9.5} fill="var(--color-paper)" stroke={INK} strokeWidth={1.4} />
      <Label x={x} y={y + 4.6} size={13} weight={700}>{String(n)}</Label>
    </g>
  );
}

/** sector-angle labels on the flat sheet */
function SectorLabels({ th, cx, k, values = true }: { th: readonly number[]; cx: number; k: (i: number) => number; values?: boolean }) {
  const r = starts(th);
  return (
    <g>
      {th.map((x, i) => {
        const [lx, ly] = pt(cx, CY, R * 0.6, r[i] + x / 2);
        return <Label key={i} x={lx} y={ly + 5} color={col(i)} weight={700} opacity={k(i)}>{values ? `θ_${i + 1} = ${Math.round(x)}°` : `θ_${i + 1}`}</Label>;
      })}
    </g>
  );
}

/**
 * The paper at the vertex, flat (P = 0) or folded P creases deep, seen from
 * above. Front of the paper light, back blue-grey; sector rims in their colours.
 */
function Stack({ th = TH, P, fill = 1, rim = 1, badges = 0, closure = 0, edgeK, cut = 0 }: {
  th?: readonly number[]; P: number; fill?: number; rim?: number; badges?: number; closure?: number; edgeK?: (ray: number) => number; cut?: number;
}) {
  const cx = cxAt(P);
  return (
    <g>
      <FoldedVertex th={th} mv={MVK} cx={cx} cy={CY} r={R} progress={P} fill={fill} edgeK={edgeK}
        edgeStyle={() => ({ stroke: INK, width: 2 })} rim={col} rimOpacity={rim} closure={closure}
        rayLabel={badges > 0 ? (j, x, y) => <Badge n={j + 1} x={x} y={y} opacity={badges} /> : undefined} />
      <Label x={cx + R + 4} y={CY + 30} anchor="start" size={13} color={INK3} weight={600} opacity={cut}>{tr('여기를 잘라 둠', 'cut here')}</Label>
    </g>
  );
}

/**
 * The angular walk: the direction of the folded paper's edges, seen from
 * above. Folded flat, the paper turns over at every crease, so the direction
 * goes +θ1, −θ2, +θ3, −θ4. Drawn as arcs that step outwards.
 */
function Walk({ th, t, cx = CXF, cy = CY }: { th: readonly number[]; t: number; cx?: number; cy?: number }) {
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
      <line x1={cx} y1={cy} x2={pt(cx, cy, 124, 0)[0]} y2={cy} stroke={INK3} strokeWidth={1.4} strokeDasharray="5 4" />
      <Label x={pt(cx, cy, 130, 0)[0]} y={cy + 5} anchor="start" size={13} color={INK3}>{tr('시작 (크리스 1)', 'start (crease 1)')}</Label>
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

const fmt = (x: number) => (x < 0 ? `−${-x}` : `${x}`);
const numText = (th: readonly number[], upto: number) => {
  const parts = th.slice(0, upto).map((x, i) => (i === 0 ? `${x}` : i % 2 ? ` − ${x}` : ` + ${x}`));
  const s = th.slice(0, upto).reduce((a, x, i) => a + (i % 2 ? -x : x), 0);
  return `${parts.join('')} = ${fmt(s)}°`;
};
const symText = (upto: number) => ['θ_1', ' − θ_2', ' + θ_3', ' − θ_4'].slice(0, upto).join('');
const steps = (w: number) => Math.min(4, Math.floor(w * 4 + 0.999));

/** the two formula lines under the walk */
function Sums({ th, w, opacity = 1 }: { th: readonly number[]; w: number; opacity?: number }) {
  const n = steps(w);
  if (n === 0) return null;
  return (
    <g opacity={opacity}>
      <Label x={240} y={258} size={16} weight={600}>{symText(n)}</Label>
      <Label x={240} y={286} size={16} weight={600}>{numText(th, n)}</Label>
    </g>
  );
}

/** the gathered half-circles picture: sectors moved apart by k */
function Gather({ k, tint, labels, sums }: { k: number; tint: number; labels: number; sums: number }) {
  const from = starts(TH);
  const to = [0, 180, 70, 280];
  return (
    <g>
      {TH.map((x, i) => {
        const a0 = lerp(from[i], to[i], k);
        const dy = (i % 2 ? 1 : -1) * 12 * k;
        const [lx, ly] = pt(240, CY, R * 0.6, a0 + x / 2);
        return (
          <g key={i} transform={`translate(0 ${dy})`}>
            <path d={wedge(240, CY, R, a0, a0 + x)} fill={FRONT} stroke={INK3} strokeWidth={0.9} />
            <path d={wedge(240, CY, R, a0, a0 + x)} fill={col(i)} fillOpacity={0.2 * tint} />
            <path d={arc(240, CY, R, a0, a0 + x)} fill="none" stroke={col(i)} strokeWidth={3.5} strokeLinecap="round" />
            {[a0, a0 + x].map((a, e) => { const [ex, ey] = pt(240, CY, R, a); return <line key={e} x1={240} y1={CY} x2={ex} y2={ey} stroke={INK} strokeWidth={2} strokeLinecap="round" />; })}
            <Label x={lx} y={ly + 5} color={col(i)} weight={700} opacity={labels}>{`θ_${i + 1} = ${x}°`}</Label>
          </g>
        );
      })}
      <circle cx={240} cy={CY} r={3.5} fill={INK} opacity={1 - k} />
      <Label x={240} y={CY - R - 22} size={17} weight={700} color={ODD} opacity={sums}>θ_1 + θ_3 = 180°</Label>
      <Label x={240} y={CY + R + 38} size={17} weight={700} color={EVEN} opacity={sums}>θ_2 + θ_4 = 180°</Label>
    </g>
  );
}

const flatNote = () => tr('펼친 종이', 'flat sheet');
const foldNote = () => tr('접는 중', 'folding');
const walkNote = () => tr('위에서 본 모서리 방향', 'edge directions seen from above');

export const kawasakiScenes = (): Scene[] => [
  {
    duration: 4200, view: 'top', viewNote: flatNote,
    caption: () => tr('종이 위 한 점에서 크리스 네 개가 만난다. 크리스 사이의 각이 섹터각 θ_1…θ_4이고, 넷을 더하면 360°다. 지금은 펼친 종이를 위에서 내려다본 모습이다.',
      'Four creases meet at one point on the paper. The angles between them are the sector angles θ_1…θ_4; together they make 360°. This is the flat sheet, seen from above.'),
    draw: (t) => (
      <g>
        <g opacity={seg(t, 0, 0.2)}>
          <Stack P={0} rim={seg(t, 0.45, 0.7)} edgeK={(j) => seg(t, 0.1 + j * 0.09, 0.32 + j * 0.09)} />
        </g>
        <SectorLabels th={TH} cx={240} k={(i) => seg(t, 0.5 + i * 0.09, 0.68 + i * 0.09)} />
      </g>
    ),
  },
  {
    duration: 4600, view: 'top', viewNote: foldNote,
    caption: () => tr('이제 이 꼭짓점을 평탄하게 접으며 위에서 본다. 설명을 위해 크리스 1을 따라 종이를 잠시 잘라 두고, 크리스 2부터 하나씩 접는다. 크리스 2를 접으면 그 너머의 종이 전체가 크리스를 축으로 넘어가 뒤집힌다. 파란 면이 종이의 뒷면이다.',
      'Now fold the vertex flat while looking down on it. To explain, imagine the paper cut along crease 1, then fold the other creases one at a time. Folding crease 2 swings all the paper beyond it over the crease, turning it over: the blue side is the back of the paper.'),
    draw: (t) => {
      const P = seg(t, 0.3, 0.92);
      return (
        <g>
          <Stack P={P} badges={seg(t, 0.04, 0.2)} cut={seg(t, 0.1, 0.25)} />
          <SectorLabels th={TH} cx={cxAt(P)} k={() => 1 - seg(t, 0, 0.16)} />
        </g>
      );
    },
  },
  {
    duration: 4000, view: 'top', viewNote: foldNote,
    caption: () => tr('크리스 3을 접는다. 크리스 3 너머의 두 섹터가, 크리스 3이 지금 놓인 자리를 축으로 다시 넘어간다. 한 번 더 뒤집혀 앞면이 위로 온다. 겹친 층은 가장자리를 조금씩 어긋나게 그렸다.',
      'Fold crease 3. The two sectors beyond it swing over again, about where crease 3 now lies, and turn face up once more. Stacked layers are drawn with slightly offset rims so you can count them.'),
    draw: (t) => <Stack P={1 + seg(t, 0.12, 0.9)} badges={1} cut={1} />,
  },
  {
    duration: 5200, view: 'top', viewNote: () => tr('다 접힌 결과', 'the folded result'),
    caption: () => tr('크리스 4까지 접으면 마지막 섹터의 끝 모서리가 정확히 크리스 1 위에 내려앉는다(초록). 잘라 둔 곳이 다시 맞붙으니 이 꼭짓점은 평탄하게 접힌다. 접는 순서는 설명을 위한 것이고, 그림은 다 접힌 종이를 위에서 본 모습이다.',
      'Fold crease 4 and the far edge of the last sector lands exactly on crease 1 (green). The cut closes up again, so this vertex folds flat. The folding order is only for the explanation; the picture is the folded paper seen from above.'),
    draw: (t) => (
      <g>
        <Stack P={2 + seg(t, 0.05, 0.55)} badges={1} cut={1 - seg(t, 0.55, 0.7)} closure={seg(t, 0.6, 0.75)} />
        <Label x={240} y={272} size={16} weight={700} color={OK} opacity={seg(t, 0.7, 0.85)}>{tr('끝 모서리가 크리스 1로 돌아왔다  ✓', 'the far edge is back on crease 1  ✓')}</Label>
      </g>
    ),
  },
  {
    duration: 6800, view: 'diagram', viewNote: walkNote,
    caption: () => tr('여기서부터는 개념도다. 접힌 종이를 위에서 보며 모서리가 가리키는 방향만 차례로 따라간다. 섹터 하나를 지날 때마다 방향이 그 섹터각만큼 돌고, 종이가 매번 뒤집혀 있으니 도는 쪽이 번갈아 바뀐다: +θ_1, −θ_2, +θ_3, −θ_4.',
      'From here on it is a diagram. Looking down on the folded paper, follow only the directions its edges point in, one after another. Each sector turns the direction by its angle, and since the paper is turned over each time, the turns alternate: +θ_1, −θ_2, +θ_3, −θ_4.'),
    draw: (t) => {
      const k = seg(t, 0, 0.16);
      const w = seg(t, 0.18, 0.92);
      return (
        <g>
          <Stack P={3} fill={1 - 0.72 * k} rim={1 - 0.6 * k} badges={1 - k} closure={1 - k} />
          <Label x={240} y={272} size={16} weight={700} color={OK} opacity={1 - seg(t, 0, 0.1)}>{tr('끝 모서리가 크리스 1로 돌아왔다  ✓', 'the far edge is back on crease 1  ✓')}</Label>
          <g opacity={seg(t, 0.08, 0.2)}><Walk th={TH} t={w} /></g>
          <Sums th={TH} w={w} />
        </g>
      );
    },
  },
  {
    duration: 4200, view: 'diagram', viewNote: walkNote,
    caption: () => tr('끝 방향이 시작 방향(크리스 1)과 같아야 접힌 종이가 꼭짓점 둘레에서 닫힌다. 이것이 Kawasaki 정리다: θ_1 − θ_2 + θ_3 − θ_4 = 0.',
      'The folded paper closes around the vertex only if the walk ends pointing where it started, along crease 1. That is Kawasaki\'s theorem: θ_1 − θ_2 + θ_3 − θ_4 = 0.'),
    draw: (t) => {
      const k = seg(t, 0.05, 0.35);
      return (
        <g>
          <Stack P={3} fill={0.28} rim={0.4} />
          <Walk th={TH} t={1} />
          <line x1={CXF} y1={CY} x2={CXF + 124} y2={CY} stroke={OK} strokeWidth={4} strokeLinecap="round" opacity={k} />
          <Sums th={TH} w={1} opacity={1 - k} />
          <g opacity={k}>
            <Label x={240} y={258} size={17} weight={700} color={OK}>θ_1 − θ_2 + θ_3 − θ_4 = 0</Label>
            <Label x={240} y={286} size={16} weight={600} color={OK}>70 − 100 + 110 − 80 = 0°  ✓</Label>
          </g>
        </g>
      );
    },
  },
  {
    duration: 3000, view: 'top', viewNote: () => tr('다시 펼치는 중', 'unfolding'),
    caption: () => tr('같은 조건을 다른 그림으로도 볼 수 있다. 다시 위에서 본 종이로 돌아가, 마지막에 접은 크리스부터 거꾸로 펼친다.',
      'The same condition has another picture. Back to the paper seen from above: unfold it again, last crease first.'),
    draw: (t) => {
      const k = seg(t, 0, 0.2);
      const P = 3 - 3 * seg(t, 0.2, 0.9);
      return (
        <g>
          <Stack P={P} fill={0.28 + 0.72 * k} rim={0.4 + 0.6 * k} />
          <g opacity={1 - k}>
            <Walk th={TH} t={1} />
            <line x1={CXF} y1={CY} x2={CXF + 124} y2={CY} stroke={OK} strokeWidth={4} strokeLinecap="round" />
            <Label x={240} y={258} size={17} weight={700} color={OK}>θ_1 − θ_2 + θ_3 − θ_4 = 0</Label>
            <Label x={240} y={286} size={16} weight={600} color={OK}>70 − 100 + 110 − 80 = 0°  ✓</Label>
          </g>
          <SectorLabels th={TH} cx={240} k={() => seg(t, 0.86, 1)} />
        </g>
      );
    },
  },
  {
    duration: 5200, view: 'diagram', viewNote: () => tr('섹터를 잘라 옮김', 'sectors cut and moved'),
    caption: () => tr('이번엔 개념도로, 섹터를 잘라 옮겨 본다. 홀수 번째 섹터(θ_1, θ_3)를 모으면 반원, 짝수 번째(θ_2, θ_4)를 모아도 반원이다. 각각 180°: Kawasaki 정리를 달리 쓴 것이다.',
      'Now as a diagram: cut the sectors out and move them. Gather the odd sectors (θ_1, θ_3) and they make a half circle; the even ones (θ_2, θ_4) make the other half. 180° each: Kawasaki\'s theorem said another way.'),
    draw: (t) => <Gather k={seg(t, 0.1, 0.65)} tint={seg(t, 0.1, 0.4)} labels={1} sums={seg(t, 0.7, 0.9)} />,
  },
  {
    duration: 7400, view: 'top', viewNote: () => tr('바꾼 꼭짓점', 'a changed vertex'),
    caption: () => tr('다시 펼친 종이를 위에서 본다. θ_1을 20° 키우고 θ_2를 20° 줄인 뒤 같은 순서로 접으면, 끝 모서리가 크리스 1에 돌아오지 못하고 40° 어긋난다(빨간 틈).',
      'Back to the flat sheet, seen from above. Make θ_1 20° larger and θ_2 20° smaller, then fold in the same order: the far edge misses crease 1 by 40° (the red gap).'),
    draw: (t) => {
      const g = 1 - seg(t, 0, 0.13);
      if (g > 0) return <Gather k={g} tint={g} labels={1} sums={1 - seg(t, 0, 0.06)} />;
      const m = seg(t, 0.16, 0.3);
      const th = TH.map((x, i) => lerp(x, TH_BAD[i], m));
      const P = 3 * seg(t, 0.4, 0.86);
      return (
        <g>
          <Stack th={th} P={P} closure={seg(t, 0.87, 0.95)} badges={seg(t, 0.33, 0.42)} cut={seg(t, 0.36, 0.45) * (1 - seg(t, 0.84, 0.9))} />
          <SectorLabels th={th} cx={cxAt(P)} k={() => 1 - seg(t, 0.33, 0.4)} />
          <Label x={240} y={276} size={16} weight={600} opacity={seg(t, 0.17, 0.27) * (1 - seg(t, 0.84, 0.88))}>θ_1 + 20°,  θ_2 − 20°</Label>
          <Label x={240} y={276} size={16} weight={700} color={BAD} opacity={seg(t, 0.88, 0.97)}>{tr('끝 모서리가 크리스 1에서 40° 어긋난다  ✗', 'the far edge misses crease 1 by 40°  ✗')}</Label>
        </g>
      );
    },
  },
  {
    duration: 6200, view: 'diagram', viewNote: walkNote,
    caption: () => tr('개념도로 보면: 모서리 방향을 따라간 걸음이 시작 방향으로 돌아오지 못한다. 90 − 80 + 110 − 80 = 40° ≠ 0이므로 이 꼭짓점은 평탄하게 접히지 않는다.',
      'As a diagram: following the edge directions, the walk does not return to where it started. 90 − 80 + 110 − 80 = 40° ≠ 0, so this vertex cannot fold flat.'),
    draw: (t) => {
      const k = seg(t, 0, 0.14);
      const w = seg(t, 0.14, 0.72);
      const end = 90 - 80 + 110 - 80;
      return (
        <g>
          <Stack th={TH_BAD} P={3} fill={1 - 0.72 * k} rim={1 - 0.6 * k} closure={1 - k} badges={1 - k} />
          <Label x={240} y={276} size={16} weight={700} color={BAD} opacity={1 - seg(t, 0, 0.08)}>{tr('끝 모서리가 크리스 1에서 40° 어긋난다  ✗', 'the far edge misses crease 1 by 40°  ✗')}</Label>
          <g opacity={seg(t, 0.06, 0.16)}><Walk th={TH_BAD} t={w} /></g>
          {w >= 1 && <path d={arc(CXF, CY, 30, end, 0)} fill="none" stroke={BAD} strokeWidth={6} strokeLinecap="round" opacity={seg(t, 0.74, 0.86)} />}
          <Sums th={TH_BAD} w={w} opacity={1 - seg(t, 0.78, 0.9)} />
          <g opacity={seg(t, 0.8, 0.94)}>
            <Label x={240} y={258} size={17} weight={700} color={BAD}>θ_1 − θ_2 + θ_3 − θ_4 = 40° ≠ 0</Label>
            <Label x={240} y={286} size={16} weight={600} color={BAD}>90 − 80 + 110 − 80 = 40°  ✗</Label>
          </g>
        </g>
      );
    },
  },
];
