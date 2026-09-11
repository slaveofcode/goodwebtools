import { useCallback, useEffect, useState } from 'react';

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

interface InstallGlobal {
  __gwtInstall?: { evt: BIPEvent | null };
}

/**
 * Surfaces the browser's install capability for the "Install this tool" button.
 * The `beforeinstallprompt` event is captured early by an inline script in
 * Base.astro (into `window.__gwtInstall`) so it is never missed before this
 * hook mounts. iOS Safari has no such event — callers show manual instructions.
 */
export function useInstallPrompt() {
  const [canPrompt, setCanPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [isStandalone, setStandalone] = useState(false);
  const [isIOS, setIOS] = useState(false);

  useEffect(() => {
    const w = window as unknown as InstallGlobal;
    setCanPrompt(!!w.__gwtInstall?.evt);

    const ua = navigator.userAgent || '';
    setIOS(/iP(hone|ad|od)/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua));

    const mm = typeof window.matchMedia === 'function' ? window.matchMedia('(display-mode: standalone)') : null;
    const nav = navigator as unknown as { standalone?: boolean };
    setStandalone((mm?.matches ?? false) || nav.standalone === true);

    const onInstallable = () => setCanPrompt(true);
    const onInstalled = () => { setInstalled(true); setCanPrompt(false); };
    const onMM = (e: MediaQueryListEvent) => setStandalone(e.matches);
    window.addEventListener('gwt-installable', onInstallable);
    window.addEventListener('gwt-installed', onInstalled);
    mm?.addEventListener?.('change', onMM);
    return () => {
      window.removeEventListener('gwt-installable', onInstallable);
      window.removeEventListener('gwt-installed', onInstalled);
      mm?.removeEventListener?.('change', onMM);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    const w = window as unknown as InstallGlobal;
    const evt = w.__gwtInstall?.evt;
    if (!evt) return;
    await evt.prompt();
    await evt.userChoice.catch(() => undefined);
    if (w.__gwtInstall) w.__gwtInstall.evt = null;
    setCanPrompt(false);
  }, []);

  return { canPrompt, isIOS, isStandalone, installed, promptInstall };
}
