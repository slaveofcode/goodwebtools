// MediaRecorder wrapper used by the offscreen document: records a stream in
// 1-second slices and returns the finished WebM blob on stop.
import { pickMimeType } from './recording.js';

export function recordStream(stream) {
  const type = pickMimeType((t) => MediaRecorder.isTypeSupported(t));
  const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const startedAt = Date.now();
  recorder.start(1000);
  return {
    startedAt,
    async stop() {
      const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
      if (recorder.state !== 'inactive') recorder.stop();
      await stopped;
      const mime = (recorder.mimeType || type || 'video/webm').split(';')[0];
      return { blob: new Blob(chunks, { type: mime }), durationMs: Date.now() - startedAt };
    },
  };
}
