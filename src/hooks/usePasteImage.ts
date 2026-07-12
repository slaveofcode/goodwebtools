import { useEffect } from 'react';

/**
 * Calls `onImage` with an image File pasted from the clipboard (⌘/Ctrl+V).
 * Most screenshot tools copy to the clipboard, so this lets users paste
 * straight into an image tool instead of saving a file first.
 */
export function usePasteImage(onImage: (file: File) => void) {
  useEffect(() => {
    const handler = (event: ClipboardEvent) => {
      // Don't hijack paste while typing in a field.
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;

      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            event.preventDefault();
            onImage(file);
            return;
          }
        }
      }
    };
    window.addEventListener('paste', handler);
    return () => window.removeEventListener('paste', handler);
  }, [onImage]);
}
