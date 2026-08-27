/** Pure helpers for the Image → Base64 / Data-URI tool. */

export interface ParsedDataUri {
  mime: string;
  base64: string;
  /** Decoded byte length. */
  bytes: number;
}

/** Parse a `data:<mime>;base64,<payload>` URI. Returns null if not base64 data URI. */
export function parseDataUri(uri: string): ParsedDataUri | null {
  const m = /^data:([^;,]+)(;[^,]*)?;base64,(.*)$/s.exec(uri.trim());
  if (!m) return null;
  const base64 = m[3];
  return { mime: m[1], base64, bytes: decodedSize(base64) };
}

/** Decoded byte length of a base64 string, without actually decoding it. */
export function decodedSize(base64: string): number {
  const clean = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  if (clean.length === 0) return 0;
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - padding;
}

/** Wrap a data URI as a CSS background-image declaration. */
export function toCssBackground(dataUri: string): string {
  return `background-image: url("${dataUri}");`;
}

/** Wrap a data URI as an <img> tag. */
export function toImgTag(dataUri: string, alt = ''): string {
  return `<img src="${dataUri}" alt="${alt}" />`;
}
