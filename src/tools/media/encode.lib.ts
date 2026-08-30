/**
 * ffmpeg.wasm encode operations for the media tools, extracted from the islands
 * so both the interactive UI (VideoCompress / MediaTrim) and the headless agent
 * executors run the exact same encode paths. The pure planning math stays in
 * video-compress.lib / trim.lib; this module owns the side-effectful ffmpeg work
 * (writeFile → exec → readFile) and dynamic-imports the wasm service so the
 * island/executor chunks stay small.
 *
 * The functions take an explicit `durationSec` (probed by the caller via
 * getMediaDuration) so the encode math is DOM-free and unit-testable with a
 * mocked ffmpeg service — the real duration probe needs a media element.
 */
import { computeTargetBitrate } from './video-compress.lib';
import { clampTrim } from './trim.lib';

export type EncodeProgress = (fraction: number) => void;

/** Read a media file's duration (seconds) from its metadata, in the browser. */
export function getMediaDuration(file: Blob): Promise<number> {
  return new Promise(resolve => {
    if (typeof document === 'undefined') { resolve(0); return; }
    const el = document.createElement('video');
    const url = URL.createObjectURL(file);
    el.preload = 'metadata';
    el.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(el.duration || 0); };
    el.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
    el.src = url;
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function withFFmpeg<T>(file: Blob, onProgress: EncodeProgress | undefined, work: (ffmpeg: any) => Promise<T>): Promise<T> {
  const { loadFFmpeg, fileToU8 } = await import('@/services/ffmpeg.service');
  const ffmpeg = await loadFFmpeg();
  const cb = ({ progress }: { progress: number }) => onProgress?.(Math.min(1, progress));
  ffmpeg.on('progress', cb);
  try {
    try {
      // Reads the whole file into memory then copies it into the WASM heap
      // (~2× the file size). On phones this overruns the tab's memory budget for
      // large videos and throws a cryptic NotReadableError — surface a clear one.
      await ffmpeg.writeFile('in', await fileToU8(file));
    } catch {
      throw new Error('This file is too large to load in your browser — it ran out of memory. Try a shorter/smaller clip, or use the desktop app.');
    }
    return await work(ffmpeg);
  } finally {
    ffmpeg.off('progress', cb);
  }
}

export interface CompressVideoOpts {
  targetBytes: number;
  durationSec: number;
  /** Scale down so width ≤ maxWidth (keeps aspect); 0 keeps the source size. */
  maxWidth?: number;
  /** Requested audio bitrate in kbps; 0 drops audio. Default 128. */
  audioKbps?: number;
}

/** Build the x264 single-pass argument list for a compress-to-size job. */
export function videoCompressArgs(videoKbps: number, audioKbps: number, maxWidth: number): string[] {
  const args = ['-i', 'in'];
  if (maxWidth > 0) args.push('-vf', `scale='min(${maxWidth},iw)':-2:flags=lanczos`);
  args.push(
    '-c:v', 'libx264',
    '-b:v', `${videoKbps}k`,
    '-maxrate', `${videoKbps}k`,
    '-bufsize', `${videoKbps * 2}k`,
    '-preset', 'veryfast',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
  );
  if (audioKbps > 0) args.push('-c:a', 'aac', '-b:a', `${audioKbps}k`);
  else args.push('-an');
  args.push('out.mp4');
  return args;
}

/** Compress a video toward a target size. Returns an mp4 blob. */
export async function compressVideo(file: Blob, opts: CompressVideoOpts, onProgress?: EncodeProgress): Promise<Blob> {
  const plan = computeTargetBitrate({
    targetBytes: opts.targetBytes,
    durationSec: opts.durationSec,
    audioKbps: opts.audioKbps ?? 128,
  });
  const args = videoCompressArgs(plan.videoKbps, plan.audioKbps, opts.maxWidth ?? 0);
  return withFFmpeg(file, onProgress, async ffmpeg => {
    await ffmpeg.exec(args);
    const data = await ffmpeg.readFile('out.mp4');
    return new Blob([data], { type: 'video/mp4' });
  });
}

/** kbps for an mp3 that lands near `targetBytes` over `durationSec`, clamped to a sane range. */
export function computeAudioKbps(targetBytes: number, durationSec: number): number {
  if (!(durationSec > 0)) throw new Error('durationSec must be > 0');
  const raw = Math.floor((targetBytes * 8) / durationSec / 1000);
  return Math.min(320, Math.max(32, raw));
}

export interface CompressAudioOpts { targetBytes: number; durationSec: number }

/** Re-encode an audio file to a smaller mp3 near the target size. Returns an mp3 blob. */
export async function compressAudio(file: Blob, opts: CompressAudioOpts, onProgress?: EncodeProgress): Promise<Blob> {
  const kbps = computeAudioKbps(opts.targetBytes, opts.durationSec);
  const args = ['-i', 'in', '-c:a', 'libmp3lame', '-b:a', `${kbps}k`, 'out.mp3'];
  return withFFmpeg(file, onProgress, async ffmpeg => {
    await ffmpeg.exec(args);
    const data = await ffmpeg.readFile('out.mp3');
    return new Blob([data], { type: 'audio/mpeg' });
  });
}

/** Extract the audio track from a video as an mp3. Returns an mp3 blob. */
export async function extractAudio(file: Blob, onProgress?: EncodeProgress): Promise<Blob> {
  const args = ['-i', 'in', '-vn', '-c:a', 'libmp3lame', '-q:a', '2', 'out.mp3'];
  return withFFmpeg(file, onProgress, async ffmpeg => {
    await ffmpeg.exec(args);
    const data = await ffmpeg.readFile('out.mp3');
    return new Blob([data], { type: 'audio/mpeg' });
  });
}

export interface VideoFormatSpec { id: 'mp4' | 'webm' | 'mov'; mime: string; vcodec: string; acodec: string }
export const VIDEO_FORMATS: VideoFormatSpec[] = [
  { id: 'mp4', mime: 'video/mp4', vcodec: 'libx264', acodec: 'aac' },
  { id: 'webm', mime: 'video/webm', vcodec: 'libvpx-vp9', acodec: 'libopus' },
  { id: 'mov', mime: 'video/quicktime', vcodec: 'libx264', acodec: 'aac' },
];

export interface ConvertVideoOpts {
  format: 'mp4' | 'webm' | 'mov';
  /** CRF quality (lower = better/larger). Default 23. */
  crf?: number;
  /** Scale to this width (keeps aspect); 0 keeps the source size. */
  scale?: number;
  muted?: boolean;
  trimStart?: number;
  trimDuration?: number;
}

/** Build the transcode argument list for a format conversion. */
export function videoConvertArgs(spec: VideoFormatSpec, crf: number, scale: number, muted: boolean, trimStart = 0, trimDuration = 0): string[] {
  const trim: string[] = [];
  if (trimStart > 0) trim.push('-ss', String(trimStart));
  if (trimDuration > 0) trim.push('-t', String(trimDuration));
  const args = [...trim, '-i', 'in'];
  if (scale > 0) args.push('-vf', `scale=${scale}:-2:flags=lanczos`);
  args.push('-c:v', spec.vcodec, '-crf', String(crf));
  if (spec.id === 'mp4' || spec.id === 'mov') args.push('-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart');
  if (spec.id === 'webm') args.push('-b:v', '0', '-row-mt', '1');
  if (muted) args.push('-an');
  else args.push('-c:a', spec.acodec, '-b:a', '128k');
  args.push(`out.${spec.id}`);
  return args;
}

/** Transcode a video to another container/codec. Returns a blob of that format. */
export async function convertVideo(file: Blob, opts: ConvertVideoOpts, onProgress?: EncodeProgress): Promise<Blob> {
  const spec = VIDEO_FORMATS.find(f => f.id === opts.format);
  if (!spec) throw new Error(`unsupported format: ${opts.format}`);
  const args = videoConvertArgs(spec, opts.crf ?? 23, opts.scale ?? 0, !!opts.muted, opts.trimStart ?? 0, opts.trimDuration ?? 0);
  return withFFmpeg(file, onProgress, async ffmpeg => {
    await ffmpeg.exec(args);
    const data = await ffmpeg.readFile(`out.${spec.id}`);
    return new Blob([data], { type: spec.mime });
  });
}

export interface GifOpts { fps?: number; width?: number; trimStart?: number; trimDuration?: number }

/** Convert a video to an optimized GIF (two-pass palettegen/paletteuse). */
export async function videoToGif(file: Blob, opts: GifOpts, onProgress?: EncodeProgress): Promise<Blob> {
  const fps = opts.fps ?? 12;
  const width = opts.width ?? 480;
  const filters = `fps=${fps},scale=${width}:-1:flags=lanczos`;
  const trim: string[] = [];
  if ((opts.trimStart ?? 0) > 0) trim.push('-ss', String(opts.trimStart));
  if ((opts.trimDuration ?? 0) > 0) trim.push('-t', String(opts.trimDuration));
  return withFFmpeg(file, onProgress, async ffmpeg => {
    await ffmpeg.exec([...trim, '-i', 'in', '-vf', `${filters},palettegen`, 'palette.png']);
    await ffmpeg.exec([...trim, '-i', 'in', '-i', 'palette.png', '-lavfi', `${filters} [x]; [x][1:v] paletteuse`, 'out.gif']);
    const data = await ffmpeg.readFile('out.gif');
    return new Blob([data], { type: 'image/gif' });
  });
}

export interface TrimOpts {
  startSec: number;
  endSec: number;
  durationSec: number;
  isVideo: boolean;
  /** Fast stream-copy cut (falls back to re-encode if it fails). Default true. */
  fast?: boolean;
  /** Output extension for the fast path (source container). Default mp4/mp3 by kind. */
  ext?: string;
}
export interface TrimResult { blob: Blob; ext: string }

function trimMime(ext: string, isVideo: boolean): string {
  if (isVideo) return `video/${ext === 'mov' ? 'quicktime' : ext}`;
  return `audio/${ext === 'mp3' ? 'mpeg' : ext}`;
}

/** Trim an audio/video file to [start, end]. Fast stream-copy with re-encode fallback. */
export async function trimMedia(file: Blob, opts: TrimOpts, onProgress?: EncodeProgress): Promise<TrimResult> {
  const { start, end } = clampTrim(opts.startSec, opts.endSec, opts.durationSec);
  const ext = (opts.ext || (opts.isVideo ? 'mp4' : 'mp3')).toLowerCase();
  const out = `out.${ext}`;
  const seek = ['-ss', String(start), '-to', String(end), '-i', 'in'];

  return withFFmpeg(file, onProgress, async ffmpeg => {
    const reencode = async (): Promise<TrimResult> => {
      const enc = opts.isVideo
        ? ['-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac']
        : ['-c:a', 'libmp3lame', '-q:a', '2'];
      const reOut = opts.isVideo ? out : 'out.mp3';
      const reExt = reOut.split('.').pop()!;
      await ffmpeg.exec([...seek, ...enc, reOut]);
      const data = await ffmpeg.readFile(reOut);
      return { blob: new Blob([data], { type: trimMime(reExt, opts.isVideo) }), ext: reExt };
    };

    if (opts.fast === false) return reencode();
    try {
      await ffmpeg.exec([...seek, '-c', 'copy', out]);
      const probe = await ffmpeg.readFile(out);
      if (!probe || (probe as Uint8Array).length === 0) throw new Error('empty');
      return { blob: new Blob([probe], { type: trimMime(ext, opts.isVideo) }), ext };
    } catch {
      return reencode(); // stream copy failed → fall back to a re-encode
    }
  });
}
