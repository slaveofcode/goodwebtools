import { describe, it, expect } from 'vitest';
import { sniffImage, canvasLimitsFor, fitWithin, probeSize, WEBP_MAX_SIDE, MOBILE_MAX_AREA } from './decode.lib';

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
  it('allows 268 MP and 65,535 px sides on desktop Chrome, 32,767 px on Firefox', () => {
    expect(canvasLimitsFor('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36')).toEqual({ maxArea: 268_435_456, maxSide: 65_535 });
    expect(canvasLimitsFor('Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0').maxSide).toBe(32_767);
  });
  it('caps Android phones (Chrome, Samsung Internet, Firefox) at 50 MP', () => {
    expect(canvasLimitsFor('Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 SamsungBrowser/27.0 Chrome/125.0 Mobile Safari/537.36')).toEqual({ maxArea: MOBILE_MAX_AREA, maxSide: 65_535 });
    expect(canvasLimitsFor('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/141.0 Mobile Safari/537.36').maxArea).toBe(MOBILE_MAX_AREA);
    expect(canvasLimitsFor('Mozilla/5.0 (Android 14; Mobile; rv:140.0) Gecko/140.0 Firefox/140.0')).toEqual({ maxArea: MOBILE_MAX_AREA, maxSide: 32_767 });
  });
  it('keeps a Galaxy 50 MP photo at full size but shrinks 108 and 200 MP on phones', () => {
    const phone = canvasLimitsFor('Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 SamsungBrowser/27.0 Chrome/125.0 Mobile Safari/537.36');
    expect(fitWithin(8160, 6120, phone).scaled).toBe(false);
    for (const [w, h] of [[12000, 9000], [16320, 12240]]) {
      const r = fitWithin(w, h, phone);
      expect(r.scaled).toBe(true);
      expect(r.width * r.height).toBeLessThanOrEqual(MOBILE_MAX_AREA);
    }
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

describe('probeSize', () => {
  it('reads a JPEG frame header after other segments', () => {
    const app1 = [0xff, 0xe1, 0x00, 0x06, 1, 2, 3, 4];
    const sof0 = [0xff, 0xc0, 0x00, 0x11, 0x08, 0x2f, 0xd0, 0x3f, 0xc0]; // height 12240, width 16320
    expect(probeSize(new Uint8Array([0xff, 0xd8, ...app1, ...sof0, 0, 0]))).toEqual({ width: 16320, height: 12240 });
  });
  it('skips a DHT segment (C4 is not a frame)', () => {
    const dht = [0xff, 0xc4, 0x00, 0x04, 0, 0];
    const sof2 = [0xff, 0xc2, 0x00, 0x11, 0x08, 0x00, 0x10, 0x00, 0x20];
    expect(probeSize(new Uint8Array([0xff, 0xd8, ...dht, ...sof2, 0, 0]))).toEqual({ width: 32, height: 16 });
  });
  it('reads PNG and GIF sizes', () => {
    const png = new Uint8Array(24); png.set([0x89, 0x50, 0x4e, 0x47]); png.set([0, 1, 0x11, 0x70], 16); png.set([0, 0, 1, 0x2c], 20);
    expect(probeSize(png)).toEqual({ width: 70000, height: 300 });
    expect(probeSize(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x40, 0x01, 0xc8, 0x00]))).toEqual({ width: 320, height: 200 });
  });
  it('returns null when the size is not in the bytes', () => {
    expect(probeSize(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff]))).toBeNull();
    expect(probeSize(new Uint8Array([0x42, 0x4d, 0, 0]))).toBeNull();
  });
});
