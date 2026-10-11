/**
 * Generator registry: every model is rebuilt deterministically from
 * (generator name, params). This lets workers and undo/redo reproduce models
 * without serialising geometry.
 */
import { DEG } from '../core/numerics/tolerances';
import type { OrigamiModel } from '../core/topology/types';
import { boxpleat, type BoxpleatPreset } from './generators/boxpleat';
import { kresling } from './generators/kresling';
import { miura } from './generators/miura';
import { resch } from './generators/resch';
import { shoppingBag } from './generators/shoppingBag';
import { singleVertex } from './generators/singleVertex';
import { squareTwist } from './generators/squareTwist';
import { waterbomb, waterbombBase } from './generators/waterbomb';
import { yoshimura } from './generators/yoshimura';

export type Params = Record<string, number | string | boolean>;

export interface ParamSpec {
  key: string;
  label: string;
  kind: 'int' | 'float' | 'angle' | 'select' | 'bool' | 'list';
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  help?: string;
}

const num = (p: Params, k: string, d: number) => (typeof p[k] === 'number' ? (p[k] as number) : d);
const str = (p: Params, k: string, d: string) => (typeof p[k] === 'string' ? (p[k] as string) : d);
const bool = (p: Params, k: string, d: boolean) => (typeof p[k] === 'boolean' ? (p[k] as boolean) : d);

export const GENERATORS: Record<string, { build: (p: Params) => OrigamiModel; specs: ParamSpec[]; defaults: Params }> = {
  singleVertex: {
    build: (p) => {
      const sectors = str(p, 'sectors', '70,100,110,80').split(',').map((s) => parseFloat(s) * DEG).filter((x) => x > 0);
      const mv = str(p, 'mv', 'V,M,V,V').split(',').map((s) => (s.trim() === 'M' ? 'M' : 'V')) as ('M' | 'V')[];
      return singleVertex({ sectors, assignment: sectors.map((_, i) => mv[i] ?? 'V') });
    },
    specs: [
      { key: 'sectors', label: '섹터각 θ (°, 쉼표로 구분)', kind: 'list' },
      { key: 'mv', label: 'M/V 배정 (쉼표로 구분)', kind: 'list' },
    ],
    defaults: { sectors: '70,100,110,80', mv: 'V,M,V,V' },
  },
  miura: {
    build: (p) => miura({ rows: num(p, 'rows', 3), cols: num(p, 'cols', 3), a: num(p, 'a', 1), b: num(p, 'b', 1), alpha: num(p, 'alpha', 60) * DEG }),
    specs: [
      { key: 'rows', label: '패널 행 수', kind: 'int', min: 1, max: 10 },
      { key: 'cols', label: '패널 열 수', kind: 'int', min: 1, max: 10 },
      { key: 'a', label: '패널 변 a', kind: 'float', min: 0.3, max: 3, step: 0.1 },
      { key: 'b', label: '패널 변 b', kind: 'float', min: 0.3, max: 3, step: 0.1 },
      { key: 'alpha', label: '예각 α (°)', kind: 'angle', min: 20, max: 85, step: 1 },
    ],
    defaults: { rows: 3, cols: 3, a: 1, b: 1, alpha: 60 },
  },
  squareTwist: {
    build: (p) => squareTwist({ h: 0.5, phi: num(p, 'phi', 25) * DEG, L: num(p, 'L', 1.6) }),
    specs: [
      { key: 'phi', label: '비틀림각 φ (°)', kind: 'angle', min: 5, max: 40, step: 1 },
      { key: 'L', label: '종이 반폭', kind: 'float', min: 1.0, max: 2.5, step: 0.1 },
    ],
    defaults: { phi: 25, L: 1.6 },
  },
  shoppingBag: {
    build: (p) => shoppingBag({ W: num(p, 'W', 2), D: num(p, 'D', 1), H: num(p, 'H', 2) }),
    specs: [
      { key: 'W', label: '폭 W', kind: 'float', min: 0.5, max: 4, step: 0.1 },
      { key: 'D', label: '깊이 D', kind: 'float', min: 0.4, max: 3, step: 0.1 },
      { key: 'H', label: '높이 H (H > D/2 이면 tall)', kind: 'float', min: 0.6, max: 4, step: 0.1 },
    ],
    defaults: { W: 2, D: 1, H: 2 },
  },
  waterbomb: {
    build: (p) => waterbomb({ d: 1, cols: num(p, 'cols', 4), rows: num(p, 'rows', 4) }),
    specs: [
      { key: 'cols', label: '행당 베이스 수', kind: 'int', min: 1, max: 8 },
      { key: 'rows', label: '행 수', kind: 'int', min: 1, max: 8 },
    ],
    defaults: { cols: 4, rows: 4 },
  },
  waterbombBase: { build: () => waterbombBase(2), specs: [], defaults: {} },
  resch: {
    build: (p) => resch({ s: 1, m: num(p, 'm', 3), n: num(p, 'n', 2), variant: str(p, 'variant', 'valid') as 'valid' | 'perturbed' }),
    specs: [
      { key: 'm', label: '턱 셀 수 (방향 1)', kind: 'int', min: 1, max: 5 },
      { key: 'n', label: '턱 셀 수 (방향 2)', kind: 'int', min: 1, max: 4 },
      { key: 'variant', label: '변형', kind: 'select', options: ['valid', 'perturbed'] },
    ],
    defaults: { m: 3, n: 2, variant: 'valid' },
  },
  boxpleat: {
    build: (p) => boxpleat({ n: num(p, 'n', 4), preset: str(p, 'preset', 'tray') as BoxpleatPreset }),
    specs: [
      { key: 'n', label: '격자 칸 수', kind: 'int', min: 3, max: 8 },
      { key: 'preset', label: '격자 위 설계', kind: 'select', options: ['tray', 'pleat', 'grid'] },
    ],
    defaults: { n: 4, preset: 'tray' },
  },
  kresling: {
    build: (p) =>
      kresling({
        n: num(p, 'n', 6), R: num(p, 'R', 1), H: num(p, 'H', 1.2), phi: num(p, 'phi', 45) * DEG, cells: num(p, 'cells', 1),
        chirality: str(p, 'chirality', 'right') === 'left' ? -1 : 1, caps: bool(p, 'caps', true),
      }),
    specs: [
      { key: 'n', label: '다각형 변 수 n', kind: 'int', min: 3, max: 12 },
      { key: 'R', label: '반지름 R', kind: 'float', min: 0.5, max: 2, step: 0.1 },
      { key: 'H', label: '셀 높이 H', kind: 'float', min: 0.3, max: 3, step: 0.05 },
      { key: 'phi', label: '비틀림 φ (°)', kind: 'angle', min: 5, max: 80, step: 1 },
      { key: 'cells', label: '셀 수', kind: 'int', min: 1, max: 4 },
      { key: 'chirality', label: '카이랄성 (chirality)', kind: 'select', options: ['right', 'left'] },
      { key: 'caps', label: '강체 끝 다각형 (caps)', kind: 'bool' },
    ],
    defaults: { n: 6, R: 1, H: 1.2, phi: 45, cells: 1, chirality: 'right', caps: true },
  },
  yoshimura: {
    build: (p) =>
      yoshimura({
        n: num(p, 'n', 8), R: num(p, 'R', 1), height: num(p, 'height', 2.4), rows: num(p, 'rows', 4),
        variant: str(p, 'variant', 'smooth') as 'creased' | 'smooth', imperfection: num(p, 'imperfection', 0.01), caps: bool(p, 'caps', false),
      }),
    specs: [
      { key: 'n', label: '원주 분할 수', kind: 'int', min: 4, max: 16 },
      { key: 'R', label: '반지름 R', kind: 'float', min: 0.5, max: 2, step: 0.1 },
      { key: 'height', label: '높이', kind: 'float', min: 0.5, max: 5, step: 0.1 },
      { key: 'rows', label: '축방향 행 수', kind: 'int', min: 2, max: 10 },
      { key: 'variant', label: '변형', kind: 'select', options: ['smooth', 'creased'] },
      { key: 'imperfection', label: '초기 결함 (×R)', kind: 'float', min: 0, max: 0.05, step: 0.002 },
      { key: 'caps', label: '강체 끝 다각형 (caps)', kind: 'bool' },
    ],
    defaults: { n: 8, R: 1, height: 2.4, rows: 4, variant: 'smooth', imperfection: 0.01, caps: false },
  },
};

export function buildFromRegistry(generator: string, params: Params): OrigamiModel {
  const g = GENERATORS[generator];
  if (!g) throw new Error(`Unknown generator ${generator}`);
  return g.build({ ...g.defaults, ...params });
}
