import { useState } from 'react';
import { Coffee } from 'lucide-react';
import { POLAR_CHECKOUT_URL } from '@/config';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, { cta: string; opening: string }> = {
  en: { cta: 'Buy me a coffee', opening: 'Opening…' },
  id: { cta: 'Belikan saya kopi', opening: 'Membuka…' },
};

/** Reads the current theme so the Polar overlay matches the site. */
function currentTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light';
  const root = document.documentElement;
  if (root.classList.contains('dark') || root.dataset.theme === 'dark') return 'dark';
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

export default function SupportButton({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [busy, setBusy] = useState(false);

  if (!POLAR_CHECKOUT_URL) return null;

  const open = async () => {
    setBusy(true);
    try {
      // Load Polar's embed on demand so it never weighs on other pages.
      const { PolarEmbedCheckout } = await import('@polar-sh/checkout/embed');
      await PolarEmbedCheckout.create(POLAR_CHECKOUT_URL, { theme: currentTheme() });
    } catch {
      // Fall back to the hosted checkout page if the overlay can't load.
      window.open(POLAR_CHECKOUT_URL, '_blank', 'noopener,noreferrer');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void open()}
      disabled={busy}
      className="inline-flex items-center gap-2 border-2 border-border bg-accent px-4 py-2 font-bold uppercase tracking-wide text-accent-foreground shadow-brutal press-brutal disabled:opacity-60"
    >
      <Coffee className="h-4 w-4" />
      {busy ? t.opening : t.cta}
    </button>
  );
}
