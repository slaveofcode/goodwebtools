import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { parsePptx } from './pptx.lib';

const NS = 'xmlns:a="urn:a" xmlns:r="urn:r" xmlns:p="urn:p"';

function textSp(
  geo: { x: number; y: number; cx: number; cy: number } | null,
  text: string,
  opts: { sz?: number; b?: boolean; color?: string; align?: string; ph?: string } = {},
): string {
  const xfrm = geo
    ? `<a:xfrm><a:off x="${geo.x}" y="${geo.y}"/><a:ext cx="${geo.cx}" cy="${geo.cy}"/></a:xfrm>`
    : '';
  const ph = opts.ph ? `<p:nvSpPr><p:nvPr><p:ph type="${opts.ph}"/></p:nvPr></p:nvSpPr>` : '';
  const rPr = `<a:rPr sz="${opts.sz ?? 1800}"${opts.b ? ' b="1"' : ''}><a:solidFill><a:srgbClr val="${opts.color ?? '000000'}"/></a:solidFill></a:rPr>`;
  return `<p:sp>${ph}<p:spPr>${xfrm}</p:spPr><p:txBody><a:p><a:pPr algn="${opts.align ?? 'l'}"/><a:r>${rPr}<a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`;
}

const slide = (inner: string) => `<?xml version="1.0"?><p:sld ${NS}><p:cSld><p:spTree>${inner}</p:spTree></p:cSld></p:sld>`;
const PRES = `<?xml version="1.0"?><p:presentation ${NS}><p:sldSz cx="9144000" cy="6858000"/></p:presentation>`;

describe('parsePptx (positioned)', () => {
  it('reads slide size and shape geometry in px', () => {
    const bytes = zipSync({
      'ppt/presentation.xml': strToU8(PRES),
      'ppt/slides/slide1.xml': strToU8(
        slide(textSp({ x: 914400, y: 457200, cx: 1828800, cy: 914400 }, 'Hello', { sz: 1800, b: true, color: 'C00000', align: 'ctr' })),
      ),
    });
    const doc = parsePptx(bytes);
    expect(doc.widthPx).toBe(960);
    expect(doc.heightPx).toBe(720);
    expect(doc.slides).toHaveLength(1);
    const shape = doc.slides[0].shapes[0];
    expect(shape).toMatchObject({ kind: 'text', x: 96, y: 48, w: 192, h: 96 });
    expect(shape.paragraphs![0].align).toBe('center');
    const run = shape.paragraphs![0].runs[0];
    expect(run).toEqual({ text: 'Hello', bold: true, italic: false, sizePt: 18, color: '#C00000' });
  });

  it('resolves inherited placeholder geometry from the layout', () => {
    const bytes = zipSync({
      'ppt/slides/slide1.xml': strToU8(slide(textSp(null, 'Title text', { ph: 'title' }))),
      'ppt/slides/_rels/slide1.xml.rels': strToU8(
        `<Relationships><Relationship Id="rId1" Type="x/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`,
      ),
      'ppt/slideLayouts/slideLayout1.xml': strToU8(
        slide(textSp({ x: 100000, y: 200000, cx: 300000, cy: 400000 }, '', { ph: 'title' })),
      ),
    });
    const doc = parsePptx(bytes);
    const shape = doc.slides[0].shapes[0];
    expect(shape.x).toBe(emu(100000));
    expect(shape.paragraphs![0].runs[0].text).toBe('Title text');
  });

  it('places an embedded image via rels', () => {
    const bytes = zipSync({
      'ppt/slides/slide1.xml': strToU8(
        slide(`<p:pic><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm></p:spPr><p:blipFill><a:blip r:embed="rId2"/></p:blipFill></p:pic>`),
      ),
      'ppt/slides/_rels/slide1.xml.rels': strToU8(
        `<Relationships><Relationship Id="rId2" Target="../media/image1.png"/></Relationships>`,
      ),
      'ppt/media/image1.png': new Uint8Array([1, 2, 3]),
    });
    const doc = parsePptx(bytes);
    const img = doc.slides[0].shapes.find(s => s.kind === 'image');
    expect(img).toMatchObject({ kind: 'image', imageKey: 'ppt/media/image1.png', w: 96, h: 96 });
  });

  it('orders slides numerically', () => {
    const bytes = zipSync({
      'ppt/slides/slide2.xml': strToU8(slide(textSp({ x: 0, y: 0, cx: 100, cy: 100 }, 'two'))),
      'ppt/slides/slide10.xml': strToU8(slide(textSp({ x: 0, y: 0, cx: 100, cy: 100 }, 'ten'))),
      'ppt/slides/slide1.xml': strToU8(slide(textSp({ x: 0, y: 0, cx: 100, cy: 100 }, 'one'))),
    });
    const doc = parsePptx(bytes);
    expect(doc.slides.map(s => s.shapes[0].paragraphs![0].runs[0].text)).toEqual(['one', 'two', 'ten']);
  });
});

function emu(v: number): number {
  return Math.round(v / 9525);
}
