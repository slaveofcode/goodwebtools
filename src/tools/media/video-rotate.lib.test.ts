import { describe, it, expect } from 'vitest';
import { addRotation, rotateOutput, ffmpegRotateArgs } from './video-rotate.lib';

describe('addRotation', () => {
  it.each([[0, 90, 90], [90, 90, 180], [270, 180, 90], [270, 90, 0], [0, 0, 0]] as const)('%s + %s → %s', (a, b, out) => {
    expect(addRotation(a, b)).toBe(out);
  });
});

describe('rotateOutput', () => {
  it('keeps MOV as MOV and writes everything else as MP4 (WebM has no rotation field)', () => {
    expect(rotateOutput('MOV')).toEqual({ ext: 'mov', mime: 'video/quicktime' });
    expect(rotateOutput('webm')).toEqual({ ext: 'mp4', mime: 'video/mp4' });
    expect(rotateOutput('mp4')).toEqual({ ext: 'mp4', mime: 'video/mp4' });
  });
});

describe('ffmpegRotateArgs', () => {
  it('turns the picture with transpose filters and resets the rotation field', () => {
    const a = ffmpegRotateArgs(90, false);
    expect(a).toEqual(expect.arrayContaining(['-vf', 'transpose=1', '-c:v', 'libx264', '-c:a', 'copy', '-metadata:s:v:0', 'rotate=0']));
    expect(ffmpegRotateArgs(270, false)).toContain('transpose=2');
    expect(ffmpegRotateArgs(180, true)).toContain('transpose=1,transpose=1,hflip');
    expect(ffmpegRotateArgs(0, true)).toContain('hflip');
  });
});
