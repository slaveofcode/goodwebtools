// Global hotkey manager for desktop app
// Registers app-wide hotkeys that work from anywhere

import { hotkeyService } from './hotkey';
import { captureService } from './capture';
import { isTauri } from './platform';

let initialized = false;
const registeredIds: string[] = [];

/**
 * Initialize global hotkeys for the desktop app.
 * Should be called once at app startup.
 */
export async function initializeGlobalHotkeys() {
  console.log('[GlobalHotkeys] Initializing... isTauri:', isTauri(), 'initialized:', initialized);

  if (!isTauri()) {
    console.log('[GlobalHotkeys] Not in Tauri, skipping initialization');
    return;
  }

  if (initialized) {
    console.log('[GlobalHotkeys] Already initialized, skipping');
    return;
  }

  try {
    console.log('[GlobalHotkeys] Registering screenshot hotkey...');

    // Screenshot hotkey: Cmd+Shift+X (less common, less likely to conflict)
    const screenshotId = await hotkeyService.register(
      'CommandOrControl+Shift+X',
      async () => {
        console.log('[GlobalHotkeys] Screenshot hotkey triggered');
        await handleGlobalScreenshot();
      },
      'Capture screenshot and open tool'
    );
    registeredIds.push(screenshotId);

    // Screen Recorder toggle: Cmd+Shift+5
    // Note: This will conflict with the in-tool hotkey, so we'll handle it differently
    // For now, we'll let the in-tool hotkey handle recording since it needs state access

    initialized = true;
    console.log('[GlobalHotkeys] Initialized', registeredIds.length, 'global hotkeys');
  } catch (err) {
    console.error('[GlobalHotkeys] Failed to initialize:', err);
  }
}

/**
 * Cleanup global hotkeys on app shutdown
 */
export async function cleanupGlobalHotkeys() {
  if (!initialized) return;

  for (const id of registeredIds) {
    await hotkeyService.unregister(id).catch(console.warn);
  }
  registeredIds.length = 0;
  initialized = false;
}

/**
 * Handle global screenshot capture
 */
async function handleGlobalScreenshot() {
  try {
    console.log('[GlobalHotkeys] Starting screenshot capture...');

    // Capture the full screen
    const screenshot = await captureService.captureScreen({
      format: 'png',
    });

    console.log('[GlobalHotkeys] Screenshot captured, size:', screenshot.length, 'bytes');

    // Convert to base64 data URL (chunk processing for large arrays)
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < screenshot.length; i += chunkSize) {
      const chunk = screenshot.slice(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const base64 = btoa(binary);
    const dataUrl = `data:image/png;base64,${base64}`;

    console.log('[GlobalHotkeys] Screenshot encoded to base64');

    // Store in localStorage for the Screenshot tool to pick up
    localStorage.setItem('gwt-global-screenshot', dataUrl);
    localStorage.setItem('gwt-global-screenshot-timestamp', Date.now().toString());

    // Navigate to screenshot tool or focus the window
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;

      if (currentPath === '/tools/screenshot') {
        // Already on the tool, trigger a custom event
        window.dispatchEvent(new CustomEvent('gwt:global-screenshot-ready'));
      } else {
        // Navigate to the tool
        window.location.href = '/tools/screenshot';
      }
    }
  } catch (err) {
    console.error('[GlobalHotkeys] Screenshot capture failed:', err);

    // Show error notification (could use a toast service here)
    if (typeof window !== 'undefined') {
      alert(`Screenshot failed: ${(err as Error).message}`);
    }
  }
}
