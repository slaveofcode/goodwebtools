import { test, expect } from '@playwright/test';

// People land here looking for "cek NIK" and expect a lookup by name. The tool
// says plainly that it only reads a NIK you already have.
test('the NIK decoder explains it can’t find a NIK from a name (EN + ID)', async ({ page }) => {
  await page.goto('/tools/nik-decoder/');
  await expect(page.getByTestId('nik-not-lookup')).toContainText('can’t find a NIK from a name');
  await expect(page.getByText('Can it find someone’s NIK from their name?')).toBeVisible();
  await page.goto('/id/tools/nik-decoder/');
  await expect(page.getByTestId('nik-not-lookup')).toContainText('tidak bisa mencari NIK dari nama');
  await expect(page.getByText('Bisakah mencari NIK seseorang dari namanya?')).toBeVisible();
});

test('the NIK decoder still decodes a NIK', async ({ page }) => {
  await page.goto('/tools/nik-decoder/');
  await page.getByRole('button', { name: 'Load example' }).click();
  await expect(page.getByText('Valid structure', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('DKI Jakarta').first()).toBeVisible();
});
