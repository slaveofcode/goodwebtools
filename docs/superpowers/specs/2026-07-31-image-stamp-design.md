# Image Stamp Tool — Design

**Date:** 2026-07-31
**Tool:** Image → Stamp (`/tools/image-stamp`) — NEW
**Type:** New tool
**Icon:** `Stamp` (lucide-react)

## Problem

Users want to slap a document-status **stamp** onto an image — the classic bordered
"rubber stamp" mark (CONFIDENTIAL, PAID, …), not a subtle repeated watermark. It should
be customizable: text, bold, italic, font family, color, placement, and an optional
border box.

This is distinct from the existing **Watermark** tool (subtle, tiled/diagonal, protective
overlay). A stamp is a single bold status mark.

## Goal

A new client-side tool that composites a rubber-stamp mark onto an uploaded/pasted image
and returns it via the shared `ImageResult` (Download / Copy / Edit in Annotator).

## Design

### Files

- `src/tools/image/stamp.lib.ts` — pure logic (helpers + geometry + `stampImage`).
- `src/tools/image/stamp.lib.test.ts` — unit tests for the pure helpers/geometry.
- `src/islands/image/ImageStamp.tsx` — thin island (default export).
- `src/registry/tools.ts` — register `image-stamp` (Image, `Stamp` icon, `status: 'beta'`).

### Controls (island)

- **Dropzone** + paste (`usePasteImage`) — same pattern as Watermark.
- **Preset chips** — clicking one fills the text and sets a sensible default color; text
  stays editable. Presets:
  `Confidential` (red), `Paid` (green), `Draft` (gray), `Approved` (green), `Void` (red),
  `Urgent` (red), `Copy` (blue), `Original` (blue), `Sample` (orange), `For Review` (orange).
- **Text** input (free text).
- **Font family** dropdown: Sans / Serif / Mono / Condensed.
- **Bold** toggle, **Italic** toggle.
- **Color** picker.
- **Border box** toggle (default ON) — the bordered rubber-stamp look; off = plain text.
- **Placement**: Center (diagonal) / Top-left / Top-right / Bottom-left / Bottom-right.
- **Scale** slider (1–100%) and **Opacity** slider (1–100%, default 85%).
- **Apply stamp** / **Clear** buttons → `ImageResult`.

### Library API (`stamp.lib.ts`)

```ts
export type StampFont = 'sans' | 'serif' | 'mono' | 'condensed';
export type StampPlacement = 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface StampOptions {
  text: string;
  color: string;          // hex
  bold: boolean;
  italic: boolean;
  font: StampFont;
  bordered: boolean;
  placement: StampPlacement;
  scale: number;          // 1–100 percent
  opacity: number;        // 1–100 percent
}

// Pure, unit-tested:
export const STAMP_PRESETS: { label: string; color: string }[];
export function fontStackFor(font: StampFont): string;
export function stampFontScale(percent: number): number; // 1/16..1/3, clamped
export interface StampGeometry { cx: number; cy: number; boxW: number; boxH: number; rotation: number; }
export function stampGeometry(args: {
  canvasW: number; canvasH: number; textW: number; fontSize: number; placement: StampPlacement;
}): StampGeometry;

// Canvas draw (build + manual smoke, like watermarkImage):
export function stampImage(file: File, options: StampOptions): Promise<ProcessedImage>;
```

**Geometry rules** (`stampGeometry`, pure):
- `padding = fontSize * 0.4`; `boxW = textW + padding*2`; `boxH = fontSize + padding*2`.
- `center`: `cx=W/2, cy=H/2, rotation = -20°` (radians). This is the classic diagonal look.
- corners: `margin = fontSize * 0.6`; box centered `margin` in from the chosen corner;
  `rotation = 0`.

**`stampImage` draw** (in canvas):
1. `createImageBitmap(file)` → draw onto a canvas of the same size.
2. Compute `fontSize = max(14, round(min(W,H) * stampFontScale(scale)))`, set
   `ctx.font = \`${italic?'italic ':''}${bold?'bold ':''}${fontSize}px ${fontStackFor(font)}\``.
3. `textW = ctx.measureText(text).width`; `g = stampGeometry(...)`.
4. `ctx.globalAlpha = opacity/100`; translate to `(g.cx,g.cy)`, rotate `g.rotation`.
5. If `bordered`: stroke a rounded-rect of `g.boxW × g.boxH` centered at origin, with
   `lineWidth = max(2, fontSize*0.1)`, same color.
6. Draw text centered (`textAlign='center'`, `textBaseline='middle'`) in `color`.
7. Restore alpha; `encodeCanvas` preserving the input format (`keepFormat`).

Reuse `keepFormat`, `encodeCanvas`, `ProcessedImage` from `canvas.lib.ts`.

## Testing (`stamp.lib.test.ts`, jsdom — no real canvas)

- `fontStackFor` returns the right stack for each family (e.g. `mono` → contains `monospace`).
- `stampFontScale(1)` ≈ 1/16; `(100)` === 1/3; monotonic; clamps `[1,100]`.
- `STAMP_PRESETS` includes all 10 labels; each has a valid `#hex` color.
- `stampGeometry`:
  - `center` → `cx=W/2, cy=H/2`, rotation ≈ `-Math.PI/9` (-20°).
  - each corner → correct `cx/cy` given margin & box size, rotation `0`.
  - `boxW/boxH` derived from `textW/fontSize` + padding.

`stampImage` and the island: build + manual smoke (upload → stamp → download).

## Out of scope

- Image-based/logo stamps (text only for now).
- Multiple stamps at once.
- Per-preset font/rotation presets (all presets share the same style controls).
