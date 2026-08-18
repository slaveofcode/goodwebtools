/**
 * Curated emoji + special-character dataset with keyword search. Pure data +
 * a search function; the island renders the grid and copies on click. Not the
 * full Unicode set — a practical pick of the characters people re-search for.
 */

export interface Glyph {
  char: string;
  name: string;
  group: string;
  keywords: string;
}

export const GLYPH_GROUPS = [
  'Smileys', 'Gestures', 'People & Symbols', 'Nature', 'Food', 'Travel',
  'Objects', 'Symbols', 'Punctuation', 'Currency', 'Math', 'Arrows', 'Greek',
] as const;

const G = (char: string, name: string, group: string, keywords = ''): Glyph => ({ char, name, group, keywords });

export const GLYPHS: Glyph[] = [
  // Smileys
  G('😀', 'grinning face', 'Smileys', 'happy smile'),
  G('😁', 'beaming face', 'Smileys', 'grin happy'),
  G('😂', 'face with tears of joy', 'Smileys', 'lol laugh cry funny'),
  G('🤣', 'rolling on the floor laughing', 'Smileys', 'rofl lol'),
  G('🙂', 'slightly smiling face', 'Smileys', 'smile'),
  G('😉', 'winking face', 'Smileys', 'wink'),
  G('😍', 'smiling face with heart-eyes', 'Smileys', 'love heart'),
  G('😎', 'smiling face with sunglasses', 'Smileys', 'cool'),
  G('😊', 'smiling face with smiling eyes', 'Smileys', 'blush happy'),
  G('🤔', 'thinking face', 'Smileys', 'hmm think'),
  G('😅', 'grinning face with sweat', 'Smileys', 'phew nervous'),
  G('😭', 'loudly crying face', 'Smileys', 'sob cry'),
  G('😳', 'flushed face', 'Smileys', 'embarrassed'),
  G('🥳', 'partying face', 'Smileys', 'party celebrate'),
  G('😴', 'sleeping face', 'Smileys', 'sleep tired'),
  G('🙄', 'face with rolling eyes', 'Smileys', 'eyeroll'),
  G('😬', 'grimacing face', 'Smileys', 'awkward'),
  G('🤯', 'exploding head', 'Smileys', 'mind blown'),
  G('🥲', 'smiling face with tear', 'Smileys', 'happy sad'),
  G('😇', 'smiling face with halo', 'Smileys', 'angel innocent'),
  // Gestures
  G('👍', 'thumbs up', 'Gestures', 'like approve yes'),
  G('👎', 'thumbs down', 'Gestures', 'dislike no'),
  G('👏', 'clapping hands', 'Gestures', 'applause clap'),
  G('🙏', 'folded hands', 'Gestures', 'please thanks pray'),
  G('🤝', 'handshake', 'Gestures', 'deal agree'),
  G('👌', 'OK hand', 'Gestures', 'okay perfect'),
  G('✌️', 'victory hand', 'Gestures', 'peace'),
  G('🤞', 'crossed fingers', 'Gestures', 'luck hope'),
  G('👋', 'waving hand', 'Gestures', 'hello bye wave'),
  G('💪', 'flexed biceps', 'Gestures', 'strong muscle'),
  G('🫶', 'heart hands', 'Gestures', 'love'),
  G('🤙', 'call me hand', 'Gestures', 'shaka hang loose'),
  // People & Symbols
  G('❤️', 'red heart', 'People & Symbols', 'love'),
  G('🔥', 'fire', 'People & Symbols', 'lit hot flame'),
  G('⭐', 'star', 'People & Symbols', 'favourite'),
  G('✨', 'sparkles', 'People & Symbols', 'shiny magic'),
  G('🎉', 'party popper', 'People & Symbols', 'celebrate congrats'),
  G('💯', 'hundred points', 'People & Symbols', 'perfect 100'),
  G('👀', 'eyes', 'People & Symbols', 'looking watch'),
  G('💩', 'pile of poo', 'People & Symbols', 'poop'),
  G('🧠', 'brain', 'People & Symbols', 'smart'),
  G('💡', 'light bulb', 'People & Symbols', 'idea'),
  G('🚀', 'rocket', 'People & Symbols', 'launch ship fast'),
  G('💀', 'skull', 'People & Symbols', 'dead dying'),
  // Nature
  G('🐶', 'dog face', 'Nature', 'puppy'),
  G('🐱', 'cat face', 'Nature', 'kitten'),
  G('🌳', 'deciduous tree', 'Nature', 'tree plant'),
  G('🌸', 'cherry blossom', 'Nature', 'flower spring'),
  G('☀️', 'sun', 'Nature', 'sunny weather'),
  G('🌙', 'crescent moon', 'Nature', 'night'),
  G('⚡', 'high voltage', 'Nature', 'lightning power'),
  G('❄️', 'snowflake', 'Nature', 'snow cold winter'),
  G('🌈', 'rainbow', 'Nature', 'pride colour'),
  // Food
  G('🍕', 'pizza', 'Food', 'slice'),
  G('🍔', 'hamburger', 'Food', 'burger'),
  G('☕', 'hot beverage', 'Food', 'coffee tea'),
  G('🍺', 'beer mug', 'Food', 'drink'),
  G('🎂', 'birthday cake', 'Food', 'party'),
  G('🍎', 'red apple', 'Food', 'fruit'),
  // Travel
  G('🚗', 'car', 'Travel', 'drive auto'),
  G('✈️', 'airplane', 'Travel', 'flight fly'),
  G('🏠', 'house', 'Travel', 'home'),
  G('🌍', 'globe europe-africa', 'Travel', 'earth world'),
  G('📍', 'round pushpin', 'Travel', 'location pin map'),
  // Objects
  G('💻', 'laptop', 'Objects', 'computer code'),
  G('📱', 'mobile phone', 'Objects', 'smartphone'),
  G('⌚', 'watch', 'Objects', 'time clock'),
  G('📷', 'camera', 'Objects', 'photo'),
  G('🔒', 'locked', 'Objects', 'secure lock'),
  G('🔑', 'key', 'Objects', 'unlock password'),
  G('📎', 'paperclip', 'Objects', 'attach'),
  G('✏️', 'pencil', 'Objects', 'edit write'),
  G('📌', 'pushpin', 'Objects', 'pin'),
  // Symbols
  G('✅', 'check mark button', 'Symbols', 'done yes tick'),
  G('❌', 'cross mark', 'Symbols', 'no wrong x'),
  G('⚠️', 'warning', 'Symbols', 'caution alert'),
  G('❓', 'question mark', 'Symbols', 'help'),
  G('❗', 'exclamation mark', 'Symbols', 'important'),
  G('♻️', 'recycling symbol', 'Symbols', 'recycle eco'),
  G('™️', 'trade mark', 'Symbols', 'tm'),
  G('©️', 'copyright', 'Symbols', 'c'),
  G('®️', 'registered', 'Symbols', 'r'),
  G('✔️', 'check mark', 'Symbols', 'tick done'),
  G('★', 'black star', 'Symbols', 'filled star favourite'),
  G('☆', 'white star', 'Symbols', 'empty star'),
  G('•', 'bullet', 'Symbols', 'dot list'),
  G('▶', 'play', 'Symbols', 'triangle right'),
  G('♥', 'heart suit', 'Symbols', 'love card'),
  // Punctuation
  G('—', 'em dash', 'Punctuation', 'long dash'),
  G('–', 'en dash', 'Punctuation', 'range dash'),
  G('…', 'horizontal ellipsis', 'Punctuation', 'dots'),
  G('“', 'left double quote', 'Punctuation', 'curly quote'),
  G('”', 'right double quote', 'Punctuation', 'curly quote'),
  G('‘', 'left single quote', 'Punctuation', 'apostrophe'),
  G('’', 'right single quote', 'Punctuation', 'apostrophe'),
  G('«', 'left guillemet', 'Punctuation', 'quote'),
  G('»', 'right guillemet', 'Punctuation', 'quote'),
  G('·', 'middle dot', 'Punctuation', 'interpunct'),
  G('′', 'prime', 'Punctuation', 'feet minutes'),
  G('″', 'double prime', 'Punctuation', 'inches seconds'),
  G('¶', 'pilcrow', 'Punctuation', 'paragraph'),
  G('§', 'section sign', 'Punctuation', 'section'),
  // Currency
  G('€', 'euro', 'Currency', 'eur money'),
  G('£', 'pound', 'Currency', 'gbp money'),
  G('¥', 'yen', 'Currency', 'jpy yuan money'),
  G('₹', 'rupee', 'Currency', 'inr india money'),
  G('₩', 'won', 'Currency', 'krw korea money'),
  G('¢', 'cent', 'Currency', 'money'),
  G('₽', 'ruble', 'Currency', 'rub money'),
  G('₿', 'bitcoin', 'Currency', 'btc crypto'),
  G('฿', 'baht', 'Currency', 'thb thailand money'),
  // Math
  G('±', 'plus-minus', 'Math', 'plusminus tolerance'),
  G('×', 'multiplication', 'Math', 'times multiply'),
  G('÷', 'division', 'Math', 'divide'),
  G('≈', 'almost equal', 'Math', 'approx'),
  G('≠', 'not equal', 'Math', 'ne'),
  G('≤', 'less than or equal', 'Math', 'lte'),
  G('≥', 'greater than or equal', 'Math', 'gte'),
  G('∞', 'infinity', 'Math', 'infinite'),
  G('√', 'square root', 'Math', 'sqrt radical'),
  G('π', 'pi', 'Math', 'pi 3.14'),
  G('°', 'degree', 'Math', 'degrees temperature angle'),
  G('µ', 'micro', 'Math', 'micron mu'),
  G('∑', 'summation', 'Math', 'sum sigma'),
  G('∆', 'delta', 'Math', 'change difference'),
  G('½', 'one half', 'Math', 'fraction'),
  G('¼', 'one quarter', 'Math', 'fraction'),
  G('¾', 'three quarters', 'Math', 'fraction'),
  // Arrows
  G('←', 'left arrow', 'Arrows', 'back'),
  G('→', 'right arrow', 'Arrows', 'next forward'),
  G('↑', 'up arrow', 'Arrows', 'up'),
  G('↓', 'down arrow', 'Arrows', 'down'),
  G('↔', 'left-right arrow', 'Arrows', 'horizontal'),
  G('⇒', 'rightwards double arrow', 'Arrows', 'implies then'),
  G('⇧', 'upwards white arrow', 'Arrows', 'shift'),
  G('⌘', 'command', 'Arrows', 'cmd mac key'),
  G('⌥', 'option', 'Arrows', 'alt mac key'),
  G('⏎', 'return', 'Arrows', 'enter'),
  G('⇥', 'tab', 'Arrows', 'tab key'),
  // Greek
  G('α', 'alpha', 'Greek', 'greek'),
  G('β', 'beta', 'Greek', 'greek'),
  G('γ', 'gamma', 'Greek', 'greek'),
  G('δ', 'delta', 'Greek', 'greek'),
  G('θ', 'theta', 'Greek', 'greek angle'),
  G('λ', 'lambda', 'Greek', 'greek'),
  G('σ', 'sigma', 'Greek', 'greek'),
  G('φ', 'phi', 'Greek', 'greek'),
  G('ω', 'omega', 'Greek', 'greek'),
  G('Ω', 'omega (capital)', 'Greek', 'greek ohm'),
];

/**
 * Free-text search over char, name and keywords, ranked so the most direct
 * match wins (exact char / name over an incidental substring). Empty query
 * returns everything.
 */
export function searchGlyphs(query: string): Glyph[] {
  const raw = query.trim();
  const q = raw.toLowerCase();
  if (!q) return GLYPHS;

  const score = (g: Glyph): number => {
    const name = g.name.toLowerCase();
    const kw = ` ${g.keywords} `;
    if (g.char === raw) return 0;
    if (name === q) return 1;
    if (kw.includes(` ${q} `)) return 2;         // whole-word keyword hit
    if (name.startsWith(q)) return 3;
    if (name.includes(q)) return 4;
    if (g.keywords.includes(q)) return 5;
    if (g.group.toLowerCase().includes(q)) return 6;
    return Infinity;
  };

  return GLYPHS
    .map((g, i) => ({ g, s: score(g), i }))
    .filter((x) => x.s !== Infinity)
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map((x) => x.g);
}
