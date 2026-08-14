import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { parsePptx } from './pptx.lib';

const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

function slideXml(paras: string[], embed?: string): string {
  const body = paras
    .map(p => `<a:p><a:r><a:t>${p}</a:t></a:r></a:p>`)
    .join('');
  const pic = embed ? `<p:pic><a:blip r:embed="${embed}"/></p:pic>` : '';
  return `<?xml version="1.0"?><p:sld ${NS}>${body}${pic}</p:sld>`;
}

describe('parsePptx', () => {
  it('reads ordered slide text', () => {
    const bytes = zipSync({
      'ppt/slides/slide1.xml': strToU8(slideXml(['Hello', 'World'])),
      'ppt/slides/slide2.xml': strToU8(slideXml(['Second slide'])),
    });
    const doc = parsePptx(bytes);
    expect(doc.slides).toHaveLength(2);
    expect(doc.slides[0].paragraphs).toEqual(['Hello', 'World']);
    expect(doc.slides[1].paragraphs).toEqual(['Second slide']);
  });

  it('resolves an embedded image via slide rels', () => {
    const bytes = zipSync({
      'ppt/slides/slide1.xml': strToU8(slideXml(['With image'], 'rId2')),
      'ppt/slides/_rels/slide1.xml.rels': strToU8(
        `<?xml version="1.0"?><Relationships><Relationship Id="rId2" Target="../media/image1.png"/></Relationships>`,
      ),
      'ppt/media/image1.png': new Uint8Array([1, 2, 3]),
    });
    const doc = parsePptx(bytes);
    expect(doc.slides[0].images).toEqual(['ppt/media/image1.png']);
    expect(doc.media['ppt/media/image1.png']).toBeDefined();
  });

  it('orders slides numerically, not lexically', () => {
    const bytes = zipSync({
      'ppt/slides/slide2.xml': strToU8(slideXml(['two'])),
      'ppt/slides/slide10.xml': strToU8(slideXml(['ten'])),
      'ppt/slides/slide1.xml': strToU8(slideXml(['one'])),
    });
    const doc = parsePptx(bytes);
    expect(doc.slides.map(s => s.paragraphs[0])).toEqual(['one', 'two', 'ten']);
  });
});
