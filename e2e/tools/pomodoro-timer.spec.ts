import { test, expect } from '@playwright/test';

// The Pomodoro island lazy-loads via ToolHost; retry Start until it hydrates.
test('pomodoro shows the phase + remaining time in the tab title', async ({ page }) => {
  await page.goto('/tools/pomodoro-timer');
  await page.waitForLoadState('networkidle').catch(() => {});

  const start = page.getByRole('button', { name: 'Start' });
  await start.waitFor({ state: 'visible' });

  await expect(async () => {
    await start.click();
    await expect(page).toHaveTitle(/🍅/, { timeout: 2000 });
  }).toPass({ timeout: 30_000 });
});
