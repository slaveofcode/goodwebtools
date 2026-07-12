import { useState } from 'react';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { ResultActions } from '@/components/ui/ResultActions';
import { PdfPreview } from '@/components/ui/PdfPreview';
import { Alert } from '@/components/ui/Alert';
import { imagesToPdf } from '@/tools/pdf/pdf.lib';

export default function ImagesToPdf() {
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const addFiles = (incoming: File[]) => {
    const images = incoming.filter(f => /image\/(png|jpe?g)/.test(f.type));
    setFiles(prev => [...prev, ...images]);
    setResult(null);
  };

  const move = (index: number, delta: number) => {
    setFiles(prev => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setResult(null);
  };

  const remove = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setResult(null);
  };

  const build = async () => {
    if (files.length === 0) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await imagesToPdf(files));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Conversion failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Dropzone onDrop={addFiles} accept="image/png,image/jpeg" multiple>
        <div className="space-y-1">
          <p className="text-lg font-bold">Drop PNG/JPG images or click to browse</p>
          <p className="text-sm text-muted-foreground">One image per page, in the order below</p>
        </div>
      </Dropzone>

      {files.length > 0 && (
        <ol className="divide-y-2 divide-border border-2 border-border">
          {files.map((file, index) => (
            <li key={index} className="flex items-center gap-3 bg-muted p-3">
              <span className="font-mono text-sm text-muted-foreground">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  className="border-2 border-border p-1 disabled:opacity-30"
                  aria-label="Move up"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  onClick={() => move(index, 1)}
                  disabled={index === files.length - 1}
                  className="border-2 border-border p-1 disabled:opacity-30"
                  aria-label="Move down"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  onClick={() => remove(index)}
                  className="border-2 border-border p-1"
                  aria-label="Remove"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={build} disabled={files.length === 0 || busy}>
          {busy ? 'Building…' : 'Create PDF'}
        </Button>
        <Button variant="ghost" onClick={() => { setFiles([]); setResult(null); setError(''); }}>
          Clear
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {result && (
        <>
          <PdfPreview source={result} />
          <ResultActions blob={result} filename="images.pdf" disabled={busy} />
        </>
      )}
    </div>
  );
}
