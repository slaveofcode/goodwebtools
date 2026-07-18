import { useEffect } from 'react';
import { initializeGlobalHotkeys, cleanupGlobalHotkeys, continueScreenshotWorkflow } from '@/services/global-hotkeys';

/**
 * Initializes global hotkeys for the desktop app.
 * Should be mounted once at the app root level.
 */
export function GlobalHotkeyInit() {
  useEffect(() => {
    initializeGlobalHotkeys();

    // Listen for screen selection from screen selector window via Tauri events
    let unlisten: (() => void) | null = null;

    (async () => {
      const { listen } = await import('@tauri-apps/api/event');

      unlisten = await listen<{ displayId: number }>('screen-selected', (event) => {
        const { displayId } = event.payload;
        console.log('[GlobalHotkeyInit] Screen selected via Tauri event, continuing workflow with display:', displayId);
        continueScreenshotWorkflow(displayId);
      });

      console.log('[GlobalHotkeyInit] Listening for screen-selected events');
    })();

    // Cleanup on unmount AND on page unload
    const handleUnload = () => {
      cleanupGlobalHotkeys();
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      if (unlisten) unlisten();
      window.removeEventListener('beforeunload', handleUnload);
      cleanupGlobalHotkeys();
    };
  }, []);

  return null; // This component renders nothing
}
