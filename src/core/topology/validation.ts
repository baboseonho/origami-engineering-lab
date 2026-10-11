import { dist } from '../geometry/vectors';
import { TOL } from '../numerics/tolerances';
import type { OrigamiModel } from './types';

export interface ValidationReport {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/** Structural validation of a generated model. */
export function validateModel(model: OrigamiModel): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nV = model.vertices.length;

  const ids = new Set<number>();
  model.vertices.forEach((v, i) => {
    if (v.id !== i) errors.push(`vertex index ${i} has id ${v.id}`);
    if (ids.has(v.id)) errors.push(`duplicate vertex id ${v.id}`);
    ids.add(v.id);
    if (!v.referencePosition.every(Number.isFinite)) errors.push(`vertex ${i} has non-finite position`);
  });

  for (let i = 0; i < nV; i++)
    for (let j = i + 1; j < nV; j++)
      if (dist(model.vertices[i].referencePosition, model.vertices[j].referencePosition) < 1e-9 * model.scale)
        warnings.push(`vertices ${i} and ${j} coincide in the reference configuration`);

  for (const f of model.faces) {
    if (f.vertices.length < 3) errors.push(`face ${f.id} has < 3 vertices`);
    for (const v of f.vertices) if (v < 0 || v >= nV) errors.push(`face ${f.id} references invalid vertex ${v}`);
    if (new Set(f.vertices).size !== f.vertices.length) errors.push(`face ${f.id} repeats a vertex`);
    if (!(f.area > TOL.geometry)) errors.push(`face ${f.id} has zero area`);
    const p0 = model.vertices[f.vertices[0]].referencePosition;
    for (const v of f.vertices) {
      const p = model.vertices[v].referencePosition;
      const d = (p[0] - p0[0]) * f.normal[0] + (p[1] - p0[1]) * f.normal[1] + (p[2] - p0[2]) * f.normal[2];
      if (Math.abs(d) > 1e-7 * model.scale) { errors.push(`face ${f.id} is not planar`); break; }
    }
  }

  for (const e of model.edges) {
    if (!(e.restLength > TOL.geometry)) errors.push(`edge ${e.id} has zero length`);
    const [l, r] = e.faces;
    if (l < 0 || l >= model.faces.length) errors.push(`edge ${e.id} has invalid left face`);
    if (r >= model.faces.length) errors.push(`edge ${e.id} has invalid right face`);
    if ((e.assignment === 'M' || e.assignment === 'V' || e.assignment === 'U') && r < 0)
      errors.push(`crease ${e.id} (${e.assignment}) is not adjacent to two faces`);
    if (e.assignment === 'B' && r >= 0) errors.push(`boundary edge ${e.id} has two faces`);
    if ((e as { inconsistent?: boolean }).inconsistent) errors.push(`faces adjacent to edge ${e.id} have inconsistent orientation`);
    if (l >= 0) {
      const fv = model.faces[l].vertices;
      const i = fv.indexOf(e.vertices[0]);
      if (i < 0 || fv[(i + 1) % fv.length] !== e.vertices[1]) errors.push(`edge ${e.id} left-face orientation mismatch`);
    }
  }

  const used = new Set<number>();
  for (const f of model.faces) for (const v of f.vertices) used.add(v);
  for (let i = 0; i < nV; i++) if (!used.has(i)) warnings.push(`vertex ${i} is not used by any face`);

  return { ok: errors.length === 0, errors, warnings };
}
