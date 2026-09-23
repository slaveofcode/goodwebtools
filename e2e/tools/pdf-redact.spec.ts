import { test, expect } from '@playwright/test';
import path from 'node:path';

// A clean, generic single-page PDF fixture (no real data).
const SAMPLE = path.join(__dirname, '../fixtures/sample-page.pdf');

// PdfRedact lazy-loads via ToolHost and renders the page with pdf.js (worker +
// wasm) a few seconds after navigation — retry until the preview appears.
test('renders the PDF and the zoom control scales it', async ({ page }) => {
  await page.goto('/tools/pdf-redact');
  await page.waitForLoadState('networkidle').catch(() => {});

  // Upload the fixture through the hidden file input.
  await page.locator('input[type="file"]').setInputFiles(SAMPLE);

  // The rendered page image shows up once pdf.js finishes.
  const pageImg = page.getByAltText(/page 1/);
  await expect(pageImg).toBeVisible({ timeout: 30_000 });

  // Zoom starts at the fit baseline (100%).
  const zoomLevel = page.getByTestId('zoom-level');
  await expect(zoomLevel).toHaveText('100%');
  const fitWidth = (await pageImg.boundingBox())!.width;

  // Zoom in → percentage rises and the page grows wider.
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(zoomLevel).toHaveText('125%');
  await expect
    .poll(async () => (await pageImg.boundingBox())!.width)
    .toBeGreaterThan(fitWidth + 1);

  // Fit resets back to the baseline width.
  await page.getByRole('button', { name: 'Fit' }).click();
  await expect(zoomLevel).toHaveText('100%');
  await expect
    .poll(async () => (await pageImg.boundingBox())!.width)
    .toBeLessThan(fitWidth + 1);
});
