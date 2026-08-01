import { describe, it, expect } from 'vitest';
import { shareIntentUrl, canNativeShare, SHARE_CHANNELS } from './share.lib';

const target = { url: 'https://goodwebtools.com/tools/json-format', title: 'JSON Formatter', text: 'Format & validate JSON' };
const encUrl = encodeURIComponent(target.url);
const encText = encodeURIComponent(target.text);

describe('shareIntentUrl', () => {
  it('builds an X (Twitter) intent with url + text', () => {
    expect(shareIntentUrl('x', target)).toBe(`https://x.com/intent/tweet?url=${encUrl}&text=${encText}`);
  });

  it('builds a Facebook sharer with the url', () => {
    expect(shareIntentUrl('facebook', target)).toBe(`https://www.facebook.com/sharer/sharer.php?u=${encUrl}`);
  });

  it('builds a WhatsApp intent joining text and url', () => {
    expect(shareIntentUrl('whatsapp', target)).toBe(`https://api.whatsapp.com/send?text=${encText}%20${encUrl}`);
  });

  it('builds a Telegram share url', () => {
    expect(shareIntentUrl('telegram', target)).toBe(`https://t.me/share/url?url=${encUrl}&text=${encText}`);
  });

  it('builds a mailto with subject and body', () => {
    expect(shareIntentUrl('email', target)).toBe(
      `mailto:?subject=${encodeURIComponent(target.title)}&body=${encText}%20${encUrl}`,
    );
  });

  it('falls back to the title when no text is given', () => {
    const t = { url: 'https://x.test/', title: 'Hi there' };
    expect(shareIntentUrl('x', t)).toContain(`text=${encodeURIComponent('Hi there')}`);
  });

  it('percent-encodes special characters so the URL is safe', () => {
    const t = { url: 'https://x.test/?a=1&b=2', title: 'A & B?' };
    const out = shareIntentUrl('telegram', t);
    expect(out).toContain(encodeURIComponent('https://x.test/?a=1&b=2'));
    expect(out).not.toContain('A & B?');
  });
});

describe('canNativeShare', () => {
  it('is true when navigator.share is a function', () => {
    expect(canNativeShare({ share: () => Promise.resolve() } as unknown as Navigator)).toBe(true);
  });
  it('is false when share is absent', () => {
    expect(canNativeShare({} as Navigator)).toBe(false);
  });
  it('is false when navigator is undefined (SSR)', () => {
    expect(canNativeShare(undefined)).toBe(false);
  });
});

describe('SHARE_CHANNELS', () => {
  it('includes the requested channels and copy', () => {
    const ids = SHARE_CHANNELS.map(c => c.id);
    expect(ids).toEqual(['x', 'facebook', 'whatsapp', 'telegram', 'email', 'copy']);
  });
});
