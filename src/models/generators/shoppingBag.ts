import { buildModel, edgeKey } from '../../core/topology/build';
import type { Assignment, OrigamiModel } from '../../core/topology/types';
import type { Vec2, Vec3 } from '../../core/geometry/vectors';

export interface ShoppingBagParams {
  /** width of front/back (x) */
  W: number;
  /** depth of the sides (y) */
  D: number;
  /** height (z); "tall" when H > D/2 */
  H: number;
}

/**
 * Traditional paper shopping bag, modelled in its OPEN state (box without
 * lid) as in Balkcom, Demaine, Demaine, Ochsendorf & You, "Folding paper
 * shopping bags", OSME 2006 (prelim. 2004), Figs. 1–3:
 *  • creases on the 4 vertical box edges and the 4 bottom edges;
 *  • each side panel: centre crease from the top down to S = (d/2, d/2),
 *    two 45° diagonals from S to the side's bottom corners, and a
 *    horizontal crease from S to the back edge (height d/2);
 *  • a horizontal crease across the back panel at height d/2.
 * Vertex types: side S (90,135,90,45), edge E (90,90,90,90),
 * corner (90,90,45,45) — the corners are cone points (Σθ = 270°), so the
 * bag is NOT a developable flat sheet: the reference configuration is the
 * open 3D box and fold angles are measured from it.
 *
 * Theorem 1 of the paper: for a tall bag (H > D/2) the open and the flat
 * states are isolated points of the rigid configuration space.
 * The paper does not tabulate the gusset assignments (flat in the open state).
 * With the box edges Mountain, an exhaustive search over the 2^5 symmetric
 * gusset assignments finds exactly one that passes every vertex test
 * (generalized Kawasaki + Maekawa + crimp): centre V, diagonals V, S–E M,
 * back horizontal V. That is the assignment used here (see tests).
 */
export function shoppingBag(p: ShoppingBagParams): OrigamiModel {
  const { W, D, H } = p;
  const P: Vec3[] = [];
  const add = (v: Vec3) => (P.push(v), P.length - 1);
  const c00 = add([0, 0, 0]), c10 = add([W, 0, 0]), c11 = add([W, D, 0]), c01 = add([0, D, 0]);
  const t00 = add([0, 0, H]), t10 = add([W, 0, H]), t11 = add([W, D, H]), t01 = add([0, D, H]);
  const SR = add([W, D / 2, D / 2]), MR = add([W, D / 2, H]), ER = add([W, D, D / 2]);
  const SL = add([0, D / 2, D / 2]), ML = add([0, D / 2, H]), EL = add([0, D, D / 2]);

  const faces: number[][] = [
    [c00, c10, t10, t00], // 0 front
    [c00, c01, c11, c10], // 1 bottom
    [c11, c01, EL, ER], // 2 back lower
    [ER, EL, t01, t11], // 3 back upper
    [c10, c11, SR], // 4 right bottom triangle
    [c10, SR, MR, t10], // 5 right front part
    [c11, ER, SR], // 6 right back-lower triangle
    [SR, ER, t11, MR], // 7 right back-upper
    [c00, SL, c01], // 8 left bottom triangle
    [c00, t00, ML, SL], // 9 left front part
    [c01, SL, EL], // 10 left back-lower triangle
    [SL, ML, t01, EL], // 11 left back-upper
  ];
  const assign: Record<string, Assignment> = {};
  const set = (a: number, b: number, x: Assignment) => (assign[edgeKey(a, b)] = x);
  // box edges: convex seen from outside -> mountain
  set(c00, t00, 'M'); set(c10, t10, 'M'); set(c11, ER, 'M'); set(ER, t11, 'M'); set(c01, EL, 'M'); set(EL, t01, 'M');
  set(c00, c10, 'M'); set(c10, c11, 'M'); set(c11, c01, 'M'); set(c01, c00, 'M');
  // gusset creases (flat in the open state)
  for (const [S, M_, E, cf, cb] of [[SR, MR, ER, c10, c11], [SL, ML, EL, c00, c01]]) {
    set(S, M_, 'V'); // side centre tucks inward
    set(S, cf, 'V'); set(S, cb, 'V'); // 45° diagonals
    set(S, E, 'M');
  }
  set(EL, ER, 'V'); // back horizontal at d/2

  // 2D net (schematic): unrolled tube front | right | back | left, bottom below the front
  const net: Vec2[] = new Array(P.length);
  net[c00] = [0, 0]; net[c10] = [W, 0]; net[t00] = [0, H]; net[t10] = [W, H];
  net[SR] = [W + D / 2, D / 2]; net[MR] = [W + D / 2, H];
  net[c11] = [W + D, 0]; net[ER] = [W + D, D / 2]; net[t11] = [W + D, H];
  net[c01] = [2 * W + D, 0]; net[EL] = [2 * W + D, D / 2]; net[t01] = [2 * W + D, H];
  net[SL] = [2 * W + 1.5 * D, D / 2]; net[ML] = [2 * W + 1.5 * D, H];
  const period = 2 * W + 2 * D;
  const model = buildModel({
    name: `Shopping bag (W=${W}, D=${D}, H=${H})`,
    description: 'Traditional paper bag in its open state (polyhedral reference)',
    generator: 'shoppingBag',
    coords2D: net,
    ref3D: P,
    faces,
    assignment: assign,
    params: { W, D, H, tall: H > D / 2 },
  });
  model.edu.layout2D = {
    periodX: period,
    faceOverrides: {
      1: [[0, 0], [0, -D], [W, -D], [W, 0]],
      8: [[period, 0], [period - D / 2, D / 2], [period - D, 0]],
      9: [[period, 0], [period, H], [period - D / 2, H], [period - D / 2, D / 2]],
    },
  };
  model.edu.baseFace = 1;
  model.edu.highlightVertices = [SR, ER, c10];
  model.edu.groups = { top: [t00, t10, t11, t01, MR, ML], gussetTop: [MR, ML] };
  // Flat state used for display: every crease at ±180° (closure verified at load time)
  const flat: Record<number, number> = {};
  for (const e of model.edges) if (e.faces[1] >= 0) flat[e.id] = e.assignment === 'M' ? -Math.PI : Math.PI;
  model.edu.referenceStates = [{ name: 'Flat (collapsed) state', foldAngles: flat }];
  return model;
}
