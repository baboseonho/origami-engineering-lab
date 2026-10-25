/**
 * Generator registry: every model is rebuilt deterministically from
 * (generator name, params). This lets workers and undo/redo reproduce models
 * without serialising geometry.
 */
import { DEG } from '../core/numerics/tolerances';
import { tr } from '../i18n';
import type { OrigamiModel } from '../core/topology/types';
import { boxpleat, type BoxpleatPreset } from './generators/boxpleat';
import { hypar, type HyparVariant } from './generators/hypar';
import { kresling } from './generators/kresling';
import { miura } from './generators/miura';
import { pleat } from './generators/pleat';
import { resch } from './generators/resch';
import { shoppingBag } from './generators/shoppingBag';
import { singleVertex } from './generators/singleVertex';
import { squareTwist } from './generators/squareTwist';
import { twist } from './generators/twist';
import { waterbomb, waterbombBase } from './generators/waterbomb';
import { waterbombTube } from './generators/waterbombTube';
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
      return singleVertex({ sectors, assignment: sectors.map((_, i) => mv[i] ?? 'V'), radius: num(p, 'radius', 1) });
    },
    specs: [
      { key: 'sectors', get label() { return tr('섹터각 θ (°, 쉼표로 구분)', 'Sector angles θ (°, comma-separated)'); }, kind: 'list' },
      { key: 'mv', get label() { return tr('M/V 배정 (쉼표로 구분)', 'M/V assignment (comma-separated)'); }, kind: 'list' },
      { key: 'radius', get label() { return tr('종이 반지름', 'Paper radius'); }, kind: 'float', min: 0.5, max: 3, step: 0.1 },
    ],
    defaults: { sectors: '70,100,110,80', mv: 'V,M,V,V', radius: 1 },
  },
  miura: {
    build: (p) => miura({ rows: num(p, 'rows', 3), cols: num(p, 'cols', 3), a: num(p, 'a', 1), b: num(p, 'b', 1), alpha: num(p, 'alpha', 60) * DEG }),
    specs: [
      { key: 'rows', get label() { return tr('패널 행 수', 'Panel rows'); }, kind: 'int', min: 1, max: 10 },
      { key: 'cols', get label() { return tr('패널 열 수', 'Panel columns'); }, kind: 'int', min: 1, max: 10 },
      { key: 'a', get label() { return tr('패널 변 a', 'Panel side a'); }, kind: 'float', min: 0.3, max: 3, step: 0.1 },
      { key: 'b', get label() { return tr('패널 변 b', 'Panel side b'); }, kind: 'float', min: 0.3, max: 3, step: 0.1 },
      { key: 'alpha', get label() { return tr('예각 α (°)', 'Acute angle α (°)'); }, kind: 'angle', min: 20, max: 85, step: 1 },
    ],
    defaults: { rows: 3, cols: 3, a: 1, b: 1, alpha: 60 },
  },
  squareTwist: {
    build: (p) => {
      const h = num(p, 'h', 0.5);
      return squareTwist({ h, phi: num(p, 'phi', 25) * DEG, L: Math.max(num(p, 'L', 1.6), h + 0.2) });
    },
    specs: [
      { key: 'phi', get label() { return tr('비틀림각 φ (°)', 'Twist angle φ (°)'); }, kind: 'angle', min: 5, max: 40, step: 1 },
      { key: 'h', get label() { return tr('중앙 정사각형 반폭', 'Central square half-width'); }, kind: 'float', min: 0.2, max: 1.0, step: 0.05 },
      { key: 'L', get label() { return tr('종이 반폭', 'Paper half-width'); }, kind: 'float', min: 1.0, max: 2.5, step: 0.1 },
    ],
    defaults: { phi: 25, h: 0.5, L: 1.6 },
  },
  shoppingBag: {
    build: (p) => shoppingBag({ W: num(p, 'W', 2), D: num(p, 'D', 1), H: num(p, 'H', 2) }),
    specs: [
      { key: 'W', get label() { return tr('폭 W', 'Width W'); }, kind: 'float', min: 0.5, max: 4, step: 0.1 },
      { key: 'D', get label() { return tr('깊이 D', 'Depth D'); }, kind: 'float', min: 0.4, max: 3, step: 0.1 },
      { key: 'H', get label() { return tr('높이 H (H > D/2 이면 tall)', 'Height H (tall if H > D/2)'); }, kind: 'float', min: 0.6, max: 4, step: 0.1 },
    ],
    defaults: { W: 2, D: 1, H: 2 },
  },
  waterbomb: {
    build: (p) => waterbomb({ d: num(p, 'd', 1), cols: num(p, 'cols', 4), rows: num(p, 'rows', 4) }),
    specs: [
      { key: 'cols', get label() { return tr('행당 베이스 수', 'Bases per row'); }, kind: 'int', min: 1, max: 8 },
      { key: 'rows', get label() { return tr('행 수', 'Rows'); }, kind: 'int', min: 1, max: 8 },
      { key: 'd', get label() { return tr('베이스 한 변 d', 'Base side d'); }, kind: 'float', min: 0.3, max: 3, step: 0.1 },
    ],
    defaults: { cols: 4, rows: 4, d: 1 },
  },
  waterbombBase: {
    build: (p) => waterbombBase(num(p, 'size', 2)),
    specs: [{ key: 'size', get label() { return tr('종이 한 변', 'Paper side'); }, kind: 'float', min: 0.5, max: 5, step: 0.1 }],
    defaults: { size: 2 },
  },
  resch: {
    build: (p) => resch({ s: num(p, 's', 1), m: num(p, 'm', 3), n: num(p, 'n', 2), variant: str(p, 'variant', 'valid') as 'valid' | 'perturbed' }),
    specs: [
      { key: 'm', get label() { return tr('턱 셀 수 (방향 1)', 'Tuck cells (direction 1)'); }, kind: 'int', min: 1, max: 5 },
      { key: 'n', get label() { return tr('턱 셀 수 (방향 2)', 'Tuck cells (direction 2)'); }, kind: 'int', min: 1, max: 4 },
      { key: 'variant', get label() { return tr('변형', 'Variant'); }, kind: 'select', options: ['valid', 'perturbed'] },
      { key: 's', get label() { return tr('격자 삼각형 한 변 s', 'Lattice triangle side s'); }, kind: 'float', min: 0.3, max: 3, step: 0.1 },
    ],
    defaults: { m: 3, n: 2, variant: 'valid', s: 1 },
  },
  boxpleat: {
    build: (p) => boxpleat({ n: num(p, 'n', 4), preset: str(p, 'preset', 'tray') as BoxpleatPreset, size: num(p, 'size', 1) }),
    specs: [
      { key: 'n', get label() { return tr('격자 칸 수', 'Grid cells'); }, kind: 'int', min: 3, max: 8 },
      { key: 'preset', get label() { return tr('격자 위 설계', 'Design on the grid'); }, kind: 'select', options: ['tray', 'pleat', 'grid'] },
      { key: 'size', get label() { return tr('격자 칸 한 변', 'Grid cell side'); }, kind: 'float', min: 0.3, max: 3, step: 0.1 },
    ],
    defaults: { n: 4, preset: 'tray', size: 1 },
  },
  kresling: {
    build: (p) =>
      kresling({
        n: num(p, 'n', 6), R: num(p, 'R', 1), H: num(p, 'H', 1.2), phi: num(p, 'phi', 45) * DEG, cells: num(p, 'cells', 1),
        chirality: str(p, 'chirality', 'right') === 'left' ? -1 : 1, caps: bool(p, 'caps', true),
      }),
    specs: [
      { key: 'n', get label() { return tr('다각형 변 수 n', 'Polygon sides n'); }, kind: 'int', min: 3, max: 12 },
      { key: 'R', get label() { return tr('반지름 R', 'Radius R'); }, kind: 'float', min: 0.5, max: 2, step: 0.1 },
      { key: 'H', get label() { return tr('셀 높이 H', 'Cell height H'); }, kind: 'float', min: 0.3, max: 3, step: 0.05 },
      { key: 'phi', get label() { return tr('비틀림 φ (°)', 'Twist φ (°)'); }, kind: 'angle', min: 5, max: 80, step: 1 },
      { key: 'cells', get label() { return tr('셀 수', 'Cells'); }, kind: 'int', min: 1, max: 4 },
      { key: 'chirality', get label() { return tr('카이랄성 (chirality)', 'Chirality'); }, kind: 'select', options: ['right', 'left'] },
      { key: 'caps', get label() { return tr('강체 끝 다각형 (caps)', 'Rigid end polygons (caps)'); }, kind: 'bool' },
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
      { key: 'n', get label() { return tr('원주 분할 수', 'Circumferential divisions'); }, kind: 'int', min: 4, max: 16 },
      { key: 'R', get label() { return tr('반지름 R', 'Radius R'); }, kind: 'float', min: 0.5, max: 2, step: 0.1 },
      { key: 'height', get label() { return tr('높이', 'Height'); }, kind: 'float', min: 0.5, max: 5, step: 0.1 },
      { key: 'rows', get label() { return tr('축방향 행 수', 'Axial rows'); }, kind: 'int', min: 2, max: 10 },
      { key: 'variant', get label() { return tr('변형', 'Variant'); }, kind: 'select', options: ['smooth', 'creased'] },
      { key: 'imperfection', get label() { return tr('초기 결함 (×R)', 'Initial imperfection (×R)'); }, kind: 'float', min: 0, max: 0.05, step: 0.002 },
      { key: 'caps', get label() { return tr('강체 끝 다각형 (caps)', 'Rigid end polygons (caps)'); }, kind: 'bool' },
    ],
    defaults: { n: 8, R: 1, height: 2.4, rows: 4, variant: 'smooth', imperfection: 0.01, caps: false },
  },
  pleat: {
    build: (p) => pleat({ n: num(p, 'n', 6), width: num(p, 'width', 3), depth: num(p, 'depth', 0.5) }),
    specs: [
      { key: 'n', get label() { return tr('크리스 수 n', 'Creases n'); }, kind: 'int', min: 2, max: 12 },
      { key: 'width', get label() { return tr('띠 폭 (크리스 길이)', 'Strip width (crease length)'); }, kind: 'float', min: 0.5, max: 5, step: 0.1 },
      { key: 'depth', get label() { return tr('주름 깊이 (크리스 간격)', 'Pleat depth (crease spacing)'); }, kind: 'float', min: 0.2, max: 1.5, step: 0.05 },
    ],
    defaults: { n: 6, width: 3, depth: 0.5 },
  },
  hypar: {
    build: (p) => hypar({ rings: num(p, 'rings', 6), L: num(p, 'L', 2), variant: str(p, 'variant', 'classic') as HyparVariant }),
    specs: [
      { key: 'rings', get label() { return tr('동심 정사각형 수', 'Concentric squares'); }, kind: 'int', min: 3, max: 10 },
      { key: 'L', get label() { return tr('종이 반폭', 'Paper half-width'); }, kind: 'float', min: 1, max: 3, step: 0.1 },
      { key: 'variant', get label() { return tr('변형', 'Variant'); }, kind: 'select', options: ['classic', 'triangulated'] },
    ],
    defaults: { rings: 6, L: 2, variant: 'classic' },
  },
  twist: {
    build: (p) => {
      const h = num(p, 'h', 0.5);
      return twist({ n: num(p, 'n', 6), phi: num(p, 'phi', 15) * DEG, h, L: Math.max(num(p, 'L', 1.6), h + 0.2) });
    },
    specs: [
      { key: 'n', get label() { return tr('중앙 다각형 변 수 n', 'Central polygon sides n'); }, kind: 'int', min: 3, max: 8 },
      {
        key: 'phi', get label() { return tr('비틀림각 φ (°)', 'Twist angle φ (°)'); }, kind: 'angle', min: 2, max: 58, step: 1,
        get help() { return tr('유효 범위로 잘린다: n = 3이면 30° ≤ φ < 58°, 그 밖에는 φ < 180°/n − 2°', 'Clamped to the valid range: 30° ≤ φ < 58° for n = 3, otherwise φ < 180°/n − 2°'); },
      },
      { key: 'h', get label() { return tr('중앙 다각형 내접 반지름', 'Central polygon apothem'); }, kind: 'float', min: 0.2, max: 1.0, step: 0.05 },
      { key: 'L', get label() { return tr('종이 내접 반지름', 'Paper apothem'); }, kind: 'float', min: 1.0, max: 2.5, step: 0.1 },
    ],
    defaults: { n: 6, phi: 15, h: 0.5, L: 1.6 },
  },
  waterbombTube: {
    build: (p) => waterbombTube({ n: num(p, 'n', 6), m: num(p, 'm', 4), d: num(p, 'd', 1) }),
    specs: [
      { key: 'n', get label() { return tr('원주 방향 유닛 수 n', 'Units around n'); }, kind: 'int', min: 4, max: 12 },
      { key: 'm', get label() { return tr('축 방향 유닛 수 m', 'Units along the axis m'); }, kind: 'int', min: 1, max: 8 },
      { key: 'd', get label() { return tr('유닛 한 변 d', 'Unit side d'); }, kind: 'float', min: 0.3, max: 3, step: 0.1 },
    ],
    defaults: { n: 6, m: 4, d: 1 },
  },
};

export function buildFromRegistry(generator: string, params: Params): OrigamiModel {
  const g = GENERATORS[generator];
  if (!g) throw new Error(`Unknown generator ${generator}`);
  return g.build({ ...g.defaults, ...params });
}
