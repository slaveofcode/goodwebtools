import { useEffect } from 'react';
import { ThemeToggle } from './ThemeToggle';
import { CommandPalette } from './CommandPalette';
import { initTheme } from '@/stores/theme.store';

export function ShellIsland() {
  useEffect(() => {
    initTheme();
  }, []);

  return (
    <>
      <header className="border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <a href="/" className="text-xl font-bold hover:text-accent">GoodWebTools</a>
            <div className="flex items-center gap-4">
              <button className="text-sm text-muted-foreground hover:text-foreground">
                Press <kbd className="px-2 py-1 bg-muted rounded text-xs">⌘K</kbd> to search
              </button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>
      <CommandPalette />
    </>
  );
}
