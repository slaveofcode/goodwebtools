# Daily Word Guess — Implementation Plan

Spec: `docs/superpowers/specs/2026-08-30-word-guess-design.md`
Branch: `feat/word-guess` (off `origin/develop`)

## Task 1 — Word data `src/tools/games/wordguess.words.ts` + tests

- `EN_ANSWERS` (≥ 800 common 5-letter words), `EN_EXTRA` (valid guesses beyond answers), `ID_ANSWERS` (≥ 400), `ID_EXTRA`; each a space-separated string blob → exported arrays; export `wordSets(lang)` returning `{ answers, valid }` Sets.
- Tests (`wordguess.words.test.ts`): every list — all words match `/^[a-z]{5}$/`, no duplicates, min sizes; `valid` set ⊇ answers; no overlap between EN and ID answer lists (each word appears in one language's answers only — avoids cross-language confusion when guessing).

## Task 2 — Pure lib `src/tools/games/wordguess.lib.ts` + tests

- `evaluateGuess(guess, answer): LetterState[]` (`'correct' | 'present' | 'absent'`), two-pass duplicate handling.
- `dayIndex(date?: Date): number` — UTC days since epoch.
- `puzzleNumber(dayIndex): number` — days since 2026-01-01 epoch (+1, so Jan 1 2026 = #1).
- `dailyAnswer(dayIndex, answers): string` — deterministic via mulberry32(dayIndex) first output; EN/ID use the same function (lists differ, so answers differ).
- `updateStats(stats, won, tries): Stats` — played/wins/current+max streak/distribution[6]; losing the daily (or skipping a day) breaks the streak.
- `buildShareText(states: LetterState[][], won, tries, puzzleNumber): string` — emoji grid (🟩🟨⬛), `GoodWebTools Word Guess #N X/6`, no letters leaked.
- `keyboardStates(guesses: string[], answer: string): Record<string, LetterState>` — per-letter priority correct > present > absent.
- Tests: table-driven evaluate cases (duplicates: e.g. guess ROBOT vs answers with repeated letters), determinism of dailyAnswer, streak logic (win yesterday+today → 2; gap → reset), share text shape, keyboard priority.

## Task 3 — Island `src/islands/games/WordGuess.tsx`

- State: `mode: 'daily' | 'practice'`, `guesses`, `status`, loaded from localStorage per lang on mount (SSR-safe: empty initial state, hydrate in effect).
- Input: physical keyboard listener + on-screen QWERTY (3 rows + ENTER/⌫) with per-key state coloring; 5×6 tile grid with flip animation (`prefers-reduced-motion` respected, pattern from Game2048 KEYFRAMES).
- Toasts: not enough letters / not in word list / win / lose + answer reveal.
- End panel: stats summary, distribution bars, CopyButton share, countdown to next UTC midnight, Practice button (random word, in-memory, restartable).
- Persistence: state after each guess; stats on finish (daily only). Practice never writes storage.
- `TR` en/id strings; intro line above the board (self-explanatory before scrolling to how-to).

## Task 4 — Register + SEO

- `tools.ts`: `{ id: 'word-guess', name: 'Daily Word Guess', category: 'Games', route: '/tools/word-guess', keywords: [...], icon: WholeWord, summary, load: () => import('@/islands/games/WordGuess'), status: 'beta' }` next to the other games.
- `tool-seo.ts`: full EN + ID entries (title/description/intro/howTo/faqs) next to `'snake'` in both blocks. ID copy keeps "tool" untranslated, technical terms as-is.

## Task 5 — E2E `e2e/tools/word-guess.spec.ts`

- Fresh context → load `/tools/word-guess`; click on-screen keys to enter 6 valid fixed words (words from the EN lists, e.g. CRANE, STONE, …) with ENTER each; assert end panel + share button visible (win or lose, both reach the panel); assert a second ENTER after game over doesn't add rows.
- Also: invalid word path — type a non-word, ENTER, toast "not in word list", no row committed.

## Task 6 — Verify loop

- `npx vitest run` · `npm run test:e2e -- --grep word-guess` (plus full smoke) · `npm run lint` · `npm run build` (confirm `/tools/word-guess/index.html` + `/id/tools/word-guess/index.html`).
- Hand-review: hydration safety, localStorage try/catch on every path, no objectURL/leaks, reduced-motion, error/empty paths.
