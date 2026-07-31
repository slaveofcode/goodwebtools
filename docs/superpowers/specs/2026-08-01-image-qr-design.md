# Add QR to Image Tool — Design

**Date:** 2026-08-01
**Tool:** Image → Add QR to Image (`/tools/image-qr`) — NEW
**Type:** New tool
**Icon:** `QrCode` (lucide-react)

## Problem

Users want to overlay a QR code (encoding text/URL they type) onto an existing image, in
a chosen corner — e.g. dropping a link QR onto a poster, flyer, or product photo.

This is distinct from the existing **QR Generator** (`qr-gen`), which only produces a
standalone QR. Here the QR is composited **onto an uploaded image**.

## Goal

A client-side tool that renders a QR from typed content and composites it onto an
uploaded/pasted image at a chosen corner, then returns it via `ImageResult`.

Deps: `qrcode` is already installed — no new dependencies.

## Design

### Files

- `src/tools/image/qr-overlay.lib.ts` — pure geometry/sizing + the `overlayQr` compositor.
- `src/tools/image/qr-overlay.lib.test.ts` — unit tests for the pure helpers.
- `src/islands/image/ImageQr.tsx` — thin island (default export).
- `src/registry/tools.ts` — register `image-qr` (Image, `QrCode` icon, `status: 'beta'`).

### Controls (island)

- **Dropzone** + paste (`usePasteImage`).
- **QR content** — text/URL input (default `https://goodwebtools.com`).
- **Corner** — Top-left / Top-right / Bottom-left / Bottom-right (default bottom-right).
- **Size** slider (1–100%, default 18) — QR size as a fraction of the image's shorter side.
- **White card** toggle (default ON) — padded white rounded card behind the QR for a
  reliable quiet zone; off = draw the QR (with its own white background) directly.
- **Add QR** / **Clear** → `ImageResult` (Download / Copy / Edit in Annotator).

### Library API (`qr-overlay.lib.ts`)

```ts
export type QrCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface QrOverlayOptions {
  content: string;
  corner: QrCorner;
  sizePercent: number; // 1–100, fraction of the shorter side
  card: boolean;       // white rounded backing card
}

// Pure, unit-tested:
export function qrPixelSize(sizePercent: number, shorterSide: number): number; // clamps, min 64
export interface QrPlacement { x: number; y: number; }
export function qrCardPlacement(args: {
  canvasW: number; canvasH: number; boxSize: number; margin: number; corner: QrCorner;
}): QrPlacement; // top-left of the box for the chosen corner

// Canvas draw (build + manual smoke):
export function overlayQr(file: File, options: QrOverlayOptions): Promise<ProcessedImage>;
```

**Sizing** (`qrPixelSize`): `size = clamp(round(shorterSide * clampedPct/100), 64, shorterSide)`.
Minimum 64px so the QR stays scannable on small images.

**Placement** (`qrCardPlacement`, pure): given the outer box size (card or bare QR) and a
`margin`, return the box's top-left `(x, y)`:
- top-left: `(margin, margin)`
- top-right: `(W - margin - boxSize, margin)`
- bottom-left: `(margin, H - margin - boxSize)`
- bottom-right: `(W - margin - boxSize, H - margin - boxSize)`

**`overlayQr` draw**:
1. `createImageBitmap(file)` → draw onto a same-size canvas.
2. `qrSize = qrPixelSize(sizePercent, min(W,H))`.
3. Render the QR to an offscreen canvas: `await QRCode.toCanvas(qrCanvas, content, { width: qrSize, margin: 1, errorCorrectionLevel: 'M' })`. (Throws on empty/too-long content → surfaced as an error.)
4. `margin = round(min(W,H) * 0.03)`.
5. If `card`: `pad = round(qrSize * 0.12)`, `boxSize = qrSize + pad*2`, `pos = qrCardPlacement({..., boxSize, margin, corner})`. Draw a white rounded rect (`radius = pad`) at `pos`, then draw the QR canvas at `(pos.x + pad, pos.y + pad)`.
6. Else: `boxSize = qrSize`, `pos = qrCardPlacement({..., boxSize, margin, corner})`, draw the QR canvas at `pos`.
7. `encodeCanvas` preserving the input format (`keepFormat`).

Reuse `keepFormat`, `encodeCanvas`, `ProcessedImage` from `canvas.lib.ts`.

## Testing (`qr-overlay.lib.test.ts`, jsdom — no real canvas)

- `qrPixelSize`: 18% of 1000 → 180; clamps min to 64 (e.g. 1% of 1000 → 64); clamps percent to [1,100]; never exceeds the shorter side.
- `qrCardPlacement`: each corner returns the correct `(x,y)` for `W=1000,H=800,boxSize=200,margin=30`.

`overlayQr` + island: build + manual smoke (upload → content → corner → Add QR → scan the result).

## Out of scope

- QR color customization (kept black-on-white for scannability).
- Logo-in-QR / styled QR.
- Multiple QRs at once.
- Reading/decoding QR (that's the existing `qr-read` tool).
