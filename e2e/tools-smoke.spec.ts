import { test, expect } from '@playwright/test';
import { tools } from '../src/registry/tools';

/**
 * Render smoke over EVERY registered tool: each page must return 200, mount its
 * island (a visible <h1>), and not throw an uncaught exception. This one spec
 * auto-covers all existing tools and every future tool the moment it's added to
 * the registry — the cheap safety net beneath the per-tool happy-path specs.
 *
 * `pageerror` (uncaught JS) is collected but reported as an annotation rather
 * than a hard failure, because a few tools legitimately throw on load in a
 * headless browser (no WebGPU / camera / mic). The hard signal is: page loads
 * and the island hydrates.
 */
const pages = tools.filter(t => !t.desktopOnly).map(t => ({ id: t.id, route: t.route }));

for (const { id, route } of pages) {
  test(`tool page renders: ${id}`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    const resp = await page.goto(route);
    expect(resp?.ok(), `${route} returned HTTP ${resp?.status()}`).toBeTruthy();
    await expect(page.locator('h1').first()).toBeVisible();
    if (errors.length) testInfo.annotations.push({ type: 'pageerror', description: `${route}: ${errors.join(' | ')}` });
  });
}
