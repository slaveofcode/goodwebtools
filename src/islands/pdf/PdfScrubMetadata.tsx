import { useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ResultActions } from '@/components/ui/ResultActions';
import { readPdfMetadata, scrubPdfMetadata } from '@/tools/pdf/mupdf.client';
import { presentFields, metadataLabel } from '@/tools/pdf/scrub-metadata.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  intro: string; drop: string; dropSub: string; reading: string; failed: string;
  found: string; none: string; scrub: string; working: string; removedHeading: string;
  cleanNote: string; nonePresent: string;
}> = {
  en: {
    intro: 'Remove hidden metadata from a PDF — author name, the original file name, the software used, timestamps and the XMP block. Drop a PDF to see what it carries, then scrub it. Everything runs in your browser.',
    drop: 'Drop a PDF or click to browse', dropSub: 'Cleaned on your device',
    reading: 'Reading metadata…', failed: 'Something went wrong.',
    found: 'Metadata found in this PDF', none: 'No standard metadata was found — the PDF may still contain an XMP block, which scrubbing also removes.',
    scrub: 'Scrub metadata & download', working: 'Scrubbing…', removedHeading: 'Removed',
    cleanNote: 'The Info fields and the XMP metadata stream were removed. Content and pages are unchanged.',
    nonePresent: 'No fields had values to remove, but the XMP block (if any) was stripped.',
  },
  id: {
    intro: 'Hapus metadata tersembunyi dari PDF — nama penulis, nama berkas asli, software yang dipakai, timestamp, dan blok XMP. Letakkan PDF untuk melihat isinya, lalu bersihkan. Semuanya berjalan di browser Anda.',
    drop: 'Letakkan PDF atau klik untuk memilih', dropSub: 'Dibersihkan di perangkat Anda',
    reading: 'Membaca metadata…', failed: 'Terjadi kesalahan.',
    found: 'Metadata ditemukan di PDF ini', none: 'Tidak ada metadata standar ditemukan — PDF mungkin masih memuat blok XMP, yang juga dihapus saat pembersihan.',
    scrub: 'Bersihkan metadata & unduh', working: 'Membersihkan…', removedHeading: 'Dihapus',
    cleanNote: 'Kolom Info dan aliran metadata XMP telah dihapus. Konten dan halaman tidak berubah.',
    nonePresent: 'Tidak ada kolom bernilai untuk dihapus, tetapi blok XMP (jika ada) telah dibuang.',
  },
};

export default function PdfScrubMetadata({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const l: Lang = lang === 'id' ? 'id' : 'en';
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<Record<string, string> | null>(null);
  const [removed, setRemoved] = useState<Record<string, string> | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onDrop = async (files: File[]) => {
    const f = files.find(x => x.type === 'application/pdf' || x.name.toLowerCase().endsWith('.pdf'));
    if (!f) return;
    setFile(f); setMeta(null); setRemoved(null); setBlob(null); setError(''); setBusy(true);
    try {
      setMeta(await readPdfMetadata(f));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed);
    } finally {
      setBusy(false);
    }
  };

  const scrub = async () => {
    if (!file) return;
    setBusy(true); setError('');
    try {
      const r = await scrubPdfMetadata(file);
      setRemoved(r.removed);
      setBlob(r.blob);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed);
    } finally {
      setBusy(false);
    }
  };

  const fields = meta ? presentFields(meta) : [];
  const removedFields = removed ? presentFields(removed) : [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      {!file && (
        <Dropzone onDrop={onDrop} accept="application/pdf" multiple={false}>
          <div className="space-y-1">
            <p className="text-lg font-bold">{t.drop}</p>
            <p className="text-sm text-muted-foreground">{t.dropSub}</p>
          </div>
        </Dropzone>
      )}

      {error && <Alert variant="error">{error}</Alert>}
      {busy && !meta && <p className="text-sm text-muted-foreground">{t.reading}</p>}

      {file && meta && !blob && (
        <div className="space-y-3">
          {fields.length > 0 ? (
            <div className="space-y-2">
              <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">{t.found}</span>
              <div className="divide-y-2 divide-border border-2 border-border">
                {fields.map(f => (
                  <div key={f.key} className="grid grid-cols-[9rem_1fr] gap-2 p-2 text-sm">
                    <span className="font-semibold">{metadataLabel(f.key, l)}</span>
                    <span className="break-words font-mono text-xs">{f.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <Alert variant="success">{t.none}</Alert>
          )}
          <Button onClick={scrub} disabled={busy}>{busy ? t.working : t.scrub}</Button>
        </div>
      )}

      {blob && (
        <div className="space-y-3">
          {removedFields.length > 0 ? (
            <div className="space-y-2">
              <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">{t.removedHeading}</span>
              <div className="divide-y-2 divide-border border-2 border-border">
                {removedFields.map(f => (
                  <div key={f.key} className="grid grid-cols-[9rem_1fr] gap-2 p-2 text-sm line-through opacity-70">
                    <span className="font-semibold">{metadataLabel(f.key, l)}</span>
                    <span className="break-words font-mono text-xs">{f.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t.nonePresent}</p>
          )}
          <p className="text-xs text-muted-foreground">{t.cleanNote}</p>
          <ResultActions blob={blob} filename={file ? file.name.replace(/\.pdf$/i, '') + '-clean.pdf' : 'clean.pdf'} disabled={busy} />
        </div>
      )}
    </div>
  );
}
