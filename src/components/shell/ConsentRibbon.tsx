import { useEffect, useState } from 'react';

// Small GDPR cookie-consent ribbon. Analytics (if configured) only loads after
// the visitor accepts — see the GA loader in Base.astro, which listens for the
// 'gwt:consent' event dispatched here.
export function ConsentRibbon() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const c = localStorage.getItem('gwt-consent');
    if (c !== 'granted' && c !== 'denied') setVisible(true);
  }, []);

  const choose = (value: 'granted' | 'denied') => {
    try {
      localStorage.setItem('gwt-consent', value);
    } catch {
      /* storage blocked — still hide the banner for this session */
    }
    window.dispatchEvent(new CustomEvent('gwt:consent', { detail: value }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] border-t-[3px] border-border bg-background">
      <div className="page-container flex flex-col items-start gap-3 py-3 sm:flex-row sm:items-center">
        <p className="text-sm text-muted-foreground">
          We use a privacy-friendly analytics cookie to understand which tools are useful. Your files
          never leave your browser.{' '}
          <a href="/privacy" className="font-bold text-foreground underline underline-offset-2 hover:text-accent">
            Learn more
          </a>
          .
        </p>
        <div className="flex shrink-0 gap-2 sm:ml-auto">
          <button
            onClick={() => choose('denied')}
            className="border-2 border-border bg-muted px-3 py-1.5 text-sm font-bold uppercase tracking-wide text-foreground shadow-brutal-sm press-brutal"
          >
            Decline
          </button>
          <button
            onClick={() => choose('granted')}
            className="border-2 border-border bg-accent px-3 py-1.5 text-sm font-bold uppercase tracking-wide text-accent-foreground shadow-brutal-sm press-brutal"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
