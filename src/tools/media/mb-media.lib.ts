// Media jobs on mediabunny (WebCodecs, hardware-accelerated, streaming). Each
// runner has the same shape as its ffmpeg twin in encode.lib — file in, Blob
// out, progress 0–1, cancellable — so the tool pages can swap engines freely.
import { loadMediabunny, ensureAudioEncoder, getEncodeCaps } from '@/services/media/mediabunny.service';
import { computeTargetBitrate, planResolution, sizeRetryKbps } from './video-compress.lib';
import type { EncodeProgress } from './encode.lib';
import { MediaInputError } from './run-media.lib';

type Mb = typeof import('mediabunny');
type OutExt = 'mp4' | 'mov' | 'webm' | 'mkv' | 'mp3' | 'wav' | 'ogg' | 'flac' | 'm4a' | 'opus';

export interface MediaProbe {
  container: string;
  durationSec: number;
  /** Whether this browser can decode every track (needed to re-encode). */
  decodable: boolean;
  video: { codec: string; width: number; height: number; rotation: 0 | 90 | 180 | 270 } | null;
  audio: { codec: string; sampleRate: number; channels: number } | null;
}

/** Where an audio track goes when kept as is (no re-encode). */
export function audioCopyTarget(codec: string): { ext: 'm4a' | 'ogg' | 'mp3' | 'flac' | 'wav'; format: 'mp4' | 'ogg' | 'mp3' | 'flac' | 'wav' } | null {
  if (codec === 'aac') return { ext: 'm4a', format: 'mp4' };
  if (codec === 'opus' || codec === 'vorbis') return { ext: 'ogg', format: 'ogg' };
  if (codec === 'mp3') return { ext: 'mp3', format: 'mp3' };
  if (codec === 'flac') return { ext: 'flac', format: 'flac' };
  if (codec.startsWith('pcm-') || codec === 'ulaw' || codec === 'alaw') return { ext: 'wav', format: 'wav' };
  return null;
}

/** Output container for a trim: the input's own when mediabunny can write it. */
export function outputExtFor(inputExt: string): OutExt {
  const e = inputExt.toLowerCase();
  const map: Record<string, OutExt> = { mp4: 'mp4', m4v: 'mp4', mov: 'mov', webm: 'webm', mkv: 'mkv', mp3: 'mp3', wav: 'wav', ogg: 'ogg', oga: 'ogg', opus: 'ogg', flac: 'flac', m4a: 'm4a', aac: 'm4a' };
  return map[e] ?? 'mp4';
}

const MIME: Record<OutExt, string> = {
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska', mp3: 'audio/mpeg',
  wav: 'audio/wav', ogg: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac', m4a: 'audio/mp4',
};

function outputFormat(mb: Mb, ext: OutExt) {
  switch (ext) {
    case 'mp4': case 'm4a': return new mb.Mp4OutputFormat({ fastStart: 'in-memory' });
    case 'mov': return new mb.MovOutputFormat({ fastStart: 'in-memory' });
    case 'webm': return new mb.WebMOutputFormat();
    case 'mkv': return new mb.MkvOutputFormat();
    case 'mp3': return new mb.Mp3OutputFormat();
    case 'wav': return new mb.WavOutputFormat();
    case 'ogg': case 'opus': return new mb.OggOutputFormat();
    case 'flac': return new mb.FlacOutputFormat();
  }
}

const extOf = (file: Blob) => ((file as File).name?.split('.').pop() || '').toLowerCase();
const abortError = () => new DOMException('Cancelled', 'AbortError');

function openInput(mb: Mb, file: Blob) {
  return new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
}

type ConvertOpts = Omit<import('mediabunny').ConversionOptions, 'input' | 'output'>;

/** Run one mediabunny conversion into memory; progress 0–1; abort → AbortError. */
async function convert(file: Blob, ext: OutExt, opts: ConvertOpts, onProgress?: EncodeProgress, signal?: AbortSignal): Promise<Blob> {
  if (signal?.aborted) throw abortError();
  const mb = await loadMediabunny();
  const input = openInput(mb, file);
  const output = new mb.Output({ format: outputFormat(mb, ext), target: new mb.BufferTarget() });
  try {
    const conversion = await mb.Conversion.init({ input, output, showWarnings: false, ...opts });
    if (!conversion.isValid) {
      throw new Error(`mb-invalid: ${conversion.discardedTracks.map(d => d.reason).join(', ') || 'no usable tracks'}`);
    }
    conversion.onProgress = (p: number) => onProgress?.(Math.min(1, Math.max(0, p)));
    const onAbort = () => { void conversion.cancel(); };
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      await conversion.execute();
    } catch (e) {
      if (signal?.aborted) throw abortError();
      throw e;
    } finally {
      signal?.removeEventListener('abort', onAbort);
    }
    if (signal?.aborted) throw abortError();
    const buf = output.target.buffer;
    if (!buf || buf.byteLength === 0) throw new Error('mb-empty');
    return new Blob([buf], { type: MIME[ext] });
  } finally {
    input.dispose?.();
  }
}

/** Container, duration and tracks of a media file — and whether the browser can decode it. */
export async function probeMedia(file: Blob): Promise<MediaProbe> {
  const mb = await loadMediabunny();
  const input = openInput(mb, file);
  try {
    const [format, durationSec, vt, at] = await Promise.all([
      input.getFormat(), input.computeDuration(), input.getPrimaryVideoTrack(), input.getPrimaryAudioTrack(),
    ]);
    const video = vt ? {
      codec: (await vt.getCodec()) ?? 'unknown',
      width: await vt.getSquarePixelWidth(),
      height: await vt.getSquarePixelHeight(),
      rotation: (await vt.getRotation()) as 0 | 90 | 180 | 270,
    } : null;
    const audio = at ? {
      codec: (await at.getCodec()) ?? 'unknown',
      sampleRate: await at.getSampleRate(),
      channels: await at.getNumberOfChannels(),
    } : null;
    const decodable = (vt ? await vt.canDecode() : true) && (at ? await at.canDecode() : true);
    return { container: format.name, durationSec, decodable, video, audio };
  } finally {
    input.dispose?.();
  }
}

export interface MbCompressOpts { targetBytes: number; durationSec: number; maxWidth: number; audioKbps: number }

/**
 * Compress toward a target size as MP4 (H.264 + AAC). Lowers the resolution when
 * the budget is small, and re-runs once at a lower bitrate if the hardware
 * encoder overshoots the target by more than 2%.
 */
export async function mbCompressVideo(file: Blob, opts: MbCompressOpts, onProgress?: EncodeProgress, signal?: AbortSignal): Promise<{ blob: Blob; attempts: number; width: number; height: number }> {
  const probe = await probeMedia(file);
  if (!probe.video) throw new Error('mb-no-video');
  const keepAudio = !!probe.audio && opts.audioKbps > 0;
  const plan = computeTargetBitrate({ targetBytes: opts.targetBytes, durationSec: opts.durationSec, audioKbps: keepAudio ? opts.audioKbps : 0 });
  if (plan.audioKbps > 0) await ensureAudioEncoder('aac');

  const run = async (videoKbps: number) => {
    const size = planResolution(probe.video!, videoKbps, opts.maxWidth);
    const blob = await convert(file, 'mp4', {
      video: { codec: 'avc', bitrate: videoKbps * 1000, width: size.width, height: size.height, fit: 'contain', forceTranscode: true },
      audio: plan.audioKbps > 0 ? { codec: 'aac', bitrate: plan.audioKbps * 1000, forceTranscode: true } : { discard: true },
    }, onProgress, signal);
    return { blob, ...size };
  };

  let out = await run(plan.videoKbps);
  const retry = sizeRetryKbps(opts.targetBytes, out.blob.size, plan.videoKbps);
  if (retry === null) return { ...out, attempts: 1 };
  out = await run(retry);
  return { ...out, attempts: 2 };
}

/** Cut [start, end] without re-encoding where possible (mediabunny re-encodes only what accuracy needs). */
export async function mbTrim(file: Blob, opts: { startSec: number; endSec: number }, onProgress?: EncodeProgress, signal?: AbortSignal): Promise<{ blob: Blob; ext: string }> {
  const ext = outputExtFor(extOf(file));
  const blob = await convert(file, ext, { trim: { start: opts.startSec, end: opts.endSec } }, onProgress, signal);
  return { blob, ext };
}

/** The audio track of a video: kept as is ('original', lossless) or re-encoded to MP3. */
export async function mbExtractAudio(
  file: Blob,
  opts: { as: 'original' | 'mp3'; trimStart?: number; trimDuration?: number },
  onProgress?: EncodeProgress,
  signal?: AbortSignal,
): Promise<{ blob: Blob; ext: string }> {
  const probe = await probeMedia(file);
  if (!probe.audio) throw new MediaInputError('no-audio');
  const trim = trimOpts(opts.trimStart ?? 0, opts.trimDuration ?? 0);
  const copy = opts.as === 'original' ? audioCopyTarget(probe.audio.codec) : null;
  if (copy) {
    const blob = await convert(file, copy.format === 'mp4' ? 'm4a' : copy.format, { video: { discard: true }, ...trim }, onProgress, signal);
    return { blob, ext: copy.ext };
  }
  await ensureAudioEncoder('mp3');
  const blob = await convert(file, 'mp3', { video: { discard: true }, audio: { codec: 'mp3', bitrate: 192_000 }, ...trim }, onProgress, signal);
  return { blob, ext: 'mp3' };
}

/** `{ trim }` for a start/length pair (0 length = to the end), or nothing when there's no trim. */
function trimOpts(start: number, length: number): Pick<ConvertOpts, 'trim'> {
  if (!(start > 0) && !(length > 0)) return {};
  return { trim: { start, ...(length > 0 ? { end: start + length } : {}) } };
}

export interface MbConvertVideoOpts {
  format: 'mp4' | 'webm' | 'mov' | 'mkv';
  quality: 'high' | 'medium' | 'low';
  /** 0 keeps the source width. */
  maxWidth: number;
  muted: boolean;
  trimStart: number;
  /** 0 = to the end. */
  trimDuration: number;
}

/** The Video Converter's CRF slider (18–40) as a mediabunny quality preset. */
export function qualityFromCrf(crf: number): 'high' | 'medium' | 'low' {
  return crf <= 20 ? 'high' : crf <= 28 ? 'medium' : 'low';
}

/** Convert a video between MP4, WebM, MOV and MKV. "High" with no resize copies streams when the target container allows it. */
export async function mbConvertVideo(file: Blob, opts: MbConvertVideoOpts, onProgress?: EncodeProgress, signal?: AbortSignal): Promise<Blob> {
  const mb = await loadMediabunny();
  const caps = await getEncodeCaps();
  const webm = opts.format === 'webm';
  const vcodec = webm ? (['vp9', 'av1', 'vp8'] as const).find(c => caps?.video.has(c)) : 'avc';
  if (!vcodec) throw new Error('mb-no-encoder');
  const acodec = webm ? 'opus' : 'aac';
  if (!opts.muted && acodec === 'aac') await ensureAudioEncoder('aac');
  const quality = { high: mb.QUALITY_HIGH, medium: mb.QUALITY_MEDIUM, low: mb.QUALITY_LOW }[opts.quality];
  const reencode = opts.quality !== 'high' || opts.maxWidth > 0;
  return convert(file, opts.format, {
    video: { codec: vcodec, quality, ...(opts.maxWidth > 0 ? { width: Math.round(opts.maxWidth / 2) * 2 } : {}), forceTranscode: reencode },
    audio: opts.muted ? { discard: true } : { codec: acodec, quality, forceTranscode: reencode },
    ...trimOpts(opts.trimStart, opts.trimDuration),
  }, onProgress, signal);
}

export interface MbConvertAudioOpts { format: 'mp3' | 'm4a' | 'opus' | 'flac' | 'wav'; kbps: number; trimStart: number; trimDuration: number }

/** Convert audio between MP3, M4A (AAC), Opus, FLAC and WAV. */
export async function mbConvertAudio(file: Blob, opts: MbConvertAudioOpts, onProgress?: EncodeProgress, signal?: AbortSignal): Promise<Blob> {
  const codec = { mp3: 'mp3', m4a: 'aac', opus: 'opus', flac: 'flac', wav: 'pcm-s16' }[opts.format] as import('mediabunny').AudioCodec;
  if (codec === 'mp3' || codec === 'aac') await ensureAudioEncoder(codec);
  const lossy = codec === 'mp3' || codec === 'aac' || codec === 'opus';
  return convert(file, opts.format, {
    video: { discard: true },
    audio: { codec, ...(lossy ? { bitrate: opts.kbps * 1000 } : {}), forceTranscode: true },
    ...trimOpts(opts.trimStart, opts.trimDuration),
  }, onProgress, signal);
}
