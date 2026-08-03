import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { unzipOdt, odtToHtml } from './odt.lib';

const CONTENT = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
  xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
  xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"
  xmlns:xlink="http://www.w3.org/1999/xlink">
  <office:automatic-styles>
    <style:style style:name="T1" style:family="text">
      <style:text-properties fo:font-weight="bold"/>
    </style:style>
    <style:style style:name="T2" style:family="text">
      <style:text-properties fo:font-style="italic" style:text-underline-style="solid"/>
    </style:style>
    <style:style style:name="P1" style:family="paragraph">
      <style:paragraph-properties fo:text-align="center"/>
    </style:style>
    <text:list-style style:name="L1">
      <text:list-level-style-number text:level="1"/>
    </text:list-style>
  </office:automatic-styles>
  <office:body>
    <office:text>
      <text:h text:outline-level="1">Big Title</text:h>
      <text:h text:outline-level="3">Small Heading</text:h>
      <text:p text:style-name="P1">Centered <text:span text:style-name="T1">bold</text:span> and <text:span text:style-name="T2">italic-underline</text:span>.</text:p>
      <text:p>A &lt;tag&gt; &amp; "quote" to escape.</text:p>
      <text:list text:style-name="L1">
        <text:list-item><text:p>First</text:p></text:list-item>
        <text:list-item><text:p>Second</text:p></text:list-item>
      </text:list>
      <text:list>
        <text:list-item><text:p>Bullet</text:p></text:list-item>
      </text:list>
      <table:table>
        <table:table-row>
          <table:table-cell><text:p>R1C1</text:p></table:table-cell>
          <table:table-cell table:number-columns-spanned="2"><text:p>R1C2</text:p></table:table-cell>
        </table:table-row>
      </table:table>
      <text:p><draw:frame svg:width="3cm"><draw:image xlink:href="Pictures/img1.png"/></draw:frame></text:p>
      <text:p><text:a xlink:href="https://example.com">link</text:a> <text:a xlink:href="javascript:alert(1)">evil</text:a></text:p>
    </office:text>
  </office:body>
</office:document-content>`;

describe('odtToHtml', () => {
  const html = odtToHtml(CONTENT, '', (href) => (href === 'Pictures/img1.png' ? 'blob:xyz' : null));

  it('maps headings by outline level', () => {
    expect(html).toContain('<h1');
    expect(html).toContain('>Big Title</h1>');
    expect(html).toContain('<h3');
    expect(html).toContain('>Small Heading</h3>');
  });

  it('applies bold/italic/underline spans and paragraph alignment', () => {
    expect(html).toMatch(/<span style="[^"]*font-weight:bold[^"]*">bold<\/span>/);
    expect(html).toMatch(/<span style="[^"]*font-style:italic[^"]*text-decoration:underline[^"]*">italic-underline<\/span>/);
    expect(html).toMatch(/<p style="[^"]*text-align:center[^"]*">/);
  });

  it('escapes special characters in text', () => {
    expect(html).toContain('A &lt;tag&gt; &amp; &quot;quote&quot; to escape.');
    expect(html).not.toContain('<tag>');
  });

  it('renders ordered vs unordered lists from list styles', () => {
    expect(html).toContain('<ol>');
    expect(html).toContain('<li>');
    expect(html).toContain('First');
    expect(html).toContain('<ul>'); // second list has no numbered style
  });

  it('renders tables with colspan', () => {
    expect(html).toContain('<table');
    expect(html).toContain('<tr>');
    expect(html).toContain('R1C1');
    expect(html).toContain('colspan="2"');
  });

  it('resolves images and drops unresolved ones', () => {
    expect(html).toContain('<img src="blob:xyz"');
    expect(html).toContain('max-width:100%');
  });

  it('allows safe links but strips javascript: URLs', () => {
    expect(html).toContain('href="https://example.com"');
    expect(html).not.toContain('javascript:alert');
  });
});

describe('unzipOdt', () => {
  it('extracts content.xml, styles.xml and Pictures/', () => {
    const bytes = zipSync({
      'mimetype': strToU8('application/vnd.oasis.opendocument.text'),
      'content.xml': strToU8('<office:document-content xmlns:office="urn:x"/>'),
      'styles.xml': strToU8('<office:document-styles xmlns:office="urn:x"/>'),
      'Pictures/img1.png': new Uint8Array([1, 2, 3]),
    });
    const parts = unzipOdt(bytes);
    expect(parts.contentXml).toContain('document-content');
    expect(parts.stylesXml).toContain('document-styles');
    expect(Object.keys(parts.images)).toEqual(['Pictures/img1.png']);
    expect(parts.images['Pictures/img1.png']).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('throws when content.xml is missing (not an ODT)', () => {
    const bytes = zipSync({ 'random.txt': strToU8('nope') });
    expect(() => unzipOdt(bytes)).toThrow(/content\.xml/);
  });
});
