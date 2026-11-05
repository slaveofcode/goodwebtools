// Generate Chrome Web Store images for the Companion extension:
//   extension/store/screenshots/01-…png … (1280×800) and extension/store/promo-440x280.png
//
//   node scripts/store-assets.mjs [chromiumExecutablePath]
//
// Captures the real extension UI (unpacked extension in Chromium) and real tool
// pages from goodwebtools.com, then lays each on a branded 1280×800 canvas.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';

const root = new URL('..', import.meta.url).pathname;
const EXT = path.join(root, 'extension');
const OUT = path.join(EXT, 'store');
const exe = process.argv[2] || undefined;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gwt-store-'));

/** Colourful test card (stripes + circle) as a PNG buffer. */
function card(w, h, hueShift = 0) {
  const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; } return ~c >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const hsl = (H, S, L) => { const a = S * Math.min(L, 1 - L); const f = (n) => { const k = (n + H / 30) % 12; return Math.round(255 * (L - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); }; return [f(0), f(8), f(4)]; };
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 3);
    for (let x = 0; x < w; x++) {
      const inCircle = (x - w / 2) ** 2 + (y - h / 2) ** 2 < (Math.min(w, h) * 0.28) ** 2;
      const [r, g, b] = inCircle ? hsl((hueShift + 40) % 360, 0.85, 0.6) : hsl((hueShift + Math.floor((x + y) / 40) * 18) % 360, 0.7, 0.55);
      row[1 + x * 3] = r; row[2 + x * 3] = g; row[3 + x * 3] = b;
    }
    rows.push(row);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}

const ctx = await chromium.launchPersistentContext('', { executablePath: exe, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--autoplay-policy=no-user-gesture-required'], deviceScaleFactor: 1 });
const sw = ctx.serviceWorkers().find((w) => w.url().startsWith('chrome-extension://')) ?? await ctx.waitForEvent('serviceworker');
for (let i = 0; i < 40 && !(await sw.evaluate(() => !!globalThis.chrome?.storage?.local)); i++) await new Promise((r) => setTimeout(r, 250));
await sw.evaluate(() => chrome.storage.local.set({ gwtLang: 'en', favs: ['image-compress', 'json-viewer', 'pdf-merge'], recents: ['qr-gen', 'unit-converter'] }));
const id = new URL(sw.url()).host;
const ext = (p) => `chrome-extension://${id}/${p}`;
const shot = async (page, name, opts = {}) => { const f = path.join(tmp, `${name}.png`); await page.screenshot({ path: f, ...opts }); return f; };

// 1. Launcher popup
let p = await ctx.newPage();
await p.setViewportSize({ width: 380, height: 560 });
await p.goto(ext('popup.html'));
await p.locator('#q').fill('compress');
await p.waitForTimeout(400);
const popup = await shot(p, 'popup');

// 2. A tool opened by a right-click handoff (real page on goodwebtools.com)
await p.close();
const [tool] = await Promise.all([
  ctx.waitForEvent('page', (pg) => pg.url().includes('/tools/image-compress/')),
  (async () => { const h = await ctx.newPage(); await h.goto(ext('mic.html')); await h.evaluate((b64) => chrome.runtime.sendMessage({ type: 'open-tool', tool: 'image-compress', payload: { kind: 'file', name: 'photo-from-the-web.png', type: 'image/png', base64: b64 } }), card(1200, 800, 200).toString('base64')); })(),
]);
await tool.setViewportSize({ width: 1100, height: 700 });
await tool.getByText('photo-from-the-web.png').waitFor({ timeout: 60000 });
// Dismiss the site's cookie banner so it isn't in the picture.
await tool.getByRole('button', { name: 'Decline' }).click({ timeout: 5000 }).catch(() => {});
await tool.getByRole('button', { name: 'Compress', exact: true }).click();
await tool.locator('img[src^="blob:"]').first().waitFor({ timeout: 60000 });
await tool.evaluate(() => { document.querySelector('[data-embed-hide]')?.scrollIntoView(); window.scrollTo(0, 120); });
const handoff = await shot(tool, 'handoff');

// 3. Side panel with the Music Player next to a page
const panel = await ctx.newPage();
await panel.setViewportSize({ width: 380, height: 760 });
await panel.goto(ext('sidepanel.html'));
const frame = panel.frames().find((f) => f.url().includes('music-player')) ?? (await panel.waitForEvent('framenavigated', (f) => f.url().includes('music-player')));
await frame.waitForFunction(() => { const el = document.querySelector('input[type=file]'); return el && Object.keys(el).some((k) => k.startsWith('__react')); }, undefined, { timeout: 60000 });
const tone = path.join(tmp, 'Morning Focus.wav');
const sr = 22050, secs = 40, data = Buffer.alloc(sr * secs * 2);
for (let i = 0; i < sr * secs; i++) data.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 330 * i / sr) * Math.sin(Math.PI * i / sr) * 9000), i * 2);
const hdr = Buffer.alloc(44); hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVEfmt ', 8); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(1, 22); hdr.writeUInt32LE(sr, 24); hdr.writeUInt32LE(sr * 2, 28); hdr.writeUInt16LE(2, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
fs.writeFileSync(tone, Buffer.concat([hdr, data]));
await panel.frameLocator('#frame').locator('input[type=file]').first().setInputFiles(tone);
await panel.waitForTimeout(1200);
await panel.frameLocator('#frame').getByRole('button', { name: /^play$/i }).first().click().catch(() => {});
await panel.waitForTimeout(6000);
const side = await shot(panel, 'sidepanel');

// 4. Recording result
const host = await ctx.newPage();
await host.goto(ext('mic.html'));
await host.evaluate(async () => {
  const { recordStream } = await import('/lib/recorder.js');
  const { saveRecording } = await import('/lib/recordings-db.js');
  const c = Object.assign(document.createElement('canvas'), { width: 1280, height: 720 });
  const g = c.getContext('2d');
  let f = 0;
  const t = setInterval(() => {
    g.fillStyle = '#faf7f0'; g.fillRect(0, 0, 1280, 720);
    g.fillStyle = '#7c3aed'; g.fillRect(80, 80, 1120, 90);
    g.fillStyle = '#fff'; g.font = 'bold 44px sans-serif'; g.fillText('Product demo — slide ' + (1 + Math.floor(f / 30)), 110, 140);
    g.fillStyle = `hsl(${(f * 6) % 360} 70% 55%)`; g.beginPath(); g.arc(300 + (f * 9) % 700, 420, 110, 0, 7); g.fill();
    f++;
  }, 33);
  const s = recordStream(c.captureStream(30));
  await new Promise((r) => setTimeout(r, 4200));
  const { blob, durationMs } = await s.stop();
  clearInterval(t);
  await saveRecording({ blob, type: blob.type, durationMs, at: Date.now() });
});
const rec = await ctx.newPage();
await rec.setViewportSize({ width: 1100, height: 760 });
await rec.goto(ext('recording.html'));
await rec.waitForFunction(() => document.querySelector('video').readyState >= 2, undefined, { timeout: 20000 });
await rec.evaluate(() => { const v = document.querySelector('video'); v.currentTime = 2; });
await rec.waitForTimeout(800);
const recording = await shot(rec, 'recording');

// 5. Save page images
await sw.evaluate((list) => chrome.storage.session.set({ pageImages: { url: 'https://travel-notes.example/japan-trip', title: 'Trip', images: list } }),
  [0, 50, 100, 150, 200, 250, 300, 330].map((h, i) => ({ src: `data:image/png;base64,${card(480, 320, h).toString('base64')}`, width: 1600 + i * 40, height: 1067, alt: '' })));
const imgs = await ctx.newPage();
await imgs.setViewportSize({ width: 1100, height: 700 });
await imgs.goto(ext('images.html'));
await imgs.locator('#format').selectOption('webp');
await imgs.waitForTimeout(500);
const images = await shot(imgs, 'images');

await ctx.close();

// Compose 1280×800 store screenshots.
const compose = await chromium.launch({ executablePath: exe });
const page = await compose.newPage({ viewport: { width: 1280, height: 800 } });
const b64 = (f) => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;
const menu = `<div class="menu"><div class="mi">Open image in new tab</div><div class="mi">Save image as…</div><div class="mi">Copy image</div><hr><div class="mi sub">GoodWebTools ▸
  <div class="submenu">${['Compress image', 'Convert image (WebP, PNG, JPG…)', 'Resize image', 'Remove background', 'Extract text (OCR)', 'Read QR code', 'Upscale image'].map((x, i) => `<div class="mi${i === 0 ? ' on' : ''}">${x}</div>`).join('')}</div></div></div>`;
const slides = [
  { file: '01-right-click.png', title: 'Right-click → the right tool', text: 'Compress, convert, resize, remove backgrounds or read text from any image. Format JSON, hash or read aloud any selection — it opens already loaded.', html: `<div class="stack"><img class="shot" src="${b64(handoff)}" style="width:640px">${menu}</div>` },
  { file: '02-launcher.png', title: '200+ tools, one search away', text: 'Search every GoodWebTools tool in English or Bahasa Indonesia. Star favorites, reopen recent tools, make a QR code of the page.', html: `<img class="shot" src="${b64(popup)}" style="height:560px">` },
  { file: '03-side-panel.png', title: 'Tools beside any page', text: 'Pin tools to the side panel — Music Player, JSON Viewer, Notepad, Unit Converter. Music keeps playing while you switch tabs.', html: `<div class="browser"><div class="page"><h3>Reading list</h3><p>${'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(9)}</p><p>${'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. '.repeat(7)}</p></div><img class="panel" src="${b64(side)}"></div>` },
  { file: '04-recording.png', title: 'Record a tab or your screen', text: 'Record the current tab with its sound — no picker — or a screen or window, with your mic. Alt+Shift+R to start and stop. Then convert to MP4 or GIF.', html: `<img class="shot" src="${b64(recording)}" style="width:640px">` },
  { file: '05-page-helpers.png', title: 'Grab what you need from a page', text: 'Save all images (converted to WebP/PNG/JPG, zipped), take a full-page screenshot, or pick any color on screen. Nothing is uploaded.', html: `<img class="shot" src="${b64(images)}" style="width:640px">` },
];
const css = `body{margin:0;width:1280px;height:800px;display:flex;align-items:center;gap:48px;padding:0 64px;box-sizing:border-box;background:#faf7f0;font-family:Inter,'Space Grotesk',system-ui,sans-serif;color:#0a0a0a}
.copy{width:420px;flex:none}.brand{display:inline-block;background:#7c3aed;color:#fff;font-weight:800;padding:4px 10px;border:3px solid #0a0a0a;box-shadow:4px 4px 0 #0a0a0a;letter-spacing:.04em;margin-bottom:28px}
h1{font-size:46px;line-height:1.05;margin:0 0 20px;font-weight:900;text-transform:uppercase}p.t{font-size:21px;line-height:1.45;color:#333;margin:0}
.visual{flex:1;display:flex;justify-content:center}.shot{border:3px solid #0a0a0a;box-shadow:8px 8px 0 #0a0a0a;background:#fff;max-height:640px;object-fit:cover;object-position:top}
.stack{position:relative}.menu{position:absolute;left:-40px;top:250px;background:#fff;border:1px solid #bbb;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.25);padding:6px 0;width:230px;font:14px system-ui}
.mi{padding:6px 14px;position:relative}.mi.on{background:#e8e0ff}.sub{background:#f1edff}hr{border:0;border-top:1px solid #ddd;margin:5px 0}
.submenu{position:absolute;left:228px;top:-6px;background:#fff;border:1px solid #bbb;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.25);padding:6px 0;width:260px}
.browser{display:flex;width:700px;height:620px;border:3px solid #0a0a0a;box-shadow:8px 8px 0 #0a0a0a;background:#fff;overflow:hidden}.page{flex:1;padding:28px;font-size:13px;color:#555;overflow:hidden}.page h3{color:#111;font-size:24px;margin:0 0 12px}.panel{width:320px;height:620px;object-fit:cover;object-position:top;border-left:3px solid #0a0a0a}`;
for (const s of slides) {
  await page.setContent(`<style>${css}</style><div class="copy"><span class="brand">GOODWEBTOOLS</span><h1>${s.title}</h1><p class="t">${s.text}</p></div><div class="visual">${s.html}</div>`);
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, 'screenshots', s.file) });
}
// Small promo tile 440×280
await page.setViewportSize({ width: 440, height: 280 });
await page.setContent(`<style>body{margin:0;width:440px;height:280px;background:#7c3aed;display:flex;align-items:center;gap:22px;padding:0 28px;box-sizing:border-box;font-family:Inter,system-ui,sans-serif;color:#fff}
img{width:96px;height:96px}h1{margin:0;font-size:25px;line-height:1.05;font-weight:900;text-transform:uppercase}p{margin:10px 0 0;font-size:15px;line-height:1.35;opacity:.95}</style>
<img src="${b64(path.join(EXT, 'icons', 'icon128.png'))}"><div><h1>GoodWebTools Companion</h1><p>Right-click images & text into 200+ private tools. Record, capture, pick colors.</p></div>`);
await page.screenshot({ path: path.join(OUT, 'promo-440x280.png') });
await compose.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log('Store images written to extension/store/');
