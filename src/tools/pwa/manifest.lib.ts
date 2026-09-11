/**
 * Pure helpers for per-tool PWA manifests. Each tool gets its own manifest so a
 * user can install a single tool as a focused app that launches straight into
 * `/tools/<id>`. Framework-free and unit-tested.
 */

/** 'FileText' → 'file-text', 'Wand2' → 'wand-2' (matches lucide-static file names). */
export function pascalToKebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Za-z])([0-9])/g, '$1-$2')
    .toLowerCase();
}

/** A focused, installable web manifest for one tool. */
export function buildToolManifest(t: { id: string; name: string; summary: string }): Record<string, unknown> {
  return {
    id: `/tools/${t.id}`,
    name: `${t.name} — GoodWebTools`,
    short_name: t.name,
    description: t.summary,
    start_url: `/tools/${t.id}`,
    scope: `/tools/${t.id}`,
    display: 'standalone',
    theme_color: '#0a0a0a',
    background_color: '#fffdf5',
    icons: [
      { src: `/manifests/icons/${t.id}-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: `/manifests/icons/${t.id}-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  };
}
