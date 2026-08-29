import { test, expect } from '@playwright/test';

// GitHub-hosted runners have no WebGPU; this is a LOCAL pre-release smoke only.
test.skip(!process.env.PLAYWRIGHT_REAL, 'real-model smoke: set PLAYWRIGHT_REAL=1 to run locally');

test('loads the real 0.5B model and completes one round-trip', async ({ page }) => {
  test.setTimeout(180_000); // model download + first inference
  await page.goto('/ask-agent');
  await page.getByRole('button', { name: 'On-device' }).click();
  await page.getByRole('button', { name: 'Load model' }).click();
  await expect(page.getByText(/Finish loading/i)).toBeVisible({ timeout: 150_000 });
  await page.getByTestId('agent-input').fill('encode base64 of hi');
  await page.getByTestId('agent-send').click();
  await expect(page.getByTestId('agent-messages')).toContainText('aGk=', { timeout: 60_000 });
});
