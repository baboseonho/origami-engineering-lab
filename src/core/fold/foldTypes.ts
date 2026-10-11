/**
 * Subset of the FOLD file format (Demaine, Demaine, Ku, Lang — FOLD spec 1.x,
 * https://github.com/edemaine/fold/blob/main/doc/spec.md) used by this app.
 * Application-specific data lives under the "oel:" namespace.
 */
export interface FoldFile {
  file_spec?: number;
  file_creator?: string;
  file_classes?: string[];
  frame_title?: string;
  frame_classes?: string[];
  frame_attributes?: string[];
  frame_unit?: string;
  vertices_coords: number[][];
  edges_vertices: [number, number][];
  edges_assignment?: string[];
  /** degrees; FOLD convention: positive = valley, negative = mountain */
  edges_foldAngle?: (number | null)[];
  faces_vertices?: number[][];
  file_frames?: Partial<FoldFile>[];
  'oel:referenceCoords3D'?: number[][];
  'oel:params'?: Record<string, unknown>;
  'oel:creaseLabels'?: Record<string, string>;
  [key: string]: unknown;
}
