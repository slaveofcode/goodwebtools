/**
 * Pure signaling protocol shared by the P2P tools (file transfer, video call).
 * Only tiny JSON control messages flow through the signaling server — never media
 * or file bytes.
 */

export type SignalRole = 'host' | 'guest';

export type SignalMessage =
  | { type: 'welcome'; role: SignalRole }
  | { type: 'peer-joined' }
  | { type: 'peer-left' }
  | { type: 'full' }
  | { type: 'offer'; sdp: unknown }
  | { type: 'answer'; sdp: unknown }
  | { type: 'ice'; candidate: unknown };

const ROOM_ID_RE = /^[a-z0-9]{6,32}$/;
const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** A 10-char lowercase-alnum room id from a CSPRNG. */
export function makeRoomId(): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += ID_ALPHABET[b % ID_ALPHABET.length];
  return out;
}

/** Same-origin shareable link for a P2P room (file transfer by default). */
export function roomLink(origin: string, roomId: string, path = '/tools/file-transfer'): string {
  return `${origin}${path}#${roomId}`;
}

/** Extract a valid room id from a URL hash (with or without the leading '#'). */
export function roomIdFromHash(hash: string): string | null {
  const id = hash.startsWith('#') ? hash.slice(1) : hash;
  return ROOM_ID_RE.test(id) ? id : null;
}

function isRole(v: unknown): v is SignalRole {
  return v === 'host' || v === 'guest';
}

/** Safe parse + shape-guard a raw signaling message. Returns null if invalid. */
export function parseSignal(raw: string): SignalMessage | null {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  const m = obj as Record<string, unknown>;
  switch (m.type) {
    case 'welcome':
      return isRole(m.role) ? { type: 'welcome', role: m.role } : null;
    case 'peer-joined':
    case 'peer-left':
    case 'full':
      return { type: m.type };
    case 'offer':
      return 'sdp' in m ? { type: 'offer', sdp: m.sdp } : null;
    case 'answer':
      return 'sdp' in m ? { type: 'answer', sdp: m.sdp } : null;
    case 'ice':
      return 'candidate' in m ? { type: 'ice', candidate: m.candidate } : null;
    default:
      return null;
  }
}
