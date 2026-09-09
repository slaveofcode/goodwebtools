import { test, expect } from '@playwright/test';

// The TimerHub island lazy-loads via ToolHost, so retry the first interaction
// until it takes effect (the reactive title only changes once hydrated).
test('stopwatch reflects the running time in the tab title', async ({ page }) => {
  await page.goto('/tools/timer-stopwatch');
  await page.waitForLoadState('networkidle').catch(() => {});

  const start = page.getByRole('button', { name: 'Start' });
  await start.waitFor({ state: 'visible' });

  await expect(async () => {
    await start.click();
    await expect(page).toHaveTitle(/⏱️/, { timeout: 2000 });
  }).toPass({ timeout: 30_000 });
});
