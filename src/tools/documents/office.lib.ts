/**
 * Small pure helpers for the agent's office/productivity executors. XLSX
 * conversion lives in the executors (SheetJS is a heavy, dynamically-imported
 * dep); the row-level CSV logic here is pure and unit-testable.
 */
import { parseCsv } from '@/tools/dev/csv.lib';

/** Serialize a row matrix back to CSV, quoting cells that need it. */
export function toCsv(rows: string[][], delimiter = ','): string {
  const esc = (c: string) => (/[",\n\r]/.test(c) || c.includes(delimiter)) ? `"${c.replace(/"/g, '""')}"` : c;
  return rows.map(r => r.map(esc).join(delimiter)).join('\n');
}

/**
 * Remove duplicate rows from CSV text, keeping the first occurrence (so a header
 * row survives). Returns the cleaned CSV and how many rows were dropped.
 */
export function dedupeCsvRows(csv: string, delimiter = ','): { csv: string; removed: number } {
  const rows = parseCsv(csv, delimiter);
  const seen = new Set<string>();
  const kept = rows.filter(r => {
    const key = JSON.stringify(r);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { csv: toCsv(kept, delimiter), removed: rows.length - kept.length };
}
