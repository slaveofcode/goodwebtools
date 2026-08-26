# Teleprompter / Autocue — design

**Status:** approved (scope + design) 2026-08-27
**Tool id:** `teleprompter` · **Category:** Media · **Route:** `/tools/teleprompter` · **status:** `beta`

## Purpose

A browser teleprompter/autocue for YouTubers, streamers, and speakers. Paste a
script, hit start, and read it back at a comfortable pace. Everything runs
client-side — the script never leaves the browser, and the camera/mic are
on-device only.

The differentiator over the many free teleprompters is **voice-tracking**: the
text advances as you actually read it, using on-device speech recognition, so
you never race or lag a fixed scroll speed.

## Scope (decided)

- **Advance modes:** auto-scroll (adjustable speed, play/pause, manual nudge) +
  **voice-tracking** + manual scroll/drag.
- **Pro features:** **mirror mode** (for beam-splitter rigs) and **camera
  preview** (frame yourself behind the text).
- **Out of scope:** countdown + local recording (MediaRecorder). Not built now.

## Architecture — thin island, pure lib

### `src/tools/media/teleprompter.lib.ts` (pure, framework-free, unit-tested)

The logic worth testing lives here; no DOM/browser APIs.

```ts
export interface Token { text: string; norm: string; start: number; end: number }

/** Split a script into words with their character offsets and a normalized
 *  (lowercased, punctuation-stripped) form used for voice matching. */
export function tokenize(script: string): Token[]

/** Voice-tracking core. Given the normalized script words, the reader's current
 *  word index, and the most recent recognized (normalized) spoken words, return
 *  the new index. Fuzzy-aligns the spoken tail against a lookahead window so it
 *  survives skips, filler words and misrecognitions, and NEVER moves backward. */
export function advanceReading(
  scriptWords: string[],
  currentIndex: number,
  spokenWords: string[],
  lookahead?: number, // default ~12
): number

/** Estimated read time in seconds for a word count at words-per-minute. */
export function readingTime(wordCount: number, wpm: number): number

/** Auto-scroll step (px/sec) from a words-per-minute target and measured
 *  average line height + words-per-line, so the speed dial reads in WPM. */
export function scrollSpeed(wpm: number, pxPerWord: number): number
```

**`advanceReading` algorithm.** Keep it simple and robust:
1. Take the last K spoken words (K≈4).
2. Search the window `[currentIndex, currentIndex + lookahead]` of script words for
   the position where the spoken tail best matches (longest run of equal
   normalized words ending at a candidate script index).
3. If a match of ≥1 word is found at script index `j ≥ currentIndex`, return
   `j + 1` (advance past the matched word). Otherwise return `currentIndex`
   unchanged. Never return `< currentIndex`.
4. Ties: prefer the earliest advance (don't skip ahead on a coincidental later
   match).

This gives forgiving forward tracking: filler/misheard words don't advance;
a correctly read word pulls the marker to it; skipping a line still catches up
within the lookahead window.

### `src/islands/media/Teleprompter.tsx` (island — UI + browser APIs)

- **Editor state** (before start): a `TextArea` for the script, a font-size /
  speed / mirror / camera settings row, and a **Start** button. Shows word count
  and estimated time (`readingTime`).
- **Prompter view** (after start): the script rendered as words inside a tall
  scroll container, a fixed **eye-line marker** (a horizontal rule at ~40% from
  top), and the current word highlighted. Large type; adjustable font size, line
  height, horizontal margin, and light/dark.
- **Auto-scroll:** a `requestAnimationFrame` loop advances `scrollTop` by the
  per-frame step derived from the speed dial. **Space** toggles play/pause,
  **↑/↓** change speed, **←/→** or drag nudge position. Manual scroll pauses
  auto-scroll.
- **Voice-tracking:** a toggle. When on, start `SpeechRecognition`
  (`continuous`, `interimResults`) following the existing `LiveCaptions`
  pattern. On each result, normalize the new words and call `advanceReading`;
  scroll so the current word sits on the eye-line and highlight it. Hidden with
  an explanatory note where `SpeechRecognition`/`webkitSpeechRecognition` is
  absent (Safari/Firefox) — auto-scroll still works.
- **Mirror mode:** toggles apply CSS `scaleX(-1)` and/or `scaleY(-1)` to the
  text layer only (not the controls).
- **Camera preview:** a toggle → `getUserMedia({ video })` into a `<video>`
  placed behind the text, mirrored, with an opacity slider. Hidden and
  non-fatal if the user denies permission.
- **Fullscreen:** the existing `useExpand` hook; controls overlay the top,
  respecting `env(safe-area-inset-top)`.
- **Persistence:** the script text and the display settings (font size, speed,
  mirror, colors) are saved to `localStorage` so a session survives a reload.
- **WPM readout:** show the current auto-scroll speed as an approximate WPM and
  the estimated remaining time.

### Data flow

```
script text ──tokenize()──▶ words[] ──render──▶ prompter DOM
                                   │
 play (auto)  ── rAF step ─────────┼──▶ scrollTop += step ; highlight nearest word
 play (voice) ── SpeechRecognition ┘──▶ advanceReading() ──▶ index ──▶ scroll to eye-line + highlight
```

### Resource management (reviewed by hand — the class of bug tests miss)

- Cancel the rAF on pause/exit/unmount.
- `recognition.stop()` and drop handlers when voice-tracking turns off / on
  unmount; guard the auto-restart so it doesn't loop after teardown.
- Stop every `MediaStreamTrack` and null the `video.srcObject` when the camera
  turns off / on unmount.
- Debounce/throttle scroll writes to once per frame; don't thrash layout.

### SSR safety

No `window`/`navigator`/`document` at module scope; feature-detection for
`SpeechRecognition` and `getUserMedia` only inside effects/handlers.

## Error / empty states

- Empty script → the prompter view is disabled; hint to paste text.
- Speech recognition unsupported → voice toggle hidden, one-line note; auto-scroll
  works.
- Camera denied/unavailable → preview hidden, everything else works.

## Testing

- **Lib unit tests** (`teleprompter.lib.test.ts`):
  - `tokenize`: words, offsets, normalization (punctuation/case), empty input.
  - `advanceReading`: advances on a correct word; ignores filler/misheard words;
    catches up after a skipped word within lookahead; never moves backward; no
    spurious jump on a coincidental later match.
  - `readingTime` / `scrollSpeed`: table-driven.
- **Island:** build + Playwright smoke (paste script → start → auto-scroll moves;
  mirror flips; toggles don't crash without camera/speech).

## SEO (both locales, required)

`tool-seo.ts` EN + ID entries: title ("Free Teleprompter / Autocue — …"),
description (~150 chars, "in your browser, nothing uploaded"), intro, `howTo`
(paste script → adjust speed/size → Start → read; voice-tracking; mirror;
camera; fullscreen), and 3–5 FAQs (uploaded? / voice-tracking browsers / mirror
for rigs / camera privacy / offline PWA). Bahasa: keep the loanword "tool".

## Definition of done

Spec+plan under `docs/superpowers/`; lib unit-tested; EN+ID SEO built at
`/tools/teleprompter/` and `/id/tools/teleprompter/`; suite+lint+build green;
shipped develop→main; live URL verified; PWA hard-refresh noted.
