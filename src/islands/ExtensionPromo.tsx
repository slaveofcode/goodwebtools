import { useEffect, useState } from 'react';
import { Puzzle, X, ExternalLink } from 'lucide-react';
import { CHROME_EXTENSION_URL } from '@/config';
import { detectCompanion } from '@/services/companion';
import { localizePath, type Lang } from '@/i18n/config';
import { canInstallExtension, isSnoozed, promoAngle, PROMO_DISMISS_KEY, type PromoAngle } from '@/lib/extension-promo';

const TR: Record<Lang, { title: string; add: string; more: string; dismiss: string; pitch: Record<PromoAngle, string> }> = {
  en: {
    title: 'Get the free GoodWebTools extension',
    add: 'Add to Chrome — free',
    more: 'Learn more',
    dismiss: 'Hide for 30 days',
    pitch: {
      image: 'Right-click any image on the web to compress, convert or remove its background here — no downloading first.',
      text: 'Select text on any page, right-click, and format JSON, Base64, hash or count words here in one step.',
      media: 'Record a tab with its sound, take full-page screenshots, or capture your screen from any page.',
      general: 'Open any of 200+ tools from your toolbar, the side panel or the right-click menu — still private, still free.',
    },
  },
  id: {
    title: 'Pasang ekstensi GoodWebTools gratis',
    add: 'Tambahkan ke Chrome — gratis',
    more: 'Selengkapnya',
    dismiss: 'Sembunyikan 30 hari',
    pitch: {
      image: 'Klik kanan gambar apa pun di web untuk mengompres, mengonversi, atau menghapus latar belakangnya di sini — tanpa mengunduh dulu.',
      text: 'Pilih teks di halaman mana pun, klik kanan, lalu format JSON, Base64, hash, atau hitung kata di sini dalam satu langkah.',
      media: 'Rekam tab beserta suaranya, ambil tangkapan layar satu halaman penuh, atau tangkap layar dari halaman mana pun.',
      general: 'Buka 200+ tool dari toolbar, panel samping, atau menu klik kanan — tetap privat, tetap gratis.',
    },
  },
};

interface Props {
  lang?: Lang;
  /** 'tool': compact card under a tool; 'home': banner on the home page. */
  variant?: 'tool' | 'home';
  toolId?: string;
  category?: string;
}

/** Suggests the Companion extension — only where it can be installed and isn't yet. */
export default function ExtensionPromo({ lang = 'en', variant = 'tool', toolId, category }: Props) {
  const t = TR[lang] ?? TR.en;
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean; brands?: { brand: string }[] } };
      const desktopApp = '__TAURI__' in window;
      if (!canInstallExtension({ userAgent: nav.userAgent, uaData: nav.userAgentData, desktopApp })) return;
      let dismissedAt: number | null = null;
      try { dismissedAt = Number(localStorage.getItem(PROMO_DISMISS_KEY)) || null; } catch { /* storage blocked */ }
      if (isSnoozed(dismissedAt)) return;
      if (await detectCompanion(800)) return; // already installed
      if (!cancelled) setShow(true);
    })();
    return () => { cancelled = true; };
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    try { localStorage.setItem(PROMO_DISMISS_KEY, String(Date.now())); } catch { /* storage blocked */ }
  };
  const pitch = t.pitch[variant === 'home' ? 'general' : promoAngle(category, toolId)];

  return (
    <aside
      data-testid="extension-promo"
      data-embed-hide
      aria-label={t.title}
      className={`relative flex flex-col gap-3 border-2 border-border bg-muted p-4 shadow-brutal-sm sm:flex-row sm:items-center ${variant === 'home' ? 'mt-6 max-w-3xl' : 'mt-6'}`}
    >
      <Puzzle className="hidden h-8 w-8 shrink-0 text-accent sm:block" aria-hidden="true" />
      <div className="min-w-0 flex-1 pr-6">
        <p className="font-bold">{t.title}</p>
        <p className="text-sm text-muted-foreground">{pitch}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={CHROME_EXTENSION_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 border-2 border-border bg-accent px-3 py-1.5 text-sm font-bold uppercase tracking-wide text-accent-foreground shadow-brutal-sm press-brutal"
        >
          {t.add}
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
        <a href={localizePath('/extension', lang)} className="text-sm font-bold underline underline-offset-2">
          {t.more}
        </a>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t.dismiss}
        title={t.dismiss}
        className="absolute right-2 top-2 p-1 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </aside>
  );
}
