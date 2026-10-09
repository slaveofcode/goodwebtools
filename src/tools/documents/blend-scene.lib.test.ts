import { describe, it, expect, vi, beforeEach } from 'vitest';

const jb = vi.hoisted(() => ({
  parseBlend: vi.fn(),
  extractMeshes: vi.fn(),
  extractObjects: vi.fn(),
  extractMaterials: vi.fn(),
  extractLights: vi.fn(),
  extractCameras: vi.fn(),
  extractScenes: vi.fn(),
}));
vi.mock('jsblender', () => jb);

const zstd = vi.hoisted(() => ({ decompress: vi.fn() }));
vi.mock('fzstd', () => zstd);

import { blendToSceneData, triangulateByMaterial, BlendVersionError } from './blend-scene.lib';

const ascii = (s: string) => new TextEncoder().encode(s);
const BLEND5 = ascii('BLENDER17-01v0501' + '\0'.repeat(32));
const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2, 3, 4, 1]);

// A quad (face 0, material 0) and a triangle (face 1, material 1) sharing an edge.
const quadAndTri = {
  name: 'Shape',
  vertexCount: 5,
  faceCount: 2,
  vertices: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 2, 0, 0]),
  vertexNormals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
  faceOffsets: new Uint32Array([0, 4, 7]),
  cornerVertices: new Uint32Array([0, 1, 2, 3, 1, 4, 2]),
  materialIndices: new Uint32Array([0, 1]),
  materialSlotNames: ['Red', 'Blue'],
  triangles: new Uint32Array(0),
};

describe('triangulateByMaterial', () => {
  it('fan-triangulates faces into one part per material slot', () => {
    const parts = triangulateByMaterial(quadAndTri);
    expect(parts.map(p => p.materialIndex)).toEqual([0, 1]);

    const [quad, tri] = parts;
    expect(quad.indices).toEqual(new Uint32Array([0, 1, 2, 0, 2, 3]));
    expect(quad.positions.length).toBe(4 * 3);
    expect(tri.indices).toEqual(new Uint32Array([0, 1, 2]));
    // Triangle part is re-indexed locally: vertices 1, 4, 2 of the source mesh.
    expect(Array.from(tri.positions)).toEqual([1, 0, 0, 2, 0, 0, 1, 1, 0]);
    expect(tri.normals.length).toBe(9);
  });

  it('skips degenerate faces', () => {
    const parts = triangulateByMaterial({
      ...quadAndTri,
      faceCount: 1,
      faceOffsets: new Uint32Array([0, 2]),
      cornerVertices: new Uint32Array([0, 1]),
      materialIndices: new Uint32Array([0]),
    });
    expect(parts).toEqual([]);
  });
});

describe('blendToSceneData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    jb.parseBlend.mockReturnValue({ header: { version: 5.01 } });
    jb.extractMeshes.mockReturnValue([quadAndTri]);
    jb.extractObjects.mockReturnValue([
      { name: 'Shape', type: 1, dataName: 'Shape', worldMatrix: IDENTITY },
      { name: 'Lamp', type: 10, dataName: 'Lamp', parentName: 'Shape', worldMatrix: IDENTITY },
      { name: 'Cam', type: 11, dataName: 'Cam', worldMatrix: IDENTITY },
      { name: 'Empty', type: 0, worldMatrix: IDENTITY },
    ]);
    jb.extractMaterials.mockReturnValue([
      {
        name: 'Red', diffuse: [0.8, 0.8, 0.8, 1], metallic: 0, roughness: 0.5,
        shader: { nodes: [], principled: { baseColor: [1, 0, 0, 1], metallic: 0.2, roughness: 0.3, alpha: 0.9, emissionColor: [1, 1, 0, 1], emissionStrength: 0.5 } },
      },
      { name: 'Blue', diffuse: [0, 0, 1, 1], metallic: 0.1, roughness: 0.7 },
    ]);
    jb.extractLights.mockReturnValue([
      { name: 'Lamp', type: 'spot', color: [1, 1, 1], energy: 4 * Math.PI * 10, spotSize: 1, spotBlend: 0.2 },
    ]);
    jb.extractCameras.mockReturnValue([
      { name: 'Cam', type: 'perspective', lens: 50, sensorWidth: 36, sensorHeight: 24, sensorFit: 'auto', clipStart: 0.1, clipEnd: 100 },
    ]);
    jb.extractScenes.mockReturnValue([{ name: 'Scene', cameraObject: 'Cam', resolutionX: 1920, resolutionY: 1080 }]);
  });

  it('maps jsblender output to renderer-free scene data', async () => {
    const data = await blendToSceneData(BLEND5);

    expect(data.version).toBe(5.01);
    expect(data.meshes.get('Shape')?.parts).toHaveLength(2);
    expect(data.meshes.get('Shape')?.materialSlots).toEqual(['Red', 'Blue']);

    expect(data.objects.map(o => [o.name, o.kind])).toEqual([
      ['Shape', 'mesh'], ['Lamp', 'light'], ['Cam', 'camera'], ['Empty', 'empty'],
    ]);
    expect(data.objects[1].parentName).toBe('Shape');
    expect(data.objects[0].matrix.slice(12, 15)).toEqual([2, 3, 4]);

    expect(data.materials.get('Red')).toEqual({
      color: [1, 0, 0], opacity: 0.9, metalness: 0.2, roughness: 0.3, emissive: [0.5, 0.5, 0],
    });
    expect(data.materials.get('Blue')).toEqual({
      color: [0, 0, 1], opacity: 1, metalness: 0.1, roughness: 0.7, emissive: [0, 0, 0],
    });

    const lamp = data.lights.get('Lamp')!;
    expect(lamp.type).toBe('spot');
    expect(lamp.intensity).toBeCloseTo(10);
    expect(lamp.angle).toBeCloseTo(0.5);
    expect(lamp.penumbra).toBeCloseTo(0.2);

    const cam = data.cameras.get('Cam')!;
    expect(cam.fov).toBeCloseTo((2 * Math.atan(36 / 100) * 180) / Math.PI);
    expect(cam).toMatchObject({ near: 0.1, far: 100, ortho: false, lens: 50, sensorWidth: 36, sensorHeight: 24, sensorFit: 'auto' });
    expect(data.activeCamera).toBe('Cam');
    expect(data.renderAspect).toBeCloseTo(1920 / 1080);
    expect(data.skipped).toEqual([]);
  });

  it('keeps going when one extractor throws', async () => {
    jb.extractLights.mockImplementation(() => { throw new Error('bad lamp'); });
    const data = await blendToSceneData(BLEND5);
    expect(data.skipped).toEqual(['lights']);
    expect(data.meshes.size).toBe(1);
  });

  it('has no active camera when scenes cannot be read', async () => {
    jb.extractScenes.mockImplementation(() => { throw new Error('bad scene'); });
    const data = await blendToSceneData(BLEND5);
    expect(data.activeCamera).toBeUndefined();
    expect(data.renderAspect).toBeCloseTo(16 / 9);
    expect(data.skipped).toEqual(['scenes']);
  });

  it('decompresses zstd before reading the header', async () => {
    zstd.decompress.mockReturnValue(BLEND5);
    await blendToSceneData(new Uint8Array([0x28, 0xb5, 0x2f, 0xfd, 1, 2, 3]));
    expect(zstd.decompress).toHaveBeenCalledOnce();
    expect(jb.parseBlend).toHaveBeenCalledWith(BLEND5);
  });

  it('rejects files saved before Blender 5 with their version', async () => {
    const err = await blendToSceneData(ascii('BLENDER-v405REND')).catch(e => e);
    expect(err).toBeInstanceOf(BlendVersionError);
    expect(err.version).toBe(4.05);
    expect(jb.parseBlend).not.toHaveBeenCalled();
  });

  it('rejects gzip (pre-3.0) files without a version', async () => {
    const err = await blendToSceneData(new Uint8Array([0x1f, 0x8b, 8, 0])).catch(e => e);
    expect(err).toBeInstanceOf(BlendVersionError);
    expect(err.version).toBeNull();
  });
});
