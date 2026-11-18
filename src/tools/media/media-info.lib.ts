// Media Info: everything a file says about itself — container, length, bitrate
// and each track's codec, size, frame rate, rotation, sample rate and channels,
// plus tags and cover art. Read with mediabunny (no decoding, no WebCodecs).
import { loadMediabunny } from '@/services/media/mediabunny.service';
import { readMediaTags, type MediaTags } from './mb-media.lib';
import { MediaInputError } from './run-media.lib';

export interface TrackInfo {
  kind: 'video' | 'audio' | 'subtitle' | 'other';
  codec: string;
  codecString: string | null;
  language: string | null;
  bitrate: number | null;
  width?: number;
  height?: number;
  displayWidth?: number;
  displayHeight?: number;
  rotation?: 0 | 90 | 180 | 270;
  frameRate?: number;
  sampleRate?: number;
  channels?: number;
}

export interface MediaInfo {
  fileName: string;
  size: number;
  mime: string;
  container: string;
  durationSec: number;
  bitrate: number | null;
  tracks: TrackInfo[];
  tags: MediaTags;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Read a media file's details. Throws MediaInputError('unsupported') for a container it can't read. */
export async function readMediaInfo(file: File): Promise<MediaInfo> {
  const mb = await loadMediabunny();
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
  try {
    let format;
    try { format = await input.getFormat(); } catch { throw new MediaInputError('unsupported'); }
    const durationSec = await input.computeDuration().catch(() => 0);
    const tracks: TrackInfo[] = [];
    for (const t of await input.getTracks()) {
      const type: string = t.type;
      const base: TrackInfo = {
        kind: type === 'video' || type === 'audio' || type === 'subtitle' ? type : 'other',
        codec: (await t.getCodec()) ?? 'unknown',
        codecString: await t.getCodecParameterString().catch(() => null),
        language: ((await t.getLanguageCode()) || '').replace(/^und$/, '') || null,
        bitrate: (await t.getBitrate()) ?? (await t.getAverageBitrate().catch(() => null)) ?? null,
      };
      if (t.isVideoTrack()) {
        const stats = await t.computePacketStats(100).catch(() => null);
        Object.assign(base, {
          width: await t.getCodedWidth(),
          height: await t.getCodedHeight(),
          displayWidth: await t.getDisplayWidth(),
          displayHeight: await t.getDisplayHeight(),
          rotation: (await t.getRotation()) as 0 | 90 | 180 | 270,
          ...(stats?.averagePacketRate ? { frameRate: round2(stats.averagePacketRate) } : {}),
        });
      } else if (t.isAudioTrack()) {
        Object.assign(base, { sampleRate: await t.getSampleRate(), channels: await t.getNumberOfChannels() });
      }
      tracks.push(base);
    }
    return {
      fileName: file.name,
      size: file.size,
      mime: await input.getMimeType().catch(() => file.type || ''),
      container: format.name,
      durationSec,
      bitrate: durationSec > 0 ? Math.round((file.size * 8) / durationSec) : null,
      tracks,
      tags: await readMediaTags(file),
    };
  } finally {
    input.dispose?.();
  }
}

const CODECS: Record<string, string> = {
  avc: 'H.264', hevc: 'H.265 (HEVC)', vp8: 'VP8', vp9: 'VP9', av1: 'AV1', aac: 'AAC', opus: 'Opus', mp3: 'MP3',
  vorbis: 'Vorbis', flac: 'FLAC', ac3: 'AC-3', eac3: 'E-AC-3', alac: 'ALAC', ulaw: 'G.711 µ-law', alaw: 'G.711 A-law',
  'pcm-s16': 'PCM 16-bit', 'pcm-s24': 'PCM 24-bit', 'pcm-s32': 'PCM 32-bit', 'pcm-f32': 'PCM 32-bit float', 'pcm-u8': 'PCM 8-bit',
  webvtt: 'WebVTT',
};

/** A codec id as people know it (avc → H.264). */
export function codecName(codec: string): string {
  return CODECS[codec] ?? codec;
}

/** 3 → '0:03.00', 3723.5 → '1:02:03.50'. */
export function humanDuration(sec: number): string {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = (s % 60).toFixed(2).padStart(5, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`;
}

const kbps = (bps: number | null | undefined) => (bps ? `${Math.round(bps / 1000)} kb/s` : null);
const bytes = (n: number) => (n >= 1 << 20 ? `${(n / (1 << 20)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Sections of [label, value] rows, in display order. */
export function mediaInfoRows(info: MediaInfo): { title: string; rows: [string, string][] }[] {
  const keep = (rows: [string, string | null | undefined][]) => rows.filter((r): r is [string, string] => !!r[1]);
  const out = [{
    title: 'General',
    rows: keep([
      ['File', info.fileName], ['Size', bytes(info.size)], ['Container', info.container], ['Type', info.mime],
      ['Duration', info.durationSec ? humanDuration(info.durationSec) : null], ['Overall bitrate', kbps(info.bitrate)],
    ]),
  }];
  const counts: Record<string, number> = {};
  for (const t of info.tracks) {
    counts[t.kind] = (counts[t.kind] ?? 0) + 1;
    const name = { video: 'Video', audio: 'Audio', subtitle: 'Subtitle', other: 'Other' }[t.kind];
    out.push({
      title: `${name} track ${counts[t.kind]}`,
      rows: keep([
        ['Codec', t.codecString ? `${codecName(t.codec)} (${t.codecString})` : codecName(t.codec)],
        ['Resolution', t.width ? `${t.width} × ${t.height}` : null],
        ['Displayed as', t.displayWidth && (t.displayWidth !== t.width || t.displayHeight !== t.height) ? `${t.displayWidth} × ${t.displayHeight}` : null],
        ['Rotation', t.rotation ? `${t.rotation}°` : null],
        ['Frame rate', t.frameRate ? `${t.frameRate} fps` : null],
        ['Sample rate', t.sampleRate ? `${t.sampleRate} Hz` : null],
        ['Channels', t.channels ? String(t.channels) : null],
        ['Bitrate', kbps(t.bitrate)],
        ['Language', t.language],
      ]),
    });
  }
  const tg = info.tags;
  const tagRows = keep([['Title', tg.title], ['Artist', tg.artist], ['Album', tg.album], ['Year', tg.year], ['Cover', tg.picture ? `${tg.picture.mime}, ${bytes(tg.picture.data.length)}` : null]]);
  if (tagRows.length) out.push({ title: 'Tags', rows: tagRows });
  return out;
}

/** Plain text: a heading per section, then "Key: value" lines. */
export function formatMediaInfo(info: MediaInfo): string {
  return mediaInfoRows(info).map(s => [s.title, ...s.rows.map(([k, v]) => `${k}: ${v}`)].join('\n')).join('\n\n');
}

/** Pretty JSON; the cover's bytes are replaced by their size. */
export function mediaInfoJson(info: MediaInfo): string {
  const { picture, ...tags } = info.tags;
  return JSON.stringify({ ...info, tags: { ...tags, ...(picture ? { picture: { mime: picture.mime, bytes: picture.data.length } } : {}) } }, null, 2);
}
