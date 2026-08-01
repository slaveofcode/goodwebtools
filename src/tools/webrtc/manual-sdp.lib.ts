/**
 * Encode/decode an SDP offer or answer as a compact, copy-pasteable code for the
 * manual (serverless) signaling mode. Base64 keeps it on a single line and robust
 * to being pasted through chat/email. UTF-8 safe.
 */

function toBase64(str: string): string {
  // Encode UTF-8 → base64 without relying on Node Buffer.
  const utf8 = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, h) =>
    String.fromCharCode(parseInt(h, 16)),
  );
  return btoa(utf8);
}

function fromBase64(b64: string): string {
  const binary = atob(b64);
  return decodeURIComponent(
    Array.from(binary, c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''),
  );
}

/** Serialize a session description to a single-line code. */
export function encodeSdp(desc: RTCSessionDescriptionInit): string {
  return toBase64(JSON.stringify({ type: desc.type, sdp: desc.sdp }));
}

/** Parse + validate a pasted code back into a session description, or null. */
export function decodeSdp(code: string): RTCSessionDescriptionInit | null {
  const trimmed = code.trim();
  if (!trimmed) return null;
  let json: string;
  try {
    json = fromBase64(trimmed);
  } catch {
    return null;
  }
  let obj: unknown;
  try {
    obj = JSON.parse(json);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  const m = obj as Record<string, unknown>;
  if ((m.type !== 'offer' && m.type !== 'answer') || typeof m.sdp !== 'string') return null;
  return { type: m.type, sdp: m.sdp };
}
