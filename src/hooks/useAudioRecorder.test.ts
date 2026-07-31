import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudioRecorder } from './useAudioRecorder';

const trackStop = vi.fn();
const track = { stop: trackStop };

class FakeStream {
  getTracks() { return [track]; }
}

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  state = 'inactive';
  constructor(public stream: unknown) { FakeMediaRecorder.instances.push(this); }
  start() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['x'], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

function mockAudioDevices(getUserMedia = vi.fn().mockResolvedValue(new FakeStream())) {
  Object.defineProperty(global.navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  });
  (global as unknown as { MediaRecorder: unknown }).MediaRecorder = FakeMediaRecorder;
}

beforeEach(() => { trackStop.mockClear(); FakeMediaRecorder.instances = []; mockAudioDevices(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('useAudioRecorder', () => {
  it('start() acquires the mic and enters the recording state', async () => {
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => { await result.current.start(); });
    expect(result.current.recording).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('stop() finalizes a blob and releases the mic tracks', async () => {
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => { await result.current.start(); });
    await act(async () => { result.current.stop(); });
    expect(result.current.recording).toBe(false);
    expect(result.current.blob).toBeInstanceOf(Blob);
    expect(trackStop).toHaveBeenCalled();
  });

  it('maps a blocked mic to the "denied" reason', async () => {
    const err = Object.assign(new Error('no'), { name: 'NotAllowedError' });
    mockAudioDevices(vi.fn().mockRejectedValue(err));
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => { await result.current.start(); });
    expect(result.current.error?.reason).toBe('denied');
    expect(result.current.recording).toBe(false);
  });

  it('reports "unsupported" when mediaDevices is missing', async () => {
    Object.defineProperty(global.navigator, 'mediaDevices', { configurable: true, value: undefined });
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => { await result.current.start(); });
    expect(result.current.error?.reason).toBe('unsupported');
  });

  it('reset() clears the blob and error', async () => {
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => { await result.current.start(); });
    await act(async () => { result.current.stop(); });
    act(() => { result.current.reset(); });
    expect(result.current.blob).toBeNull();
    expect(result.current.seconds).toBe(0);
  });
});
