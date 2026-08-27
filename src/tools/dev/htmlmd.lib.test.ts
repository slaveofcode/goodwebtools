import { describe, it, expect } from 'vitest';
import { htmlToMarkdown, markdownToHtml } from './htmlmd.lib';

describe('htmlToMarkdown', () => {
  it('converts headings and emphasis', async () => {
    expect(await htmlToMarkdown('<h1>Hi</h1>')).toBe('# Hi');
    expect(await htmlToMarkdown('<strong>bold</strong>')).toBe('**bold**');
  });
  it('converts links', async () => {
    expect(await htmlToMarkdown('<a href="https://x.com">x</a>')).toBe('[x](https://x.com)');
  });
});

describe('markdownToHtml', () => {
  it('renders headings and emphasis', async () => {
    expect(await markdownToHtml('# Hi')).toContain('<h1>Hi</h1>');
    expect(await markdownToHtml('**b**')).toContain('<strong>b</strong>');
  });
  it('sanitizes dangerous markup', async () => {
    const out = await markdownToHtml('<script>alert(1)</script>');
    expect(out).not.toContain('<script>');
  });
});
