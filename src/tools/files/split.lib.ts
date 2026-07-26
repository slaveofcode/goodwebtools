export interface PartRange {
  index: number; // 0-based
  start: number;
  end: number; // exclusive
}

/** Byte ranges for splitting a file of `totalBytes` into `chunkBytes` pieces. */
export function splitRanges(totalBytes: number, chunkBytes: number): PartRange[] {
  if (chunkBytes <= 0) throw new Error('Choose a part size greater than 0.');
  if (totalBytes <= 0) return [];
  const ranges: PartRange[] = [];
  let index = 0;
  for (let start = 0; start < totalBytes; start += chunkBytes) {
    ranges.push({ index, start, end: Math.min(start + chunkBytes, totalBytes) });
    index++;
  }
  return ranges;
}

/** Zero-padded part name, e.g. partName('a.zip', 0, 12) → 'a.zip.001'. */
export function partName(baseName: string, index: number, total: number): string {
  const width = Math.max(3, String(total).length);
  return `${baseName}.${String(index + 1).padStart(width, '0')}`;
}

/** Recover the original name by stripping a trailing .NNN part suffix. */
export function joinedName(partFileName: string): string {
  const stripped = partFileName.replace(/\.\d+$/, '');
  return stripped && stripped !== partFileName ? stripped : `${partFileName}.joined`;
}

/**
 * Natural-order comparison so 'f.2' sorts before 'f.10'. Used to order the
 * dropped parts before joining.
 */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}
