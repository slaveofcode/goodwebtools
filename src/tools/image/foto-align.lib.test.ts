import { describe, it, expect } from 'vitest';
import { framingFeedback, alignTransform, headFromFace, coverCropRect, HEAD_TO_FACE, CROWN_ABOVE, type FaceBox } from './foto-align.lib';
import { HEAD_GUIDE } from './pas-foto.lib';

const FRAME_W = 600;
const FRAME_H = 800;

/** A face box that sits exactly on the guide for a FRAME_W×FRAME_H frame. */
function perfectFace(w = FRAME_W, h = FRAME_H): FaceBox {
  const headH = (HEAD_GUIDE.chin - HEAD_GUIDE.crown) * h;
  const faceH = headH / HEAD_TO_FACE;
  const crownY = HEAD_GUIDE.crown * h;
  const faceW = faceH; // MediaPipe returns a square box
  // crownY = y − h*CROWN_ABOVE  →  y = crownY + h*CROWN_ABOVE
  return { x: w / 2 - faceW / 2, y: crownY + faceH * CROWN_ABOVE, w: faceW, h: faceH };
}

describe('headFromFace', () => {
  it('places the crown above the box and the chin just inside its bottom', () => {
    const face: FaceBox = { x: 100, y: 200, w: 100, h: 100 };
    const head = headFromFace(face);
    expect(head.chinY).toBeCloseTo(288, 5);   // 200 + 100×0.88 — above the box bottom
    expect(head.crownY).toBeCloseTo(168, 5);  // 200 − 100×0.32
    expect(head.headH).toBeCloseTo(120, 5);   // 100 × 1.20
    expect(head.cx).toBe(150);
  });

  it('matches the real detection it was calibrated from', () => {
    // Measured sample: 436px box at y=1021; true crown ≈883, chin ≈1404.
    const head = headFromFace({ x: 323, y: 1021, w: 436, h: 436 });
    expect(Math.abs(head.crownY - 883)).toBeLessThan(25);
    expect(Math.abs(head.chinY - 1404)).toBeLessThan(25);
  });
});

describe('framingFeedback', () => {
  it('accepts a correctly framed face', () => {
    expect(framingFeedback(perfectFace(), FRAME_W, FRAME_H)).toBe('ok');
  });

  it('reports no face when nothing is detected', () => {
    expect(framingFeedback(null, FRAME_W, FRAME_H)).toBe('no-face');
    expect(framingFeedback({ x: 0, y: 0, w: 0, h: 0 }, FRAME_W, FRAME_H)).toBe('no-face');
  });

  it('detects too close and too far', () => {
    const f = perfectFace();
    const big = { ...f, h: f.h * 1.5, w: f.w * 1.5 };
    const small = { ...f, h: f.h * 0.5, w: f.w * 0.5 };
    expect(framingFeedback(big, FRAME_W, FRAME_H)).toBe('too-close');
    expect(framingFeedback(small, FRAME_W, FRAME_H)).toBe('too-far');
  });

  it('tolerates a small size difference', () => {
    const f = perfectFace();
    expect(framingFeedback({ ...f, h: f.h * 1.05 }, FRAME_W, FRAME_H)).toBe('ok');
    expect(framingFeedback({ ...f, h: f.h * 0.95 }, FRAME_W, FRAME_H)).toBe('ok');
  });

  it('detects an off-centre face', () => {
    const f = perfectFace();
    expect(framingFeedback({ ...f, x: f.x + FRAME_W * 0.2 }, FRAME_W, FRAME_H)).toBe('off-center');
    expect(framingFeedback({ ...f, x: f.x - FRAME_W * 0.2 }, FRAME_W, FRAME_H)).toBe('off-center');
  });

  it('detects a head that is too high or too low in the frame', () => {
    const f = perfectFace();
    expect(framingFeedback({ ...f, y: f.y - FRAME_H * 0.2 }, FRAME_W, FRAME_H)).toBe('too-high');
    expect(framingFeedback({ ...f, y: f.y + FRAME_H * 0.2 }, FRAME_W, FRAME_H)).toBe('too-low');
  });

  it('checks size before position (size is the more useful hint)', () => {
    const f = perfectFace();
    const bigAndOff = { ...f, h: f.h * 2, w: f.w * 2, x: 0 };
    expect(framingFeedback(bigAndOff, FRAME_W, FRAME_H)).toBe('too-close');
  });

  it('honours custom tolerances', () => {
    const f = perfectFace();
    const slightlyBig = { ...f, h: f.h * 1.1 };
    expect(framingFeedback(slightlyBig, FRAME_W, FRAME_H)).toBe('ok');
    expect(framingFeedback(slightlyBig, FRAME_W, FRAME_H, { sizeTolerance: 0.05 })).toBe('too-close');
  });
});

describe('alignTransform', () => {
  /** Reproduce the island's compositor to verify where the head lands. */
  function composeCrown(face: FaceBox, imgW: number, imgH: number, photoW: number, photoH: number) {
    const { zoom, offsetY } = alignTransform(face, imgW, imgH, photoW, photoH);
    const cover = Math.max(photoW / imgW, photoH / imgH);
    const s = cover * zoom;
    const dh = imgH * s;
    const y = (photoH - dh) / 2 + offsetY * photoH;
    const head = headFromFace(face);
    return {
      crown: y + head.crownY * s,
      chin: y + head.chinY * s,
      zoom,
      offsetY,
    };
  }

  // zoom/offset are rounded to 3dp for the sliders, so allow sub-pixel drift.
  const within1px = (actual: number, expected: number) =>
    expect(Math.abs(actual - expected)).toBeLessThan(1);

  it('puts the crown and chin on the guide lines', () => {
    const imgW = 900, imgH = 1200;
    const face: FaceBox = { x: 350, y: 300, w: 200, h: 260 };
    const photoW = 300, photoH = 400; // 3×4 ratio
    const r = composeCrown(face, imgW, imgH, photoW, photoH);
    within1px(r.crown, HEAD_GUIDE.crown * photoH);
    within1px(r.chin, HEAD_GUIDE.chin * photoH);
  });

  it('zooms in for a small (distant) face', () => {
    const small: FaceBox = { x: 430, y: 500, w: 60, h: 80 };
    const big: FaceBox = { x: 300, y: 300, w: 300, h: 400 };
    const zSmall = alignTransform(small, 900, 1200, 300, 400).zoom;
    const zBig = alignTransform(big, 900, 1200, 300, 400).zoom;
    expect(zSmall).toBeGreaterThan(zBig);
  });

  it('clamps zoom and offset to the slider ranges', () => {
    const tiny: FaceBox = { x: 440, y: 580, w: 10, h: 12 };
    const r = alignTransform(tiny, 900, 1200, 300, 400);
    expect(r.zoom).toBeLessThanOrEqual(3);
    expect(r.zoom).toBeGreaterThanOrEqual(0.5);
    expect(r.offsetY).toBeGreaterThanOrEqual(-1);
    expect(r.offsetY).toBeLessThanOrEqual(1);
  });

  it('works for a landscape source photo', () => {
    const imgW = 1600, imgH = 900;
    const face: FaceBox = { x: 700, y: 200, w: 180, h: 240 };
    const r = composeCrown(face, imgW, imgH, 300, 400);
    within1px(r.crown, HEAD_GUIDE.crown * 400);
  });

  it('adapts to a different photo aspect (4×6 vs 3×4)', () => {
    const face: FaceBox = { x: 350, y: 300, w: 200, h: 260 };
    const a = composeCrown(face, 900, 1200, 400, 600);
    within1px(a.crown, HEAD_GUIDE.crown * 600);
    within1px(a.chin, HEAD_GUIDE.chin * 600);
  });

  it('returns rounded, slider-friendly values', () => {
    const r = alignTransform({ x: 350, y: 300, w: 200, h: 260 }, 900, 1200, 300, 400);
    expect(String(r.zoom).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(3);
    expect(String(r.offsetY).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(3);
  });
});

describe('coverCropRect', () => {
  it('crops the sides of a wide frame for a portrait photo', () => {
    // 4:3 video, 3:4 photo → keeps full height, crops width to 720.
    const r = coverCropRect(1280, 960, 300, 400);
    expect(r.h).toBeCloseTo(960, 5);
    expect(r.w).toBeCloseTo(720, 5);
    expect(r.x).toBeCloseTo(280, 5);
    expect(r.y).toBeCloseTo(0, 5);
  });

  it('crops top and bottom when the source is narrower than the photo', () => {
    const r = coverCropRect(600, 1200, 400, 300); // landscape photo from a tall frame
    expect(r.w).toBeCloseTo(600, 5);
    expect(r.h).toBeCloseTo(450, 5);
    expect(r.y).toBeCloseTo(375, 5);
  });

  it('returns the whole frame when aspects match', () => {
    const r = coverCropRect(300, 400, 300, 400);
    expect(r).toMatchObject({ x: 0, y: 0, w: 300, h: 400 });
  });
});
