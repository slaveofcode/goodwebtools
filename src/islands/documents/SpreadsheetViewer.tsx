import { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { colLabel, readWorkbook, type SheetView } from '@/tools/documents/spreadsheet.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  intro: string; drop: string; dropSub: string; how: string;
  opening: string; another: string; errRead: string; empty: string;
  truncated: (r: number, c: number) => string;
}> = {
  en: {
    intro: 'Open a spreadsheet (.xlsx, .xls, .ods or .csv) and read every sheet as a table — right here in your browser. Nothing is uploaded.',
    drop: 'Drop a spreadsheet', dropSub: '.xlsx · .xls · .ods · .csv — read on your device, no upload.',
    how: 'Excel, OpenDocument and CSV files are all supported. Formulas are shown as their last-saved values.',
    opening: 'Reading…', another: 'Open another', errRead: 'Could not read this spreadsheet — is it a valid .xlsx, .xls, .ods or .csv file?',
    empty: 'This sheet is empty.',
    truncated: (r, c) => `Large sheet — showing the first ${Math.min(500, r).toLocaleString()} rows and ${Math.min(60, c)} columns of ${r.toLocaleString()} × ${c}.`,
  },
  id: {
    intro: 'Buka spreadsheet (.xlsx, .xls, .ods, atau .csv) dan baca setiap lembar sebagai tabel — langsung di browser Anda. Tidak ada yang diunggah.',
    drop: 'Letakkan spreadsheet', dropSub: '.xlsx · .xls · .ods · .csv — dibaca di perangkat Anda, tanpa unggahan.',
    how: 'Berkas Excel, OpenDocument, dan CSV semuanya didukung. Rumus ditampilkan sebagai nilai terakhir yang disimpan.',
    opening: 'Membaca…', another: 'Buka yang lain', errRead: 'Tidak dapat membaca spreadsheet ini — apakah berkas .xlsx, .xls, .ods, atau .csv yang valid?',
    empty: 'Lembar ini kosong.',
    truncated: (r, c) => `Lembar besar — menampilkan ${Math.min(500, r).toLocaleString()} baris dan ${Math.min(60, c)} kolom pertama dari ${r.toLocaleString()} × ${c}.`,
  },
};

export default function SpreadsheetViewer({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [sheets, setSheets] = useState<SheetView[]>([]);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onDrop = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setError('');
    setBusy(true);
    try {
      const buf = await f.arrayBuffer();
      const XLSX = await import('xlsx');
      const views = readWorkbook(new Uint8Array(buf), XLSX);
      setSheets(views);
      setActive(0);
    } catch {
      setError(t.errRead);
      setSheets([]);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setSheets([]);
    setActive(0);
    setError('');
  };

  const sheet = sheets[active];
  const colCount = sheet?.rows.reduce((m, r) => Math.max(m, r.length), 0) ?? 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      {sheets.length === 0 && (
        <div>
          <Dropzone onDrop={onDrop} accept=".xlsx,.xlsm,.xls,.ods,.csv,text/csv" multiple={false}>
            <div className="space-y-1">
              <p className="flex items-center justify-center gap-2 text-lg font-bold"><FileSpreadsheet className="h-5 w-5" /> {busy ? t.opening : t.drop}</p>
              <p className="text-sm text-muted-foreground">{t.dropSub}</p>
            </div>
          </Dropzone>
          <p className="mt-2 text-xs text-muted-foreground">{t.how}</p>
        </div>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      {sheet && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {sheets.length > 1 && sheets.map((s, i) => (
              <button
                key={s.name + i}
                onClick={() => setActive(i)}
                className={`border-2 px-3 py-1 text-sm font-medium transition-all ${i === active ? 'border-border bg-accent text-accent-foreground shadow-brutal' : 'border-border hover:shadow-brutal'}`}
              >
                {s.name}
              </button>
            ))}
            <Button variant="ghost" onClick={reset} className="ml-auto">{t.another}</Button>
          </div>

          {sheet.truncated && <Alert variant="success">{t.truncated(sheet.totalRows, sheet.totalCols)}</Alert>}

          {sheet.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.empty}</p>
          ) : (
            <div className="max-h-[75vh] overflow-auto border-2 border-border">
              <table className="border-collapse text-sm tabular-nums">
                <thead>
                  <tr>
                    <th className="sticky left-0 top-0 z-20 border border-border bg-muted px-2 py-1" />
                    {Array.from({ length: colCount }, (_, c) => (
                      <th key={c} className="sticky top-0 z-10 border border-border bg-muted px-2 py-1 font-mono text-xs font-semibold text-muted-foreground">{colLabel(c)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sheet.rows.map((row, r) => (
                    <tr key={r}>
                      <th className="sticky left-0 z-10 border border-border bg-muted px-2 py-1 text-right font-mono text-xs font-normal text-muted-foreground">{r + 1}</th>
                      {Array.from({ length: colCount }, (_, c) => (
                        <td key={c} className="whitespace-nowrap border border-border bg-background px-2 py-1">{row[c] ?? ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
