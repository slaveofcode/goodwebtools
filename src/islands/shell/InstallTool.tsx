import { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, { install: string; ios: string; dismiss: string }> = {
  en: { install: 'Install this tool', ios: 'Tap the Share button, then “Add to Home Screen”.', dismiss: 'Dismiss' },
  id: { install: 'Instal tool ini', ios: 'Tap tombol Share, lalu “Add to Home Screen”.', dismiss: 'Tutup' },
};

export default function InstallTool({ toolId, name, lang = 'en' }: { toolId: string; name: string; lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const { canPrompt, isIOS, isStandalone, installed, promptInstall } = useInstallPrompt();
  const key = `gwt-install-dismissed:${toolId}`;
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(key) === '1'; } catch { return false; }
  });
  const [showIOS, setShowIOS] = useState(false);

  // Nothing to offer: already installed / running standalone / dismissed, or the
  // browser can neither prompt nor (iOS) show manual steps.
  if (isStandalone || installed || dismissed || (!canPrompt && !isIOS)) return null;

  const dismiss = () => {
    try { localStorage.setItem(key, '1'); } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <span className="relative inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => (isIOS ? setShowIOS(v => !v) : void promptInstall())}
        title={`${t.install}: ${name}`}
        className="inline-flex items-center gap-1.5 border-2 border-border bg-muted px-3 py-1.5 text-xs font-bold uppercase tracking-wide shadow-brutal-sm press-brutal hover:bg-accent hover:text-accent-foreground"
      >
        {isIOS ? <Share className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
        {t.install}
      </button>
      <button type="button" aria-label={t.dismiss} onClick={dismiss} className="text-muted-foreground hover:text-foreground">
        <X className="h-3.5 w-3.5" />
      </button>
      {showIOS && (
        <span className="absolute left-0 top-full z-20 mt-1 w-56 border-2 border-border bg-background p-2 text-xs font-normal normal-case text-foreground shadow-brutal">
          {t.ios}
        </span>
      )}
    </span>
  );
}
