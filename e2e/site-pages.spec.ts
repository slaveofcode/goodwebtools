import { test, expect, type Page } from '@playwright/test';

// Trust and content pages added for AdSense review: footer, terms, contact,
// changelog, guides, and ads kept off pages without real content.

const ADSENSE = /pagead2\.googlesyndication\.com/;
/** Block the real ad script and report whether the page asked for it. */
async function watchAds(page: Page) {
  let requested = false;
  await page.route(ADSENSE, (r) => { requested = true; return r.fulfill({ status: 204, body: '' }); });
  return () => requested;
}

test('every page has a footer linking guides, changelog, contact, privacy and terms (EN + ID)', async ({ page }) => {
  await page.goto('/');
  const footer = page.getByTestId('site-footer');
  for (const [name, href] of [['Guides', '/guides/'], ['What’s new', '/changelog/'], ['Contact', '/contact/'], ['Privacy', '/privacy/'], ['Terms of use', '/terms/']]) {
    await expect(footer.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
  }
  await page.goto('/id/');
  await expect(page.getByTestId('site-footer').getByRole('link', { name: 'Panduan', exact: true })).toHaveAttribute('href', '/id/guides/');
  await expect(page.getByTestId('site-footer').getByRole('link', { name: 'Ketentuan penggunaan' })).toHaveAttribute('href', '/id/terms/');
});

test('the footer is hidden inside an embedded tool', async ({ page }) => {
  await page.goto('/tools/word-counter/?embed=1');
  await expect(page.getByTestId('site-footer')).toBeHidden();
});

test('terms, contact and changelog pages render in both languages', async ({ page }) => {
  await page.goto('/terms/');
  await expect(page.getByRole('heading', { level: 1, name: 'Terms of Use' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No warranty' })).toBeVisible();
  await page.goto('/id/terms/');
  await expect(page.getByRole('heading', { level: 1, name: 'Ketentuan Penggunaan' })).toBeVisible();

  await page.goto('/contact/');
  await expect(page.getByRole('heading', { level: 1, name: 'Contact GoodWebTools' })).toBeVisible();
  // The address is assembled by script, never in the static HTML.
  await expect(page.getByTestId('contact-email')).toHaveAttribute('href', 'mailto:contact@goodwebtools.com');
  await page.goto('/id/contact/');
  await expect(page.getByRole('heading', { level: 1, name: 'Hubungi GoodWebTools' })).toBeVisible();

  await page.goto('/changelog/');
  await expect(page.getByTestId('changelog').locator('h2').first()).toContainText('Website & extension');
  await expect(page.getByTestId('changelog')).toContainText('1.0.0-beta.7');
});

test('guides: list, article with its tool, and a link back from the tool page', async ({ page }) => {
  await page.goto('/guides/');
  const cards = page.getByTestId('guide-list').locator('a');
  expect(await cards.count()).toBeGreaterThanOrEqual(10);

  await page.goto('/guides/compress-photo-to-200kb/');
  await expect(page.locator('article h1')).not.toBeEmpty();
  await expect(page.getByTestId('guide-tool-cta')).toHaveAttribute('href', '/tools/image-compress/');
  await expect(page.locator('.guide-body h2').first()).toBeVisible();
  await expect(page.locator('link[rel="alternate"][hreflang="id"]')).toHaveAttribute('href', 'https://goodwebtools.com/id/guides/compress-photo-to-200kb/');

  await page.goto('/id/guides/compress-photo-to-200kb/');
  await expect(page.getByTestId('guide-tool-cta')).toHaveAttribute('href', '/id/tools/image-compress/');

  await page.goto('/tools/image-compress/');
  await expect(page.getByTestId('tool-guide-link').first()).toHaveAttribute('href', '/guides/compress-photo-to-200kb/');
  await page.goto('/');
  await expect(page.getByTestId('home-guides').locator('a').first()).toBeVisible();
});

test('ads load on content pages, not in embedded tools, settings or 404', async ({ page }) => {
  const requested = await watchAds(page);
  await page.goto('/tools/word-counter/');
  await expect.poll(requested).toBe(true);

  for (const url of ['/tools/word-counter/?embed=1', '/settings/', '/this-page-does-not-exist/']) {
    const p = await page.context().newPage();
    const req = await watchAds(p);
    await p.goto(url);
    await p.waitForLoadState('load');
    await p.waitForTimeout(300);
    expect(req(), url).toBe(false);
    await p.close();
  }
});
