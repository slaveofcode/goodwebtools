import { useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { ResultActions } from '@/components/ui/ResultActions';
import { Alert } from '@/components/ui/Alert';
import { rotatePdf } from '@/tools/pdf/pdf.lib';

const TURNS = [
  { deg: 90, label: '90° ↻' },
  { deg: 180, label: '180°' },
  { deg: 270, label: '270° ↺' },
];

export default function PdfRotate() {
  const [file, setFile] = useState<File | null>(null);
  const [turn, setTurn] = useState(90);
  const [result, setResult] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onDrop = (files: File[]) => {
    setFile(files[0] ?? null);
    setResult(null);
    setError('');
  };

  const rotate = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await rotatePdf(file, turn));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rotate failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Dropzone onDrop={onDrop} accept="application/pdf" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">Drop a PDF here or click to browse</p>
          <p className="text-sm text-muted-foreground">Rotate every page clockwise</p>
        </div>
      </Dropzone>

      {file && (
        <p className="text-sm font-bold text-foreground">{file.name}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {TURNS.map(({ deg, label }) => (
          <Button
            key={deg}
            variant={turn === deg ? 'primary' : 'secondary'}
            aria-pressed={turn === deg}
            onClick={() => setTurn(deg)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={rotate} disabled={!file || busy}>
          {busy ? 'Rotating…' : 'Rotate PDF'}
        </Button>
        <Button variant="ghost" onClick={() => { setFile(null); setResult(null); setError(''); }}>
          Clear
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {result && <ResultActions blob={result} filename="rotated.pdf" disabled={busy} />}
    </div>
  );
}
