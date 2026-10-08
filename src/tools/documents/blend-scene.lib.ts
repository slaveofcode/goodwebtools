/**
 * 3D Model Viewer — Blender (.blend) → renderer-free scene data. Wraps the
 * jsblender parser (Blender 5+) and distils meshes, object transforms, base
 * materials, lights and cameras into plain arrays that model3d-scene.lib turns
 * into three.js objects. Every extractor is guarded: one datablock jsblender
 * can't read is skipped rather than failing the whole file.
 */
import type { Mesh as BlendMesh } from 'jsblender';
import { sniffBlendHeader } from './model3d-format.lib';

export interface BlendMeshPart {
  materialIndex: number;
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}

export type BlendObjectKind = 'mesh' | 'light' | 'camera' | 'empty' | 'other';

export interface BlendSceneObject {
  name: string;
  kind: BlendObjectKind;
  dataName?: string;
  parentName?: string;
  /** Column-major local-to-world matrix (three's Matrix4.fromArray order). */
  matrix: number[];
}

export interface BlendMaterialData {
  color: [number, number, number];
  opacity: number;
  metalness: number;
  roughness: number;
  emissive: [number, number, number];
}

export interface BlendLightData {
  type: 'point' | 'sun' | 'spot' | 'area';
  color: [number, number, number];
  /** three.js intensity (candela for point/spot, lux for sun). */
  intensity: number;
  angle?: number;
  penumbra?: number;
}

export interface BlendCameraData {
  fov: number;
  near: number;
  far: number;
  ortho: boolean;
}

export interface BlendSceneData {
  version: number;
  meshes: Map<string, { parts: BlendMeshPart[]; materialSlots: string[] }>;
  objects: BlendSceneObject[];
  materials: Map<string, BlendMaterialData>;
  lights: Map<string, BlendLightData>;
  cameras: Map<string, BlendCameraData>;
  /** Extractors that threw and were skipped (e.g. 'lights'). */
  skipped: string[];
}

/** Thrown for .blend files older than Blender 5 (version null = gzip, pre-3.0). */
export class BlendVersionError extends Error {
  constructor(public version: number | null) {
    super(version === null ? 'Blender file saved before Blender 3.0' : `Blender file saved in Blender ${version.toFixed(2)}`);
    this.name = 'BlendVersionError';
  }
}

const OB_EMPTY = 0;
const OB_MESH = 1;
const OB_LAMP = 10;
const OB_CAMERA = 11;

type TriangulateInput = Pick<
  BlendMesh,
  'faceCount' | 'faceOffsets' | 'cornerVertices' | 'materialIndices' | 'vertices' | 'vertexNormals'
>;

/**
 * Fan-triangulate a Blender mesh's faces, split into one locally re-indexed
 * part per material slot (so each part can take its own material).
 */
export function triangulateByMaterial(mesh: TriangulateInput): BlendMeshPart[] {
  const byMaterial = new Map<number, { remap: Map<number, number>; src: number[]; tris: number[] }>();

  for (let f = 0; f < mesh.faceCount; f++) {
    const start = mesh.faceOffsets[f];
    const end = mesh.faceOffsets[f + 1];
    if (end - start < 3) continue;

    const mat = mesh.materialIndices[f] ?? 0;
    let bucket = byMaterial.get(mat);
    if (!bucket) {
      bucket = { remap: new Map(), src: [], tris: [] };
      byMaterial.set(mat, bucket);
    }
    const b = bucket;
    const local = (corner: number) => {
      const v = mesh.cornerVertices[corner];
      let i = b.remap.get(v);
      if (i === undefined) {
        i = b.src.length;
        b.remap.set(v, i);
        b.src.push(v);
      }
      return i;
    };

    const first = local(start);
    for (let c = start + 1; c < end - 1; c++) b.tris.push(first, local(c), local(c + 1));
  }

  return [...byMaterial.entries()]
    .sort(([a], [b]) => a - b)
    .map(([materialIndex, { src, tris }]) => {
      const positions = new Float32Array(src.length * 3);
      const normals = new Float32Array(src.length * 3);
      src.forEach((v, i) => {
        for (let k = 0; k < 3; k++) {
          positions[i * 3 + k] = mesh.vertices[v * 3 + k];
          normals[i * 3 + k] = mesh.vertexNormals[v * 3 + k] ?? 0;
        }
      });
      return { materialIndex, positions, normals, indices: new Uint32Array(tris) };
    });
}

function rgb(c: ArrayLike<number> | undefined, fallback: [number, number, number]): [number, number, number] {
  return c && c.length >= 3 ? [c[0], c[1], c[2]] : fallback;
}

function objectKind(type: number): BlendObjectKind {
  switch (type) {
    case OB_MESH: return 'mesh';
    case OB_LAMP: return 'light';
    case OB_CAMERA: return 'camera';
    case OB_EMPTY: return 'empty';
    default: return 'other';
  }
}

/** Parse a .blend (raw, zstd-compressed) into renderer-free scene data. */
export async function blendToSceneData(bytes: Uint8Array): Promise<BlendSceneData> {
  let data = bytes;
  let header = sniffBlendHeader(data);
  if (header.kind === 'gzip') throw new BlendVersionError(null);
  if (header.kind === 'zstd') {
    const { decompress } = await import('fzstd');
    data = decompress(bytes);
    header = sniffBlendHeader(data);
  }
  if (header.kind !== 'blend') throw new Error('Not a Blender file');
  if (header.version < 5) throw new BlendVersionError(header.version);

  const jb = await import('jsblender');
  const blend = jb.parseBlend(data);
  const skipped: string[] = [];
  const safe = <T>(label: string, fn: () => T[]): T[] => {
    try {
      return fn();
    } catch {
      skipped.push(label);
      return [];
    }
  };

  const meshes = new Map<string, { parts: BlendMeshPart[]; materialSlots: string[] }>();
  for (const m of safe('meshes', () => jb.extractMeshes(blend))) {
    try {
      meshes.set(m.name, { parts: triangulateByMaterial(m), materialSlots: m.materialSlotNames ?? [] });
    } catch {
      skipped.push(`mesh:${m.name}`);
    }
  }

  const objects: BlendSceneObject[] = safe('objects', () => jb.extractObjects(blend)).map(o => ({
    name: o.name,
    kind: objectKind(o.type),
    dataName: o.dataName,
    parentName: o.parentName,
    matrix: Array.from(o.worldMatrix),
  }));

  const materials = new Map<string, BlendMaterialData>();
  for (const m of safe('materials', () => jb.extractMaterials(blend))) {
    const p = m.shader?.principled;
    const strength = p?.emissionStrength ?? 0;
    const emission = rgb(p?.emissionColor, [0, 0, 0]);
    materials.set(m.name, {
      color: rgb(p?.baseColor ?? m.diffuse, [0.8, 0.8, 0.8]),
      opacity: p?.alpha ?? m.diffuse?.[3] ?? 1,
      metalness: p?.metallic ?? m.metallic ?? 0,
      roughness: p?.roughness ?? m.roughness ?? 0.5,
      emissive: [emission[0] * strength, emission[1] * strength, emission[2] * strength],
    });
  }

  const lights = new Map<string, BlendLightData>();
  for (const l of safe('lights', () => jb.extractLights(blend))) {
    const energy = Math.max(0, l.energy ?? 0);
    const color = rgb(l.color, [1, 1, 1]);
    if (l.type === 'sun') {
      lights.set(l.name, { type: 'sun', color, intensity: energy });
    } else if (l.type === 'spot') {
      lights.set(l.name, {
        type: 'spot', color, intensity: energy / (4 * Math.PI),
        angle: Math.min(l.spotSize ?? Math.PI / 4, Math.PI) / 2, penumbra: l.spotBlend ?? 0.15,
      });
    } else {
      // Area lights render as point lights in v1 (no RectAreaLight uniforms lib).
      lights.set(l.name, { type: l.type === 'area' ? 'area' : 'point', color, intensity: energy / (4 * Math.PI) });
    }
  }

  const cameras = new Map<string, BlendCameraData>();
  for (const c of safe('cameras', () => jb.extractCameras(blend))) {
    const lens = c.lens > 0 ? c.lens : 50;
    const sensor = c.sensorWidth > 0 ? c.sensorWidth : 36;
    cameras.set(c.name, {
      fov: (2 * Math.atan(sensor / (2 * lens)) * 180) / Math.PI,
      near: c.clipStart > 0 ? c.clipStart : 0.1,
      far: c.clipEnd > 0 ? c.clipEnd : 1000,
      ortho: c.type === 'orthographic',
    });
  }

  return { version: header.version, meshes, objects, materials, lights, cameras, skipped };
}
