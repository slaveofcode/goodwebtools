// Mediabunny — the fast media engine. It reads/writes MP4, WebM, MKV, MP3, WAV,
// Ogg, FLAC… and encodes through the browser's WebCodecs, i.e. the device's own
// hardware encoder. Everything here is lazy: the library and the WASM audio
// encoder add-ons are only fetched when a media tool actually runs.

export type VideoCodecKey = 'avc' | 'hevc' | 'vp9' | 'av1' | 'vp8';
export type AudioCodecKey = 'aac' | 'opus' | 'mp3' | 'flac' | 'vorbis' | 'pcm';

export interface EncodeCaps {
  /** Video codecs this browser can encode. */
  video: Set<VideoCodecKey>;
  /** Audio codecs we can produce: native ones plus AAC/MP3 via the add-ons. */
  audio: Set<AudioCodecKey>;
  /** Audio codecs the browser encodes by itself (no add-on). */
  nativeAudio: Set<string>;
}

const VIDEO: VideoCodecKey[] = ['avc', 'hevc', 'vp9', 'av1', 'vp8'];
const AUDIO: { key: AudioCodecKey; codec: string }[] = [
  { key: 'aac', codec: 'aac' }, { key: 'opus', codec: 'opus' }, { key: 'mp3', codec: 'mp3' },
  { key: 'flac', codec: 'flac' }, { key: 'vorbis', codec: 'vorbis' }, { key: 'pcm', codec: 'pcm-s16' },
];

let libPromise: Promise<typeof import('mediabunny')> | null = null;
let capsPromise: Promise<EncodeCaps | null> | null = null;
const registered = new Set<string>();

/** The mediabunny module, imported once. */
export function loadMediabunny(): Promise<typeof import('mediabunny')> {
  if (!libPromise) libPromise = import('mediabunny');
  return libPromise;
}

/** Whether this browser has WebCodecs at all. */
function hasWebCodecs(): boolean {
  return typeof globalThis !== 'undefined'
    && typeof (globalThis as { VideoEncoder?: unknown }).VideoEncoder === 'function'
    && typeof (globalThis as { AudioEncoder?: unknown }).AudioEncoder === 'function';
}

/** What this browser can encode, probed once per session. Null without WebCodecs. */
export function getEncodeCaps(): Promise<EncodeCaps | null> {
  if (!capsPromise) {
    capsPromise = (async () => {
      if (!hasWebCodecs()) return null;
      const { canEncode } = await loadMediabunny();
      const probe = async (codec: string) => { try { return await canEncode(codec as never); } catch { return false; } };
      const video = new Set<VideoCodecKey>();
      for (const c of VIDEO) if (await probe(c)) video.add(c);
      const nativeAudio = new Set<string>();
      const audio = new Set<AudioCodecKey>(['aac', 'mp3']); // always reachable via the add-ons
      for (const { key, codec } of AUDIO) {
        if (await probe(codec)) { nativeAudio.add(key); audio.add(key); }
      }
      return { video, audio, nativeAudio };
    })();
  }
  return capsPromise;
}

/** Make sure we can encode AAC or MP3: register the WASM add-on when the browser can't natively. */
export async function ensureAudioEncoder(codec: 'aac' | 'mp3'): Promise<void> {
  if (registered.has(codec)) return;
  const caps = await getEncodeCaps();
  if (caps?.nativeAudio.has(codec)) { registered.add(codec); return; }
  if (codec === 'aac') (await import('@mediabunny/aac-encoder')).registerAacEncoder();
  else (await import('@mediabunny/mp3-encoder')).registerMp3Encoder();
  registered.add(codec);
}

/** Test hook: forget cached capabilities and registrations. */
export function __resetMediabunnyForTests(): void {
  capsPromise = null;
  registered.clear();
}
