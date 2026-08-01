import { tools } from '@/registry/tools';
import { categories, categoryColors, categoryNotes } from '@/registry/categories';
import { localizePath, DEFAULT_LOCALE, type Lang } from '@/i18n/config';

/**
 * Static tool grid grouped by category. Rendered without a client directive so
 * Astro emits plain HTML (icons become inline SVG) — no JS shipped. `lang`
 * localizes the tool links (e.g. /id/tools/x on the Indonesian home page).
 */
export function ToolGrid({ lang = DEFAULT_LOCALE }: { lang?: Lang }) {
  const usedCategories = categories.filter(category =>
    tools.some(tool => tool.category === category)
  );

  return (
    <div className="space-y-10">
      {usedCategories.map(category => {
        const categoryTools = tools.filter(tool => tool.category === category);
        return (
          <section key={category}>
            <div className="mb-4 flex items-center gap-2">
              <span
                className={`inline-block h-4 w-4 border-2 border-border ${categoryColors[category]}`}
              />
              <h2 className="text-xl font-bold uppercase tracking-tight">{category}</h2>
              <span className="text-sm font-bold text-muted-foreground">
                ({categoryTools.filter(tool => !tool.desktopOnly).length})
              </span>
            </div>
            {categoryNotes[category] && (
              <p className="mb-4 max-w-3xl text-sm text-muted-foreground">{categoryNotes[category]}</p>
            )}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {categoryTools.map(tool => {
                const Icon = tool.icon;
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
                      <span className="block font-bold">{tool.name}</span>
                      <span className="block text-sm text-muted-foreground">{tool.summary}</span>
                    </span>
                  </a>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
