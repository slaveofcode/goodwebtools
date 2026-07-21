import { useEffect } from 'react';
import {
  initializeGlobalHotkeys,
  cleanupGlobalHotkeys,
  continueScreenshotWorkflow,
  handleGlobalScreenshot,
} from '@/services/global-hotkeys';

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
      const { listen } = await import('@tauri-apps/api/event');

      // Screen selected from the multi-display picker window
      unlisten = await listen<number>('screen-selected', (event) => {
        const displayId = event.payload;
        console.log('[GlobalHotkeyInit] Screen selected, continuing workflow with display:', displayId);
        continueScreenshotWorkflow(displayId);
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
