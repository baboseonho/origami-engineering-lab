import type { Vec2, Vec3 } from '../geometry/vectors';

/**
 * Edge assignment, FOLD-compatible letters:
 *  M mountain, V valley, F flat / facet-internal (never folds), B boundary, U unassigned.
 */
export type Assignment = 'M' | 'V' | 'F' | 'B' | 'U';

export interface OrigamiVertex {
  id: number;
  /** Crease-pattern (unfolded / net) coordinates used by the 2D view. */
  initialPosition2D: Vec2;
  /**
   * Reference configuration in 3D. For flat sheets this is (x, y, 0) and
   * every reference fold angle is 0. Non-developable assemblies (e.g. the
   * shopping bag) and cylinders use a folded 3D reference instead.
   */
  referencePosition: Vec3;
  mass: number;
  boundary: boolean;
}

export interface OrigamiEdge {
  id: number;
  /** Ordered so that the LEFT face traverses the edge as vertices[0] -> vertices[1]. */
  vertices: [number, number];
  /** [left, right] adjacent face ids; -1 where absent (boundary). */
  faces: [number, number];
  assignment: Assignment;
  restLength: number;
  /** Signed fold angle rho in the reference configuration (radians). */
  referenceFoldAngle: number;
  /** Default target used by the energy solver (radians); e.g. a fully folded value. */
  defaultTarget: number;
  /** Relative stiffness multiplier (1 = nominal). */
  stiffness: number;
}

export interface OrigamiFace {
  id: number;
  /** Counter-clockwise when viewed from the front side (reference normal). */
  vertices: number[];
  /** Fan / ear-clip triangulation (vertex ids). */
  triangles: [number, number, number][];
  /** Reference area. */
  area: number;
  /** Reference unit normal (front side). */
  normal: Vec3;
}

export interface SymmetryLink {
  /** rho_a = ratio * rho_b, imposed as an extra (optional) kinematic constraint */
  a: number;
  b: number;
  ratio: number;
}

export interface Layout2D {
  /** If set, the 2D pattern is periodic in x (unrolled cylinder). */
  periodX?: number;
  /** Per-face override polygons (used for nets of non-developable assemblies). */
  faceOverrides?: Record<number, Vec2[]>;
  /** Per-edge override segments. */
  edgeOverrides?: Record<number, [Vec2, Vec2]>;
}

export interface EducationalMetadata {
  /** Human labels for important creases, e.g. { 4: 'ρ1' } */
  creaseLabels: Record<number, string>;
  symmetryLinks: SymmetryLink[];
  defaultDrive?: { edge: number; angle: number };
  /** Face used as the fixed base facet of the rigid kinematic tree. */
  baseFace?: number;
  layout2D?: Layout2D;
  notes: string[];
  /** Vertices whose sector angles may be inspected in the vertex inspector. */
  highlightVertices?: number[];
  /** Coarse-grained surface (for effective curvature estimates). */
  coarseSurface?: { vertices: number[]; triangles: [number, number, number][] };
  /** Prescribed-path states (labelled as such; never presented as solver output). */
  referenceStates?: { name: string; foldAngles: Record<number, number> }[];
  /** Vertex groups used by experiments (e.g. top / bottom rings of a cylinder). */
  groups?: Record<string, number[]>;
}

export interface OrigamiModel {
  metadata: {
    name: string;
    description: string;
    generator: string;
    units: string;
    /** True if every interior vertex has sector-angle sum 2π in the reference. */
    developable: boolean;
  };
  vertices: OrigamiVertex[];
  edges: OrigamiEdge[];
  faces: OrigamiFace[];
  params: Record<string, number | string | boolean>;
  edu: EducationalMetadata;
  /** Characteristic length (bounding-box diagonal of the reference). */
  scale: number;
}

/** Dynamic configuration state, deliberately separate from the topology. */
export interface Configuration {
  /** Current 3D positions (xyz interleaved). */
  positions: Float64Array;
  /** Current signed fold angle per edge (radians). Boundary edges: 0. */
  foldAngles: Float64Array;
}

export interface ModelDiagnostics {
  N: number;
  M: number;
  NMinus3M: number;
  jacobianRank: number;
  vertexJacobianRank: number;
  estimatedDoF: number;
  rigidResidual: number;
  maxAxialStrain: number;
  maxFacetBending: number;
  collisionCount: number;
  totalEnergy: number;
  conditionNumber: number;
}

export const isCrease = (a: Assignment): boolean => a === 'M' || a === 'V' || a === 'U';
