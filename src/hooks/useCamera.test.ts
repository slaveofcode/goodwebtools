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
});
