import { tools } from '@/registry/tools';
import { categories, categoryColors } from '@/registry/categories';

/**
 * Static tool grid grouped by category. Rendered without a client directive so
 * Astro emits plain HTML (icons become inline SVG) — no JS shipped.
 */
export function ToolGrid() {
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
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${categoryColors[category]}`} />
              <h2 className="text-lg font-semibold">{category}</h2>
              <span className="text-sm text-muted-foreground">({categoryTools.length})</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categoryTools.map(tool => {
                const Icon = tool.icon;
                return (
                  <a
                    key={tool.id}
                    href={tool.route}
                    className="group flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-4 transition-colors hover:border-accent hover:bg-muted/60"
                  >
                    <span className="mt-0.5 rounded-lg bg-background p-2 text-accent shadow-sm">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium group-hover:text-accent">{tool.name}</span>
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
