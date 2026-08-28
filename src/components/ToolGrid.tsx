import { ArrowRight, ChevronRight } from 'lucide-react';
import { tools } from '@/registry/tools';
import { categories, categoryColors, categoryNotes, categorySlug, categoryName } from '@/registry/categories';
import { localizedTool } from '@/registry/tool-i18n';
import { localizePath, DEFAULT_LOCALE, type Lang } from '@/i18n/config';

/**
 * Static tool grid grouped by category. Rendered without a client directive so
 * Astro emits plain HTML (icons become inline SVG) — no JS shipped. Collapsing is
 * done with native <details>/<summary> and the category jump-nav with anchor
 * links, so the whole thing stays JS-free. `lang` localizes the tool links.
 */
export function ToolGrid({ lang = DEFAULT_LOCALE }: { lang?: Lang }) {
  const usedCategories = categories.filter(category =>
    tools.some(tool => tool.category === category)
  );

  return (
    <div>
      {/* Jump nav — hop straight to a category (Image → Dev) without scrolling. */}
      <nav aria-label="Jump to category" className="mb-8 flex flex-wrap gap-2">
        {usedCategories.map(category => (
          <a
            key={category}
            href={`#cat-${categorySlug(category)}`}
            className="inline-flex items-center gap-1.5 border-2 border-border bg-muted px-2.5 py-1 text-xs font-bold uppercase tracking-wide shadow-brutal-sm press-brutal"
          >
            <span className={`inline-block h-3 w-3 border border-border ${categoryColors[category]}`} />
            {categoryName(category, lang)}
          </a>
        ))}
      </nav>

      <div className="space-y-6">
        {usedCategories.map(category => {
          const categoryTools = tools.filter(tool => tool.category === category);
          const count = categoryTools.filter(tool => !tool.desktopOnly).length;
          return (
            <details
              key={category}
              id={`cat-${categorySlug(category)}`}
              open
              className="group scroll-mt-20 border-b-2 border-border pb-6 last:border-0"
            >
              <summary className="mb-4 flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                <span className={`inline-block h-4 w-4 border-2 border-border ${categoryColors[category]}`} />
                <a
                  href={localizePath(`/category/${categorySlug(category)}`, lang)}
                  className="group/link inline-flex items-center gap-1.5 hover:underline"
                >
                  <h2 className="text-xl font-bold uppercase tracking-tight">{categoryName(category, lang)}</h2>
                  <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover/link:opacity-100" />
                </a>
                <span className="text-sm font-bold text-muted-foreground">({count})</span>
              </summary>
              {categoryNotes[category] && (
                <p className="mb-4 max-w-3xl text-sm text-muted-foreground">{categoryNotes[category]}</p>
              )}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {categoryTools.map(tool => {
                  const Icon = tool.icon;
                  const label = localizedTool(tool, lang);
                  return (
                    <a
                      key={tool.id}
                      href={localizePath(tool.route, lang)}
                      {...(tool.desktopOnly ? { 'data-desktop-only': '' } : {})}
                      className="group flex items-start gap-3 border-2 border-border bg-muted p-4 shadow-brutal press-brutal"
                    >
                      <span
                        className={`mt-0.5 border-2 border-border p-2 text-black ${categoryColors[tool.category]}`}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-bold">{label.name}</span>
                        <span className="block text-sm text-muted-foreground">{label.summary}</span>
                      </span>
                    </a>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
