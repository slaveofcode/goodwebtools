// Video Frame Grabber: still frames from a video at exact times. Decoded with
// mediabunny (WebCodecs, exact frames) when the browser can decode the video,
// otherwise with a hidden <video> element seek — both stay on the device.
import { loadMediabunny } from '@/services/media/mediabunny.service';
import { probeMedia } from './mb-media.lib';

export type FrameFormat = 'png' | 'jpg' | 'webp';

/** "Every N seconds" never makes more than this many frames. */
export const MAX_FRAMES = 300;
const MIN_STEP = 0.1;

/** Times for "a frame every N seconds": 0, N, 2N… before the end, at most `max`. */
export function frameTimes(durationSec: number, everySec: number, max = MAX_FRAMES): { times: number[]; capped: boolean } {
  const step = Math.max(MIN_STEP, everySec || 0);
  const times: number[] = [];
  for (let i = 0; ; i++) {
    const t = Math.round(i * step * 1000) / 1000;
    if (!(t < durationSec)) return { times, capped: false };
    if (times.length >= max) return { times, capped: true };
    times.push(t);
  }
}

/** clip, 3.5, 'png' → 'clip-00m03.500s.png'. */
export function frameFileName(base: string, timeSec: number, ext: FrameFormat): string {
  const ms = Math.round(Math.max(0, timeSec) * 1000);
  const m = Math.floor(ms / 60000);
  const s = ((ms % 60000) / 1000).toFixed(3).padStart(6, '0');
  return `${base}-${String(m).padStart(2, '0')}m${s}s.${ext}`;
}

const MIME: Record<FrameFormat, string> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };
const QUALITY = 0.92;
const abortError = () => new DOMException('Cancelled', 'AbortError');

async function canvasToBlob(c: HTMLCanvasElement | OffscreenCanvas, fmt: FrameFormat): Promise<Blob> {
  const type = MIME[fmt];
  if ('convertToBlob' in c) return c.convertToBlob({ type, quality: QUALITY });
  return new Promise((resolve, reject) => c.toBlob(b => (b ? resolve(b) : reject(new Error('encode'))), type, QUALITY));
}

/** Frames at `times` (seconds) via mediabunny; the picture is shown upright (rotation applied). */
async function framesWithMediabunny(file: Blob, times: number[], fmt: FrameFormat, onFrame: (i: number, blob: Blob) => void, signal?: AbortSignal) {
  const mb = await loadMediabunny();
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error('no-video');
    const first = await track.getFirstTimestamp();
    const sink = new mb.CanvasSink(track, { poolSize: 2 });
    for (let i = 0; i < times.length; i++) {
      if (signal?.aborted) throw abortError();
      const frame = await sink.getCanvas(Math.max(first, times[i]));
      if (!frame) throw new Error('no-frame');
      onFrame(i, await canvasToBlob(frame.canvas, fmt));
    }
  } finally {
    input.dispose?.();
  }
}

/** Frames at `times` via a hidden <video>: seek, wait for the frame, draw it. */
async function framesWithVideoElement(file: Blob, times: number[], fmt: FrameFormat, onFrame: (i: number, blob: Blob) => void, signal?: AbortSignal) {
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  video.playsInline = true;
  const url = URL.createObjectURL(file);
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error('decode'));
    });
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    for (let i = 0; i < times.length; i++) {
      if (signal?.aborted) throw abortError();
      await new Promise<void>((resolve, reject) => {
        video.onseeked = () => resolve();
        video.onerror = () => reject(new Error('decode'));
        video.currentTime = Math.min(times[i], Math.max(0, video.duration - 0.001));
      });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      onFrame(i, await canvasToBlob(canvas, fmt));
    }
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}

/**
 * Save frames at `times`. Uses mediabunny when the browser can decode the
 * video, else a <video> element. Returns which way it ran.
 */
export async function grabFrames(file: File, times: number[], fmt: FrameFormat, onFrame: (i: number, blob: Blob) => void, signal?: AbortSignal): Promise<'mediabunny' | 'video-element'> {
  const probe = await probeMedia(file).catch(() => null);
  if (probe?.video && probe.decodable && typeof VideoDecoder !== 'undefined') {
    try {
      await framesWithMediabunny(file, times, fmt, onFrame, signal);
      return 'mediabunny';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
      // fall through: try the browser's own player
    }
  }
  await framesWithVideoElement(file, times, fmt, onFrame, signal);
  return 'video-element';
}

/** Frames per second of the video's main track (for ±1 frame steps); 30 when unknown. */
export async function videoFrameRate(file: File): Promise<number> {
  try {
    const mb = await loadMediabunny();
    const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
    try {
      const track = await input.getPrimaryVideoTrack();
      const rate = track ? (await track.computePacketStats(60)).averagePacketRate : 0;
      return rate > 1 && rate < 1000 ? rate : 30;
    } finally {
      input.dispose?.();
    }
  } catch {
    return 30;
  }
}
