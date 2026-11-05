import { test, expect, type Page } from '@playwright/test';
import zlib from 'node:zlib';

// Stands in for the Companion extension's content script: answers the page's
// `handoff-get` request with a prepared payload (or nothing for unknown ids).
async function fakeExtension(page: Page, payloads: Record<string, unknown>) {
  await page.addInitScript((data: Record<string, unknown>) => {
    window.addEventListener('message', e => {
      const d = e.data;
      if (e.source !== window || !d || d.source !== 'gwt-page' || d.type !== 'handoff-get') return;
      const payload = data[d.handoffId];
      window.postMessage({ source: 'gwt-ext', type: 'handoff-result', id: d.id, ok: !!payload, payload }, window.location.origin);
    });
  }, payloads);
}

/** A 2×2 red PNG. */
function tinyPng(): string {
  const crc = (b: Buffer) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; } return ~c >>> 0; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(2, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.from([0, 255, 0, 0, 255, 0, 0]);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat([row, row]))), chunk('IEND', Buffer.alloc(0))]).toString('base64');
}

test('an image handed over by the extension loads into Image Compress', async ({ page }) => {
  await fakeExtension(page, { 'img-0001-abcd': { kind: 'file', name: 'from-web.png', type: 'image/png', base64: tinyPng() } });
  await page.goto('/tools/image-compress#gwt-handoff=img-0001-abcd');
  await expect(page.getByText('from-web.png')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Compress', exact: true })).toBeEnabled();
  // The single-use id is removed from the address bar.
  expect(new URL(page.url()).hash).toBe('');
});

test('selected text handed over by the extension opens in the JSON Viewer', async ({ page }) => {
  await fakeExtension(page, { 'txt-0002-abcd': { kind: 'text', text: '{"from":"selection","n":[1,2]}' } });
  await page.goto('/tools/json-viewer#gwt-handoff=txt-0002-abcd');
  await expect(page.locator("[data-path='$.from']")).toContainText('"selection"', { timeout: 30_000 });
});

test('an unknown or expired handoff leaves the tool as normal', async ({ page }) => {
  await fakeExtension(page, {});
  await page.goto('/tools/json-viewer#gwt-handoff=gone-0003-abcd');
  await page.waitForFunction(() => { const el = document.querySelector('textarea'); return !!el && Object.keys(el).some(k => k.startsWith('__react')); });
  await expect(page.locator('textarea')).toHaveValue('');
  expect(new URL(page.url()).hash).toBe('');
});
