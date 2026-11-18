// HLS / TS to MP4: join MPEG-TS segments (dropped files, or an unencrypted,
// finished .m3u8 stream) and re-pack them into one MP4 — a copy, nothing is
// re-encoded. Encrypted and live streams are refused; nothing is decrypted.
// The playlist reader is shared with the Chrome extension.
import { parseM3u8 } from '../../../extension/lib/page-helpers.js';
import type { EncodeProgress } from './encode.lib';
import { convertTo } from './mb-media.lib';
import { MediaInputError } from './run-media.lib';

export type HlsReason = 'encrypted' | 'live' | 'empty' | 'network' | 'not-hls' | 'separate-audio' | 'byterange';

export class HlsError extends MediaInputError {
  constructor(readonly reason: HlsReason) { super(`hls-${reason}`); }
}

/** Segments in the order they play: seg1, seg2 … seg10 (natural sort by name). */
export function sortSegments(files: File[]): File[] {
  return [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
}

const abortError = () => new DOMException('Cancelled', 'AbortError');

async function get(url: string, signal?: AbortSignal): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch (e) {
    if (signal?.aborted) throw abortError();
    throw new HlsError('network'); // a blocked (CORS) or unreachable site
  }
  if (!res.ok) throw new HlsError('network');
  return res;
}

interface Playlist { type: 'master' | 'media'; variants?: { url: string; separateAudio?: boolean }[]; segments?: string[]; init?: string | null; encrypted?: boolean; live?: boolean; byterange?: boolean }

/** Download an HLS stream (best quality) and join its parts in order. */
export async function fetchHls(url: string, onProgress: (done: number, total: number) => void, signal?: AbortSignal): Promise<Blob> {
  const read = async (u: string) => parseM3u8(await (await get(u, signal)).text(), u) as Playlist | null;
  let pl = await read(url);
  if (pl?.type === 'master') {
    const best = pl.variants?.[0];
    if (!best) throw new HlsError('empty');
    if (best.separateAudio) throw new HlsError('separate-audio'); // joined video alone would be silent
    pl = await read(best.url);
  }
  if (!pl || pl.type !== 'media') throw new HlsError('not-hls');
  if (pl.encrypted) throw new HlsError('encrypted');
  if (pl.live) throw new HlsError('live');
  if (pl.byterange) throw new HlsError('byterange');
  const segments = pl.segments ?? [];
  if (!segments.length) throw new HlsError('empty');
  const parts: Blob[] = [];
  if (pl.init) parts.push(await (await get(pl.init, signal)).blob());
  for (let i = 0; i < segments.length; i++) {
    if (signal?.aborted) throw abortError();
    parts.push(await (await get(segments[i], signal)).blob());
    onProgress(i + 1, segments.length);
  }
  return new Blob(parts, { type: pl.init ? 'video/mp4' : 'video/mp2t' });
}

/** Joined segments → one MP4, copying the streams (lost-track check and stall watchdog included). */
export function toMp4(joined: Blob, onProgress?: EncodeProgress, signal?: AbortSignal): Promise<Blob> {
  return convertTo(joined, 'mp4', {}, onProgress, signal);
}

/** ffmpeg arguments for the same copy (compatibility path). */
export const FFMPEG_TS_TO_MP4 = ['-i', 'in', '-c', 'copy', '-bsf:a', 'aac_adtstoasc', '-movflags', '+faststart', 'out.mp4'];

/** A file name for the result: the first segment's or the playlist's name, as .mp4. */
export function mp4Name(source: string): string {
  const last = source.split(/[?#]/)[0].split('/').pop() || 'video';
  return `${decodeURIComponent(last).replace(/\.[^.]+$/, '') || 'video'}.mp4`;
}
