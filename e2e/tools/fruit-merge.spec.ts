import { test, expect } from '@playwright/test';

/**
 * Happy path for Fruit Merge: drop fruits through the real canvas (pointer
 * events), expect same-tier merges to raise the score, and verify restart.
 *
 * The drop tier is random (pool of 5), so we drop a batch of fruits at varied
 * positions: with 5 tiers across 14 drops, same-tier contact pairs are
 * statistically certain (p ≈ 99.9%+), and each merge raises the score.
 */
test('dropping fruits merges pairs and scores points', async ({ page }) => {
  await page.goto('/tools/fruit-merge');

  const canvas = page.getByTestId('fm-canvas');
  await expect(canvas).toBeVisible();

  const score = page.getByTestId('fm-score');
  await expect(score).toHaveText('0');

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  // Drop repeatedly onto the middle so every fruit lands on the pile and
  // touches its neighbors; with a 5-tier pool a same-tier contact is near
  // certain within this many drops (p(miss) < 0.1%). The 550ms cadence
  // respects the in-game drop cooldown.
  for (let i = 0; i < 40; i++) {
    await page.mouse.move(box!.x + box!.width * 0.5, box!.y + 20);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(550);
    const value = await score.textContent();
    if (value && value !== '0') break;
  }

  await expect.poll(async () => await score.textContent(), { timeout: 5000 }).not.toBe('0');
});

test('restart resets the score after game over', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/tools/fruit-merge');

  const canvas = page.getByTestId('fm-canvas');
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  // Vary the drop positions like a real player — a single perfect column is
  // pathological. ~45+ effective drops overflow the box.
  const xs = [0.5, 0.42, 0.58, 0.46, 0.54, 0.38, 0.62];
  for (let i = 0; i < 100; i++) {
    await page.mouse.move(box!.x + box!.width * xs[i % xs.length]!, box!.y + 20);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(550);
    if (await page.getByTestId('fm-over').count()) break;
  }

  const overlay = page.getByTestId('fm-over');
  await expect(overlay).toBeVisible();

  await overlay.getByRole('button', { name: /restart|mulai ulang/i }).click();
  await expect(page.getByTestId('fm-score')).toHaveText('0');
  await expect(page.getByTestId('fm-over')).toHaveCount(0);
});
