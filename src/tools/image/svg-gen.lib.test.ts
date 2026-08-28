import { describe, it, expect } from 'vitest';
import { extractSvg, sanitizeSvg, svgToDataUrl } from './svg-gen.lib';

describe('extractSvg', () => {
  it('pulls the svg out of a markdown code fence', () => {
    const out = extractSvg('Sure!\n```svg\n<svg viewBox="0 0 10 10"><rect/></svg>\n```\nEnjoy');
    expect(out).toBe('<svg viewBox="0 0 10 10"><rect/></svg>');
  });
  it('returns empty when there is no svg', () => {
    expect(extractSvg('just some text')).toBe('');
  });
});

describe('sanitizeSvg', () => {
  it('keeps drawing elements', () => {
    const out = sanitizeSvg('<svg><circle cx="5" cy="5" r="4"/></svg>');
    expect(out).toContain('<svg');
    expect(out).toContain('circle');
  });
  it('strips <script> from the svg', () => {
    const out = sanitizeSvg('<svg><script>alert(1)</script><rect width="10" height="10"/></svg>');
    expect(out).not.toMatch(/<script/i);
    expect(out).toContain('rect');
  });
  it('strips inline event handlers', () => {
    const out = sanitizeSvg('<svg><rect onclick="steal()" width="10" height="10"/></svg>');
    expect(out).not.toMatch(/onclick/i);
  });
  it('returns empty for non-svg input', () => {
    expect(sanitizeSvg('<div>not svg</div>')).toBe('');
    expect(sanitizeSvg('hello')).toBe('');
  });
});

describe('svgToDataUrl', () => {
  it('produces an image/svg+xml data url', () => {
    expect(svgToDataUrl('<svg></svg>')).toMatch(/^data:image\/svg\+xml;utf8,/);
  });
});
