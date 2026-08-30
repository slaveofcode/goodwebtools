# Fruit Merge — Design

**Status:** approved
**Date:** 2026-08-30
**Goal:** A Suika/watermelon-game style physics merge puzzle — the second new "addictive game" (user-approved after Daily Word Guess).

## Game design

- Drop circular fruits from the top of a tall play box. When two fruits of the **same tier** touch, they merge into the next tier at their midpoint and award points.
- 11 tiers (cherry → watermelon), radii grow ~geometrically (16 → 64 px in a 360×480 logical box).
- Drop pool: only tiers 1–5 (like the original), preview of the next fruit.
- **Game over** when a settled fruit stays above the deadline (near the top) for a sustained period. The currently-held fruit doesn't count.
- Score: classic triangular scoring (1, 3, 6, 10, …, 66 for the watermelon merge). Best score persisted in localStorage.
- One-per-game "evolve" is out of scope; no power-ups (keep it pure like the original).

## Physics (hand-rolled, no dependency)

Circles + static walls only — a compact iterative impulse solver is enough and stays unit-testable:

- Pure lib `src/tools/games/fruitmerge.lib.ts`: `stepWorld(state, dt)` — semi-implicit Euler integration, gravity, wall constraints, circle-circle impulses (low restitution ~0.15), positional correction (8 solver iterations), linear damping. Merges resolved after each step (one merge pass per step, highest-priority pairs first — merge is checked on *contact*, not velocity).
- **Deterministic order**: arrays processed in id order so tests are reproducible; the random next-fruit choice is injected (`rng` param), not called inside the lib.
- Game-over detection in the lib: track per-fruit "calm frames above line" — a fruit whose center is above the deadline and whose speed is under a threshold for N consecutive steps triggers loss.
- Island owns the RAF loop (fixed 60 Hz accumulator, substeps), canvas rendering, pointer aim + drop, and the UI chrome.

## UI

- Canvas render of the box + fruits (flat colors + darker rim per tier, subtle face-less minimal style matching the site's brutalist-adjacent look), drop guide line under the held fruit, next-fruit preview, score + best, game-over overlay with restart.
- Pointer/touch: move to aim (clamped so the fruit fits within walls), release/tap to drop. Small cooldown (~500 ms) before the next fruit is handed.
- TR en/id strings; `lang` prop from ToolHost; intro line above the canvas.
- prefers-reduced-motion: fruits still must fall (it's the game), but no decorative animations beyond physics.

## Architecture (GWT conventions)

- Pure lib + tests (`fruitmerge.lib.ts`), thin island (`src/islands/games/FruitMerge.tsx`), registered (`id: 'fruit-merge'`, Games, status `beta'`), full EN/ID SEO entries.
- E2E `e2e/tools/fruit-merge.spec.ts`: drop several fruits via synthetic pointer events, assert score increases after a same-tier merge; assert game-over path is reachable via scripted drops (or at minimum that the board state/score renders and restart works).

## Non-goals

- No sound (site has no audio infra convention yet — can add later), no leaderboard/multiplayer, no decorative particles. Not wired into Ask Agent.

## Naming / trademark

"Fruit Merge" — describes the mechanic; avoids the "Suika Game" trademark. Summary/SEO may say "Suika / watermelon-game style" (nominative use).
