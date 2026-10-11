import { TOL } from '../numerics/tolerances';

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

export const v3 = (x = 0, y = 0, z = 0): Vec3 => [x, y, z];
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const norm = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const dist = (a: Vec3, b: Vec3): number => norm(sub(a, b));
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** Normalize with an epsilon guard. Returns `fallback` for (near-)zero vectors. */
export function normalize(a: Vec3, fallback: Vec3 = [0, 0, 0]): Vec3 {
  const n = norm(a);
  if (!(n > TOL.geometry) || !Number.isFinite(n)) return [...fallback] as Vec3;
  return [a[0] / n, a[1] / n, a[2] / n];
}

export const isFiniteVec = (a: readonly number[]): boolean => a.every((x) => Number.isFinite(x));

// ---- 2D helpers ----
export const sub2 = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
export const add2 = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]];
export const scale2 = (a: Vec2, s: number): Vec2 => [a[0] * s, a[1] * s];
export const dot2 = (a: Vec2, b: Vec2): number => a[0] * b[0] + a[1] * b[1];
export const cross2 = (a: Vec2, b: Vec2): number => a[0] * b[1] - a[1] * b[0];
export const norm2 = (a: Vec2): number => Math.hypot(a[0], a[1]);
export const polar2 = (r: number, ang: number): Vec2 => [r * Math.cos(ang), r * Math.sin(ang)];
