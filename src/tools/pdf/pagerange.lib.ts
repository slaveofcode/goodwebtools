/**
 * Parse a human page range like "1-3,5,7-9" into a sorted, de-duplicated list of
 * 1-based page numbers. Pure/testable; used by the agent's PDF executors.
 */
export function parsePageRange(input: string): number[] {
  const pages = new Set<number>();
  for (const part of String(input).split(',')) {
    const t = part.trim();
    if (!t) continue;
    const range = t.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const a = Number(range[1]), b = Number(range[2]);
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) pages.add(i);
    } else if (/^\d+$/.test(t)) {
      pages.add(Number(t));
    }
  }
  return [...pages].filter(n => n > 0).sort((a, b) => a - b);
}
