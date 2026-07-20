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

/**
 * Continue screenshot workflow after display selection
 */
export async function continueScreenshotWorkflow(displayId: number) {
  console.log('[GlobalHotkeys] Continuing workflow with display:', displayId);

  try {
    const { invoke } = await import('@tauri-apps/api/core');

    // Capture overlay screenshot for region selector background.
    // 50% scale = 4× fewer pixels to encode → the overlay appears sooner.
    console.log('[GlobalHotkeys] Capturing overlay screenshot on display:', displayId);
    const overlayScreenshot = await captureService.captureScreen({
      format: 'jpg',
      quality: 0.75,
      scale: 0.5,
      displayId,
    });

    let overlayDataUrl: string;
    if (overlayScreenshot instanceof Blob) {
      overlayDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(overlayScreenshot);
      });
    } else {
      throw new Error('Unexpected screenshot format');
    }

    // Hide main window so it's not visible in the screenshot
    await invoke('hide_main_window');

    // Send the frozen background to the (reused) overlay via event.
    // localStorage is unreliable across the persistent overlay webview;
    // displayId travels to the overlay through the overlay-show event.
    const { emit } = await import('@tauri-apps/api/event');
    await emit('overlay-set-background', overlayDataUrl);
    console.log('[GlobalHotkeys] Overlay background sent');

    // Show region selector
    console.log('[GlobalHotkeys] Showing region selector...');
    const region = await captureService.showRegionSelector(displayId);

    if (!region) {
      console.log('[GlobalHotkeys] Region selection cancelled');
      await invoke('show_main_window');
      return;
    }

    console.log('[GlobalHotkeys] Region selected:', region);

    // Capture the selected region
    const screenshot = await captureService.captureRegion(region);

    if (!screenshot) {
      throw new Error('Screenshot capture returned null');
    }

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

    // Store screenshot
    localStorage.setItem('gwt-global-screenshot', dataUrl);
    localStorage.setItem('gwt-global-screenshot-timestamp', Date.now().toString());

    console.log('[GlobalHotkeys] Screenshot stored, navigating to tool...');

    // Restore and focus main window
    await invoke('show_main_window');

    // Navigate to screenshot tool
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      if (currentPath === '/tools/screenshot') {
        window.dispatchEvent(new CustomEvent('gwt:global-screenshot-ready'));
      } else {
        window.location.href = '/tools/screenshot';
      }
    }
  } catch (err) {
    console.error('[GlobalHotkeys] Screenshot capture failed:', err);
    console.error('[GlobalHotkeys] Error stack:', (err as Error).stack);

    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('show_main_window');
  }
}

// Debounce to prevent double-firing
let screenshotInProgress = false;

/**
 * Handle global screenshot capture (also called from tray menu)
 */
export async function handleGlobalScreenshot() {
  if (screenshotInProgress) {
    console.log('[GlobalHotkeys] Screenshot already in progress, ignoring');
    return;
  }

  screenshotInProgress = true;
  try {
    console.log('[GlobalHotkeys] Starting screenshot capture...');

    // Focus the window first
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('show_main_window').catch(() => {
      console.warn('[GlobalHotkeys] Could not focus window');
    });

    // Get all displays
    const displays = await captureService.listDisplays();
    console.log('[GlobalHotkeys] Available displays:', displays);

    let displayId: number | undefined;

    // If multiple displays, show picker
    if (displays.length > 1) {
      console.log('[GlobalHotkeys] Multiple displays detected, showing picker...');

      // Capture small thumbnails for picker
      const thumbnails = await Promise.all(
        displays.map(async (display) => {
          try {
            const screenshot = await captureService.captureScreen({
              format: 'jpg',
              quality: 0.3, // Very low quality for thumbnails
              displayId: display.id,
            });

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

            return { display, dataUrl };
          } catch (err) {
            console.error(`[GlobalHotkeys] Failed to capture thumbnail for display ${display.id}:`, err);
            return null;
          }
        })
      );

      const validThumbnails = thumbnails.filter(Boolean);
      if (validThumbnails.length === 0) {
        throw new Error('Failed to capture any display thumbnails');
      }

      // Store thumbnails for picker
      const thumbnailsJson = JSON.stringify(validThumbnails);
      console.log('[GlobalHotkeys] Storing thumbnails, size:', thumbnailsJson.length, 'bytes');

      try {
        localStorage.setItem('gwt-screen-thumbnails', thumbnailsJson);
        console.log('[GlobalHotkeys] Thumbnails stored successfully');
      } catch (err) {
        console.error('[GlobalHotkeys] Failed to store thumbnails:', err);
        // Fallback: use main display
        displayId = displays.find(d => d.isMain)?.id || displays[0]?.id;
        console.log('[GlobalHotkeys] Falling back to main display:', displayId);
        // Continue with single-display flow below
      }

      // Show screen picker in separate window
      await invoke('show_screen_selector');
      return;
    } else {
      // Single display - use it directly
      displayId = displays[0]?.id;
      console.log('[GlobalHotkeys] Single display, using:', displayId);
    }

    // Capture overlay screenshot for region selector background.
    // 50% scale = 4× fewer pixels to encode → the overlay appears sooner.
    console.log('[GlobalHotkeys] Capturing overlay screenshot on display:', displayId);
    const overlayScreenshot = await captureService.captureScreen({
      format: 'jpg',
      quality: 0.75,
      scale: 0.5,
      displayId,
    });

    let overlayDataUrl: string;
    if (overlayScreenshot instanceof Blob) {
      overlayDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(overlayScreenshot);
      });
    } else {
      throw new Error('Unexpected screenshot format');
    }

    // Send the frozen background to the (reused) overlay via event.
    // localStorage is unreliable across the persistent overlay webview;
    // displayId travels to the overlay through the overlay-show event.
    const { emit } = await import('@tauri-apps/api/event');
    await emit('overlay-set-background', overlayDataUrl);
    console.log('[GlobalHotkeys] Overlay background sent');

    // Show region selector
    console.log('[GlobalHotkeys] Showing region selector...');
    const region = await captureService.showRegionSelector(displayId);

    if (!region) {
      console.log('[GlobalHotkeys] Region selection cancelled');
      return;
    }

    console.log('[GlobalHotkeys] Region selected:', region);

    // Capture the selected region
    const screenshot = await captureService.captureRegion(region);

    if (!screenshot) {
      throw new Error('Screenshot capture returned null');
    }

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

    // Store screenshot
    localStorage.setItem('gwt-global-screenshot', dataUrl);
    localStorage.setItem('gwt-global-screenshot-timestamp', Date.now().toString());

    console.log('[GlobalHotkeys] Screenshot stored, navigating to tool...');

    // Restore and focus main window
    await invoke('show_main_window');

    // Navigate to screenshot tool
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      if (currentPath === '/tools/screenshot') {
        window.dispatchEvent(new CustomEvent('gwt:global-screenshot-ready'));
      } else {
        window.location.href = '/tools/screenshot';
      }
    }
  } catch (err) {
    console.error('[GlobalHotkeys] Screenshot capture failed:', err);
    console.error('[GlobalHotkeys] Error stack:', (err as Error).stack);

    // TODO: Show error notification using a toast service instead of alert
    // (alert requires dialog permissions which aren't critical for this feature)
  } finally {
    // Guarantee the guard clears however we exit. A hung await here (e.g. an
    // overlay cancel that never resolved) previously left this stuck `true`,
    // making the global hotkey silently ignore every later press.
    screenshotInProgress = false;
  }
}
