// Which engine runs a media job: mediabunny (WebCodecs, hardware, fast) when the
// browser can do it, otherwise the ffmpeg.wasm path that handles everything.
import type { EncodeCaps, VideoCodecKey, AudioCodecKey } from '@/services/media/mediabunny.service';

export type Engine = 'mediabunny' | 'ffmpeg';
export type EngineReason = 'ok' | 'container' | 'video-codec' | 'audio-codec' | 'no-webcodecs' | 'cannot-decode';

export interface MediaJob {
  kind: 'compress-video' | 'convert-video' | 'trim' | 'extract-audio' | 'convert-audio';
  /** Input file extension, e.g. 'mp4'. */
  inputExt: string;
  /** Video codec to encode; omitted when video is copied or dropped. */
  needVideo?: VideoCodecKey;
  /** Audio codec to encode, 'copy' to keep it as is, null to drop it. */
  needAudio?: AudioCodecKey | 'copy' | null;
  /** Whether the browser can decode the input (from probeMedia); copy-only jobs ignore it. */
  inputDecodable?: boolean;
}

/** Containers mediabunny reads. Everything else (AVI, WMV, FLV, VOB…) goes to ffmpeg. */
export const MB_READABLE_EXTS = ['mp4', 'm4v', 'mov', 'webm', 'mkv', 'mp3', 'wav', 'ogg', 'oga', 'opus', 'flac', 'aac', 'm4a', 'ts', 'mts'] as const;

export function chooseEngine(job: MediaJob, caps: EncodeCaps | null): { engine: Engine; reason: EngineReason } {
  const ffmpeg = (reason: EngineReason) => ({ engine: 'ffmpeg' as const, reason });
  if (!(MB_READABLE_EXTS as readonly string[]).includes(job.inputExt.toLowerCase())) return ffmpeg('container');
  const encodes = !!job.needVideo || (!!job.needAudio && job.needAudio !== 'copy');
  if (!encodes) return { engine: 'mediabunny', reason: 'ok' }; // copy only: no WebCodecs needed
  if (!caps) return ffmpeg('no-webcodecs');
  if (job.inputDecodable === false) return ffmpeg('cannot-decode');
  if (job.needVideo && !caps.video.has(job.needVideo)) return ffmpeg('video-codec');
  if (job.needAudio && job.needAudio !== 'copy' && !caps.audio.has(job.needAudio)) return ffmpeg('audio-codec');
  return { engine: 'mediabunny', reason: 'ok' };
}
