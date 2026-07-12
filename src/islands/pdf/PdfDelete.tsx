import { useState } from 'react';
import { TextArea } from '@/components/ui/TextArea';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { ResultActions } from '@/components/ui/ResultActions';
import { PdfPreview } from '@/components/ui/PdfPreview';
import { Alert } from '@/components/ui/Alert';
import { deletePages, getPageCount, parsePageSpec } from '@/tools/pdf/pdf.lib';

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
    const list = parsePageSpec(spec);
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
      {result && (
        <>
          <PdfPreview source={result} />
          <ResultActions blob={result} filename="edited.pdf" disabled={busy} />
        </>
      )}
    </div>
  );
}
