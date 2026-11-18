// Shows the last recording: preview, download, and one-click handoff to the
// site's video tools. Everything stays on this device.
import { pickLang } from './lib/menus.js';
import { loadRecording } from './lib/recordings-db.js';
import { formatDuration, formatBytes, recordingFileName, canHandOff, gifPlan } from './lib/recording.js';
import { GIFEncoder, quantize, applyPalette } from './vendor/gifenc.js';
import { bytesToBase64 } from './lib/handoff-store.js';
import { remuxWebm, hasAudio, canEncodeMp4, encodeMp4 } from './lib/transmux.js';

const T = {
  en: { title: 'Your recording', download: 'Download (.webm)', gif: 'Download GIF', gifWorking: (p) => `Making the GIF… ${p}%`, gifDone: (s) => `GIF saved (${s}).`, gifCut: (n) => ` Only the first ${n} seconds are included.`, gifFailed: 'Couldn’t make a GIF from this recording.', mp4: 'Download MP4', mp4Working: (p) => `Making the MP4… ${p}%`, mp4Done: (s) => `MP4 saved (${s}).`, mp4Failed: 'Couldn’t make an MP4 here — use “Convert to MP4” instead.', toMp4: 'Convert to MP4', toGif: 'Make a GIF', compress: 'Compress', none: 'No recording found.', big: 'This recording is large — download it, then open it in the tool.', local: 'Saved on this device only; nothing was uploaded.' },
  id: { title: 'Rekaman Anda', download: 'Unduh (.webm)', gif: 'Unduh GIF', gifWorking: (p) => `Membuat GIF… ${p}%`, gifDone: (s) => `GIF tersimpan (${s}).`, gifCut: (n) => ` Hanya ${n} detik pertama yang disertakan.`, gifFailed: 'GIF tidak bisa dibuat dari rekaman ini.', mp4: 'Unduh MP4', mp4Working: (p) => `Membuat MP4… ${p}%`, mp4Done: (s) => `MP4 tersimpan (${s}).`, mp4Failed: 'MP4 tidak bisa dibuat di sini — pakai “Ubah ke MP4”.', toMp4: 'Ubah ke MP4', toGif: 'Buat GIF', compress: 'Kompres', none: 'Rekaman tidak ditemukan.', big: 'Rekaman ini besar — unduh dulu, lalu buka di tool-nya.', local: 'Hanya tersimpan di perangkat ini; tidak ada yang diunggah.' },
};
const $ = (id) => document.getElementById(id);
const { gwtLang } = await chrome.storage.local.get('gwtLang');
const t = T[pickLang(gwtLang, chrome.i18n.getUILanguage())];
for (const k of ['title', 'download', 'gif', 'mp4', 'toMp4', 'toGif', 'compress']) $(k).textContent = t[k];

const rec = await loadRecording().catch(() => null);
let fixed = Promise.resolve();
if (!rec?.blob?.size) {
  $('meta').textContent = t.none;
  document.querySelectorAll('.actions > *').forEach((el) => { el.hidden = true; });
} else {
  const url = URL.createObjectURL(rec.blob);
  const name = recordingFileName(new Date(rec.at));
  $('video').src = url;
  $('download').href = url;
  $('download').download = name;
  // MediaRecorder writes the WebM in slices, without a duration or seek index:
  // re-pack it (a copy, instant) so players show its length and can seek.
  // If that isn't possible the original stays.
  fixed = remuxWebm(rec.blob).then((better) => {
    if (!better) return;
    rec.blob = better;
    const u = URL.createObjectURL(better);
    $('download').href = u;
    $('video').src = u;
    URL.revokeObjectURL(url);
  }).finally(() => { $('download').dataset.ready = '1'; });
  $('meta').textContent = `${name} · ${formatDuration(rec.durationMs)} · ${formatBytes(rec.blob.size)} · ${t.local}`;
  const small = canHandOff(rec.blob.size);
  if (!small) $('note').textContent = t.big;
  document.querySelectorAll('button[data-tool]').forEach((b) => {
    b.disabled = !small;
    b.addEventListener('click', async () => {
      await fixed; // hand over the re-packed file once it's ready
      const base64 = bytesToBase64(new Uint8Array(await rec.blob.arrayBuffer()));
      await chrome.runtime.sendMessage({ type: 'open-tool', tool: b.dataset.tool, payload: { kind: 'file', name, type: rec.blob.type || 'video/webm', base64 } });
    });
  });
}

/**
 * Make an animated GIF in this page: play the recording muted and fast, grab a
 * frame every 1/fps seconds of video time, quantize each to 256 colours.
 */
async function makeGif(blob, durationMs, onProgress) {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.src = URL.createObjectURL(blob);
  await new Promise((ok, fail) => { video.onloadedmetadata = ok; video.onerror = () => fail(new Error('load')); });
  const plan = gifPlan(video.videoWidth, video.videoHeight, durationMs);
  const canvas = new OffscreenCanvas(plan.width, plan.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const gif = GIFEncoder();
  const step = 1 / plan.fps;
  let next = 0;
  let pending = null; // previous frame, written once we know how long it shows
  const flush = (until) => {
    if (!pending) return;
    gif.writeFrame(pending.index, plan.width, plan.height, { palette: pending.palette, delay: Math.max(20, Math.round((until - pending.at) * 1000)) });
    pending = null;
  };
  await new Promise((done, fail) => {
    const onFrame = (_now, meta) => {
      const tm = meta.mediaTime;
      if (tm >= plan.seconds) { video.pause(); done(); return; }
      if (tm + 1e-3 >= next) {
        ctx.drawImage(video, 0, 0, plan.width, plan.height);
        const { data } = ctx.getImageData(0, 0, plan.width, plan.height);
        const palette = quantize(data, 256);
        flush(tm);
        pending = { index: applyPalette(data, palette), palette, at: tm };
        next = tm + step;
        onProgress(Math.min(99, Math.round((tm / plan.seconds) * 100)));
      }
      video.requestVideoFrameCallback(onFrame);
    };
    video.requestVideoFrameCallback(onFrame);
    video.onended = () => done();
    video.onerror = () => fail(new Error('decode'));
    video.playbackRate = 4;
    video.play().catch(fail);
  });
  flush((pending?.at ?? 0) + step);
  gif.finish();
  URL.revokeObjectURL(video.src);
  return { blob: new Blob([gif.bytes()], { type: 'image/gif' }), truncated: plan.truncated, seconds: plan.seconds };
}

if (rec?.blob?.size) {
  $('gif').addEventListener('click', async () => {
    $('gif').disabled = true;
    try {
      const { blob, truncated, seconds } = await makeGif(rec.blob, rec.durationMs, (p) => { $('gifStatus').textContent = t.gifWorking(p); });
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: recordingFileName(new Date(rec.at), 'gif') });
      a.click();
      $('gifStatus').textContent = t.gifDone(formatBytes(blob.size)) + (truncated ? t.gifCut(seconds) : '');
    } catch {
      $('gifStatus').textContent = t.gifFailed;
    } finally {
      $('gif').disabled = false;
    }
  });
}

// "Download MP4": made right here when the browser has the encoders built in
// (H.264, and AAC if the recording has sound). Otherwise "Convert to MP4" hands
// the file to the site's Video Converter, which has its own encoders.
if (rec?.blob?.size) {
  (async () => {
    await fixed;
    const sound = await hasAudio(rec.blob);
    if (sound === null || !(await canEncodeMp4(sound))) return;
    $('mp4').hidden = false;
    $('toMp4').hidden = true;
    $('mp4').addEventListener('click', async () => {
      $('mp4').disabled = true;
      $('gifStatus').textContent = t.mp4Working(0);
      const mp4 = await encodeMp4(rec.blob, sound, (p) => { $('gifStatus').textContent = t.mp4Working(Math.round(p * 100)); });
      $('mp4').disabled = false;
      if (!mp4) { $('gifStatus').textContent = t.mp4Failed; $('toMp4').hidden = false; return; }
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(mp4), download: recordingFileName(new Date(rec.at), 'mp4') });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
      $('gifStatus').textContent = t.mp4Done(formatBytes(mp4.size));
    });
  })();
}

