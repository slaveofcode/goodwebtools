/**
 * Build-time per-tool Open Graph images (1200×630 PNG) in the site's neo-brutalist
 * style. Rendered with satori (HTML/flexbox → SVG) + resvg (SVG → PNG). Output goes
 * to public/og/<tool-id>.png, which [tool].astro references as og:image/twitter:image.
 * Generated at build (prebuild), not committed. Pass a tool id as argv[2] to render
 * just one (for local testing).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const OUT = 'public/og';
mkdirSync(OUT, { recursive: true });

const fontDir = 'node_modules/@fontsource/space-grotesk/files';
const fonts = [
  { name: 'Space Grotesk', weight: 700, style: 'normal', data: readFileSync(`${fontDir}/space-grotesk-latin-700-normal.woff`) },
  { name: 'Space Grotesk', weight: 500, style: 'normal', data: readFileSync(`${fontDir}/space-grotesk-latin-500-normal.woff`) },
];

const CAT_COLOR = {
  Dev: '#3b82f6', PDF: '#ef4444', Image: '#22c55e', Files: '#eab308', Draw: '#a855f7',
  Media: '#ec4899', Network: '#06b6d4', Maps: '#10b981', Playground: '#f97316',
};

// Parse the registry without importing TS (aliases + lucide). id, name, category, summary.
function readTools() {
  const src = readFileSync('src/registry/tools.ts', 'utf8');
  const re = /\{\s*id:\s*'([^']+)'[\s\S]*?load:\s*\(\)\s*=>\s*import\('[^']+'\)[^}]*\}/g;
  const tools = [];
  let m;
  while ((m = re.exec(src))) {
    const e = m[0], id = m[1];
    const g = rx => (e.match(rx) || [])[1] || '';
    tools.push({ id, name: g(/name:\s*'([^']*)'/), category: g(/category:\s*'([^']*)'/), summary: g(/summary:\s*'([^']*)'/) });
  }
  return tools;
}

const h = (type, style, children) => ({ type, props: { style, ...(children !== undefined ? { children } : {}) } });

function template(tool) {
  const color = CAT_COLOR[tool.category] || '#0a0a0a';
  return h('div', {
    width: 1200, height: 630, display: 'flex', flexDirection: 'column',
    backgroundColor: '#fffdf5', fontFamily: 'Space Grotesk', color: '#0a0a0a',
  }, [
    h('div', { height: 20, backgroundColor: color, display: 'flex' }),
    h('div', { display: 'flex', flexDirection: 'column', flexGrow: 1, padding: 64, justifyContent: 'space-between' }, [
      h('div', { display: 'flex', flexDirection: 'column' }, [
        h('div', {
          display: 'flex', alignSelf: 'flex-start', border: '4px solid #0a0a0a', backgroundColor: color,
          padding: '4px 18px', fontSize: 26, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
        }, tool.category),
        h('div', { marginTop: 34, fontSize: 78, fontWeight: 700, lineHeight: 1.04, letterSpacing: -1 }, tool.name),
        h('div', { marginTop: 26, fontSize: 32, fontWeight: 500, color: '#444444', maxWidth: 980 }, tool.summary),
      ]),
      h('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, [
        h('div', { display: 'flex', alignItems: 'center' }, [
          h('div', { width: 28, height: 28, backgroundColor: '#0a0a0a', display: 'flex', marginRight: 14 }),
          h('div', { fontSize: 34, fontWeight: 700 }, 'GoodWebTools'),
        ]),
        h('div', { fontSize: 26, fontWeight: 500, color: '#444444' }, 'Free · Private · In your browser'),
      ]),
    ]),
  ]);
}

async function render(tool) {
  const svg = await satori(template(tool), { width: 1200, height: 630, fonts });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  writeFileSync(`${OUT}/${tool.id}.png`, png);
}

const only = process.argv[2];
const tools = readTools().filter(t => !only || t.id === only);
let n = 0;
for (const tool of tools) { await render(tool); n++; }
console.log(`Generated ${n} OG image(s) → ${OUT}/`);
