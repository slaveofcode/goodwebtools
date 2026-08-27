/**
 * Control protocol for the teleprompter phone remote. Pure and tested; the hook
 * carries these messages over the WebRTC data channel and the island applies them.
 */

export type RemoteCmd =
  | { cmd: 'toggle' } | { cmd: 'play' } | { cmd: 'pause' }
  | { cmd: 'faster' } | { cmd: 'slower' }
  | { cmd: 'seek'; value: number } | { cmd: 'top' } | { cmd: 'mirror' };

export type RemoteMsg =
  | { t: 'script'; text: string }
  | { t: 'state'; playing: boolean; wpm: number; scrollPct: number }
  | ({ t: 'cmd' } & RemoteCmd);

export interface RemoteState { playing: boolean; wpm: number; scrollPct: number; mirrorX: boolean }

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function encodeMsg(m: RemoteMsg): string { return JSON.stringify(m); }

const CMDS = new Set(['toggle', 'play', 'pause', 'faster', 'slower', 'seek', 'top', 'mirror']);

/** Safe parse + shape guard. Returns null on anything unexpected. */
export function decodeMsg(s: string): RemoteMsg | null {
  let o: unknown;
  try { o = JSON.parse(s); } catch { return null; }
  if (!o || typeof o !== 'object') return null;
  const m = o as Record<string, unknown>;
  if (m.t === 'script') return typeof m.text === 'string' ? { t: 'script', text: m.text } : null;
  if (m.t === 'state') {
    return typeof m.playing === 'boolean' && typeof m.wpm === 'number' && typeof m.scrollPct === 'number'
      ? { t: 'state', playing: m.playing, wpm: m.wpm, scrollPct: m.scrollPct } : null;
  }
  if (m.t === 'cmd' && typeof m.cmd === 'string' && CMDS.has(m.cmd)) {
    if (m.cmd === 'seek') return typeof m.value === 'number' ? { t: 'cmd', cmd: 'seek', value: m.value } : null;
    return { t: 'cmd', cmd: m.cmd } as RemoteMsg;
  }
  return null;
}

/** Fold a command into the display's control state (bounds-checked). */
export function applyCommand(s: RemoteState, c: RemoteCmd): RemoteState {
  switch (c.cmd) {
    case 'toggle': return { ...s, playing: !s.playing };
    case 'play': return { ...s, playing: true };
    case 'pause': return { ...s, playing: false };
    case 'faster': return { ...s, wpm: clamp(s.wpm + 10, 40, 400) };
    case 'slower': return { ...s, wpm: clamp(s.wpm - 10, 40, 400) };
    case 'seek': return { ...s, scrollPct: clamp(c.value, 0, 1) };
    case 'top': return { ...s, scrollPct: 0, playing: false };
    case 'mirror': return { ...s, mirrorX: !s.mirrorX };
  }
}

/** The URL the pairing QR encodes. */
export function remoteUrl(origin: string, code: string): string {
  return `${origin}/tools/teleprompter?remote=${code}`;
}

const CODE_RE = /^[a-z0-9]{6,32}$/;
/** Read a valid room code from a URL search string, else null. */
export function remoteCodeFromSearch(search: string): string | null {
  const p = new URLSearchParams(search);
  const code = p.get('remote');
  return code && CODE_RE.test(code) ? code : null;
}
