import { test, expect } from '@playwright/test';

// The reporter uses a DEV-only stub (window.__E2E_REPORT__) so submit bypasses
// the network + Turnstile. The Report button is rendered by ToolHost on every page.
test('opens the report dialog, consents, submits, and shows the thank-you', async ({ page }) => {
  await page.addInitScript(() => { (window as unknown as { __E2E_REPORT__?: unknown }).__E2E_REPORT__ = { id: 'e2e-123' }; });
  await page.goto('/tools/image-compress');
  await page.waitForLoadState('networkidle').catch(() => {});

  await page.getByRole('button', { name: 'Report a problem' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  // Transparency: the diagnostics JSON is viewable and names the tool.
  await page.getByText('See exactly what will be sent').click();
  await expect(page.getByTestId('report-diag')).toContainText('image-compress');

  // Submitting without consent is blocked.
  await page.getByRole('button', { name: 'Send report' }).click();
  await expect(page.getByText('Please tick the consent box to send.')).toBeVisible();

  // Consent → submit → thank-you.
  await page.getByTestId('report-consent').check();
  await page.getByRole('button', { name: 'Send report' }).click();
  await expect(page.getByTestId('report-thanks')).toBeVisible();
  await expect(page.getByTestId('report-thanks')).toContainText('e2e-123');
});

// Failure case: a rejected submit shows an error and never reaches the thank-you.
test('a failed submit shows an error, not the thank-you', async ({ page }) => {
  await page.addInitScript(() => { (window as unknown as { __E2E_REPORT__?: unknown }).__E2E_REPORT__ = { fail: true }; });
  await page.goto('/tools/image-compress');
  await page.waitForLoadState('networkidle').catch(() => {});

  await page.getByRole('button', { name: 'Report a problem' }).click();
  await page.getByTestId('report-consent').check();
  await page.getByRole('button', { name: 'Send report' }).click();

  await expect(page.getByText('Sorry — the report could not be sent. Please try again.')).toBeVisible();
  await expect(page.getByTestId('report-thanks')).toHaveCount(0);
});
