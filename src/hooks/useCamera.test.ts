import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCamera } from './useCamera';

const stop = vi.fn();
const track = { stop };
class FakeStream {
  getTracks() { return [track]; }
}

function mockMediaDevices(over: Partial<Record<string, unknown>> = {}) {
  Object.defineProperty(global.navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue(new FakeStream()),
      enumerateDevices: vi.fn().mockResolvedValue([
        { kind: 'videoinput' }, { kind: 'videoinput' }, { kind: 'audioinput' },
      ]),
      ...over,
    },
  });
}

beforeEach(() => { stop.mockClear(); mockMediaDevices(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('useCamera', () => {
  it('start() acquires a stream and detects multiple cameras', async () => {
    const { result } = renderHook(() => useCamera());
    await act(async () => { await result.current.start(); });
    expect(result.current.stream).not.toBeNull();
    expect(result.current.hasMultiple).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('stop() stops every track', async () => {
    const { result } = renderHook(() => useCamera());
    await act(async () => { await result.current.start(); });
    act(() => { result.current.stop(); });
    expect(stop).toHaveBeenCalled();
    expect(result.current.stream).toBeNull();
  });

  it('maps a denied permission to reason "denied"', async () => {
    const err = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    mockMediaDevices({ getUserMedia: vi.fn().mockRejectedValue(err) });
    const { result } = renderHook(() => useCamera());
    await act(async () => { await result.current.start(); });
    expect(result.current.error?.reason).toBe('denied');
  });

  it('reports "unsupported" when mediaDevices is missing', async () => {
    Object.defineProperty(global.navigator, 'mediaDevices', { configurable: true, value: undefined });
    const { result } = renderHook(() => useCamera());
    await act(async () => { await result.current.start(); });
    expect(result.current.error?.reason).toBe('unsupported');
  });

  it('switchCamera() flips facingMode', async () => {
    const { result } = renderHook(() => useCamera());
    await act(async () => { await result.current.start(); });
    expect(result.current.facingMode).toBe('environment');
    await act(async () => { await result.current.switchCamera(); });
    expect(result.current.facingMode).toBe('user');
  });

  it('releases the current camera before opening the next (no device-busy error)', async () => {
    const track1 = { stop: vi.fn() };
    const gum = vi.fn().mockImplementation(() => Promise.resolve({ getTracks: () => [track1] }));
    mockMediaDevices({ getUserMedia: gum });
    const { result } = renderHook(() => useCamera());
    await act(async () => { await result.current.start(); });
    await act(async () => { await result.current.switchCamera(); });
    // The first stream's tracks must be stopped as part of switching.
    expect(track1.stop).toHaveBeenCalled();
  });

  it('recovers to the previous camera when the switch fails', async () => {
    let call = 0;
    const gum = vi.fn().mockImplementation(() => {
      call += 1;
      if (call === 2) return Promise.reject(Object.assign(new Error('busy'), { name: 'NotReadableError' }));
      return Promise.resolve(new FakeStream());
    });
    mockMediaDevices({ getUserMedia: gum });
    const { result } = renderHook(() => useCamera());
    await act(async () => { await result.current.start(); });        // env ok
    await act(async () => { await result.current.switchCamera(); });  // user fails -> revert to env
    expect(result.current.facingMode).toBe('environment');
    expect(result.current.stream).not.toBeNull();
    expect(result.current.error).toBeNull();
    expect(gum).toHaveBeenCalledTimes(3);
  });
});
