# Watermark Scale Slider — Design

**Date:** 2026-07-31
**Tool:** Image → Watermark (`/tools/image-watermark`)
**Type:** Improvement (UX control)

## Problem

The Watermark tool exposes size as three preset buttons (Small `1/16`, Medium `1/10`,
Large `1/6`). Users want continuous control over the watermark size, where a larger
value produces both a bigger font **and** a wider gap between tiled repetitions.

Note: color (font color picker) and transparency (opacity slider) **already exist** in
the tool — this change is scoped to the size control only.

## Goal

Replace the three Size buttons with a continuous **Scale** slider, matching the visual
style of the existing Opacity slider, with a live readout.

## Design

### UI (island: `src/islands/image/ImageWatermark.tsx`)

- Remove the `SIZES` preset buttons block.
- Add a range slider labelled **Scale** with a live `NN%` readout, styled like the
  existing Opacity range input (`type="range"`, `accent-accent`).
- State: `const [scale, setScale] = useState(30)` (percent, 1–100). Default 30%.
- The slider value (percent) maps to the library's `fontScale` fraction:

  ```
  const MIN_FS = 1 / 24; // ≈ 0.0417  (narrow)
  const MAX_FS = 1 / 4;  // 0.25       (big)
  fontScale = MIN_FS + (scale / 100) * (MAX_FS - MIN_FS);
  ```

  30% → ≈ 0.104 (close to the old "Medium" default, so behavior is familiar).

### Library (`src/tools/image/canvas.lib.ts`)

No signature change. `watermarkImage` already accepts a continuous `fontScale`, and the
tiled layout already derives its gap from font size:

```
const stepX = textWidth + fontSize * 2;
const stepY = fontSize * 4;
```

So a larger `fontScale` already yields a bigger font **and** proportionally wider gaps —
"smaller = narrow, bigger = big font & wider gap" is satisfied by the existing math.

We add a **helper + test** to lock the mapping so the contract can't silently regress:

- Export a pure `scaleToFontScale(percent: number): number` from `canvas.lib.ts`
  implementing the mapping above (clamped to 1–100). This keeps the magic numbers in
  the tested lib rather than the island.

## Testing

`src/tools/image/canvas.lib.test.ts` (extend):

- `scaleToFontScale(1)` ≈ `1/24`; `scaleToFontScale(100)` === `0.25`.
- Monotonic: `scaleToFontScale(20) < scaleToFontScale(80)`.
- Clamps: `scaleToFontScale(0)` === `scaleToFontScale(1)`; `scaleToFontScale(150)` === `scaleToFontScale(100)`.

Island is covered by build + manual smoke (slider moves, watermark grows, tiled gap widens).

## Out of scope

- Color and opacity controls (already shipped).
- Layout options (Diagonal / Tiled / Corner) — unchanged.
- No change to output format handling.
