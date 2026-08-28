import { useEffect, useState } from 'react';
import { List, X, ArrowUp } from 'lucide-react';
import { tools } from '@/registry/tools';
import { categories, categoryColors, categorySlug, categoryName } from '@/registry/categories';
import { DEFAULT_LOCALE, type Lang } from '@/i18n/config';

/**
 * Mobile-only floating button for jumping between homepage categories (and back
 * to top) once you've scrolled past the top jump-nav. Its own tiny island so the
 * static ToolGrid stays JS-free; the menu items are plain anchors to #cat-<slug>
 * (the <details> sections carry those ids).
 */
export default function MobileCategoryNav({ lang = DEFAULT_LOCALE }: { lang?: Lang }) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const used = categories.filter(category => tools.some(tool => tool.category === category));

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > 300);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!shown) return null;

  const toTop = () => { setOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <>
      {open && <div className="fixed inset-0 z-40 sm:hidden" aria-hidden="true" onClick={() => setOpen(false)} />}
      <div className="fixed bottom-4 right-4 z-50 sm:hidden">
        {open && (
          <div role="menu" className="absolute bottom-14 right-0 max-h-[60vh] w-56 overflow-y-auto border-2 border-border bg-background shadow-brutal">
            <button
              onClick={toTop}
              className="flex w-full items-center gap-2 border-b-2 border-border px-3 py-2.5 text-left text-sm font-bold hover:bg-accent hover:text-accent-foreground"
            >
              <ArrowUp className="h-4 w-4" /> {lang === 'id' ? 'Ke atas' : 'Back to top'}
            </button>
            {used.map(category => (
              <a
                key={category}
                href={`#cat-${categorySlug(category)}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 text-sm font-bold hover:bg-accent hover:text-accent-foreground"
              >
                <span className={`inline-block h-3.5 w-3.5 shrink-0 border border-border ${categoryColors[category]}`} />
                {categoryName(category, lang)}
              </a>
            ))}
          </div>
        )}
        <button
          onClick={() => setOpen(o => !o)}
          aria-label={lang === 'id' ? 'Navigasi kategori' : 'Category navigation'}
          aria-expanded={open}
          className="flex h-12 w-12 items-center justify-center border-2 border-border bg-accent text-accent-foreground shadow-brutal press-brutal"
        >
          {open ? <X className="h-5 w-5" /> : <List className="h-5 w-5" />}
        </button>
      </div>
    </>
  );
}
