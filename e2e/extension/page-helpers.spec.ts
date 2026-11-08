import { test as base, expect, chromium, type BrowserContext, type Worker, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { unzipSync } from 'fflate';

// Chrome only lets "this page" actions run after a real click on the extension
// (activeTab), which automation can't do. So the in-page functions are run on
// fixture pages directly, and the extension pages are fed data the way the
// service worker would.
const EXT = path.join(__dirname, '..', '..', 'extension');
const inject = fs.readFileSync(path.join(EXT, 'lib', 'inject.js'), 'utf8').replace(/^export /gm, '');

const test = base.extend<{ ctx: BrowserContext; sw: Worker; extId: string }>({
  // eslint-disable-next-line no-empty-pattern
  ctx: async ({}, use) => {
    const ctx = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      executablePath: process.env.PW_CHROMIUM_PATH || undefined,
      args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
      acceptDownloads: true,
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    await use(ctx);
    await ctx.close();
  },
  sw: async ({ ctx }, use) => {
    const isExt = (w: Worker) => w.url().startsWith('chrome-extension://');
    const sw = ctx.serviceWorkers().find(isExt) ?? (await ctx.waitForEvent('serviceworker', { predicate: isExt }));
    await expect.poll(() => sw.evaluate(() => typeof chrome !== 'undefined' && !!chrome.storage?.local), { timeout: 15_000 }).toBe(true);
    await sw.evaluate(() => chrome.storage.local.set({ gwtBase: 'http://localhost:4321', gwtLang: 'en' }));
    await use(sw);
  },
  extId: async ({ sw }, use) => { await use(new URL(sw.url()).host); },
});

/** A solid PNG of the given size and colour. */
function png(w: number, h: number, rgb: [number, number, number]): Buffer {
  const crc = (b: Buffer) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; } return ~c >>> 0; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3).map((_, i) => rgb[i % 3])]);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(Array(h).fill(row)))), chunk('IEND', Buffer.alloc(0))]);
}
const dataUrl = (b: Buffer) => `data:image/png;base64,${b.toString('base64')}`;

async function fixture(ctx: BrowserContext, html: string): Promise<Page> {
  const page = await ctx.newPage();
  await page.route('http://fixture.test/**', r => r.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('http://fixture.test/page');
  await page.addScriptTag({ content: inject });
  return page;
}

test('collects page images: img, srcset, picture, CSS backgrounds and og:image', async ({ ctx }) => {
  const big = dataUrl(png(200, 100, [200, 30, 30]));
  const page = await fixture(ctx, `<html><head><meta property="og:image" content="/social.png"></head><body>
    <img src="${big}" alt="red">
    <img src="/small.jpg" srcset="/small.jpg 480w, /large.jpg 1080w">
    <picture><source srcset="/pic.webp 1x, /pic@2x.webp 2x"><img src="/pic.jpg"></picture>
    <div style="width:300px;height:200px;background-image:url('/bg.jpg')"></div></body></html>`);
  const found = await page.evaluate(() => (window as unknown as { collectPageImages: () => { images: { src: string; width: number }[]; url: string } }).collectPageImages());
  const srcs = found.images.map(i => i.src);
  expect(found.url).toBe('http://fixture.test/page');
  expect(srcs).toEqual(expect.arrayContaining([big, 'http://fixture.test/large.jpg', 'http://fixture.test/pic@2x.webp', 'http://fixture.test/bg.jpg', 'http://fixture.test/social.png']));
  expect(found.images.find(i => i.src === big)?.width).toBe(200);
});

test('full-page capture hides fixed headers after the first frame and restores them', async ({ ctx }) => {
  const page = await fixture(ctx, `<body style="margin:0"><header style="position:fixed;top:0;height:50px;width:100%;background:red">H</header>
    <div style="height:3000px"></div></body>`);
  const m = await page.evaluate(() => (window as unknown as { pageMetrics: () => { scrollHeight: number } }).pageMetrics());
  expect(m.scrollHeight).toBe(3000);
  await page.evaluate(() => (window as unknown as { scrollForCapture: (y: number, h: boolean) => number }).scrollForCapture(0, false));
  await expect(page.locator('header')).toBeVisible();
  const y = await page.evaluate(() => (window as unknown as { scrollForCapture: (y: number, h: boolean) => number }).scrollForCapture(1000, true));
  expect(y).toBe(1000);
  await expect(page.locator('header')).toBeHidden();
  await page.evaluate(() => (window as unknown as { restoreAfterCapture: (x: number, y: number) => boolean }).restoreAfterCapture(0, 0));
  await expect(page.locator('header')).toBeVisible();
  expect(await page.evaluate(() => scrollY)).toBe(0);
});

test('the color picker panel appears in the page and closes with Escape', async ({ ctx }) => {
  const page = await fixture(ctx, '<body><p>hello</p></body>');
  await page.evaluate(() => (window as unknown as { colorPickerOverlay: (t: Record<string, string>) => boolean }).colorPickerOverlay({ title: 'Color picker', hint: 'h', pick: 'Pick a color', copy: 'Copy', copied: 'Copied', close: 'Close', unsupported: 'no' }));
  await expect(page.getByRole('dialog', { name: 'Color picker' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pick a color' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#gwt-color-picker')).toHaveCount(0);
});

/** Load the data-file detector on a fixture served with the given type, with a stub `chrome`. */
async function dataPage(ctx: BrowserContext, url: string, contentType: string, body: string, auto = false) {
  const page = await ctx.newPage();
  await page.addInitScript((a) => {
    const msgs: Record<string, string> = { dataBarText: 'This page is $1.', dataBarOpen: 'Open in $1', color_close: 'Close' };
    (window as unknown as { chrome: unknown }).chrome = {
      i18n: { getMessage: (k: string, sub?: string[]) => (msgs[k] || '').replace('$1', sub?.[0] ?? '') },
      runtime: { sendMessage: (m: unknown) => { (window as unknown as { __sent: unknown }).__sent = m; } },
      storage: { local: { get: async () => ({ dataAuto: a }) } },
    };
  }, auto);
  await page.route('http://fixture.test/**', r => r.fulfill({ contentType, body }));
  await page.goto(url);
  await page.addScriptTag({ path: path.join(EXT, 'inject', 'json-detect.js') });
  return page;
}
const sent = (page: Page) => page.evaluate(() => (window as unknown as { __sent: unknown }).__sent);

test('a JSON page gets an "Open in JSON Viewer" bar that hands the JSON over', async ({ ctx }) => {
  const page = await dataPage(ctx, 'http://fixture.test/data.json', 'application/json', '{"api":"response","items":[1,2]}');
  await expect(page.getByText('This page is JSON.')).toBeVisible();
  await page.getByRole('button', { name: 'Open in JSON Viewer' }).click();
  expect(await sent(page)).toEqual({ type: 'open-tool', tool: 'json-viewer', payload: { kind: 'text', text: '{"api":"response","items":[1,2]}' }, replace: false });
});

test('YAML, TOML and Markdown files get their own viewers', async ({ ctx }) => {
  const yaml = await dataPage(ctx, 'http://fixture.test/config.yaml', 'text/plain', 'name: gwt\nitems:\n  - 1\n');
  await yaml.getByRole('button', { name: 'Open in YAML Viewer' }).click();
  expect(await sent(yaml)).toMatchObject({ tool: 'yaml-viewer', payload: { text: 'name: gwt\nitems:\n  - 1\n' } });
  const toml = await dataPage(ctx, 'http://fixture.test/Cargo.toml', 'text/plain', '[package]\nname = "gwt"\n');
  await expect(toml.getByRole('button', { name: 'Open in TOML Viewer' })).toBeVisible();
  const md = await dataPage(ctx, 'http://fixture.test/notes', 'text/markdown', '# Hello\n\nSome *text*.');
  await md.getByRole('button', { name: 'Open in Markdown Preview' }).click();
  expect(await sent(md)).toMatchObject({ tool: 'markdown' });
});

test('with "Open them automatically", the viewer replaces the tab without a bar', async ({ ctx }) => {
  const page = await dataPage(ctx, 'http://fixture.test/data.json', 'application/json', '{"a":1}', true);
  await expect.poll(() => sent(page)).toEqual({ type: 'open-tool', tool: 'json-viewer', payload: { kind: 'text', text: '{"a":1}' }, replace: true });
  await expect(page.locator('#gwt-json-bar')).toHaveCount(0);
});

test('a normal page, or a .json URL that isn\'t JSON, gets no bar', async ({ ctx }) => {
  const html = await dataPage(ctx, 'http://fixture.test/', 'text/html', '<p>{"looks":"like json"}</p>');
  const fake = await dataPage(ctx, 'http://fixture.test/x.json', 'text/plain', 'not json at all');
  await html.waitForTimeout(300);
  await expect(html.locator('#gwt-json-bar')).toHaveCount(0);
  await expect(fake.locator('#gwt-json-bar')).toHaveCount(0);
});

test('the images page zips the chosen images, converted to WebP', async ({ ctx, sw, extId }) => {
  await sw.evaluate(([a, b]) => chrome.storage.session.set({ pageImages: { url: 'https://example.com/post', title: 'Post', images: [
    { src: a, width: 200, height: 100, alt: '' }, { src: b, width: 120, height: 120, alt: '' }, { src: a, width: 200, height: 100, alt: '' },
  ] } }), [dataUrl(png(200, 100, [10, 120, 200])), dataUrl(png(120, 120, [250, 200, 0]))]);
  const page = await ctx.newPage();
  await page.goto(`chrome-extension://${extId}/images.html`);
  await expect(page.locator('#from')).toHaveText('2 images from example.com');
  await page.locator('#format').selectOption('webp');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download 2 as ZIP' }).click()]);
  expect(dl.suggestedFilename()).toBe('images-example.com.zip');
  const files = unzipSync(new Uint8Array(fs.readFileSync(await dl.path())));
  expect(Object.keys(files).sort()).toEqual(['001-image-1.webp', '002-image-2.webp']);
  expect(Buffer.from(files['001-image-1.webp'].slice(8, 12)).toString()).toBe('WEBP');
  await expect(page.locator('#status')).toHaveText('Downloaded 2 images.');
});

test('the screenshot page shows the stitched image and hands it to the Image Annotator', async ({ ctx, extId }) => {
  const page = await ctx.newPage();
  await page.goto(`chrome-extension://${extId}/shot.html`);
  await page.evaluate(async (b64) => {
    const { saveShot } = await import('/lib/recordings-db.js');
    const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
    await saveShot({ blob, width: 300, height: 900, truncated: false, title: 'Long Page', at: Date.now() });
  }, png(300, 900, [40, 160, 90]).toString('base64'));
  await page.reload();
  await expect(page.locator('#meta')).toContainText('300×900 px');
  await expect(page.locator('#download')).toHaveAttribute('download', 'Long-Page-full-page.png');
  const [tool] = await Promise.all([ctx.waitForEvent('page', p => p.url().includes('/tools/image-annotate/')), page.locator('#annotate').click()]);
  await tool.waitForLoadState();
  await expect.poll(() => new URL(tool.url()).pathname).toBe('/tools/image-annotate/');
});

test('the screenshot page copies the image to the clipboard', async ({ ctx, extId }) => {
  const page = await ctx.newPage();
  await page.goto(`chrome-extension://${extId}/shot.html`);
  await page.evaluate(async (b64) => {
    const { saveShot } = await import('/lib/recordings-db.js');
    const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
    await saveShot({ blob, width: 40, height: 30, truncated: false, title: 'Copy me', at: Date.now() });
  }, png(40, 30, [200, 0, 100]).toString('base64'));
  await page.reload();
  await page.getByRole('button', { name: 'Copy image' }).click();
  await expect(page.locator('#note')).toHaveText('Copied to the clipboard — paste it anywhere.');
  const types = await page.evaluate(async () => (await navigator.clipboard.read())[0].types);
  expect(types).toContain('image/png');
});

test('the recording page makes an animated GIF without leaving the extension', async ({ ctx, extId }) => {
  test.setTimeout(60_000);
  const page = await ctx.newPage();
  await page.goto(`chrome-extension://${extId}/recording.html`);
  // A 2-second recording of a moving square, made the way the recorder does (MediaRecorder → webm).
  await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 320; c.height = 180;
    const g = c.getContext('2d')!;
    const rec = new MediaRecorder(c.captureStream(30), { mimeType: 'video/webm' });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    const started = performance.now();
    let x = 0;
    const draw = () => { g.fillStyle = '#fff'; g.fillRect(0, 0, 320, 180); g.fillStyle = '#7c3aed'; g.fillRect(x % 300, 60, 40, 40); x += 8; };
    const timer = setInterval(draw, 33);
    rec.start(200);
    await new Promise(r => setTimeout(r, 2000));
    rec.stop();
    clearInterval(timer);
    await new Promise(r => { rec.onstop = r; });
    const { saveRecording } = await import('/lib/recordings-db.js');
    await saveRecording({ blob: new Blob(chunks, { type: 'video/webm' }), type: 'video/webm', durationMs: performance.now() - started, at: Date.now() });
  });
  await page.reload();
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 45_000 }), page.getByRole('button', { name: 'Download GIF' }).click()]);
  expect(dl.suggestedFilename()).toMatch(/^gwt-recording-.*\.gif$/);
  const gif = fs.readFileSync(await dl.path());
  expect(gif.subarray(0, 6).toString()).toBe('GIF89a');
  expect(gif.readUInt16LE(6)).toBe(320);
  // More than a few frames: count graphic control extensions (0x21 0xF9).
  let frames = 0;
  for (let i = 0; i < gif.length - 1; i++) if (gif[i] === 0x21 && gif[i + 1] === 0xf9) frames++;
  expect(frames).toBeGreaterThan(5);
  await expect(page.locator('#gifStatus')).toContainText('GIF saved');
});

// The real service-worker paths (scroll + capture + stitch, collecting images)
// need site access. A temporary copy of the extension with that access already
// granted lets them run end to end without a permission prompt.
test('full-page screenshot, end to end through the service worker', async () => {
  test.setTimeout(120_000);
  const os = await import('node:os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gwt-ext-'));
  fs.cpSync(EXT, dir, { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  manifest.host_permissions = ['<all_urls>'];
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
  const ctx = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: [`--disable-extensions-except=${dir}`, `--load-extension=${dir}`],
    viewport: { width: 800, height: 600 },
  });
  try {
    const isExt = (w: Worker) => w.url().startsWith('chrome-extension://');
    const sw = ctx.serviceWorkers().find(isExt) ?? (await ctx.waitForEvent('serviceworker', { predicate: isExt }));
    await expect.poll(() => sw.evaluate(() => typeof chrome !== 'undefined' && !!chrome.tabs), { timeout: 15_000 }).toBe(true);
    const page = await ctx.newPage();
    await page.route('http://fixture.test/**', r => r.fulfill({ contentType: 'text/html', body: `<body style="margin:0">
      <header style="position:fixed;top:0;height:40px;width:100%;background:#7c3aed">header</header>
      <div style="height:1000px;background:#e11d48"></div><div style="height:1000px;background:#16a34a"></div><div style="height:500px;background:#2563eb"></div></body>` }));
    await page.goto('http://fixture.test/long');
    const tabId = await sw.evaluate(async () => (await chrome.tabs.query({ url: 'http://fixture.test/*' }))[0].id);
    const [shotPage] = await Promise.all([
      ctx.waitForEvent('page', p => p.url().endsWith('/shot.html')),
      // Same message the popup sends (from an extension page; the worker can't message itself).
      (async () => {
        const host = await ctx.newPage();
        await host.goto(`chrome-extension://${new URL(sw.url()).host}/mic.html`);
        await host.evaluate((id) => chrome.runtime.sendMessage({ type: 'page-shot', tabId: id }), tabId);
      })(),
    ]);
    await expect(shotPage.locator('#meta')).toContainText(/^800×2500 px/, { timeout: 30_000 });
    // Sample the stitched image: red at the top, green in the middle, blue at the bottom; the fixed header only once.
    const colors = await shotPage.locator('#img').evaluate((img: HTMLImageElement) => {
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext('2d')!; g.drawImage(img, 0, 0);
      const at = (y: number) => Array.from(g.getImageData(400, y, 1, 1).data.slice(0, 3));
      return { header: at(10), red: at(500), green: at(1500), blue: at(2300), noRepeatedHeader: at(1010) };
    });
    expect(colors.header).toEqual([124, 58, 237]);
    expect(colors.red).toEqual([225, 29, 72]);
    expect(colors.green).toEqual([22, 163, 74]);
    expect(colors.blue).toEqual([37, 99, 235]);
    expect(colors.noRepeatedHeader).toEqual([22, 163, 74]);
    // The page is restored afterwards.
    expect(await page.evaluate(() => scrollY)).toBe(0);
  } finally {
    await ctx.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
