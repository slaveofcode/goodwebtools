# Daily Word Guess — Design

**Status:** approved
**Date:** 2026-08-30
**Goal:** A Wordle-style daily word game (EN + Bahasa Indonesia) that drives daily return visits; the first "daily puzzle" on GoodWebTools.

## Problem / opportunity

All 7 existing GWT games are arcade-style, one-shot sessions. The most addictive browser-game format of 2026 is the **daily puzzle** (Wordle/Connections/Nerdle): one shared puzzle per day, streak tracking, spoiler-free emoji sharing. It fits GWT perfectly — deterministic daily answer needs no server (client-side only, privacy promise holds), and the PWA makes the daily ritual work offline. No bilingual EN/ID wordle exists at scale; GWT's ID audience is a differentiator.

## Decisions (approved by user)

- **Word lists:** curated bundles, strict validation ("not in word list" rejection). EN + ID answer lists (~years of dailies each) + extra valid-guess lists, bundled as compact string blobs (a few KB gzipped).
- **Practice mode:** yes — unlimited random words, doesn't touch streak/stats.
- **Scope:** ship Word Guess first; Fruit Merge (Suika-style) as a separate follow-up tool.

## Game design

- 6 tries to guess a 5-letter word; green/yellow/gray clues with correct duplicate-letter handling (two-pass: greens first, then yellows against remaining letter counts).
- **Daily answer** deterministic from UTC day index (`floor(t / 86400000)`) hashed against the language's answer list — same word for everyone that day, no server, works offline.
- **Streak + stats** per language, persisted in localStorage (`gwt-wordguess-stats-<lang>-v1`): played, win %, current/max streak, guess distribution.
- **In-progress daily state persisted** (`gwt-wordguess-state-<lang>-v1`): refresh mid-game keeps guesses.
- **Share:** spoiler-free emoji grid + puzzle number, via clipboard. Puzzle number = days since a fixed epoch (2026-01-01), same for everyone.
- **Practice mode:** "Practice" button (any time) starts a random-word game; finished daily stays finished. Practice games are in-memory only.
- UI: on-screen QWERTY keyboard (EN layout covers ID — same 26 letters) + physical keyboard; tile flip animation (respects prefers-reduced-motion); toast messages; end panel with stats, distribution bars, share button, countdown to next puzzle; dark-mode aware via existing site palette; mobile-first.

## Architecture (GWT conventions)

- Pure lib `src/tools/games/wordguess.lib.ts` — `evaluateGuess`, `dayIndex`, `dailyAnswer`, `buildShareText`, `updateStats`, keyboard-state derivation. Vitest-unit-tested.
- Word data `src/tools/games/wordguess.words.ts` — space-separated string blobs → arrays; a test enforces every word is exactly 5 lowercase a–z letters, no duplicates, min count.
- Thin island `src/islands/games/WordGuess.tsx` — no game logic beyond wiring; `lang` prop from ToolHost with en/id `TR` strings.
- Registered in `src/registry/tools.ts` (`id: 'word-guess'`, Games, `WholeWord` icon, status `beta`) + full EN/ID SEO entries in `tool-seo.ts`.
- E2E `e2e/tools/word-guess.spec.ts` — play a full 6-guess daily game via the on-screen keyboard, assert end panel + share button appear; plus the automatic render smoke.

## Non-goals

- No multiplayer, no server, no accounts, no hints/solver (maybe later), no hard-mode toggle (maybe later), no custom word length.
- Not wired into Ask Agent (games aren't executors).

## Naming / trademark

"Daily Word Guess" — describes the mechanic; avoids the Wordle trademark. Summary/SEO may say "Wordle-style" (nominative use, same as clones).
