import { describe, it, expect } from 'vitest';
import { detectModelFormat, sniffBlendHeader, groupModelFiles } from './model3d-format.lib';

const ascii = (s: string) => new TextEncoder().encode(s);
const bytes = (...b: number[]) => new Uint8Array(b);

function binaryStlHead(triangles: number): { head: Uint8Array; size: number } {
  const head = new Uint8Array(84);
  new DataView(head.buffer).setUint32(80, triangles, true);
  return { head, size: 84 + 50 * triangles };
}

describe('detectModelFormat', () => {
  it.each([
    ['scene.blend', ascii('BLENDER-v405REND'), 'blend'],
    ['scene.blend', ascii('BLENDER17-01v0501'), 'blend'],
    ['scene.blend', bytes(0x28, 0xb5, 0x2f, 0xfd, 0, 0), 'blend'],
    ['scene.blend', bytes(0x1f, 0x8b, 8, 0), 'blend'],
    ['model.glb', ascii('glTF\x02\x00\x00\x00'), 'glb'],
    ['photo.jpeg', ascii('glTF\x02\x00\x00\x00'), 'glb'],
    ['rig.fbx', ascii('Kaydara FBX Binary  \x00'), 'fbx'],
    ['rig.fbx', ascii('; FBX 7.4.0 project file'), 'fbx'],
    ['scan.ply', ascii('ply\nformat ascii 1.0\n'), 'ply'],
    ['scan.ply', ascii('ply\r\nformat binary_little_endian 1.0\r\n'), 'ply'],
    ['part.stl', ascii('solid cube\n facet normal 0 0 1\n'), 'stl'],
    ['mesh.obj', ascii('# comment\nv 0 0 0\n'), 'obj'],
    ['scene.gltf', ascii('{"asset":{"version":"2.0"}}'), 'gltf'],
  ] as const)('%s → %s', (name, head, expected) => {
    expect(detectModelFormat(name, head)).toBe(expected);
  });

  it('detects binary STL by its exact size', () => {
    const { head, size } = binaryStlHead(12);
    expect(detectModelFormat('part.stl', head, size)).toBe('stl');
    expect(detectModelFormat('noext', head, size)).toBe('stl');
  });

  it('does not treat a generic zstd/gzip file as .blend', () => {
    expect(detectModelFormat('archive.zst', bytes(0x28, 0xb5, 0x2f, 0xfd))).toBeNull();
    expect(detectModelFormat('notes.gz', bytes(0x1f, 0x8b, 8, 0))).toBeNull();
  });

  it('returns null for unknown content', () => {
    expect(detectModelFormat('notes.txt', ascii('hello world'))).toBeNull();
    expect(detectModelFormat('empty.bin', new Uint8Array(0))).toBeNull();
  });
});

describe('sniffBlendHeader', () => {
  it('reads a legacy (pre-5) header', () => {
    expect(sniffBlendHeader(ascii('BLENDER-v405REND'))).toEqual({
      kind: 'blend', version: 4.05, versionString: '405', legacy: true,
    });
  });

  it('reads a Blender 5 header', () => {
    expect(sniffBlendHeader(ascii('BLENDER17-01v0501'))).toEqual({
      kind: 'blend', version: 5.01, versionString: '0501', legacy: false,
    });
  });

  it('flags compressed and unknown data', () => {
    expect(sniffBlendHeader(bytes(0x28, 0xb5, 0x2f, 0xfd))).toEqual({ kind: 'zstd' });
    expect(sniffBlendHeader(bytes(0x1f, 0x8b))).toEqual({ kind: 'gzip' });
    expect(sniffBlendHeader(ascii('nope'))).toEqual({ kind: 'unknown' });
  });
});

describe('groupModelFiles', () => {
  const file = (name: string, content: string) => new File([content], name);

  it('picks the .gltf as main with .bin and textures as sidecars', async () => {
    const g = await groupModelFiles([
      file('Texture.PNG', 'png'),
      file('scene.bin', 'bin'),
      file('scene.gltf', '{"asset":{"version":"2.0"}}'),
    ]);
    expect(g?.main.name).toBe('scene.gltf');
    expect(g?.format).toBe('gltf');
    expect([...g!.sidecars.keys()].sort()).toEqual(['scene.bin', 'texture.png']);
  });

  it('pairs an .obj with its .mtl', async () => {
    const g = await groupModelFiles([file('mesh.mtl', 'newmtl a'), file('mesh.obj', 'v 0 0 0')]);
    expect(g?.main.name).toBe('mesh.obj');
    expect(g?.sidecars.has('mesh.mtl')).toBe(true);
  });

  it('returns null when nothing is a model', async () => {
    expect(await groupModelFiles([file('a.png', 'x'), file('b.txt', 'y')])).toBeNull();
    expect(await groupModelFiles([])).toBeNull();
  });
});
