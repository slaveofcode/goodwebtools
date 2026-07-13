import { useEffect, useState } from 'react';
import { Search, Github, Bookmark, Info, ExternalLink } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { CommandPalette } from './CommandPalette';
import { Modal } from '@/components/ui/Modal';
import { initTheme } from '@/stores/theme.store';
import { REPO_URL } from '@/config';

/** Opens the command palette from a click (works without a keyboard). */
export function openSearch() {
  window.dispatchEvent(new CustomEvent('gwt:open-search'));
}

const iconBtn =
  'border-2 border-border bg-muted p-2 shadow-brutal-sm press-brutal text-muted-foreground';

export function ShellIsland() {
  const [modal, setModal] = useState<null | 'github' | 'bookmark'>(null);
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    initTheme();
    setIsMac(/Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent));
  }, []);

  const bookmarkKey = isMac ? '⌘ D' : 'Ctrl + D';

  return (
    <>
      <header className="sticky top-0 z-40 border-b-[3px] border-border bg-background">
        <div className="page-container">
          <div className="flex h-16 items-center justify-between">
            <a
              href="/"
              className="border-2 border-border bg-accent px-3 py-1.5 text-lg font-bold uppercase tracking-tight text-accent-foreground shadow-brutal-sm press-brutal"
            >
              GoodWebTools
            </a>
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={openSearch}
                aria-label="Search tools"
                className="flex items-center gap-1.5 border-2 border-border bg-muted px-2 py-1.5 text-sm font-bold uppercase tracking-wide text-muted-foreground shadow-brutal-sm press-brutal"
              >
                <Search className="h-4 w-4" />
                <span className="hidden md:inline">
                  Press{' '}
                  <kbd className="border-2 border-border bg-background px-1.5 py-0.5 text-xs">⌘K</kbd> to search
                </span>
              </button>
              <a href="/about" aria-label="About" title="About" className={iconBtn}>
                <Info className="h-4 w-4" />
              </a>
              <button onClick={() => setModal('github')} aria-label="Contribute on GitHub" title="Contribute on GitHub" className={iconBtn}>
                <Github className="h-4 w-4" />
              </button>
              <button onClick={() => setModal('bookmark')} aria-label="Bookmark this site" title="Bookmark this site" className={iconBtn}>
                <Bookmark className="h-4 w-4" />
              </button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <CommandPalette />

      {modal === 'github' && (
        <Modal title="Contribute" onClose={() => setModal(null)}>
          <div className="space-y-3 text-sm">
            <p>
              <span className="font-bold">GoodWebTools is open source.</span> Every tool runs entirely
              in your browser using modern web APIs and WebAssembly — nothing is uploaded.
            </p>
            <p>
              Got an idea for a tool that could work fully client-side? Or found a bug? Please{' '}
              <span className="font-bold">open an issue</span>, or <span className="font-bold">fork the
              repo and send a pull request</span> — contributions and requests are very welcome.
            </p>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border-2 border-border bg-accent px-3 py-2 font-bold uppercase tracking-wide text-accent-foreground shadow-brutal press-brutal"
            >
              <Github className="h-4 w-4" />
              slaveofcode/goodwebtools
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </Modal>
      )}

      {modal === 'bookmark' && (
        <Modal title="Bookmark this site" onClose={() => setModal(null)}>
          <div className="space-y-3 text-sm">
            <p>Keep GoodWebTools one click away — add it to your bookmarks:</p>
            <p className="flex items-center justify-center gap-2 border-2 border-border bg-muted px-3 py-4 text-center">
              <span>Press</span>
              <kbd className="border-2 border-border bg-background px-2 py-1 font-bold">{bookmarkKey}</kbd>
            </p>
            <p className="text-muted-foreground">
              Browsers don't allow a button to add bookmarks (for your security), so the keyboard
              shortcut is the quickest way. You can also drag the address bar into your bookmarks.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
