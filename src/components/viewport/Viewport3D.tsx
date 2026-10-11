import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import { LabelLayer, LabelProjector, publishLabels, type LabelSpec } from './labels';
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import type { OrigamiModel } from '../../core/topology/types';
import { isCrease } from '../../core/topology/types';
import { fmtDeg } from '../../core/geometry/angles';
import { engine } from '../../state/engine';
import { useModel } from '../../state/modelStore';
import { useSim } from '../../state/simulationStore';
import { useUI } from '../../state/uiStore';
import { beginCreaseDrag, canDriveEdge, foldDirection } from '../../state/creaseDrag';
import { ASSIGN_COLOR } from '../controls/ui';
import { ViewToolbar } from './ViewToolbar';
import { Legend } from './Legend';
import { DrawingFrame } from './DrawingFrame';
import { C } from '../../theme/tokens';

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

const P = (i: number): THREE.Vector3 => new THREE.Vector3(engine.positions[3 * i], engine.positions[3 * i + 1], engine.positions[3 * i + 2]);

/** Bounding sphere of current positions (in model coordinates). */
function currentBounds(): { c: THREE.Vector3; r: number } {
  const n = engine.positions.length / 3;
  if (!n) return { c: new THREE.Vector3(), r: 1 };
  const box = new THREE.Box3();
  for (let i = 0; i < n; i++) box.expandByPoint(P(i));
  const c = box.getCenter(new THREE.Vector3());
  return { c, r: Math.max(box.getSize(new THREE.Vector3()).length() / 2, 0.1) };
}

// model z-up -> world y-up
const MODEL_ROT = new THREE.Euler(-Math.PI / 2, 0, 0);
const toWorld = (v: THREE.Vector3) => v.clone().applyEuler(MODEL_ROT);

function FaceMesh({ model }: { model: OrigamiModel }) {
  const tris = useMemo(() => model.faces.flatMap((f) => f.triangles.map((t) => ({ t, f: f.id }))), [model]);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tris.length * 9), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(tris.length * 9).fill(1), 3));
    return g;
  }, [tris]);
  const last = useRef(-1);
  const selection = useUI((s) => s.selection);
  const hover = useUI((s) => s.hover);
  const overlays = useUI((s) => s.overlays);
  const solverMode = useSim((s) => s.solverMode);
  useFrame(() => {
    if (last.current === engine.version) return;
    last.current = engine.version;
    const pos = geom.getAttribute('position') as THREE.BufferAttribute;
    const col = geom.getAttribute('color') as THREE.BufferAttribute;
    const x = engine.positions;
    if (x.length !== model.vertices.length * 3) return;
    const vs = engine.vertexScalar;
    const showStrain = overlays.strain && solverMode === 'energy' && vs;
    tris.forEach(({ t, f }, k) => {
      const hit = overlays.collisions && engine.triangleHit[k];
      const sel = (selection?.kind === 'face' && selection.id === f) || (hover?.kind === 'face' && hover.id === f);
      for (let j = 0; j < 3; j++) {
        const v = t[j];
        pos.setXYZ(3 * k + j, x[3 * v], x[3 * v + 1], x[3 * v + 2]);
        let r = 1, g = 1, b = 1;
        if (showStrain) {
          const s = Math.min(1, vs![v] / 0.05);
          const c = new THREE.Color().setHSL((1 - s) * 0.62, 0.9, 0.55);
          r = c.r; g = c.g; b = c.b;
        }
        if (hit) { r = 1; g = 0.25; b = 0.3; }
        if (sel) { r *= 0.75; g *= 0.95; b = Math.min(1, b * 1.3); }
        col.setXYZ(3 * k + j, r, g, b);
      }
    });
    pos.needsUpdate = true;
    col.needsUpdate = true;
    geom.computeVertexNormals();
    geom.computeBoundingSphere();
  });
  // force refresh when overlay/selection inputs change
  useEffect(() => { last.current = -1; }, [selection, hover, overlays, solverMode]);
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.faceIndex == null) return;
    const f = tris[e.faceIndex]?.f;
    if (f !== undefined) useUI.getState().setHover({ kind: 'face', id: f });
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 4 || e.faceIndex == null) return;
    const f = tris[e.faceIndex]?.f;
    if (f !== undefined) useUI.getState().select({ kind: 'face', id: f });
  };
  return (
    <group>
      <mesh geometry={geom} onPointerMove={onMove} onPointerOut={() => useUI.getState().setHover(null)} onClick={onClick}>
        <meshStandardMaterial vertexColors color={C.paperFront} side={THREE.FrontSide} roughness={0.9} metalness={0} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
      </mesh>
      <mesh geometry={geom}>
        <meshStandardMaterial vertexColors color={C.paperBack} side={THREE.BackSide} roughness={0.9} metalness={0} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
      </mesh>
    </group>
  );
}

/** Checker's highlighter: a wide translucent yellow stroke under the selected / hovered crease. */
function SelectionHighlighter({ model }: { model: OrigamiModel }) {
  const selection = useUI((s) => s.selection);
  const hover = useUI((s) => s.hover);
  const theoryHover = useUI((s) => s.theoryHover);
  const ref = useRef<THREE.InstancedMesh>(null);
  const ids = useMemo(() => {
    const out: { id: number; strong: boolean }[] = [];
    if (selection?.kind === 'edge') out.push({ id: selection.id, strong: true });
    if (hover?.kind === 'edge' && hover.id !== (selection?.kind === 'edge' ? selection.id : -1)) out.push({ id: hover.id, strong: false });
    if (theoryHover) for (const [k, l] of Object.entries(model.edu.creaseLabels)) if (l === theoryHover) out.push({ id: +k, strong: true });
    return out;
  }, [selection, hover, theoryHover, model]);
  const last = useRef(-1);
  useEffect(() => { last.current = -1; }, [ids]);
  const r = model.scale * 0.009;
  useFrame(() => {
    if (!ref.current || last.current === engine.version) return;
    last.current = engine.version;
    const x = engine.positions;
    if (x.length !== model.vertices.length * 3) return;
    const col = new THREE.Color();
    ids.forEach(({ id, strong }, k) => {
      const e = model.edges[id];
      if (!e) return;
      const a = new THREE.Vector3(x[3 * e.vertices[0]], x[3 * e.vertices[0] + 1], x[3 * e.vertices[0] + 2]);
      const b = new THREE.Vector3(x[3 * e.vertices[1]], x[3 * e.vertices[1] + 1], x[3 * e.vertices[1] + 2]);
      const d = new THREE.Vector3().subVectors(b, a);
      tmpQ.setFromUnitVectors(UP, d.clone().normalize());
      tmpS.set(1, d.length(), 1);
      tmpM.compose(a.clone().addScaledVector(d, 0.5), tmpQ, tmpS);
      ref.current!.setMatrixAt(k, tmpM);
      col.set(strong ? C.markStrong : C.markSoft);
      ref.current!.setColorAt(k, col);
    });
    ref.current.count = ids.length;
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  });
  if (!ids.length) return null;
  return (
    <instancedMesh key={ids.length} ref={ref} args={[undefined, undefined, Math.max(ids.length, 1)]} raycast={() => null} frustumCulled={false} renderOrder={-1}>
      <cylinderGeometry args={[r, r, 1, 10, 1]} />
      <meshBasicMaterial transparent opacity={0.7} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  );
}

/**
 * Press-and-drag on a crease in 3D folds it. The drag direction is the
 * crease's on-screen normal, so "away from the crease, up the screen" folds
 * further whatever the camera angle. The orbit camera is held while folding.
 */
function useCreaseGrab() {
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;
  const size = useThree((s) => s.size);
  return (ev: ThreeEvent<PointerEvent>, edge: number) => {
    if (ev.nativeEvent.button !== 0 || !canDriveEdge(edge) || !engine.model) return false;
    const e = engine.model.edges[edge];
    const toPx = (v: number): [number, number] => {
      const w = ev.object.localToWorld(P(v)).project(ev.camera);
      return [((w.x + 1) / 2) * size.width, ((1 - w.y) / 2) * size.height];
    };
    const dir = foldDirection(toPx(e.vertices[0]), toPx(e.vertices[1]));
    const ok = beginCreaseDrag(edge, ev.nativeEvent.clientX, ev.nativeEvent.clientY, dir, () => { if (controls) controls.enabled = true; });
    if (ok) {
      ev.stopPropagation();
      if (controls) controls.enabled = false;
    }
    return ok;
  };
}

const setCanvasCursor = (ev: ThreeEvent<PointerEvent>, c: string) => {
  const el = ev.nativeEvent.target as HTMLElement | null;
  if (el && el.style) el.style.cursor = c;
};

/** Pen widths in CSS pixels: constant on screen at any zoom, like ink on a drawing. */
const PEN = { crease: 1.4, boundary: 1.6, flat: 0.7, strong: 2.8 } as const;

type PenKey = keyof typeof PEN;

/**
 * Crease lines drawn as screen-space pen strokes (fat lines with a fixed pixel
 * width), in four layers: fold lines, the sheet's boundary, flat facet
 * diagonals, and a heavier stroke for the selected / hovered / driving crease.
 */
function PenLines({ model }: { model: OrigamiModel }) {
  const selection = useUI((s) => s.selection);
  const hover = useUI((s) => s.hover);
  const theoryHover = useUI((s) => s.theoryHover);
  const drive = useSim((s) => s.drive);
  const locked = useSim((s) => s.locked);
  const size = useThree((s) => s.size);
  const layers = useMemo(() => {
    const mk = (k: PenKey) => {
      const m = new LineMaterial({ linewidth: PEN[k], vertexColors: true, worldUnits: false, toneMapped: false });
      const l = new LineSegments2(new LineSegmentsGeometry(), m);
      l.frustumCulled = false;
      l.raycast = () => null;
      l.renderOrder = k === 'strong' ? 2 : 1;
      return l;
    };
    return { crease: mk('crease'), boundary: mk('boundary'), flat: mk('flat'), strong: mk('strong') };
  }, []);
  useEffect(() => () => Object.values(layers).forEach((l) => { l.geometry.dispose(); l.material.dispose(); }), [layers]);
  useEffect(() => { Object.values(layers).forEach((l) => l.material.resolution.set(size.width, size.height)); }, [layers, size]);
  const last = useRef(-1);
  useEffect(() => { last.current = -1; }, [selection, hover, drive, locked, theoryHover, model]);
  useFrame(() => {
    if (last.current === engine.version) return;
    const x = engine.positions;
    if (x.length !== model.vertices.length * 3) return;
    last.current = engine.version;
    const buf: Record<PenKey, { p: number[]; c: number[] }> = { crease: { p: [], c: [] }, boundary: { p: [], c: [] }, flat: { p: [], c: [] }, strong: { p: [], c: [] } };
    const col = new THREE.Color();
    for (const e of model.edges) {
      const isSel = selection?.kind === 'edge' && selection.id === e.id;
      const isHov = hover?.kind === 'edge' && hover.id === e.id;
      const isTheory = theoryHover !== null && model.edu.creaseLabels[e.id] === theoryHover;
      const key: PenKey = isSel || isHov || isTheory || e.id === drive ? 'strong' : e.assignment === 'B' ? 'boundary' : e.assignment === 'F' ? 'flat' : 'crease';
      col.set(locked.includes(e.id) ? C.locked : e.assignment === 'B' ? C.ink : e.assignment === 'F' ? C.rule2 : ASSIGN_COLOR[e.assignment] ?? C.facet);
      if (isHov && !isSel) col.offsetHSL(0, 0, 0.1);
      const [i, j] = e.vertices;
      buf[key].p.push(x[3 * i], x[3 * i + 1], x[3 * i + 2], x[3 * j], x[3 * j + 1], x[3 * j + 2]);
      buf[key].c.push(col.r, col.g, col.b, col.r, col.g, col.b);
    }
    for (const k of Object.keys(buf) as PenKey[]) {
      const l = layers[k];
      l.visible = buf[k].p.length > 0;
      if (!l.visible) continue;
      l.geometry.dispose();
      const g = new LineSegmentsGeometry();
      g.setPositions(buf[k].p);
      g.setColors(buf[k].c);
      l.geometry = g;
    }
  });
  return (
    <group>
      {Object.values(layers).map((l, i) => <primitive key={i} object={l} />)}
    </group>
  );
}

/** Invisible pick tubes around every edge: hover, click to select, press-and-drag to fold. */
function Creases({ model }: { model: OrigamiModel }) {
  const pick = useRef<THREE.InstancedMesh>(null);
  const E = model.edges.length;
  const last = useRef(-1);
  const r0 = model.scale * 0.0045;
  useEffect(() => { last.current = -1; }, [model]);
  useFrame(() => {
    if (last.current === engine.version || !pick.current) return;
    const x = engine.positions;
    if (x.length !== model.vertices.length * 3) return;
    last.current = engine.version;
    for (const e of model.edges) {
      const a = new THREE.Vector3(x[3 * e.vertices[0]], x[3 * e.vertices[0] + 1], x[3 * e.vertices[0] + 2]);
      const b = new THREE.Vector3(x[3 * e.vertices[1]], x[3 * e.vertices[1] + 1], x[3 * e.vertices[1] + 2]);
      const d = tmpV.subVectors(b, a);
      const len = d.length();
      tmpQ.setFromUnitVectors(UP, d.clone().normalize());
      const hit = isCrease(e.assignment) && e.faces[1] >= 0 ? 7 : 3.5;
      tmpS.set(hit, len, hit);
      tmpM.compose(a.clone().addScaledVector(d, 0.5), tmpQ, tmpS);
      pick.current.setMatrixAt(e.id, tmpM);
    }
    pick.current.instanceMatrix.needsUpdate = true;
    pick.current.computeBoundingSphere();
  });
  const geo = useMemo(() => new THREE.CylinderGeometry(r0, r0, 1, 6, 1), [r0]);
  const grab = useCreaseGrab();
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.instanceId !== undefined) {
      useUI.getState().setHover({ kind: 'edge', id: e.instanceId });
      setCanvasCursor(e, canDriveEdge(e.instanceId) ? 'grab' : 'pointer');
    }
  };
  const onDown = (e: ThreeEvent<PointerEvent>) => { if (e.instanceId !== undefined) grab(e, e.instanceId); };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 4) return;
    if (e.instanceId !== undefined) useUI.getState().select({ kind: 'edge', id: e.instanceId });
  };
  return (
    <group>
      <PenLines model={model} />
      <instancedMesh ref={pick} args={[geo, undefined, E]} onPointerMove={onMove} onPointerDown={onDown} onPointerOut={(e) => { useUI.getState().setHover(null); setCanvasCursor(e, ''); }} onClick={onClick} frustumCulled={false}>
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </instancedMesh>
    </group>
  );
}

function Vertices({ model }: { model: OrigamiModel }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const show = useUI((s) => s.overlays.vertices);
  const selection = useUI((s) => s.selection);
  const hl = model.edu.highlightVertices ?? [];
  const ids = useMemo(() => (show ? model.vertices.map((v) => v.id) : hl), [show, model, hl]);
  const last = useRef(-1);
  useEffect(() => { last.current = -1; }, [ids, selection]);
  useFrame(() => {
    if (!ref.current || last.current === engine.version) return;
    last.current = engine.version;
    const col = new THREE.Color();
    ids.forEach((v, k) => {
      tmpM.makeTranslation(engine.positions[3 * v], engine.positions[3 * v + 1], engine.positions[3 * v + 2]);
      ref.current!.setMatrixAt(k, tmpM);
      col.set(selection?.kind === 'vertex' && selection.id === v ? C.mountain : hl.includes(v) ? C.ink : C.ink3);
      ref.current!.setColorAt(k, col);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingSphere();
  });
  if (!ids.length) return null;
  return (
    <instancedMesh
      key={ids.length}
      ref={ref}
      args={[undefined, undefined, ids.length]}
      frustumCulled={false}
      onClick={(e) => { e.stopPropagation(); if (e.delta <= 4 && e.instanceId !== undefined) useUI.getState().select({ kind: 'vertex', id: ids[e.instanceId] }); }}
      onPointerMove={(e) => { e.stopPropagation(); if (e.instanceId !== undefined) useUI.getState().setHover({ kind: 'vertex', id: ids[e.instanceId] }); }}
    >
      <sphereGeometry args={[model.scale * 0.0065, 12, 10]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

/** Re-render React overlays at a modest rate when positions change. */
function useEngineTick(hz = 12) {
  const [, setT] = useState(0);
  const last = useRef(-1);
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 1 / hz) return;
    acc.current = 0;
    if (last.current !== engine.version) { last.current = engine.version; setT((t) => t + 1); }
  });
}

/** World-space anchor of a vertex / edge midpoint (reads live positions every frame). */
const vAnchor = (v: number) => () => (engine.positions.length > 3 * v ? toWorld(P(v)) : null);
const eAnchor = (a: number, b: number) => () => (engine.positions.length > 3 * Math.max(a, b) ? toWorld(P(a).add(P(b)).multiplyScalar(0.5)) : null);

function Labels({ model }: { model: OrigamiModel }) {
  const overlays = useUI((s) => s.overlays);
  const selection = useUI((s) => s.selection);
  const rho = useSim((s) => s.rho);
  useEffect(() => {
    const specs: LabelSpec[] = [];
    const style = 'rounded-[2px] px-1 lbl-greek text-[12px]';
    const nLabels = Object.keys(model.edu.creaseLabels).length;
    if (overlays.foldLabels && nLabels <= 4)
      for (const [k, lab] of Object.entries(model.edu.creaseLabels)) {
        if (selection?.kind === 'edge' && selection.id === +k) continue;
        const e = model.edges[+k];
        specs.push({ id: 'f' + k, text: `${lab} ${fmtDeg(rho[+k] ?? 0, 1)}`, cls: `${style} border border-rule-2 bg-paper/95 text-ink`, at: eAnchor(e.vertices[0], e.vertices[1]) });
      }
    if (overlays.vertexIds && model.vertices.length <= 400)
      model.vertices.forEach((v) => specs.push({ id: 'v' + v.id, text: 'v' + v.id, cls: `${style} text-ink-3`, at: vAnchor(v.id), dx: 8, dy: -8 }));
    if (overlays.edgeIds && model.edges.length <= 500)
      model.edges.forEach((e) => specs.push({ id: 'e' + e.id, text: 'e' + e.id, cls: `${style} text-ink-2`, at: eAnchor(e.vertices[0], e.vertices[1]) }));
    if (selection?.kind === 'edge' && model.edges[selection.id]) {
      const e = model.edges[selection.id];
      const lab = model.edu.creaseLabels[e.id];
      specs.push({ id: 'sel', text: `${lab ? lab + ' · ' : ''}e${e.id} ${e.assignment}  ρ = ${fmtDeg(rho[e.id] ?? 0, 2)}`, cls: 'lbl-greek rounded-[2px] bg-mark/85 px-1.5 py-0.5 text-[13px] font-semibold text-ink', at: eAnchor(e.vertices[0], e.vertices[1]), dx: 64, dy: -104, leader: true });
    }
    publishLabels('main', specs);
  }, [model, overlays, selection, rho]);
  useEffect(() => () => publishLabels('main', []), []);
  return null;
}

function Normals({ model }: { model: OrigamiModel }) {
  useEngineTick(10);
  const show = useUI((s) => s.overlays.normals);
  const selection = useUI((s) => s.selection);
  const faces = useMemo(() => {
    if (show) return model.faces.map((f) => f.id);
    if (selection?.kind === 'edge' && model.edges[selection.id]) return model.edges[selection.id].faces.filter((f) => f >= 0);
    return [];
  }, [show, selection, model]);
  if (!faces.length || engine.positions.length !== model.vertices.length * 3) return null;
  const L = model.scale * 0.08;
  const pts: number[] = [];
  for (const fid of faces) {
    const f = model.faces[fid];
    const c = new THREE.Vector3();
    f.vertices.forEach((v) => c.add(P(v)));
    c.multiplyScalar(1 / f.vertices.length);
    const [a, b, d] = f.triangles[0];
    const n = new THREE.Vector3().subVectors(P(b), P(a)).cross(new THREE.Vector3().subVectors(P(d), P(a))).normalize();
    pts.push(c.x, c.y, c.z, c.x + n.x * L, c.y + n.y * L, c.z + n.z * L);
  }
  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[new Float32Array(pts), 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={C.info} />
    </lineSegments>
  );
}

/** Rotation axis + grab ring around the selected crease. Dragging folds that crease (it becomes the driving crease). */
function CreaseGizmo({ model }: { model: OrigamiModel }) {
  useEngineTick(30);
  const selection = useUI((s) => s.selection);
  const showAxes = useUI((s) => s.overlays.axes);
  const grab = useCreaseGrab();
  if (selection?.kind !== 'edge' || !showAxes || engine.positions.length !== model.vertices.length * 3) return null;
  const e = model.edges[selection.id];
  if (!e) return null;
  const a = P(e.vertices[0]), b = P(e.vertices[1]);
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const mid = a.clone().addScaledVector(d, 0.5);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize());
  const axisPts = new Float32Array([...a.clone().addScaledVector(d, -0.25).toArray(), ...b.clone().addScaledVector(d, 0.25).toArray()]);
  // the ring is offered on any selected fold line; grabbing it makes that crease the driving crease
  const canDrive = isCrease(e.assignment) && e.faces[1] >= 0;
  const ringR = Math.min(len * 0.22, model.scale * 0.08);
  return (
    <group>
      <lineSegments>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[axisPts, 3]} /></bufferGeometry>
        <lineDashedMaterial color={C.markInk} dashSize={model.scale * 0.01} gapSize={model.scale * 0.008} />
      </lineSegments>
      {canDrive && (
        <mesh
          position={mid}
          quaternion={q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2))}
          onPointerDown={(ev) => grab(ev, e.id)}
          onPointerMove={(ev) => { ev.stopPropagation(); setCanvasCursor(ev, 'grab'); }}
          onPointerOut={(ev) => setCanvasCursor(ev, '')}
        >
          <torusGeometry args={[ringR, ringR * 0.12, 8, 40]} />
          <meshBasicMaterial color={C.markDeep} transparent opacity={0.9} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

/** Auxetic demonstration: arrows from measured dW/dρ and dL/dρ (folding further). */
function AuxeticArrows({ model }: { model: OrigamiModel }) {
  useEngineTick(10);
  const aux = useUI((s) => s.auxetic);
  if (!aux || engine.positions.length !== model.vertices.length * 3) return null;
  const { c } = currentBounds();
  const items: ReactElement[] = [];
  const mk = (axis: [number, number, number], sign: number, color: string, key: string) => {
    const v = new THREE.Vector3(...axis);
    const half = v.length() / 2;
    const u = v.clone().normalize();
    const len = model.scale * 0.18;
    for (const s of [1, -1]) {
      const origin = c.clone().addScaledVector(u, s * (half + (sign < 0 ? len * 1.1 : 0.05 * len)));
      const dir = u.clone().multiplyScalar(s * (sign < 0 ? -1 : 1));
      items.push(<primitive key={key + s} object={new THREE.ArrowHelper(dir, origin, len, color, len * 0.35, len * 0.2)} />);
    }
  };
  mk(aux.axisW, aux.signW, C.info, 'w');
  mk(aux.axisL, aux.signL, C.warn, 'l');
  return <group>{items}</group>;
}

/** Theory → Derivation: face normals n1, n2 at the labelled vertex (cos ρ = n1·n2). */
function DerivationOverlay({ model }: { model: OrigamiModel }) {
  useEngineTick(10);
  const show = useUI((s) => s.showDerivation);
  if (!show || engine.positions.length !== model.vertices.length * 3) return null;
  const v = model.edu.highlightVertices?.[0];
  if (v === undefined) return null;
  const items: ReactElement[] = [];
  const L = model.scale * 0.12;
  const pv = P(v);
  Object.entries(model.edu.creaseLabels).forEach(([k, lab]) => {
    const e = model.edges[+k];
    const o = e.vertices[0] === v ? e.vertices[1] : e.vertices[0];
    const dir = P(o).sub(pv);
    items.push(<primitive key={'c' + k} object={new THREE.ArrowHelper(dir.clone().normalize(), pv, dir.length() * 0.9, C.markInk, L * 0.2, L * 0.1)} />);
    if (lab === 'ρ2') {
      e.faces.forEach((fid, i) => {
        if (fid < 0) return;
        const f = model.faces[fid];
        const cen = new THREE.Vector3();
        f.vertices.forEach((q) => cen.add(P(q)));
        cen.multiplyScalar(1 / f.vertices.length);
        const [a, b, d] = f.triangles[0];
        const n = new THREE.Vector3().subVectors(P(b), P(a)).cross(new THREE.Vector3().subVectors(P(d), P(a))).normalize();
        items.push(<primitive key={'n' + fid} object={new THREE.ArrowHelper(n, cen, L, i === 0 ? C.info : C.locked, L * 0.3, L * 0.15)} />);
      });
    }
  });
  return <group>{items}</group>;
}

function CameraRig({ model }: { model: OrigamiModel | null }) {
  const camType = useUI((s) => s.camera);
  const req = useUI((s) => s.viewRequest);
  const { camera, controls } = useThree() as unknown as { camera: THREE.Camera & { zoom: number; updateProjectionMatrix: () => void }; controls: { target: THREE.Vector3; update: () => void } | null };
  useEffect(() => {
    if (!model) return;
    const { c, r } = currentBounds();
    const cw = toWorld(c);
    const persp = camera as unknown as THREE.PerspectiveCamera;
    const half = persp.isPerspectiveCamera ? Math.min((persp.fov * Math.PI) / 360, Math.atan(Math.tan((persp.fov * Math.PI) / 360) * persp.aspect)) : 0.35;
    const dist = (r / Math.sin(half)) * 1.08;
    const dirs: Record<string, THREE.Vector3> = {
      fit: new THREE.Vector3(0.9, 0.75, 1.1),
      reset: new THREE.Vector3(0.9, 0.75, 1.1),
      iso: new THREE.Vector3(1, 1, 1),
      top: new THREE.Vector3(0, 1, 0.0001),
      front: new THREE.Vector3(0, 0, 1),
      side: new THREE.Vector3(1, 0, 0),
    };
    const dir = (dirs[req.preset] ?? dirs.fit).clone().normalize();
    camera.position.copy(cw.clone().addScaledVector(dir, dist));
    if ((camera as unknown as THREE.OrthographicCamera).isOrthographicCamera) {
      (camera as unknown as THREE.OrthographicCamera).zoom = 220 / r;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(cw);
    if (controls) { controls.target.copy(cw); controls.update(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req.n, camType, model, controls]);
  return null;
}

export function Viewport3D() {
  const model = useModel((s) => s.model);
  const camType = useUI((s) => s.camera);
  const shownState = useSim((s) => s.shownState);
  const experiment = useSim((s) => s.experiment);
  const playing = useSim((s) => s.playing);
  const solverMode = useSim((s) => s.solverMode);
  return (
    <div className="relative h-full w-full" onPointerLeave={() => useUI.getState().setHover(null)}>
      <DrawingFrame title="3D 모델" grid={false} status={solverMode === 'rigid' ? 'Rigid 강체 기구학' : `Energy 에너지법${playing ? ' · 계산 중' : ''}`} statusTone={solverMode === 'rigid' ? 'info' : 'ok'}>
      <Canvas dpr={[1, 2]} onPointerMissed={() => useUI.getState().select(null)} gl={{ antialias: true, alpha: true }}>
        {camType === 'perspective' ? <PerspectiveCamera makeDefault fov={40} near={0.01} far={500} position={[3, 3, 3]} /> : <OrthographicCamera makeDefault near={-500} far={500} position={[3, 3, 3]} zoom={80} />}
        <OrbitControls makeDefault enableDamping dampingFactor={0.12} />
        <hemisphereLight args={[C.paperFront, C.board, 0.9]} />
        <directionalLight position={[3, 6, 4]} intensity={1.15} />
        <directionalLight position={[-4, -2, -3]} intensity={0.3} />
        <CameraRig model={model} />
        <LabelProjector />
        {model && (
          <group rotation={MODEL_ROT} key={useModel.getState().modelVersion}>
            <FaceMesh model={model} />
            <Creases model={model} />
            <SelectionHighlighter model={model} />
            <Vertices model={model} />
            <Normals model={model} />
            <CreaseGizmo model={model} />
            <Labels model={model} />
            <AuxeticArrows model={model} />
            <DerivationOverlay model={model} />
          </group>
        )}
        <gridHelper args={[20, 40, C.nonphoto, C.nonphotoSoft]} position={[0, -0.001, 0]} />
      </Canvas>
      <LabelLayer />
      <ViewToolbar />
      <Legend />
      <div className="pointer-events-none absolute right-[15px] top-[56px] flex max-w-[60%] flex-col items-end gap-1">
        {shownState && <span className="max-w-[320px] rounded-[3px] border border-rule-2 bg-paper/95 px-2 py-1 text-[12px] text-ink-2">구성된 상태 표시: {shownState} — 정확한 강체 배치이며 솔버 경로가 아님</span>}
        {experiment && <span className="rounded-[3px] border border-warn/40 bg-warn-soft px-2 py-1 text-[12px] text-warn">실험 프레임 u = {experiment.samples[experiment.index]?.u.toFixed(3) ?? '—'} (에너지 최소화 결과)</span>}
      </div>
      {!model && <div className="absolute inset-0 grid place-items-center text-ink-3">이 레슨에는 3D 모델이 없다</div>}
      </DrawingFrame>
    </div>
  );
}
