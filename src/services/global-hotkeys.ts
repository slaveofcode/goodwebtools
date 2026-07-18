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
    // First, unregister ALL hotkeys to clear any stuck registrations
    console.log('[GlobalHotkeys] Cleaning up any existing hotkeys...');
    await hotkeyService.unregisterAll();
    registeredIds.length = 0; // Clear our tracking array

    console.log('[GlobalHotkeys] Registering screenshot hotkey...');

    // Screenshot hotkey: Cmd+Shift+A (same as Lark app for muscle memory)
    const screenshotId = await hotkeyService.register(
      'CommandOrControl+Shift+A',
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

// Debounce to prevent double-firing
let screenshotInProgress = false;

/**
 * Handle global screenshot capture
 */
async function handleGlobalScreenshot() {
  if (screenshotInProgress) {
    console.log('[GlobalHotkeys] Screenshot already in progress, ignoring');
    return;
  }

  screenshotInProgress = true;
  try {
    console.log('[GlobalHotkeys] Starting screenshot capture...');

    // Get all displays
    const displays = await captureService.listDisplays();
    console.log('[GlobalHotkeys] Available displays:', displays);

    let displayId: number | undefined;

    // For multi-display: capture main display
    // TODO: Add display selector in Screenshot tool to switch between displays
    const mainDisplay = displays.find(d => d.isMain) || displays[0];

    console.log(`[GlobalHotkeys] Capturing display ${mainDisplay.id} (${displays.length} total)...`);

    const screenshot = await captureService.captureScreen({
      format: 'png',
      displayId: mainDisplay.id,
    });

    // Convert to data URL
    let dataUrl: string;
    if (screenshot instanceof Blob) {
      dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(screenshot);
      });
    } else {
      throw new Error('Unexpected screenshot format');
    }

    console.log('[GlobalHotkeys] Screenshot captured, size:', dataUrl.length);

    localStorage.setItem('gwt-global-screenshot', dataUrl);
    localStorage.setItem('gwt-global-screenshot-timestamp', Date.now().toString());

    // Store available displays for later switching
    if (displays.length > 1) {
      localStorage.setItem('gwt-available-displays', JSON.stringify(displays));
    }

    // Navigate to screenshot tool
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      if (currentPath === '/tools/screenshot') {
        window.dispatchEvent(new CustomEvent('gwt:screenshots-ready'));
      } else {
        window.location.href = '/tools/screenshot';
      }
    }

    screenshotInProgress = false;
    return;

    // All done - screenshots stored and ready
  } catch (err) {
    console.error('[GlobalHotkeys] Screenshot capture failed:', err);
    console.error('[GlobalHotkeys] Error stack:', (err as Error).stack);

    screenshotInProgress = false;

    // TODO: Show error notification using a toast service instead of alert
    // (alert requires dialog permissions which aren't critical for this feature)
  }
}
