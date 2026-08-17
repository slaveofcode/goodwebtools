import { describe, it, expect } from 'vitest';
import { findPreview } from './iwork.lib';

describe('findPreview', () => {
  it('prefers a root preview.pdf', () => {
    expect(findPreview(['preview.pdf', 'Index/Document.iwa'])).toEqual({ path: 'preview.pdf', kind: 'pdf' });
  });

  it('finds QuickLook/Preview.pdf regardless of case', () => {
    expect(findPreview(['Data/1.jpg', 'QuickLook/Preview.pdf'])).toEqual({ path: 'QuickLook/Preview.pdf', kind: 'pdf' });
  });

  it('falls back to a preview image when there is no PDF', () => {
    expect(findPreview(['preview.jpg', 'Index/x.iwa'])).toEqual({ path: 'preview.jpg', kind: 'image' });
    expect(findPreview(['QuickLook/Thumbnail.jpg'])).toEqual({ path: 'QuickLook/Thumbnail.jpg', kind: 'image' });
  });

  it('returns null when no preview exists', () => {
    expect(findPreview(['Index/Document.iwa', 'Metadata/Properties.plist'])).toBeNull();
    expect(findPreview([])).toBeNull();
  });
});
