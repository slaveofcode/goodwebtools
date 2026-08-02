import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import type { Lang } from '@/i18n/config';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { CopyImageButton } from '@/components/ui/CopyImageButton';
import { EditInAnnotatorButton } from '@/components/ui/EditInAnnotatorButton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { downloadService } from '@/services/download';
import { formatBytes } from '@/tools/image/canvas.lib';
import { usePasteImage } from '@/hooks/usePasteImage';

const TR: Record<Lang, {
  preparing: string;
  downloadingModel: string;
  removingBg: string;
  removeFailed: string;
  dropHere: string;
  dropSub: string;
  privacyNote: string;
  working: string;
  result: string;
  transparentPng: string;
  altRemoved: string;
  downloadPng: string;
}> = {
  en: {
    preparing: 'Preparing…',
    downloadingModel: 'Downloading AI model…',
    removingBg: 'Removing background…',
    removeFailed: 'Background removal failed.',
    dropHere: 'Drop an image or click to browse',
    dropSub: 'Removes the background with an on-device AI model · or paste (⌘V)',
    privacyNote: "Runs entirely in your browser — the image never leaves your device. The first run downloads the AI model (~40 MB), then it's cached for next time.",
    working: 'Working…',
    result: 'Result',
    transparentPng: 'transparent PNG',
    altRemoved: 'Background removed',
    downloadPng: 'Download PNG',
  },
  id: {
    preparing: 'Menyiapkan…',
    downloadingModel: 'Mengunduh model AI…',
    removingBg: 'Menghapus latar belakang…',
    removeFailed: 'Gagal menghapus latar belakang.',
    dropHere: 'Jatuhkan gambar atau klik untuk menjelajah',
    dropSub: 'Menghapus latar belakang dengan model AI di perangkat · atau tempel (⌘V)',
    privacyNote: 'Berjalan sepenuhnya di browser Anda — gambar tidak pernah meninggalkan perangkat Anda. Jalankan pertama kali mengunduh model AI (~40 MB), lalu disimpan di cache untuk berikutnya.',
    working: 'Memproses…',
    result: 'Hasil',
    transparentPng: 'PNG transparan',
    altRemoved: 'Latar belakang dihapus',
    downloadPng: 'Unduh PNG',
  },
};

export default function BackgroundRemove({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [srcName, setSrcName] = useState('');
  const [result, setResult] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  const run = async (files: File[]) => {
    const file = files.find(f => f.type.startsWith('image/'));
    if (!file) return;
    setSrcName(file.name);
    setResult(null);
    setError('');
    setBusy(true);
    setPercent(0);
    setStage(t.preparing);
    try {
      // Loaded lazily: the library pulls in onnxruntime-web + lodash (CJS),
      // which isn't server-render-safe, and this keeps it out of the initial bundle.
      const { removeBackground } = await import('@imgly/background-removal');
      const blob = await removeBackground(file, {
        // Served by the R2 Worker in production, from public/ in local dev.
        publicPath: new URL('/models/imgly/', location.origin).href,
        output: { format: 'image/png' },
        progress: (key, current, total) => {
          const pct = total > 0 ? Math.round((current / total) * 100) : 0;
          setPercent(pct);
          setStage(key.startsWith('fetch') ? t.downloadingModel : t.removingBg);
        },
      });
      setResult(blob);
      setResultUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t.removeFailed);
    } finally {
      setBusy(false);
      setStage('');
    }
  };

  usePasteImage(f => run([f]));

  const download = () => {
    if (!result) return;
    const name = (srcName.replace(/\.[^.]+$/, '') || 'image') + '-no-bg.png';
    downloadService.download(result, name);
  };

  return (
    <div className="space-y-4">
      <Dropzone onDrop={run} accept="image/*" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">{t.dropHere}</p>
          <p className="text-sm text-muted-foreground">
            {t.dropSub}
          </p>
        </div>
      </Dropzone>

      <p className="text-xs text-muted-foreground">
        {t.privacyNote}
      </p>

      {busy && (
        <div className="space-y-2">
          <ProgressBar percent={percent} label={stage || t.working} />
        </div>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      {result && resultUrl && !busy && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.result}</span>
            <span className="font-mono">{formatBytes(result.size)}</span>
            <span className="text-muted-foreground">{t.transparentPng}</span>
          </div>
          {/* Checkerboard makes the transparency obvious. */}
          <div className="gwt-checkerboard inline-block max-w-full border-2 border-border p-1">
            <img src={resultUrl} alt={t.altRemoved} className="block max-h-[70vh] w-auto max-w-full" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={download}>
              <Download className="h-4 w-4" />
              {t.downloadPng}
            </Button>
            <CopyImageButton blob={result} />
            <EditInAnnotatorButton blob={result} filename={(srcName.replace(/\.[^.]+$/, '') || 'image') + '-no-bg.png'} />
          </div>
        </div>
      )}
    </div>
  );
}
