// The current page's images: pick some, optionally convert to WebP/PNG/JPG, and
// download them as one zip. Fetching and converting happen in this browser.
import { pickLang } from './lib/menus.js';
import { cleanImageList, imageFileName, uniqueNames } from './lib/page-helpers.js';
import { zipSync } from './vendor/fflate.js';

const T = {
  en: { title: 'Images on this page', from: (n, u) => `${n} images from ${u}`, all: 'Select all', none: 'Select none', original: 'Original format', zip: (n) => `Download ${n} as ZIP`, working: (i, n) => `Preparing ${i}/${n}…`, done: (n, f) => `Downloaded ${n} images${f ? ` (${f} could not be read)` : ''}.`, empty: 'No images found on this page.', denied: 'Site access is needed to read these images.' },
  id: { title: 'Gambar di halaman ini', from: (n, u) => `${n} gambar dari ${u}`, all: 'Pilih semua', none: 'Batal pilih', original: 'Format asli', zip: (n) => `Unduh ${n} sebagai ZIP`, working: (i, n) => `Menyiapkan ${i}/${n}…`, done: (n, f) => `${n} gambar diunduh${f ? ` (${f} tidak bisa dibaca)` : ''}.`, empty: 'Tidak ada gambar di halaman ini.', denied: 'Akses situs diperlukan untuk membaca gambar ini.' },
};
const $ = (id) => document.getElementById(id);
const { gwtLang } = await chrome.storage.local.get('gwtLang');
const t = T[pickLang(gwtLang, chrome.i18n.getUILanguage())];
const { pageImages } = await chrome.storage.session.get('pageImages');
const images = cleanImageList(pageImages?.images || []);
let host = '';
try { host = new URL(pageImages?.url).hostname; } catch { /* none */ }

$('title').textContent = t.title;
$('from').textContent = images.length ? t.from(images.length, host) : t.empty;
$('all').textContent = t.all;
$('none').textContent = t.none;
$('format').options[0].textContent = t.original;

$('grid').replaceChildren(...images.map((im, i) => {
  const card = document.createElement('label');
  card.className = 'card';
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = true;
  box.dataset.i = String(i);
  const img = document.createElement('img');
  img.src = im.src;
  img.alt = im.alt || '';
  img.loading = 'lazy';
  img.referrerPolicy = 'no-referrer';
  const meta = document.createElement('span');
  meta.textContent = im.width && im.height ? `${im.width}×${im.height}` : '';
  card.append(box, img, meta);
  return card;
}));

const selected = () => [...document.querySelectorAll('#grid input:checked')].map((b) => images[+b.dataset.i]);
const refresh = () => { const n = selected().length; $('zip').textContent = t.zip(n); $('zip').disabled = !n; };
$('grid').addEventListener('change', refresh);
$('all').addEventListener('click', () => { document.querySelectorAll('#grid input').forEach((b) => { b.checked = true; }); refresh(); });
$('none').addEventListener('click', () => { document.querySelectorAll('#grid input').forEach((b) => { b.checked = false; }); refresh(); });
refresh();

const MIME = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg' };
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/avif': 'avif' };

async function convert(blob, fmt) {
  if (fmt === 'original') return { blob, ext: EXT[blob.type] || 'img' };
  const bmp = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = canvas.getContext('2d');
  if (fmt === 'jpg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, bmp.width, bmp.height); }
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  return { blob: await canvas.convertToBlob({ type: MIME[fmt], quality: 0.9 }), ext: fmt };
}

$('zip').addEventListener('click', async () => {
  const list = selected();
  // Reading images from other sites needs the optional site access (asked once, in this click).
  const remote = list.some((im) => /^https?:/.test(im.src));
  if (remote && !(await chrome.permissions.request({ origins: ['<all_urls>'] }).catch(() => false))) { $('status').textContent = t.denied; return; }
  const fmt = $('format').value;
  $('zip').disabled = true;
  const entries = [];
  let failed = 0;
  for (let i = 0; i < list.length; i++) {
    $('status').textContent = t.working(i + 1, list.length);
    try {
      const res = await fetch(list[i].src);
      if (!res.ok) throw new Error(String(res.status));
      const { blob, ext } = await convert(await res.blob(), fmt);
      entries.push({ name: imageFileName(list[i].src, i, ext), bytes: new Uint8Array(await blob.arrayBuffer()) });
    } catch { failed++; }
  }
  const names = uniqueNames(entries.map((e) => e.name));
  const zip = zipSync(Object.fromEntries(entries.map((e, i) => [names[i], [e.bytes, { level: 0 }]])));
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([zip], { type: 'application/zip' })), download: `images-${host || 'page'}.zip` });
  a.click();
  $('status').textContent = t.done(entries.length, failed);
  refresh();
});
