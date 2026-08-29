/**
 * SPIKE (throwaway): model-free query router for the client-side agent idea.
 *
 * Finding that shaped this: the catalog/palette search (`searchTools`) requires
 * EVERY query token to match (strict AND), so conversational filler ("make my
 * video smaller") collapses to zero hits. A natural-language router instead
 * needs stopword removal + soft OR scoring — implemented here, self-contained,
 * over the tool registry. This is the deterministic "retrieve + slot-fill" layer
 * the real agent would use to shortlist candidates before any model picks.
 */

import { tools } from '@/registry/tools';

export type SizeUnit = 'KB' | 'MB' | 'GB';

export interface ExtractedParams {
  size?: { value: number; unit: SizeUnit };
  number?: number;
  text?: string;
  url?: string;
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'to', 'of', 'for', 'in', 'on', 'at', 'my', 'me', 'i', 'you', 'your',
  'it', 'this', 'that', 'these', 'those', 'is', 'are', 'am', 'be', 'can', 'could', 'would',
  'should', 'please', 'want', 'wanna', 'need', 'how', 'do', 'does', 'with', 'and', 'or',
  'but', 'into', 'from', 'help', 'so', 'just', 'now', 'some', 'any', 'here', 'make', 'get',
  'turn', 'give', 'me',
]);

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/** Crude suffix stripper so "images"→"image", "converting"→"convert". */
function stem(w: string): string {
  if (w.length <= 3) return w;
  for (const suf of ['ing', 'ed', 'es', 'er', 's']) {
    if (w.endsWith(suf) && w.length - suf.length >= 3) return w.slice(0, -suf.length);
  }
  return w;
}

/** Pull obvious slot values out of a free-text request. */
export function extractParams(query: string): ExtractedParams {
  const out: ExtractedParams = {};

  const size = query.match(/(\d+(?:\.\d+)?)\s*(kb|mb|gb)\b/i);
  if (size) out.size = { value: Number(size[1]), unit: size[2].toUpperCase() as SizeUnit };

  const url = query.match(/https?:\/\/\S+/i);
  if (url) out.url = url[0];

  const quoted = query.match(/["'“”]([^"'“”]{2,})["'“”]/);
  if (quoted) out.text = quoted[1];

  const num = query.match(/\b(\d+(?:\.\d+)?)\b/);
  if (num && !out.size) out.number = Number(num[1]);

  return out;
}

export interface RoutedTool {
  id: string;
  name: string;
  route: string;
  category: string;
  /** 0–1 confidence, normalized against the top hit. */
  confidence: number;
}

export interface RouteResult {
  candidates: RoutedTool[];
  params: ExtractedParams;
}

// Fold common intent words to tool vocabulary so conversational phrasing routes.
const SYNONYMS: Record<string, string[]> = {
  small: ['compress', 'shrink', 'reduce'],
  smaller: ['compress', 'shrink', 'reduce'],
  shrink: ['compress', 'reduce'],
  reduce: ['compress', 'shrink'],
  bigger: ['upscale', 'enlarge'],
  enlarge: ['upscale'],
  scramble: ['encrypt'],
  translate: ['convert'],
  picture: ['image', 'photo'],
  photo: ['image'],
  img: ['image'],
  pic: ['image', 'photo'],
  vid: ['video'],
  gif: ['video'],
};

// Curated popularity order used only to break score ties (most popular first).
const POPULARITY: string[] = [
  'qr-gen', 'image-compress', 'video-compress', 'pdf-to-docx',
  'image-bg-remove', 'password-gen', 'json-format', 'image-resize',
];

const WEIGHTS: [keyof typeof FIELD_GETTERS, number][] = [['name', 3], ['keywords', 2], ['summary', 1]];
const FIELD_GETTERS = {
  name: (t: (typeof tools)[number]) => tokenize(t.name),
  keywords: (t: (typeof tools)[number]) => t.keywords.flatMap(tokenize),
  summary: (t: (typeof tools)[number]) => tokenize(t.summary),
};

function scoreTool(tool: (typeof tools)[number], queryStems: string[]): number {
  let score = 0;
  for (const qs of queryStems) {
    const group = [qs, ...(SYNONYMS[qs] ?? [])].map(stem);
    let best = 0;
    for (const [field, weight] of WEIGHTS) {
      const field_tokens = FIELD_GETTERS[field](tool);
      if (field_tokens.some(ft => group.includes(stem(ft)))) { best = Math.max(best, weight); break; }
    }
    score += best; // OR scoring — any matching token (or its synonym) contributes
  }
  return score;
}

// Bahasa Indonesia → English keyword bridge, so the agent works on the /id/ site.
// Appended (not replaced) to the query before matching, so mixed EN/ID also works.
const ID_EN: Record<string, string> = {
  gambar: 'image', foto: 'photo', citra: 'image', gbr: 'image',
  kompres: 'compress', mampatkan: 'compress', perkecil: 'shrink smaller', kecilkan: 'shrink smaller', kecilin: 'shrink smaller', kurangi: 'reduce', kurangin: 'reduce',
  suara: 'audio', video: 'video', musik: 'audio',
  ubah: 'convert', konversi: 'convert', konversikan: 'convert', jadikan: 'convert', mengubah: 'convert',
  potong: 'trim cut', pangkas: 'trim crop', gabung: 'merge combine', gabungkan: 'merge combine', satukan: 'merge',
  pisah: 'split', pisahkan: 'split', putar: 'rotate', rotasi: 'rotate',
  hapus: 'remove delete', duplikat: 'duplicate', ganda: 'duplicate',
  kata: 'word', huruf: 'text case', teks: 'text', tabel: 'table',
  sandi: 'password', kata_sandi: 'password', enkripsi: 'encrypt', dekripsi: 'decrypt',
  terjemah: 'translate', terjemahkan: 'translate', ringkas: 'summarize',
  buat: 'make create', bikin: 'make create', buatkan: 'make create', gambarkan: 'draw',
  unduh: 'download', warna: 'color', diagram: 'diagram', ikon: 'icon',
};
export function expandIndonesian(query: string): string {
  const extra: string[] = [];
  for (const w of query.toLowerCase().split(/[^a-z0-9]+/)) { const e = ID_EN[w]; if (e) extra.push(e); }
  return extra.length ? `${query} ${extra.join(' ')}` : query;
}

/** Route a query to the most relevant tools plus any extracted parameters. */
export function routeQuery(query: string, limit = 5): RouteResult {
  const queryStems = tokenize(expandIndonesian(query)).filter(t => !STOPWORDS.has(t)).map(stem);
  const rank = (id: string) => { const i = POPULARITY.indexOf(id); return i === -1 ? 999 : i; };
  const scored = tools
    .filter(t => !t.desktopOnly)
    .map(tool => ({ tool, score: scoreTool(tool, queryStems) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score
      || rank(a.tool.id) - rank(b.tool.id)
      || a.tool.name.localeCompare(b.tool.name));

  const top = scored[0]?.score ?? 0;
  const candidates: RoutedTool[] = scored.slice(0, limit).map(({ tool, score }) => ({
    id: tool.id,
    name: tool.name,
    route: tool.route,
    category: tool.category,
    confidence: top > 0 ? Math.round((score / top) * 100) / 100 : 0,
  }));

  const params = extractParams(query);
  // Residual payload: when no quoted text was found, treat whatever's left after
  // removing stopwords + the top tool's own vocabulary as the text content
  // (e.g. "encode base64 AABBCC" → text "AABBCC"). Heuristic; the model tier
  // (Sub-project B) does this properly.
  if (!params.text && !params.url && scored[0]) {
    const t = scored[0].tool;
    const vocab = new Set(
      [...tokenize(t.name), ...t.keywords.flatMap(tokenize), ...tokenize(t.category)].map(stem),
    );
    const residual = query.split(/\s+/).filter(w => {
      const lw = w.toLowerCase().replace(/[^a-z0-9]/gi, '');
      if (!lw || STOPWORDS.has(lw) || vocab.has(stem(lw))) return false;
      if (params.number !== undefined && lw === String(params.number)) return false;
      if (params.size && (lw === String(params.size.value) || lw === params.size.unit.toLowerCase()
        || lw === `${params.size.value}${params.size.unit}`.toLowerCase())) return false;
      return true;
    });
    if (residual.length > 0) params.text = residual.join(' ');
  }

  return { candidates, params };
}

/** Build a prefill URL for a routed tool, encoding extracted params as query string. */
export function prefillUrl(route: string, params: ExtractedParams): string {
  const q = new URLSearchParams();
  if (params.size) q.set('size', `${params.size.value}${params.size.unit}`);
  if (params.number !== undefined) q.set('n', String(params.number));
  if (params.text) q.set('text', params.text);
  if (params.url) q.set('url', params.url);
  const qs = q.toString();
  return qs ? `${route}?${qs}` : route;
}
