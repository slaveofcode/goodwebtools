import { describe, it, expect } from 'vitest';
import { sniffImage, canvasLimitsFor, fitWithin, WEBP_MAX_SIDE } from './decode.lib';

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);
const ascii = (s: string) => new TextEncoder().encode(s);
const ftyp = (brand: string) => new Uint8Array([0, 0, 0, 0x18, ...ascii('ftyp'), ...ascii(brand), 0, 0, 0, 0]);

describe('sniffImage', () => {
  it('detects common raster formats', () => {
    expect(sniffImage(bytes(0xff, 0xd8, 0xff))).toBe('jpeg');
    expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47))).toBe('png');
    expect(sniffImage(bytes(0x47, 0x49, 0x46))).toBe('gif');
    expect(sniffImage(new Uint8Array([...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP')]))).toBe('webp');
    expect(sniffImage(bytes(0x42, 0x4d))).toBe('bmp');
    expect(sniffImage(bytes(0x49, 0x49, 0x2a, 0x00))).toBe('tiff');
    expect(sniffImage(bytes(0x4d, 0x4d, 0x00, 0x2a))).toBe('tiff');
  });
  it('tells HEIC from AVIF by the ftyp brand (a HEIC renamed .jpg is still HEIC)', () => {
    expect(sniffImage(ftyp('heic'))).toBe('heic');
    expect(sniffImage(ftyp('mif1'))).toBe('heic');
    expect(sniffImage(ftyp('avif'))).toBe('avif');
  });
  it('detects SVG text and rejects junk', () => {
    expect(sniffImage(ascii('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe('svg');
    expect(sniffImage(ascii('  <svg viewBox="0 0 1 1"/>'))).toBe('svg');
    expect(sniffImage(ascii('hello, this is text'))).toBe('unknown');
  });
});

describe('canvasLimitsFor', () => {
  it('uses the 16.7 MP WebKit cap on iPhone, iPad and Safari', () => {
    expect(canvasLimitsFor('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/141.0 Mobile/15E148 Safari/604.1').maxArea).toBe(16_777_216);
    expect(canvasLimitsFor('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15', 5).maxArea).toBe(16_777_216);
    expect(canvasLimitsFor('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15').maxArea).toBe(16_777_216);
  });
  it('allows more on Chrome, Samsung Internet and Firefox', () => {
    expect(canvasLimitsFor('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/141.0 Mobile Safari/537.36').maxArea).toBe(268_435_456);
    expect(canvasLimitsFor('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 SamsungBrowser/27.0 Chrome/125.0 Mobile Safari/537.36').maxArea).toBe(268_435_456);
  });
});

describe('fitWithin', () => {
  const ios = { maxArea: 16_777_216, maxSide: 16_384 };
  it('leaves images that fit untouched', () => {
    expect(fitWithin(4000, 3000, ios)).toEqual({ width: 4000, height: 3000, scaled: false });
  });
  it('scales a 48 MP phone photo under the iOS area cap, keeping the aspect ratio', () => {
    const r = fitWithin(8064, 6048, ios);
    expect(r.scaled).toBe(true);
    expect(r.width * r.height).toBeLessThanOrEqual(ios.maxArea);
    expect(r.width / r.height).toBeCloseTo(8064 / 6048, 2);
  });
  it('respects the longest-side limit (e.g. WebP)', () => {
    const r = fitWithin(33000, 400, { maxArea: 268_435_456, maxSide: WEBP_MAX_SIDE });
    expect(r.width).toBe(WEBP_MAX_SIDE);
    expect(r.height).toBe(198);
  });
});
