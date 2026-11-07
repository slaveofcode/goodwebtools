import { describe, it, expect } from 'vitest';
import { canInstallExtension, isSnoozed, promoAngle, PROMO_SNOOZE_MS } from './extension-promo';

const UA = {
  chromeMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36',
  edgeWin: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 Edg/141.0',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36',
  safariMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  firefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0 Mobile/15E148 Safari/604.1',
};

describe('canInstallExtension', () => {
  it('is true for desktop Chromium browsers', () => {
    expect(canInstallExtension({ userAgent: UA.chromeMac })).toBe(true);
    expect(canInstallExtension({ userAgent: UA.edgeWin })).toBe(true);
    expect(canInstallExtension({ userAgent: 'x', uaData: { mobile: false, brands: [{ brand: 'Brave' }, { brand: 'Chromium' }] } })).toBe(true);
  });
  it('is false on mobile, Safari, Firefox and in the desktop app', () => {
    expect(canInstallExtension({ userAgent: UA.chromeAndroid })).toBe(false);
    expect(canInstallExtension({ userAgent: UA.iphone })).toBe(false);
    expect(canInstallExtension({ userAgent: UA.safariMac })).toBe(false);
    expect(canInstallExtension({ userAgent: UA.firefox })).toBe(false);
    expect(canInstallExtension({ userAgent: UA.chromeMac, desktopApp: true })).toBe(false);
    expect(canInstallExtension({ userAgent: UA.chromeMac, uaData: { mobile: true, brands: [{ brand: 'Chromium' }] } })).toBe(false);
  });
});

describe('isSnoozed', () => {
  it('hides the promo for 30 days after a dismissal', () => {
    expect(isSnoozed(null)).toBe(false);
    expect(isSnoozed(1000, 1000 + PROMO_SNOOZE_MS - 1)).toBe(true);
    expect(isSnoozed(1000, 1000 + PROMO_SNOOZE_MS + 1)).toBe(false);
  });
});

describe('promoAngle', () => {
  it('matches the pitch to the tool', () => {
    expect(promoAngle('Image', 'image-compress')).toBe('image');
    expect(promoAngle('Dev', 'json-viewer')).toBe('text');
    expect(promoAngle('Media', 'screen-recorder')).toBe('media');
    expect(promoAngle('Calculators', 'zakat')).toBe('general');
  });
});
