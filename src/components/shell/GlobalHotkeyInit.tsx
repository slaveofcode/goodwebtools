import { useEffect } from 'react';
import { initializeGlobalHotkeys, cleanupGlobalHotkeys, continueScreenshotWorkflow } from '@/services/global-hotkeys';

/**
 * Initializes global hotkeys for the desktop app.
 * Should be mounted once at the app root level.
 */
export function GlobalHotkeyInit() {
  useEffect(() => {
    initializeGlobalHotkeys();

    // Listen for screen selection from screen selector window
    const handleStorage = (e: StorageEvent) => {
      // Screen selection made
      if (e.key === 'gwt-screen-selection-timestamp' && e.newValue) {
        const displayIdStr = localStorage.getItem('gwt-selected-display');
        if (displayIdStr) {
          const displayId = parseInt(displayIdStr);
          console.log('[GlobalHotkeyInit] Screen selected, continuing workflow with display:', displayId);
          localStorage.removeItem('gwt-screen-selection-timestamp');
          localStorage.removeItem('gwt-selected-display');
          continueScreenshotWorkflow(displayId);
        }
      }

      // Legacy: navigation signal from old code path
      if (e.key === 'gwt-navigate-to-screenshot' && e.newValue) {
        localStorage.removeItem('gwt-navigate-to-screenshot');
        window.location.href = '/tools/screenshot';
      }
    };

    window.addEventListener('storage', handleStorage);

    // Cleanup on unmount AND on page unload
    const handleUnload = () => {
      cleanupGlobalHotkeys();
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('beforeunload', handleUnload);
      cleanupGlobalHotkeys();
    };
  }, []);

  return null; // This component renders nothing
}
