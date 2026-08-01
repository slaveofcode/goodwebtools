import { useEffect, useState } from 'react';
import { LOCALES, LOCALE_LABEL, LOCALE_NAME, localizePath, stripLocale, type Lang } from '@/i18n/config';

// Public sections that exist in every locale. Other paths (about, settings…) fall
// back to the locale home when switching, so the switcher never lands on a 404.
const LOCALIZED_PREFIXES = ['/tools/', '/category/'];

export function LangSwitcher() {
  const [current, setCurrent] = useState<Lang>('en');
  const [base, setBase] = useState('/');

  useEffect(() => {
    const path = location.pathname;
    setCurrent(/^\/id(\/|$)/.test(path) ? 'id' : 'en');
    const b = stripLocale(path);
    setBase(b === '/' || LOCALIZED_PREFIXES.some(p => b.startsWith(p)) ? b : '/');
  }, []);

  const remember = (l: Lang) => {
    document.cookie = `gwt.lang=${l};path=/;max-age=31536000;samesite=lax`;
  };

  return (
    <div className="flex items-center border-2 border-border shadow-brutal-sm" role="group" aria-label="Language">
      {LOCALES.map(l => (
        <a
          key={l}
          href={localizePath(base, l)}
          onClick={() => remember(l)}
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
