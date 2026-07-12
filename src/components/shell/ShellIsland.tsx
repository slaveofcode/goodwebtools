import { useEffect } from 'react';
import { Search } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { CommandPalette } from './CommandPalette';
import { initTheme } from '@/stores/theme.store';

/** Opens the command palette from a click (works without a keyboard). */
export function openSearch() {
  window.dispatchEvent(new CustomEvent('gwt:open-search'));
}

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
              <button
                onClick={openSearch}
                aria-label="Search tools"
                className="flex items-center gap-1.5 border-2 border-border bg-muted px-2 py-1.5 text-sm font-bold uppercase tracking-wide text-muted-foreground shadow-brutal-sm press-brutal"
              >
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline">
                  Press{' '}
                  <kbd className="border-2 border-border bg-background px-1.5 py-0.5 text-xs">⌘K</kbd> to search
                </span>
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
