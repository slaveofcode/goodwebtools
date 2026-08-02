import { useEffect, useState } from 'react';
import type { Lang } from './config';

/**
 * Client-side current-locale hook for shared components that aren't passed a `lang`
 * prop. Reads the URL (/id/… → 'id') and re-checks on every view-transition
 * navigation. SSR returns 'en'; it settles to the real locale on hydration.
 */
export function useLang(): Lang {
  const [lang, setLang] = useState<Lang>('en');
  useEffect(() => {
    const detect = () => setLang(/^\/id(\/|$)/.test(location.pathname) ? 'id' : 'en');
    detect();
    document.addEventListener('astro:page-load', detect);
    return () => document.removeEventListener('astro:page-load', detect);
  }, []);
  return lang;
}

/** Common strings shared across UI components (Copy, Download, Dropzone, …). */
const SHARED = {
  en: {
    copy: 'Copy', copied: 'Copied', copyImage: 'Copy image', copyFailed: 'Copy failed',
    download: 'Download', loadFile: 'Load file', editAnnotator: 'Edit in Annotator',
    dropzone: 'Drop files here or click to browse', result: 'Result', resultAlt: 'Result preview',
    smaller: 'smaller', larger: 'larger',
  },
  id: {
    copy: 'Salin', copied: 'Tersalin', copyImage: 'Salin gambar', copyFailed: 'Gagal menyalin',
    download: 'Unduh', loadFile: 'Muat file', editAnnotator: 'Edit di Anotator',
    dropzone: 'Letakkan file di sini atau klik untuk menelusuri', result: 'Hasil', resultAlt: 'Pratinjau hasil',
    smaller: 'lebih kecil', larger: 'lebih besar',
  },
} satisfies Record<Lang, Record<string, string>>;

/** Shared UI strings for the current locale. */
export function useUi() {
  return SHARED[useLang()];
}
