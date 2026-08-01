# P2P File Transfer — Implementation Plan

Spec: `docs/superpowers/specs/2026-08-01-p2p-file-transfer-design.md`. TDD on pure libs;
server + browser wiring smoke-tested on staging before production.

## Task 1 — `src/tools/webrtc/signal.lib.ts` (pure) + tests
`SignalRole`, `SignalMessage`, `makeRoomId`, `roomLink`, `roomIdFromHash`, `parseSignal`.

## Task 2 — `src/tools/webrtc/file-transfer.lib.ts` (pure) + tests
`CHUNK_SIZE`, `TransferMeta`, `chunkCount`, `chunkRange`, `formatBytes`, `percent`,
`encodeMeta`/`decodeMeta`.

## Task 3 — Server signaling
- `worker/signal-room.js` — `SignalRoom` Durable Object (hibernation WS, 2-peer relay).
- `worker/index.js` — route `/api/signal/*`, re-export `SignalRoom`.
- `wrangler.jsonc` — DO binding + `new_sqlite_classes` migration (top level + staging env).

## Task 4 — Client transport (browser, smoke)
- `signal-client.ts` (WebSocket wrapper), `peer.ts` (RTCPeerConnection + STUN + negotiation).

## Task 5 — `useFileTransfer` hook (light tests on pure transitions)
State machine + data-channel send/receive with backpressure; resource cleanup.

## Task 6 — Island `FileTransfer.tsx`
Ack gate → sender (room link)/receiver (from `#hash`) → connect → transfer + progress →
download.

## Task 7 — Register + verify
Registry (`file-transfer`, Files, `Send`, beta). `vitest`/`lint`/`build` green.

## Task 8 — Ship dev → staging → verify DO → promote prod
PR to develop; after staging deploy, run a Node 2-WebSocket signaling smoke test against
`goodwebtools-staging.workers.dev`; only then promote to main. Verify live URL.
