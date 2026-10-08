import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';

const gltf = vi.hoisted(() => ({ requested: [] as string[] }));
vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    constructor(private manager: THREE.LoadingManager) {}
    setDRACOLoader() { return this; }
    setMeshoptDecoder() { return this; }
    parse(_data: ArrayBuffer, path: string, onLoad: (g: unknown) => void) {
      // A real .gltf asks the manager for its external buffer + texture.
      gltf.requested.push(this.manager.resolveURL(path + 'scene.bin'));
      gltf.requested.push(this.manager.resolveURL(path + 'textures/Wood.PNG'));
      gltf.requested.push(this.manager.resolveURL('data:application/octet-stream;base64,AAAA'));
      const scene = new THREE.Group();
      scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
      onLoad({ scene, animations: [new THREE.AnimationClip('Spin', 1, [])] });
    }
  },
}));
vi.mock('three/examples/jsm/loaders/DRACOLoader.js', () => ({
  DRACOLoader: class { setDecoderPath() { return this; } dispose() {} },
}));

import { parseModelBuffer, loadModel } from './model3d-load.lib';
import { computeSceneStats } from './model3d-scene.lib';

const enc = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;

const ASCII_STL = `solid tri
 facet normal 0 0 1
  outer loop
   vertex 0 0 0
   vertex 1 0 0
   vertex 0 1 0
  endloop
 endfacet
 facet normal 0 0 1
  outer loop
   vertex 1 0 0
   vertex 1 1 0
   vertex 0 1 0
  endloop
 endfacet
endsolid tri
`;

function binaryStl(triangles: number[][]): ArrayBuffer {
  const buf = new ArrayBuffer(84 + 50 * triangles.length);
  const dv = new DataView(buf);
  dv.setUint32(80, triangles.length, true);
  triangles.forEach((tri, i) => {
    const o = 84 + i * 50;
    tri.forEach((v, k) => dv.setFloat32(o + 12 + k * 4, v, true));
  });
  return buf;
}

const triangles = (root: THREE.Object3D) => computeSceneStats(root).triangles;

describe('parseModelBuffer', () => {
  it('parses an ASCII STL', async () => {
    expect(triangles(await parseModelBuffer(enc(ASCII_STL), 'stl'))).toBe(2);
  });

  it('parses a binary STL', async () => {
    const buf = binaryStl([[0, 0, 0, 1, 0, 0, 0, 1, 0], [1, 0, 0, 1, 1, 0, 0, 1, 0], [0, 0, 1, 1, 0, 1, 0, 1, 1]]);
    expect(triangles(await parseModelBuffer(buf, 'stl'))).toBe(3);
  });

  it('parses an OBJ quad into two triangles', async () => {
    const obj = 'o Quad\nv 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nf 1 2 3 4\n';
    const root = await parseModelBuffer(enc(obj), 'obj');
    expect(triangles(root)).toBe(2);
    expect(root.getObjectByName('Quad')).toBeTruthy();
  });

  it('parses an ASCII PLY with vertex colours', async () => {
    const ply = [
      'ply', 'format ascii 1.0', 'element vertex 3',
      'property float x', 'property float y', 'property float z',
      'property uchar red', 'property uchar green', 'property uchar blue',
      'element face 1', 'property list uchar int vertex_indices', 'end_header',
      '0 0 0 255 0 0', '1 0 0 0 255 0', '0 1 0 0 0 255', '3 0 1 2', '',
    ].join('\n');
    const root = await parseModelBuffer(enc(ply), 'ply');
    expect(triangles(root)).toBe(1);
    const mesh = root.getObjectByProperty('type', 'Mesh') as THREE.Mesh;
    expect((mesh.material as THREE.MeshStandardMaterial).vertexColors).toBe(true);
    expect(mesh.geometry.getAttribute('normal')).toBeTruthy();
  });
});

describe('loadModel (glTF with sidecars)', () => {
  let created: string[];
  let revoked: string[];

  beforeEach(() => {
    gltf.requested = [];
    created = [];
    revoked = [];
    let n = 0;
    URL.createObjectURL = vi.fn(() => {
      const u = `blob:test/${n++}`;
      created.push(u);
      return u;
    });
    URL.revokeObjectURL = vi.fn((u: string) => { revoked.push(u); });
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('maps requested files to dropped sidecars and revokes the object URLs', async () => {
    const sidecars = new Map<string, Blob>([
      ['scene.bin', new Blob(['bin'])],
      ['wood.png', new Blob(['png'])],
    ]);
    const model = await loadModel({ name: 'scene.gltf', format: 'gltf', buffer: enc('{}'), sidecars });

    expect(gltf.requested.slice(0, 2)).toEqual(created);
    expect(gltf.requested[2]).toMatch(/^data:/);
    expect(revoked.sort()).toEqual([...created].sort());
    expect(model.format).toBe('gltf');
    expect(model.animations.map(a => a.name)).toEqual(['Spin']);
    expect(triangles(model.root)).toBe(12);
  });

  it('resolves external files against the source URL when opened from a link', async () => {
    await loadModel({
      name: 'scene.gltf', format: 'gltf', buffer: enc('{}'), sidecars: new Map(),
      baseUrl: 'https://example.com/models/scene.gltf',
    });
    expect(gltf.requested[0]).toBe('https://example.com/models/scene.bin');
    expect(created).toEqual([]);
  });
});
