import type { FileMeta } from './types';

/** Detect a file's real container from its leading bytes (magic numbers). */
export function sniffMagic(b: Uint8Array): string {
  const a = (i: number) => b[i];
  if (a(0) === 0xff && a(1) === 0xd8 && a(2) === 0xff) return 'jpeg';
  if (a(0) === 0x89 && a(1) === 0x50 && a(2) === 0x4e && a(3) === 0x47) return 'png';
  if (a(0) === 0x47 && a(1) === 0x49 && a(2) === 0x46) return 'gif';
  if (a(0) === 0x25 && a(1) === 0x50 && a(2) === 0x44 && a(3) === 0x46) return 'pdf';
  if (a(0) === 0x52 && a(1) === 0x49 && a(2) === 0x46 && a(3) === 0x46 &&
      a(8) === 0x57 && a(9) === 0x45 && a(10) === 0x42 && a(11) === 0x50) return 'webp';
  // ISO-BMFF: bytes 4..7 = 'ftyp', 8..11 = brand
  if (a(4) === 0x66 && a(5) === 0x74 && a(6) === 0x79 && a(7) === 0x70) {
    const brand = String.fromCharCode(a(8), a(9), a(10), a(11));
    if (brand.startsWith('hei') || brand.startsWith('mif')) return 'heic';
    if (brand.startsWith('avif') || brand.startsWith('avis')) return 'avif';
    return 'mp4';
  }
  return 'unknown';
}

/** Collect claimed-vs-actual format + (for images) decode success + dimensions. */
export async function sniffFileMeta(file: File): Promise<FileMeta> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const meta: FileMeta = {
    claimedType: file.type || 'unknown',
    actualFormat: sniffMagic(head),
    size: file.size,
    lastModified: file.lastModified,
  };
  if ((file.type || '').startsWith('image/') && typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file);
      meta.decodeOk = true;
      meta.width = bmp.width;
      meta.height = bmp.height;
      bmp.close?.();
    } catch {
      meta.decodeOk = false;
    }
  }
  return meta;
}
