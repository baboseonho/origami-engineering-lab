import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { OrigamiModel } from '../../core/topology/types';
import { ASSIGN_COLOR } from '../controls/ui';
import { C } from '../../theme/tokens';

/** Small self-contained 3D view of a model at given positions (used by comparison labs). */
export function MiniView({ model, positions, height = 300 }: { model: OrigamiModel; positions: Float64Array; height?: number | string }) {
  const { faceGeo, lineGeo } = useMemo(() => {
    const tris = model.faces.flatMap((f) => f.triangles);
    const p = new Float32Array(tris.length * 9);
    tris.forEach((t, k) => t.forEach((v, j) => { p[9 * k + 3 * j] = positions[3 * v]; p[9 * k + 3 * j + 1] = positions[3 * v + 1]; p[9 * k + 3 * j + 2] = positions[3 * v + 2]; }));
    const faceGeo = new THREE.BufferGeometry();
    faceGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    faceGeo.computeVertexNormals();
    const lp = new Float32Array(model.edges.length * 6), lc = new Float32Array(model.edges.length * 6);
    model.edges.forEach((e, k) => {
      const c = new THREE.Color(ASSIGN_COLOR[e.assignment]);
      e.vertices.forEach((v, j) => {
        lp[6 * k + 3 * j] = positions[3 * v]; lp[6 * k + 3 * j + 1] = positions[3 * v + 1]; lp[6 * k + 3 * j + 2] = positions[3 * v + 2];
        lc[6 * k + 3 * j] = c.r; lc[6 * k + 3 * j + 1] = c.g; lc[6 * k + 3 * j + 2] = c.b;
      });
    });
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    lineGeo.setAttribute('color', new THREE.BufferAttribute(lc, 3));
    return { faceGeo, lineGeo };
  }, [model, positions]);
  // free GPU buffers of the previous frame
  useEffect(() => () => { faceGeo.dispose(); lineGeo.dispose(); }, [faceGeo, lineGeo]);
  const r = model.scale;
  return (
    <div style={{ height }} className="w-full rounded grid-paper">
      <Canvas camera={{ position: [r * 0.9, r * 0.7, r * 0.9], fov: 40 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 6, 4]} intensity={1} />
        <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -r * 0.25, 0]}>
          <mesh geometry={faceGeo}><meshStandardMaterial color={C.paperFront} side={THREE.DoubleSide} roughness={0.85} polygonOffset polygonOffsetFactor={1} /></mesh>
          <lineSegments geometry={lineGeo}><lineBasicMaterial vertexColors /></lineSegments>
        </group>
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}
