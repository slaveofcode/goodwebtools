/**
 * 3D Model Viewer — load any supported format into a three.js scene. Loaders
 * are dynamic-imported so only the one a file needs is fetched. Files that
 * reference others (glTF .bin/textures, OBJ .mtl/textures) resolve them from
 * the other dropped files through a LoadingManager URL modifier, or relative
 * to the source URL when the model was opened from a link.
 */
import * as THREE from 'three';
import { basename, type ModelFormat } from './model3d-format.lib';
import type { SavedView } from './model3d-scene.lib';

export interface ModelSource {
  name: string;
  format: ModelFormat;
  buffer: ArrayBuffer;
  /** Other dropped files, keyed by lower-cased basename. */
  sidecars: Map<string, Blob>;
  /** When opened from a link: the model URL, for resolving relative references. */
  baseUrl?: string;
}

export interface LoadedModel {
  root: THREE.Object3D;
  animations: THREE.AnimationClip[];
  format: ModelFormat;
  /** Source-app version when known (e.g. "Blender 5.01"). */
  version?: string;
  /** The file's own camera (e.g. a .blend's active camera) for a viewport aspect, if it has one. */
  savedView?: (aspect: number) => SavedView | null;
}

/** Give up waiting for sidecar textures after this long (the model still shows). */
const SIDECAR_WAIT_MS = 30_000;

function standardMaterial(geometry: THREE.BufferGeometry): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: geometry.hasAttribute('color') ? 0xffffff : 0xb4b4b4,
    vertexColors: geometry.hasAttribute('color'),
    roughness: 0.6,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
}

/** Wrap a bare geometry in a Group so the mesh shows up in the stats + tree. */
function geometryScene(geometry: THREE.BufferGeometry, name: string): THREE.Group {
  if (!geometry.hasAttribute('normal')) geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, standardMaterial(geometry));
  mesh.name = name;
  const root = new THREE.Group();
  root.add(mesh);
  return root;
}

/** Parse the self-contained formats (no sidecars needed). */
export async function parseModelBuffer(buffer: ArrayBuffer, format: 'stl' | 'obj' | 'ply', name = 'Model'): Promise<THREE.Object3D> {
  if (format === 'stl') {
    const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
    return geometryScene(new STLLoader().parse(buffer), name);
  }
  if (format === 'ply') {
    const { PLYLoader } = await import('three/examples/jsm/loaders/PLYLoader.js');
    // ASCII PLY goes in as text: PLYLoader branches on `instanceof ArrayBuffer`,
    // which is realm-sensitive (buffers from another realm were read as empty).
    const head = new TextDecoder().decode(new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 256)));
    const data = /format\s+ascii/.test(head) ? new TextDecoder().decode(buffer) : buffer;
    return geometryScene(new PLYLoader().parse(data), name);
  }
  const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
  return new OBJLoader().parse(new TextDecoder().decode(buffer));
}

/**
 * A LoadingManager that serves dropped sidecar files as object URLs. Call
 * `settle()` after parsing: it waits for in-flight sidecar loads (textures),
 * then revokes every object URL it created.
 */
function sidecarManager(sidecars: Map<string, Blob>) {
  const urls = new Map<string, string>();
  let started = false;
  let resolveIdle: () => void = () => {};
  const idle = new Promise<void>(res => { resolveIdle = res; });

  const manager = new THREE.LoadingManager(() => resolveIdle(), undefined, () => {});
  manager.onStart = () => { started = true; };
  manager.setURLModifier(url => {
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    const key = basename(url);
    const file = sidecars.get(key);
    if (!file) return url;
    let objectUrl = urls.get(key);
    if (!objectUrl) {
      objectUrl = URL.createObjectURL(file);
      urls.set(key, objectUrl);
    }
    return objectUrl;
  });

  const settle = async () => {
    if (started) await Promise.race([idle, new Promise(res => setTimeout(res, SIDECAR_WAIT_MS))]);
    for (const u of urls.values()) URL.revokeObjectURL(u);
    urls.clear();
  };
  return { manager, settle };
}

/** Directory part of a URL ("https://x/a/b.gltf" → "https://x/a/"), or ''. */
function resourcePath(baseUrl?: string): string {
  return baseUrl ? baseUrl.slice(0, baseUrl.split(/[?#]/)[0].lastIndexOf('/') + 1) : '';
}

/** Load a model of any supported format. */
export async function loadModel(src: ModelSource): Promise<LoadedModel> {
  const { manager, settle } = sidecarManager(src.sidecars);
  const path = resourcePath(src.baseUrl);
  const stem = src.name.replace(/\.[^.]+$/, '') || 'Model';

  try {
    switch (src.format) {
      case 'glb':
      case 'gltf': {
        const [{ GLTFLoader }, { DRACOLoader }, { MeshoptDecoder }] = await Promise.all([
          import('three/examples/jsm/loaders/GLTFLoader.js'),
          import('three/examples/jsm/loaders/DRACOLoader.js'),
          import('three/examples/jsm/libs/meshopt_decoder.module.js'),
        ]);
        const draco = new DRACOLoader(manager).setDecoderPath('/draco/');
        const loader = new GLTFLoader(manager).setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);
        try {
          const gltf = await new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>((resolve, reject) =>
            loader.parse(src.buffer, path, resolve, reject),
          );
          await settle();
          return { root: gltf.scene, animations: gltf.animations ?? [], format: src.format };
        } finally {
          draco.dispose();
        }
      }

      case 'obj': {
        const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
        const objLoader = new OBJLoader(manager);
        const mtl = [...src.sidecars.entries()].find(([k]) => k.endsWith('.mtl'));
        if (mtl) {
          const { MTLLoader } = await import('three/examples/jsm/loaders/MTLLoader.js');
          const materials = new MTLLoader(manager).parse(await mtl[1].text(), path);
          materials.preload();
          objLoader.setMaterials(materials);
        }
        const root = objLoader.parse(new TextDecoder().decode(src.buffer));
        await settle();
        return { root, animations: [], format: 'obj' };
      }

      case 'fbx': {
        const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
        const root = new FBXLoader(manager).parse(src.buffer, path);
        await settle();
        return { root, animations: root.animations ?? [], format: 'fbx' };
      }

      case 'stl':
      case 'ply': {
        await settle();
        return { root: await parseModelBuffer(src.buffer, src.format, stem), animations: [], format: src.format };
      }

      case 'blend': {
        await settle();
        const [{ blendToSceneData }, { buildBlendObject, savedCameraView }] = await Promise.all([
          import('./blend-scene.lib'),
          import('./model3d-scene.lib'),
        ]);
        const data = await blendToSceneData(new Uint8Array(src.buffer));
        return {
          root: buildBlendObject(data),
          animations: [],
          format: 'blend',
          version: `Blender ${data.version.toFixed(2)}`,
          savedView: aspect => savedCameraView(data, aspect),
        };
      }
    }
  } catch (e) {
    await settle();
    throw e;
  }
}
