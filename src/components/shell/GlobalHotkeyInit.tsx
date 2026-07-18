import { useEffect } from 'react';
import { initializeGlobalHotkeys, cleanupGlobalHotkeys } from '@/services/global-hotkeys';

/**
 * Initializes global hotkeys for the desktop app.
 * Should be mounted once at the app root level.
 */
export function GlobalHotkeyInit() {
  useEffect(() => {
    initializeGlobalHotkeys();
    return () => {
      cleanupGlobalHotkeys();
    };
  }, []);

  return null; // This component renders nothing
}
