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
      <header className="border-b-[3px] border-border bg-background">
        <div className="page-container">
          <div className="flex h-16 items-center justify-between">
            <a
              href="/"
              className="border-2 border-border bg-accent px-3 py-1.5 text-lg font-bold uppercase tracking-tight text-accent-foreground shadow-brutal-sm press-brutal"
            >
              GoodWebTools
            </a>
            <div className="flex items-center gap-3">
              <span className="hidden text-sm font-bold uppercase tracking-wide text-muted-foreground sm:inline">
                Press{' '}
                <kbd className="border-2 border-border bg-muted px-1.5 py-0.5 text-xs">⌘K</kbd> to
                search
              </span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>
      <CommandPalette />
    </>
  );
}
