/**
 * 3D Model Viewer — scene helpers on top of three.js. These only use three's
 * scene-graph classes (no WebGL), so they run and are tested in jsdom: build a
 * three Group from .blend scene data, compute stats / the object tree for the
 * side panel, frame the camera, and free GPU-side resources on close.
 */
import * as THREE from 'three';
import type { BlendLightData, BlendSceneData } from './blend-scene.lib';

/** Blender is Z-up; three.js is Y-up. */
const Z_UP_TO_Y_UP = -Math.PI / 2;

/** Build a three.js Group from renderer-free .blend scene data. */
export function buildBlendObject(data: BlendSceneData): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Blender scene';
  root.rotation.x = Z_UP_TO_Y_UP;

  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const fallback = new THREE.MeshStandardMaterial({ color: 0xb4b4b4, roughness: 0.6, side: THREE.DoubleSide });
  const materialFor = (name: string | undefined) => {
    if (!name) return fallback;
    let m = materials.get(name);
    if (!m) {
      const d = data.materials.get(name);
      if (!d) return fallback;
      m = new THREE.MeshStandardMaterial({
        name,
        color: new THREE.Color().setRGB(d.color[0], d.color[1], d.color[2], THREE.LinearSRGBColorSpace),
        metalness: d.metalness,
        roughness: d.roughness,
        emissive: new THREE.Color().setRGB(d.emissive[0], d.emissive[1], d.emissive[2], THREE.LinearSRGBColorSpace),
        transparent: d.opacity < 1,
        opacity: d.opacity,
        side: THREE.DoubleSide,
      });
      materials.set(name, m);
    }
    return m;
  };

  for (const obj of data.objects) {
    let node: THREE.Object3D | null = null;

    if (obj.kind === 'mesh' && obj.dataName) {
      const mesh = data.meshes.get(obj.dataName);
      if (!mesh) continue;
      const group = new THREE.Group();
      for (const part of mesh.parts) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(part.positions, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(part.normals, 3));
        geo.setIndex(new THREE.BufferAttribute(part.indices, 1));
        const m = new THREE.Mesh(geo, materialFor(mesh.materialSlots[part.materialIndex]));
        m.name = mesh.parts.length > 1 ? `${obj.name} · ${mesh.materialSlots[part.materialIndex] ?? part.materialIndex}` : obj.name;
        group.add(m);
      }
      node = mesh.parts.length === 1 ? group.children[0] : group;
    } else if (obj.kind === 'light' && obj.dataName) {
      node = buildLight(data.lights.get(obj.dataName));
    } else if (obj.kind === 'camera' && obj.dataName) {
      const c = data.cameras.get(obj.dataName);
      if (c) node = new THREE.PerspectiveCamera(c.fov, 1, c.near, c.far);
    } else if (obj.kind === 'empty') {
      node = new THREE.Object3D();
    }
    if (!node) continue;

    node.name = obj.name;
    // jsblender world matrices already include the parent chain, so every
    // object hangs directly off the root instead of being re-parented.
    node.matrixAutoUpdate = false;
    node.matrix.fromArray(obj.matrix);
    node.matrix.decompose(node.position, node.quaternion, node.scale);
    root.add(node);
  }
  return root;
}

function buildLight(l: BlendLightData | undefined): THREE.Light | null {
  if (!l) return null;
  const color = new THREE.Color().setRGB(l.color[0], l.color[1], l.color[2], THREE.LinearSRGBColorSpace);
  if (l.type === 'sun' || l.type === 'spot') {
    const light = l.type === 'sun'
      ? new THREE.DirectionalLight(color, l.intensity)
      : new THREE.SpotLight(color, l.intensity, 0, l.angle, l.penumbra, 2);
    // Blender lights shine down their local -Z; aim the target there.
    light.target.position.set(0, 0, -1);
    light.add(light.target);
    return light;
  }
  return new THREE.PointLight(color, l.intensity, 0, 2);
}

export interface SceneStats {
  objects: number;
  meshes: number;
  vertices: number;
  triangles: number;
  materials: number;
  textures: number;
  animations: number;
  lights: number;
  cameras: number;
  /** Bounding-box size [x, y, z] in model units. */
  size: [number, number, number];
}

function materialsOf(mesh: THREE.Mesh): THREE.Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

function texturesOf(material: THREE.Material): THREE.Texture[] {
  const out: THREE.Texture[] = [];
  for (const value of Object.values(material)) if (value instanceof THREE.Texture) out.push(value);
  return out;
}

/** Counts for the stats panel. Shared materials/textures are counted once. */
export function computeSceneStats(root: THREE.Object3D, animations: THREE.AnimationClip[] = []): SceneStats {
  let objects = 0, meshes = 0, vertices = 0, triangles = 0, lights = 0, cameras = 0;
  const materials = new Set<string>();
  const textures = new Set<string>();

  root.traverse(o => {
    if (o === root) return;
    objects++;
    if ((o as THREE.Mesh).isMesh) {
      const mesh = o as THREE.Mesh;
      meshes++;
      const geo = mesh.geometry;
      const pos = geo.getAttribute('position');
      vertices += pos ? pos.count : 0;
      triangles += Math.floor((geo.index ? geo.index.count : pos ? pos.count : 0) / 3);
      for (const m of materialsOf(mesh)) {
        materials.add(m.uuid);
        for (const t of texturesOf(m)) textures.add(t.uuid);
      }
    } else if ((o as THREE.Light).isLight) {
      lights++;
    } else if ((o as THREE.Camera).isCamera) {
      cameras++;
    }
  });

  const box = new THREE.Box3().setFromObject(root);
  const size = box.isEmpty() ? new THREE.Vector3() : box.getSize(new THREE.Vector3());
  return {
    objects, meshes, vertices, triangles, lights, cameras,
    materials: materials.size,
    textures: textures.size,
    animations: animations.length,
    size: [size.x, size.y, size.z],
  };
}

export interface SceneNode {
  uuid: string;
  name: string;
  type: string;
  children: SceneNode[];
}

/** Object tree for the side panel (the root itself is omitted). */
export function sceneTree(root: THREE.Object3D, maxDepth = 8): SceneNode[] {
  const walk = (o: THREE.Object3D, depth: number): SceneNode => ({
    uuid: o.uuid,
    name: o.name || o.type,
    type: o.type,
    children: depth >= maxDepth ? [] : o.children.filter(isListed).map(c => walk(c, depth + 1)),
  });
  return root.children.filter(isListed).map(c => walk(c, 1));
}

/** Light targets are implementation detail, not scene content. */
function isListed(o: THREE.Object3D): boolean {
  const parent = o.parent as (THREE.Object3D & { target?: THREE.Object3D }) | null;
  return !(parent && parent.target === o);
}

/** Camera distance + clip planes that frame a bounding box. */
export function fitCameraParams(box: THREE.Box3, fovDeg: number, aspect: number) {
  const center = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
  const radius = box.isEmpty() ? 1 : Math.max(box.getBoundingSphere(new THREE.Sphere()).radius, 1e-3);
  const vFov = (fovDeg * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * Math.max(aspect, 1e-3));
  const distance = (radius / Math.sin(Math.min(vFov, hFov) / 2)) * 1.1;
  return { center, distance, near: Math.max(distance / 1000, 1e-4), far: distance + radius * 100 };
}

/** Free every geometry, material and texture under `root`. */
export function disposeObject(root: THREE.Object3D): void {
  const seen = new Set<string>();
  root.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh && !(o as THREE.Points).isPoints && !(o as THREE.Line).isLine) return;
    if (!seen.has(mesh.geometry.uuid)) {
      seen.add(mesh.geometry.uuid);
      mesh.geometry.dispose();
    }
    for (const m of materialsOf(mesh)) {
      if (seen.has(m.uuid)) continue;
      seen.add(m.uuid);
      for (const t of texturesOf(m)) {
        if (!seen.has(t.uuid)) {
          seen.add(t.uuid);
          t.dispose();
        }
      }
      m.dispose();
    }
  });
}
