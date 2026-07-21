// src/services/global-hotkeys.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockIsTauri = vi.fn(() => true);
vi.mock('./platform', () => ({ isTauri: () => mockIsTauri() }));

const mockHotkeyRegister = vi.fn();
const mockHotkeyUnregisterAll = vi.fn();
const mockHotkeyUnregister = vi.fn();
vi.mock('./hotkey', () => ({
  hotkeyService: {
    register: (...args: any[]) => mockHotkeyRegister(...args),
    unregisterAll: (...args: any[]) => mockHotkeyUnregisterAll(...args),
    unregister: (...args: any[]) => mockHotkeyUnregister(...args),
  },
}));

const mockCaptureScreen = vi.fn();
const mockListDisplays = vi.fn();
const mockShowRegionSelector = vi.fn();
const mockCaptureRegion = vi.fn();
vi.mock('./capture', () => ({
  captureService: {
    captureScreen: (...args: any[]) => mockCaptureScreen(...args),
    listDisplays: (...args: any[]) => mockListDisplays(...args),
    showRegionSelector: (...args: any[]) => mockShowRegionSelector(...args),
    captureRegion: (...args: any[]) => mockCaptureRegion(...args),
  },
}));

const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: any[]) => mockInvoke(...args) }));

const mockEmit = vi.fn();
vi.mock('@tauri-apps/api/event', () => ({ emit: (...args: any[]) => mockEmit(...args) }));

// ── Helpers ────────────────────────────────────────────────────────────────

function makeBlob(content = 'img'): Blob {
  return new Blob([content], { type: 'image/jpeg' });
}

// FileReader stub: immediately fires onloadend with a data URL
class FakeFileReader {
  result: string | null = null;
  onloadend: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;

  readAsDataURL(_blob: Blob) {
    this.result = 'data:image/jpeg;base64,FAKE';
    this.onloadend?.();
  }
}
(globalThis as any).FileReader = FakeFileReader;

// localStorage stub
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// ── Tests ──────────────────────────────────────────────────────────────────

describe('initializeGlobalHotkeys', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorageMock.clear();
    mockIsTauri.mockReturnValue(true);
    mockHotkeyUnregisterAll.mockResolvedValue(undefined);
    mockHotkeyRegister.mockResolvedValue('hotkey_123');

    // Reset the `initialized` state by re-importing the module fresh each test
    vi.resetModules();
  });

  it('skips initialization when not in Tauri', async () => {
    mockIsTauri.mockReturnValue(false);
    const { initializeGlobalHotkeys } = await import('./global-hotkeys');
    await initializeGlobalHotkeys();
    expect(mockHotkeyRegister).not.toHaveBeenCalled();
  });

  it('clears stuck hotkeys before registering', async () => {
    const { initializeGlobalHotkeys } = await import('./global-hotkeys');
    await initializeGlobalHotkeys();
    expect(mockHotkeyUnregisterAll).toHaveBeenCalledOnce();
  });

  it('registers the Cmd+Shift+A screenshot hotkey', async () => {
    const { initializeGlobalHotkeys } = await import('./global-hotkeys');
    await initializeGlobalHotkeys();
    expect(mockHotkeyRegister).toHaveBeenCalledWith(
      'CommandOrControl+Shift+A',
      expect.any(Function),
      expect.any(String)
    );
  });

  it('does not register twice if called again', async () => {
    const { initializeGlobalHotkeys } = await import('./global-hotkeys');
    await initializeGlobalHotkeys();
    await initializeGlobalHotkeys();
    expect(mockHotkeyRegister).toHaveBeenCalledTimes(1);
  });
});

describe('continueScreenshotWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    mockInvoke.mockResolvedValue(undefined);
    mockCaptureScreen.mockResolvedValue(makeBlob());
    mockShowRegionSelector.mockResolvedValue({
      x: 10, y: 20, width: 400, height: 300,
    });
    mockCaptureRegion.mockResolvedValue(makeBlob('region'));
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('sends the overlay background via event (not localStorage)', async () => {
    const { continueScreenshotWorkflow } = await import('./global-hotkeys');
    await continueScreenshotWorkflow(1);

    expect(mockEmit).toHaveBeenCalledWith(
      'overlay-set-background',
      expect.stringContaining('data:'),
    );
    // The persistent overlay webview can't rely on localStorage.
    expect(localStorageMock.getItem('overlay-screenshot')).toBeNull();
  });

  it('passes displayId to the region selector', async () => {
    const { continueScreenshotWorkflow } = await import('./global-hotkeys');
    await continueScreenshotWorkflow(2);

    expect(mockShowRegionSelector).toHaveBeenCalledWith(2);
  });

  it('hides main window before showing region selector', async () => {
    const callOrder: string[] = [];
    mockInvoke.mockImplementation((cmd: string) => {
      callOrder.push(cmd);
      return Promise.resolve(undefined);
    });
    mockShowRegionSelector.mockImplementation(() => {
      callOrder.push('showRegionSelector');
      return Promise.resolve({ x: 0, y: 0, width: 100, height: 100 });
    });

    const { continueScreenshotWorkflow } = await import('./global-hotkeys');
    await continueScreenshotWorkflow(1);

    const hideIdx = callOrder.indexOf('hide_main_window');
    const selectorIdx = callOrder.indexOf('showRegionSelector');
    expect(hideIdx).toBeGreaterThanOrEqual(0);
    expect(selectorIdx).toBeGreaterThan(hideIdx);
  });

  it('shows main window when region selection is cancelled', async () => {
    mockShowRegionSelector.mockResolvedValue(null);

    const { continueScreenshotWorkflow } = await import('./global-hotkeys');
    await continueScreenshotWorkflow(1);

    expect(mockInvoke).toHaveBeenCalledWith('show_main_window');
  });

  it('calls captureRegion with the selected bounds', async () => {
    const region = { x: 50, y: 60, width: 800, height: 600 };
    mockShowRegionSelector.mockResolvedValue(region);

    const { continueScreenshotWorkflow } = await import('./global-hotkeys');
    await continueScreenshotWorkflow(1);

    expect(mockCaptureRegion).toHaveBeenCalledWith(region);
  });

  it('stores screenshot data URL in localStorage after capture', async () => {
    const { continueScreenshotWorkflow } = await import('./global-hotkeys');
    await continueScreenshotWorkflow(1);

    expect(localStorageMock.getItem('gwt-global-screenshot')).toContain('data:');
  });

  it('shows main window after successful capture', async () => {
    const { continueScreenshotWorkflow } = await import('./global-hotkeys');
    await continueScreenshotWorkflow(1);

    expect(mockInvoke).toHaveBeenCalledWith('show_main_window');
  });

  it('shows main window even when capture throws', async () => {
    mockCaptureRegion.mockRejectedValue(new Error('capture failed'));

    const { continueScreenshotWorkflow } = await import('./global-hotkeys');
    await continueScreenshotWorkflow(1);

    expect(mockInvoke).toHaveBeenCalledWith('show_main_window');
  });

  it('passes displayId to captureScreen for overlay', async () => {
    const { continueScreenshotWorkflow } = await import('./global-hotkeys');
    await continueScreenshotWorkflow(3);

    expect(mockCaptureScreen).toHaveBeenCalledWith(
      expect.objectContaining({ displayId: 3 })
    );
  });
});

describe('handleGlobalScreenshot (single display)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    mockInvoke.mockResolvedValue(undefined);
    mockListDisplays.mockResolvedValue([
      { id: 1, name: 'Main', width: 1920, height: 1080, isMain: true },
    ]);
    mockCaptureScreen.mockResolvedValue(makeBlob());
    mockShowRegionSelector.mockResolvedValue({ x: 0, y: 0, width: 500, height: 400 });
    mockCaptureRegion.mockResolvedValue(makeBlob('region'));
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('uses the single available display directly (no picker)', async () => {
    const { initializeGlobalHotkeys } = await import('./global-hotkeys');
    await initializeGlobalHotkeys();

    // Get the registered callback
    const callback = mockHotkeyRegister.mock.calls[0][1];
    await callback();

    // screen selector should NOT have been invoked
    expect(mockInvoke).not.toHaveBeenCalledWith('show_screen_selector');
  });

  it('stores screenshot and timestamp after single-display capture', async () => {
    const { initializeGlobalHotkeys } = await import('./global-hotkeys');
    await initializeGlobalHotkeys();

    const callback = mockHotkeyRegister.mock.calls[0][1];
    await callback();

    expect(localStorageMock.getItem('gwt-global-screenshot')).toContain('data:');
    expect(localStorageMock.getItem('gwt-global-screenshot-timestamp')).toBeTruthy();
  });
});

describe('handleGlobalScreenshot (multi-display)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    mockInvoke.mockResolvedValue(undefined);
    mockListDisplays.mockResolvedValue([
      { id: 1, name: 'Main', width: 1920, height: 1080, isMain: true },
      { id: 2, name: 'External', width: 2560, height: 1440, isMain: false },
    ]);
    mockCaptureScreen.mockResolvedValue(makeBlob());
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('stores thumbnails for each display in localStorage', async () => {
    const { initializeGlobalHotkeys } = await import('./global-hotkeys');
    await initializeGlobalHotkeys();

    const callback = mockHotkeyRegister.mock.calls[0][1];
    await callback();

    const stored = localStorageMock.getItem('gwt-screen-thumbnails');
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(2);
  });

  it('opens screen selector window when multiple displays detected', async () => {
    const { initializeGlobalHotkeys } = await import('./global-hotkeys');
    await initializeGlobalHotkeys();

    const callback = mockHotkeyRegister.mock.calls[0][1];
    await callback();

    expect(mockInvoke).toHaveBeenCalledWith('show_screen_selector');
  });

  it('captures thumbnails at low quality to avoid localStorage quota', async () => {
    const { initializeGlobalHotkeys } = await import('./global-hotkeys');
    await initializeGlobalHotkeys();

    const callback = mockHotkeyRegister.mock.calls[0][1];
    await callback();

    // Each captureScreen call for thumbnails should use low quality
    const thumbnailCalls = mockCaptureScreen.mock.calls;
    thumbnailCalls.forEach(call => {
      expect(call[0].quality).toBeLessThanOrEqual(0.3);
    });
  });

  it('does not run region selector in multi-display path (waits for picker)', async () => {
    const { initializeGlobalHotkeys } = await import('./global-hotkeys');
    await initializeGlobalHotkeys();

    const callback = mockHotkeyRegister.mock.calls[0][1];
    await callback();

    expect(mockShowRegionSelector).not.toHaveBeenCalled();
  });
});
