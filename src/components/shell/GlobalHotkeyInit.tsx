import { useEffect } from 'react';
import { initializeGlobalHotkeys, cleanupGlobalHotkeys } from '@/services/global-hotkeys';

/**
 * Initializes global hotkeys for the desktop app.
 * Should be mounted once at the app root level.
 */
export function GlobalHotkeyInit() {
  useEffect(() => {
    initializeGlobalHotkeys();

    // Cleanup on unmount AND on page unload
    const handleUnload = () => {
      cleanupGlobalHotkeys();
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      cleanupGlobalHotkeys();
    };
  }, []);

  return null; // This component renders nothing
}
