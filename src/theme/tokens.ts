/**
 * Design tokens for places CSS custom properties cannot reach (SVG
 * attributes computed in JS, Three.js materials, canvas). Every value here
 * mirrors a `--color-*` token in src/index.css `@theme`; the unit test
 * src/tests/tokens.test.ts fails if the two drift apart.
 */
export const C = {
  // board + sheets
  board: '#d2dad2',
  board2: '#bcc7bd',
  paper: '#fbfcf9',
  paper2: '#f1f4ef',
  paper3: '#e5eae3',
  rule: '#d3d9d1',
  rule2: '#a8b2a9',
  // ink
  ink: '#17202a',
  ink2: '#36404c',
  ink3: '#58626e',
  nonphoto: '#8cc0de',
  nonphotoSoft: '#d4e6f1',
  // checker's highlighter
  mark: '#ffe04a',
  markStrong: '#ffd21f',
  markSoft: '#fff6c4',
  markDeep: '#e3a400',
  markInk: '#5c4a00',
  // domain convention
  mountain: '#c8352b',
  valley: '#2463c9',
  facet: '#9aa5a0',
  boundary: '#36404c',
  unassigned: '#b7860b',
  locked: '#6d28d9',
  // paper materials in the 3D/strip views
  paperFront: '#fdfdfb',
  paperBack: '#c9dcea',
  kraft: '#ece6d6',
  // states
  ok: '#1d7448',
  okSoft: '#e1f0e6',
  warn: '#9a5a00',
  warnSoft: '#faefd7',
  bad: '#b3241b',
  badSoft: '#fae4e1',
  info: '#1d5ca6',
  infoSoft: '#e2ecf7',
  collide: '#d6336c',
} as const;

export type ColorToken = keyof typeof C;

/** Categorical chart series, legible as ink on paper (not M/V-coded). */
export const SERIES = ['#2463c9', '#c8352b', '#1d7448', '#9a5a00', '#6d28d9', '#b5307a', '#0e7490', '#a3541c', '#4d7c0f', '#86198f'] as const;

/** `#rrggbb` + alpha (0..1) → `#rrggbbaa`. */
export const withAlpha = (hex: string, a: number): string =>
  hex + Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0');

/** camelCase token name → CSS custom property name, e.g. markInk → --color-mark-ink. */
export const cssVarName = (k: string): string => '--color-' + k.replace(/([A-Z])/g, '-$1').replace(/([a-z])(\d)/g, '$1-$2').toLowerCase();
