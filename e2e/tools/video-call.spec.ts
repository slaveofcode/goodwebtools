import { test, expect, type Browser, type Page } from '@playwright/test';

// Fake camera/mic and an auto-picked "screen" so a two-party call runs headless.
// Manual (copy-paste) signaling needs no server, so this runs on the dev server.
test.use({
  launchOptions: {
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--auto-select-desktop-capture-source=Entire screen'],
  },
});

async function openPeer(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ permissions: ['camera', 'microphone'] });
  await ctx.addInitScript(() => localStorage.setItem('gwt.webrtc.signaling', 'manual'));
  const page = await ctx.newPage();
  await page.goto('/tools/video-call');
  await page.waitForFunction(
    () => [...document.querySelectorAll('button')].some(b => /continue/i.test(b.textContent ?? '') && Object.keys(b).some(k => k.startsWith('__reactProps'))),
    undefined,
    { timeout: 60_000 },
  );
  await page.getByRole('button', { name: /continue/i }).click();
  return page;
}

/** Width of the remote (non-muted) video as the other side sees it. */
const remoteWidth = (page: Page) =>
  page.evaluate(() => [...document.querySelectorAll('video')].find(v => !v.muted)?.videoWidth ?? 0);

test('a shared screen reaches the other side and switches back to the camera', async ({ browser }) => {
  test.setTimeout(120_000);
  const caller = await openPeer(browser);
  const callee = await openPeer(browser);

  await caller.getByRole('button', { name: 'I’m calling' }).click();
  const offerBox = caller.locator('textarea[readonly]');
  await expect(offerBox).not.toHaveValue('', { timeout: 30_000 });
  await callee.getByRole('button', { name: 'I’m answering' }).click();
  await callee.locator('textarea').first().fill(await offerBox.inputValue());
  await callee.getByRole('button', { name: /generate answer/i }).click();
  const answerBox = callee.locator('textarea[readonly]');
  await expect(answerBox).not.toHaveValue('', { timeout: 30_000 });
  await caller.locator('textarea:not([readonly])').fill(await answerBox.inputValue());
  await caller.getByRole('button', { name: /^connect$/i }).click();

  // The fake camera is 640×480 (or smaller while bandwidth ramps up).
  await expect.poll(() => remoteWidth(callee), { timeout: 30_000 }).toBeGreaterThan(0);
  await expect.poll(() => remoteWidth(callee), { timeout: 30_000 }).toBeLessThanOrEqual(640);

  await expect(caller.getByRole('note')).toContainText('Screen sharing is tested in Google Chrome only');
  await caller.getByRole('button', { name: 'Share screen' }).click();
  await expect(caller.getByRole('button', { name: /stop sharing/i })).toBeVisible();
  // The screen is larger than the camera, but capped at 1920 wide.
  await expect.poll(() => remoteWidth(callee), { timeout: 30_000 }).toBeGreaterThan(640);
  expect(await remoteWidth(callee)).toBeLessThanOrEqual(1920);

  await caller.getByRole('button', { name: /stop sharing/i }).click();
  await expect.poll(() => remoteWidth(callee), { timeout: 30_000 }).toBeLessThanOrEqual(640);
});
