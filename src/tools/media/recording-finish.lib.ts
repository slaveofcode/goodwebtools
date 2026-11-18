// Finishing touches for recordings made in the browser. MediaRecorder writes
// WebM/Ogg without a duration or seek index, so players show no length and
// can't jump around; re-packing (a copy — nothing is re-encoded) fixes that.
// A recording is never lost: if re-packing goes wrong, the original is kept.
import type { Engine } from './engine.lib';
import type { EncodeProgress } from './encode.lib';
// Everything heavy is imported on first use, so recorder pages stay light.

/**
 * `remux(blob)` when it gives a usable file, else `blob`. Never throws.
 * A result under half the original's size means a track was lost — keep the original.
 */
export async function fixRecording(blob: Blob, remux: (b: Blob) => Promise<Blob>): Promise<Blob> {
  try {
    const out = await remux(blob);
    if (!out || out.size === 0 || out.size < blob.size / 2) return blob;
    return out;
  } catch {
    return blob;
  }
}

/** Container of a MediaRecorder blob, by its MIME type. */
export function recordingExt(blob: Blob): 'webm' | 'ogg' | 'mp4' | null {
  const t = blob.type.toLowerCase();
  if (t.includes('webm')) return 'webm';
  if (t.includes('ogg')) return 'ogg';
  if (t.includes('mp4')) return 'mp4';
  return null;
}

/** Above this, re-packing (which holds a second copy in memory) could crash a phone tab — keep the original. */
export const MAX_REPACK_BYTES = 512 * 1024 * 1024;

/**
 * Re-pack a WebM/Ogg recording so it has a duration and seeks. Files that
 * already state their duration, very large files, and other formats pass through.
 */
export async function finishRecording(blob: Blob): Promise<Blob> {
  const ext = recordingExt(blob);
  if ((ext !== 'webm' && ext !== 'ogg') || blob.size > MAX_REPACK_BYTES) return blob;
  return fixRecording(blob, async b => {
    const { mbRemux, mbHasDuration } = await import('./mb-media.lib');
    if (await mbHasDuration(b)) return b;
    return mbRemux(b, ext);
  });
}

/** A recording as MP4 (H.264 + AAC): hardware encoder where the browser has one, else ffmpeg.wasm. */
export async function recordingToMp4(blob: Blob, hasAudio: boolean, onProgress: EncodeProgress, signal: AbortSignal): Promise<{ value: Blob; engine: Engine }> {
  const [{ runWithFallback }, { mbConvertVideo }, { convertVideo }] = await Promise.all([import('./run-media.lib'), import('./mb-media.lib'), import('./encode.lib')]);
  const r = await runWithFallback(
    { kind: 'convert-video', inputExt: recordingExt(blob) ?? 'webm', needVideo: 'avc', needAudio: hasAudio ? 'aac' : null },
    s => mbConvertVideo(blob, { format: 'mp4', quality: 'high', maxWidth: 0, muted: !hasAudio, trimStart: 0, trimDuration: 0 }, onProgress, s),
    () => convertVideo(blob, { format: 'mp4', crf: 20, muted: !hasAudio }, onProgress),
    signal,
  );
  return { value: r.value, engine: r.engine };
}
