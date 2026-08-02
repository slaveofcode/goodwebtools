import { describe, it, expect } from 'vitest';
import { parseGhostExport, selectPosts, postPath, frontmatter, toMarkdown, toHtmlPage } from './ghost-export.lib';

const EXPORT = JSON.stringify({
  db: [{
    data: {
      posts: [
        { id: '1', title: 'Hello World', slug: 'hello-world', html: '<p>Hi <strong>there</strong></p>', status: 'published', visibility: 'public', type: 'post', published_at: '2024-01-15T10:00:00.000Z', updated_at: '2024-01-16T10:00:00.000Z', custom_excerpt: 'A greeting', feature_image: 'https://cdn/x.jpg' },
        { id: '2', title: 'Draft Note', slug: 'draft-note', html: '<p>WIP</p>', status: 'draft', visibility: 'public', type: 'post' },
        { id: '3', title: 'About', slug: 'about', html: '<p>About us</p>', status: 'published', visibility: 'public', type: 'page' },
        { id: '4', title: 'Members Only', slug: 'members', html: '<p>secret</p>', status: 'published', visibility: 'members', type: 'post' },
      ],
      tags: [{ id: '10', name: 'News' }, { id: '11', name: 'Updates' }],
      posts_tags: [
        { post_id: '1', tag_id: '11', sort_order: 1 },
        { post_id: '1', tag_id: '10', sort_order: 0 },
      ],
    },
  }],
});

describe('parseGhostExport', () => {
  it('reads posts and joins tags in sort order', () => {
    const posts = parseGhostExport(EXPORT);
    expect(posts).toHaveLength(4);
    const hello = posts.find(p => p.id === '1')!;
    expect(hello.title).toBe('Hello World');
    expect(hello.tags).toEqual(['News', 'Updates']); // sort_order 0 then 1
    expect(hello.excerpt).toBe('A greeting');
  });

  it('tolerates a top-level data object (no db array)', () => {
    const posts = parseGhostExport(JSON.stringify({ data: { posts: [{ id: 'a', title: 'T', slug: 't', html: '<p>x</p>', status: 'published', type: 'post' }] } }));
    expect(posts[0].title).toBe('T');
  });

  it('throws on invalid JSON and on non-Ghost files', () => {
    expect(() => parseGhostExport('not json')).toThrow(/not valid JSON/);
    expect(() => parseGhostExport('{"db":[{"data":{"posts":[]}}]}')).toThrow(/No posts/);
  });
});

describe('selectPosts', () => {
  const posts = parseGhostExport(EXPORT);
  it('everything: all 4', () => {
    expect(selectPosts(posts, { includeDrafts: true, includePages: true })).toHaveLength(4);
  });
  it('published posts only: excludes draft + page', () => {
    const sel = selectPosts(posts, { includeDrafts: false, includePages: false });
    expect(sel.map(p => p.id).sort()).toEqual(['1', '4']);
  });
  it('drafts included but no pages', () => {
    const sel = selectPosts(posts, { includeDrafts: true, includePages: false });
    expect(sel.map(p => p.id).sort()).toEqual(['1', '2', '4']);
  });
});

describe('postPath', () => {
  const posts = parseGhostExport(EXPORT);
  const byId = (id: string) => posts.find(p => p.id === id)!;
  it('routes by status/type into folders', () => {
    expect(postPath(byId('1'), 'md')).toBe('posts/hello-world.md');
    expect(postPath(byId('2'), 'md')).toBe('drafts/draft-note.md'); // draft
    expect(postPath(byId('3'), 'html')).toBe('pages/about.html'); // page
  });
});

describe('frontmatter', () => {
  const hello = parseGhostExport(EXPORT).find(p => p.id === '1')!;
  it('emits generic YAML with the key fields', () => {
    const fm = frontmatter(hello);
    expect(fm.startsWith('---\n')).toBe(true);
    expect(fm.trimEnd().endsWith('---')).toBe(true);
    expect(fm).toContain('title: Hello World');
    expect(fm).toContain('slug: hello-world');
    expect(fm).toContain('draft: false');
    expect(fm).toMatch(/tags:\n\s+- News\n\s+- Updates/);
    expect(fm).toContain('feature_image: https://cdn/x.jpg');
  });
  it('marks drafts and members visibility', () => {
    const posts = parseGhostExport(EXPORT);
    expect(frontmatter(posts.find(p => p.id === '2')!)).toContain('draft: true');
    expect(frontmatter(posts.find(p => p.id === '4')!)).toContain('visibility: members');
  });
});

describe('toMarkdown / toHtmlPage', () => {
  const hello = parseGhostExport(EXPORT).find(p => p.id === '1')!;
  it('combines frontmatter + converted body', () => {
    const { path, content } = toMarkdown(hello, html => html.replace(/<[^>]+>/g, '').trim());
    expect(path).toBe('posts/hello-world.md');
    expect(content).toContain('title: Hello World');
    expect(content).toContain('Hi there'); // stub strips tags
  });
  it('wraps a standalone HTML page with title + content', () => {
    const { path, content } = toHtmlPage(hello);
    expect(path).toBe('posts/hello-world.html');
    expect(content).toContain('<title>Hello World</title>');
    expect(content).toContain('<meta name="description" content="A greeting">');
    expect(content).toContain('<p>Hi <strong>there</strong></p>');
  });
  it('escapes HTML-unsafe titles', () => {
    const evil = { ...hello, title: 'A <b>& "x"' };
    expect(toHtmlPage(evil).content).toContain('<title>A &lt;b&gt;&amp; &quot;x&quot;</title>');
  });
});
