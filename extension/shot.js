// Shows the last full-page screenshot: download it, or hand it to a site tool.
import { pickLang } from './lib/menus.js';
import { loadShot } from './lib/recordings-db.js';
import { formatBytes, canHandOff } from './lib/recording.js';
import { bytesToBase64 } from './lib/handoff-store.js';

const T = {
  en: { title: 'Full-page screenshot', download: 'Download PNG', annotate: 'Annotate', compress: 'Compress', pdf: 'Save as PDF', none: 'No screenshot found.', cut: 'Very long page — the screenshot stops at the browser’s image size limit.', big: 'This screenshot is large — download it, then open it in the tool.', local: 'Saved on this device only; nothing was uploaded.' },
  id: { title: 'Tangkapan layar satu halaman penuh', download: 'Unduh PNG', annotate: 'Anotasi', compress: 'Kompres', pdf: 'Simpan sebagai PDF', none: 'Tangkapan layar tidak ditemukan.', cut: 'Halaman sangat panjang — tangkapan layar berhenti di batas ukuran gambar browser.', big: 'Tangkapan layar ini besar — unduh dulu, lalu buka di tool-nya.', local: 'Hanya tersimpan di perangkat ini; tidak ada yang diunggah.' },
};
const $ = (id) => document.getElementById(id);
const { gwtLang } = await chrome.storage.local.get('gwtLang');
const t = T[pickLang(gwtLang, chrome.i18n.getUILanguage())];
for (const k of ['title', 'download', 'annotate', 'compress', 'pdf']) $(k).textContent = t[k];

const shot = await loadShot().catch(() => null);
if (!shot?.blob?.size) {
  $('meta').textContent = t.none;
  document.querySelectorAll('.actions > *').forEach((el) => { el.hidden = true; });
} else {
  const url = URL.createObjectURL(shot.blob);
  const safe = (shot.title || 'page').replace(/[^\w.-]+/g, '-').slice(0, 60) || 'page';
  const name = `${safe}-full-page.png`;
  $('img').src = url;
  $('download').href = url;
  $('download').download = name;
  $('meta').textContent = `${shot.width}×${shot.height} px · ${formatBytes(shot.blob.size)} · ${t.local}`;
  const notes = [];
  if (shot.truncated) notes.push(t.cut);
  const small = canHandOff(shot.blob.size);
  if (!small) notes.push(t.big);
  $('note').textContent = notes.join(' ');
  document.querySelectorAll('button[data-tool]').forEach((b) => {
    b.disabled = !small;
    b.addEventListener('click', async () => {
      const base64 = bytesToBase64(new Uint8Array(await shot.blob.arrayBuffer()));
      await chrome.runtime.sendMessage({ type: 'open-tool', tool: b.dataset.tool, payload: { kind: 'file', name, type: 'image/png', base64 } });
    });
  });
}
