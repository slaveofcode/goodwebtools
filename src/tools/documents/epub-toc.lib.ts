/**
 * A single table-of-contents entry as epub.js exposes it (structurally the
 * subset of its NavItem we need). Kept dep-free so the flattening logic is
 * unit-testable without pulling in epub.js.
 */
export interface RawTocItem {
  href: string;
  label: string;
  subitems?: RawTocItem[];
}

export interface FlatTocItem {
  href: string;
  label: string;
  /** Nesting level, 0 for top-level chapters — used to indent the TOC list. */
  depth: number;
}

/**
 * Flatten epub.js's nested TOC into a depth-tagged list. Labels are trimmed
 * (EPUB nav documents are riddled with indentation newlines) and fall back to
 * the href; entries without an href are structural-only and skipped.
 */
export function flattenToc(items: RawTocItem[], depth = 0): FlatTocItem[] {
  const out: FlatTocItem[] = [];
  for (const it of items ?? []) {
    const label = (it.label ?? '').trim();
    if (it.href) out.push({ href: it.href, label: label || it.href, depth });
    if (it.subitems?.length) out.push(...flattenToc(it.subitems, depth + 1));
  }
  return out;
}
