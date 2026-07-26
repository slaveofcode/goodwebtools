import { useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { ResultActions } from '@/components/ui/ResultActions';
import { PdfPreview } from '@/components/ui/PdfPreview';
import { Alert } from '@/components/ui/Alert';
import { compressPdf } from '@/tools/pdf/pdf.lib';
import { formatBytes } from '@/tools/image/canvas.lib';

export default function PdfCompress() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onDrop = (files: File[]) => {
    setFile(files.find(f => f.type === 'application/pdf' || f.name.endsWith('.pdf')) ?? null);
    setResult(null);
    setError('');
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await compressPdf(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Compression failed');
    } finally {
      setBusy(false);
    }
  };

  const reduction =
    file && result ? Math.round((1 - result.size / file.size) * 100) : null;

  return (
    <div className="space-y-4">
      <Dropzone onDrop={onDrop} accept="application/pdf" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">Drop a PDF here or click to browse</p>
          <p className="text-sm text-muted-foreground">
            Recompress streams, images, and fonts; drop unused objects
          </p>
        </div>
      </Dropzone>

      {file && (
        <p className="text-sm text-muted-foreground">
          <span className="font-bold text-foreground">{file.name}</span> — {formatBytes(file.size)}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={run} disabled={!file || busy}>
          {busy ? 'Compressing…' : 'Compress PDF'}
        </Button>
        <Button variant="ghost" onClick={() => { setFile(null); setResult(null); setError(''); }}>
          Clear
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {result && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-bold uppercase tracking-wide text-muted-foreground">Result</span>
            <span className="font-mono">{formatBytes(result.size)}</span>
            {reduction !== null && (
              <span
                className={
                  reduction > 0
                    ? 'font-bold text-green-600 dark:text-green-400'
                    : 'font-bold text-muted-foreground'
                }
              >
                {reduction > 0 ? `−${reduction}% smaller` : 'already optimal'}
              </span>
            )}
          </div>
          {reduction !== null && reduction <= 0 && (
            <Alert variant="success">
              This PDF is already well-compressed (mostly text/vector). Compression helps most on
              image-heavy PDFs.
            </Alert>
          )}
          <PdfPreview source={result} />
          <ResultActions blob={result} filename="compressed.pdf" disabled={busy} />
        </>
      )}
    </div>
  );
}
