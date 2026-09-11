import { describe, it, expect } from 'vitest';
import { renderMarkdown, isMarkdownFile, titleFromFileName } from './markdown.lib';

describe('renderMarkdown', () => {
  it('renders a heading', () => {
    expect(renderMarkdown('# Hi')).toContain('<h1');
    expect(renderMarkdown('# Hi')).toContain('Hi');
  });

  it('renders lists and emphasis', () => {
    const html = renderMarkdown('- **bold**');
    expect(html).toContain('<li');
    expect(html).toContain('<strong>bold</strong>');
  });

  it('strips dangerous markup', () => {
    const html = renderMarkdown('<script>alert(1)</script>\n\n# Safe');
    expect(html).not.toContain('<script');
    expect(html).toContain('Safe');
  });

  it('returns a string for empty input', () => {
    expect(typeof renderMarkdown('')).toBe('string');
  });
});

describe('isMarkdownFile', () => {
  it.each([
    ['README.md', ''],
    ['notes.markdown', ''],
    ['a.MDOWN', ''],
    ['x.mkd', ''],
    ['doc.mdx', ''],
    ['plain.txt', ''],
    ['anything', 'text/markdown'],
    ['anything', 'text/x-markdown'],
  ])('accepts %s (type %s)', (name, type) => {
    expect(isMarkdownFile({ name, type })).toBe(true);
  });

  it.each([
    ['photo.png', 'image/png'],
    ['data.json', 'application/json'],
    ['archive.zip', 'application/zip'],
  ])('rejects %s (type %s)', (name, type) => {
    expect(isMarkdownFile({ name, type })).toBe(false);
  });
});

describe('titleFromFileName', () => {
  it.each([
    ['README.md', 'README'],
    ['My Notes.markdown', 'My Notes'],
    ['no-extension', 'no-extension'],
    ['.md', 'Untitled'],
  ])('%s → %s', (name, expected) => {
    expect(titleFromFileName(name)).toBe(expected);
  });
});
