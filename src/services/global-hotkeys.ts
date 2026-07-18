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
    console.log('[GlobalHotkeys] Starting region selection...');

    // First, capture a screenshot for the overlay background
    console.log('[GlobalHotkeys] Capturing overlay screenshot...');
    try {
      const overlayScreenshot = await captureService.captureScreen({
        format: 'jpg',
        quality: 0.75,
      });

      console.log('[GlobalHotkeys] Overlay screenshot captured:', overlayScreenshot);

      // Convert to data URL for overlay background
      let overlayDataUrl: string;
      if (overlayScreenshot instanceof Blob) {
        console.log('[GlobalHotkeys] Converting Blob to data URL for overlay...');
        overlayDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(overlayScreenshot);
        });
        console.log('[GlobalHotkeys] Overlay data URL length:', overlayDataUrl.length);
      } else {
        throw new Error('Unexpected screenshot format for overlay');
      }

      // Store in localStorage for overlay to use
      localStorage.setItem('overlay-screenshot', overlayDataUrl);
      console.log('[GlobalHotkeys] Overlay screenshot stored in localStorage');
    } catch (overlayError) {
      console.error('[GlobalHotkeys] Failed to capture overlay screenshot:', overlayError);
      // Continue anyway - overlay will just show gray background
    }

    // Show region selector to let user choose area
    console.log('[GlobalHotkeys] Showing region selector...');
    const region = await captureService.showRegionSelector();

    if (!region) {
      console.log('[GlobalHotkeys] Region selection cancelled');
      screenshotInProgress = false;
      return;
    }

    console.log('[GlobalHotkeys] Region selected:', region);
    console.log('[GlobalHotkeys] Capturing region immediately...');

    // Capture the selected region (instant, no countdown)
    const screenshot = await captureService.captureRegion(region);

    console.log('[GlobalHotkeys] captureScreen returned:', typeof screenshot, screenshot);

    if (!screenshot) {
      throw new Error('Screenshot capture returned null or undefined');
    }

    let dataUrl: string;

    // Handle Blob (from Tauri captureScreen)
    if (screenshot instanceof Blob) {
      console.log('[GlobalHotkeys] Converting Blob to data URL...');
      dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(screenshot);
      });
      console.log('[GlobalHotkeys] Blob converted to data URL, length:', dataUrl.length);
    }
    // Handle number[] array (alternative format)
    else if (Array.isArray(screenshot)) {
      if (screenshot.length === 0) {
        throw new Error('Screenshot capture returned empty array');
      }
      console.log('[GlobalHotkeys] Converting byte array to base64...');
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < screenshot.length; i += chunkSize) {
        const chunk = screenshot.slice(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
      }
      const base64 = btoa(binary);
      dataUrl = `data:image/png;base64,${base64}`;
      console.log('[GlobalHotkeys] Array converted to base64, length:', dataUrl.length);
    }
    else {
      throw new Error(`Screenshot capture returned unsupported type: ${typeof screenshot}`);
    }

    // Store in localStorage for the Screenshot tool to pick up
    localStorage.setItem('gwt-global-screenshot', dataUrl);
    localStorage.setItem('gwt-global-screenshot-timestamp', Date.now().toString());

    console.log('[GlobalHotkeys] Screenshot stored in localStorage');

    // Navigate to screenshot tool or focus the window
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;

      console.log('[GlobalHotkeys] Current path:', currentPath);

      if (currentPath === '/tools/screenshot') {
        // Already on the tool, trigger a custom event
        console.log('[GlobalHotkeys] Already on screenshot tool, firing event');
        window.dispatchEvent(new CustomEvent('gwt:global-screenshot-ready'));
      } else {
        // Navigate to the tool
        console.log('[GlobalHotkeys] Navigating to screenshot tool');
        window.location.href = '/tools/screenshot';
      }
    }

    screenshotInProgress = false;
  } catch (err) {
    console.error('[GlobalHotkeys] Screenshot capture failed:', err);
    console.error('[GlobalHotkeys] Error stack:', (err as Error).stack);

    screenshotInProgress = false;

    // TODO: Show error notification using a toast service instead of alert
    // (alert requires dialog permissions which aren't critical for this feature)
  }
}
