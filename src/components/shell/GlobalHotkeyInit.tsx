import { useEffect } from 'react';
import { initializeGlobalHotkeys, cleanupGlobalHotkeys } from '@/services/global-hotkeys';

/**
 * Initializes global hotkeys for the desktop app.
 * Should be mounted once at the app root level.
 */
export function GlobalHotkeyInit() {
  useEffect(() => {
    initializeGlobalHotkeys();

    // Listen for navigation signals from screen selector
    const handleStorage = (e: StorageEvent) => {
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
