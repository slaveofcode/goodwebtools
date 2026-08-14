import { describe, it, expect } from 'vitest';
import { minifyHtml, minifyCss, minifyJs } from './minify.lib';

describe('minifyHtml', () => {
  it('collapses whitespace and strips comments', () => {
    const out = minifyHtml('<div>   <p>Hi</p>  <!-- note -->  </div>');
    expect(out).toBe('<div><p>Hi</p></div>');
  });

  it('preserves <pre> and <script> contents', () => {
    const html = '<pre>a\n  b</pre>\n<script>const x = 1 ;</script>';
    const out = minifyHtml(html);
    expect(out).toContain('<pre>a\n  b</pre>');
    expect(out).toContain('const x = 1 ;');
  });

  it('does not corrupt digit runs in text', () => {
    expect(minifyHtml('<p>item 5 done</p>')).toBe('<p>item 5 done</p>');
  });

  it('keeps IE conditional comments', () => {
    const out = minifyHtml('<!--[if IE]><p>x</p><![endif]-->');
    expect(out).toContain('[if IE]');
  });
});

describe('minifyCss', () => {
  it('removes whitespace', async () => {
    const out = await minifyCss('a {\n  color: red;\n  margin: 0;\n}');
    expect(out).toBe('a{color:red;margin:0}');
  });
});

describe('minifyJs', () => {
  it('shrinks and mangles', async () => {
    const out = await minifyJs('function add(first, second) {\n  return first + second;\n}\n');
    expect(out.length).toBeLessThan(40);
    expect(out).toContain('return');
  });
});
