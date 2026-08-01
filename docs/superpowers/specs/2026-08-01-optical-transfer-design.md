# Optical File Transfer ("QR Beam") — Design

**Date:** 2026-08-01
**Tool:** Network → Optical File Transfer (`/tools/optical-transfer`) — NEW
**Type:** New tool
**Icon:** `ScanLine`
**Category:** Network

Inspired by Decimen Optical Transfer (MIT). Transfer a file between two devices using **only
a screen and a camera** — no network at all. The sender shows an animated stream of QR codes;
the receiver's camera reads them and reconstructs the file. Even more "no server" than the
WebRTC P2P transfer — works air-gapped.

## Core idea — LT fountain coding

The camera will miss/blur frames, so we can't send "block 1, block 2, …". Instead, each QR
frame is an **XOR of a pseudo-random subset of file blocks**, with the subset derived
deterministically from the frame's **sequence number** (both sides share the PRNG). The
receiver collects frames in any order until it has ~K×1.15 of them and solves the file by
peeling (belief propagation). No pairing, no ACKs, no retransmission — the sender just loops.

## Files

- `src/tools/optical/fountain.lib.ts` (pure, TDD) — the LT codec:
  - `mulberry32(seed)` deterministic PRNG.
  - `robustSoliton(K)` degree distribution + `sampleDegree(rng, dist)`.
  - `frameIndices(seq, K)` → deterministic block indices for a frame (seed rng with seq).
  - `bytesToBlocks(bytes, blockSize)` / `blocksToBytes(blocks, size)`.
  - `LtEncoder(blocks)` → `frame(seq): Uint8Array` (XOR of `frameIndices` blocks).
  - `LtDecoder(k, blockSize)` → `addFrame(seq, payload): boolean` (done?), `progress()`, `recover(): Uint8Array`.
    Peeling decoder: reduce each equation by solved blocks; when a frame reaches degree 1,
    solve + cascade.
- `src/tools/optical/frame.lib.ts` (pure, TDD) — wire format for one QR frame:
  - `encodeFrame({ session, k, size, seq, payload })` → bytes (magic, version, session u16,
    k u24, size u32, seq u32, payload). `decodeFrame(bytes)` → parsed | null (validates magic).
  - `fnv1a(bytes)` small hash for a session id + integrity.
- `src/tools/optical/qr.lib.ts` — QR render (qrcode, byte-mode segment) + jsqr decode wrappers
  (browser; build + manual smoke).
- `src/hooks/useOpticalReceive.ts` — camera loop: grab frame → jsqr → decodeFrame → decoder →
  progress → complete. Reuses camera handling.
- `src/islands/network/OpticalTransfer.tsx` — role picker; Send (Dropzone → animated QR,
  looping seq via rAF at a target fps) / Receive (camera + progress + download).
- `src/registry/tools.ts` — register `optical-transfer` (Network, `ScanLine`, beta).

## Parameters

- **Block size** ~256 bytes (payload fits a mid-density QR that scans reliably from a phone).
- **QR:** byte-mode segment, ECC level **L** (max capacity; fountain coding already handles loss).
- **Frame rate:** target ~10 fps sender (configurable); receiver decodes as fast as it can.
- **Throughput (v1, jsqr):** modest (~KB/s) — great for text, keys, configs, small images. A
  future zxing-wasm + Worker upgrade would raise it (that's what Decimen uses for ~129 KB/s).
  A soft size cap warns for large files.

## Decoding correctness

Robust soliton produces enough degree-1 frames to bootstrap peeling and keeps overhead near
~10-15%. `frameIndices` MUST be identical on both sides (deterministic PRNG seeded by seq
only). The frame carries `k`/`size`/`session` so the receiver is fully autonomous from any
frame. A session hash guards against mixing frames from a different transfer.

## Testing (Vitest — the whole codec is headless-testable)

- `fountain.lib.test.ts` — PRNG determinism; `frameIndices` deterministic + within range +
  degree matches; **round-trip**: random bytes → blocks → generate ~K×1.3 frames (in random
  order, drop some) → decode → recovers original exactly, for several sizes. Degenerate K=1.
- `frame.lib.test.ts` — encode/decode round-trip; rejects bad magic/truncated; `fnv1a` stable.
- QR/camera/island: build + manual smoke (two devices; beam a small file).

## Out of scope (v1)

- zxing-wasm / Worker decode (throughput upgrade — follow-up).
- Multi-file, folders, resume.
- Big files (soft-capped; it's an optical channel).
