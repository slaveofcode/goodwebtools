# Voice to Text Tool — Design

**Date:** 2026-08-01
**Tool:** Media → Voice to Text (`/tools/voice-to-text`) — NEW
**Type:** New tool (on-device ML)
**Icon:** `Mic` (lucide-react)
**Category:** Media

## Problem

Users want to transcribe speech to text — from a microphone recording or an uploaded
audio/video file — without sending their audio to a server.

## Goal

A privacy-first, **fully on-device** transcription tool. Audio never leaves the browser;
only the Whisper model weights are fetched from a CDN at runtime (same trade-off the OCR
tool already makes). Output as editable plain text, subtitle files (SRT/VTT), and an
inline timestamped view.

## Approach

On-device Whisper via **transformers.js** (`@huggingface/transformers`) — it wraps
onnxruntime-web (already a project dep), provides the `automatic-speech-recognition`
pipeline with a WebGPU→WASM device option, a model-download `progress_callback`, and
segment timestamps via `return_timestamps: true`. Dynamically imported inside the engine
boundary so the island chunk stays small; its built chunk + ORT wasm are added to
`workbox.globIgnores`.

**Scope (YAGNI):** batch "record/upload → transcribe," **not** live streaming
transcription. Streaming (WhisperTextStreamer) is a possible follow-up.

## Verified API (transformers.js v3, confirmed via docs)

```js
import { pipeline } from '@huggingface/transformers';
const transcriber = await pipeline('automatic-speech-recognition', modelId, {
  device: 'webgpu' | 'wasm',
  dtype,                 // e.g. 'q8' on wasm to shrink the download
  progress_callback,     // { status, file, progress, loaded, total }
});
const out = await transcriber(float32AudioAt16k, {
  return_timestamps: true,
  chunk_length_s: 30,
  stride_length_s: 5,
});
// out = { text: string, chunks: [{ timestamp: [start, end], text }] }
```

Models (`onnx-community/*`, ONNX-ready):
- **English · Fast** → `onnx-community/whisper-tiny.en`
- **English · Accurate** → `onnx-community/whisper-base.en`
- **Multilingual** → `onnx-community/whisper-base` (auto-detects language)

## Files

- `src/tools/media/stt.lib.ts` — pure transcript formatting (segments→text/SRT/VTT, time
  formatters, `mixToMono`). Unit-tested.
- `src/tools/media/stt.engine.ts` — the ONLY file touching transformers.js. `createTranscriber`.
- `src/tools/media/stt-audio.lib.ts` — `decodeToMono16k(blob)` (Web Audio API; reuses `mixToMono`).
- `src/hooks/useAudioRecorder.ts` — mic capture via MediaRecorder → Blob. Unit-tested (mocks).
- `src/islands/media/VoiceToText.tsx` — thin island (default export).
- `src/registry/tools.ts` — register `voice-to-text` (Media, `Mic`, `status: 'beta'`).
- `astro.config.mjs` — add `@huggingface/transformers` chunk glob to `workbox.globIgnores`.

## Library API

### `stt.lib.ts` (pure)

```ts
export interface TranscriptSegment { start: number; end: number; text: string }

export function mixToMono(channels: Float32Array[]): Float32Array; // avg channels
export function segmentsToText(segments: TranscriptSegment[]): string; // trimmed, space-joined
export function formatClock(seconds: number): string;   // 'm:ss' for the inline view
export function formatSrtTime(seconds: number): string; // 'HH:MM:SS,mmm'
export function formatVttTime(seconds: number): string; // 'HH:MM:SS.mmm'
export function segmentsToSrt(segments: TranscriptSegment[]): string;
export function segmentsToVtt(segments: TranscriptSegment[]): string; // 'WEBVTT\n\n' + cues
```

Robustness: a segment with a null/undefined `end` (Whisper can emit an open final
timestamp) falls back to `start`; negatives clamp to 0.

### `stt.engine.ts` (SDK boundary)

```ts
export type SttBackend = 'webgpu' | 'wasm';
export type SttModelId =
  | 'onnx-community/whisper-tiny.en'
  | 'onnx-community/whisper-base.en'
  | 'onnx-community/whisper-base';

export interface Transcriber {
  backend: SttBackend;
  transcribe(audio: Float32Array): Promise<TranscriptSegment[]>;
}

export function createTranscriber(
  model: SttModelId,
  onProgress?: (ratio: number) => void, // 0..1 during model download
): Promise<Transcriber>;
```

- Picks `webgpu` when available (feature-detect `navigator.gpu`), else `wasm` (with a
  quantized `dtype` to shrink the download).
- `transcribe` calls the pipeline with `return_timestamps: true`, maps `out.chunks` →
  `TranscriptSegment[]` (falling back to a single segment from `out.text` if no chunks).

### `stt-audio.lib.ts`

```ts
export function decodeToMono16k(blob: Blob): Promise<Float32Array>;
```

Uses `new AudioContext({ sampleRate: 16000 })` → `decodeAudioData` (resamples to 16k) →
`mixToMono(channels)`; closes the context in a `finally`.

### `useAudioRecorder.ts`

Returns `{ recording, seconds, error, blob, start, stop, reset }`.
`start()` → `getUserMedia({ audio: true })` → `MediaRecorder` collecting chunks; `stop()`
finalizes a `Blob` and releases tracks. Errors map to typed reasons
(`unsupported` / `denied` / `unknown`), mirroring `useCamera`.

## Island (`VoiceToText.tsx`)

1. **Input** — two ways:
   - **Record**: mic button (via `useAudioRecorder`) with a running timer + Stop.
   - **Upload**: `Dropzone` accepting `audio/*,video/*`.
   Either produces a `Blob` shown with a small `<audio>` preview.
2. **Model** selector — English Fast / English Accurate / Multilingual (default Fast).
3. **Transcribe** button → decode (`decodeToMono16k`) → `createTranscriber` (progress bar
   during first-time model download) → `transcribe`.
4. **Output** — tabbed: **Text** (editable textarea) · **Timestamped** (`[m:ss] text`
   lines) · **Subtitles** (SRT / VTT). Copy button + download (`downloadService`):
   `.txt`, `.srt`, `.vtt`.
5. Errors surfaced via `Alert`; busy states are plain (indeterminate) except the
   determinate model-download `ProgressBar`.

## Testing

- `stt.lib.test.ts` — `mixToMono` (mono passthrough + 2-channel average); `segmentsToText`
  (trim/space-join); `formatClock`/`formatSrtTime`/`formatVttTime` (e.g. `3661.5s` →
  `61:01`, `01:01:01,500`, `01:01:01.500`); `segmentsToSrt`/`segmentsToVtt` (index, arrow,
  header, null-end fallback).
- `useAudioRecorder.test.ts` — `start()` acquires a stream (mocked `getUserMedia` +
  fake `MediaRecorder`); missing `mediaDevices` → `unsupported`; `stop()` releases tracks.
- `stt.engine.ts`, `stt-audio.lib.ts`, island → build + manual smoke (record → transcribe →
  check text/SRT/VTT/download).

## Build integration risks (resolve in the verify loop)

- transformers.js may confuse Vite SSR (it references `onnxruntime-node`). Island is
  client-only and the engine is dynamically imported inside a handler, so SSR shouldn't
  touch it; if the build complains, add `@huggingface/transformers` to
  `vite.optimizeDeps.exclude` / `vite.ssr.external`.
- Confirm no PWA precache-size warning for the new heavy chunk (globIgnores covers it).
- `.npmrc` already sets `legacy-peer-deps=true` for install.

## Out of scope

- Live streaming transcription.
- Speaker diarization.
- Translation task (Whisper can translate→English; not exposed in MVP).
- Large/`whisper-large` models (download too heavy for the web MVP).
