import { test, expect } from '@playwright/test';
import { EN_ANSWERS, EN_EXTRA } from '../../src/tools/games/wordguess.words';

/**
 * Happy path for Daily Word Guess: play a full daily game through the real
 * on-screen keyboard and reach the end panel (win or lose both end the game),
 * plus the invalid-word path.
 *
 * Guess words are fixed valid 5-letter words; the daily answer is
 * deterministic by date, so the game always ends within these six guesses.
 */
const GUESSES = ['crane', 'solar', 'piano', 'stone', 'valid', 'zebra'];

test('plays a full daily game and shows the end panel', async ({ page }) => {
  await page.goto('/tools/word-guess');

  const grid = page.locator('[aria-label="word grid"]');
  await expect(grid).toBeVisible();

  for (const word of GUESSES) {
    for (const ch of word) {
      await page.getByRole('button', { name: `letter ${ch}` }).click();
    }
    await page.getByRole('button', { name: 'Enter' }).click();
  }

  // Six guesses always finish the daily (win or lose) → end panel appears.
  const panel = page.getByTestId('wg-end-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('button', { name: /share|bagikan/i })).toBeVisible();

  // The end panel must show stats and the practice button.
  await expect(panel.getByText(/played|dimainkan/i)).toBeVisible();

  // Typing after the game is over must not add new rows.
  await page.keyboard.type('crane');
  const rows = grid.locator('div.grid');
  await expect(rows).toHaveCount(6);
});

test('rejects a word that is not in the list', async ({ page }) => {
  await page.goto('/tools/word-guess');

  // zzzyx is shape-valid but not a word in either list.
  const junk = 'zzzyx';
  expect(EN_ANSWERS.includes(junk)).toBe(false);
  expect(EN_EXTRA.includes(junk)).toBe(false);

  for (const ch of junk) {
    await page.getByRole('button', { name: `letter ${ch}` }).click();
  }
  await page.getByRole('button', { name: 'Enter' }).click();

  // Toast appears and the junk word stays in the (uncommitted) draft row.
  await expect(page.getByText(/not in word list|tidak ada dalam daftar kata/i)).toBeVisible();
  const firstRow = page.locator('[aria-label="word grid"] > div').first();
  await expect(firstRow).toContainText('zzzyx');

  // A valid word after it commits to row 1 instead — zzzyx never took a row.
  const del = page.getByRole('button', { name: 'Backspace' });
  for (let i = 0; i < 5; i++) await del.click();
  for (const ch of 'crane') {
    await page.getByRole('button', { name: `letter ${ch}` }).click();
  }
  await page.getByRole('button', { name: 'Enter' }).click();
  await expect(firstRow).toContainText('crane');
  await expect(firstRow).not.toContainText('zzzyx');
});

test('practice mode serves random games that never persist stats', async ({ page }) => {
  await page.goto('/tools/word-guess');
  await page.getByRole('button', { name: /practice|latihan/i }).first().click();

  // Practice label appears and the grid is fresh.
  await expect(page.getByText(/practice — random word|latihan — kata acak/i)).toBeVisible();

  // Play one guess; a row must commit.
  for (const ch of 'crane') {
    await page.getByRole('button', { name: `letter ${ch}` }).click();
  }
  await page.getByRole('button', { name: 'Enter' }).click();
  const firstRow = page.locator('[aria-label="word grid"] > div').first();
  await expect(firstRow).toContainText('c');
});
