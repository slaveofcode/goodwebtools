// Shows the last recording: preview, download, and one-click handoff to the
// site's video tools. Everything stays on this device.
import { pickLang } from './lib/menus.js';
import { loadRecording } from './lib/recordings-db.js';
import { formatDuration, formatBytes, recordingFileName, canHandOff } from './lib/recording.js';
import { bytesToBase64 } from './lib/handoff-store.js';

const T = {
  en: { title: 'Your recording', download: 'Download (.webm)', toMp4: 'Convert to MP4', toGif: 'Make a GIF', compress: 'Compress', none: 'No recording found.', big: 'This recording is large — download it, then open it in the tool.', local: 'Saved on this device only; nothing was uploaded.' },
  id: { title: 'Rekaman Anda', download: 'Unduh (.webm)', toMp4: 'Ubah ke MP4', toGif: 'Buat GIF', compress: 'Kompres', none: 'Rekaman tidak ditemukan.', big: 'Rekaman ini besar — unduh dulu, lalu buka di tool-nya.', local: 'Hanya tersimpan di perangkat ini; tidak ada yang diunggah.' },
};
const $ = (id) => document.getElementById(id);
const { gwtLang } = await chrome.storage.local.get('gwtLang');
const t = T[pickLang(gwtLang, chrome.i18n.getUILanguage())];
for (const k of ['title', 'download', 'toMp4', 'toGif', 'compress']) $(k).textContent = t[k];

const rec = await loadRecording().catch(() => null);
if (!rec?.blob?.size) {
  $('meta').textContent = t.none;
  document.querySelectorAll('.actions > *').forEach((el) => { el.hidden = true; });
} else {
  const url = URL.createObjectURL(rec.blob);
  const name = recordingFileName(new Date(rec.at));
  $('video').src = url;
  $('download').href = url;
  $('download').download = name;
  $('meta').textContent = `${name} · ${formatDuration(rec.durationMs)} · ${formatBytes(rec.blob.size)} · ${t.local}`;
  const small = canHandOff(rec.blob.size);
  if (!small) $('note').textContent = t.big;
  document.querySelectorAll('button[data-tool]').forEach((b) => {
    b.disabled = !small;
    b.addEventListener('click', async () => {
      const base64 = bytesToBase64(new Uint8Array(await rec.blob.arrayBuffer()));
      await chrome.runtime.sendMessage({ type: 'open-tool', tool: b.dataset.tool, payload: { kind: 'file', name, type: rec.blob.type || 'video/webm', base64 } });
    });
  });
}
