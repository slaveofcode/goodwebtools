/**
 * Parse a Ghost content export (the JSON you download from Ghost admin →
 * Settings → Migration → Export) and turn each post into a Markdown or standalone
 * HTML file. Pure + framework-free: HTML→Markdown conversion is injected (turndown
 * lives in the island so this lib stays testable and dependency-light).
 */
import { stringify as yamlStringify } from 'yaml';

export interface NormalizedPost {
  id: string;
  title: string;
  slug: string;
  html: string;
  status: string; // 'published' | 'draft' | 'scheduled' …
  visibility: string; // 'public' | 'members' | 'paid' …
  type: string; // 'post' | 'page'
  createdAt?: string;
  publishedAt?: string;
  updatedAt?: string;
  excerpt?: string;
  featureImage?: string;
  tags: string[];
}

export interface ExportOptions {
  includeDrafts: boolean;
  includePages: boolean;
}

interface RawPost {
  id?: string | number;
  title?: string;
  slug?: string;
  html?: string;
  status?: string;
  visibility?: string;
  type?: string;
  page?: boolean; // older exports mark pages with `page: true`
  created_at?: string;
  published_at?: string;
  updated_at?: string;
  custom_excerpt?: string;
  excerpt?: string;
  feature_image?: string;
  tags?: { name?: string }[];
}

/** Read the `data` object out of a Ghost export, tolerating a few shapes. */
function exportData(obj: unknown): Record<string, unknown> {
  const o = obj as Record<string, unknown>;
  const db = o?.db as Array<{ data?: Record<string, unknown> }> | undefined;
  return (db?.[0]?.data ?? (o?.data as Record<string, unknown>) ?? o ?? {}) as Record<string, unknown>;
}

/** Parse a Ghost export JSON string into normalized posts (tags joined). */
export function parseGhostExport(jsonText: string): NormalizedPost[] {
  let obj: unknown;
  try {
    obj = JSON.parse(jsonText);
  } catch {
    throw new Error('This file is not valid JSON — export your content from Ghost admin → Settings → Migration.');
  }
  const data = exportData(obj);
  const posts = (data.posts as RawPost[]) ?? [];
  if (!Array.isArray(posts) || posts.length === 0) {
    throw new Error('No posts found — is this a Ghost content export (a “db”/“data.posts” JSON)?');
  }

  // Tags come as a separate array + a posts_tags join table.
  const tags = (data.tags as { id?: string | number; name?: string }[]) ?? [];
  const tagById = new Map(tags.map(t => [String(t.id), t.name ?? '']));
  const joins = (data.posts_tags as { post_id?: string | number; tag_id?: string | number; sort_order?: number }[]) ?? [];
  const tagsForPost = new Map<string, string[]>();
  for (const j of joins.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))) {
    const name = tagById.get(String(j.tag_id));
    if (!name) continue;
    const key = String(j.post_id);
    (tagsForPost.get(key) ?? tagsForPost.set(key, []).get(key)!).push(name);
  }

  return posts.map((p): NormalizedPost => {
    const id = String(p.id ?? '');
    const embedded = Array.isArray(p.tags) ? p.tags.map(t => t?.name ?? '').filter(Boolean) : [];
    return {
      id,
      title: p.title ?? 'Untitled',
      slug: p.slug ?? '',
      html: p.html ?? '',
      status: p.status ?? 'draft',
      visibility: p.visibility ?? 'public',
      type: p.type ?? (p.page ? 'page' : 'post'),
      createdAt: p.created_at,
      publishedAt: p.published_at ?? undefined,
      updatedAt: p.updated_at,
      excerpt: p.custom_excerpt ?? p.excerpt ?? undefined,
      featureImage: p.feature_image ?? undefined,
      tags: embedded.length ? embedded : (tagsForPost.get(id) ?? []),
    };
  });
}

/** Apply the include-drafts / include-pages options. */
export function selectPosts(posts: NormalizedPost[], opts: ExportOptions): NormalizedPost[] {
  return posts.filter(p => {
    if (p.type === 'page' && !opts.includePages) return false;
    if (p.status !== 'published' && !opts.includeDrafts) return false;
    return true;
  });
}

/** A filesystem-safe slug (Ghost slugs already are, but guard empties/odd chars). */
function safeSlug(post: NormalizedPost): string {
  const s = (post.slug || post.title || post.id || 'untitled')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'untitled';
}

/** Output folder: drafts/ for anything unpublished, pages/ for pages, else posts/. */
export function postPath(post: NormalizedPost, ext: 'md' | 'html'): string {
  const folder = post.status !== 'published' ? 'drafts' : post.type === 'page' ? 'pages' : 'posts';
  return `${folder}/${safeSlug(post)}.${ext}`;
}

/** Generic YAML frontmatter block (portable across Astro/Hugo/Jekyll/11ty). */
export function frontmatter(post: NormalizedPost): string {
  const fm: Record<string, unknown> = {
    title: post.title,
    slug: post.slug || safeSlug(post),
    date: post.publishedAt ?? post.createdAt,
    updated: post.updatedAt,
    draft: post.status !== 'published',
  };
  if (post.visibility && post.visibility !== 'public') fm.visibility = post.visibility;
  if (post.type === 'page') fm.type = 'page';
  if (post.excerpt) fm.excerpt = post.excerpt;
  if (post.featureImage) fm.feature_image = post.featureImage;
  if (post.tags.length) fm.tags = post.tags;
  // Drop undefined keys so the YAML stays clean.
  for (const k of Object.keys(fm)) if (fm[k] === undefined) delete fm[k];
  return `---\n${yamlStringify(fm).trimEnd()}\n---\n`;
}

/** Build the Markdown file for a post. `htmlToMd` converts the post's HTML body. */
export function toMarkdown(post: NormalizedPost, htmlToMd: (html: string) => string): { path: string; content: string } {
  const body = post.html ? htmlToMd(post.html).trim() : '';
  return { path: postPath(post, 'md'), content: `${frontmatter(post)}\n${body}\n` };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Build a minimal, self-contained HTML page for a post — ready to host statically. */
export function toHtmlPage(post: NormalizedPost): { path: string; content: string } {
  const desc = post.excerpt ? `\n  <meta name="description" content="${escapeHtml(post.excerpt)}">` : '';
  const hero = post.featureImage ? `\n    <img src="${escapeHtml(post.featureImage)}" alt="" />` : '';
  const tags = post.tags.length ? `\n    <p class="tags">${post.tags.map(escapeHtml).join(' · ')}</p>` : '';
  const date = post.publishedAt ?? post.createdAt ?? '';
  const content = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(post.title)}</title>${desc}
  <style>
    body { max-width: 44rem; margin: 2rem auto; padding: 0 1rem; font-family: system-ui, -apple-system, sans-serif; line-height: 1.7; color: #1a1a1a; }
    img { max-width: 100%; height: auto; }
    pre { overflow: auto; background: #f5f5f5; padding: 1rem; }
    .tags, time { color: #666; font-size: 0.9rem; }
    h1 { line-height: 1.2; }
  </style>
</head>
<body>
  <article>
    <h1>${escapeHtml(post.title)}</h1>
    ${date ? `<time datetime="${escapeHtml(date)}">${escapeHtml(date.slice(0, 10))}</time>` : ''}${hero}
    ${post.html}${tags}
  </article>
</body>
</html>
`;
  return { path: postPath(post, 'html'), content };
}
