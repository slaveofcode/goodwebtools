import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useInstallPrompt } from './useInstallPrompt';

beforeEach(() => {
  (window as unknown as { __gwtInstall?: unknown }).__gwtInstall = { evt: null };
});

describe('useInstallPrompt', () => {
  it('is not promptable with no captured event', () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canPrompt).toBe(false);
    expect(result.current.installed).toBe(false);
  });

  it('reports canPrompt once a beforeinstallprompt is captured', () => {
    const { result } = renderHook(() => useInstallPrompt());
    act(() => {
      (window as unknown as { __gwtInstall: { evt: unknown } }).__gwtInstall.evt = {
        prompt: async () => {},
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      };
      window.dispatchEvent(new Event('gwt-installable'));
    });
    expect(result.current.canPrompt).toBe(true);
  });

  it('clears promptability once installed', () => {
    const { result } = renderHook(() => useInstallPrompt());
    act(() => {
      (window as unknown as { __gwtInstall: { evt: unknown } }).__gwtInstall.evt = { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'accepted' }) };
      window.dispatchEvent(new Event('gwt-installable'));
    });
    expect(result.current.canPrompt).toBe(true);
    act(() => { window.dispatchEvent(new Event('gwt-installed')); });
    expect(result.current.installed).toBe(true);
    expect(result.current.canPrompt).toBe(false);
  });
});
