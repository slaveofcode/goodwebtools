# Voice to Text — Implementation Plan

Spec: `docs/superpowers/specs/2026-08-01-voice-to-text-design.md`. TDD per task:
failing test → confirm fail → implement → confirm pass. Pure libs first, island last.

## Task 0 — Dependency
- `npm i @huggingface/transformers` (`.npmrc` handles peer deps).
- Add `@huggingface/transformers` chunk glob to `astro.config.mjs` `workbox.globIgnores`.

## Task 1 — `stt.lib.ts` (pure) + tests
- `TranscriptSegment`, `mixToMono`, `segmentsToText`, `formatClock`,
  `formatSrtTime`, `formatVttTime`, `segmentsToSrt`, `segmentsToVtt`.
- Tests cover formatting edge cases + null-end fallback + channel averaging.

## Task 2 — `stt-audio.lib.ts`
- `decodeToMono16k(blob)` via `AudioContext({ sampleRate: 16000 })`, reuse `mixToMono`.
- Browser API → build + manual smoke (no unit test).

## Task 3 — `stt.engine.ts` (SDK boundary)
- `createTranscriber(model, onProgress)`; WebGPU feature-detect; map chunks→segments.
- Dynamically `import('@huggingface/transformers')`. Build + manual smoke.

## Task 4 — `useAudioRecorder.ts` + tests
- MediaRecorder capture → Blob; typed errors; track cleanup. Tests mock
  `getUserMedia` + a fake `MediaRecorder`.

## Task 5 — Island `VoiceToText.tsx`
- Record/upload input, model selector, progress bar, transcribe, tabbed output
  (Text / Timestamped / Subtitles), copy + download (.txt/.srt/.vtt).

## Task 6 — Register + verify loop
- Registry entry (`voice-to-text`, Media, `Mic`, beta).
- `vitest run` + `lint` + `build` green; resolve any transformers.js/Vite SSR issue
  (optimizeDeps.exclude / ssr.external); no precache warning.
