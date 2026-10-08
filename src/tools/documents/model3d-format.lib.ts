/**
 * 3D Model Viewer — format sniffing. Pure: decides which loader a file needs
 * from its magic bytes first (so a mis-named file still opens), falling back to
 * the extension for text formats with no signature (OBJ, glTF JSON).
 */

export type ModelFormat = 'blend' | 'glb' | 'gltf' | 'obj' | 'stl' | 'fbx' | 'ply';

/** Accept list for the picker: model files plus the sidecars glTF/OBJ reference. */
export const MODEL_ACCEPT = '.blend,.glb,.gltf,.obj,.stl,.fbx,.ply,.bin,.mtl,.png,.jpg,.jpeg,.webp,.ktx2';

/** How many leading bytes the sniffers need. */
export const SNIFF_BYTES = 512;

const ZSTD = [0x28, 0xb5, 0x2f, 0xfd];
const GZIP = [0x1f, 0x8b];

function startsWith(head: Uint8Array, sig: number[]): boolean {
  return head.length >= sig.length && sig.every((b, i) => head[i] === b);
}

function ascii(head: Uint8Array, start: number, length: number): string {
  let s = '';
  for (let i = start; i < Math.min(head.length, start + length); i++) s += String.fromCharCode(head[i]);
  return s;
}

function extOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

function isBinaryStl(head: Uint8Array, size?: number): boolean {
  if (size === undefined || head.length < 84) return false;
  const count = new DataView(head.buffer, head.byteOffset, head.byteLength).getUint32(80, true);
  return count > 0 && 84 + 50 * count === size;
}

/** Identify a 3D model from its name + first bytes (+ total size, for binary STL). */
export function detectModelFormat(name: string, head: Uint8Array, size?: number): ModelFormat | null {
  const ext = extOf(name);
  const text = ascii(head, 0, SNIFF_BYTES);

  if (text.startsWith('BLENDER')) return 'blend';
  // zstd/gzip are generic containers — only a .blend inside one when named so.
  if (ext === 'blend' && (startsWith(head, ZSTD) || startsWith(head, GZIP))) return 'blend';
  if (text.startsWith('glTF')) return 'glb';
  if (text.startsWith('Kaydara FBX Binary') || text.startsWith('; FBX')) return 'fbx';
  if (/^ply\r?\n/.test(text)) return 'ply';
  if (isBinaryStl(head, size)) return 'stl';
  if (/^\s*solid\b/.test(text) && text.includes('facet')) return 'stl';

  switch (ext) {
    case 'obj': return 'obj';
    case 'gltf': return 'gltf';
    case 'stl': return 'stl';
    case 'fbx': return 'fbx';
    default: return null;
  }
}

export type BlendHeaderInfo =
  | { kind: 'blend'; version: number; versionString: string; legacy: boolean }
  | { kind: 'zstd' }
  | { kind: 'gzip' }
  | { kind: 'unknown' };

/**
 * Read the Blender version from an (uncompressed) .blend header. Legacy files
 * use a 12-byte header (`BLENDER-v405`); Blender 5 uses 17 bytes
 * (`BLENDER17-01v0501`). Compressed files must be decompressed first.
 */
export function sniffBlendHeader(head: Uint8Array): BlendHeaderInfo {
  if (startsWith(head, ZSTD)) return { kind: 'zstd' };
  if (startsWith(head, GZIP)) return { kind: 'gzip' };
  if (ascii(head, 0, 7) !== 'BLENDER' || head.length < 12) return { kind: 'unknown' };

  const c7 = String.fromCharCode(head[7]);
  if (c7 === '-' || c7 === '_') {
    const versionString = ascii(head, 9, 3);
    return { kind: 'blend', version: toVersion(versionString), versionString, legacy: true };
  }
  if (head.length < 17) return { kind: 'unknown' };
  const versionString = ascii(head, 13, 4);
  return { kind: 'blend', version: toVersion(versionString), versionString, legacy: false };
}

function toVersion(s: string): number {
  return Number(s[0]) + Number(s.slice(1)) / 100;
}

export interface ModelFileGroup {
  main: File;
  format: ModelFormat;
  /** Other dropped files, keyed by lower-cased basename (for loader URL lookups). */
  sidecars: Map<string, File>;
}

/**
 * From a multi-file drop, pick the model to open and keep the rest as sidecars
 * (glTF .bin/textures, OBJ .mtl/textures). Returns null when nothing is a model.
 */
export async function groupModelFiles(files: File[]): Promise<ModelFileGroup | null> {
  let main: File | null = null;
  let format: ModelFormat | null = null;

  for (const f of files) {
    const head = new Uint8Array(await f.slice(0, SNIFF_BYTES).arrayBuffer());
    const detected = detectModelFormat(f.name, head, f.size);
    if (detected) {
      main = f;
      format = detected;
      break;
    }
  }
  if (!main || !format) return null;

  const sidecars = new Map<string, File>();
  for (const f of files) if (f !== main) sidecars.set(basename(f.name), f);
  return { main, format, sidecars };
}

/** Lower-cased last path segment, used to match loader-requested URLs to files. */
export function basename(path: string): string {
  const clean = path.split(/[?#]/)[0];
  const seg = clean.slice(clean.lastIndexOf('/') + 1);
  try {
    return decodeURIComponent(seg).toLowerCase();
  } catch {
    return seg.toLowerCase();
  }
}
