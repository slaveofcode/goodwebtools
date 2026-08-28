/**
 * Executor registry for the model-backed agent (Sub-project B). Each entry maps
 * a GWT tool to a headless `execute()` that wraps the tool's existing (tested)
 * pure lib, plus a `match()` used to scope which tools the model may call for a
 * request — so a tiny model can't mis-pick. Tools without an executor are
 * "open-mode" (the agent opens their page pre-filled instead).
 *
 * Set: text tools, image-compress, and the ffmpeg media tools (video/audio
 * compress-to-size and audio/video trim) backed by src/tools/media/encode.lib.
 */
import { getToolById } from '@/registry/tools';

export interface FileSpec { key: string; accept: string; label: string }
export interface ParamSpec { key: string; type: 'number' | 'string'; label: string; default?: string | number }
export interface ExecResult { text?: string; blob?: Blob; filename?: string; dataUrl?: string }
export interface AgentExecutor {
  /** Unique function name the model calls. Usually a registry tool id, but for a
   *  headless op with no dedicated page it's a standalone name + a `page` ref. */
  toolId: string;
  /** Registry tool this maps to (for the guard / an "open" link), when the
   *  function name isn't itself a real tool id. Defaults to toolId. */
  page?: string;
  description: string;
  match: (q: string) => boolean;
  files: FileSpec[];
  params: ParamSpec[];
  execute: (
    inputs: { files: Record<string, File>; params: Record<string, string | number> },
    onProgress?: (p: number, note?: string) => void,
  ) => Promise<ExecResult>;
}

const re = (r: RegExp) => (q: string) => r.test(q);

export const AGENT_EXECUTORS: AgentExecutor[] = [
  {
    toolId: 'base64', description: 'Encode or decode Base64 text', match: re(/base64|b64/i),
    files: [], params: [{ key: 'text', type: 'string', label: 'Text' }],
    execute: async ({ params }) => {
      const { encodeBase64 } = await import('@/tools/dev/base64.lib');
      return { text: encodeBase64(String(params.text ?? '')) };
    },
  },
  {
    toolId: 'json-format', description: 'Format / prettify / validate JSON text', match: re(/json.*(format|pretty|beautif|indent|valid|lint)|(format|pretty|beautif|prettify).*json/i),
    files: [], params: [{ key: 'text', type: 'string', label: 'JSON' }],
    execute: async ({ params }) => {
      try { return { text: JSON.stringify(JSON.parse(String(params.text ?? '')), null, 2) }; }
      catch (e) { throw new Error('invalid JSON: ' + (e as Error).message); }
    },
  },
  {
    toolId: 'url-encode', description: 'URL-encode or URL-decode text (pass mode "encode" or "decode")',
    match: re(/url ?(encode|decode|escape|unescape)|(encode|decode|escape).*url|percent.?encod/i),
    files: [], params: [
      { key: 'text', type: 'string', label: 'Text' },
      { key: 'mode', type: 'string', label: 'encode or decode', default: 'encode' },
    ],
    execute: async ({ params }) => {
      const text = String(params.text ?? '');
      const mode = String(params.mode ?? 'encode').toLowerCase();
      return { text: mode.startsWith('dec') ? decodeURIComponent(text) : encodeURIComponent(text) };
    },
  },
  {
    toolId: 'slugify', description: 'Turn text into a URL-friendly slug', match: re(/slug(ify)?|url.?friendly|make.*slug/i),
    files: [], params: [{ key: 'text', type: 'string', label: 'Text' }],
    execute: async ({ params }) => {
      const { slugify } = await import('@/tools/dev/slugify.lib');
      return { text: slugify(String(params.text ?? '')) };
    },
  },
  {
    toolId: 'jwt-decode', description: 'Decode a JWT into its header and payload JSON', match: re(/\bjwt\b|json web token|decode.*token/i),
    files: [], params: [{ key: 'text', type: 'string', label: 'JWT token' }],
    execute: async ({ params }) => {
      const { decodeJwt } = await import('@/tools/dev/jwt.lib');
      const { header, payload } = decodeJwt(String(params.text ?? ''));
      return { text: `Header:\n${header}\n\nPayload:\n${payload}` };
    },
  },
  {
    toolId: 'lorem-ipsum', description: 'Generate placeholder lorem-ipsum text', match: re(/lorem|ipsum|placeholder text|dummy text|filler text/i),
    files: [], params: [
      { key: 'count', type: 'number', label: 'How many', default: 3 },
      { key: 'unit', type: 'string', label: 'words / sentences / paragraphs', default: 'paragraphs' },
    ],
    execute: async ({ params }) => {
      const { generateLorem } = await import('@/tools/dev/lorem.lib');
      const unit = ['words', 'sentences', 'paragraphs'].includes(String(params.unit)) ? String(params.unit) as 'words' | 'sentences' | 'paragraphs' : 'paragraphs';
      return { text: generateLorem({ count: Number(params.count) || 3, unit }) };
    },
  },
  {
    toolId: 'case-converter', description: 'Change text case (upper, lower, title, sentence, camel, pascal, snake, kebab, constant)',
    match: re(/(upper|lower|title|sentence|camel|pascal|snake|kebab|constant).?case|convert.*case|change.*case|capitali[sz]e/i),
    files: [], params: [
      { key: 'text', type: 'string', label: 'Text' },
      { key: 'style', type: 'string', label: 'Case style', default: 'title' },
    ],
    execute: async ({ params }) => {
      const t = await import('@/tools/dev/text.lib');
      const map: Record<string, (s: string) => string> = {
        upper: t.toUpper, lower: t.toLower, title: t.titleCase, sentence: t.sentenceCase,
        camel: t.camelCase, pascal: t.pascalCase, snake: t.snakeCase, kebab: t.kebabCase, constant: t.constantCase,
      };
      const fn = map[String(params.style ?? 'title').toLowerCase()] ?? t.titleCase;
      return { text: fn(String(params.text ?? '')) };
    },
  },
  {
    toolId: 'color-convert', description: 'Convert a color between HEX, RGB and HSL', match: re(/color.*(convert|hex|rgb|hsl)|(convert|to).*(hex|rgb|hsl)|#[0-9a-f]{3,8}\b/i),
    files: [], params: [{ key: 'text', type: 'string', label: 'Color (e.g. #3366ff or rgb(51,102,255))' }],
    execute: async ({ params }) => {
      const { parseColor, toHex, toHsl } = await import('@/tools/dev/color.lib');
      const rgb = parseColor(String(params.text ?? '').trim());
      if (!rgb) throw new Error('could not parse that color');
      return { text: `HEX: ${toHex(rgb)}\nRGB: rgb(${rgb.r}, ${rgb.g}, ${rgb.b})\nHSL: ${toHsl(rgb)}` };
    },
  },
  {
    toolId: 'timestamp', description: 'Convert a Unix timestamp or date to a readable date (and back)', match: re(/unix ?time|timestamp|epoch|\bto date\b|convert.*(time|date)/i),
    files: [], params: [{ key: 'text', type: 'string', label: 'Timestamp or date' }],
    execute: async ({ params }) => {
      const { parseTimestamp } = await import('@/tools/dev/timestamp.lib');
      const d = parseTimestamp(String(params.text ?? '').trim());
      if (!d) throw new Error('could not parse that timestamp or date');
      return { text: `ISO: ${d.toISOString()}\nUnix (s): ${Math.floor(d.getTime() / 1000)}\nLocal: ${d.toString()}` };
    },
  },
  {
    toolId: 'csv-json', description: 'Convert between CSV and JSON (auto-detects the direction)', match: re(/csv.*(json|convert)|json.*(csv|convert)|csv ?(to|2) ?json|json ?(to|2) ?csv/i),
    files: [], params: [{ key: 'text', type: 'string', label: 'CSV or JSON' }],
    execute: async ({ params }) => {
      const { csvToJson, jsonToCsv } = await import('@/tools/dev/csv.lib');
      const text = String(params.text ?? '').trim();
      const isJson = text.startsWith('[') || text.startsWith('{');
      return { text: isJson ? jsonToCsv(text) : csvToJson(text) };
    },
  },
  {
    toolId: 'base-convert', description: 'Convert a number between bases (pass from and to, e.g. 2, 10, 16)', match: re(/base ?\d+|binary|hex(adecimal)?|octal|radix|convert.*(base|binary|hex|octal)/i),
    files: [], params: [
      { key: 'value', type: 'string', label: 'Number' },
      { key: 'from', type: 'number', label: 'From base', default: 10 },
      { key: 'to', type: 'number', label: 'To base', default: 16 },
    ],
    execute: async ({ params }) => {
      const { parseInBase } = await import('@/tools/dev/base-convert.lib');
      const from = Number(params.from) || 10;
      const to = Number(params.to) || 16;
      const n = parseInBase(String(params.value ?? '').trim(), from);
      if (n === null) throw new Error(`"${params.value}" is not a valid base-${from} number`);
      return { text: n.toString(to) };
    },
  },
  {
    toolId: 'url-cleaner', description: 'Strip tracking parameters (utm_*, fbclid…) from a URL', match: re(/clean.*url|remove.*(tracking|utm)|strip.*(param|tracking)|utm_/i),
    files: [], params: [{ key: 'text', type: 'string', label: 'URL' }],
    execute: async ({ params }) => {
      const { cleanUrl } = await import('@/tools/dev/url-clean.lib');
      const r = cleanUrl(String(params.text ?? '').trim());
      if (!r.valid) throw new Error('that does not look like a URL');
      return { text: r.removed.length ? `${r.clean}\n\nRemoved: ${r.removed.join(', ')}` : `${r.clean}\n\n(no tracking params found)` };
    },
  },
  {
    toolId: 'password-gen', description: 'Generate a strong random password (optional length)', match: re(/password|passphrase|random ?pass|generate.*pass/i),
    files: [], params: [{ key: 'length', type: 'number', label: 'Length', default: 16 }],
    execute: async ({ params }) => {
      const { generatePassword } = await import('@/tools/dev/password.lib');
      const length = Math.max(6, Math.min(128, Number(params.length) || 16));
      return { text: generatePassword({ length, enabled: { lowercase: true, uppercase: true, numbers: true, symbols: true }, avoidAmbiguous: true, minNumbers: 1, minSpecial: 1 }) };
    },
  },
  {
    toolId: 'html-markdown', description: 'Convert between HTML and Markdown (auto-detects the direction)', match: re(/html.*(markdown|md)|(markdown|md).*html|html ?(to|2) ?md|md ?(to|2) ?html/i),
    files: [], params: [{ key: 'text', type: 'string', label: 'HTML or Markdown' }],
    execute: async ({ params }) => {
      const { htmlToMarkdown, markdownToHtml } = await import('@/tools/dev/htmlmd.lib');
      const text = String(params.text ?? '');
      const looksHtml = /<[a-z!][\s\S]*>/i.test(text);
      return { text: looksHtml ? await htmlToMarkdown(text) : await markdownToHtml(text) };
    },
  },
  {
    toolId: 'terbilang', description: 'Spell out a number in Indonesian words (terbilang)', match: re(/terbilang|angka.*(huruf|kata)|spell.*number|number.*(indonesian )?words/i),
    files: [], params: [{ key: 'value', type: 'number', label: 'Number' }],
    execute: async ({ params }) => {
      const { terbilang } = await import('@/tools/dev/terbilang.lib');
      const n = Number(params.value);
      if (!Number.isFinite(n)) throw new Error('give me a number to spell out');
      return { text: terbilang(n) };
    },
  },
  {
    toolId: 'json-toml', description: 'Convert between JSON and TOML (auto-detects the direction)', match: re(/\btoml\b/i),
    files: [], params: [{ key: 'text', type: 'string', label: 'JSON or TOML' }],
    execute: async ({ params }) => {
      const { jsonToToml, tomlToJson } = await import('@/tools/dev/toml.lib');
      const text = String(params.text ?? '').trim();
      const isJson = text.startsWith('{') || text.startsWith('[');
      return { text: isJson ? jsonToToml(text) : tomlToJson(text) };
    },
  },
  {
    toolId: 'cron-expression', description: 'Turn a plain-English schedule into a cron expression', match: re(/\bcron(tab| ?expression| ?job)?\b|schedule.*cron/i),
    files: [], params: [{ key: 'text', type: 'string', label: 'Schedule (e.g. every Monday at 9am)' }],
    execute: async ({ params }) => {
      const { naturalToCron } = await import('@/tools/dev/cron-natural.lib');
      const r = naturalToCron(String(params.text ?? '').trim());
      if (!r.ok) throw new Error(r.error);
      return { text: r.expr };
    },
  },
  {
    toolId: 'http-status', description: 'Explain an HTTP status code', match: re(/http ?status|status ?code|http \d{3}|what.*\bhttp\b/i),
    files: [], params: [{ key: 'value', type: 'number', label: 'HTTP status code' }],
    execute: async ({ params }) => {
      const { statusByCode } = await import('@/tools/dev/http-status.lib');
      const s = statusByCode(Number(params.value));
      if (!s) throw new Error(`no such HTTP status: ${params.value}`);
      return { text: `${s.code} ${s.name}\n${s.description}` };
    },
  },
  {
    toolId: 'mime-lookup', description: 'Look up the MIME type for a file extension', match: re(/mime|content.?type/i),
    files: [], params: [{ key: 'text', type: 'string', label: 'File extension (e.g. .webp)' }],
    execute: async ({ params }) => {
      const { byExtension } = await import('@/tools/dev/mime.lib');
      const ext = String(params.text ?? '').trim().replace(/^\./, '');
      const hits = byExtension(ext);
      if (!hits.length) throw new Error(`no MIME type found for ".${ext}"`);
      return { text: hits.map(h => `.${h.ext} → ${h.mime} (${h.name})`).join('\n') };
    },
  },
  {
    toolId: 'sql-format', description: 'Format / prettify a SQL query', match: re(/sql.*(format|pretty|beautif|indent)|format.*sql/i),
    files: [], params: [{ key: 'text', type: 'string', label: 'SQL' }],
    execute: async ({ params }) => {
      const { formatSql, DEFAULT_OPTIONS } = await import('@/tools/dev/sql-format.lib');
      return { text: formatSql(String(params.text ?? ''), DEFAULT_OPTIONS) };
    },
  },
  {
    toolId: 'fancy-text', description: 'Turn text into fancy Unicode styles (𝓼𝓬𝓻𝓲𝓹𝓽, 𝔤𝔬𝔱𝔥𝔦𝔠, ⓑⓤⓑⓑⓛⓔ…)', match: re(/fancy ?text|unicode.*(text|font|style)|stylish text|cool text/i),
    files: [], params: [{ key: 'text', type: 'string', label: 'Text' }],
    execute: async ({ params }) => {
      const { allStyles } = await import('@/tools/dev/fancytext.lib');
      return { text: allStyles(String(params.text ?? '')).map(s => `${s.label}: ${s.output}`).join('\n') };
    },
  },
  {
    toolId: 'braille-converter', description: 'Convert text to Braille', match: re(/braille/i),
    files: [], params: [{ key: 'text', type: 'string', label: 'Text' }],
    execute: async ({ params }) => {
      const { toBraille } = await import('@/tools/dev/braille.lib');
      return { text: toBraille(String(params.text ?? '')) };
    },
  },
  {
    toolId: 'cidr-calculator', description: 'Calculate the range, netmask and host count for a CIDR/subnet', match: re(/cidr|subnet|netmask|ip ?(range|block)/i),
    files: [], params: [{ key: 'text', type: 'string', label: 'CIDR (e.g. 192.168.1.0/24)' }],
    execute: async ({ params }) => {
      const { parseCidrAny } = await import('@/tools/dev/cidr.lib');
      return { text: JSON.stringify(parseCidrAny(String(params.text ?? '').trim()), null, 2) };
    },
  },
  {
    toolId: 'nik-decoder', description: 'Decode an Indonesian NIK (KTP number) into province, gender and birth date', match: re(/\bnik\b|nomor induk|\bktp\b/i),
    files: [], params: [{ key: 'text', type: 'string', label: 'NIK (16 digits)' }],
    execute: async ({ params }) => {
      const { parseNik } = await import('@/tools/dev/nik.lib');
      const r = parseNik(String(params.text ?? '').trim(), new Date().getFullYear());
      return {
        text: r.valid
          ? `Valid NIK\nProvince: ${r.province}\nGender: ${r.gender}\nBirth date: ${r.birthDateISO ?? 'unknown'}\nSerial: ${r.serial}`
          : `Invalid NIK: ${r.issues.join(', ') || 'unknown reason'}`,
      };
    },
  },
  {
    toolId: 'npwp-validator', description: 'Validate and format an Indonesian NPWP (tax id)', match: re(/\bnpwp\b/i),
    files: [], params: [{ key: 'text', type: 'string', label: 'NPWP' }],
    execute: async ({ params }) => {
      const { analyzeNpwp } = await import('@/tools/dev/npwp.lib');
      return { text: JSON.stringify(analyzeNpwp(String(params.text ?? '').trim()), null, 2) };
    },
  },
  {
    toolId: 'contrast-checker', description: 'Check the WCAG contrast ratio between two colors', match: re(/contrast.*(ratio|check|wcag)|wcag|color.*contrast/i),
    files: [], params: [
      { key: 'fg', type: 'string', label: 'Foreground color' },
      { key: 'bg', type: 'string', label: 'Background color' },
    ],
    execute: async ({ params }) => {
      const { parseColor, contrastRatio, wcagLevels } = await import('@/tools/dev/contrast.lib');
      const a = parseColor(String(params.fg ?? '').trim());
      const b = parseColor(String(params.bg ?? '').trim());
      if (!a || !b) throw new Error('could not parse one of the colors');
      const ratio = contrastRatio(a, b);
      const w = wcagLevels(ratio);
      return { text: `Contrast ratio: ${ratio.toFixed(2)}:1\nNormal text — AA: ${w.normalAA ? 'pass' : 'fail'}, AAA: ${w.normalAAA ? 'pass' : 'fail'}\nLarge text — AA: ${w.largeAA ? 'pass' : 'fail'}, AAA: ${w.largeAAA ? 'pass' : 'fail'}` };
    },
  },
  {
    toolId: 'emoji-picker', description: 'Search for emoji by keyword', match: re(/emoji/i),
    files: [], params: [{ key: 'text', type: 'string', label: 'Search (e.g. smile, heart)' }],
    execute: async ({ params }) => {
      const { searchGlyphs } = await import('@/tools/dev/emoji.lib');
      const hits = searchGlyphs(String(params.text ?? '').trim());
      if (!hits.length) throw new Error('no emoji found for that');
      return { text: hits.slice(0, 30).map(g => `${g.char} ${g.name}`).join('\n') };
    },
  },
  {
    toolId: 'regex-tester', description: 'Test a regular expression against some text', match: re(/regex|regular expression|test.*pattern/i),
    files: [], params: [
      { key: 'pattern', type: 'string', label: 'Regex pattern' },
      { key: 'flags', type: 'string', label: 'Flags (e.g. g, i)', default: 'g' },
      { key: 'text', type: 'string', label: 'Text to test against' },
    ],
    execute: async ({ params }) => {
      const { runRegex } = await import('@/tools/dev/regex.lib');
      return { text: JSON.stringify(runRegex(String(params.pattern ?? ''), String(params.flags ?? 'g'), String(params.text ?? '')), null, 2) };
    },
  },
  {
    toolId: 'text-diff', description: 'Show a line-by-line diff between two texts', match: re(/\bdiff\b|compare.*(text|two)|text.*diff/i),
    files: [], params: [
      { key: 'a', type: 'string', label: 'First text' },
      { key: 'b', type: 'string', label: 'Second text' },
    ],
    execute: async ({ params }) => {
      const { diffLines } = await import('@/tools/dev/diff.lib');
      const rows = diffLines(String(params.a ?? '').split('\n'), String(params.b ?? '').split('\n'));
      return { text: rows.map(r => `[${r.type}] ${r.text}`).join('\n') };
    },
  },
  {
    toolId: 'text-encrypt', description: 'Encrypt or decrypt text with a password (pass mode "encrypt"/"decrypt")', match: re(/\bencrypt\b|\bdecrypt\b|cipher|password.?protect|secret message/i),
    files: [], params: [
      { key: 'text', type: 'string', label: 'Text' },
      { key: 'password', type: 'string', label: 'Password' },
      { key: 'mode', type: 'string', label: 'encrypt or decrypt', default: 'encrypt' },
    ],
    execute: async ({ params }) => {
      const { encryptText, decryptText } = await import('@/tools/dev/textcrypt.lib');
      const mode = String(params.mode ?? 'encrypt').toLowerCase();
      const text = String(params.text ?? '');
      const pw = String(params.password ?? '');
      return { text: mode.startsWith('dec') ? await decryptText(text, pw) : await encryptText(text, pw) };
    },
  },
  {
    toolId: 'vcard-csv', description: 'Convert between vCard (.vcf) contacts and CSV (auto-detects direction)', match: re(/vcard|\bvcf\b|contact.*(csv|card|export)/i),
    files: [], params: [{ key: 'text', type: 'string', label: 'vCard or CSV' }],
    execute: async ({ params }) => {
      const { parseVcards, contactsToCsv, csvToContacts, buildVcards } = await import('@/tools/dev/vcard.lib');
      const text = String(params.text ?? '').trim();
      return { text: /begin:vcard/i.test(text) ? contactsToCsv(parseVcards(text)) : buildVcards(csvToContacts(text)) };
    },
  },
  {
    toolId: 'csv-dedupe', page: 'csv-json', description: 'Remove duplicate rows from a CSV file',
    match: re(/(dedup|de-?dup|duplicate|redundant|unique).*(csv|rows?|records?|data)|(csv|rows?|records?).*(dedup|duplicate|redundant|unique)|remove.*(duplicate|redundant).*(row|csv|record|line)/i),
    files: [{ key: 'file', accept: '.csv,text/csv', label: 'CSV file' }], params: [],
    execute: async ({ files }) => {
      const { dedupeCsvRows } = await import('@/tools/documents/office.lib');
      const { csv, removed } = dedupeCsvRows(await files.file.text());
      return { blob: new Blob([csv], { type: 'text/csv' }), filename: 'deduped.csv', text: `removed ${removed} duplicate row${removed === 1 ? '' : 's'}` };
    },
  },
  {
    toolId: 'spreadsheet-convert', page: 'spreadsheet-viewer', description: 'Convert between CSV and Excel (.xlsx) — auto-detects the direction from the file',
    match: re(/csv.*(excel|xlsx|spread ?sheet|workbook)|(excel|xlsx|spread ?sheet|workbook).*(csv|convert)|convert.*(excel|xlsx|csv|spread ?sheet)|to ?(xlsx|excel)\b|xlsx ?(to|2) ?csv/i),
    files: [{ key: 'file', accept: '.csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', label: 'CSV or Excel file' }], params: [],
    execute: async ({ files }) => {
      const XLSX = await import('xlsx');
      const file = files.file;
      const isSheet = /\.(xlsx|xls|ods)$/i.test(file.name) || /sheet|excel/i.test(file.type);
      if (isSheet) {
        const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
        const name = wb.SheetNames[0];
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
        return { blob: new Blob([csv], { type: 'text/csv' }), filename: 'sheet.csv', text: `converted "${name}" to CSV` };
      }
      const { parseCsv } = await import('@/tools/dev/csv.lib');
      const ws = XLSX.utils.aoa_to_sheet(parseCsv(await file.text()));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      const out = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
      return { blob: new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename: 'workbook.xlsx', text: 'converted to Excel (.xlsx)' };
    },
  },
  {
    toolId: 'word-count', page: 'word-counter', description: 'Count words, characters, sentences and reading time of text',
    match: re(/word ?count|count.*(words|characters)|how many words|character count|text stat|reading time/i),
    files: [], params: [{ key: 'text', type: 'string', label: 'Text' }],
    execute: async ({ params }) => {
      const { countText } = await import('@/tools/dev/text.lib');
      const s = countText(String(params.text ?? ''));
      return { text: `Words: ${s.words}\nCharacters: ${s.characters} (${s.charactersNoSpaces} without spaces)\nSentences: ${s.sentences}\nParagraphs: ${s.paragraphs}\nLines: ${s.lines}\nReading time: ~${s.readingMinutes} min` };
    },
  },
  {
    toolId: 'hash-text', description: 'Hash text (SHA-256)', match: re(/\bhash\b|sha-?\d|md5|checksum|digest/i),
    files: [], params: [{ key: 'text', type: 'string', label: 'Text' }],
    execute: async ({ params }) => {
      const { hashText } = await import('@/tools/dev/hash-text.lib');
      return { text: await hashText(String(params.text ?? ''), 'sha256') };
    },
  },
  {
    toolId: 'qr-gen', description: 'Make a QR code from text', match: re(/\bqr\b|qr ?code|barcode/i),
    files: [], params: [{ key: 'text', type: 'string', label: 'Text or URL' }],
    execute: async ({ params }) => {
      const text = String(params.text ?? '').trim();
      if (!text) throw new Error('nothing to encode — tell me the text or URL for the QR');
      const QRCode = (await import('qrcode')).default;
      return { dataUrl: await QRCode.toDataURL(text), filename: 'qr.png', text: 'made a QR code' };
    },
  },
  {
    // Generative: the model itself "draws" the icon/diagram by writing SVG markup;
    // we sanitize it and hand back a rendered, downloadable graphic. Mapped to the
    // real svg-viewer tool. Pass the full <svg>…</svg> in the `svg` arg.
    toolId: 'svg-viewer', description: 'Draw/create an SVG icon, logo, illustration, badge or simple diagram — YOU write the full <svg>…</svg> markup and pass it as "svg".',
    match: re(/\b(make|create|draw|generate|design|build|render)\b.*\b(icon|logo|svg|illustration|graphic|badge|emblem|diagram|flow ?chart|sketch|shape|avatar)\b|\bsvg\b.*(icon|logo|graphic|diagram|shape)/i),
    files: [], params: [{ key: 'svg', type: 'string', label: 'SVG markup (<svg>…</svg>)' }],
    execute: async ({ params }) => {
      const { sanitizeSvg, svgToDataUrl } = await import('@/tools/image/svg-gen.lib');
      const clean = sanitizeSvg(String(params.svg ?? ''));
      if (!clean) throw new Error('that was not valid SVG — write complete <svg>…</svg> markup');
      return { blob: new Blob([clean], { type: 'image/svg+xml' }), dataUrl: svgToDataUrl(clean), filename: 'graphic.svg', text: 'drew an SVG' };
    },
  },
  {
    // v2 code-canvas: the model writes JS that draws on a 2D `ctx`; it runs in a
    // locked-down Web Worker (no DOM, no network, hard timeout) → PNG. For charts,
    // procedural graphics, and pixel work SVG can't easily express.
    toolId: 'canvas-draw', page: 'whiteboard',
    description: 'Render anything on a 2D canvas by writing JavaScript. YOU write JS that draws on `ctx` (a CanvasRenderingContext2D of a `canvas`); it runs in a sandbox (no network) and returns a PNG. Use for charts, plots, procedural/pixel graphics.',
    match: re(/\b(draw|render|plot|paint|generate|make|create)\b.*\b(canvas|chart|graph|plot|pixel|procedural|pattern|fractal|bar ?chart|pie ?chart|line ?graph|histogram)\b|canvas.*(draw|render|code)|\bplot\b.*(data|points|function)/i),
    files: [], params: [
      { key: 'code', type: 'string', label: 'JavaScript that draws on `ctx`' },
      { key: 'width', type: 'number', label: 'Width px', default: 512 },
      { key: 'height', type: 'number', label: 'Height px', default: 512 },
    ],
    execute: async ({ params }) => {
      const { runCanvasCode, extractCode, blobToDataUrl } = await import('@/tools/image/canvas-run.lib');
      const code = extractCode(String(params.code ?? ''));
      if (!code) throw new Error('no drawing code — write JS that draws on `ctx`');
      const blob = await runCanvasCode(code, { width: Number(params.width) || 512, height: Number(params.height) || 512 });
      return { blob, dataUrl: await blobToDataUrl(blob), filename: 'canvas.png', text: 'rendered a canvas drawing' };
    },
  },
  {
    toolId: 'image-compress', description: 'Compress an image to a target size in KB',
    match: re(/(image|img|photo|pic(ture)?|jpe?g|png|webp).*(compress|small|reduce|shrink|kb|mb|size)|(compress|small|reduce|shrink).*(image|img|photo|pic(ture)?|jpe?g|png|webp)/i),
    files: [{ key: 'file', accept: 'image/*', label: 'Image' }],
    params: [{ key: 'targetKb', type: 'number', label: 'Target KB', default: 200 }],
    execute: async ({ files, params }) => {
      const { compressImageToTarget } = await import('@/tools/image/image-to-size.lib');
      const r = await compressImageToTarget(files.file, (Number(params.targetKb) || 200) * 1024, 'jpeg');
      return { blob: r.blob, filename: 'compressed.jpg', text: `compressed to ${Math.round(r.blob.size / 1024)} KB` };
    },
  },
  {
    toolId: 'video-compress', description: 'Compress a video file to a target size in megabytes',
    match: re(/(video|vid|mp4|mov|mkv|movie|clip|footage|webm).*(compress|smaller|reduce|shrink|size|\bmb\b|\bkb\b)|(compress|smaller|reduce|shrink).*(video|vid|mp4|mov|mkv|movie|clip|footage|webm)/i),
    files: [{ key: 'file', accept: 'video/*', label: 'Video' }],
    params: [
      { key: 'targetMb', type: 'number', label: 'Target MB', default: 25 },
      { key: 'maxWidth', type: 'number', label: 'Max width px (0 = keep)', default: 0 },
      { key: 'keepAudio', type: 'string', label: 'Keep audio? yes/no', default: 'yes' },
    ],
    execute: async ({ files, params }, onProgress) => {
      const { getMediaDuration, compressVideo } = await import('@/tools/media/encode.lib');
      const durationSec = await getMediaDuration(files.file);
      if (!(durationSec > 0)) throw new Error("couldn't read the video's duration");
      const keepAudio = String(params.keepAudio ?? 'yes').toLowerCase() !== 'no';
      const blob = await compressVideo(files.file, {
        targetBytes: (Number(params.targetMb) || 25) * 1024 * 1024,
        durationSec,
        maxWidth: Number(params.maxWidth) || 0,
        audioKbps: keepAudio ? 128 : 0,
      }, p => onProgress?.(p));
      return { blob, filename: 'compressed.mp4', text: `compressed to ${Math.round(blob.size / 1024 / 1024 * 10) / 10} MB` };
    },
  },
  {
    toolId: 'video-convert', description: 'Convert a video to another format — mp4, webm or mov',
    match: re(/(convert|transcode|re-?encode|change).*(video|mp4|mov|webm|mkv|clip).*(to|into|as).*(mp4|webm|mov|mkv)|(video|mp4|mov|mkv|clip)\b.*\b(to|into)\b.*(mp4|webm|mov|mkv)|\b(to|into) ?(webm|mov|mkv)\b/i),
    files: [{ key: 'file', accept: 'video/*', label: 'Video' }],
    params: [{ key: 'format', type: 'string', label: 'Format (mp4/webm/mov)', default: 'mp4' }],
    execute: async ({ files, params }, onProgress) => {
      const { convertVideo, VIDEO_FORMATS } = await import('@/tools/media/encode.lib');
      const fmt = String(params.format ?? 'mp4').toLowerCase();
      const spec = VIDEO_FORMATS.find(f => f.id === fmt);
      if (!spec) throw new Error(`unsupported format "${fmt}" — use mp4, webm or mov`);
      const blob = await convertVideo(files.file, { format: spec.id }, p => onProgress?.(p));
      return { blob, filename: `converted.${spec.id}`, text: `converted to ${spec.id.toUpperCase()} — ${Math.round(blob.size / 1024 / 1024 * 10) / 10} MB` };
    },
  },
  {
    toolId: 'video-to-gif', description: 'Turn a video into an animated GIF (optional fps and width)',
    match: re(/\bgif\b|to ?gif|make (a |an )?gif|video ?to ?gif/i),
    files: [{ key: 'file', accept: 'video/*', label: 'Video' }],
    params: [
      { key: 'fps', type: 'number', label: 'FPS', default: 12 },
      { key: 'width', type: 'number', label: 'Width px', default: 480 },
    ],
    execute: async ({ files, params }, onProgress) => {
      const { videoToGif } = await import('@/tools/media/encode.lib');
      const blob = await videoToGif(files.file, { fps: Number(params.fps) || 12, width: Number(params.width) || 480 }, p => onProgress?.(p));
      return { blob, filename: 'animation.gif', text: `made a GIF — ${Math.round(blob.size / 1024)} KB` };
    },
  },
  {
    // Backed by the real audio-convert tool: re-encoding an mp3 at a lower
    // bitrate is how you shrink it. Handles "compress this mp3 to 3 MB".
    toolId: 'audio-convert', description: 'Compress an audio file (e.g. shrink an MP3) to a target size in megabytes',
    match: re(/(audio|mp3|wav|m4a|aac|ogg|flac|song|track|sound|voice ?note).*(compress|smaller|reduce|shrink|size|\bmb\b|\bkb\b)|(compress|smaller|reduce|shrink).*(audio|mp3|wav|m4a|aac|ogg|flac|song|track|sound)/i),
    files: [{ key: 'file', accept: 'audio/*', label: 'Audio' }],
    params: [{ key: 'targetMb', type: 'number', label: 'Target MB', default: 5 }],
    execute: async ({ files, params }, onProgress) => {
      const { getMediaDuration, compressAudio } = await import('@/tools/media/encode.lib');
      const durationSec = await getMediaDuration(files.file);
      if (!(durationSec > 0)) throw new Error("couldn't read the audio's duration");
      const blob = await compressAudio(files.file, { targetBytes: (Number(params.targetMb) || 5) * 1024 * 1024, durationSec }, p => onProgress?.(p));
      return { blob, filename: 'compressed.mp3', text: `compressed to ${Math.round(blob.size / 1024)} KB` };
    },
  },
  {
    toolId: 'video-to-audio', description: 'Extract the audio track from a video as an MP3 (e.g. mp4 to mp3)',
    match: re(/(extract|get|rip|grab|pull).*(audio|sound|mp3)|(video|mp4|mov|mkv|clip|movie).*(to|into|2).*(audio|mp3|sound)|\bmp4\b.*\bmp3\b|video ?to ?audio|audio ?from ?(the )?video/i),
    files: [{ key: 'file', accept: 'video/*', label: 'Video' }],
    params: [],
    execute: async ({ files }, onProgress) => {
      const { extractAudio } = await import('@/tools/media/encode.lib');
      const blob = await extractAudio(files.file, p => onProgress?.(p));
      return { blob, filename: 'audio.mp3', text: `extracted ${Math.round(blob.size / 1024)} KB of audio` };
    },
  },
  {
    toolId: 'media-trim', description: 'Trim/cut an audio or video file to a time range (start and end, e.g. 0:10 to 0:30)',
    // Require a media noun near the verb so "crop/cut/trim IMAGE" doesn't grab the
    // audio/video trimmer (image cropping is a different, interactive tool).
    match: re(/\b(trim|cut|crop|shorten)\b.*(video|audio|clip|mp3|mp4|wav|m4a|song|track|movie|footage|recording|sound)|(video|audio|clip|mp3|mp4|wav|m4a|song|track|movie|footage|recording|sound).*\b(trim|cut|crop|shorten)\b|\b(trim|cut|shorten) (this|it|that)\b/i),
    files: [{ key: 'file', accept: 'audio/*,video/*', label: 'Audio or video' }],
    params: [
      { key: 'start', type: 'string', label: 'Start (e.g. 0:10)', default: '0' },
      { key: 'end', type: 'string', label: 'End (e.g. 0:30)' },
    ],
    execute: async ({ files, params }, onProgress) => {
      const { getMediaDuration, trimMedia } = await import('@/tools/media/encode.lib');
      const { parseTime } = await import('@/tools/media/trim.lib');
      const durationSec = await getMediaDuration(files.file);
      if (!(durationSec > 0)) throw new Error("couldn't read the media's duration");
      const startSec = parseTime(String(params.start ?? '0')) ?? 0;
      const endSec = parseTime(String(params.end ?? '')) ?? durationSec;
      const isVideo = files.file.type.startsWith('video');
      const ext = (files.file.name.match(/\.([^.]+)$/)?.[1] || (isVideo ? 'mp4' : 'mp3')).toLowerCase();
      const r = await trimMedia(files.file, { startSec, endSec, durationSec, isVideo, ext }, p => onProgress?.(p));
      return { blob: r.blob, filename: `trimmed.${r.ext}`, text: `trimmed to ${Math.round((endSec - startSec) * 10) / 10}s` };
    },
  },
];

export function scopeExecutors(query: string): AgentExecutor[] {
  return AGENT_EXECUTORS.filter(e => e.match(query));
}

export function executorFor(toolId: string): AgentExecutor | undefined {
  return AGENT_EXECUTORS.find(e => e.toolId === toolId);
}

/** Guard used by tests: every executor must reference a real tool (via `page`,
 *  else its `toolId`). Also flags duplicate function names. */
export function unknownExecutorIds(): string[] {
  return AGENT_EXECUTORS.filter(e => !getToolById(e.page ?? e.toolId)).map(e => e.toolId);
}

/** Function names must be unique (they're what the model calls). */
export function duplicateExecutorIds(): string[] {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const e of AGENT_EXECUTORS) { if (seen.has(e.toolId)) dupes.push(e.toolId); seen.add(e.toolId); }
  return dupes;
}
