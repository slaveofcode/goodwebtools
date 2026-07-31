# Camera Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add webcam/phone-camera capture as an input: a reusable `CameraCapture` component wired into the shared `OcrWorkbench` (OCR + Receipt Scanner) and exposed as a standalone "Camera Capture" tool.

**Architecture:** A `useCamera` hook owns the `MediaStream` lifecycle; a pure `frameToFile` helper converts a video frame to a JPEG `File`; `CameraCapture` renders live preview + controls (with a native `<input capture>` fallback); two hosts consume it — `OcrWorkbench` (→ existing `onDrop`) and `CameraTool` (→ Download/Copy/Edit-in-Annotator).

**Tech Stack:** React islands (Astro); browser `getUserMedia` + canvas; existing `downloadService`, `CopyImageButton`, `EditInAnnotatorButton`, `ImageResult`; Vitest.

## Global Constraints

- **Branch:** `feat/camera-capture` (spec already committed here).
- **Reusable component, three surfaces:** one `CameraCapture` used by `OcrWorkbench` and `CameraTool`. (Spec §Architecture).
- **Rear default + switch:** `facingMode: 'environment'`; Switch button only when `hasMultiple`. (Spec §Locked Decision 2).
- **Fallback:** on any getUserMedia failure, render `<input type="file" accept="image/*" capture="environment">`. (Spec §Error Handling).
- **Format:** JPEG, quality 0.92. (Spec §Locked Decision 6).
- **Lifecycle:** stop every track on capture, cancel, error, and unmount — no lingering camera. (Spec §Error Handling).
- **Privacy/secure context:** frames never leave the browser; `getUserMedia` needs HTTPS (prod is HTTPS; fallback covers the rest).
- **Test style:** Vitest; mock `navigator.mediaDevices` per `src/services/capture/browser.test.ts`. Pure helper unit-tested; islands stay thin.
- **Lint:** `npm run lint` 0 errors; no `any` in new source.

## File Structure

| File | Responsibility |
|------|----------------|
| `src/tools/image/camera.lib.ts` (create) | Pure `frameToFile(video, name?)`. |
| `src/tools/image/camera.lib.test.ts` (create) | Frame→File tests. |
| `src/hooks/useCamera.ts` (create) | `MediaStream` lifecycle hook. |
| `src/hooks/useCamera.test.ts` (create) | Hook tests (mock mediaDevices). |
| `src/islands/image/CameraCapture.tsx` (create) | Live preview + controls + native fallback. |
| `src/islands/image/OcrWorkbench.tsx` (modify) | "Use camera" button → `CameraCapture` → `onDrop`. |
| `src/islands/image/CameraTool.tsx` (create) | Standalone tool: capture → result actions. |
| `src/registry/tools.ts` (modify) | Register `camera-capture`. |

---

### Task 1: `frameToFile` helper (`camera.lib.ts`)

Pure conversion of a video frame to a JPEG `File`. Isolated + unit-tested.

**Files:**
- Create: `src/tools/image/camera.lib.ts`
- Test: `src/tools/image/camera.lib.test.ts`

**Interfaces:**
- Produces: `frameToFile(video: HTMLVideoElement, name?: string): Promise<File>` — draws `video` (using `videoWidth`/`videoHeight`) to a canvas, encodes `image/jpeg` q0.92, returns a `File` named `name ?? 'camera-capture.jpg'`.

- [ ] **Step 1: Write the failing test**

Create `src/tools/image/camera.lib.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { frameToFile } from './camera.lib';

// Minimal canvas mock: records the size it was asked to draw and yields a blob.
beforeEach(() => {
  const ctx = { drawImage: vi.fn() };
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag !== 'canvas') return document.createElement(tag);
    return {
      width: 0,
      height: 0,
      getContext: () => ctx,
      toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(['x'], { type: 'image/jpeg' })),
    } as unknown as HTMLCanvasElement;
  });
});

function fakeVideo(w: number, h: number): HTMLVideoElement {
  return { videoWidth: w, videoHeight: h } as HTMLVideoElement;
}

describe('frameToFile', () => {
  it('returns a JPEG File sized to the video frame', async () => {
    const file = await frameToFile(fakeVideo(640, 480));
    expect(file).toBeInstanceOf(File);
    expect(file.type).toBe('image/jpeg');
    expect(file.name).toBe('camera-capture.jpg');
  });

  it('uses a custom filename', async () => {
    const file = await frameToFile(fakeVideo(100, 100), 'shot.jpg');
    expect(file.name).toBe('shot.jpg');
  });

  it('rejects when the frame has no dimensions', async () => {
    await expect(frameToFile(fakeVideo(0, 0))).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/tools/image/camera.lib.test.ts`
Expected: FAIL — `./camera.lib` not found.

- [ ] **Step 3: Write the implementation**

Create `src/tools/image/camera.lib.ts`:

```ts
/** Capture the current frame of a playing <video> as a JPEG File. */
export async function frameToFile(video: HTMLVideoElement, name = 'camera-capture.jpg'): Promise<File> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) throw new Error('Camera frame is not ready yet.');
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser');
  ctx.drawImage(video, 0, 0, w, h);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to encode image'))), 'image/jpeg', 0.92),
  );
  return new File([blob], name, { type: 'image/jpeg' });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/tools/image/camera.lib.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: (Hold commit — commit at end of plan per prior flow, or per user instruction.)**

---

### Task 2: `useCamera` hook

Owns the `MediaStream`: start (rear default), stop (kill tracks), switch camera, detect multiple cameras, reason-typed errors.

**Files:**
- Create: `src/hooks/useCamera.ts`
- Test: `src/hooks/useCamera.test.ts`

**Interfaces:**
- Produces:
  - `type CameraErrorReason = 'insecure' | 'denied' | 'notfound' | 'unsupported' | 'unknown'`
  - `interface CameraError { reason: CameraErrorReason; message: string }`
  - `function useCamera(): { videoRef: React.RefObject<HTMLVideoElement>; stream: MediaStream | null; error: CameraError | null; hasMultiple: boolean; facingMode: 'environment' | 'user'; start: () => Promise<void>; stop: () => void; switchCamera: () => Promise<void> }`
- Consumes: nothing from earlier tasks.

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useCamera.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCamera } from './useCamera';

const stop = vi.fn();
const track = { stop };
class FakeStream {
  getTracks() { return [track]; }
}

function mockMediaDevices(over: Partial<Record<string, unknown>> = {}) {
  Object.defineProperty(global.navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue(new FakeStream()),
      enumerateDevices: vi.fn().mockResolvedValue([
        { kind: 'videoinput' }, { kind: 'videoinput' }, { kind: 'audioinput' },
      ]),
      ...over,
    },
  });
}

beforeEach(() => { stop.mockClear(); mockMediaDevices(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('useCamera', () => {
  it('start() acquires a stream and detects multiple cameras', async () => {
    const { result } = renderHook(() => useCamera());
    await act(async () => { await result.current.start(); });
    expect(result.current.stream).not.toBeNull();
    expect(result.current.hasMultiple).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('stop() stops every track', async () => {
    const { result } = renderHook(() => useCamera());
    await act(async () => { await result.current.start(); });
    act(() => { result.current.stop(); });
    expect(stop).toHaveBeenCalled();
    expect(result.current.stream).toBeNull();
  });

  it('maps a denied permission to reason "denied"', async () => {
    const err = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    mockMediaDevices({ getUserMedia: vi.fn().mockRejectedValue(err) });
    const { result } = renderHook(() => useCamera());
    await act(async () => { await result.current.start(); });
    expect(result.current.error?.reason).toBe('denied');
  });

  it('reports "unsupported" when mediaDevices is missing', async () => {
    Object.defineProperty(global.navigator, 'mediaDevices', { configurable: true, value: undefined });
    const { result } = renderHook(() => useCamera());
    await act(async () => { await result.current.start(); });
    expect(result.current.error?.reason).toBe('unsupported');
  });

  it('switchCamera() flips facingMode', async () => {
    const { result } = renderHook(() => useCamera());
    await act(async () => { await result.current.start(); });
    expect(result.current.facingMode).toBe('environment');
    await act(async () => { await result.current.switchCamera(); });
    expect(result.current.facingMode).toBe('user');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/hooks/useCamera.test.ts`
Expected: FAIL — `./useCamera` not found.

- [ ] **Step 3: Write the implementation**

Create `src/hooks/useCamera.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraErrorReason = 'insecure' | 'denied' | 'notfound' | 'unsupported' | 'unknown';
export interface CameraError { reason: CameraErrorReason; message: string }

const MESSAGES: Record<CameraErrorReason, string> = {
  insecure: 'Camera needs a secure (https) connection.',
  denied: 'Camera access was blocked — allow it in your browser settings, or use your device camera.',
  notfound: 'No camera was found on this device.',
  unsupported: 'This browser can’t open the camera.',
  unknown: 'Could not start the camera.',
};

function classify(err: unknown): CameraErrorReason {
  const name = err instanceof Error ? err.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'notfound';
  return 'unknown';
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<CameraError | null>(null);
  const [hasMultiple, setHasMultiple] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  const open = useCallback(async (mode: 'environment' | 'user') => {
    setError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError({ reason: 'unsupported', message: MESSAGES.unsupported });
      return;
    }
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setError({ reason: 'insecure', message: MESSAGES.insecure });
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode }, audio: false });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = s;
      setStream(s);
      setFacingMode(mode);
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setHasMultiple(devices.filter((d) => d.kind === 'videoinput').length > 1);
      } catch {
        setHasMultiple(false);
      }
    } catch (err) {
      const reason = classify(err);
      setError({ reason, message: MESSAGES[reason] });
    }
  }, []);

  const start = useCallback(() => open('environment'), [open]);
  const switchCamera = useCallback(
    () => open(facingMode === 'environment' ? 'user' : 'environment'),
    [open, facingMode],
  );

  // Attach the stream to the <video> element whenever it changes.
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  // Always release the camera on unmount.
  useEffect(() => () => stop(), [stop]);

  return { videoRef, stream, error, hasMultiple, facingMode, start, stop, switchCamera };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/hooks/useCamera.test.ts`
Expected: PASS (5 tests).

> `renderHook` comes from `@testing-library/react` (v14, already a devDependency — confirmed present).

- [ ] **Step 5: (Hold commit.)**

---

### Task 3: `CameraCapture` component

Live preview + Capture/Switch/Cancel, with the native-input fallback on error. Emits a `File`.

**Files:**
- Create: `src/islands/image/CameraCapture.tsx`

**Interfaces:**
- Consumes: `useCamera` (Task 2); `frameToFile` (Task 1); `Button`, `Alert`.
- Produces: `export default function CameraCapture(props: { onCapture: (file: File) => void; onCancel: () => void })`.

- [ ] **Step 1: Implement the component**

Create `src/islands/image/CameraCapture.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useCamera } from '@/hooks/useCamera';
import { frameToFile } from '@/tools/image/camera.lib';

export default function CameraCapture({
  onCapture,
  onCancel,
}: {
  onCapture: (file: File) => void;
  onCancel: () => void;
}) {
  const { videoRef, stream, error, hasMultiple, start, stop, switchCamera } = useCamera();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  // Open the camera on mount; release on unmount.
  useEffect(() => { start(); return () => stop(); }, [start, stop]);

  // Play the stream once attached.
  useEffect(() => {
    if (stream && videoRef.current) videoRef.current.play().catch(() => {});
  }, [stream, videoRef]);

  const capture = async () => {
    if (!videoRef.current) return;
    setBusy(true);
    try {
      const file = await frameToFile(videoRef.current);
      stop();
      onCapture(file);
    } catch {
      setBusy(false);
    }
  };

  const cancel = () => { stop(); onCancel(); };

  const onFallbackFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onCapture(file);
  };

  return (
    <div className="space-y-3 border-2 border-border p-3">
      {error ? (
        <div className="space-y-2">
          <Alert variant="error">{error.message}</Alert>
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>Use device camera</Button>
          <Button variant="ghost" onClick={cancel}>Cancel</Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFallbackFile}
            className="hidden"
          />
        </div>
      ) : (
        <div className="space-y-3">
          <video ref={videoRef} playsInline muted className="max-h-96 w-auto border-2 border-border" />
          <div className="flex flex-wrap gap-2">
            <Button onClick={capture} disabled={busy || !stream}>{busy ? 'Capturing…' : 'Capture'}</Button>
            {hasMultiple && <Button variant="secondary" onClick={switchCamera}>Switch camera</Button>}
            <Button variant="ghost" onClick={cancel}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: succeeds (component compiles; not yet routed).

- [ ] **Step 3: (Hold commit.)**

---

### Task 4: Wire "Use camera" into `OcrWorkbench`

**Files:**
- Modify: `src/islands/image/OcrWorkbench.tsx`

**Interfaces:**
- Consumes: `CameraCapture` (Task 3). Reuses the existing `onDrop(files: File[])` in `OcrWorkbench`.

- [ ] **Step 1: Add the camera toggle + panel**

In `src/islands/image/OcrWorkbench.tsx`:

Add the import:
```tsx
import CameraCapture from './CameraCapture';
```

Add state near the other `useState` hooks:
```tsx
  const [cameraOpen, setCameraOpen] = useState(false);
```

Replace the `<Dropzone>...</Dropzone>` block with a camera-aware version — when the camera is open, show `CameraCapture`; otherwise the dropzone plus a "Use camera" button:
```tsx
      {cameraOpen ? (
        <CameraCapture
          onCapture={(file) => { setCameraOpen(false); onDrop([file]); }}
          onCancel={() => setCameraOpen(false)}
        />
      ) : (
        <div className="space-y-2">
          <Dropzone onDrop={onDrop} accept="image/*,application/pdf" multiple={false}>
            <div className="space-y-1">
              <p className="text-lg font-bold">Drop an image or PDF, or click to browse</p>
              <p className="text-sm text-muted-foreground">Runs on-device · or paste (⌘V). First use downloads the OCR model once.</p>
            </div>
          </Dropzone>
          <Button variant="secondary" onClick={() => setCameraOpen(true)}>Use camera</Button>
        </div>
      )}
```

(`Button` is already imported in `OcrWorkbench`.)

- [ ] **Step 2: Verify**

Run: `npx vitest run` — Expected: all existing tests still pass.
Run: `npm run build` — Expected: succeeds; `/tools/image-ocr` and `/tools/image-receipt-scanner` build.
Manual: on both tools a **Use camera** button appears; clicking opens the live preview; Capture feeds the OCR pipeline.

- [ ] **Step 3: (Hold commit.)**

---

### Task 5: Standalone `CameraTool` + registry

**Files:**
- Create: `src/islands/image/CameraTool.tsx`
- Modify: `src/registry/tools.ts`

**Interfaces:**
- Consumes: `CameraCapture` (Task 3); `ImageResult`, `CopyImageButton`, `EditInAnnotatorButton`, `Button`.
- Produces: default-exported `CameraTool`; registry entry `camera-capture`.

- [ ] **Step 1: Create `CameraTool.tsx`**

Create `src/islands/image/CameraTool.tsx`:

```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ImageResult } from '@/components/ui/ImageResult';
import { CopyImageButton } from '@/components/ui/CopyImageButton';
import { EditInAnnotatorButton } from '@/components/ui/EditInAnnotatorButton';
import CameraCapture from './CameraCapture';

export default function CameraTool() {
  const [photo, setPhoto] = useState<File | null>(null);
  const [capturing, setCapturing] = useState(true);

  const retake = () => { setPhoto(null); setCapturing(true); };

  return (
    <div className="space-y-4">
      {capturing && (
        <CameraCapture
          onCapture={(file) => { setPhoto(file); setCapturing(false); }}
          onCancel={() => setCapturing(false)}
        />
      )}

      {!capturing && !photo && (
        <Button onClick={() => setCapturing(true)}>Open camera</Button>
      )}

      {photo && (
        <div className="space-y-2">
          <ImageResult blob={photo} filename={photo.name} />
          <div className="flex flex-wrap gap-2">
            <CopyImageButton blob={photo} />
            <EditInAnnotatorButton blob={photo} filename={photo.name} />
            <Button variant="secondary" onClick={retake}>Retake</Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Register the tool**

In `src/registry/tools.ts`, add `Webcam` to the `lucide-react` import list, then add this entry right after the `image-receipt-scanner` entry:

```ts
  {
    id: 'camera-capture',
    name: 'Camera Capture',
    category: 'Image',
    route: '/tools/camera-capture',
    keywords: ['camera', 'webcam', 'photo', 'capture', 'snap', 'take picture', 'scan'],
    icon: Webcam,
    summary: 'Take a photo with your webcam or phone camera',
    load: () => import('@/islands/image/CameraTool'),
    status: 'beta'
  },
```

- [ ] **Step 3: Verify build + full suite + lint**

Run: `npx vitest run` — Expected: all pass (camera.lib + useCamera tests added).
Run: `npm run lint` — Expected: 0 errors.
Run: `npm run build` — Expected: succeeds; `/tools/camera-capture` page builds.
Manual smoke: `/tools/camera-capture` → live preview → Capture → photo shows with Download / Copy / Edit in Annotator; Retake reopens. Deny camera → native fallback button appears.

- [ ] **Step 4: (Hold commit.)**

---

## Verification loop (before shipping)

After Task 5, run the full gate and fix any issue until green:
- `npx vitest run` — full suite green (adds ~8 tests: camera.lib 3, useCamera 5).
- `npm run lint` — 0 errors.
- `npm run build` — succeeds; three routes updated/added (`image-ocr`, `image-receipt-scanner`, `camera-capture`).
- Review for: leaked streams (every path calls `stop()`), SSR safety (no `navigator`/`window` access at module scope), and the fallback path.

## Post-completion

Follow the established flow: commit per task (or as agreed), push, PR to `develop`, wait for CI, merge, promote `develop`→`main`, confirm the production Cloudflare build, and verify the live routes.

## Notes / deliberate limits

- No torch/flash, resolution picker, auto-capture, or barcode reading (Spec §Out of Scope).
- The native fallback uses `<input capture="environment">` — on desktop this is just a file picker; that's acceptable since live `getUserMedia` is the primary path there.
- `frameToFile` and `useCamera` hold the logic + tests; islands stay thin and are covered by build + manual smoke (consistent with the OCR/Receipt tools).
