import type { ReactNode } from 'react';
import { arc, BAD, INK3, OK, rad } from './Explainer';

/**
 * A single-vertex fold seen from above, folded one crease at a time.
 *
 * For the explanation the paper is imagined cut along crease 1; creases
 * 2, 3, … are then folded in order. Each fold reflects every sector beyond
 * the crease across the crease's current ray. While a fold is under way it
 * is drawn as a rotation about that ray seen from above: the component
 * perpendicular to the ray is scaled by cos(πp), so the flap swings over and
 * shows its other side after the half-way point. Layers are stacked by the
 * mountain/valley of each crease and drawn with a tiny radius offset so the
 * stack reads.
 */

export type MV = 'M' | 'V';
export const FRONT = 'var(--color-paper-front)';
export const BACK = 'var(--color-paper-back)';
/** radius step between stacked layers */
export const LAYER_OFF = 4;

interface Sec { s: number; c: number; flips: number; layer: number }
export interface FoldPlan { starts: number[]; states: Sec[][]; axes: number[]; over: boolean[] }

export function foldPlan(th: readonly number[], mv: readonly MV[]): FoldPlan {
  const n = th.length;
  const starts = th.reduce<number[]>((a, x) => [...a, a[a.length - 1] + x], [0]).slice(0, n);
  let cur: Sec[] = th.map(() => ({ s: 1, c: 0, flips: 0, layer: 0 }));
  const states = [cur];
  const axes: number[] = [];
  const over: boolean[] = [];
  for (let j = 1; j < n; j++) {
    const psi = cur[j].s * starts[j] + cur[j].c;
    // a valley (seen from the front) brings the flap up over when the front faces up
    const o = (cur[j].flips % 2 === 0) === (mv[j] === 'V');
    const ls = cur.map((x) => x.layer);
    const mx = Math.max(...ls), mn = Math.min(...ls);
    const g = cur.slice(j).map((x) => x.layer);
    const gmx = Math.max(...g), gmn = Math.min(...g);
    const next = cur.map((x, i) => (i < j ? x : {
      s: -x.s, c: 2 * psi - x.c, flips: x.flips + 1,
      layer: o ? mx + 1 + (gmx - x.layer) : mn - 1 - (x.layer - gmn),
    }));
    axes.push(psi); over.push(o); states.push(next); cur = next;
  }
  return { starts, states, axes, over };
}

/** stack level (0 = bottom) of each sector after `k` folds */
export function levels(plan: FoldPlan, k: number) {
  const st = plan.states[Math.min(k, plan.states.length - 1)];
  const mn = Math.min(...st.map((x) => x.layer));
  return st.map((x) => x.layer - mn);
}


export interface EdgeStyle { stroke: string; width?: number; dash?: string }

export function FoldedVertex({
  th, mv, cx, cy, r, progress, fill = 1, edgeK, edgeStyle, rim, rimOpacity = 1, circle, rayLabel, closure = 0,
}: {
  th: readonly number[]; mv: readonly MV[]; cx: number; cy: number; r: number;
  /** 0 = flat, k = k folds done; fractional = a fold under way */
  progress: number;
  fill?: number;
  /** how far each crease is drawn out from the vertex, 0..1 */
  edgeK?: (ray: number) => number;
  edgeStyle: (ray: number) => EdgeStyle;
  /** colour of the outer rim of each sector, if any */
  rim?: (sector: number) => string;
  rimOpacity?: number;
  /** a circle drawn on the paper around the vertex: it folds with the paper */
  circle?: { r: number; opacity: number; color?: string };
  /** a label at the end of each crease, following the crease as it moves */
  rayLabel?: (ray: number, x: number, y: number) => ReactNode;
  /** after the last fold: green where the far edge meets crease 1, red gap where it misses */
  closure?: number;
}) {
  const plan = foldPlan(th, mv);
  const n = th.length;
  const maxP = n - 1;
  const P = Math.min(maxP, Math.max(0, progress));
  let k = Math.floor(P), p = P - k;
  if (k >= maxP) { k = maxP - 1; p = 1; }
  const base = plan.states[k];
  const next = plan.states[k + 1];
  const moving = (i: number) => p > 0 && i >= k + 1;
  const lvA = levels(plan, k), lvB = levels(plan, k + 1);
  const level = (i: number) => (p > 0 ? lvA[i] + (lvB[i] - lvA[i]) * p : lvA[i]);
  const flips = (i: number) => base[i].flips + (moving(i) && p > 0.5 ? 1 : 0);

  const place = (i: number, a: number, rho: number): [number, number] => {
    const b = base[i];
    const al = b.s * a + b.c;
    if (!moving(i)) return [cx + rho * Math.cos(rad(al)), cy - rho * Math.sin(rad(al))];
    const psi = plan.axes[k];
    const rel = rad(al - psi);
    const u = rho * Math.cos(rel), v = rho * Math.sin(rel) * Math.cos(Math.PI * p);
    const ps = rad(psi);
    return [cx + u * Math.cos(ps) - v * Math.sin(ps), cy - (u * Math.sin(ps) + v * Math.cos(ps))];
  };
  const samples = (i: number, rho: number) => {
    const a0 = plan.starts[i], m = Math.max(2, Math.ceil(th[i] / 3));
    return Array.from({ length: m + 1 }, (_, q) => place(i, a0 + (th[i] * q) / m, rho));
  };
  const line = (pts: [number, number][]) => pts.map((q, j) => `${j ? 'L' : 'M'}${q[0].toFixed(2)},${q[1].toFixed(2)}`).join(' ');

  // drawing order: bottom layer first
  const idx = Array.from({ length: n }, (_, i) => i);
  let order: number[];
  if (p > 0 && p < 1) {
    const stat = idx.filter((i) => !moving(i)).sort((a, b) => base[a].layer - base[b].layer || a - b);
    const mov = idx.filter(moving).sort((a, b) => (base[a].layer - base[b].layer || a - b) * (p < 0.5 ? 1 : -1));
    order = plan.over[k] ? [...stat, ...mov] : [...mov, ...stat];
  } else {
    const st = p >= 1 ? next : base;
    order = idx.sort((a, b) => st[a].layer - st[b].layer || a - b);
  }

  const edge = (i: number, a: number, ray: number, rho: number) => {
    const e = edgeStyle(ray);
    const kk = edgeK ? edgeK(ray) : 1;
    if (kk <= 0) return null;
    const [x, y] = place(i, a, rho * kk);
    return <line x1={cx} y1={cy} x2={x} y2={y} stroke={e.stroke} strokeWidth={e.width ?? 2} strokeDasharray={e.dash} strokeLinecap="round" opacity={Math.max(fill, 0.35)} />;
  };

  const far = (() => {
    const last = plan.states[maxP][n - 1];
    const a = last.s * 360 + last.c;
    return ((a % 360) + 540) % 360 - 180;
  })();
  const closed = Math.abs(far) < 0.5;

  return (
    <g strokeLinejoin="round">
      {order.map((i) => {
        const rho = r - LAYER_OFF * level(i);
        const pts = samples(i, rho);
        const a0 = plan.starts[i], a1 = a0 + th[i];
        return (
          <g key={i}>
            <path d={`M${cx},${cy} ${line(pts).replace(/^M/, 'L')} Z`} fill={flips(i) % 2 ? BACK : FRONT} fillOpacity={fill} stroke={INK3} strokeWidth={0.9} strokeOpacity={fill} />
            {rim && rimOpacity > 0 && <path d={line(pts)} fill="none" stroke={rim(i)} strokeWidth={3.5} strokeOpacity={rimOpacity} strokeLinecap="round" />}
            {circle && circle.opacity > 0 && <path d={line(samples(i, circle.r - LAYER_OFF * level(i)))} fill="none" stroke={circle.color ?? 'var(--color-ink)'} strokeWidth={3} opacity={circle.opacity} strokeLinecap="round" />}
            {edge(i, a0, i, rho)}
            {edge(i, a1, (i + 1) % n, rho)}
          </g>
        );
      })}
      {closure > 0 && (closed ? (
        <line x1={cx} y1={cy} x2={cx + r + 8} y2={cy} stroke={OK} strokeWidth={4.5} strokeLinecap="round" opacity={closure} />
      ) : (
        <g opacity={closure}>
          <line x1={cx} y1={cy} x2={cx + (r + 4) * Math.cos(rad(far))} y2={cy - (r + 4) * Math.sin(rad(far))} stroke={BAD} strokeWidth={3.5} strokeLinecap="round" />
          <path d={arc(cx, cy, 34, far, 0)} fill="none" stroke={BAD} strokeWidth={6} strokeLinecap="round" />
        </g>
      ))}
      {rayLabel && idx.map((j) => {
        const [x, y] = place(j, plan.starts[j], r + 17);
        return <g key={'l' + j}>{rayLabel(j, x, y)}</g>;
      })}
      <circle cx={cx} cy={cy} r={3.5} fill="var(--color-ink)" />
    </g>
  );
}
