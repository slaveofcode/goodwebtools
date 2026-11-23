import { describe, it, expect } from 'vitest';
import { slowReasonText, mediaErrorText } from './media-messages.lib';
import { TooBigForCompatibilityError } from './run-media.lib';

const MB = 1024 * 1024;

describe('slowReasonText', () => {
  it('explains in plain words why compatibility mode ran', () => {
    expect(slowReasonText('cannot-decode', 'en')).toBe('this browser can’t decode this video in fast mode (often H.265/HEVC or HDR video from a phone)');
    expect(slowReasonText('no-webcodecs', 'id')).toBe('browser ini tidak punya mode cepat');
  });
});

describe('mediaErrorText', () => {
  it('turns a too-big error into the reason plus what to do', () => {
    const text = mediaErrorText(new TooBigForCompatibilityError('cannot-decode', 1200 * MB, 300 * MB), 'en');
    expect(text).toContain('this browser can’t decode this video in fast mode');
    expect(text).toContain('1.2 GB');
    expect(text).toContain('HDR10+');
  });
  it('has an Indonesian version', () => {
    const text = mediaErrorText(new TooBigForCompatibilityError('stalled', 500 * MB, 300 * MB), 'id');
    expect(text).toContain('500 MB');
    expect(text).not.toMatch(/\balat\b/);
  });
  it('returns null for errors it doesn’t know', () => {
    expect(mediaErrorText(new Error('x'), 'en')).toBeNull();
  });
});
