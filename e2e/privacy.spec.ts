import { test, expect } from '@playwright/test';

for (const [path, heading] of [['/privacy', 'Advertising'], ['/id/privacy', 'Iklan']] as const) {
  test(`${path} discloses Google advertising cookies and opt-outs`, async ({ page }) => {
    await page.goto(path);
    const ads = page.locator('#ads');
    await expect(ads.getByRole('heading', { name: heading })).toBeVisible();
    await expect(ads.locator('a[href="https://myadcenter.google.com/"]')).toBeVisible();
    await expect(ads.locator('a[href="https://www.aboutads.info/choices/"]')).toBeVisible();
    await expect(ads.locator('a[href="https://policies.google.com/technologies/partner-sites"]')).toBeVisible();
  });
}
