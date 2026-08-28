import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Search, Github, Info, ExternalLink, Settings, MoreVertical, Sparkles } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { LangSwitcher } from './LangSwitcher';
import { CommandPalette } from './CommandPalette';
import { Modal } from '@/components/ui/Modal';
import { initTheme } from '@/stores/theme.store';
import { isTauri } from '@/services/platform';
import { REPO_URL } from '@/config';
import type { Lang } from '@/i18n/config';

/** Opens the command palette from a click (works without a keyboard). */
export function openSearch() {
  window.dispatchEvent(new CustomEvent('gwt:open-search'));
}

export function openAgent() {
  // Keep the visitor in their locale (the /id/ page exists too).
  const inId = /^\/id(\/|$)/.test(window.location.pathname);
  window.location.href = inId ? '/id/ask-agent' : '/ask-agent';
}

const iconBtn =
  'flex h-9 w-9 items-center justify-center border-2 border-border bg-muted shadow-brutal-sm press-brutal text-muted-foreground';
const menuItem =
  'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-bold hover:bg-accent hover:text-accent-foreground';

// Header UI strings, per language (the header persists across navigations, so the
// language is detected from the URL client-side rather than passed as a prop).
const S: Record<Lang, {
  searchAria: string; searchPre: string; searchPost: string; askAgent: string;
  about: string; contribute: string; contribMenu: string; more: string; settings: string;
  modalTitle: string; modalBody: ReactNode;
}> = {
  en: {
    searchAria: 'Search tools', searchPre: 'Press', searchPost: 'to search', askAgent: 'Ask agent',
    about: 'About', contribute: 'Contribute on GitHub', contribMenu: 'Contribute', more: 'More', settings: 'Settings',
    modalTitle: 'Contribute',
    modalBody: (
      <>
        <p><span className="font-bold">GoodWebTools is open source.</span> Every tool runs entirely in your browser using modern web APIs and WebAssembly — nothing is uploaded.</p>
        <p>Got an idea for a tool that could work fully client-side? Or found a bug? Please <span className="font-bold">open an issue</span>, or <span className="font-bold">fork the repo and send a pull request</span> — contributions and requests are very welcome.</p>
      </>
    ),
  },
  id: {
    searchAria: 'Cari tool', searchPre: 'Tekan', searchPost: 'untuk mencari', askAgent: 'Tanya agen',
    about: 'Tentang', contribute: 'Kontribusi di GitHub', contribMenu: 'Kontribusi', more: 'Lainnya', settings: 'Pengaturan',
    modalTitle: 'Kontribusi',
    modalBody: (
      <>
        <p><span className="font-bold">GoodWebTools bersifat sumber terbuka.</span> Setiap tool berjalan sepenuhnya di browser Anda menggunakan API web modern dan WebAssembly — tidak ada yang diunggah.</p>
        <p>Punya ide tool yang bisa berjalan sepenuhnya di sisi klien? Atau menemukan bug? Silakan <span className="font-bold">buka issue</span>, atau <span className="font-bold">fork repo dan kirim pull request</span> — kontribusi dan permintaan sangat kami hargai.</p>
      </>
    ),
  },
};

export function ShellIsland() {
  const [modal, setModal] = useState<null | 'github'>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lang, setLang] = useState<Lang>('en');
  // Settings only apply to the desktop app; hide the nav link on the web.
  // Starts false so SSR and the first client render match, then reveals on
  // desktop after mount (avoids a hydration mismatch).
  const [isDesktop, setIsDesktop] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const s = S[lang];

  useEffect(() => {
    initTheme();
    setIsDesktop(isTauri());
    // Detect language from the URL, and keep it current across view transitions.
    const syncLang = () => setLang(/^\/id(\/|$)/.test(location.pathname) ? 'id' : 'en');
    syncLang();
    document.addEventListener('astro:page-load', syncLang);
    return () => document.removeEventListener('astro:page-load', syncLang);
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
                aria-label={s.searchAria}
                className="flex h-9 items-center gap-1.5 border-2 border-border bg-muted px-2.5 text-sm font-bold uppercase tracking-wide text-muted-foreground shadow-brutal-sm press-brutal"
              >
                <Search className="h-4 w-4" />
                <span className="hidden md:inline">
                  {s.searchPre}{' '}
                  <kbd className="border-2 border-border bg-background px-1.5 py-0.5 text-xs">⌘K</kbd> {s.searchPost}
                </span>
              </button>

              <button
                onClick={openAgent}
                aria-label={s.askAgent}
                title={s.askAgent}
                className="flex h-9 items-center gap-1.5 border-2 border-border bg-accent px-2.5 text-sm font-bold uppercase tracking-wide text-accent-foreground shadow-brutal-sm press-brutal"
              >
                <Sparkles className="h-4 w-4" />
                <span className="hidden md:inline">{s.askAgent}</span>
              </button>

              {/* Secondary actions — inline on ≥sm, in an overflow menu on mobile. */}
              <div className="hidden items-center gap-2 sm:flex sm:gap-3">
                {isDesktop && (
                  <a href="/settings" aria-label={s.settings} title={s.settings} className={iconBtn}>
                    <Settings className="h-4 w-4" />
                  </a>
                )}
                <a href="/about" aria-label={s.about} title={s.about} className={iconBtn}>
                  <Info className="h-4 w-4" />
                </a>
                <button onClick={() => setModal('github')} aria-label={s.contribute} title={s.contribute} className={iconBtn}>
                  <Github className="h-4 w-4" />
                </button>
              </div>

              {/* Language + theme inline on ≥sm; folded into the overflow menu on mobile. */}
              <div className="hidden items-center gap-2 sm:flex sm:gap-3">
                <LangSwitcher />
                <ThemeToggle />
              </div>

              <div className="relative sm:hidden" ref={menuRef}>
                <button onClick={() => setMenuOpen(o => !o)} aria-label={s.more} aria-haspopup="menu" aria-expanded={menuOpen} className={iconBtn}>
                  <MoreVertical className="h-4 w-4" />
                </button>
                {menuOpen && (
                  <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-56 border-2 border-border bg-background shadow-brutal">
                    <div className="flex items-center justify-between gap-2 border-b-2 border-border px-3 py-2.5">
                      <LangSwitcher />
                      <ThemeToggle />
                    </div>
                    {isDesktop && (
                      <a href="/settings" role="menuitem" className={menuItem}><Settings className="h-4 w-4" /> {s.settings}</a>
                    )}
                    <a href="/about" role="menuitem" className={menuItem}><Info className="h-4 w-4" /> {s.about}</a>
                    <button role="menuitem" onClick={() => { setMenuOpen(false); setModal('github'); }} className={menuItem}>
                      <Github className="h-4 w-4" /> {s.contribMenu}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <CommandPalette />

      {modal === 'github' && (
        <Modal title={s.modalTitle} onClose={() => setModal(null)}>
          <div className="space-y-3 text-sm">
            {s.modalBody}
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
