import { describe, it, expect } from 'vitest';
import { isLikelyHeic, jpegName } from './heic.lib';

describe('isLikelyHeic', () => {
  it.each([
    // Extension-based (browsers often report an empty MIME type for HEIC).
    [{ name: 'photo.heic', type: '' }, true],
    [{ name: 'IMG_0001.HEIF', type: '' }, true],
    [{ name: 'vacation.Heic', type: '' }, true],
    // MIME-based (extension missing or generic).
    [{ name: 'blob', type: 'image/heic' }, true],
    [{ name: 'blob', type: 'image/heif' }, true],
    [{ name: 'blob', type: 'image/heic-sequence' }, true],
    [{ name: 'blob', type: 'image/heif-sequence' }, true],
    // Negatives.
    [{ name: 'photo.jpg', type: 'image/jpeg' }, false],
    [{ name: 'photo.png', type: 'image/png' }, false],
    [{ name: 'notes.txt', type: '' }, false],
    [{ name: 'archive.heicx', type: '' }, false],
  ])('classifies %o as %s', (file, expected) => {
    expect(isLikelyHeic(file)).toBe(expected);
  });
});

describe('jpegName', () => {
  it.each([
    ['IMG_1234.heic', 'IMG_1234.jpg'],
    ['vacation.HEIC', 'vacation.jpg'],
    ['noext', 'noext.jpg'],
    ['my.photo.heif', 'my.photo.jpg'],
    ['already.jpg', 'already.jpg'],
    ['', 'image.jpg'],
  ])('%s → %s', (input, expected) => {
    expect(jpegName(input)).toBe(expected);
  });
});
