/**
 * Framing feedback and automatic head alignment for the ID-photo (pas foto)
 * camera flow. Pure and framework-free: the island feeds in a detected face
 * box, this decides what to tell the user and what zoom/offset makes the head
 * land on the passport guide.
 *
 * Coordinates are pixels in the source frame (video frame or still image).
 */
import { HEAD_GUIDE } from './pas-foto.lib';

export interface FaceBox { x: number; y: number; w: number; h: number }

/**
 * Where the head actually sits relative to MediaPipe's (square) face box.
 *
 * Calibrated against a real detection rather than guessed: on a sample photo
 * the detector returned a 436px box while the true crown-to-chin height was
 * ~521px, with the chin sitting slightly ABOVE the box bottom. The earlier
 * 1.4 factor overestimated the head by ~17%, which made the tool report
 * "framing looks good" while the subject was still too far from the camera.
 */
export const CHIN_AT = 0.88;      // chin, as a fraction down the box
export const CROWN_ABOVE = 0.32;  // crown, as a fraction of box height above its top
export const HEAD_TO_FACE = CHIN_AT + CROWN_ABOVE; // 1.20

/** Estimated crown/chin/centre of the head from a detected face box. */
export function headFromFace(face: FaceBox): { crownY: number; chinY: number; cx: number; headH: number } {
  const chinY = face.y + face.h * CHIN_AT;
  const crownY = face.y - face.h * CROWN_ABOVE;
  return { crownY, chinY, cx: face.x + face.w / 2, headH: chinY - crownY };
}

export type FramingStatus = 'ok' | 'no-face' | 'too-close' | 'too-far' | 'off-center' | 'too-high' | 'too-low';

export interface FramingOptions {
  /** Tolerance on head height as a fraction of the target (default ±18%). */
  sizeTolerance?: number;
  /** Horizontal tolerance as a fraction of frame width (default 8%). */
  centerTolerance?: number;
  /** Vertical tolerance on the crown as a fraction of frame height (default 10%). */
  verticalTolerance?: number;
}

/**
 * Compare a detected face against the passport guide for a frame of the given
 * size, and say what the user should change. Checks size first (the most
 * common problem), then centring, then height.
 */
export function framingFeedback(
  face: FaceBox | null,
  frameW: number,
  frameH: number,
  opts: FramingOptions = {},
): FramingStatus {
  if (!face || face.w <= 0 || face.h <= 0) return 'no-face';
  const { sizeTolerance = 0.18, centerTolerance = 0.08, verticalTolerance = 0.1 } = opts;

  const { crownY, headH, cx } = headFromFace(face);
  const targetHeadH = (HEAD_GUIDE.chin - HEAD_GUIDE.crown) * frameH;

  const sizeRatio = headH / targetHeadH;
  if (sizeRatio > 1 + sizeTolerance) return 'too-close';
  if (sizeRatio < 1 - sizeTolerance) return 'too-far';

  if (Math.abs(cx - frameW / 2) > centerTolerance * frameW) return 'off-center';

  const targetCrownY = HEAD_GUIDE.crown * frameH;
  const dy = crownY - targetCrownY;
  if (dy < -verticalTolerance * frameH) return 'too-high';
  if (dy > verticalTolerance * frameH) return 'too-low';

  return 'ok';
}

/**
 * The centred region of a source frame that a "cover" fit keeps for a photo of
 * the given aspect — i.e. exactly what the preview shows at zoom 1, offset 0.
 * The live camera guide is drawn over this rect so what you frame is what you get.
 */
export function coverCropRect(srcW: number, srcH: number, photoW: number, photoH: number): { x: number; y: number; w: number; h: number } {
  const cover = Math.max(photoW / srcW, photoH / srcH);
  const w = photoW / cover;
  const h = photoH / cover;
  return { x: (srcW - w) / 2, y: (srcH - h) / 2, w, h };
}

export interface AlignTransform { zoom: number; offsetY: number }

/**
 * Compute the {zoom, offsetY} that the preview compositor needs so the
 * detected head lands on the passport guide.
 *
 * The compositor scales the image to *cover* a W×H photo frame, multiplies by
 * `zoom`, centres it, then shifts it by `offsetY * H`. This inverts that:
 * pick the zoom that makes the head the target height, then the offset that
 * puts the crown on the guide line.
 */
export function alignTransform(
  face: FaceBox,
  imgW: number,
  imgH: number,
  photoW: number,
  photoH: number,
  limits: { minZoom?: number; maxZoom?: number } = {},
): AlignTransform {
  const { minZoom = 0.5, maxZoom = 3 } = limits;
  // Work in the photo frame's own pixels; only ratios matter.
  const W = photoW;
  const H = photoH;
  const cover = Math.max(W / imgW, H / imgH);

  const { crownY, headH, cx } = headFromFace(face);
  const targetHeadH = (HEAD_GUIDE.chin - HEAD_GUIDE.crown) * H;

  // headH scales with (cover * zoom), so solve for the zoom that matches.
  const rawZoom = targetHeadH / (headH * cover);
  const zoom = Math.min(maxZoom, Math.max(minZoom, rawZoom));

  const s = cover * zoom;
  const dh = imgH * s;
  // Where the crown lands with offsetY = 0 …
  const baseCrown = (H - dh) / 2 + crownY * s;
  // … and how far it must move to reach the guide line.
  // ±1 frame-height of travel: a small (distant) face needs a large zoom, and
  // a large zoom needs a correspondingly large shift to bring the crown up.
  // ±0.5 was too tight and left such photos visibly misaligned.
  const targetCrown = HEAD_GUIDE.crown * H;
  const offsetY = Math.max(-1, Math.min(1, (targetCrown - baseCrown) / H));

  // cx is unused for now (the compositor centres horizontally), but a face far
  // off-centre is reported by framingFeedback so the user can recentre.
  void cx;

  return { zoom: Number(zoom.toFixed(3)), offsetY: Number(offsetY.toFixed(3)) };
}
