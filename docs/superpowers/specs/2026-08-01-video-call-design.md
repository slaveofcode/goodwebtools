# Web Video Call — Design

**Date:** 2026-08-01
**Tool:** Network → Video Call (`/tools/video-call`) — NEW
**Type:** New tool (WebRTC media)
**Icon:** `Video` (lucide-react)
**Category:** Network

Item #5 of the batch. Reuses the entire P2P infrastructure built for file transfer
(`SignalRoom` Durable Object, `signal.lib`, `signal-client`, `ice.lib`, manual serverless
mode, ack gate, reconnect logic). The difference: **media tracks instead of a data channel**,
and it's **symmetric** — both peers capture and display camera+mic.

## Scope (from the scope decision)

- **Basics:** mute mic, camera on/off, switch front/rear camera, hang up.
- **Screen sharing:** either participant can replace their outgoing camera with their screen
  (`getDisplayMedia` + `RTCRtpSender.replaceTrack`, no renegotiation); both can share at once
  (each sees the other's shared screen). Stopping restores the camera.
- **In-call text chat:** a small chat over a WebRTC **data channel** alongside the media.

1:1 only (room capacity 2, already enforced by the DO). RTMP is not involved (browsers can't
publish RTMP). STUN-only by default; users can add their own TURN in Advanced settings.

## Reuse vs new

**Reused unchanged:** `signal.lib`, `signal-client.ts`, `ice.lib.ts`, `SignalRoom` DO,
the ack gate + Advanced settings UI pattern, Network category.

**Generalized (additive, low-risk to file transfer):**
- `peer.ts` `createPeer` — add optional `localStream?: MediaStream` (adds its tracks) and
  `onTrack?: (stream: MediaStream) => void` (wires `pc.ontrack`). Data-channel path
  (`onChannel`) unchanged. Adding tracks triggers `onnegotiationneeded` → offer, same as the
  data channel does.
- `manual.ts` `createManualConnection` — same optional `localStream` / `onTrack`.

**New:**
- `src/tools/webrtc/chat.lib.ts` — pure chat message encode/decode (tested).
- `src/hooks/useVideoCall.ts` — orchestrates media capture + signaling + media peer + chat.
  Signaling/reconnect logic mirrors `useFileTransfer` (kept separate to avoid destabilizing
  the shipped file-transfer hook; a future refactor can extract a shared core).
- `src/islands/network/VideoCall.tsx` — the tool UI.
- Registry entry `video-call`.

## Media capture (inside `useVideoCall`)

- `getUserMedia({ video: { facingMode }, audio: true })` → local stream; show a self-view.
- **Mute mic / camera off:** toggle `track.enabled` on the local audio/video track (no
  renegotiation).
- **Switch camera:** re-`getUserMedia` with the other `facingMode`; `replaceTrack` the video
  sender with the new track; stop the old track. (Reuses the release-before-acquire lesson
  from `useCamera`.)
- **Screen share:** `getDisplayMedia({ video: true })` → `replaceTrack` the video sender with
  the screen track; on the screen track's `ended` (user clicks the browser "stop sharing"),
  restore the camera track. Toggle button.
- **Hang up:** close the peer + signaling, stop all local tracks.

## Peer / negotiation

Both peers add their local tracks at peer creation, so the offer (initiator) and answer
(guest) each include their media (`sendrecv`). The initiator also creates the chat data
channel. `pc.ontrack` delivers the remote stream → attach to the remote `<video>`.

Roles + reconnection identical to file transfer: DO assigns host/guest by join order; host
offers on `peer-joined`; ICE `disconnected` → grace then re-establish; retry cap → "add a
TURN server" message. Manual mode: copy-paste offer/answer codes (media negotiated in the
same SDP, non-trickle).

## Chat (`chat.lib.ts` + data channel)

```ts
export interface ChatMessage { id: string; mine: boolean; text: string; at: number }
export function encodeChat(text: string): string;      // JSON control message
export function decodeChat(raw: string): string | null; // validated text or null
```

The island keeps the message list; `at`/`id` are stamped in the island (not the pure lib, to
keep it deterministic/testable). Chat sends over the same data channel; media is separate.

## Island (`VideoCall.tsx`)

1. **Ack gate + Advanced settings** — reuse the file-transfer pattern (auto link / manual /
   custom STUN-TURN), same copy about the limited/optional signaling server. A shared link
   (`/tools/video-call#<roomId>`) invites the other person.
2. **Pre-join:** request camera/mic, show local self-view, "Start call" (auto) or role pick
   (manual).
3. **In call:** large **remote video**, small **local self-view** (mirrored), a control bar
   (Mic / Camera / Screen share / Switch camera / Hang up), and a collapsible **chat** panel.
4. **States:** waiting for peer, connecting, in-call, peer left, error (with the TURN hint).
5. Permission/`NotAllowed`/`NotReadable` errors surfaced clearly (reuse `useCamera`'s error
   taxonomy shape).

## Testing

- `chat.lib.test.ts` — `encodeChat`/`decodeChat` round-trip; rejects malformed/oversized/empty.
- `peer.ts` / `manual.ts` generalization: covered by the existing file-transfer tests still
  passing (data-channel path unchanged) + the local DO relay test. Media/track paths are
  browser-only → build + manual smoke (two devices: see/hear each other, chat, screen share,
  switch camera, hang up).
- `useVideoCall` + island: build + manual smoke.

## Out of scope

- More than 2 participants (would need an SFU; DO room is 1:1).
- Recording the call.
- Simultaneous camera **and** screen as separate tiles (screen replaces camera for now).
- RTMP/broadcast.
