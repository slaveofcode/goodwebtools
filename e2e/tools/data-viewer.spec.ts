import { test, expect, type Page } from '@playwright/test';

/** The island lazy-hydrates; wait until React owns the input before typing. */
async function openViewer(page: Page, route: string) {
  await page.goto(route);
  await page.waitForFunction(() => {
    const el = document.querySelector('textarea');
    return !!el && Object.keys(el).some(k => k.startsWith('__react'));
  }, undefined, { timeout: 60_000 });
}

const row = (page: Page, path: string) => page.locator(`[data-path='${path}']`);

test('JSON viewer: tree, expand/collapse, search and error location', async ({ page }) => {
  await openViewer(page, '/tools/json-viewer');
  await page.locator('textarea').fill('{"users":[{"name":"Alice","city":"Jakarta"},{"name":"Bob","city":"Bandung"}],"total":2}');

  await expect(page.getByTestId('data-stats')).toContainText('3 objects · 1 arrays');
  await expect(row(page, '$.total')).toContainText('2');
  // Typed input opens only the root; expand a node by clicking its arrow.
  await row(page, '$.users').getByRole('button', { name: 'Expand' }).click();
  await expect(row(page, '$.users[0]')).toBeVisible();

  await page.getByRole('button', { name: 'Collapse all' }).click();
  await expect(row(page, '$.users[0]')).toHaveCount(0);

  // Search opens the ancestors of a match and highlights it.
  await page.getByRole('searchbox').fill('bandung');
  await expect(page.getByTestId('match-count')).toHaveText('1 match');
  await expect(row(page, '$.users[1].city')).toBeVisible();

  await page.locator('textarea').fill('{\n  "a": 1,\n  "b": ,\n}');
  await expect(page.getByText(/Invalid JSON — Line 3, column/)).toBeVisible();
});

test('YAML viewer reads multi-document YAML and TOML viewer reads tables', async ({ page }) => {
  await openViewer(page, '/tools/yaml-viewer');
  await expect(page.getByRole('button', { name: 'YAML' })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('textarea').fill('kind: Service\n---\nkind: Deployment\n');
  await expect(row(page, '$[1]')).toBeVisible();
  await row(page, '$[1]').getByRole('button', { name: 'Expand' }).click();
  await expect(row(page, '$[1].kind')).toContainText('"Deployment"');

  await openViewer(page, '/tools/toml-viewer');
  await page.locator('textarea').fill('[package]\nname = "gwt"\n[[bin]]\nname = "a"\n[[bin]]\nname = "b"\n');
  await page.getByRole('button', { name: 'Expand all' }).click();
  await expect(row(page, '$.bin[1].name')).toContainText('"b"');
});

test('the sample loads, and a loaded file switches to its detected format', async ({ page }) => {
  await openViewer(page, '/tools/json-viewer');
  await page.getByRole('button', { name: 'Sample' }).click();
  await expect(row(page, '$.owner.city')).toContainText('Jakarta');

  await page.locator('input[type=file]').setInputFiles({ name: 'Cargo.toml', mimeType: 'application/toml', buffer: Buffer.from('[package]\nname = "x"\n') });
  await expect(page.getByText('Detected TOML.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'TOML' })).toHaveAttribute('aria-pressed', 'true');
  await expect(row(page, '$.package.name')).toContainText('"x"');
});

test('reads JSON Lines files and JSON with comments', async ({ page }) => {
  await openViewer(page, '/tools/json-viewer');
  await page.locator('input[type=file]').setInputFiles({
    name: 'events.jsonl', mimeType: 'application/x-ndjson',
    buffer: Buffer.from('{"event":"open","ok":true}\n{"event":"click","x":10}\n{"event":"close"}\n'),
  });
  await expect(page.getByTestId('variant-note')).toHaveText('Read as JSON Lines — 3 records.');
  // A loaded file opens its top-level records straight away.
  await expect(row(page, '$[1].event')).toContainText('"click"');

  await page.locator('textarea').fill('{\n  // editor settings\n  "tabSize": 2,\n  "rulers": [80, 120,],\n}');
  await expect(page.getByTestId('variant-note')).toHaveText('Read as JSON5 / JSON with comments.');
  await expect(row(page, '$.tabSize')).toContainText('2');
});
