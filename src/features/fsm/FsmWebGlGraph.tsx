import type React from 'react';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { FsmState, FsmTransition } from '../../domain/project';
import type { GraphPosition } from '../../domain/canvas';
import { getSubsystemColor } from '../../renderer/core/elkLayout';

interface FsmWebGlGraphProps {
  states: Record<string, FsmState>;
  stateIds: string[];
  transitions: FsmTransition[];
  positions: Record<string, GraphPosition>;
  selectedStateId: string | null;
  onSelectState: (id: string) => void;
  ariaLabel?: string;
}

const SCALE = 0.012;
const DEPTH_SCALE = 0.045;

/**
 * A deliberately small Three.js renderer: it consumes the canonical FSM
 * layout instead of creating a second graph model. X/Y are the normal canvas
 * coordinates; Z is persisted alongside them and controls depth in metres of
 * the virtual presentation space.  Selection remains routed through Zustand.
 */
export function FsmWebGlGraph({ states, stateIds, transitions, positions, selectedStateId, onSelectState, ariaLabel }: FsmWebGlGraphProps): React.ReactElement {
  const hostRef = useRef<HTMLDivElement>(null);
  const meshesRef = useRef(new Map<string, THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>>());
  const requestRenderRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    meshesRef.current.forEach((mesh, id) => {
      mesh.material.emissive.set(id === selectedStateId ? '#1d4ed8' : '#000000');
      mesh.material.emissiveIntensity = id === selectedStateId ? 0.7 : 0;
    });
    requestRenderRef.current();
  }, [selectedStateId]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#07101f');
    scene.fog = new THREE.Fog('#07101f', 80, 360);
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 1400);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.replaceChildren(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    // Continuous 60 FPS rendering is wasteful for a review-only graph.  Render
    // only after a navigation, resize, or selection update instead.
    controls.enableDamping = false;
    controls.enablePan = true;
    controls.minDistance = 12;
    controls.maxDistance = 900;
    controls.target.set(0, 0, 0);

    scene.add(new THREE.HemisphereLight('#c7e4ff', '#101827', 2.4));
    const key = new THREE.DirectionalLight('#ffffff', 2.3);
    key.position.set(30, 60, 80);
    scene.add(key);
    const grid = new THREE.GridHelper(650, 65, '#315476', '#132742');
    grid.rotation.x = Math.PI / 2;
    grid.position.z = -10;
    scene.add(grid);

    const byId = new Map<string, THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>>();
    const pointById = new Map<string, THREE.Vector3>();
    const bounds = new THREE.Box3();
    for (const id of stateIds) {
      const state = states[id];
      if (!state) continue;
      const position = positions[id] ?? { x: 0, y: 0, z: 0 };
      const point = new THREE.Vector3(position.x * SCALE, -position.y * SCALE, (position.z ?? 0) * DEPTH_SCALE);
      pointById.set(id, point);
      bounds.expandByPoint(point);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(2.55, 0.84, 0.42),
        new THREE.MeshStandardMaterial({ color: getSubsystemColor(state.subsystem), roughness: 0.38, metalness: 0.24, emissive: '#000000', emissiveIntensity: 0 })
      );
      mesh.position.copy(point);
      mesh.userData.stateId = id;
      scene.add(mesh);
      byId.set(id, mesh);
      const outline = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: '#dbeafe', transparent: true, opacity: 0.46 }));
      outline.position.copy(point);
      scene.add(outline);
    }

    const edgeMaterial = new THREE.LineBasicMaterial({ color: '#9db7d2', transparent: true, opacity: 0.58 });
    for (const transition of transitions) {
      const from = pointById.get(transition.from);
      const to = pointById.get(transition.to);
      if (!from || !to) continue;
      const points = [from.clone(), to.clone()];
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), edgeMaterial));
      const direction = to.clone().sub(from).normalize();
      const arrow = new THREE.ArrowHelper(direction, to.clone().addScaledVector(direction, -0.2), 0.45, 0xbfd8f5, 0.22, 0.12);
      scene.add(arrow);
    }

    if (!bounds.isEmpty()) {
      const center = bounds.getCenter(new THREE.Vector3());
      const diameter = Math.max(bounds.getSize(new THREE.Vector3()).length(), 30);
      controls.target.copy(center);
      camera.position.set(center.x + diameter * 0.35, center.y - diameter * 0.72, center.z + diameter * 1.05);
      camera.lookAt(center);
      controls.update();
    } else camera.position.set(0, -28, 32);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onClick = (event: MouseEvent): void => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects([...byId.values()], false)[0]?.object;
      const id = hit?.userData.stateId as string | undefined;
      if (id) onSelectState(id);
    };
    renderer.domElement.addEventListener('click', onClick);
    const resize = (): void => {
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    let frame = 0;
    const requestRender = (): void => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        renderer.render(scene, camera);
      });
    };
    requestRenderRef.current = requestRender;
    controls.addEventListener('change', requestRender);
    meshesRef.current = byId;
    byId.forEach((mesh, id) => {
      mesh.material.emissive.set(id === selectedStateId ? '#1d4ed8' : '#000000');
      mesh.material.emissiveIntensity = id === selectedStateId ? 0.7 : 0;
    });
    requestRender();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener('click', onClick);
      controls.removeEventListener('change', requestRender);
      controls.dispose();
      meshesRef.current = new Map();
      requestRenderRef.current = () => undefined;
      byId.forEach((mesh) => { mesh.geometry.dispose(); mesh.material.dispose(); });
      edgeMaterial.dispose();
      renderer.dispose();
    };
  }, [positions, stateIds, states, transitions, onSelectState]);

  return <div ref={hostRef} className="fsm-webgl-graph" role="application" aria-label={ariaLabel} />;
}
