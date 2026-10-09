import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import {
  buildBlendObject,
  computeSceneStats,
  sceneTree,
  fitCameraParams,
  savedCameraView,
  disposeObject,
  DEFAULT_VIEW_DIR,
} from './model3d-scene.lib';
import type { BlendSceneData } from './blend-scene.lib';

function boxMesh(name: string, material = new THREE.MeshStandardMaterial()) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  m.name = name;
  return m;
}

describe('computeSceneStats', () => {
  it('counts an indexed box', () => {
    const root = new THREE.Group();
    root.add(boxMesh('Box'));
    const s = computeSceneStats(root);
    expect(s).toMatchObject({ meshes: 1, vertices: 24, triangles: 12, materials: 1, textures: 0, animations: 0 });
    expect(s.size.map(v => Number(v.toFixed(3)))).toEqual([1, 1, 1]);
  });

  it('counts non-indexed geometry, shared materials once, textures, lights and clips', () => {
    const shared = new THREE.MeshStandardMaterial({ map: new THREE.Texture() });
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    const root = new THREE.Group();
    root.add(new THREE.Mesh(tri, shared), boxMesh('B', shared), new THREE.PointLight(), new THREE.PerspectiveCamera());
    const s = computeSceneStats(root, [new THREE.AnimationClip('Spin', 1, [])]);
    expect(s).toMatchObject({ meshes: 2, triangles: 13, materials: 1, textures: 1, lights: 1, cameras: 1, animations: 1 });
  });
});

describe('sceneTree', () => {
  it('mirrors names and nesting, naming unnamed nodes by type', () => {
    const root = new THREE.Group();
    const parent = new THREE.Group();
    parent.name = 'Car';
    parent.add(boxMesh('Wheel'), new THREE.Object3D());
    root.add(parent);
    const tree = sceneTree(root);
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe('Car');
    expect(tree[0].children.map(c => [c.name, c.type])).toEqual([['Wheel', 'Mesh'], ['Object3D', 'Object3D']]);
  });
});

describe('fitCameraParams', () => {
  const unitBox = () => new THREE.Box3(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5));

  /** Largest |NDC| coordinate of the box corners seen from the fitted camera. */
  function maxNdc(box: THREE.Box3, fov: number, aspect: number) {
    const p = fitCameraParams(box, fov, aspect);
    const cam = new THREE.PerspectiveCamera(fov, aspect, p.near, p.far);
    cam.position.copy(p.center).addScaledVector(p.direction, p.distance);
    cam.lookAt(p.center);
    cam.updateMatrixWorld();
    let max = 0;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const v = new THREE.Vector3(x, y, z).project(cam);
      max = Math.max(max, Math.abs(v.x), Math.abs(v.y));
    }
    return max;
  }

  it.each([
    ['landscape', 16 / 9],
    ['square', 1],
    ['phone portrait', 0.46],
  ])('frames a box tightly (%s)', (_label, aspect) => {
    const m = maxNdc(unitBox(), 45, aspect);
    expect(m).toBeLessThanOrEqual(1);
    expect(m).toBeGreaterThan(0.85);
  });

  it('frames flat, wide scenes tightly too', () => {
    const slab = new THREE.Box3(new THREE.Vector3(-30, 0, -30), new THREE.Vector3(30, 2, 30));
    const m = maxNdc(slab, 45, 4 / 3);
    expect(m).toBeLessThanOrEqual(1);
    expect(m).toBeGreaterThan(0.85);
  });

  it('keeps sane clip planes and the default view direction', () => {
    const p = fitCameraParams(unitBox(), 45, 16 / 9);
    expect(p.center.toArray()).toEqual([0, 0, 0]);
    expect(p.direction.toArray()).toEqual(DEFAULT_VIEW_DIR.toArray());
    expect(p.near).toBeGreaterThan(0);
    expect(p.far).toBeGreaterThan(p.distance + Math.sqrt(3));
  });

  it('honours a custom view direction', () => {
    const p = fitCameraParams(unitBox(), 45, 1, new THREE.Vector3(0, 0, 5));
    expect(p.direction.toArray()).toEqual([0, 0, 1]);
    // Straight on, the front face sits 0.5 in front of the centre.
    expect(p.distance).toBeCloseTo((0.5 / Math.tan((22.5 * Math.PI) / 180) + 0.5) * 1.05, 5);
  });

  it('handles an empty box', () => {
    const p = fitCameraParams(new THREE.Box3(), 45, 1);
    expect(Number.isFinite(p.distance)).toBe(true);
    expect(p.distance).toBeGreaterThan(0);
  });
});

describe('savedCameraView', () => {
  // Blender camera at (0, -10, 0) rotated +90° about X, so it looks down +Y (Z-up).
  const lookAlongY = [1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, -10, 0, 1];
  const base = (overrides: Partial<BlendSceneData> = {}): BlendSceneData => ({
    version: 5.01,
    meshes: new Map(),
    objects: [{ name: 'CamObj', kind: 'camera', dataName: 'Cam', matrix: lookAlongY }],
    materials: new Map(),
    lights: new Map(),
    cameras: new Map([['Cam', {
      fov: 39.6, near: 0.1, far: 100, ortho: false, lens: 50, sensorWidth: 36, sensorHeight: 24, sensorFit: 'auto',
    }]]),
    activeCamera: 'CamObj',
    renderAspect: 1920 / 1080,
    skipped: [],
    ...overrides,
  });

  it('converts the active camera to three.js (Y-up) space', () => {
    const v = savedCameraView(base(), 1920 / 1080)!;
    expect(v.position.x).toBeCloseTo(0);
    expect(v.position.y).toBeCloseTo(0);
    expect(v.position.z).toBeCloseTo(10);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(v.quaternion);
    expect(forward.z).toBeCloseTo(-1);
    expect(v).toMatchObject({ near: 0.1, far: 100 });
  });

  it('keeps the render frame visible on a portrait screen', () => {
    const wide = savedCameraView(base(), 1920 / 1080)!;
    const phone = savedCameraView(base(), 0.5)!;
    const height = 36 / (1920 / 1080);
    expect(wide.fov).toBeCloseTo((2 * Math.atan(height / 100) * 180) / Math.PI);
    expect(phone.fov).toBeCloseTo((2 * Math.atan((height * (1920 / 1080) / 0.5) / 100) * 180) / Math.PI);
    expect(phone.fov).toBeGreaterThan(wide.fov);
  });

  it('returns null without a usable active camera', () => {
    expect(savedCameraView(base({ activeCamera: undefined }), 1)).toBeNull();
    expect(savedCameraView(base({ activeCamera: 'Missing' }), 1)).toBeNull();
    const ortho = base();
    ortho.cameras.get('Cam')!.ortho = true;
    expect(savedCameraView(ortho, 1)).toBeNull();
  });
});

describe('disposeObject', () => {
  it('disposes geometries, materials (arrays too) and textures', () => {
    const map = new THREE.Texture();
    const mat = new THREE.MeshStandardMaterial({ map });
    const mat2 = new THREE.MeshBasicMaterial();
    const geo = new THREE.BoxGeometry();
    const root = new THREE.Group();
    root.add(new THREE.Mesh(geo, [mat, mat2]));
    const spies = [vi.spyOn(geo, 'dispose'), vi.spyOn(mat, 'dispose'), vi.spyOn(mat2, 'dispose'), vi.spyOn(map, 'dispose')];
    disposeObject(root);
    for (const s of spies) expect(s).toHaveBeenCalledOnce();
  });
});

describe('buildBlendObject', () => {
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const data: BlendSceneData = {
    version: 5.01,
    meshes: new Map([[
      'Tri',
      {
        materialSlots: ['Red'],
        parts: [{
          materialIndex: 0,
          positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
          indices: new Uint32Array([0, 1, 2]),
        }],
      },
    ]]),
    objects: [
      { name: 'TriObj', kind: 'mesh', dataName: 'Tri', matrix: identity },
      { name: 'Lamp', kind: 'light', dataName: 'Lamp', parentName: 'TriObj', matrix: identity },
      { name: 'Cam', kind: 'camera', dataName: 'Cam', matrix: identity },
    ],
    materials: new Map([['Red', { color: [1, 0, 0], opacity: 1, metalness: 0, roughness: 0.5, emissive: [0, 0, 0] }]]),
    lights: new Map([['Lamp', { type: 'point', color: [1, 1, 1], intensity: 10 }]]),
    cameras: new Map([['Cam', { fov: 40, near: 0.1, far: 100, ortho: false, lens: 50, sensorWidth: 36, sensorHeight: 24, sensorFit: 'auto' }]]),
    renderAspect: 16 / 9,
    skipped: [],
  };

  it('builds meshes, lights and cameras under a Z-up → Y-up root', () => {
    const root = buildBlendObject(data);
    expect(root.rotation.x).toBeCloseTo(-Math.PI / 2);

    const stats = computeSceneStats(root);
    expect(stats).toMatchObject({ meshes: 1, triangles: 1, materials: 1, lights: 1, cameras: 1 });

    const mesh = root.getObjectByProperty('type', 'Mesh') as THREE.Mesh;
    expect((mesh.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0xff0000);
    // World matrices are absolute, so children are flattened under the root.
    expect(root.getObjectByName('Lamp')?.parent).toBe(root);
    expect(root.getObjectByName('Cam')).toBeInstanceOf(THREE.PerspectiveCamera);
  });

  it('falls back to a grey material for missing slots', () => {
    const root = buildBlendObject({ ...data, materials: new Map() });
    const mesh = root.getObjectByProperty('type', 'Mesh') as THREE.Mesh;
    expect((mesh.material as THREE.MeshStandardMaterial).color.getHexString()).not.toBe('ff0000');
  });
});
