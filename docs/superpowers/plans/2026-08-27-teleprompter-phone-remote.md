# Teleprompter Phone Remote Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a phone control the teleprompter (play/pause, speed, seek, jump-to-top, mirror) and show the same script in sync, over a peer-to-peer connection.

**Architecture:** Reuse the existing WebRTC stack — `connectSignal` (room over a signaling Durable Object) + `createPeer` (data channel). A pure lib carries the control protocol + reducer; a hook wraps the connection; the existing island gains a pairing panel (host) and a remote mode (guest, `?remote=CODE`). The display is the single source of truth; the phone mirrors state and sends commands.

**Tech Stack:** React islands, TypeScript, Vitest, WebRTC (`src/tools/webrtc/*`), `qrcode`.

**Spec:** `docs/superpowers/specs/2026-08-27-teleprompter-phone-remote-design.md`

## Global Constraints

- Reuse `connectSignal`/`createPeer`/`makeRoomId`/`parseSignal` from `src/tools/webrtc/`. Do NOT rebuild signaling or peer plumbing.
- Only the room code + SDP/ICE touch the server; the script + commands go P2P. Copy must say this honestly (no "never leaves this device" — it goes to the paired phone).
- The phone is an optional accessory: if it disconnects, the display keeps running unchanged.
- No `any` in new source. No `window`/`navigator` at module scope. Repo-local noreply commit identity; no AI-attribution trailers.
- The live WebRTC path can't run under `astro preview`; do NOT fake an E2E pass — unit-test the lib, Playwright-check UI rendering, and state that 2-device pairing is verified manually on production.

---

### Task 1: Control protocol — `teleprompter-remote.lib.ts`

**Files:**
- Create: `src/tools/media/teleprompter-remote.lib.ts`
- Test: `src/tools/media/teleprompter-remote.lib.test.ts`

**Interfaces:**
- Produces: `RemoteCmd`, `RemoteMsg`, `RemoteState`, `encodeMsg`, `decodeMsg`, `applyCommand`, `remoteUrl`, `remoteCodeFromSearch`.
- Consumes: nothing.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { encodeMsg, decodeMsg, applyCommand, remoteUrl, remoteCodeFromSearch, type RemoteState } from './teleprompter-remote.lib';

describe('encode/decode', () => {
  it('round-trips each message', () => {
    for (const m of [
      { t: 'script', text: 'hello world' },
      { t: 'state', playing: true, wpm: 140, scrollPct: 0.5 },
      { t: 'cmd', cmd: 'seek', value: 0.25 },
      { t: 'cmd', cmd: 'toggle' },
    ] as const) {
      expect(decodeMsg(encodeMsg(m))).toEqual(m);
    }
  });
  it('rejects malformed input', () => {
    expect(decodeMsg('not json')).toBeNull();
    expect(decodeMsg('{"t":"nope"}')).toBeNull();
    expect(decodeMsg('{"t":"state","playing":true}')).toBeNull(); // missing fields
  });
});

describe('applyCommand', () => {
  const base: RemoteState = { playing: false, wpm: 140, scrollPct: 0.2, mirrorX: false };
  it('toggles and sets play state', () => {
    expect(applyCommand(base, { cmd: 'toggle' }).playing).toBe(true);
    expect(applyCommand({ ...base, playing: true }, { cmd: 'pause' }).playing).toBe(false);
    expect(applyCommand(base, { cmd: 'play' }).playing).toBe(true);
  });
  it('changes speed within 40..400', () => {
    expect(applyCommand(base, { cmd: 'faster' }).wpm).toBe(150);
    expect(applyCommand({ ...base, wpm: 400 }, { cmd: 'faster' }).wpm).toBe(400);
    expect(applyCommand({ ...base, wpm: 40 }, { cmd: 'slower' }).wpm).toBe(40);
  });
  it('seeks within 0..1 and jumps to top', () => {
    expect(applyCommand(base, { cmd: 'seek', value: 0.9 }).scrollPct).toBe(0.9);
    expect(applyCommand(base, { cmd: 'seek', value: 2 }).scrollPct).toBe(1);
    expect(applyCommand(base, { cmd: 'seek', value: -1 }).scrollPct).toBe(0);
    expect(applyCommand({ ...base, playing: true }, { cmd: 'top' })).toMatchObject({ scrollPct: 0, playing: false });
  });
  it('toggles mirror', () => {
    expect(applyCommand(base, { cmd: 'mirror' }).mirrorX).toBe(true);
  });
});

describe('url helpers', () => {
  it('builds the remote url and reads the code back', () => {
    expect(remoteUrl('https://x.test', 'abc123')).toBe('https://x.test/tools/teleprompter?remote=abc123');
    expect(remoteCodeFromSearch('?remote=abc123')).toBe('abc123');
    expect(remoteCodeFromSearch('?foo=1')).toBeNull();
    expect(remoteCodeFromSearch('?remote=BAD_CODE!')).toBeNull(); // must be [a-z0-9]{6,32}
  });
});
```

- [ ] **Step 2: Run to verify fail** — `npx vitest run src/tools/media/teleprompter-remote.lib.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
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
```

- [ ] **Step 4: Run to verify pass** — `npx vitest run src/tools/media/teleprompter-remote.lib.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(teleprompter): remote control protocol lib"`.

---

### Task 2: Connection hook — `useTeleprompterLink.ts`

**Files:**
- Create: `src/hooks/useTeleprompterLink.ts`

**Interfaces:**
- Consumes: `connectSignal`, `SignalClient` (`@/tools/webrtc/signal-client`); `createPeer`, `PeerHandles` (`@/tools/webrtc/peer`); `SignalMessage` (`@/tools/webrtc/signal.lib`); `encodeMsg`, `decodeMsg`, `RemoteMsg` (Task 1).
- Produces: `useTeleprompterLink(onMessage: (m: RemoteMsg) => void): { status: LinkStatus; connect(code: string, role: 'host' | 'guest'): void; send(m: RemoteMsg): void; close(): void }` and `type LinkStatus = 'idle'|'waiting'|'connecting'|'connected'|'disconnected'|'error'`.

- [ ] **Step 1: Implement the hook** (plumbing — no unit test; verified by tsc/build + island smoke, matching how `useFileTransfer` is covered):

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { connectSignal, type SignalClient } from '@/tools/webrtc/signal-client';
import { createPeer, type PeerHandles } from '@/tools/webrtc/peer';
import type { SignalMessage } from '@/tools/webrtc/signal.lib';
import { encodeMsg, decodeMsg, type RemoteMsg } from '@/tools/media/teleprompter-remote.lib';

export type LinkStatus = 'idle' | 'waiting' | 'connecting' | 'connected' | 'disconnected' | 'error';

export function useTeleprompterLink(onMessage: (m: RemoteMsg) => void) {
  const [status, setStatus] = useState<LinkStatus>('idle');
  const signalRef = useRef<SignalClient | null>(null);
  const peerRef = useRef<PeerHandles | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const onMsgRef = useRef(onMessage);
  onMsgRef.current = onMessage;

  const wireChannel = useCallback((ch: RTCDataChannel) => {
    channelRef.current = ch;
    ch.onopen = () => setStatus('connected');
    ch.onclose = () => setStatus('disconnected');
    ch.onmessage = (e) => {
      if (typeof e.data !== 'string') return;
      const m = decodeMsg(e.data);
      if (m) onMsgRef.current(m);
    };
  }, []);

  const setupPeer = useCallback((initiator: boolean) => {
    peerRef.current?.close();
    peerRef.current = createPeer({
      initiator,
      sendSignal: (msg) => signalRef.current?.send(msg),
      onState: (s) => {
        if (s === 'connected') setStatus('connected');
        else if (s === 'failed' || s === 'disconnected' || s === 'closed') setStatus('disconnected');
      },
      onChannel: wireChannel,
    });
  }, [wireChannel]);

  const connect = useCallback((code: string, role: 'host' | 'guest') => {
    setStatus(role === 'host' ? 'waiting' : 'connecting');
    signalRef.current = connectSignal(code, {
      onMessage: (msg: SignalMessage) => {
        switch (msg.type) {
          case 'welcome': if (msg.role === 'guest') setupPeer(false); else setStatus('waiting'); break;
          case 'peer-joined': setupPeer(true); break;
          case 'peer-left': setStatus('disconnected'); break;
          case 'full': setStatus('error'); break;
          default: void peerRef.current?.applySignal(msg); // offer/answer/ice
        }
      },
      onError: () => setStatus('error'),
    });
  }, [setupPeer]);

  const send = useCallback((m: RemoteMsg) => {
    const ch = channelRef.current;
    if (ch && ch.readyState === 'open') ch.send(encodeMsg(m));
  }, []);

  const close = useCallback(() => {
    channelRef.current = null;
    peerRef.current?.close(); peerRef.current = null;
    signalRef.current?.close(); signalRef.current = null;
    setStatus('idle');
  }, []);

  useEffect(() => () => { channelRef.current = null; peerRef.current?.close(); signalRef.current?.close(); }, []);

  return { status, connect, send, close };
}
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit` → no errors for this file.
- [ ] **Step 3: Commit** — `git commit -m "feat(teleprompter): WebRTC link hook for phone remote"`.

---

### Task 3: Island — pairing panel (host) + remote mode (guest)

**Files:**
- Modify: `src/islands/media/Teleprompter.tsx`

**Interfaces:**
- Consumes: `useTeleprompterLink` (Task 2); `applyCommand`, `remoteUrl`, `remoteCodeFromSearch`, `RemoteMsg`, `RemoteState` (Task 1); `makeRoomId` (`@/tools/webrtc/signal.lib`); `qrcode` (`import QRCode from 'qrcode'`; `await QRCode.toDataURL(url)`).

Add to the island:

- [ ] **Step 1: Remote-mode detection + link.** Near the top of the component:

```tsx
// Remote (phone) mode when the URL carries ?remote=CODE.
const [remoteCode] = useState<string | null>(() =>
  typeof window === 'undefined' ? null : remoteCodeFromSearch(window.location.search));
const isRemote = !!remoteCode;

const handleRemoteMsg = useCallback((m: RemoteMsg) => {
  if (isRemote) {
    // Guest: mirror the display.
    if (m.t === 'script') { setScript(m.text); setEditing(false); }
    else if (m.t === 'state') {
      setPlaying(m.playing); setWpm(m.wpm);
      const el = scrollRef.current;
      if (el) el.scrollTop = m.scrollPct * Math.max(1, el.scrollHeight - el.clientHeight);
    }
  } else if (m.t === 'cmd') {
    // Host: apply the phone's command to our own state.
    const s: RemoteState = { playing, wpm, scrollPct: currentPct(), mirrorX };
    const next = applyCommand(s, m);
    setPlaying(next.playing); setWpm(next.wpm); setMirrorX(next.mirrorX);
    if (m.cmd === 'seek' || m.cmd === 'top') {
      const el = scrollRef.current;
      if (el) el.scrollTop = next.scrollPct * Math.max(1, el.scrollHeight - el.clientHeight);
    }
  }
}, [isRemote, playing, wpm, mirrorX]);

const link = useTeleprompterLink(handleRemoteMsg);
```

Add a helper `const currentPct = () => { const el = scrollRef.current; return el ? el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight) : 0; };`

- [ ] **Step 2: Guest auto-connect.** On mount when `isRemote`:

```tsx
useEffect(() => {
  if (isRemote && remoteCode) { setEditing(false); link.connect(remoteCode, 'guest'); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [isRemote, remoteCode]);
```

- [ ] **Step 3: Host pairing.** Add state `const [pairCode, setPairCode] = useState(''); const [qr, setQr] = useState('');` and a Pair action:

```tsx
const startPairing = async () => {
  const code = makeRoomId();
  setPairCode(code);
  link.connect(code, 'host');
  const QRCode = (await import('qrcode')).default;
  setQr(await QRCode.toDataURL(remoteUrl(window.location.origin, code), { margin: 1, width: 220 }));
};
```

Render (host only, i.e. `!isRemote`): a **Pair phone** button in the controls bar; when `pairCode`, a panel showing `<img src={qr} />`, the `pairCode`, and `link.status` ("waiting for phone" / "phone connected" / "phone disconnected"). Keep it dismissible.

- [ ] **Step 4: Host streams state.** When paired and not remote, send the script once and stream state (throttled). Add:

```tsx
const scriptSentRef = useRef(false);
useEffect(() => {
  if (isRemote || link.status !== 'connected') { scriptSentRef.current = false; return; }
  if (!scriptSentRef.current) { link.send({ t: 'script', text: script }); scriptSentRef.current = true; }
}, [isRemote, link, script]);

// Broadcast state on change + a light heartbeat while playing.
useEffect(() => {
  if (isRemote || link.status !== 'connected') return;
  const emit = () => link.send({ t: 'state', playing, wpm, scrollPct: currentPct() });
  emit();
  const el = scrollRef.current;
  el?.addEventListener('scroll', emit, { passive: true });
  const id = window.setInterval(emit, 500);
  return () => { el?.removeEventListener('scroll', emit); window.clearInterval(id); };
}, [isRemote, link, playing, wpm]);
```

- [ ] **Step 5: Remote control bar (guest).** In remote mode render a bottom control bar whose buttons call `link.send({ t: 'cmd', cmd })`: play/pause (`toggle`), `slower`/`faster` with the wpm readout, a range input (`onChange` → `seek` with `value = e.target.value/100`), `top`, `mirror`. The mirrored script scrolls via incoming `state` (Step 1); no local scroll engine runs in remote mode (skip the auto-scroll/voice effects when `isRemote`).

- [ ] **Step 6: Disconnect resilience.** Guard the existing auto-scroll and voice effects with `if (isRemote) return;` at the top so the guest never runs its own engine. On the host, a phone drop only flips `link.status` to `disconnected` — the display keeps running (no other coupling). Show the status in the pair panel.

- [ ] **Step 7: Typecheck + lint + build**

Run: `npx tsc --noEmit`, `npx eslint src/islands/media/Teleprompter.tsx`, `npm run build` → all clean; `/tools/teleprompter` builds.

- [ ] **Step 8: Playwright UI-render smoke** (throwaway, against `npm run preview`):
  - Normal load → **Pair phone** button present; clicking it renders a QR `<img>` and a code string.
  - Load `/tools/teleprompter?remote=abcdef` → remote mode renders a control bar (play/pause, speed, seek, top, mirror) and no script editor; no `pageerror`. (The WebRTC connect will sit at "connecting" since no signaling server under preview — that is expected; assert the UI rendered, not a live link.)

- [ ] **Step 9: Commit** — `git commit -m "feat(teleprompter): phone pairing + remote mode in the island"`.

---

### Task 4: SEO line about the phone remote

**Files:**
- Modify: `src/registry/tool-seo.ts` (the `teleprompter` entry in BOTH `en` and `id`)

- [ ] **Step 1:** Add one `howTo` step and one FAQ to each locale:
  - EN howTo (append): `'To control it from your phone, press Pair phone and scan the QR — the phone shows the same script in sync and can play/pause, change speed and seek.'`
  - EN FAQ (append): `{ q: 'How does the phone remote work?', a: 'Your phone pairs over a direct connection between your two devices; the script and controls are sent device-to-device and only the pairing (a short code and connection details) uses our server. If the phone disconnects, the teleprompter keeps running.' }`
  - ID howTo (append): `'Untuk mengontrol dari ponsel, tekan Pair phone dan pindai QR — ponsel menampilkan naskah yang sama secara sinkron dan bisa main/jeda, ubah kecepatan, dan geser posisi.'`
  - ID FAQ (append): `{ q: 'Bagaimana remote ponsel bekerja?', a: 'Ponsel Anda dipasangkan lewat koneksi langsung antar dua perangkat Anda; naskah dan kontrol dikirim antar-perangkat dan hanya proses pemasangan (kode singkat dan detail koneksi) yang memakai server kami. Jika ponsel terputus, teleprompter tetap berjalan.' }`

- [ ] **Step 2: Build** → both `/tools/teleprompter/` and `/id/tools/teleprompter/` still build. Commit — `git commit -m "feat(teleprompter): document the phone remote in SEO"`.

---

## Verify loop (after Task 4)

```bash
npx vitest run     # whole suite green (incl. teleprompter-remote.lib.test.ts)
npm run lint       # 0 errors
npm run build      # teleprompter pages built
```

Hand-review: the guest never runs the local scroll/voice engines (`isRemote` guards); `link.close()`/unmount closes channel+peer+signal; host survives a phone drop; state messages throttled; `decodeMsg` rejects malformed input; script goes P2P only.

## Ship

`feat/teleprompter-remote` → PR to develop → CI green → merge → promote develop→main (`--admin`) → confirm prod build → verify `/tools/teleprompter` loads and the Pair button appears → **manually pair two real devices on production** and confirm play/pause/speed/seek/mirror + synced scroll both ways and phone-drop resilience → tell the user to hard-refresh (PWA).

## Self-review notes

- **Spec coverage:** protocol + reducer (Task 1); connection/handshake reuse (Task 2); pairing QR+code, remote mirror+controls, host applies cmds, state streaming, disconnect resilience (Task 3); honest privacy copy (Task 3 panel + Task 4 SEO). Testing limitation stated. ✔
- **Placeholder scan:** the island task references the existing island's state (`playing`, `wpm`, `mirrorX`, `scrollRef`, `setScript`, `setEditing`) — all already defined in `Teleprompter.tsx`; the new code is concrete. No TBDs.
- **Type consistency:** `RemoteMsg`/`RemoteState`/`applyCommand`/`remoteUrl`/`remoteCodeFromSearch` names match between Task 1, Task 2 and Task 3; `LinkStatus` values match the hook.
