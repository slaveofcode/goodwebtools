import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClipboardService } from './clipboard.service';

describe('ClipboardService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports unsupported when the Clipboard API or ClipboardItem is missing', () => {
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('ClipboardItem', undefined);
    expect(new ClipboardService().supported).toBe(false);
  });

  it('reports supported when both are present', () => {
    vi.stubGlobal('navigator', { clipboard: { write: vi.fn() } });
    vi.stubGlobal('ClipboardItem', class {});
    expect(new ClipboardService().supported).toBe(true);
  });

  it('rejects copyImage when unsupported instead of throwing synchronously', async () => {
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('ClipboardItem', undefined);
    await expect(new ClipboardService().copyImage(new Blob())).rejects.toThrow(/not supported/i);
  });

  it('writes a PNG blob directly without re-encoding', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const items: unknown[] = [];
    vi.stubGlobal('navigator', { clipboard: { write } });
    vi.stubGlobal('ClipboardItem', class {
      data: Record<string, unknown>;
      constructor(data: Record<string, unknown>) {
        this.data = data;
        items.push(this);
      }
    });
    const png = new Blob(['x'], { type: 'image/png' });
    await new ClipboardService().copyImage(png);
    expect(write).toHaveBeenCalledOnce();
    // The clipboard item carries an image/png entry (a promise resolving to the blob).
    expect(await (items[0] as { data: Record<string, Promise<Blob>> }).data['image/png']).toBe(png);
  });

  it('accepts a producer function and resolves it lazily', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const items: unknown[] = [];
    vi.stubGlobal('navigator', { clipboard: { write } });
    vi.stubGlobal('ClipboardItem', class {
      data: Record<string, unknown>;
      constructor(data: Record<string, unknown>) {
        this.data = data;
        items.push(this);
      }
    });
    const png = new Blob(['y'], { type: 'image/png' });
    const producer = vi.fn().mockResolvedValue(png);
    await new ClipboardService().copyImage(producer);
    expect(producer).toHaveBeenCalledOnce();
    expect(await (items[0] as { data: Record<string, Promise<Blob>> }).data['image/png']).toBe(png);
  });
});
