/** Writes images to the system clipboard, entirely client-side. */
export class ClipboardService {
  /** Whether the async Clipboard API with image support is available. */
  get supported(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.clipboard && typeof ClipboardItem !== 'undefined';
  }

  /**
   * Copy an image to the clipboard. Accepts a blob or a producer function.
   * Browsers only reliably accept `image/png`, so non-PNG inputs are re-encoded.
   *
   * The PNG is passed to `ClipboardItem` as a *promise* and `write()` is called
   * synchronously — Safari drops the user-activation if you `await` the
   * re-encode before calling `write()`. Throws on failure.
   */
  async copyImage(source: Blob | (() => Blob | Promise<Blob>)): Promise<void> {
    if (!this.supported) throw new Error('Clipboard image copy is not supported in this browser.');
    const png = (async () => {
      const blob = typeof source === 'function' ? await source() : source;
      return blob.type === 'image/png' ? blob : await toPng(blob);
    })();
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
  }
}

/** Decode any raster image blob and re-encode it as PNG via a canvas. */
async function toPng(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not read the image for copying.');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not encode the image for copying.'))), 'image/png')
  );
}

export const clipboardService = new ClipboardService();
