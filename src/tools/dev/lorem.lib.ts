/**
 * Deterministic-ish Lorem Ipsum generator. Pure and framework-free.
 * A seedable PRNG keeps output reproducible in tests while still looking varied.
 */

const WORDS = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
  'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
  'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
  'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo',
  'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit', 'voluptate',
  'velit', 'esse', 'cillum', 'eu', 'fugiat', 'nulla', 'pariatur', 'excepteur',
  'sint', 'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui',
  'officia', 'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum', 'perspiciatis',
  'unde', 'omnis', 'iste', 'natus', 'error', 'voluptatem', 'accusantium',
  'doloremque', 'laudantium', 'totam', 'rem', 'aperiam', 'eaque', 'ipsa', 'quae',
  'ab', 'illo', 'inventore', 'veritatis', 'quasi', 'architecto', 'beatae', 'vitae',
  'dicta', 'explicabo', 'nemo', 'ipsam', 'quia', 'voluptas', 'aspernatur', 'aut',
  'odit', 'fugit', 'consequuntur', 'magni', 'dolores', 'eos', 'ratione',
];

const LEAD = 'lorem ipsum dolor sit amet consectetur adipiscing elit'.split(' ');

export type LoremUnit = 'words' | 'sentences' | 'paragraphs';

export interface LoremOptions {
  unit?: LoremUnit;
  /** How many words / sentences / paragraphs to produce. */
  count?: number;
  /** Begin the output with the classic "Lorem ipsum dolor sit amet…". */
  startWithLorem?: boolean;
  /** Seed for reproducible output. */
  seed?: number;
}

/** Small deterministic PRNG (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

function makeSentence(rand: () => number, lead: boolean): string {
  const len = 6 + Math.floor(rand() * 10); // 6–15 words
  const picked: string[] = [];
  if (lead) picked.push(...LEAD.slice(0, Math.min(LEAD.length, len)));
  while (picked.length < len) picked.push(WORDS[Math.floor(rand() * WORDS.length)]);
  const words = picked.slice(0, len);
  // Sprinkle a comma somewhere in the middle for a natural rhythm.
  if (len > 6 && rand() > 0.4) {
    const at = 2 + Math.floor(rand() * (len - 4));
    words[at] = words[at] + ',';
  }
  return cap(words.join(' ')) + '.';
}

/** Generate lorem ipsum text as words, sentences or paragraphs. */
export function generateLorem(opts: LoremOptions = {}): string {
  const { unit = 'paragraphs', count = 3, startWithLorem = true, seed = 1 } = opts;
  const n = Math.max(0, Math.min(Math.floor(count), 1000));
  if (n === 0) return '';
  const rand = rng(seed);

  if (unit === 'words') {
    const out: string[] = [];
    if (startWithLorem) out.push(...LEAD.slice(0, Math.min(LEAD.length, n)));
    while (out.length < n) out.push(WORDS[Math.floor(rand() * WORDS.length)]);
    return cap(out.slice(0, n).join(' '));
  }

  if (unit === 'sentences') {
    const out: string[] = [];
    for (let i = 0; i < n; i++) out.push(makeSentence(rand, startWithLorem && i === 0));
    return out.join(' ');
  }

  // paragraphs
  const paras: string[] = [];
  for (let p = 0; p < n; p++) {
    const sentences = 3 + Math.floor(rand() * 4); // 3–6 sentences
    const s: string[] = [];
    for (let i = 0; i < sentences; i++) s.push(makeSentence(rand, startWithLorem && p === 0 && i === 0));
    paras.push(s.join(' '));
  }
  return paras.join('\n\n');
}
