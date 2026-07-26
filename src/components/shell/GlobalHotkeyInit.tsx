import { useEffect } from 'react';
import {
  initializeGlobalHotkeys,
  cleanupGlobalHotkeys,
  continueScreenshotWorkflow,
  handleGlobalScreenshot,
} from '@/services/global-hotkeys';
import {
  consumePendingRecordingSelect,
  startRecordingOnDisplay,
} from '@/services/global-recording';
import { isTauri } from '@/services/platform';

/**
 * Initializes global hotkeys for the desktop app.
 * Should be mounted once at the app root level.
 */
export function GlobalHotkeyInit() {
  useEffect(() => {
    initializeGlobalHotkeys();

    let unlisten: (() => void) | null = null;
    let unlistenTray: (() => void) | null = null;

    (async () => {
      // Tauri's event API needs the desktop runtime — skip in the browser,
      // otherwise `listen()` throws (reading 'transformCallback' of undefined).
      if (!isTauri()) return;
      const { listen } = await import('@tauri-apps/api/event');

      // Screen selected from the multi-display picker window. The picker is
      // shared, so route to recording when a recording pick is pending,
      // otherwise fall through to the screenshot workflow.
      unlisten = await listen<number>('screen-selected', (event) => {
        const displayId = event.payload;
        if (consumePendingRecordingSelect()) {
          console.log('[GlobalHotkeyInit] Screen selected for recording:', displayId);
          startRecordingOnDisplay(displayId);
        } else {
          console.log('[GlobalHotkeyInit] Screen selected for screenshot:', displayId);
          continueScreenshotWorkflow(displayId);
        }
      });

      // Tray "Take Screenshot" menu item → same workflow as the keyboard hotkey
      unlistenTray = await listen('tray-screenshot', () => {
        console.log('[GlobalHotkeyInit] Screenshot triggered from tray menu');
        handleGlobalScreenshot();
      });

      console.log('[GlobalHotkeyInit] Listening for screen-selected and tray-screenshot events');
    })();

    const handleUnload = () => {
      cleanupGlobalHotkeys();
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      if (unlisten) unlisten();
      if (unlistenTray) unlistenTray();
      window.removeEventListener('beforeunload', handleUnload);
      cleanupGlobalHotkeys();
    };
  }, []);

  return null;
}
