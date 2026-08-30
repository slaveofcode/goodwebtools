# Fruit Merge — Implementation Plan

Spec: `docs/superpowers/specs/2026-08-30-fruit-merge-design.md`
Branch: `feat/fruit-merge` (off `origin/develop`)

## Task 1 — Pure lib `src/tools/games/fruitmerge.lib.ts` + tests

Types: `Fruit { id, x, y, vx, vy, tier }`; `World { fruits, nextId, score, over }`; constants `TIER_RADII[11]`, `MERGE_SCORES[11]`, `BOX { w: 360, h: 480, wall: 10 }`, `DROP_Y`, `DEADLINE_Y`, `MAX_DROP_TIER = 5`.

Functions:
- `stepWorld(w, dt, opts?): World` — immutable update: gravity integrate → 8 iterations of (wall clamp + pair positional correction/impulse) → damping → merge pass (same-tier contact pairs, ascending id order, midpoint spawn, score += MERGE_SCORES[tier], cascade-safe: one pass per step) → game-over check (fruit center above deadline with speed < CALM_SPEED for CALM_FRAMES consecutive steps).
- `dropFruit(w, x, tier, rng?): World` — spawn at DROP_Y clamped to walls.
- `pickDropTier(rng): 0..4` — first 5 tiers, random.
- `isOverLine(f) / wouldRest(...) helpers` as needed.

Tests (deterministic, no canvas): fruit falls under gravity; lands on floor and settles (speed → ~0); wall clamp keeps fruits inside; two same-tier fruits touching merge into tier+1 at midpoint with correct score; different tiers touching don't merge; merge chain across steps; game-over triggers when a fruit rests above the deadline; not triggered by a fast-moving fruit crossing the line; dropFruit clamps x. Table-driven where apt.

## Task 2 — Island `src/islands/games/FruitMerge.tsx`

- Refs: world in a `useRef`, RAF loop with fixed-step accumulator (dt = 1/60, 2 substeps), canvas 360×480 logical scaled by DPR.
- Held fruit + next preview state; drop cooldown 500 ms; pointer move (clamp x to walls minus radius), pointerup drops.
- Render: box walls, deadline dashed line, fruits (per-tier flat color + rim), guide line under held fruit, next preview chip, score/best header.
- Game over overlay: final score, best, restart button. Best persisted (`gwt-fruitmerge-best-v1`) with try/catch.
- TR en/id strings, intro paragraph, `useExpand` optional (skip — canvas is fixed logical size, responsive via max-width).

## Task 3 — Register + SEO

- `tools.ts`: `id: 'fruit-merge'`, Games, route `/tools/fruit-merge`, keywords (suika, watermelon game, merge, fruit drop, Gabungin buah…), icon `Apple` (verify exists in lucide), status beta.
- `tool-seo.ts` EN + ID entries next to the games (title/description/intro/howTo/faqs). ID keeps "tool" untranslated.

## Task 4 — E2E `e2e/tools/fruit-merge.spec.ts`

- Load page, assert canvas visible. Click/tap the canvas at a fixed x twice with the same next-tiers forced? — RNG not injectable in the page, so instead: drop ~10 fruits at varied positions; assert score number becomes > 0 eventually (same-tier drops are statistically certain with tier pool 5 across 10 drops) OR keep it deterministic by asserting non-loss invariants: score element exists, best exists, fruits render (canvas non-blank via pixel sample).
- Assert restart button appears after playing and resets the score.

## Task 5 — Verify loop

`npx vitest run` · `npm run test:e2e -- --grep fruit-merge` (+ full suite) · `npm run lint` · `npm run build` (both locales built). Hand-review: RAF cancellation on unmount, no SSR window access, listener cleanup, reduced-motion, error paths.
