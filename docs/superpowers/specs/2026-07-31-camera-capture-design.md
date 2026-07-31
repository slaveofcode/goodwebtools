# Camera Capture — Design Spec

**Status:** Approved (brainstorming complete)
**Date:** 2026-07-31
**Author:** brainstormed with Kresna
**Related:** reuses the OCR pipeline (`OcrWorkbench`) from `2026-07-30-image-ocr-design.md`.

## Goal

Let users capture an image from their **webcam or phone camera** as an input alongside upload/paste. Surface it three ways from one reusable component:
1. a **"Use camera"** option in the shared `OcrWorkbench` (so both **Image → Text (OCR)** and **Receipt Scanner** gain it), and
2. a dedicated **"Camera Capture"** tool that snaps a photo and offers Download / Copy / Edit in Annotator.

Everything is client-side; the camera frame never leaves the browser.

## Locked Decisions

1. **Access method:** live camera via `getUserMedia`, **with a native `<input capture>` fallback** when the live camera is unavailable/denied.
2. **Camera control:** default to the **rear camera** (`facingMode: 'environment'`), with a **Switch camera** button when more than one camera exists.
3. **Reusable component:** a single `CameraCapture` component + `useCamera` hook, consumed by `OcrWorkbench` and the new tool. It hands back a `File` via callback; the host decides what to do with it.
4. **Standalone tool output:** show the captured photo with **Download + Copy + Edit in Annotator** (mirrors the Screenshot tool).
5. **Capture UI:** an **in-page panel** (not a full-screen modal) that replaces the input area while active.
6. **Capture format:** **JPEG** (`image/jpeg`, quality ~0.92) — smaller for photographs.

## Architecture

A `useCamera` hook owns the `MediaStream` lifecycle. A `CameraCapture` component renders the live preview + controls and produces a `File`. Two hosts consume it:

```
                         ┌─ OcrWorkbench  → onCapture(file) → onDrop([file]) → existing OCR pipeline
CameraCapture ─(File)────┤
  (useCamera hook)       └─ CameraTool    → onCapture(file) → result: Download / Copy / Edit in Annotator
```

### Components

| File | Responsibility | Tested by |
|------|----------------|-----------|
| `src/hooks/useCamera.ts` (create) | Own `getUserMedia`: `start(facingMode)`, `stop()`, `switchCamera()`; expose `stream`, `error` (reason-typed), `hasMultiple`, `facingMode`. Stop all tracks on `stop()` and unmount. Detect >1 camera via `enumerateDevices`. | Mock `navigator.mediaDevices` |
| `src/tools/image/camera.lib.ts` (create) | Pure `frameToFile(video: HTMLVideoElement, name?: string): Promise<File>` — draw the current video frame to a canvas → JPEG blob → File. | Mock canvas/video minimally |
| `src/islands/image/CameraCapture.tsx` (create) | Live `<video>` preview + **Capture** / **Switch camera** / **Cancel**. On error, render the native `<input type="file" accept="image/*" capture="environment">` fallback. Prop: `onCapture(file: File) => void`, `onCancel() => void`. | Build + manual |
| `src/islands/image/OcrWorkbench.tsx` (modify) | Add a **Use camera** button; when open, render `CameraCapture`; on capture call the existing `onDrop([file])`. | Build + manual |
| `src/islands/image/CameraTool.tsx` (create) | Standalone tool: `CameraCapture` → on capture show `ImageResult` + `CopyImageButton` + `EditInAnnotatorButton`; "Retake" resets. | Build + manual |
| `src/registry/tools.ts` (modify) | Register `camera-capture` ("Camera Capture", Image, `status: 'beta'`). | Build |

### Data Model / Interfaces

```ts
// useCamera
type CameraErrorReason = 'insecure' | 'denied' | 'notfound' | 'unsupported' | 'unknown';
interface UseCamera {
  videoRef: React.RefObject<HTMLVideoElement>;
  stream: MediaStream | null;
  error: { reason: CameraErrorReason; message: string } | null;
  hasMultiple: boolean;
  facingMode: 'environment' | 'user';
  start: () => Promise<void>;
  stop: () => void;
  switchCamera: () => Promise<void>;
}

// camera.lib
function frameToFile(video: HTMLVideoElement, name?: string): Promise<File>; // image/jpeg
```

## UX / Data Flow

1. In `OcrWorkbench` (and the Camera tool) the user clicks **Use camera**.
2. `useCamera.start()` requests the rear camera. On success, the in-page panel shows the live `<video>` preview with **Capture**, **Switch camera** (only if `hasMultiple`), and **Cancel**.
3. **Capture** → `frameToFile(video)` → the stream is stopped → host gets the `File`:
   - **OCR/Receipt:** `onDrop([file])` — the photo enters the normal preprocess→OCR flow (downscale, rotate, cleanup, run).
   - **Camera tool:** show the photo via `ImageResult` with Download / Copy / Edit in Annotator; **Retake** reopens the camera.
4. **Cancel** stops the stream and returns to the dropzone/idle state.

## Error Handling (reason-specific)

`useCamera` maps failures to a typed reason + message; the UI shows the message and offers the native-input fallback:

- **Not secure context** (`insecure`) → "Camera needs a secure (https) connection." + fallback.
- **Permission denied** (`denied`, `NotAllowedError`) → "Camera access was blocked — allow it in your browser settings, or use your device camera." + fallback.
- **No camera** (`notfound`, `NotFoundError`/`OverconstrainedError`) → "No camera found." + fallback.
- **getUserMedia unsupported** (`unsupported`) → "This browser can't open the camera." + fallback.
- The **native fallback** is `<input type="file" accept="image/*" capture="environment">`: on phones it opens the OS camera app; selecting a photo calls the same `onCapture(file)`.
- **Lifecycle:** every `MediaStreamTrack` is stopped on capture, cancel, error, and component unmount — no lingering camera indicator.

## Testing

- **`useCamera` (Vitest):** mock `navigator.mediaDevices.getUserMedia` / `enumerateDevices`:
  - `start()` sets `stream`; a rejected `getUserMedia` with `NotAllowedError` → `error.reason === 'denied'`; missing `mediaDevices` → `unsupported`.
  - `stop()` calls `stop()` on every track.
  - `switchCamera()` toggles `facingMode` and re-requests.
  - `hasMultiple` true when `enumerateDevices` reports ≥2 `videoinput`.
- **`camera.lib` (`frameToFile`):** with a stubbed video (`videoWidth/Height`) and canvas, returns a `File` of type `image/jpeg` with the expected dimensions.
- **Islands** stay thin — build + manual smoke: laptop live capture; phone rear + switch; denied → native fallback; captured photo flows into OCR and into the standalone result.

## Constraints & Non-Functional

- **Privacy:** frames never leave the browser; no uploads.
- **Secure context:** `getUserMedia` requires HTTPS — production is HTTPS; the fallback covers any insecure/denied case.
- **No new deps:** browser `getUserMedia` + canvas only.
- **Reuses** existing `downloadService`, `CopyImageButton`, `EditInAnnotatorButton`, `ImageResult`, and the `onDrop(File[])` pipeline — no downstream changes.

## Out of Scope

- Torch/flash toggle, resolution/aspect picker.
- Continuous scanning / auto-capture / edge detection / auto-crop.
- Barcode/QR reading (there's already a QR reader tool).
- Desktop (Tauri) native camera — the web `getUserMedia` path works there too; no special-casing.
