import { useState } from 'react';
import { TextArea } from '@/components/ui/TextArea';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { ResultActions } from '@/components/ui/ResultActions';
import { Alert } from '@/components/ui/Alert';
import { deletePages, getPageCount } from '@/tools/pdf/pdf.lib';

/** Parse a page list like "1, 3, 5-7" into 1-indexed page numbers. */
function parsePageList(spec: string): number[] {
  const pages = new Set<number>();
  for (const part of spec.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const range = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      for (let i = Math.min(start, end); i <= Math.max(start, end); i++) pages.add(i);
    } else if (/^\d+$/.test(trimmed)) {
      pages.add(Number(trimmed));
    }
  }
  return [...pages];
}

export default function PdfDelete() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [spec, setSpec] = useState('');
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
      setPageCount(await getPageCount(pdf));
    } catch {
      setError('Could not read this PDF.');
      setFile(null);
    }
  };

  const run = async () => {
    if (!file) return;
    const list = parsePageList(spec);
    if (list.length === 0) {
      setError('Enter pages to remove, e.g. 1, 3, 5-7');
      return;
    }
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await deletePages(file, list));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Dropzone onDrop={onDrop} accept="application/pdf" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">Drop a PDF here or click to browse</p>
          <p className="text-sm text-muted-foreground">Remove pages you don't need</p>
        </div>
      </Dropzone>

      {file && (
        <>
          <p className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">{file.name}</span> — {pageCount} pages
          </p>
          <TextArea
            label="Pages to remove"
            value={spec}
            onChange={e => setSpec(e.target.value)}
            placeholder="e.g. 1, 3, 5-7"
            rows={1}
          />
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={run} disabled={!file || busy}>
          {busy ? 'Removing…' : 'Remove pages'}
        </Button>
        <Button variant="ghost" onClick={() => { setFile(null); setResult(null); setError(''); setSpec(''); setPageCount(0); }}>
          Clear
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {result && <ResultActions blob={result} filename="edited.pdf" disabled={busy} />}
    </div>
  );
}
