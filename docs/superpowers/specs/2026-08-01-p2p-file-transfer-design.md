# P2P File Transfer + WebRTC Signaling — Design

**Date:** 2026-08-01
**Tool:** Files → P2P File Transfer (`/tools/file-transfer`) — NEW
**Type:** New tool + first server-side component (Durable Object signaling)
**Icon:** `Send` (lucide-react)
**Category:** Files

This is item 6 of the batch, built **first** because it is the simpler of the two WebRTC
tools (data channel only). It establishes the **shared signaling + peer-connection
infrastructure** that the Video Call (item 5) will reuse.

## Problem

Users want to send a file directly to another person's device (like relay.rishishah.in),
peer-to-peer, without the file passing through a server. Browsers can do this with WebRTC
data channels, but two peers must first exchange a small connection handshake — which needs
a **signaling** rendezvous.

## Goal

- **File bytes travel peer-to-peer** (WebRTC data channel) and never touch our server.
- A tiny **signaling server** (Cloudflare Durable Object on the existing Worker) relays only
  the ~2KB SDP/ICE handshake between the two peers in a room.
- **Mandatory ack before connecting:** the user must acknowledge that connecting uses our
  signaling server to introduce the two devices, before any WebSocket opens.
- **STUN-only** (public STUN servers). No TURN → if both peers are behind strict/symmetric
  NAT, show a clear "couldn't connect on this network" message.

## Architecture

```
Sender browser  ──WS──┐                        ┌──WS──  Receiver browser
                      ▼                         ▼
              Cloudflare Worker (worker/index.js)
                      │  /api/signal/<roomId>  (WebSocket upgrade)
                      ▼
              Durable Object  SignalRoom   (relays offer/answer/ICE only)

Sender ───────────── WebRTC DataChannel (file bytes, P2P) ───────────── Receiver
```

### Server (Cloudflare Worker + Durable Object)

- **`worker/signal-room.js`** — `export class SignalRoom extends DurableObject`
  (from `cloudflare:workers`), WebSocket **Hibernation API**:
  - `fetch(request)`: on `Upgrade: websocket`, create a `WebSocketPair`, `ctx.acceptWebSocket(server)`.
    - Room capacity **2**. If already 2 sockets → `server.send({type:'full'})` then
      `close(4001,'full')`.
    - First socket → role `host`; second → role `guest`. Send each a
      `{type:'welcome', role}` message; when the guest joins, also send the host
      `{type:'peer-joined'}` so it starts the WebRTC offer.
  - `webSocketMessage(ws, msg)`: **relay** — forward `msg` verbatim to every *other* socket
    in `ctx.getWebSockets()`. (This carries `offer` / `answer` / `ice`.)
  - `webSocketClose(ws, ...)`: notify the remaining peer `{type:'peer-left'}`.
- **`worker/index.js`** — add, before the `/models/` branch:
  ```js
  if (url.pathname.startsWith('/api/signal/')) {
    if (request.headers.get('Upgrade') !== 'websocket')
      return new Response('Expected WebSocket', { status: 426 });
    const roomId = url.pathname.slice('/api/signal/'.length);
    if (!/^[a-z0-9]{6,32}$/.test(roomId)) return new Response('Bad room', { status: 400 });
    return env.SIGNAL.getByName(roomId).fetch(request);
  }
  ```
  Re-export the class: `export { SignalRoom } from './signal-room.js';`
- **`wrangler.jsonc`** — add to BOTH top level and `env.staging` (named envs don't inherit):
  ```jsonc
  "durable_objects": { "bindings": [ { "name": "SIGNAL", "class_name": "SignalRoom" } ] },
  "migrations": [ { "tag": "v1", "new_sqlite_classes": ["SignalRoom"] } ]
  ```
  `new_sqlite_classes` = the free-tier SQLite-backed Durable Object (no extra cost).

### Client libraries (`src/tools/webrtc/`)

- **`signal.lib.ts`** (pure, tested):
  - `type SignalRole = 'host' | 'guest'`
  - `type SignalMessage` — welcome / peer-joined / peer-left / full / offer / answer / ice.
  - `makeRoomId(): string` — 10 lowercase-alnum chars from `crypto.getRandomValues`.
  - `roomLink(origin: string, roomId: string): string` → `${origin}/tools/file-transfer#${roomId}`.
  - `roomIdFromHash(hash: string): string | null` — parse `#<id>` (validates charset).
  - `parseSignal(raw: string): SignalMessage | null` — safe JSON parse + shape guard.
- **`file-transfer.lib.ts`** (pure, tested):
  - `CHUNK_SIZE = 16 * 1024`.
  - `interface TransferMeta { name: string; size: number; mime: string }`
  - `chunkCount(size, chunkSize?): number`; `chunkRange(index, size, chunkSize?): [start, end]`.
  - `formatBytes(n): string`; `percent(done, total): number`.
  - `encodeMeta(meta)/decodeMeta(raw)` for the JSON control message that precedes the bytes.
- **`signal-client.ts`** (browser, smoke): thin `WebSocket` wrapper — connect, `send(msg)`,
  `onMessage`, `onClose`; JSON via `signal.lib`.
- **`peer.ts`** (browser, smoke): `createPeer({ initiator, onState, onChannel, sendSignal })`
  wrapping `RTCPeerConnection` with public STUN
  (`stun:stun.l.google.com:19302`, `stun:stun.cloudflare.com:3478`). Perfect-negotiation-lite:
  host creates the data channel + offer on `peer-joined`; guest answers. ICE candidates
  flow through `sendSignal`. Exposes `applySignal(msg)`.

### Hook (`src/hooks/useFileTransfer.ts`, browser, light tests for pure transitions)

Orchestrates signal-client + peer + data-channel transfer. State machine:
`idle → connecting → waiting-for-peer → connected → transferring → done | error`.
- Sender: on `connected`, user picks a file → send `TransferMeta` (JSON) then chunks with
  **backpressure** (`bufferedAmountLowThreshold`, pause when `bufferedAmount` high) →
  progress → `done`.
- Receiver: read `TransferMeta`, accumulate `ArrayBuffer` chunks until `size` reached →
  assemble `Blob` → expose for download.
- Releases the peer, data channel, and socket on unmount / reset.

### Island (`src/islands/files/FileTransfer.tsx`, thin)

1. **Ack gate (required):** first render shows a notice —
   > "To connect two devices, GoodWebTools uses a small signaling server to exchange
   > connection details (~2KB). Your files transfer **directly, peer-to-peer**, and never
   > pass through our server. Connections are best-effort and may fail on very restrictive
   > networks."
   with a **Continue** button. Nothing connects until Continue is clicked.
2. **Role:** if the URL has `#<roomId>` → **receiver** (auto-join after ack). Else →
   **sender**: generate a room, show the **shareable link** + Copy button + "waiting for the
   other device…".
3. On `connected`: sender gets a Dropzone/file picker; on send, a progress bar (bytes +
   %). Receiver shows the incoming filename/size + progress, then a Download button
   (`downloadService`).
4. Connection failures (ICE failed / peer-left / full room) → `Alert` with the specific
   reason.
5. Uses `ProgressBar` (determinate) for transfer progress; plain text for "connecting".

## Testing

- `signal.lib.test.ts` — `makeRoomId` (length/charset, two calls differ); `roomLink`;
  `roomIdFromHash` (valid `#abc123`, rejects junk/empty); `parseSignal` (valid types,
  rejects malformed JSON and unknown shapes).
- `file-transfer.lib.test.ts` — `chunkCount` (exact multiple + remainder + zero);
  `chunkRange` (first/middle/last clamps to size); `percent` (0/partial/100, clamps);
  `formatBytes`; `encodeMeta`/`decodeMeta` round-trip + rejects bad input.
- `useFileTransfer.test.ts` — reducer/state-transition helper unit-tested with fakes where
  practical (mock `RTCPeerConnection`/`WebSocket` minimally); the full media path is
  **smoke on staging**.
- **Server/DO + real connection:** verified on **staging** by a Node script that opens two
  WebSockets to `/api/signal/<room>` and asserts the relay (welcome/peer-joined/echo of an
  offer). This exercises the Durable Object end-to-end before promoting to production.

## Deploy note (important)

The Durable Object + migration deploy via the existing **Workers Builds** integration
(wrangler.jsonc). First deploy to **develop → staging** and run the signaling smoke test
against `goodwebtools-staging.workers.dev` BEFORE promoting to production. If the account
can't create DOs, the deploy fails cleanly (no user-facing harm) — surface it and stop.

## Out of scope (this item)

- Video call (item 5 — reuses `signal.lib`, `signal-client`, `peer`).
- TURN relay (STUN-only for now).
- Multiple files per transfer / folders (one file at a time; can send another after).
- Resumable transfers, end-to-end encryption beyond WebRTC's built-in DTLS.
