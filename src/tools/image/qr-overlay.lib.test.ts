import { describe, it, expect } from 'vitest';
import { qrPixelSize, qrCardPlacement } from './qr-overlay.lib';

describe('qrPixelSize', () => {
  it('sizes the QR as a percent of the shorter side', () => {
    expect(qrPixelSize(18, 1000)).toBe(180);
    expect(qrPixelSize(50, 800)).toBe(400);
  });
  it('never drops below the 64px scannable floor', () => {
    expect(qrPixelSize(1, 1000)).toBe(64);
    expect(qrPixelSize(5, 500)).toBe(64); // 25 -> floored to 64
  });
  it('never exceeds the shorter side and clamps the percent to [1,100]', () => {
    expect(qrPixelSize(100, 300)).toBe(300);
    expect(qrPixelSize(150, 300)).toBe(300);
    expect(qrPixelSize(0, 1000)).toBe(qrPixelSize(1, 1000));
  });
});

describe('qrCardPlacement', () => {
  const base = { canvasW: 1000, canvasH: 800, boxSize: 200, margin: 30 };

  it('places the box in each corner inset by the margin', () => {
    expect(qrCardPlacement({ ...base, corner: 'top-left' })).toEqual({ x: 30, y: 30 });
    expect(qrCardPlacement({ ...base, corner: 'top-right' })).toEqual({ x: 770, y: 30 });
    expect(qrCardPlacement({ ...base, corner: 'bottom-left' })).toEqual({ x: 30, y: 570 });
    expect(qrCardPlacement({ ...base, corner: 'bottom-right' })).toEqual({ x: 770, y: 570 });
  });
});
