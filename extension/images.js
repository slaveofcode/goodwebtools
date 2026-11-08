// The current page's images, video and audio. Images: pick some, optionally
// convert to WebP/PNG/JPG, and download them as one zip. Video and audio: preview,
// download each file (HLS streams are joined into one file), or hand it to a
// GoodWebTools converter. Fetching and converting happen in this browser.
import { pickLang } from './lib/menus.js';
import { cleanImageList, imageFileName, uniqueNames, cleanMediaList, isMediaBlockedSite, parseM3u8, mediaExtension, urlExtension } from './lib/page-helpers.js';
import { canHandOff, formatBytes } from './lib/recording.js';
import { bytesToBase64 } from './lib/handoff-store.js';
import { zipSync } from './vendor/fflate.js';

const T = {
  en: {
    title: 'Images and media on this page',
    from: (parts, u) => `${parts} from ${u}`,
    nImages: (n) => `${n} image${n === 1 ? '' : 's'}`, nVideo: (n) => `${n} video${n === 1 ? '' : 's'}`, nAudio: (n) => `${n} audio file${n === 1 ? '' : 's'}`,
    tabImages: (n) => `Images (${n})`, tabVideo: (n) => `Video (${n})`, tabAudio: (n) => `Audio (${n})`,
    all: 'Select all', none: 'Select none', original: 'Original format', zip: (n) => `Download ${n} as ZIP`,
    working: (i, n) => `Preparing ${i}/${n}…`, done: (n, f) => `Downloaded ${n} images${f ? ` (${f} could not be read)` : ''}.`,
    empty: 'No images, video or audio found on this page.', denied: 'Site access is needed to read these files.',
    download: 'Download', convert: 'Convert', stream: 'Stream (HLS)',
    fetching: (got, total) => `Downloading ${got}${total ? ` of ${total}` : ''}…`, segments: (i, n) => `Downloading part ${i} of ${n}…`,
    saved: (name, size) => `Saved ${name} (${size}).`, savedTs: 'Saved as .ts — the Video Converter can turn it into MP4.',
    failed: 'Could not download this file (the site may block it).', encrypted: 'This stream is encrypted, so it can’t be saved.',
    live: 'This is a live stream, so there is no complete file to save.', tooBig: 'Too large to hand over — download it, then open it in the converter.',
    blocked: 'Saving video and audio isn’t available on YouTube or SoundCloud.',
    streamed: 'A player on this page streams its media in small pieces, so there is no single file to save.',
  },
  id: {
    title: 'Gambar dan media di halaman ini',
    from: (parts, u) => `${parts} dari ${u}`,
    nImages: (n) => `${n} gambar`, nVideo: (n) => `${n} video`, nAudio: (n) => `${n} audio`,
    tabImages: (n) => `Gambar (${n})`, tabVideo: (n) => `Video (${n})`, tabAudio: (n) => `Audio (${n})`,
    all: 'Pilih semua', none: 'Batal pilih', original: 'Format asli', zip: (n) => `Unduh ${n} sebagai ZIP`,
    working: (i, n) => `Menyiapkan ${i}/${n}…`, done: (n, f) => `${n} gambar diunduh${f ? ` (${f} tidak bisa dibaca)` : ''}.`,
    empty: 'Tidak ada gambar, video, atau audio di halaman ini.', denied: 'Akses situs diperlukan untuk membaca berkas ini.',
    download: 'Unduh', convert: 'Konversi', stream: 'Stream (HLS)',
    fetching: (got, total) => `Mengunduh ${got}${total ? ` dari ${total}` : ''}…`, segments: (i, n) => `Mengunduh bagian ${i} dari ${n}…`,
    saved: (name, size) => `${name} tersimpan (${size}).`, savedTs: 'Tersimpan sebagai .ts — Video Converter bisa mengubahnya ke MP4.',
    failed: 'Berkas ini tidak bisa diunduh (situsnya mungkin memblokir).', encrypted: 'Stream ini terenkripsi, jadi tidak bisa disimpan.',
    live: 'Ini siaran langsung, jadi tidak ada berkas utuh untuk disimpan.', tooBig: 'Terlalu besar untuk dikirim — unduh dulu, lalu buka di konverter.',
    blocked: 'Menyimpan video dan audio tidak tersedia di YouTube atau SoundCloud.',
    streamed: 'Pemutar di halaman ini mengalirkan medianya dalam potongan kecil, jadi tidak ada satu berkas untuk disimpan.',
  },
};
const $ = (id) => document.getElementById(id);
const { gwtLang } = await chrome.storage.local.get('gwtLang');
const t = T[pickLang(gwtLang, chrome.i18n.getUILanguage())];
const { pageImages } = await chrome.storage.session.get('pageImages');
const images = cleanImageList(pageImages?.images || []);
const blocked = isMediaBlockedSite(pageImages?.url);
const media = blocked ? [] : cleanMediaList(pageImages?.media || []);
const videos = media.filter((m) => m.kind !== 'audio');
const audios = media.filter((m) => m.kind === 'audio');
let host = '';
try { host = new URL(pageImages?.url).hostname; } catch { /* none */ }
const pageTitle = (pageImages?.title || host || 'media').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'media';

$('title').textContent = t.title;
const parts = [images.length && t.nImages(images.length), videos.length && t.nVideo(videos.length), audios.length && t.nAudio(audios.length)].filter(Boolean);
$('from').textContent = parts.length ? t.from(parts.join(', '), host) : t.empty;
if (blocked) { $('note').textContent = t.blocked; $('note').hidden = false; }
else if (pageImages?.streamed && !media.length) { $('note').textContent = t.streamed; $('note').hidden = false; }
$('all').textContent = t.all;
$('none').textContent = t.none;
$('format').options[0].textContent = t.original;

// ── Tabs ─────────────────────────────────────────────────────────────────────
const counts = { images: images.length, video: videos.length, audio: audios.length };
$('tab-images').textContent = t.tabImages(images.length);
$('tab-video').textContent = t.tabVideo(videos.length);
$('tab-audio').textContent = t.tabAudio(audios.length);
for (const k of Object.keys(counts)) $(`tab-${k}`).hidden = !counts[k];
function show(panel) {
  for (const k of Object.keys(counts)) {
    $(`tab-${k}`).setAttribute('aria-selected', String(k === panel));
    $(`panel-${k}`).hidden = k !== panel;
  }
}
$('tabs').addEventListener('click', (e) => { const b = e.target.closest('button[data-panel]'); if (b) show(b.dataset.panel); });
const firstPanel = Object.keys(counts).find((k) => counts[k]);
$('tabs').hidden = !firstPanel;
show(firstPanel || 'images');
if (!images.length) $('panel-images').hidden = true;

/** Reading files from other sites needs the optional site access (asked once, in a click). */
async function access(srcs) {
  if (!srcs.some((s) => /^https?:/.test(s))) return true;
  return chrome.permissions.request({ origins: ['<all_urls>'] }).catch(() => false);
}

// ── Images ───────────────────────────────────────────────────────────────────
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

const save = (blob, name) => {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
};

$('zip').addEventListener('click', async () => {
  const list = selected();
  if (!(await access(list.map((im) => im.src)))) { $('status').textContent = t.denied; return; }
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
  save(new Blob([zip], { type: 'application/zip' }), `images-${host || 'page'}.zip`);
  $('status').textContent = t.done(entries.length, failed);
  refresh();
});

// ── Video and audio ──────────────────────────────────────────────────────────
class MediaError extends Error {}

/** Fetch one file, reporting progress. */
async function fetchFile(src, onProgress) {
  const res = await fetch(src);
  if (!res.ok || !res.body) throw new MediaError(t.failed);
  const total = Number(res.headers.get('content-length')) || 0;
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  let last = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    if (got - last > 512 * 1024) { last = got; onProgress(t.fetching(formatBytes(got), total ? formatBytes(total) : '')); }
  }
  return new Blob(chunks, { type: res.headers.get('content-type') || '' });
}

/** Download an HLS stream (best quality) and join its parts into one file. */
async function fetchHls(src, onProgress) {
  const text = async (u) => { const r = await fetch(u); if (!r.ok) throw new MediaError(t.failed); return r.text(); };
  let url = src;
  let pl = parseM3u8(await text(url), url);
  if (pl?.type === 'master') {
    if (!pl.variants.length) throw new MediaError(t.failed);
    url = pl.variants[0].url;
    pl = parseM3u8(await text(url), url);
  }
  if (!pl || pl.type !== 'media' || !pl.segments.length) throw new MediaError(t.failed);
  if (pl.encrypted) throw new MediaError(t.encrypted);
  if (pl.live) throw new MediaError(t.live);
  const parts = [];
  if (pl.init) parts.push(await (await fetch(pl.init)).blob());
  for (let i = 0; i < pl.segments.length; i++) {
    onProgress(t.segments(i + 1, pl.segments.length));
    const r = await fetch(pl.segments[i]);
    if (!r.ok) throw new MediaError(t.failed);
    parts.push(await r.blob());
  }
  const segExt = urlExtension(pl.segments[0]);
  const ext = pl.init ? 'mp4' : ['aac', 'mp3'].includes(segExt) ? segExt : 'ts';
  const type = { mp4: 'video/mp4', aac: 'audio/aac', mp3: 'audio/mpeg', ts: 'video/mp2t' }[ext];
  return { blob: new Blob(parts, { type }), ext };
}

const cache = new Map();
async function getMedia(item, index, onProgress) {
  if (cache.has(item.src)) return cache.get(item.src);
  let out;
  if (item.kind === 'hls') {
    const { blob, ext } = await fetchHls(item.src, onProgress);
    out = { blob, name: `${pageTitle}${index ? `-${index + 1}` : ''}.${ext}` };
  } else {
    const blob = await fetchFile(item.src, onProgress);
    const ext = mediaExtension(item.src, blob.type, item.kind);
    out = { blob, name: imageFileName(item.src, index, ext).replace(/^\d{3}-/, '') };
  }
  cache.set(item.src, out);
  return out;
}

function mediaRow(item, index) {
  const row = document.createElement('div');
  row.className = 'row';
  row.dataset.kind = item.kind;
  const info = document.createElement('div');
  info.className = 'info';
  const name = document.createElement('span');
  name.className = 'name';
  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = item.kind === 'hls' ? t.stream : urlExtension(item.src) || item.kind;
  let file = '';
  try { file = decodeURIComponent(new URL(item.src).pathname.split('/').pop() || ''); } catch { /* none */ }
  name.append(badge, item.label || file || item.src);
  const src = document.createElement('span');
  src.className = 'src';
  src.textContent = item.src;
  src.title = item.src;
  info.append(name, src);
  const btns = document.createElement('div');
  btns.className = 'btns';
  const dl = Object.assign(document.createElement('button'), { type: 'button', className: 'go', textContent: t.download });
  const conv = Object.assign(document.createElement('button'), { type: 'button', textContent: t.convert });
  btns.append(dl, conv);
  const status = document.createElement('span');
  status.className = 'status';
  status.setAttribute('role', 'status');
  row.append(info, btns);
  if (item.kind !== 'hls') {
    const player = document.createElement(item.kind === 'audio' ? 'audio' : 'video');
    player.controls = true;
    player.preload = 'none';
    player.src = item.src;
    row.append(player);
  }
  row.append(status);

  const run = async (then) => {
    if (!(await access([item.src]))) { status.textContent = t.denied; return; }
    dl.disabled = conv.disabled = true;
    try {
      await then(await getMedia(item, index, (s) => { status.textContent = s; }));
    } catch (err) {
      status.textContent = err instanceof MediaError ? err.message : t.failed;
    } finally {
      dl.disabled = conv.disabled = false;
    }
  };
  dl.addEventListener('click', () => run(({ blob, name: n }) => {
    save(blob, n);
    status.textContent = t.saved(n, formatBytes(blob.size)) + (n.endsWith('.ts') ? ` ${t.savedTs}` : '');
  }));
  conv.addEventListener('click', () => run(async ({ blob, name: n }) => {
    if (!canHandOff(blob.size)) { save(blob, n); status.textContent = t.tooBig; return; }
    const tool = item.kind === 'audio' || blob.type.startsWith('audio/') ? 'audio-convert' : 'video-convert';
    const base64 = bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
    await chrome.runtime.sendMessage({ type: 'open-tool', tool, payload: { kind: 'file', name: n, type: blob.type || 'application/octet-stream', base64 } });
    status.textContent = '';
  }));
  return row;
}

$('rows-video').replaceChildren(...videos.map((m, i) => mediaRow(m, i)));
$('rows-audio').replaceChildren(...audios.map((m, i) => mediaRow(m, i)));
