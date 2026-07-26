# Image Tools & Annotator Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three client-side image tools (SVG Viewer & Converter, Image Viewer & Metadata, Monochrome) and a cross-tool "Edit in Annotator" handoff that opens the Image Annotator pre-loaded with any tool's image output.

**Architecture:** Each tool is an Astro React island registered in `src/registry/tools.ts`, with pure logic in `src/tools/image/*.lib.ts` (Vitest-tested) and output via the shared `ImageResult`/`ResultActions` components. The handoff is an IndexedDB one-shot channel (`services/handoff.ts`) plus a reusable button; adding it to `ResultActions` auto-covers every `ImageResult` tool, and it's hand-wired into the manual tools.

**Tech Stack:** React 18 islands, Canvas 2D, `idb` (IndexedDB), `dompurify` (SVG sanitize), self-hosted Monaco, lucide-react icons, Vitest + jsdom.

## Global Constraints

- **Zero external network requests at runtime** — no CDNs; everything bundled/self-hosted.
- **All processing client-side** — no uploads.
- Follow existing conventions exactly: `ToolDef` entry shape (`src/types/tool.ts`), island default-export with **no required props**, `ImageResult`/`ResultActions` for outputs, `usePasteImage(f => onDrop([f]))` for paste, `<Dropzone onDrop accept multiple>` for upload.
- New pure logic lives in `src/tools/image/*.lib.ts` and is unit-tested with Vitest (`environment: 'jsdom'`, `globals: true`).
- Category for all three tools: `Image`. Handoff route target is `/tools/image-annotate` (existing).

---

## File Structure

```
src/services/handoff.ts                         (new — IndexedDB image channel + pure isFresh)
src/services/handoff.test.ts                    (new — isFresh + round-trip via fake-indexeddb)
src/components/ui/EditInAnnotatorButton.tsx     (new — reusable handoff button)
src/components/ui/ZoomPane.tsx                   (new — shared zoom/pan viewer)
src/components/ui/ResultActions.tsx             (modify — add handoff button)
src/islands/image/ImageAnnotate.tsx             (modify — mount-time handoff load)
src/tools/image/mono.lib.ts (+ .test.ts)        (new — grayscale/bw/dither)
src/islands/image/Monochrome.tsx                (new)
src/tools/image/svg.lib.ts (+ .test.ts)         (new — parseSvgSize/rasterizeSvg)
src/islands/image/SvgViewer.tsx                 (new)
src/tools/image/ico.lib.ts (+ .test.ts)         (new — parseIcoEntries)
src/tools/image/exif.lib.ts (+ .test.ts)        (new — readExifSummary)
src/islands/image/ImageViewer.tsx               (new)
src/registry/tools.ts                           (modify — 3 entries)
# manual-tool wiring (modify): Screenshot, BackgroundRemove, FaceBlur,
# PortraitBlur, ObjectRemove, ImageUpscale, QrGen, PdfToImage, SignaturePad
package.json                                     (modify — add fake-indexeddb devDep)
```

---

## Task 1: Handoff service

**Files:**
- Create: `src/services/handoff.ts`
- Test: `src/services/handoff.test.ts`
- Modify: `package.json` (add `fake-indexeddb` devDependency)

**Interfaces:**
- Consumes: `idb` (`openDB`, `IDBPDatabase`) — already a dependency.
- Produces:
  - `isFresh(ts: number, now: number, maxAgeMs: number): boolean` (pure)
  - `putPendingImage(blob: Blob, name: string): Promise<void>`
  - `takePendingImage(maxAgeMs?: number): Promise<{ blob: Blob; name: string } | null>`
  - `sendImageToAnnotator(blob: Blob, name?: string): Promise<void>`

- [ ] **Step 1: Add fake-indexeddb dev dependency**

Run: `npm install --save-dev --legacy-peer-deps fake-indexeddb`
Expected: `fake-indexeddb` appears in `package.json` devDependencies.

- [ ] **Step 2: Write the failing test**

Create `src/services/handoff.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { isFresh, putPendingImage, takePendingImage } from './handoff';

describe('isFresh', () => {
  it('is true within the window and false past it', () => {
    expect(isFresh(1000, 1500, 1000)).toBe(true);
    expect(isFresh(1000, 2500, 1000)).toBe(false);
    expect(isFresh(1000, 1000, 1000)).toBe(true); // boundary: exactly now
  });
});

describe('pending image channel', () => {
  beforeEach(async () => {
    // Drain anything a previous test left behind.
    await takePendingImage(Number.MAX_SAFE_INTEGER);
  });

  it('round-trips a blob and clears it (one-shot)', async () => {
    const blob = new Blob(['hello'], { type: 'image/png' });
    await putPendingImage(blob, 'shot.png');
    const first = await takePendingImage();
    expect(first?.name).toBe('shot.png');
    expect(await first?.blob.text()).toBe('hello');
    // Second take returns null — the record was consumed.
    expect(await takePendingImage()).toBeNull();
  });

  it('returns null for a record older than maxAgeMs', async () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    await putPendingImage(blob, 'old.png');
    expect(await takePendingImage(-1)).toBeNull(); // maxAge -1 => always stale
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- --run src/services/handoff.test.ts`
Expected: FAIL — `Failed to resolve import "./handoff"`.

- [ ] **Step 4: Write the implementation**

Create `src/services/handoff.ts`:

```ts
import { openDB, type IDBPDatabase } from 'idb';

// A one-shot IndexedDB channel for passing an image between tools across a full
// page navigation (Astro reloads the page). localStorage is too small for images.
interface PendingRecord {
  blob: Blob;
  name: string;
  ts: number;
}

const DB_NAME = 'gwt-handoff';
const STORE = 'image';
const KEY = 'pending';
const DEFAULT_MAX_AGE = 60_000; // 1 minute

let dbPromise: Promise<IDBPDatabase> | null = null;
function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE);
      },
    });
  }
  return dbPromise;
}

/** A record stamped at `ts` is fresh if `now` is within `maxAgeMs` of it. */
export function isFresh(ts: number, now: number, maxAgeMs: number): boolean {
  return now - ts <= maxAgeMs;
}

/** Store an image for the next tool to pick up. Overwrites any pending image. */
export async function putPendingImage(blob: Blob, name: string): Promise<void> {
  try {
    await (await db()).put(STORE, { blob, name, ts: Date.now() } satisfies PendingRecord, KEY);
  } catch {
    /* storage unavailable / quota — handoff is best-effort */
  }
}

/** Read and delete the pending image, if any and still fresh. */
export async function takePendingImage(
  maxAgeMs = DEFAULT_MAX_AGE,
): Promise<{ blob: Blob; name: string } | null> {
  try {
    const conn = await db();
    const rec = (await conn.get(STORE, KEY)) as PendingRecord | undefined;
    await conn.delete(STORE, KEY); // one-shot: always clear
    if (!rec || !isFresh(rec.ts, Date.now(), maxAgeMs)) return null;
    return { blob: rec.blob, name: rec.name };
  } catch {
    return null;
  }
}

/** Store the image, then navigate to the annotator, which loads it on mount. */
export async function sendImageToAnnotator(blob: Blob, name = 'image.png'): Promise<void> {
  await putPendingImage(blob, name);
  window.location.href = '/tools/image-annotate';
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- --run src/services/handoff.test.ts`
Expected: PASS (5 assertions across 3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/services/handoff.ts src/services/handoff.test.ts package.json package-lock.json
git commit -m "feat(handoff): add IndexedDB one-shot image channel for annotator handoff"
```

---

## Task 2: EditInAnnotatorButton + wire into ResultActions

**Files:**
- Create: `src/components/ui/EditInAnnotatorButton.tsx`
- Modify: `src/components/ui/ResultActions.tsx`

**Interfaces:**
- Consumes: `sendImageToAnnotator` (Task 1); `Button` (`./Button`).
- Produces: `EditInAnnotatorButton` React component with props `{ blob: Blob | (() => Blob | Promise<Blob>) | null; filename?: string; disabled?: boolean }`.

This task has no unit test (it's a thin UI wrapper matching `CopyImageButton`, which is also untested); verification is the app building and the button appearing. The blob-resolution + navigation logic is covered by Task 1's tested `sendImageToAnnotator`.

- [ ] **Step 1: Create the button**

Create `src/components/ui/EditInAnnotatorButton.tsx`:

```tsx
import { PenTool } from 'lucide-react';
import { sendImageToAnnotator } from '@/services/handoff';
import { Button } from './Button';

interface EditInAnnotatorButtonProps {
  /** The image to hand off, or a function that produces it on demand. */
  blob: Blob | (() => Blob | Promise<Blob>) | null;
  filename?: string;
  disabled?: boolean;
}

/** Opens the Image Annotator pre-loaded with this image (via IndexedDB handoff). */
export function EditInAnnotatorButton({ blob, filename = 'image.png', disabled }: EditInAnnotatorButtonProps) {
  const handleClick = async () => {
    if (!blob) return;
    const resolved = typeof blob === 'function' ? await blob() : blob;
    await sendImageToAnnotator(resolved, filename);
  };

  return (
    <Button variant="secondary" onClick={handleClick} disabled={disabled || !blob}>
      <PenTool className="h-4 w-4" />
      Edit in Annotator
    </Button>
  );
}
```

- [ ] **Step 2: Wire it into ResultActions**

Modify `src/components/ui/ResultActions.tsx` — add the import and render the button after `CopyImageButton`, gated on the same `isImage` check:

```tsx
import { Download } from 'lucide-react';
import { downloadService } from '@/services/download';
import { Button } from './Button';
import { CopyImageButton } from './CopyImageButton';
import { EditInAnnotatorButton } from './EditInAnnotatorButton';

export interface ResultActionsProps {
  blob: Blob | null;
  filename: string;
  disabled?: boolean;
}

export function ResultActions({ blob, filename, disabled }: ResultActionsProps) {
  const handleDownload = async () => {
    if (!blob) return;
    await downloadService.download(blob, filename);
  };

  const isImage = !!blob && blob.type.startsWith('image/');

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={handleDownload} disabled={disabled || !blob}>
        <Download className="h-4 w-4" />
        Download {filename}
      </Button>
      {isImage && <CopyImageButton blob={blob} disabled={disabled} />}
      {isImage && <EditInAnnotatorButton blob={blob} filename={filename} disabled={disabled} />}
    </div>
  );
}
```

- [ ] **Step 3: Verify it builds and tests still pass**

Run: `npm run build && npm test -- --run`
Expected: build succeeds; all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/EditInAnnotatorButton.tsx src/components/ui/ResultActions.tsx
git commit -m "feat(handoff): add Edit in Annotator button to shared ResultActions"
```

---

## Task 3: ImageAnnotate loads the handoff image on mount

**Files:**
- Modify: `src/islands/image/ImageAnnotate.tsx`

**Interfaces:**
- Consumes: `takePendingImage` (Task 1); the island's existing `onDrop(files: File[])`.

- [ ] **Step 1: Locate the onDrop definition**

Run: `grep -n "onDrop\|useEffect\|export default function ImageAnnotate" src/islands/image/ImageAnnotate.tsx`
Expected: shows the `onDrop` function and imports. Note whether `useEffect` is already imported from `react`.

- [ ] **Step 2: Add the import**

At the top of `src/islands/image/ImageAnnotate.tsx`, add:

```tsx
import { takePendingImage } from '@/services/handoff';
```
Ensure `useEffect` is in the `react` import (add it if missing).

- [ ] **Step 3: Add the mount-time load effect**

Immediately after the `onDrop` function is defined in the component body, add:

```tsx
  // If another tool handed us an image (via the annotator handoff), load it as
  // the base image on mount. No-op when nothing is pending.
  useEffect(() => {
    takePendingImage().then((pending) => {
      if (pending) onDrop([new File([pending.blob], pending.name, { type: pending.blob.type })]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

- [ ] **Step 4: Verify build and manual check**

Run: `npm run build`
Expected: build succeeds. (Manual smoke test later: any tool's "Edit in Annotator" → annotator opens with the image loaded.)

- [ ] **Step 5: Commit**

```bash
git add src/islands/image/ImageAnnotate.tsx
git commit -m "feat(handoff): load handed-off image into the annotator on mount"
```

---

## Task 4: Monochrome — library

**Files:**
- Create: `src/tools/image/mono.lib.ts`
- Test: `src/tools/image/mono.lib.test.ts`

**Interfaces:**
- Produces:
  - `toGrayscale(data: ImageData): ImageData`
  - `toBlackWhite(data: ImageData, threshold: number): ImageData`
  - `toDitheredBW(data: ImageData): ImageData`
  - `applyMono(file: File, opts: { mode: MonoMode; threshold?: number }): Promise<Blob>`
  - `type MonoMode = 'grayscale' | 'bw' | 'dither'`

The three transforms are pure `ImageData → ImageData` and fully unit-tested. `applyMono` (canvas I/O) is exercised manually via the island.

- [ ] **Step 1: Write the failing test**

Create `src/tools/image/mono.lib.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toGrayscale, toBlackWhite, toDitheredBW } from './mono.lib';

// Build a 2x2 ImageData without a real canvas (jsdom): plain object is enough
// because the transforms only read width/height/data.
function makeImageData(px: number[][]): ImageData {
  const data = new Uint8ClampedArray(px.length * 4);
  px.forEach(([r, g, b, a], i) => {
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = a ?? 255;
  });
  const side = Math.sqrt(px.length);
  return { width: side, height: side, data, colorSpace: 'srgb' } as ImageData;
}

describe('toGrayscale', () => {
  it('makes R=G=B per pixel using luminance weights', () => {
    const out = toGrayscale(makeImageData([[255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255], [255, 255, 255, 255]]));
    for (let i = 0; i < 4; i++) {
      const [r, g, b] = [out.data[i * 4], out.data[i * 4 + 1], out.data[i * 4 + 2]];
      expect(r).toBe(g);
      expect(g).toBe(b);
    }
    expect(out.data[0]).toBe(Math.round(0.299 * 255)); // red pixel luminance
  });
});

describe('toBlackWhite', () => {
  it('outputs only 0 or 255 and respects the threshold', () => {
    const out = toBlackWhite(makeImageData([[100, 100, 100, 255], [200, 200, 200, 255], [0, 0, 0, 255], [255, 255, 255, 255]]), 128);
    for (let i = 0; i < out.data.length; i += 4) {
      expect([0, 255]).toContain(out.data[i]);
    }
    expect(out.data[0]).toBe(0);   // lum 100 < 128 -> black
    expect(out.data[4]).toBe(255); // lum 200 >= 128 -> white
  });
});

describe('toDitheredBW', () => {
  it('outputs only 0 or 255 and preserves dimensions', () => {
    const out = toDitheredBW(makeImageData([[128, 128, 128, 255], [128, 128, 128, 255], [128, 128, 128, 255], [128, 128, 128, 255]]));
    expect(out.width).toBe(2);
    expect(out.height).toBe(2);
    for (let i = 0; i < out.data.length; i += 4) {
      expect([0, 255]).toContain(out.data[i]);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/tools/image/mono.lib.test.ts`
Expected: FAIL — cannot resolve `./mono.lib`.

- [ ] **Step 3: Write the implementation**

Create `src/tools/image/mono.lib.ts`:

```ts
export type MonoMode = 'grayscale' | 'bw' | 'dither';

const LUM = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

function cloneShape(src: ImageData): ImageData {
  return { width: src.width, height: src.height, data: new Uint8ClampedArray(src.data.length), colorSpace: 'srgb' } as ImageData;
}

/** Desaturate to luminance grey; alpha preserved. */
export function toGrayscale(src: ImageData): ImageData {
  const out = cloneShape(src);
  for (let i = 0; i < src.data.length; i += 4) {
    const y = Math.round(LUM(src.data[i], src.data[i + 1], src.data[i + 2]));
    out.data[i] = out.data[i + 1] = out.data[i + 2] = y;
    out.data[i + 3] = src.data[i + 3];
  }
  return out;
}

/** Hard threshold to pure black/white; alpha preserved. */
export function toBlackWhite(src: ImageData, threshold: number): ImageData {
  const out = cloneShape(src);
  for (let i = 0; i < src.data.length; i += 4) {
    const v = LUM(src.data[i], src.data[i + 1], src.data[i + 2]) >= threshold ? 255 : 0;
    out.data[i] = out.data[i + 1] = out.data[i + 2] = v;
    out.data[i + 3] = src.data[i + 3];
  }
  return out;
}

/** Floyd–Steinberg error-diffusion dither to 1-bit black/white. */
export function toDitheredBW(src: ImageData): ImageData {
  const { width, height } = src;
  const out = cloneShape(src);
  // Working luminance buffer (float) so error can accumulate.
  const lum = new Float32Array(width * height);
  for (let p = 0; p < width * height; p++) {
    const i = p * 4;
    lum[p] = LUM(src.data[i], src.data[i + 1], src.data[i + 2]);
    out.data[i + 3] = src.data[i + 3];
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const old = lum[p];
      const nv = old >= 128 ? 255 : 0;
      const err = old - nv;
      const i = p * 4;
      out.data[i] = out.data[i + 1] = out.data[i + 2] = nv;
      // Distribute error to neighbours (right, below-left, below, below-right).
      if (x + 1 < width) lum[p + 1] += (err * 7) / 16;
      if (y + 1 < height) {
        if (x > 0) lum[p + width - 1] += (err * 3) / 16;
        lum[p + width] += (err * 5) / 16;
        if (x + 1 < width) lum[p + width + 1] += (err * 1) / 16;
      }
    }
  }
  return out;
}

/** Decode a file, apply a monochrome mode, and re-encode as PNG. Browser-only. */
export async function applyMono(
  file: File,
  opts: { mode: MonoMode; threshold?: number },
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close?.();
    throw new Error('Canvas is not supported in this browser');
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const result =
    opts.mode === 'grayscale'
      ? toGrayscale(data)
      : opts.mode === 'dither'
        ? toDitheredBW(data)
        : toBlackWhite(data, opts.threshold ?? 128);
  ctx.putImageData(result, 0, 0);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to encode image'))), 'image/png'),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/tools/image/mono.lib.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/image/mono.lib.ts src/tools/image/mono.lib.test.ts
git commit -m "feat(image): add monochrome transforms (grayscale, b&w, dither)"
```

---

## Task 5: Monochrome — island + registry

**Files:**
- Create: `src/islands/image/Monochrome.tsx`
- Modify: `src/registry/tools.ts`

**Interfaces:**
- Consumes: `applyMono`, `MonoMode` (Task 4); `Dropzone`, `Button`, `Alert`, `ImageResult`, `usePasteImage`.

- [ ] **Step 1: Create the island**

Create `src/islands/image/Monochrome.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ImageResult } from '@/components/ui/ImageResult';
import { applyMono, type MonoMode } from '@/tools/image/mono.lib';
import { usePasteImage } from '@/hooks/usePasteImage';

const MODES: { key: MonoMode; label: string; note: string }[] = [
  { key: 'grayscale', label: 'Grayscale', note: 'Luminance desaturation.' },
  { key: 'bw', label: 'Black & White', note: 'Hard threshold to pure black/white.' },
  { key: 'dither', label: 'Dithered B/W', note: 'Floyd–Steinberg dithering for smoother tone.' },
];

export default function Monochrome() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<MonoMode>('grayscale');
  const [threshold, setThreshold] = useState(128);
  const [result, setResult] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onDrop = (files: File[]) => {
    setFile(files.find((f) => f.type.startsWith('image/')) ?? null);
    setResult(null);
    setError('');
  };
  usePasteImage((f) => onDrop([f]));

  // Re-run whenever the input, mode, or threshold changes (debounced).
  useEffect(() => {
    if (!file) return;
    let alive = true;
    setBusy(true);
    const t = setTimeout(() => {
      applyMono(file, { mode, threshold })
        .then((b) => alive && setResult(b))
        .catch((e) => alive && setError(e instanceof Error ? e.message : 'Failed'))
        .finally(() => alive && setBusy(false));
    }, 150);
    return () => { alive = false; clearTimeout(t); };
  }, [file, mode, threshold]);

  const outName = file ? file.name.replace(/\.[^.]+$/, '') + `-${mode}.png` : 'image.png';

  return (
    <div className="space-y-4">
      <Dropzone onDrop={onDrop} accept="image/*" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">Drop an image or click to browse</p>
          <p className="text-sm text-muted-foreground">Grayscale, black &amp; white, or dithered · or paste (⌘V)</p>
        </div>
      </Dropzone>

      {file && <p className="text-sm font-bold text-foreground">{file.name}</p>}

      <div className="space-y-1.5">
        <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">Mode</span>
        <div className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <Button key={m.key} variant={mode === m.key ? 'primary' : 'secondary'} aria-pressed={mode === m.key} onClick={() => setMode(m.key)}>
              {m.label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{MODES.find((m) => m.key === mode)?.note}</p>
      </div>

      {mode === 'bw' && (
        <label className="block space-y-1.5">
          <span className="flex justify-between text-sm font-bold uppercase tracking-wide text-muted-foreground">
            <span>Threshold</span>
            <span>{threshold}</span>
          </span>
          <input type="range" min={0} max={255} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-full accent-accent" />
        </label>
      )}

      {error && <Alert variant="error">{error}</Alert>}
      {result && <ImageResult blob={result} filename={outName} originalSize={file?.size} />}
      {busy && <p className="text-sm text-muted-foreground">Processing…</p>}
    </div>
  );
}
```

- [ ] **Step 2: Register the tool**

In `src/registry/tools.ts`, add `Contrast` to the lucide import line, then add this entry to the `tools` array (near the other `category: 'Image'` entries):

```ts
  {
    id: 'monochrome',
    name: 'Monochrome',
    category: 'Image',
    route: '/tools/monochrome',
    keywords: ['monochrome', 'grayscale', 'greyscale', 'black and white', 'bw', 'threshold', 'dither', 'desaturate'],
    icon: Contrast,
    summary: 'Convert images to grayscale, black & white, or dithered',
    load: () => import('@/islands/image/Monochrome'),
    status: 'stable'
  },
```

- [ ] **Step 3: Verify build + route**

Run: `npm run build`
Expected: build succeeds; `/tools/monochrome` is generated (getStaticPaths reads the registry).

- [ ] **Step 4: Commit**

```bash
git add src/islands/image/Monochrome.tsx src/registry/tools.ts
git commit -m "feat(image): add Monochrome tool (grayscale/b&w/dither)"
```

---

## Task 6: Shared ZoomPane component

**Files:**
- Create: `src/components/ui/ZoomPane.tsx`

**Interfaces:**
- Produces: `ZoomPane` React component with props `{ children: React.ReactNode; className?: string }` that renders a checkerboard-backed, scroll/wheel-zoomable, drag-pannable container with zoom buttons + a "Fit" reset. Consumed by both viewers (Tasks 7, 9).

No unit test (pure presentational interaction component, like other `ui/` primitives). Verified via the viewers building and manual zoom.

- [ ] **Step 1: Create the component**

Create `src/components/ui/ZoomPane.tsx`:

```tsx
import { useRef, useState, type ReactNode } from 'react';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { Button } from './Button';

const MIN = 0.25;
const MAX = 8;

/** A checkerboard-backed pane that zooms (buttons + wheel) and pans (drag). */
export function ZoomPane({ children, className }: { children: ReactNode; className?: string }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef<{ x: number; y: number } | null>(null);

  const clamp = (z: number) => Math.min(MAX, Math.max(MIN, z));
  const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => clamp(z * (e.deltaY < 0 ? 1.1 : 0.9)));
  };
  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    setPan({ x: e.clientX - dragging.current.x, y: e.clientY - dragging.current.y });
  };
  const onPointerUp = () => { dragging.current = null; };

  return (
    <div className={`relative overflow-hidden border-2 border-border ${className ?? 'h-[70vh]'}`}>
      <div className="absolute right-2 top-2 z-10 flex gap-1">
        <Button variant="secondary" onClick={() => setZoom((z) => clamp(z * 1.25))} aria-label="Zoom in"><ZoomIn className="h-4 w-4" /></Button>
        <Button variant="secondary" onClick={() => setZoom((z) => clamp(z * 0.8))} aria-label="Zoom out"><ZoomOut className="h-4 w-4" /></Button>
        <Button variant="secondary" onClick={reset} aria-label="Fit"><Maximize className="h-4 w-4" /></Button>
      </div>
      <span className="absolute left-2 top-2 z-10 rounded bg-background/80 px-2 py-0.5 text-xs font-mono">{Math.round(zoom * 100)}%</span>
      <div
        className="flex h-full w-full cursor-grab items-center justify-center active:cursor-grabbing"
        style={{ backgroundImage: 'conic-gradient(#0000 90deg, #8883 0 180deg, #0000 0 270deg, #8883 0)', backgroundSize: '20px 20px' }}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: build succeeds (component is unused until Task 7, but must type-check).

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/ZoomPane.tsx
git commit -m "feat(ui): add shared ZoomPane (checkerboard, wheel-zoom, drag-pan)"
```

---

## Task 7: SVG Viewer & Converter — library

**Files:**
- Create: `src/tools/image/svg.lib.ts`
- Test: `src/tools/image/svg.lib.test.ts`

**Interfaces:**
- Produces:
  - `parseSvgSize(markup: string): { width: number; height: number; viewBox?: [number, number, number, number] }`
  - `rasterizeSvg(markup: string, opts: RasterizeOpts): Promise<Blob>` where `RasterizeOpts = { scale?: number; width?: number; height?: number; type: 'image/png' | 'image/jpeg' | 'image/webp'; quality?: number; background?: string }`

`parseSvgSize` is pure and fully tested. `rasterizeSvg` needs an `<img>` load + canvas (browser); its dimension/type contract is asserted via a mocked path where feasible, otherwise exercised manually — see Step 1 notes.

- [ ] **Step 1: Write the failing test (pure parser only)**

Create `src/tools/image/svg.lib.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseSvgSize } from './svg.lib';

describe('parseSvgSize', () => {
  it('reads explicit width/height', () => {
    expect(parseSvgSize('<svg width="120" height="80"></svg>')).toMatchObject({ width: 120, height: 80 });
  });
  it('strips units like px', () => {
    expect(parseSvgSize('<svg width="120px" height="80px"></svg>')).toMatchObject({ width: 120, height: 80 });
  });
  it('derives size from viewBox when width/height absent', () => {
    const r = parseSvgSize('<svg viewBox="0 0 300 150"></svg>');
    expect(r).toMatchObject({ width: 300, height: 150, viewBox: [0, 0, 300, 150] });
  });
  it('falls back to 300x150 when nothing is specified', () => {
    expect(parseSvgSize('<svg></svg>')).toMatchObject({ width: 300, height: 150 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/tools/image/svg.lib.test.ts`
Expected: FAIL — cannot resolve `./svg.lib`.

- [ ] **Step 3: Write the implementation**

Create `src/tools/image/svg.lib.ts`:

```ts
export interface RasterizeOpts {
  scale?: number;
  width?: number;
  height?: number;
  type: 'image/png' | 'image/jpeg' | 'image/webp';
  quality?: number;
  background?: string;
}

const num = (s: string | null): number | null => {
  if (!s) return null;
  const m = s.match(/-?[\d.]+/);
  return m ? parseFloat(m[0]) : null;
};

/** Read an SVG's intrinsic size from width/height, else viewBox, else 300x150. */
export function parseSvgSize(markup: string): {
  width: number;
  height: number;
  viewBox?: [number, number, number, number];
} {
  const w = num(markup.match(/\bwidth\s*=\s*["']([^"']+)["']/)?.[1] ?? null);
  const h = num(markup.match(/\bheight\s*=\s*["']([^"']+)["']/)?.[1] ?? null);
  const vbRaw = markup.match(/\bviewBox\s*=\s*["']([^"']+)["']/)?.[1];
  let viewBox: [number, number, number, number] | undefined;
  if (vbRaw) {
    const parts = vbRaw.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((n) => !Number.isNaN(n))) {
      viewBox = [parts[0], parts[1], parts[2], parts[3]];
    }
  }
  const width = w ?? viewBox?.[2] ?? 300;
  const height = h ?? viewBox?.[3] ?? 150;
  return { width, height, viewBox };
}

/** Rasterize SVG markup to a PNG/JPEG/WebP blob at a scale or explicit size. */
export function rasterizeSvg(markup: string, opts: RasterizeOpts): Promise<Blob> {
  const { width: iw, height: ih } = parseSvgSize(markup);
  const targetW = Math.max(1, Math.round(opts.width ?? iw * (opts.scale ?? 1)));
  const targetH = Math.max(1, Math.round(opts.height ?? ih * (opts.scale ?? 1)));
  const svgBlob = new Blob([markup], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(svgBlob);

  return new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas is not supported in this browser'));
      if (opts.type === 'image/jpeg' || opts.background) {
        ctx.fillStyle = opts.background ?? '#ffffff';
        ctx.fillRect(0, 0, targetW, targetH);
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to encode image'))), opts.type, opts.quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't render this SVG."));
    };
    img.src = url;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/tools/image/svg.lib.test.ts`
Expected: PASS (4 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/tools/image/svg.lib.ts src/tools/image/svg.lib.test.ts
git commit -m "feat(image): add SVG size parsing + rasterize library"
```

---

## Task 8: SVG Viewer & Converter — island + registry

**Files:**
- Create: `src/islands/image/SvgViewer.tsx`
- Modify: `src/registry/tools.ts`

**Interfaces:**
- Consumes: `parseSvgSize`, `rasterizeSvg`, `RasterizeOpts` (Task 7); `ZoomPane` (Task 6); `Dropzone`, `Button`, `Alert`, `ImageResult`; `dompurify` (`DOMPurify.sanitize`).

- [ ] **Step 1: Create the island**

Create `src/islands/image/SvgViewer.tsx`:

```tsx
import { useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ImageResult } from '@/components/ui/ImageResult';
import { ZoomPane } from '@/components/ui/ZoomPane';
import { parseSvgSize, rasterizeSvg } from '@/tools/image/svg.lib';

const FORMATS = [
  { key: 'png', type: 'image/png' as const, label: 'PNG', lossy: false },
  { key: 'jpeg', type: 'image/jpeg' as const, label: 'JPEG', lossy: true },
  { key: 'webp', type: 'image/webp' as const, label: 'WebP', lossy: true },
];

export default function SvgViewer() {
  const [markup, setMarkup] = useState('');
  const [fmt, setFmt] = useState('png');
  const [scale, setScale] = useState(1);
  const [quality, setQuality] = useState(92);
  const [result, setResult] = useState<Blob | null>(null);
  const [error, setError] = useState('');

  const onDrop = async (files: File[]) => {
    const f = files.find((x) => x.type === 'image/svg+xml' || x.name.toLowerCase().endsWith('.svg'));
    if (!f) { setError('Please drop an SVG file.'); return; }
    setError('');
    setResult(null);
    setMarkup(await f.text());
  };

  const clean = useMemo(
    () => (markup ? DOMPurify.sanitize(markup, { USE_PROFILES: { svg: true, svgFilters: true } }) : ''),
    [markup],
  );
  const size = useMemo(() => (markup ? parseSvgSize(markup) : null), [markup]);
  const format = FORMATS.find((f) => f.key === fmt)!;

  const convert = async () => {
    setError('');
    setResult(null);
    try {
      setResult(await rasterizeSvg(clean, { type: format.type, scale, quality: format.lossy ? quality / 100 : undefined }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rasterize failed');
    }
  };

  return (
    <div className="space-y-4">
      <Dropzone onDrop={onDrop} accept="image/svg+xml,.svg" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">Drop an SVG or click to browse</p>
          <p className="text-sm text-muted-foreground">View it, then export to PNG, JPEG, or WebP</p>
        </div>
      </Dropzone>

      <textarea
        value={markup}
        onChange={(e) => { setMarkup(e.target.value); setResult(null); }}
        placeholder="…or paste SVG markup here"
        className="h-32 w-full border-2 border-border bg-background p-2 font-mono text-xs"
      />

      {error && <Alert variant="error">{error}</Alert>}

      {clean && (
        <>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="font-mono">{size?.width} × {size?.height}</span>
            {size?.viewBox && <span className="font-mono text-muted-foreground">viewBox: {size.viewBox.join(' ')}</span>}
          </div>
          <ZoomPane>
            <div dangerouslySetInnerHTML={{ __html: clean }} />
          </ZoomPane>

          <div className="space-y-1.5">
            <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">Export format</span>
            <div className="flex flex-wrap gap-2">
              {FORMATS.map((f) => (
                <Button key={f.key} variant={fmt === f.key ? 'primary' : 'secondary'} aria-pressed={fmt === f.key} onClick={() => setFmt(f.key)}>{f.label}</Button>
              ))}
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="flex justify-between text-sm font-bold uppercase tracking-wide text-muted-foreground"><span>Scale</span><span>{scale}×</span></span>
            <input type="range" min={1} max={8} step={1} value={scale} onChange={(e) => setScale(Number(e.target.value))} className="w-full accent-accent" />
          </label>

          {format.lossy && (
            <label className="block space-y-1.5">
              <span className="flex justify-between text-sm font-bold uppercase tracking-wide text-muted-foreground"><span>Quality</span><span>{quality}%</span></span>
              <input type="range" min={10} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full accent-accent" />
            </label>
          )}

          <Button onClick={convert}>Export {format.label}</Button>
        </>
      )}

      {result && <ImageResult blob={result} filename={`image.${fmt === 'jpeg' ? 'jpg' : fmt}`} />}
    </div>
  );
}
```

- [ ] **Step 2: Register the tool**

In `src/registry/tools.ts`, `FileImage` is already imported. Add this entry:

```ts
  {
    id: 'svg-viewer',
    name: 'SVG Viewer & Converter',
    category: 'Image',
    route: '/tools/svg-viewer',
    keywords: ['svg', 'viewer', 'vector', 'rasterize', 'convert', 'png', 'jpeg', 'webp'],
    icon: FileImage,
    summary: 'View SVG files and export them as PNG, JPEG, or WebP',
    load: () => import('@/islands/image/SvgViewer'),
    status: 'stable'
  },
```

Note: `FileImage` may already back another tool — an icon may be reused across tools; that's fine.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds; `/tools/svg-viewer` generated.

- [ ] **Step 4: Commit**

```bash
git add src/islands/image/SvgViewer.tsx src/registry/tools.ts
git commit -m "feat(image): add SVG Viewer & Converter tool"
```

---

## Task 9: Image Viewer & Metadata — libraries (ICO + EXIF)

**Files:**
- Create: `src/tools/image/ico.lib.ts`, `src/tools/image/exif.lib.ts`
- Test: `src/tools/image/ico.lib.test.ts`, `src/tools/image/exif.lib.test.ts`

**Interfaces:**
- Produces:
  - `parseIcoEntries(buffer: ArrayBuffer): IcoEntry[]` where `IcoEntry = { width: number; height: number; bpp: number; offset: number; size: number }`
  - `readExifSummary(buffer: ArrayBuffer): ExifSummary | null` where `ExifSummary = { orientation?: number; hasGps: boolean }`

Both are pure byte parsers, fully unit-tested.

- [ ] **Step 1: Write the failing ICO test**

Create `src/tools/image/ico.lib.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseIcoEntries } from './ico.lib';

// Hand-build a 2-entry ICONDIR (16px and 32px), matching buildIco's layout.
function fixture(): ArrayBuffer {
  const count = 2;
  const buf = new ArrayBuffer(6 + count * 16);
  const v = new DataView(buf);
  v.setUint16(0, 0, true); // reserved
  v.setUint16(2, 1, true); // type = icon
  v.setUint16(4, count, true);
  const write = (i: number, w: number, bpp: number, size: number, offset: number) => {
    const e = 6 + i * 16;
    v.setUint8(e, w >= 256 ? 0 : w);
    v.setUint8(e + 1, w >= 256 ? 0 : w);
    v.setUint16(e + 6, bpp, true);
    v.setUint32(e + 8, size, true);
    v.setUint32(e + 12, offset, true);
  };
  write(0, 16, 32, 100, 38);
  write(1, 32, 32, 250, 138);
  return buf;
}

describe('parseIcoEntries', () => {
  it('reads each directory entry', () => {
    const entries = parseIcoEntries(fixture());
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ width: 16, height: 16, bpp: 32, size: 100, offset: 38 });
    expect(entries[1]).toMatchObject({ width: 32, height: 32, size: 250, offset: 138 });
  });
  it('treats a stored 0 as 256px', () => {
    const buf = fixture();
    new DataView(buf).setUint8(6, 0); // width byte of entry 0 -> 256
    expect(parseIcoEntries(buf)[0].width).toBe(256);
  });
  it('returns [] for a non-ICO buffer', () => {
    const buf = new ArrayBuffer(6);
    new DataView(buf).setUint16(2, 99, true); // wrong type
    expect(parseIcoEntries(buf)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --run src/tools/image/ico.lib.test.ts`
Expected: FAIL — cannot resolve `./ico.lib`.

- [ ] **Step 3: Write ico.lib**

Create `src/tools/image/ico.lib.ts`:

```ts
export interface IcoEntry {
  width: number;
  height: number;
  bpp: number;
  offset: number;
  size: number;
}

/** Parse an .ico ICONDIR into its per-image entries. Returns [] if not an ICO. */
export function parseIcoEntries(buffer: ArrayBuffer): IcoEntry[] {
  if (buffer.byteLength < 6) return [];
  const v = new DataView(buffer);
  if (v.getUint16(0, true) !== 0 || v.getUint16(2, true) !== 1) return []; // reserved=0, type=1
  const count = v.getUint16(4, true);
  const entries: IcoEntry[] = [];
  for (let i = 0; i < count; i++) {
    const e = 6 + i * 16;
    if (e + 16 > buffer.byteLength) break;
    const w = v.getUint8(e) || 256; // 0 means 256
    const h = v.getUint8(e + 1) || 256;
    entries.push({
      width: w,
      height: h,
      bpp: v.getUint16(e + 6, true),
      size: v.getUint32(e + 8, true),
      offset: v.getUint32(e + 12, true),
    });
  }
  return entries;
}
```

- [ ] **Step 4: Run to verify ICO passes**

Run: `npm test -- --run src/tools/image/ico.lib.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing EXIF test**

Create `src/tools/image/exif.lib.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readExifSummary } from './exif.lib';

// Minimal JPEG APP1/Exif with one IFD0 tag: Orientation (0x0112) = 6.
function exifJpeg(): ArrayBuffer {
  const bytes: number[] = [0xff, 0xd8]; // SOI
  // Build TIFF body (big-endian) first so we know its length.
  const tiff: number[] = [];
  tiff.push(0x4d, 0x4d); // 'MM' big-endian
  tiff.push(0x00, 0x2a); // 42
  tiff.push(0x00, 0x00, 0x00, 0x08); // IFD0 offset = 8
  tiff.push(0x00, 0x01); // 1 entry
  tiff.push(0x01, 0x12); // tag Orientation
  tiff.push(0x00, 0x03); // type SHORT
  tiff.push(0x00, 0x00, 0x00, 0x01); // count 1
  tiff.push(0x00, 0x06, 0x00, 0x00); // value 6 (SHORT, left-justified)
  tiff.push(0x00, 0x00, 0x00, 0x00); // next IFD = 0
  const exif = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff]; // "Exif\0\0" + TIFF
  const len = exif.length + 2; // APP1 length includes the 2 length bytes
  bytes.push(0xff, 0xe1, (len >> 8) & 0xff, len & 0xff, ...exif);
  bytes.push(0xff, 0xd9); // EOI
  return new Uint8Array(bytes).buffer;
}

describe('readExifSummary', () => {
  it('reads orientation from APP1', () => {
    const s = readExifSummary(exifJpeg());
    expect(s?.orientation).toBe(6);
    expect(s?.hasGps).toBe(false);
  });
  it('returns null when there is no Exif segment', () => {
    expect(readExifSummary(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer)).toBeNull();
  });
});
```

- [ ] **Step 6: Run to verify EXIF fails**

Run: `npm test -- --run src/tools/image/exif.lib.test.ts`
Expected: FAIL — cannot resolve `./exif.lib`.

- [ ] **Step 7: Write exif.lib**

Create `src/tools/image/exif.lib.ts`:

```ts
export interface ExifSummary {
  orientation?: number;
  hasGps: boolean;
}

/**
 * Minimal EXIF reader: scans JPEG APP1 for the Exif TIFF block and reads the
 * IFD0 Orientation tag (0x0112) and whether a GPS IFD pointer (0x8825) exists.
 * Returns null when there's no Exif segment. No external dependency.
 */
export function readExifSummary(buffer: ArrayBuffer): ExifSummary | null {
  const v = new DataView(buffer);
  if (buffer.byteLength < 4 || v.getUint16(0) !== 0xffd8) return null; // not a JPEG

  // Walk JPEG markers to find APP1 (0xFFE1) starting with "Exif\0\0".
  let p = 2;
  while (p + 4 <= buffer.byteLength) {
    if (v.getUint8(p) !== 0xff) break;
    const marker = v.getUint8(p + 1);
    const segLen = v.getUint16(p + 2);
    if (marker === 0xe1 && p + 4 + 6 <= buffer.byteLength) {
      const isExif = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00].every((b, i) => v.getUint8(p + 4 + i) === b);
      if (isExif) return readTiff(v, p + 10); // TIFF header starts after "Exif\0\0"
    }
    if (marker === 0xda) break; // start of scan — no more metadata
    p += 2 + segLen;
  }
  return null;
}

function readTiff(v: DataView, base: number): ExifSummary {
  const little = v.getUint16(base) === 0x4949; // 'II' little-endian, 'MM' big-endian
  const u16 = (o: number) => v.getUint16(base + o, little);
  const u32 = (o: number) => v.getUint32(base + o, little);

  const ifd0 = u32(4);
  const summary: ExifSummary = { hasGps: false };
  if (ifd0 + 2 > v.byteLength - base) return summary;
  const count = u16(ifd0);
  for (let i = 0; i < count; i++) {
    const entry = ifd0 + 2 + i * 12;
    const tag = u16(entry);
    if (tag === 0x0112) summary.orientation = u16(entry + 8); // Orientation (SHORT, inline)
    if (tag === 0x8825) summary.hasGps = true; // GPS IFD pointer present
  }
  return summary;
}
```

- [ ] **Step 8: Run to verify EXIF passes**

Run: `npm test -- --run src/tools/image/exif.lib.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/tools/image/ico.lib.ts src/tools/image/ico.lib.test.ts src/tools/image/exif.lib.ts src/tools/image/exif.lib.test.ts
git commit -m "feat(image): add ICO directory parser and minimal EXIF reader"
```

---

## Task 10: Image Viewer & Metadata — island + registry

**Files:**
- Create: `src/islands/image/ImageViewer.tsx`
- Modify: `src/registry/tools.ts`

**Interfaces:**
- Consumes: `parseIcoEntries`, `IcoEntry` (Task 9); `readExifSummary` (Task 9); `ZoomPane` (Task 6); `formatBytes` (`@/tools/image/canvas.lib`); `EditInAnnotatorButton` (Task 2); `sendImageToAnnotator` not needed directly (button handles it); `Dropzone`, `Button`, `usePasteImage`.

- [ ] **Step 1: Create the island**

Create `src/islands/image/ImageViewer.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { ZoomPane } from '@/components/ui/ZoomPane';
import { EditInAnnotatorButton } from '@/components/ui/EditInAnnotatorButton';
import { downloadService } from '@/services/download';
import { formatBytes } from '@/tools/image/canvas.lib';
import { parseIcoEntries, type IcoEntry } from '@/tools/image/ico.lib';
import { readExifSummary, type ExifSummary } from '@/tools/image/exif.lib';
import { usePasteImage } from '@/hooks/usePasteImage';

interface Meta {
  name: string;
  type: string;
  size: number;
  width: number;
  height: number;
  exif: ExifSummary | null;
  ico: IcoEntry[];
}

export default function ImageViewer() {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [meta, setMeta] = useState<Meta | null>(null);

  const onDrop = (files: File[]) => {
    setFile(files.find((f) => f.type.startsWith('image/') || /\.(ico|cur)$/i.test(f.name)) ?? null);
  };
  usePasteImage((f) => onDrop([f]));

  useEffect(() => {
    if (!file) { setUrl(''); setMeta(null); return; }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    let alive = true;
    (async () => {
      const buffer = await file.arrayBuffer();
      const isIco = file.type.includes('icon') || /\.ico$/i.test(file.name);
      const ico = isIco ? parseIcoEntries(buffer) : [];
      const exif = /jpe?g/i.test(file.type) ? readExifSummary(buffer) : null;
      const img = new Image();
      img.onload = () => {
        if (!alive) return;
        setMeta({ name: file.name, type: file.type || (isIco ? 'image/x-icon' : 'unknown'), size: file.size, width: img.naturalWidth, height: img.naturalHeight, exif, ico });
      };
      img.src = objectUrl;
    })();
    return () => { alive = false; URL.revokeObjectURL(objectUrl); };
  }, [file]);

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-4 border-b border-border py-1 text-sm">
      <span className="font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-mono text-right">{value}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <Dropzone onDrop={onDrop} accept="image/*,.ico" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">Drop an image or click to browse</p>
          <p className="text-sm text-muted-foreground">View any image (incl. .ico) with its metadata · or paste (⌘V)</p>
        </div>
      </Dropzone>

      {url && (
        <ZoomPane>
          <img src={url} alt={file?.name ?? 'image'} />
        </ZoomPane>
      )}

      {meta && (
        <div className="space-y-1">
          {row('Name', meta.name)}
          {row('Type', meta.type)}
          {row('Size', formatBytes(meta.size))}
          {row('Dimensions', `${meta.width} × ${meta.height}`)}
          {meta.exif ? (
            <>
              {row('Orientation', meta.exif.orientation ?? '—')}
              {row('GPS', meta.exif.hasGps ? 'present' : 'none')}
            </>
          ) : (
            /jpe?g/i.test(meta.type) ? row('EXIF', 'No EXIF metadata') : null
          )}
          {meta.ico.length > 0 && row('ICO sizes', meta.ico.map((e) => `${e.width}×${e.height}`).join(', '))}
        </div>
      )}

      {file && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => downloadService.download(file, file.name)}>Download</Button>
          <EditInAnnotatorButton blob={() => file} filename={file.name} />
          <a href="/tools/image-convert" className="inline-flex items-center border-2 border-border bg-background px-3 py-2 text-sm font-bold shadow-brutal-sm hover:bg-muted">Convert…</a>
        </div>
      )}
    </div>
  );
}
```

Note on the "Edit in Annotator" for SVG/ICO: the handoff passes the original file blob; the annotator decodes it with `createImageBitmap`, which handles raster images. (SVG/ICO annotation is best-effort, consistent with the annotator's existing capabilities.)

- [ ] **Step 2: Register the tool**

In `src/registry/tools.ts`, add `Eye` to the lucide import line, then add:

```ts
  {
    id: 'image-viewer',
    name: 'Image Viewer & Metadata',
    category: 'Image',
    route: '/tools/image-viewer',
    keywords: ['image', 'viewer', 'metadata', 'exif', 'ico', 'favicon', 'dimensions', 'inspect'],
    icon: Eye,
    summary: 'View any image with dimensions, EXIF, and ICO sizes',
    load: () => import('@/islands/image/ImageViewer'),
    status: 'stable'
  },
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds; `/tools/image-viewer` generated.

- [ ] **Step 4: Commit**

```bash
git add src/islands/image/ImageViewer.tsx src/registry/tools.ts
git commit -m "feat(image): add Image Viewer & Metadata tool"
```

---

## Task 11: Wire "Edit in Annotator" into the manual tools

**Files:**
- Modify: `src/islands/media/Screenshot.tsx`, `src/islands/image/BackgroundRemove.tsx`, `src/islands/image/FaceBlur.tsx`, `src/islands/image/PortraitBlur.tsx`, `src/islands/image/ObjectRemove.tsx`, `src/islands/image/ImageUpscale.tsx`, `src/islands/image/QrGen.tsx`, `src/islands/pdf/PdfToImage.tsx`, `src/islands/image/SignaturePad.tsx`

**Interfaces:**
- Consumes: `EditInAnnotatorButton` (Task 2).

These tools render Download/Copy actions directly rather than via `ImageResult`, so each needs the button added next to its existing image-output actions. Each is one edit + one build check. The exact paths may differ slightly; Step 1 locates them.

- [ ] **Step 1: Locate each tool's result-action block**

Run:
```bash
grep -rln "downloadService.download\|CopyImageButton" src/islands/media/Screenshot.tsx src/islands/image/BackgroundRemove.tsx src/islands/image/FaceBlur.tsx src/islands/image/PortraitBlur.tsx src/islands/image/ObjectRemove.tsx src/islands/image/ImageUpscale.tsx src/islands/image/QrGen.tsx src/islands/pdf/PdfToImage.tsx src/islands/image/SignaturePad.tsx
```
Expected: confirms each file and that it has an image-output action area. (If a path differs, run `grep -rl "CopyImageButton" src/islands` to find the correct one.)

- [ ] **Step 2: Add the button in each tool (example: Screenshot)**

In `src/islands/media/Screenshot.tsx`, add the import:
```tsx
import { EditInAnnotatorButton } from '@/components/ui/EditInAnnotatorButton';
```
and, next to the existing `<CopyImageButton blob={result} />` (around line 467), add:
```tsx
<EditInAnnotatorButton blob={result} filename={`screenshot.${fmt}`} />
```

Apply the same pattern in each of the other eight tools: import `EditInAnnotatorButton`, then render `<EditInAnnotatorButton blob={<the result blob variable>} filename={<the tool's output filename>} />` immediately after that tool's Copy/Download button for its image output. Use the blob variable already in scope (e.g. `result`, `output`, `blob`); for `PdfToImage`, add it inside the per-page action row using that page's blob; for `QrGen` and `SignaturePad`, use their PNG blob.

- [ ] **Step 3: Build after each edit (or after all)**

Run: `npm run build`
Expected: build succeeds — every modified tool type-checks and the button renders.

- [ ] **Step 4: Commit**

```bash
git add src/islands
git commit -m "feat(handoff): add Edit in Annotator to manual image-output tools"
```

---

## Task 12: Full verification

- [ ] **Step 1: Run the whole test suite**

Run: `npm test -- --run`
Expected: all tests pass, including the new `handoff`, `mono.lib`, `svg.lib`, `ico.lib`, `exif.lib` suites.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: succeeds; the three new routes exist under `dist/tools/`:
```bash
ls dist/tools | grep -E "monochrome|svg-viewer|image-viewer"
```

- [ ] **Step 3: Manual smoke test (dev server)**

Run: `npm run dev`, then verify:
- `/tools/monochrome` — drop an image, toggle modes, move threshold, download + "Edit in Annotator" opens annotator with the mono image.
- `/tools/svg-viewer` — drop/paste an SVG, zoom, export PNG/JPEG/WebP.
- `/tools/image-viewer` — drop a JPEG (see EXIF orientation), drop an .ico (see sizes).
- Any `ImageResult` tool (e.g. Image Converter) now shows "Edit in Annotator".

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "chore(image): finalize image tools + annotator handoff"
```

---

## Self-Review

**1. Spec coverage:**
- SVG Viewer & Converter → Tasks 7–8. ✓
- Image Viewer & Metadata (EXIF + multi-size ICO) → Tasks 9–10. ✓
- Monochrome (grayscale/bw/dither) → Tasks 4–5. ✓
- Annotator handoff service + button + annotator mount hook + ResultActions + manual tools → Tasks 1, 2, 3, 11. ✓
- Shared ZoomPane → Task 6. ✓
- Registry entries → Tasks 5, 8, 10. ✓

**2. Placeholder scan:** No TBD/TODO; every code step has complete code; no "add error handling" hand-waves. ✓

**3. Type consistency:** `takePendingImage`/`putPendingImage`/`sendImageToAnnotator`/`isFresh` consistent across Tasks 1–3, 11. `MonoMode` values `'grayscale'|'bw'|'dither'` match between lib (Task 4) and island (Task 5). `RasterizeOpts.type` union matches the island's `FORMATS` types (Task 8). `IcoEntry`/`ExifSummary` shapes consistent between Tasks 9 and 10. `EditInAnnotatorButton` prop `blob` accepts `Blob | (() => …) | null`, matching both the `ResultActions` (plain Blob) and `ImageViewer`/manual-tool (thunk) call sites. ✓
