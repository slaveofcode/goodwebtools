import { useState } from 'react';
import { TextArea } from '@/components/ui/TextArea';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { ResultActions } from '@/components/ui/ResultActions';
import { PdfPreview } from '@/components/ui/PdfPreview';
import { Alert } from '@/components/ui/Alert';
import { extractPageList, getPageCount, parsePageSpec } from '@/tools/pdf/pdf.lib';

export default function PdfSplit() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [spec, setSpec] = useState('');
  const [result, setResult] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');

  const onDrop = async (files: File[]) => {
    const pdf = files[0];
    if (!pdf) return;
    setError('');
    setResult(null);
    setFile(pdf);
    setSpec('');
    setReading(true);
    try {
      const count = await getPageCount(pdf);
      setPageCount(count);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read this PDF.');
      setFile(null);
    } finally {
      setReading(false);
    }
  };

  // Live preview of which pages will be extracted.
  const selected = parsePageSpec(spec).filter(n => n <= pageCount);

  const extract = async () => {
    if (!file) return;
    if (selected.length === 0) {
      setError('Enter pages to extract, e.g. 1, 3, 7, 10 or 2-5');
      return;
    }
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await extractPageList(file, selected));
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
          <p className="text-sm text-muted-foreground">
            Pick any pages or ranges to extract into a new PDF
          </p>
        </div>
      </Dropzone>

      {reading && (
        <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Reading PDF… (first use loads the PDF engine)
        </p>
      )}

      {file && (
        <>
          <p className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">{file.name}</span> — {pageCount} pages
          </p>
          <TextArea
            label="Pages to extract"
            value={spec}
            onChange={e => setSpec(e.target.value)}
            placeholder="e.g. 1, 3, 7, 10  or  2-5, 8"
            rows={1}
          />
          {selected.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Will extract <span className="font-bold text-foreground">{selected.length}</span>{' '}
              page(s): {selected.join(', ')}
            </p>
          )}
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={extract} disabled={!file || busy}>
          {busy ? 'Extracting…' : 'Extract pages'}
        </Button>
        <Button variant="ghost" onClick={() => { setFile(null); setResult(null); setError(''); setSpec(''); setPageCount(0); }}>
          Clear
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {result && (
        <>
          <PdfPreview source={result} />
          <ResultActions blob={result} filename="extracted.pdf" disabled={busy} />
        </>
      )}
    </div>
  );
}
