import { useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { ResultActions } from '@/components/ui/ResultActions';
import { Alert } from '@/components/ui/Alert';
import { extractPages, getPageCount } from '@/tools/pdf/pdf.lib';

export default function PdfSplit() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(1);
  const [result, setResult] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onDrop = async (files: File[]) => {
    const pdf = files[0];
    if (!pdf) return;
    setError('');
    setResult(null);
    setFile(pdf);
    try {
      const count = await getPageCount(pdf);
      setPageCount(count);
      setFrom(1);
      setTo(count);
    } catch {
      setError('Could not read this PDF.');
      setFile(null);
    }
  };

  const extract = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await extractPages(file, from, to));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Extract failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Dropzone onDrop={onDrop} accept="application/pdf" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">Drop a PDF here or click to browse</p>
          <p className="text-sm text-muted-foreground">Extract a range of pages into a new PDF</p>
        </div>
      </Dropzone>

      {file && (
        <>
          <p className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">{file.name}</span> — {pageCount} pages
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <label className="space-y-1 text-sm">
              <span className="block font-bold uppercase tracking-wide text-muted-foreground">
                From page
              </span>
              <input
                type="number"
                min={1}
                max={pageCount}
                value={from}
                onChange={e => setFrom(Number(e.target.value))}
                className="w-24 border-2 border-border bg-muted px-2 py-1.5 text-sm outline-none focus:shadow-brutal-sm"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="block font-bold uppercase tracking-wide text-muted-foreground">
                To page
              </span>
              <input
                type="number"
                min={1}
                max={pageCount}
                value={to}
                onChange={e => setTo(Number(e.target.value))}
                className="w-24 border-2 border-border bg-muted px-2 py-1.5 text-sm outline-none focus:shadow-brutal-sm"
              />
            </label>
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={extract} disabled={!file || busy}>
          {busy ? 'Extracting…' : 'Extract pages'}
        </Button>
        <Button variant="ghost" onClick={() => { setFile(null); setResult(null); setError(''); setPageCount(0); }}>
          Clear
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {result && <ResultActions blob={result} filename={`pages-${from}-${to}.pdf`} disabled={busy} />}
    </div>
  );
}
