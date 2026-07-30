import { describe, it, expect, vi, beforeEach } from 'vitest';

const renderPage = vi.fn();
const destroy = vi.fn();
const openPdfRenderer = vi.fn();

vi.mock('@/tools/pdf/render.lib', () => ({
  openPdfRenderer: (...args: unknown[]) => openPdfRenderer(...args),
}));

import { getPdfPageCount, renderPdfPage } from './ocr-pdf.lib';

function fakeFile(): File {
  // The lib only calls file.arrayBuffer(); jsdom's File lacks it, so stub it.
  return { arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer } as unknown as File;
}

beforeEach(() => {
  renderPage.mockReset();
  destroy.mockReset();
  openPdfRenderer.mockReset();
  openPdfRenderer.mockResolvedValue({ pageCount: 3, renderPage, destroy });
});

describe('getPdfPageCount', () => {
  it('returns the renderer page count and tears down', async () => {
    expect(await getPdfPageCount(fakeFile())).toBe(3);
    expect(destroy).toHaveBeenCalledOnce();
  });
});

describe('renderPdfPage', () => {
  it('renders the given 1-indexed page at default scale 2 and returns the blob', async () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    renderPage.mockResolvedValue({ blob, width: 10, height: 20 });
    const out = await renderPdfPage(fakeFile(), 2);
    expect(out).toBe(blob);
    expect(renderPage).toHaveBeenCalledWith(2, 2, 'image/png');
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('tears down even if rendering throws', async () => {
    renderPage.mockRejectedValue(new Error('boom'));
    await expect(renderPdfPage(fakeFile(), 1)).rejects.toThrow('boom');
    expect(destroy).toHaveBeenCalledOnce();
  });
});
