// Offscreen document: the only place in the extension with a DOM, so it does the
// actual getUserMedia work — a canvas grab for screenshots, and MediaRecorder
// for tab/screen recordings.
import { recordStream } from './lib/recorder.js';
import { saveRecording } from './lib/recordings-db.js';

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.target !== 'offscreen') return;
  const work = msg.type === 'grab' ? grab(msg.streamId)
    : msg.type === 'rec-start' ? startRecording(msg)
    : msg.type === 'rec-stop' ? stopRecording()
    : null;
  if (!work) return;
  work.then((res) => sendResponse(res)).catch((e) => sendResponse({ error: e.message || String(e) }));
  return true; // async
});

async function grab(streamId) {
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        // Legacy mandatory constraints are how a desktopCapture streamId is consumed.
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: streamId,
        },
      },
    });

    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    // One frame is enough; give the stream a beat to deliver dimensions.
    await new Promise((r) => setTimeout(r, 120));

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) throw new Error('empty-frame');

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/png');
    return { dataUrl, width: w, height: h };
  } finally {
    if (stream) stream.getTracks().forEach((t) => t.stop());
  }
}

// --- Recording ----------------------------------------------------------------
let rec = null; // { session, streams, audioCtx }

/** Legacy mandatory constraints are how tabCapture / desktopCapture stream ids are consumed. */
function sourceConstraints(source, streamId, withAudio) {
  const m = { chromeMediaSource: source, chromeMediaSourceId: streamId };
  return { video: { mandatory: { ...m, maxFrameRate: 30 } }, audio: withAudio ? { mandatory: m } : false };
}

async function startRecording({ source, streamId, mic }) {
  if (rec) throw new Error('already-recording');
  let captured;
  try {
    captured = await navigator.mediaDevices.getUserMedia(sourceConstraints(source, streamId, true));
  } catch {
    // Screen/window shares often come without audio; record the picture alone.
    captured = await navigator.mediaDevices.getUserMedia(sourceConstraints(source, streamId, false));
  }
  const streams = [captured];
  const audioCtx = new AudioContext();
  const mix = audioCtx.createMediaStreamDestination();
  if (captured.getAudioTracks().length) {
    const src = audioCtx.createMediaStreamSource(captured);
    src.connect(mix);
    // Capturing a tab mutes it for the user; play its sound back so they still hear it.
    if (source === 'tab') src.connect(audioCtx.destination);
  }
  if (mic) {
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streams.push(micStream);
      audioCtx.createMediaStreamSource(micStream).connect(mix);
    } catch { /* microphone not allowed — record without it */ }
  }
  // Record the mixed audio only when there is some (tab/system sound and/or the mic).
  const hasAudio = captured.getAudioTracks().length > 0 || streams.length > 1;
  const tracks = [...captured.getVideoTracks(), ...(hasAudio ? mix.stream.getAudioTracks() : [])];
  rec = { session: recordStream(new MediaStream(tracks)), streams, audioCtx };
  // The user can end a screen share from Chrome's own "Stop sharing" bar.
  captured.getVideoTracks()[0]?.addEventListener('ended', () => {
    if (rec) chrome.runtime.sendMessage({ type: 'rec-ended' }).catch(() => {});
  });
  return { ok: true, startedAt: rec.session.startedAt };
}

async function stopRecording() {
  if (!rec) throw new Error('not-recording');
  const r = rec;
  rec = null;
  const { blob, durationMs } = await r.session.stop();
  r.streams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
  await r.audioCtx.close().catch(() => {});
  await saveRecording({ blob, type: blob.type, durationMs, at: Date.now() });
  return { ok: true, size: blob.size, durationMs };
}
