import { useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { PdfPreview } from '@/components/ui/PdfPreview';
import { ResultActions } from '@/components/ui/ResultActions';
import { repairPdf } from '@/tools/pdf/pdf.lib';

export default function PdfRepair() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Blob | null>(null);
  const [pages, setPages] = useState(0);
  const [forced, setForced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onDrop = (files: File[]) => {
    const pdf = files.find(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (!pdf) return;
    setFile(pdf);
    setResult(null);
    setError('');
  };

  const outName = file ? file.name.replace(/\.pdf$/i, '') + '-repaired.pdf' : 'repaired.pdf';

  const run = async (force: boolean) => {
    if (!file) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const { blob, pages: recovered } = await repairPdf(file, force);
      setResult(blob);
      setPages(recovered);
      setForced(force);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not repair this PDF.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Dropzone onDrop={onDrop} accept="application/pdf" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">Drop a damaged PDF here or click to browse</p>
          <p className="text-sm text-muted-foreground">Rebuilds a broken PDF so it opens again · 100% on your device, no upload</p>
        </div>
      </Dropzone>

      {file && <p className="text-sm font-bold text-foreground">{file.name}</p>}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => run(false)} disabled={!file || busy}>
          {busy ? 'Repairing…' : 'Repair PDF'}
        </Button>
        <Button variant="secondary" onClick={() => run(true)} disabled={!file || busy} title="Rebuild the document page-by-page — for badly damaged files">
          Force rebuild
        </Button>
        <Button variant="ghost" onClick={() => { setFile(null); setResult(null); setError(''); }}>
          Clear
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Repair fixes structural damage (a broken cross-reference table, damaged trailer, junk after the end of the file).
        If a normal repair doesn&apos;t open, try <strong>Force rebuild</strong>, which reconstructs the file from whatever
        pages are still readable. Content that&apos;s physically missing can&apos;t be recovered.
      </p>

      {error && (
        <Alert variant="error">
          {error} You can try <strong>Force rebuild</strong> for a more aggressive recovery.
        </Alert>
      )}

      {result && (
        <>
          <Alert variant="success">
            {forced ? 'Rebuilt' : 'Repaired'} — {pages} page{pages === 1 ? '' : 's'} recovered. Check the preview before saving.
          </Alert>
          <PdfPreview source={result} />
          <ResultActions blob={result} filename={outName} disabled={busy} />
        </>
      )}
    </div>
  );
}
