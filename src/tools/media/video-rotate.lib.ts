// Rotate Video: turn a video 90/180/270° (and optionally mirror it) without
// re-encoding — the rotation is written into the file's metadata, which
// players apply. "Bake in" re-encodes the picture for players that ignore it.
import type { EncodeProgress } from './encode.lib';
import { convertTo } from './mb-media.lib';

export type Turn = 0 | 90 | 180 | 270;

/** Rotations add up, clockwise, modulo 360. */
export function addRotation(current: Turn, add: Turn): Turn {
  return ((current + add) % 360) as Turn;
}

/** Container for the result: MOV stays MOV, everything else becomes MP4 (WebM can't store a rotation). */
export function rotateOutput(inputExt: string): { ext: 'mp4' | 'mov'; mime: string } {
  return inputExt.toLowerCase() === 'mov' ? { ext: 'mov', mime: 'video/quicktime' } : { ext: 'mp4', mime: 'video/mp4' };
}

/** ffmpeg arguments (between the input and the output name) that bake the turn into the picture. */
export function ffmpegRotateArgs(turn: Turn, flip: boolean): string[] {
  const filters = [{ 0: '', 90: 'transpose=1', 180: 'transpose=1,transpose=1', 270: 'transpose=2' }[turn], flip ? 'hflip' : ''].filter(Boolean);
  return [
    ...(filters.length ? ['-vf', filters.join(',')] : []),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'copy', '-metadata:s:v:0', 'rotate=0',
  ];
}

export interface RotateOpts { turn: Turn; flip: boolean; bake: boolean }

/** Rotate with mediabunny: metadata only (a copy) unless `bake`, which re-encodes to H.264. */
export async function mbRotate(file: File, opts: RotateOpts, onProgress?: EncodeProgress, signal?: AbortSignal): Promise<{ blob: Blob; ext: string }> {
  const out = rotateOutput(file.name.split('.').pop() || '');
  const { loadMediabunny } = await import('@/services/media/mediabunny.service');
  const mb = await loadMediabunny();
  const blob = await convertTo(file, out.ext, {
    video: {
      rotate: opts.turn,
      flip: opts.flip,
      allowTransformationMetadata: !opts.bake,
      ...(opts.bake ? { codec: 'avc' as const, bitrate: mb.QUALITY_HIGH, forceTranscode: true } : {}),
    },
    audio: {},
  }, onProgress, signal);
  return { blob, ext: out.ext };
}
