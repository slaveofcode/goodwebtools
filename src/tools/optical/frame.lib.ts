/**
 * Wire format for one optical-transfer QR frame. Every frame is self-describing so
 * the receiver can start from any frame it happens to catch.
 *
 * Header (18 bytes, big-endian):
 *   0      magic  (0xB3)
 *   1      version(0x01)
 *   2..3   session id (u16)
 *   4..5   k = block count (u16)
 *   6..9   file size (u32)
 *   10..13 file hash, fnv1a (u32)
 *   14..17 seq (u32)
 *   18..   payload (blockSize bytes)
 */

const MAGIC = 0xb3;
const VERSION = 0x01;
export const HEADER_SIZE = 18;

export interface FrameMeta {
  session: number;
  k: number;
  size: number;
  hash: number;
  seq: number;
}

export interface Frame extends FrameMeta {
  payload: Uint8Array;
}

/** 32-bit FNV-1a hash. */
export function fnv1a(bytes: Uint8Array): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function encodeFrame(frame: Frame): Uint8Array {
  const out = new Uint8Array(HEADER_SIZE + frame.payload.length);
  const view = new DataView(out.buffer);
  out[0] = MAGIC;
  out[1] = VERSION;
  view.setUint16(2, frame.session & 0xffff);
  view.setUint16(4, frame.k & 0xffff);
  view.setUint32(6, frame.size >>> 0);
  view.setUint32(10, frame.hash >>> 0);
  view.setUint32(14, frame.seq >>> 0);
  out.set(frame.payload, HEADER_SIZE);
  return out;
}

/** Wrap a file's name + bytes into one container so both travel through the codec. */
export function packFile(name: string, data: Uint8Array): Uint8Array {
  const nameBytes = new TextEncoder().encode(name).slice(0, 65535);
  const out = new Uint8Array(2 + nameBytes.length + data.length);
  new DataView(out.buffer).setUint16(0, nameBytes.length);
  out.set(nameBytes, 2);
  out.set(data, 2 + nameBytes.length);
  return out;
}

/** Unwrap a container produced by packFile. */
export function unpackFile(bytes: Uint8Array): { name: string; data: Uint8Array } {
  if (bytes.length < 2) return { name: '', data: new Uint8Array(0) };
  const nameLen = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(0);
  const name = new TextDecoder().decode(bytes.subarray(2, 2 + nameLen));
  return { name, data: bytes.slice(2 + nameLen) };
}

export function decodeFrame(bytes: Uint8Array): Frame | null {
  if (bytes.length < HEADER_SIZE) return null;
  if (bytes[0] !== MAGIC || bytes[1] !== VERSION) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    session: view.getUint16(2),
    k: view.getUint16(4),
    size: view.getUint32(6),
    hash: view.getUint32(10),
    seq: view.getUint32(14),
    payload: bytes.slice(HEADER_SIZE),
  };
}
