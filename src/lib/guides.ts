import { getCollection, type CollectionEntry } from 'astro:content';
import type { Lang } from '@/i18n/config';

export type Guide = CollectionEntry<'guides'>;

/** "en/compress-photo-to-200kb" → { lang: 'en', slug: 'compress-photo-to-200kb' }. */
export function splitGuideId(id: string): { lang: string; slug: string } {
  const [lang, ...rest] = id.replace(/\.mdx?$/, '').split('/');
  return { lang, slug: rest.join('/') };
}

/** Guides in one language, newest first, then by title. */
export async function guidesFor(lang: Lang): Promise<Guide[]> {
  const all = await getCollection('guides', (g) => splitGuideId(g.id).lang === lang);
  return all.sort((a, b) => b.data.updated.getTime() - a.data.updated.getTime() || a.data.title.localeCompare(b.data.title));
}
