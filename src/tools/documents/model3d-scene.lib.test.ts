import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import {
  buildBlendObject,
  computeSceneStats,
  sceneTree,
  fitCameraParams,
  disposeObject,
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
  it('places the camera outside a unit box with sane clip planes', () => {
    const box = new THREE.Box3(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5));
    const p = fitCameraParams(box, 45, 16 / 9);
    expect(p.center.toArray()).toEqual([0, 0, 0]);
    expect(p.distance).toBeGreaterThan(Math.sqrt(3) / 2);
    expect(p.near).toBeGreaterThan(0);
    expect(p.far).toBeGreaterThan(p.distance);
  });

  it('handles an empty box', () => {
    const p = fitCameraParams(new THREE.Box3(), 45, 1);
    expect(Number.isFinite(p.distance)).toBe(true);
    expect(p.distance).toBeGreaterThan(0);
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
    cameras: new Map([['Cam', { fov: 40, near: 0.1, far: 100, ortho: false }]]),
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
