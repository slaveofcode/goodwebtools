import { test, expect } from '@playwright/test';

// The Countdown island lazy-loads via ToolHost, so wait for hydration before
// interacting: retry opening the calendar until the day grid actually appears.
test('picks a date via the calendar picker and shows the countdown', async ({ page }) => {
  await page.goto('/tools/countdown');
  await page.waitForLoadState('networkidle').catch(() => {});

  const field = page.getByRole('button', { name: /pick .*date|pilih .*tanggal/i });
  await field.waitFor({ state: 'visible' });

  // Open the popover; the "In 1 week" preset only exists once it is hydrated + open.
  const preset = page.getByRole('button', { name: 'In 1 week' });
  await expect(async () => {
    await field.click();
    await expect(preset).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30_000 });

  await preset.click();

  // A valid target renders the live breakdown + the calendar-days summary.
  await expect(page.getByText('Calendar days:')).toBeVisible();
  await expect(page.getByText('Business days (Mon–Fri):')).toBeVisible();

  // The live countdown is mirrored in the tab title for other-tab visibility.
  await expect(page).toHaveTitle(/⏳/);
});

test('clicking a day in the grid selects it', async ({ page }) => {
  await page.goto('/tools/countdown');
  await page.waitForLoadState('networkidle').catch(() => {});

  const field = page.getByRole('button', { name: /pick .*date|pilih .*tanggal/i });
  await field.waitFor({ state: 'visible' });

  const nextMonth = page.getByRole('button', { name: 'Next month' });
  await expect(async () => {
    await field.click();
    await expect(nextMonth).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30_000 });

  // Jump to next month so a real (non-spillover) day is guaranteed clickable.
  await nextMonth.click();
  await page.getByRole('button', { name: '15' }).first().click();

  await expect(page.getByText('Calendar days:')).toBeVisible();
});
