import { describe, it, expect } from 'vitest';
import { parseBrowser, parseEngine, parseOS, parseUserAgent } from './browser-info.lib';

const CHROME_WIN =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const SAFARI_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15';
const FIREFOX_LINUX =
  'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0';
const EDGE_WIN =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
const SAFARI_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1';
const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

describe('browser-info', () => {
  it('detects Chrome on Windows', () => {
    expect(parseBrowser(CHROME_WIN)).toEqual({ name: 'Chrome', version: '120.0.0.0' });
    expect(parseEngine(CHROME_WIN)).toBe('Blink');
    expect(parseOS(CHROME_WIN)).toBe('Windows 10/11');
  });

  it('detects Safari on macOS with a decoded version', () => {
    expect(parseBrowser(SAFARI_MAC).name).toBe('Safari');
    expect(parseOS(SAFARI_MAC)).toBe('macOS 10.15.7');
    expect(parseEngine(SAFARI_MAC)).toBe('WebKit');
  });

  it('detects Firefox on Linux', () => {
    expect(parseBrowser(FIREFOX_LINUX)).toEqual({ name: 'Firefox', version: '121.0' });
    expect(parseEngine(FIREFOX_LINUX)).toBe('Gecko');
    expect(parseOS(FIREFOX_LINUX)).toBe('Linux');
  });

  it('detects Edge and does not mistake it for Chrome', () => {
    expect(parseBrowser(EDGE_WIN).name).toBe('Edge');
  });

  it('detects iOS Safari', () => {
    expect(parseBrowser(SAFARI_IOS).name).toBe('Safari');
    expect(parseOS(SAFARI_IOS)).toBe('iOS 17.2');
  });

  it('detects Chrome on Android', () => {
    expect(parseBrowser(CHROME_ANDROID).name).toBe('Chrome');
    expect(parseOS(CHROME_ANDROID)).toBe('Android 14');
  });

  it('parseUserAgent returns all fields together', () => {
    expect(parseUserAgent(CHROME_WIN)).toEqual({
      browser: 'Chrome',
      browserVersion: '120.0.0.0',
      engine: 'Blink',
      os: 'Windows 10/11',
    });
  });

  it('falls back gracefully on an unknown UA', () => {
    expect(parseBrowser('some-bot/1.0').name).toBe('Unknown');
    expect(parseOS('some-bot/1.0')).toBe('Unknown');
  });
});
