import { useEffect, useState, type MouseEvent } from 'react';
import { LOCALES, LOCALE_LABEL, LOCALE_NAME, localizePath, stripLocale, type Lang } from '@/i18n/config';

// Public sections that exist in every locale. Other paths (about, settings…) fall
// back to the locale home when switching, so the switcher never lands on a 404.
const LOCALIZED_PREFIXES = ['/tools/', '/category/', '/about', '/privacy'];

/** The URL for the current page in `lang` — computed fresh from the live location. */
function targetFor(lang: Lang): string {
  const base = stripLocale(location.pathname);
  const usable = base === '/' || LOCALIZED_PREFIXES.some(p => base.startsWith(p)) ? base : '/';
  return localizePath(usable, lang);
}

export function LangSwitcher() {
  const [current, setCurrent] = useState<Lang>('en');
  // Real hrefs (for right-click / open-in-new-tab / no-JS). Recomputed on every
  // navigation — the header persists across view transitions, so a one-time
  // computation would go stale and send you to a previously-visited page.
  const [hrefs, setHrefs] = useState<Record<Lang, string>>({ en: '/', id: '/id/' });

  useEffect(() => {
    const update = () => {
      setCurrent(/^\/id(\/|$)/.test(location.pathname) ? 'id' : 'en');
      setHrefs({ en: targetFor('en'), id: targetFor('id') });
    };
    update();
    document.addEventListener('astro:page-load', update);
    return () => document.removeEventListener('astro:page-load', update);
  }, []);

  const pick = (l: Lang) => (e: MouseEvent) => {
    // Remember the choice, then navigate to the freshly-computed target for the
    // page the user is actually on (belt-and-suspenders against any stale href).
    document.cookie = `gwt.lang=${l};path=/;max-age=31536000;samesite=lax`;
    e.preventDefault();
    location.href = targetFor(l);
  };

  return (
    <div className="flex items-center border-2 border-border shadow-brutal-sm" role="group" aria-label="Language">
      {LOCALES.map(l => (
        <a
          key={l}
          href={hrefs[l]}
          onClick={pick(l)}
          aria-current={current === l ? 'true' : undefined}
          aria-label={LOCALE_NAME[l]}
          title={LOCALE_NAME[l]}
          className={`px-2 py-1.5 text-xs font-bold uppercase tracking-wide ${current === l ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
        >
          {LOCALE_LABEL[l]}
        </a>
      ))}
    </div>
  );
}
