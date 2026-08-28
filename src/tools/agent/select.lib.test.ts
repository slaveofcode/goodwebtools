import { describe, it, expect } from 'vitest';
import { buildToolChoicePrompt, parseToolChoice, type ToolChoice } from './select.lib';

const CHOICES: ToolChoice[] = [
  { id: 'qr-generator', name: 'QR Code Generator', summary: 'Make QR codes', category: 'Image' },
  { id: 'qris-decoder', name: 'QRIS Decoder', summary: 'Decode Indonesian QRIS', category: 'Image' },
  { id: 'video-compress', name: 'Video Compressor', summary: 'Shrink a video', category: 'Media' },
];
const IDS = CHOICES.map(c => c.id);

describe('buildToolChoicePrompt', () => {
  it('lists each candidate id with name, category and summary', () => {
    const p = buildToolChoicePrompt(CHOICES);
    expect(p).toContain('- qr-generator: QR Code Generator (Image) — Make QR codes');
    expect(p).toMatch(/only the tool id/i);
  });
});

describe('parseToolChoice', () => {
  it('returns the id when the model replies with just an id', () => {
    expect(parseToolChoice('qris-decoder', IDS)).toBe('qris-decoder');
  });
  it('extracts the id from a wordy reply', () => {
    expect(parseToolChoice('The best fit is video-compress for that.', IDS)).toBe('video-compress');
  });
  it('does not confuse a prefix — picks the full id, longest wins', () => {
    // 'qr-generator' and 'qris-decoder' both start with "qr"; a whole-token match
    // must not return a partial.
    expect(parseToolChoice('use qris-decoder', IDS)).toBe('qris-decoder');
  });
  it('returns "none" when the model declines', () => {
    expect(parseToolChoice('none', IDS)).toBe('none');
  });
  it('returns null when nothing matches and it did not say none', () => {
    expect(parseToolChoice('I am not sure', IDS)).toBeNull();
  });
});
