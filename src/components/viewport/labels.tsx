import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Sym } from '../controls/sym';

/**
 * Screen-space labels for the 3D view without per-label React roots.
 * Components inside the Canvas publish label specs; a projector writes
 * screen positions directly into the overlay's DOM/SVG nodes every frame.
 * The labels are HTML (not canvas sprites), so they share the HTML <Sym>
 * typesetting of the rest of the app. `leader` labels are drafting leader notes: a dot terminator on the anchor,
 * a leader line, and the note on a short horizontal shoulder.
 */
export interface LabelSpec {
  id: string;
  /** plain text; indexed symbols ("ρ1") are set with a real subscript */
  text: string;
  cls: string;
  /** anchor in WORLD coordinates (already rotated) */
  at: () => THREE.Vector3 | null;
  dx?: number;
  dy?: number;
  leader?: boolean;
}

type Listener = () => void;
const groups = new Map<string, LabelSpec[]>();
const listeners = new Set<Listener>();
const nodes = new Map<string, HTMLDivElement>();
const leaders = new Map<string, SVGGElement>();

export function publishLabels(group: string, specs: LabelSpec[]) {
  groups.set(group, specs);
  listeners.forEach((l) => l());
}

function allSpecs(): LabelSpec[] {
  return [...groups.values()].flat();
}

const SHOULDER = 14;

/** Inside <Canvas>: project anchors each frame. */
export function LabelProjector() {
  const { camera, size } = useThree();
  const v = useRef(new THREE.Vector3());
  useFrame(() => {
    for (const s of allSpecs()) {
      const el = nodes.get(s.id);
      if (!el) continue;
      const g = leaders.get(s.id);
      const p = s.at();
      const hide = () => { el.style.display = 'none'; if (g) g.style.display = 'none'; };
      if (!p) { hide(); continue; }
      v.current.copy(p).project(camera);
      if (v.current.z > 1 || v.current.z < -1) { hide(); continue; }
      const ax = (v.current.x * 0.5 + 0.5) * size.width;
      const ay = (-v.current.y * 0.5 + 0.5) * size.height;
      // leader notes flip to the side with room so they never run off the view
      const flip = s.leader && ax + Math.abs(s.dx ?? 0) + SHOULDER + 8 + el.offsetWidth > size.width - 12 ? -1 : 1;
      const x = ax + flip * (s.dx ?? 0);
      const y = ay + (s.dy ?? 0);
      el.style.display = 'block';
      if (s.leader && g) {
        const dir = flip * ((s.dx ?? 0) >= 0 ? 1 : -1);
        g.style.display = 'inline';
        const [line, shoulder, dot] = Array.from(g.children) as SVGElement[];
        line.setAttribute('x1', ax.toFixed(1)); line.setAttribute('y1', ay.toFixed(1));
        line.setAttribute('x2', x.toFixed(1)); line.setAttribute('y2', y.toFixed(1));
        shoulder.setAttribute('x1', x.toFixed(1)); shoulder.setAttribute('y1', y.toFixed(1));
        shoulder.setAttribute('x2', (x + dir * SHOULDER).toFixed(1)); shoulder.setAttribute('y2', y.toFixed(1));
        dot.setAttribute('cx', ax.toFixed(1)); dot.setAttribute('cy', ay.toFixed(1));
        const w = el.offsetWidth;
        let left = dir > 0 ? x + SHOULDER + 3 : x - SHOULDER - 3 - w;
        left = Math.max(12, Math.min(size.width - 12 - w, left));
        const top = Math.max(12, Math.min(size.height - 30, y));
        el.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px) translate(0, -50%)`;
      } else {
        el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
      }
    }
  });
  return null;
}

/** Outside <Canvas>, absolutely positioned over it. */
export function LabelLayer() {
  const [, setN] = useState(0);
  useEffect(() => {
    const l = () => setN((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  const specs = allSpecs();
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        {specs.filter((s) => s.leader).map((s) => (
          <g key={s.id} ref={(el) => { if (el) leaders.set(s.id, el); else leaders.delete(s.id); }} style={{ display: 'none' }}>
            <line stroke="var(--color-ink)" strokeWidth={1} />
            <line stroke="var(--color-ink)" strokeWidth={1} />
            <circle r={2.6} fill="var(--color-ink)" />
          </g>
        ))}
      </svg>
      {specs.map((s) => (
        <div key={s.id} ref={(el) => { if (el) nodes.set(s.id, el); else nodes.delete(s.id); }} className={`absolute left-0 top-0 whitespace-nowrap ${s.cls}`} style={{ display: 'none' }}>
          <Sym text={s.text} />
        </div>
      ))}
    </div>
  );
}
