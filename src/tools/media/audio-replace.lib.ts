// Remove or Replace Audio. Removing is a copy of the video with the audio left
// out. Replacing copies the video as is and encodes the new audio (looped to
// fill the video, or played once) up to the video's length.
import { loadMediabunny, ensureAudioEncoder } from '@/services/media/mediabunny.service';
import type { EncodeProgress } from './encode.lib';
import { convertTo, outputExtFor, probeMedia, aacBitrate, STALL_MS, FIRST_PROGRESS_MS } from './mb-media.lib';
import { MediaInputError } from './run-media.lib';
import { SparseFileWriter } from './sparse-writer.lib';

/** How many times the new audio plays, and where it's cut (the video's end). */
export function audioPlan(audioSec: number, videoSec: number, loop: boolean): { repeats: number; cutAtSec: number } {
  const repeats = loop && audioSec > 0 ? Math.max(1, Math.ceil(videoSec / audioSec)) : 1;
  return { repeats, cutAtSec: videoSec };
}

/**
 * Keeps the copied video at most `leadSec` ahead of the encoded audio. The
 * muxer holds every sample until both tracks reach it, so an unpaced video copy
 * (fast) would pile up in memory behind the audio encoder (slow).
 */
export function createPacer(leadSec: number) {
  let audioTs = -Infinity;
  let ended = false;
  let waiters: { ts: number; resolve: () => void }[] = [];
  const release = () => {
    waiters = waiters.filter(w => {
      if (ended || w.ts - audioTs <= leadSec) { w.resolve(); return false; }
      return true;
    });
  };
  return {
    /** Resolves when the video packet at `ts` may be written. */
    video(ts: number): Promise<void> {
      if (ended || ts - Math.max(audioTs, 0) <= leadSec) return Promise.resolve();
      return new Promise(resolve => { waiters.push({ ts, resolve }); });
    },
    /** The audio has been written up to `ts`. */
    audio(ts: number): void { audioTs = Math.max(audioTs, ts); release(); },
    /** No more audio is coming. */
    audioDone(): void { ended = true; release(); },
  };
}

export type ReplaceExt = 'mp4' | 'mov' | 'webm' | 'mkv';

/** Container and audio codec for a video with new audio: WebM keeps WebM + Opus, others carry AAC. */
export function replaceTarget(videoCodec: string, inputExt: string): { ext: ReplaceExt; audioCodec: 'aac' | 'opus' } {
  const ext = inputExt.toLowerCase();
  if (ext === 'webm' && ['vp8', 'vp9', 'av1'].includes(videoCodec)) return { ext: 'webm', audioCodec: 'opus' };
  if (ext === 'mkv') return { ext: 'mkv', audioCodec: 'aac' };
  if (ext === 'mov') return { ext: 'mov', audioCodec: 'aac' };
  return { ext: 'mp4', audioCodec: 'aac' };
}

const MIME: Record<ReplaceExt, string> = { mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska' };
const extOf = (f: File) => f.name.split('.').pop() || '';
const abortError = () => new DOMException('Cancelled', 'AbortError');

/** The video with its audio left out (a copy — nothing re-encoded). */
export async function mbMute(file: File, onProgress?: EncodeProgress, signal?: AbortSignal): Promise<{ blob: Blob; ext: string }> {
  const probe = await probeMedia(file);
  if (!probe.audio) throw new MediaInputError('no-audio');
  if (!probe.video) throw new MediaInputError('no-video');
  const ext = outputExtFor(extOf(file));
  const blob = await convertTo(file, ext, { audio: { discard: true } }, onProgress, signal);
  return { blob, ext };
}

/**
 * The video (copied) with `audio`'s sound instead, encoded to AAC or Opus and
 * cut at the video's end; looped to fill it when `loop` is on.
 */
export async function mbReplaceAudio(video: File, audio: File, opts: { loop: boolean }, onProgress?: EncodeProgress, signal?: AbortSignal): Promise<{ blob: Blob; ext: string }> {
  if (signal?.aborted) throw abortError();
  const mb = await loadMediabunny();
  const vIn = new mb.Input({ source: new mb.BlobSource(video), formats: mb.ALL_FORMATS });
  const aIn = new mb.Input({ source: new mb.BlobSource(audio), formats: mb.ALL_FORMATS });
  try {
    const vTrack = await vIn.getPrimaryVideoTrack();
    if (!vTrack) throw new MediaInputError('no-video');
    const aTrack = await aIn.getPrimaryAudioTrack();
    if (!aTrack) throw new MediaInputError('no-audio-file');
    if (!(await aTrack.canDecode())) throw new Error('mb-cannot-decode-audio');
    const vCodec = await vTrack.getCodec();
    if (!vCodec) throw new Error('mb-unknown-video');
    const target = replaceTarget(vCodec, extOf(video));
    if (target.audioCodec === 'aac') await ensureAudioEncoder('aac');

    const videoStart = await vTrack.getFirstTimestamp();
    const videoSec = (await vTrack.computeDuration()) - videoStart;
    const audioStart = await aTrack.getFirstTimestamp();
    const audioSec = (await aTrack.computeDuration()) - audioStart;
    const plan = audioPlan(audioSec, videoSec, opts.loop);
    const channels = await aTrack.getNumberOfChannels();

    const out = new SparseFileWriter();
    const format = target.ext === 'webm' ? new mb.WebMOutputFormat()
      : target.ext === 'mkv' ? new mb.MkvOutputFormat()
      : target.ext === 'mov' ? new mb.MovOutputFormat({ fastStart: false })
      : new mb.Mp4OutputFormat({ fastStart: false });
    const output = new mb.Output({ format, target: new mb.StreamTarget(new WritableStream({ write(c) { out.write(c.data, c.position); } })) });
    const vSource = new mb.EncodedVideoPacketSource(vCodec);
    output.addVideoTrack(vSource, { rotation: await vTrack.getRotation() });
    const aSource = new mb.AudioSampleSource({ codec: target.audioCodec, bitrate: target.audioCodec === 'aac' ? aacBitrate(128_000, channels) : 128_000 });
    output.addAudioTrack(aSource);
    await output.start();

    // Watchdog, as in convert(): stop a job that makes no progress.
    let timer: ReturnType<typeof setTimeout> | undefined;
    let giveUp: (e: Error) => void = () => {};
    const watchdog = new Promise<never>((_, reject) => { giveUp = reject; });
    const arm = (ms: number) => { clearTimeout(timer); timer = setTimeout(() => giveUp(new Error('mb-stalled')), ms); };
    const onAbort = () => giveUp(abortError());
    signal?.addEventListener('abort', onAbort, { once: true });
    arm(FIRST_PROGRESS_MS);

    const pacer = createPacer(1);
    const copyVideo = async () => {
      const config = await vTrack.getDecoderConfig();
      let first = true;
      for await (const packet of new mb.EncodedPacketSink(vTrack).packets()) {
        if (signal?.aborted) throw abortError();
        await pacer.video(packet.timestamp - videoStart);
        await vSource.add(packet, first && config ? { decoderConfig: config } : undefined);
        first = false;
        arm(STALL_MS);
        if (videoSec > 0) onProgress?.(Math.min(0.99, (packet.timestamp - videoStart) / videoSec));
      }
      vSource.close();
    };
    const encodeAudio = async () => {
      const cut = videoStart + plan.cutAtSec;
      outer: for (let k = 0; k < plan.repeats; k++) {
        for await (const sample of new mb.AudioSampleSink(aTrack).samples()) {
          if (signal?.aborted) { sample.close(); throw abortError(); }
          const at = videoStart + k * audioSec + (sample.timestamp - audioStart);
          if (at >= cut) { sample.close(); break outer; }
          sample.setTimestamp(at);
          try {
            await aSource.add(sample);
          } finally {
            sample.close();
          }
          pacer.audio(at - videoStart);
          arm(STALL_MS);
        }
      }
      pacer.audioDone();
      aSource.close();
    };
    try {
      const audioJob = encodeAudio().finally(() => pacer.audioDone());
      await Promise.race([Promise.all([copyVideo(), audioJob]), watchdog]);
      await Promise.race([output.finalize(), watchdog]);
    } catch (e) {
      await output.cancel().catch(() => {});
      throw e;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
    if (out.size === 0) throw new Error('mb-empty');
    onProgress?.(1);
    return { blob: out.toBlob(MIME[target.ext]), ext: target.ext };
  } finally {
    vIn.dispose?.();
    aIn.dispose?.();
  }
}

/** ffmpeg arguments to drop the audio (copy everything else). */
export function ffmpegMuteArgs(ext: string): string[] {
  return ['-i', 'in', '-map', '0', '-map', '-0:a', '-c', 'copy', `out.${ext}`];
}

/** ffmpeg arguments to replace the audio with `aud` (AAC), looped when asked, cut at the video's end. */
export function ffmpegReplaceArgs(loop: boolean, videoSec: number): string[] {
  return ['-i', 'in', ...(loop ? ['-stream_loop', '-1'] : []), '-i', 'aud', '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', ...(videoSec > 0 ? ['-t', String(videoSec)] : ['-shortest']), 'out.mp4'];
}
