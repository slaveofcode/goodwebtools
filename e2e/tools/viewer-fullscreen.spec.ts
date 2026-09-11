import { test, expect } from '@playwright/test';

// The full-screen expand is a shared wrapper (ExpandableViewer + useExpand)
// added to the viewer tools. The button renders regardless of loaded content,
// so we can assert the toggle without opening a file. Native fullscreen may be
// denied in headless, but the CSS-overlay fallback still flips the label.
for (const route of ['/tools/svg-viewer', '/tools/image-viewer']) {
  test(`full-screen toggle works on ${route}`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState('networkidle').catch(() => {});

    const expand = page.getByRole('button', { name: 'Full screen' });
    await expect(async () => {
      await expand.click();
      await expect(page.getByRole('button', { name: 'Exit' })).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 30_000 });

    await page.getByRole('button', { name: 'Exit' }).click();
    await expect(page.getByRole('button', { name: 'Full screen' })).toBeVisible();
  });
}
