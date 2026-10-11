/**
 * Layer order of stacked facets, for drawing flat-folded states.
 *
 * When a pattern folds flat, overlapping facets end up in the same plane and
 * the renderer cannot tell which one is on top (z-fighting). Paper cannot pass
 * through itself, so the order of two overlapping layers is the order they had
 * just before they met. This tracker follows the fold: for every pair of
 * non-adjacent, nearly parallel triangles that overlap and are still apart, it
 * records which one lies above the other along their common normal. When the
 * pair is in contact, that recorded order is used; pairs never seen apart (a
 * state loaded already flat) fall back to a fixed order, so the picture is
 * stable rather than flickering. Display only: positions are not changed.
 */
type V = [number, number, number];

const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Unit normal turned so that its largest component is positive (a shared direction for parallel facets). */
function canonicalNormal(a: V, b: V, c: V): V {
  const n = cross(sub(b, a), sub(c, a));
  const l = Math.hypot(n[0], n[1], n[2]) || 1;
  let k = 0;
  if (Math.abs(n[1]) > Math.abs(n[k])) k = 1;
  if (Math.abs(n[2]) > Math.abs(n[k])) k = 2;
  const s = n[k] < 0 ? -1 : 1;
  return [(s * n[0]) / l, (s * n[1]) / l, (s * n[2]) / l];
}

/**
 * Do two triangles overlap when projected on the plane with normal `n`?
 * Separating-axis test in 2D; a strip of width `margin` along shared or
 * touching boundaries does not count, so facets that only abut in the same
 * layer are not treated as stacked.
 */
function overlapInPlane(a: V[], b: V[], n: V, margin: number): boolean {
  // in-plane basis
  const ref: V = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = cross(n, ref);
  const ul = Math.hypot(u[0], u[1], u[2]) || 1;
  const e1: V = [u[0] / ul, u[1] / ul, u[2] / ul];
  const e2 = cross(n, e1);
  const P = (t: V[]) => t.map((p) => [dot(p, e1), dot(p, e2)] as [number, number]);
  const A = P(a), B = P(b);
  for (const T of [A, B]) {
    for (let k = 0; k < 3; k++) {
      const p = T[k], q = T[(k + 1) % 3];
      let ax = -(q[1] - p[1]), ay = q[0] - p[0];
      const l = Math.hypot(ax, ay) || 1;
      ax /= l; ay /= l;
      let amin = Infinity, amax = -Infinity, bmin = Infinity, bmax = -Infinity;
      for (const r of A) { const d = r[0] * ax + r[1] * ay; amin = Math.min(amin, d); amax = Math.max(amax, d); }
      for (const r of B) { const d = r[0] * ax + r[1] * ay; bmin = Math.min(bmin, d); bmax = Math.max(bmax, d); }
      if (amax <= bmin + margin || bmax <= amin + margin) return false;
    }
  }
  return true;
}

export class LayerTracker {
  /** pair key "i,j" (i < j) → +1 if j lies above i along the shared normal, −1 if below */
  private above = new Map<string, number>();
  private tris: [number, number, number][] = [];
  /** per-triangle layer level (0 = lowest) in the current state */
  level = new Float32Array(0);
  /** per-triangle canonical normal (xyz), valid when level > 0 */
  normal = new Float32Array(0);
  /** true when some layers are in contact (offsets are needed) */
  stacked = false;
  /** highest layer level in the current state */
  maxLevel = 0;
  /** contact pairs whose order was never observed (state reached without passing through 'apart') */
  unrecorded = 0;
  /** contact pairs of the current state as [lower, upper] */
  contacts: [number, number][] = [];
  /** most sheets of paper stacked over one point (checked at facet centres) */
  sheetsAtPoint = 1;

  reset(tris: [number, number, number][]) {
    this.tris = tris;
    this.above.clear();
    this.level = new Float32Array(tris.length);
    this.normal = new Float32Array(tris.length * 3);
    this.stacked = false;
  }

  /** Update from the current positions. `scale` is the model size. */
  update(x: Float64Array, scale: number) {
    const tris = this.tris, n = tris.length;
    if (!n) return;
    const contact = 2e-3 * scale; // layers closer than this are drawn as a stack
    const watch = 0.08 * scale; // pairs closer than this are about to meet: remember their order
    const P = (i: number): V => [x[3 * i], x[3 * i + 1], x[3 * i + 2]];
    const box = new Float64Array(6 * n);
    const cen: V[] = new Array(n);
    const nrm: V[] = new Array(n);
    for (let t = 0; t < n; t++) {
      const [a, b, c] = tris[t].map(P) as [V, V, V];
      cen[t] = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
      nrm[t] = canonicalNormal(a, b, c);
      for (let k = 0; k < 3; k++) {
        box[6 * t + k] = Math.min(a[k], b[k], c[k]) - watch;
        box[6 * t + 3 + k] = Math.max(a[k], b[k], c[k]) + watch;
      }
    }
    const order = Array.from({ length: n }, (_, i) => i).sort((p, q) => box[6 * p] - box[6 * q]);
    // edges of the "j is above i" relation among pairs in contact
    const up: number[][] = Array.from({ length: n }, () => []);
    // facets in contact covering each facet centre (how many sheets are stacked there)
    const cover = new Uint16Array(n);
    const inside = (p: V, t: V[], nrm: V) => {
      for (let k = 0; k < 3; k++) {
        const a = t[k], b = t[(k + 1) % 3];
        if (dot(cross(sub(b, a), sub(p, a)), nrm) < 0) return false;
      }
      return true;
    };
    let anyContact = false;
    let unrecorded = 0;
    const contacts: [number, number][] = [];
    for (let ii = 0; ii < n; ii++) {
      const i = order[ii];
      for (let jj = ii + 1; jj < n; jj++) {
        const j = order[jj];
        if (box[6 * j] > box[6 * i + 3]) break;
        if (box[6 * j + 1] > box[6 * i + 4] || box[6 * i + 1] > box[6 * j + 4]) continue;
        if (box[6 * j + 2] > box[6 * i + 5] || box[6 * i + 2] > box[6 * j + 5]) continue;
        const A = tris[i], B = tris[j];
        if (A[0] === B[0] || A[0] === B[1] || A[0] === B[2] || A[1] === B[0] || A[1] === B[1] || A[1] === B[2] || A[2] === B[0] || A[2] === B[1] || A[2] === B[2]) continue;
        const na = nrm[i];
        if (Math.abs(dot(na, nrm[j])) < 0.985) continue; // not parallel (within ~10°): not stacking
        const d = dot(sub(cen[j], cen[i]), na);
        if (Math.abs(d) > watch) continue;
        // do they overlap when seen along the normal (not merely abut)?
        if (!overlapInPlane(A.map(P), B.map(P), na, 1e-3 * scale)) continue;
        const lo = Math.min(i, j), hi = Math.max(i, j);
        const key = lo * 1048576 + hi;
        const k = String(key);
        if (Math.abs(d) > contact) {
          // apart: record which one is above (+1: hi above lo)
          this.above.set(k, (d > 0) === (j === hi) ? 1 : -1);
        } else {
          anyContact = true;
          const Ai = A.map(P), Bj = B.map(P);
          const ni = cross(sub(Ai[1], Ai[0]), sub(Ai[2], Ai[0])), nj = cross(sub(Bj[1], Bj[0]), sub(Bj[2], Bj[0]));
          if (inside(cen[i], Bj, nj)) cover[i]++;
          if (inside(cen[j], Ai, ni)) cover[j]++;
          const known = this.above.get(k);
          if (known === undefined) unrecorded++;
          const s = known ?? 1; // never seen apart: fixed fallback order
          if (s > 0) { up[lo].push(hi); contacts.push([lo, hi]); } else { up[hi].push(lo); contacts.push([hi, lo]); }
        }
      }
    }
    this.stacked = anyContact;
    this.unrecorded = unrecorded;
    this.contacts = contacts;
    const level = new Float32Array(n);
    if (anyContact) {
      // Layers = longest path in the "above" relation. Inconsistent records can form cycles
      // (A over B over C over A); a depth-first search drops the edges that close a cycle,
      // then levels are assigned in topological order, so they stay bounded by real stacks.
      const state = new Uint8Array(n); // 0 new, 1 on stack, 2 done
      const topo: number[] = [];
      const dag: number[][] = Array.from({ length: n }, () => []);
      for (let s0 = 0; s0 < n; s0++) {
        if (state[s0] || !up[s0].length) continue;
        const stack: [number, number][] = [[s0, 0]];
        state[s0] = 1;
        while (stack.length) {
          const top = stack[stack.length - 1];
          const [v, k] = top;
          if (k < up[v].length) {
            top[1]++;
            const w = up[v][k];
            if (state[w] === 1) continue; // closes a cycle: drop this edge
            dag[v].push(w);
            if (state[w] === 0) { state[w] = 1; stack.push([w, 0]); }
          } else {
            state[v] = 2;
            topo.push(v);
            stack.pop();
          }
        }
      }
      for (let t = topo.length - 1; t >= 0; t--) {
        const v = topo[t];
        for (const w of dag[v]) if (level[w] < level[v] + 1) level[w] = level[v] + 1;
      }
    }
    this.level = level;
    let mx = 0;
    for (let t = 0; t < n; t++) mx = Math.max(mx, level[t]);
    this.maxLevel = mx;
    let most = 0;
    for (let t = 0; t < n; t++) most = Math.max(most, cover[t]);
    this.sheetsAtPoint = anyContact ? most + 1 : 1;
    for (let t = 0; t < n; t++) { this.normal[3 * t] = nrm[t][0]; this.normal[3 * t + 1] = nrm[t][1]; this.normal[3 * t + 2] = nrm[t][2]; }
  }
}
