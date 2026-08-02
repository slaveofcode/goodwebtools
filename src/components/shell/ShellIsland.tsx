import { useEffect, useRef, useState } from 'react';
import { Search, Github, Info, ExternalLink, Settings, MoreVertical } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { LangSwitcher } from './LangSwitcher';
import { CommandPalette } from './CommandPalette';
import { Modal } from '@/components/ui/Modal';
import { initTheme } from '@/stores/theme.store';
import { isTauri } from '@/services/platform';
import { REPO_URL } from '@/config';

/** Opens the command palette from a click (works without a keyboard). */
export function openSearch() {
  window.dispatchEvent(new CustomEvent('gwt:open-search'));
}

const iconBtn =
  'flex h-9 w-9 items-center justify-center border-2 border-border bg-muted shadow-brutal-sm press-brutal text-muted-foreground';
const menuItem =
  'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-bold hover:bg-accent hover:text-accent-foreground';

export function ShellIsland() {
  const [modal, setModal] = useState<null | 'github'>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // Settings only apply to the desktop app; hide the nav link on the web.
  // Starts false so SSR and the first client render match, then reveals on
  // desktop after mount (avoids a hydration mismatch).
  const [isDesktop, setIsDesktop] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initTheme();
    setIsDesktop(isTauri());
  }, []);

  // Close the mobile overflow menu on outside click, Escape, or navigation.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    const onNav = () => setMenuOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    document.addEventListener('astro:page-load', onNav);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('astro:page-load', onNav);
    };
  }, [menuOpen]);

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
                className="flex h-9 items-center gap-1.5 border-2 border-border bg-muted px-2.5 text-sm font-bold uppercase tracking-wide text-muted-foreground shadow-brutal-sm press-brutal"
              >
                <Search className="h-4 w-4" />
                <span className="hidden md:inline">
                  Press{' '}
                  <kbd className="border-2 border-border bg-background px-1.5 py-0.5 text-xs">⌘K</kbd> to search
                </span>
              </button>

              {/* Secondary actions — inline on ≥sm, in an overflow menu on mobile. */}
              <div className="hidden items-center gap-2 sm:flex sm:gap-3">
                {isDesktop && (
                  <a href="/settings" aria-label="Settings" title="Settings" className={iconBtn}>
                    <Settings className="h-4 w-4" />
                  </a>
                )}
                <a href="/about" aria-label="About" title="About" className={iconBtn}>
                  <Info className="h-4 w-4" />
                </a>
                <button onClick={() => setModal('github')} aria-label="Contribute on GitHub" title="Contribute on GitHub" className={iconBtn}>
                  <Github className="h-4 w-4" />
                </button>
              </div>

              <div className="relative sm:hidden" ref={menuRef}>
                <button onClick={() => setMenuOpen(o => !o)} aria-label="More" aria-haspopup="menu" aria-expanded={menuOpen} className={iconBtn}>
                  <MoreVertical className="h-4 w-4" />
                </button>
                {menuOpen && (
                  <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-48 border-2 border-border bg-background shadow-brutal">
                    {isDesktop && (
                      <a href="/settings" role="menuitem" className={menuItem}><Settings className="h-4 w-4" /> Settings</a>
                    )}
                    <a href="/about" role="menuitem" className={menuItem}><Info className="h-4 w-4" /> About</a>
                    <button role="menuitem" onClick={() => { setMenuOpen(false); setModal('github'); }} className={menuItem}>
                      <Github className="h-4 w-4" /> Contribute
                    </button>
                  </div>
                )}
              </div>

              <LangSwitcher />
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
    </>
  );
}
