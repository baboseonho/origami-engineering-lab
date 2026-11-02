import type { ReactNode } from 'react';

/**
 * A tiny shaded-paper renderer for the motion explainers: 3D polygons seen
 * through an orbit camera, lit by one soft light, sorted back to front, with
 * a contact shadow on the table. Plain SVG, cheap enough to redraw every frame.
 * World: x right, y away from the viewer, z up.
 */

export type V3 = [number, number, number];

export interface Cam {
  /** turn about z, degrees (0 = looking along +y) */
  yaw: number;
  /** look-down angle, degrees (90 = straight down) */
  pitch: number;
  /** px per world unit */
  scale: number;
  /** screen point the world origin maps to */
  cx: number;
  cy: number;
}

const D2R = Math.PI / 180;
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const mix3 = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
/** rotate p about the axis through o with unit direction u by `deg` (right hand) */
export function rotAbout(p: V3, o: V3, u: V3, deg: number): V3 {
  const v = sub(p, o), c = Math.cos(deg * D2R), s = Math.sin(deg * D2R);
  const r = add(add(mul(v, c), mul(cross(u, v), s)), mul(u, dot(u, v) * (1 - c)));
  return add(o, r);
}

/** camera basis: right, up (on screen), and the direction towards the viewer */
function basis(cam: Cam) {
  const y = cam.yaw * D2R, p = cam.pitch * D2R;
  const right: V3 = [Math.cos(y), Math.sin(y), 0];
  const fwd: V3 = [-Math.sin(y) * Math.cos(p), Math.cos(y) * Math.cos(p), -Math.sin(p)]; // into the screen
  const up = cross(right, fwd);
  return { right, up, view: mul(fwd, -1) as V3 };
}

/** screen x, y and depth (larger = nearer the viewer) */
export function project(q: V3, cam: Cam): [number, number, number] {
  const b = basis(cam);
  return [cam.cx + dot(q, b.right) * cam.scale, cam.cy - dot(q, b.up) * cam.scale, dot(q, b.view)];
}

/** light from the upper left, a little towards the viewer */
const LIGHT = norm([-0.45, -0.35, 0.82]);
type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const PAPER_FRONT: RGB = hex('#fdfdfb');
export const PAPER_BACK: RGB = hex('#c9dcea');
export const INK_RGB: RGB = hex('#17202a');
const rgb = (c: RGB) => `rgb(${Math.round(c[0])} ${Math.round(c[1])} ${Math.round(c[2])})`;
export const tint = (c: RGB, t: RGB, k: number): RGB => [c[0] + (t[0] - c[0]) * k, c[1] + (t[1] - c[1]) * k, c[2] + (t[2] - c[2]) * k];

/** Lambert with a high ambient so paper stays paper; shadow side falls towards ink, not black. */
export function shadeFor(n: V3, base: RGB) {
  const l = Math.max(0, dot(n, LIGHT));
  const k = 0.62 + 0.38 * l; // 0.62 … 1
  return rgb(tint(base, INK_RGB, (1 - k) * 0.9));
}

export interface Face {
  pts: V3[];
  /** colour of the side that faces +normal (the paper's front) and of the other side */
  front?: RGB;
  back?: RGB;
  /** extra colour laid over the face (e.g. strain), with its weight */
  over?: { c: RGB; k: number };
  stroke?: string;
  strokeWidth?: number;
  /** creases or marks drawn on this face, in world coordinates */
  lines?: { a: V3; b: V3; stroke: string; width?: number; dash?: string; opacity?: number }[];
  opacity?: number;
  key?: string;
}

/** Faces sorted back to front and shaded by their normal, with lines drawn on top of their own face. */
export function Mesh({ faces, cam, edge = 'var(--color-ink)', edgeWidth = 1.2 }: { faces: Face[]; cam: Cam; edge?: string; edgeWidth?: number }) {
  const b = basis(cam);
  const items = faces.map((f, i) => {
    const P = f.pts.map((q) => project(q, cam));
    const n = norm(cross(sub(f.pts[1], f.pts[0]), sub(f.pts[f.pts.length - 1], f.pts[0])));
    const towards = dot(n, b.view) >= 0;
    const base = towards ? (f.front ?? PAPER_FRONT) : (f.back ?? PAPER_BACK);
    const lit = towards ? n : mul(n, -1) as V3;
    const col = f.over ? tint(base, f.over.c, f.over.k) : base;
    const depth = P.reduce((s, p) => s + p[2], 0) / P.length;
    return { f, P, fill: shadeFor(lit, col), depth, i };
  });
  items.sort((a, c) => a.depth - c.depth || a.i - c.i);
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      {items.map(({ f, P, fill, i }) => (
        <g key={f.key ?? i} opacity={f.opacity ?? 1}>
          <polygon points={P.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')} fill={fill} stroke={f.stroke ?? edge} strokeWidth={f.strokeWidth ?? edgeWidth} />
          {f.lines?.map((ln, k) => {
            const A = project(ln.a, cam), B = project(ln.b, cam);
            return <line key={k} x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} stroke={ln.stroke} strokeWidth={ln.width ?? 2} strokeDasharray={ln.dash} opacity={ln.opacity ?? 1} />;
          })}
        </g>
      ))}
    </g>
  );
}

/** Soft contact shadow: every face dropped straight onto the table (z = 0), blurred. */
export function Shadow({ faces, cam, opacity = 0.16, id }: { faces: Face[]; cam: Cam; opacity?: number; id: string }) {
  return (
    <g>
      <defs><filter id={id} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={5} /></filter></defs>
      <g filter={`url(#${id})`} opacity={opacity}>
        {faces.map((f, i) => (
          <polygon key={i} points={f.pts.map((q) => { const p = project([q[0] + q[2] * 0.25, q[1] - q[2] * 0.2, 0], cam); return `${p[0].toFixed(1)},${p[1].toFixed(1)}`; }).join(' ')} fill="var(--color-ink)" />
        ))}
      </g>
    </g>
  );
}

/** A world-space label anchor: returns the screen point of q, for placing Labels next to 3D things. */
export const at = (q: V3, cam: Cam) => { const p = project(q, cam); return [p[0], p[1]] as [number, number]; };

export type { ReactNode };
