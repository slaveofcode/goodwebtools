import { test, expect } from '@playwright/test';

// The Clock island lazy-loads via ToolHost and only starts ticking (and setting
// the tab title) once hydrated — retry the first assertion until that happens.
test('ticks live and reflects the time zone + format controls', async ({ page }) => {
  await page.goto('/tools/clock');
  await page.waitForLoadState('networkidle').catch(() => {});

  // The live clock mirrors HH:MM:SS into the tab title once it is running.
  await expect(async () => {
    await expect(page).toHaveTitle(/🕐 \d{2}:\d{2}:\d{2}/, { timeout: 2000 });
  }).toPass({ timeout: 30_000 });

  // Big digital readout is visible.
  await expect(page.getByText(/\d{2}:\d{2}:\d{2}/).first()).toBeVisible();

  // Switch to UTC → the offset line reads 'UTC · UTC'.
  await page.getByLabel('Time zone').selectOption('UTC');
  await expect(page.getByText('UTC · UTC')).toBeVisible();

  // 12-hour format surfaces an AM/PM marker.
  await page.getByRole('button', { name: '12h' }).click();
  await expect(page.getByText(/\b(AM|PM)\b/).first()).toBeVisible();
});
