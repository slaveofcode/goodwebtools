import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Synthetic fixtures from scripts/make-3d-fixtures.mjs (a 12-triangle cube).
const STL = 'e2e/fixtures/cube.stl';
const GLB = 'e2e/fixtures/cube.glb';
const REMOTE = 'https://models.example.test/cube.glb';

const statValue = (page: Page, label: string) =>
  page.getByTestId('model-stats').locator(`dt:text-is("${label}") + dd`);

/**
 * The island lazy-hydrates via ToolHost and its markup can be visible before
 * React is live, so a file pick made too early is silently lost. Wait until
 * React has attached its props to the file input.
 */
async function waitForIsland(page: Page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForFunction(
    () => {
      const input = document.querySelector('input[type="file"][accept*=".blend"]');
      return !!input && Object.keys(input).some(k => k.startsWith('__reactProps'));
    },
    undefined,
    { timeout: 45_000 },
  );
}

async function openFiles(page: Page, files: string | string[]) {
  await waitForIsland(page);
  await page.locator('input[type="file"][accept*=".blend"]').setInputFiles(files);
  await expect(page.getByTestId('model-stats')).toBeVisible({ timeout: 45_000 });
}

test.beforeEach(async ({ page }) => {
  // Force the plain <a download> path so Playwright sees a download event.
  await page.addInitScript(() => {
    delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker;
  });
});

test('opens an STL, shows stats + object tree, toggles wireframe and saves a PNG', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/tools/3d-viewer');
  await openFiles(page, STL);

  await expect(statValue(page, 'Triangles')).toHaveText('12');
  await expect(statValue(page, 'Format')).toHaveText('STL');
  await expect(page.getByRole('checkbox', { name: 'cube' })).toBeChecked();

  const wire = page.getByRole('button', { name: 'Wireframe' });
  await wire.click();
  await expect(wire).toHaveAttribute('aria-pressed', 'true');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'PNG ↓' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('cube.png');
});

test('plays the animation in a GLB', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/tools/3d-viewer');
  await openFiles(page, GLB);

  await expect(statValue(page, 'Animations')).toHaveText('1');
  const clip = page.locator('select#model-clip');
  await expect(clip).toHaveValue('0');
  await expect(clip.locator('option:checked')).toHaveText('Spin');

  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
});

test('opens a model from a ?url= link served with CORS', async ({ page }) => {
  test.setTimeout(90_000);
  await page.route(REMOTE, route =>
    route.fulfill({
      status: 200,
      body: readFileSync(GLB),
      headers: { 'content-type': 'model/gltf-binary', 'access-control-allow-origin': '*' },
    }),
  );
  await page.goto(`/tools/3d-viewer?url=${encodeURIComponent(REMOTE)}`);
  await expect(statValue(page, 'Triangles')).toHaveText('12', { timeout: 45_000 });
  await expect(statValue(page, 'Format')).toHaveText('glTF binary (GLB)');
});

test('explains CORS when the download is blocked', async ({ page }) => {
  test.setTimeout(90_000);
  // Playwright-fulfilled responses skip CORS checks, so simulate the browser's
  // view of a CORS refusal: the fetch fails with a bare network error.
  await page.route(REMOTE, route => route.abort('failed'));
  await page.goto(`/tools/3d-viewer?url=${encodeURIComponent(REMOTE)}`);
  await expect(page.getByText(/Couldn’t download the model/)).toBeVisible({ timeout: 45_000 });
});

test('rejects a file that is not a 3D model', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/tools/3d-viewer');
  await waitForIsland(page);
  await page
    .locator('input[type="file"][accept*=".blend"]')
    .setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('just some text') });
  await expect(page.getByText(/isn’t a supported 3D model/)).toBeVisible();
});
