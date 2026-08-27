# Teleprompter — Phone Remote Control — design

**Status:** approved (scope + design) 2026-08-27
**Extends:** the Teleprompter tool (`/tools/teleprompter`, `docs/superpowers/specs/2026-08-27-teleprompter-design.md`)

## Purpose

Let a presenter control the teleprompter from their phone while it displays on a
laptop (or vice-versa): play/pause, change speed, seek, jump to top, toggle
mirror — and see the **same scrolling script in sync** on the phone, so the phone
can be the camera-mounted prompter or a confidence monitor.

The two devices pair over a **direct peer-to-peer connection**. Only the
connection setup (a short room code + WebRTC SDP/ICE) uses our signaling server —
the script and the control messages never pass through it. This is the same model
as the existing File Transfer and Video Call tools.

## Reused infrastructure (do not rebuild)

- `connectSignal(roomId, handlers)` → `SignalClient` (`src/tools/webrtc/signal-client.ts`): WebSocket to the signaling Durable Object at `/api/signal/<roomId>`. Emits role/`peer-joined` messages.
- `createPeer({ initiator, sendSignal, onState, onChannel })` → `PeerHandles` (`src/tools/webrtc/peer.ts`): the initiator creates the `'data'` RTCDataChannel + offer; the other side answers via `ondatachannel`.
- Handshake sequence (from `useFileTransfer`): the DO tells each client its role — `role: 'guest'` → `setupPeer(false)` (answers); `peer-joined` → host `setupPeer(true)` (offer + data channel).
- `qrcode` npm package (already a dependency) for rendering the pairing QR on the display.

## Roles & flow

1. **Display** (has the script) clicks **Pair phone** → `makeRoomId()` → `connectSignal(code)` as host → renders a QR encoding `<origin>/tools/teleprompter?remote=CODE` plus the CODE as typed fallback. Status: "waiting for phone".
2. **Remote** (phone) opens that URL (native camera QR scan) or types the code on the teleprompter page → the island detects `?remote=CODE` (or the typed code) → **remote mode** → `connectSignal(code)` as guest.
3. On `peer-joined`, the host creates the data channel (initiator) and offer; the guest answers. Data channel opens.
4. On open, the **display** sends `{ t: 'script', text }` once, then streams `{ t: 'state', playing, wpm, scrollPct }` (throttled, e.g. ~5/s and on every change). The phone renders the same script and scrolls to `scrollPct`, and its controls reflect `playing`/`wpm`.
5. The phone sends `{ t: 'cmd', cmd, value? }` on button/scrub input. **The display is the single source of truth**: it applies the command (reusing the same state it already owns), then its next `state` echo confirms — no feedback loop, no divergence.

Either device may be the camera-mounted one; the display is simply "the device that holds the script and runs the scroll engine".

## Message protocol — `teleprompter-remote.lib.ts` (pure, tested)

```ts
export type RemoteCmd =
  | { cmd: 'toggle' }                 // play/pause
  | { cmd: 'play' } | { cmd: 'pause' }
  | { cmd: 'faster' } | { cmd: 'slower' }
  | { cmd: 'seek'; value: number }    // scrollPct 0..1
  | { cmd: 'top' }
  | { cmd: 'mirror' };

export type RemoteMsg =
  | { t: 'script'; text: string }
  | { t: 'state'; playing: boolean; wpm: number; scrollPct: number }
  | ({ t: 'cmd' } & RemoteCmd);

export function encodeMsg(m: RemoteMsg): string;      // JSON.stringify
export function decodeMsg(s: string): RemoteMsg | null; // safe parse + shape guard

/** Display-side reducer: fold a command into the prompter's control state.
 *  Pure and bounds-checked (wpm clamped 40..400, scrollPct clamped 0..1). */
export interface RemoteState { playing: boolean; wpm: number; scrollPct: number; mirrorX: boolean; }
export function applyCommand(s: RemoteState, c: RemoteCmd): RemoteState;

/** A short, unambiguous room code (no 0/O/1/I), e.g. 6 chars. */
export function makeRoomId(rng?: () => number): string;

/** The pairing URL the QR encodes. */
export function remoteUrl(origin: string, code: string): string;
```

`applyCommand` mapping: `toggle`→flip playing; `play`/`pause`→set; `faster`/`slower`→±10 wpm clamped; `seek`→set scrollPct (clamped); `top`→scrollPct 0 + playing false; `mirror`→flip mirrorX.

## Connection hook — `useTeleprompterLink.ts`

Wraps `connectSignal` + `createPeer` for control traffic, mirroring `useFileTransfer`'s shape but carrying `RemoteMsg` over the data channel.

```ts
type LinkStatus = 'idle' | 'waiting' | 'connecting' | 'connected' | 'disconnected' | 'error';
interface Link {
  status: LinkStatus;
  connect(code: string, role: 'host' | 'guest'): void;
  send(m: RemoteMsg): void;   // no-op unless the channel is open
  close(): void;
}
function useTeleprompterLink(onMessage: (m: RemoteMsg) => void): Link;
```

- Host: `connectSignal` → on `peer-joined` `setupPeer(true)`; guest: on `role:'guest'` `setupPeer(false)`.
- `onChannel`: wire `channel.onopen`/`onmessage` (decode → onMessage) / `onclose`.
- Teardown closes the channel, peer and signal; nulls refs so nothing auto-restarts.

## Island changes — `Teleprompter.tsx`

- **Display side:** a **Pair phone** button (in the controls bar) opens a small panel: the QR (rendered from `qrcode` to a data URL), the typed code, and a live status ("waiting" / "phone connected" / "phone disconnected"). Once connected, the display streams state and applies incoming `cmd`s via `applyCommand` onto its existing `playing`/`wpm`/scroll/`mirrorX` state. **If the phone drops, the display keeps running unchanged** — the remote is a pure accessory.
- **Remote side:** when the island loads with `?remote=CODE` (or the user types a code into a "connect to a teleprompter" field), it renders **remote mode**: connect as guest; on `script`, tokenize + render the same words; on `state`, scroll to `scrollPct` and reflect `playing`/`wpm`; show a control bar (play/pause, −/+ speed with the wpm readout, a seek slider, jump-to-top, mirror) whose inputs `send({t:'cmd',…})`. No script editor in remote mode.
- Reuse `useExpand` for fullscreen on both sides.

## Data flow

```
DISPLAY (authority)                         REMOTE (phone)
  script/auto/voice ─┐                         │
   apply cmd ◀───────┼──── {cmd} ◀───────── button/scrub
   state ───────────►┼──── {state} ──────────► scroll+reflect
   script (once) ───►┴──── {script} ─────────► render words
```

## Error handling

- Phone disconnects (peer `disconnected`/`closed`): display shows "phone disconnected", keeps running standalone; remote shows "disconnected — rescan to reconnect".
- Signaling fails / room full (two already paired): show a clear message; display continues standalone.
- Unsupported (no WebRTC): Pair button hidden with a note; teleprompter unaffected.
- Guard against message floods: throttle `state` to ~5/s + on change; ignore malformed messages (`decodeMsg` returns null).

## Privacy (honest copy, both locales)

"Your phone pairs over a **direct connection between your two devices**. The
script and the controls are sent device-to-device — only the initial pairing
(a short code and connection details) goes through our server, never the script."

## Testing

- **Unit tests** (`teleprompter-remote.lib.test.ts`): `encodeMsg`/`decodeMsg` round-trip + reject malformed; `applyCommand` for every command incl. clamping; `makeRoomId` format (length, safe alphabet, varies with rng); `remoteUrl`.
- **Island / hook:** the live WebRTC path can't run under `astro preview` (the signaling Worker/DO isn't served there), matching File Transfer's constraint. Verify:
  - Playwright: display renders the QR + code; `?remote=CODE` renders remote mode with a control bar; neither throws.
  - **Manual on production, two devices**: pair via QR, confirm play/pause/speed/seek/mirror and synced scrolling both ways, and that killing the phone leaves the display running.
  This limitation is stated in the plan; we do not fake an E2E pass.

## Definition of done

Spec+plan under `docs/superpowers/`; `teleprompter-remote.lib.ts` unit-tested;
pairing + remote mode in the island; honest privacy copy; suite+lint+build green;
shipped develop→main; live pairing verified on two real devices; PWA hard-refresh
noted. (No new tool id or SEO entry — this extends the existing teleprompter; its
SEO gets a line about phone remote.)
