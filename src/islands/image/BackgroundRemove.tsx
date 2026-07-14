import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { CopyImageButton } from '@/components/ui/CopyImageButton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { downloadService } from '@/services/download';
import { formatBytes } from '@/tools/image/canvas.lib';
import { usePasteImage } from '@/hooks/usePasteImage';

export default function BackgroundRemove() {
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
    setStage('Preparing…');
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
          setStage(key.startsWith('fetch') ? 'Downloading AI model…' : 'Removing background…');
        },
      });
      setResult(blob);
      setResultUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Background removal failed.');
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
          <p className="text-lg font-bold">Drop an image or click to browse</p>
          <p className="text-sm text-muted-foreground">
            Removes the background with an on-device AI model · or paste (⌘V)
          </p>
        </div>
      </Dropzone>

      <p className="text-xs text-muted-foreground">
        Runs entirely in your browser — the image never leaves your device. The first run downloads
        the AI model (~40&nbsp;MB), then it's cached for next time.
      </p>

      {busy && (
        <div className="space-y-2">
          <ProgressBar percent={percent} label={stage || 'Working…'} />
        </div>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      {result && resultUrl && !busy && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-bold uppercase tracking-wide text-muted-foreground">Result</span>
            <span className="font-mono">{formatBytes(result.size)}</span>
            <span className="text-muted-foreground">transparent PNG</span>
          </div>
          {/* Checkerboard makes the transparency obvious. */}
          <div className="gwt-checkerboard inline-block max-w-full border-2 border-border p-1">
            <img src={resultUrl} alt="Background removed" className="block max-h-[70vh] w-auto max-w-full" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={download}>
              <Download className="h-4 w-4" />
              Download PNG
            </Button>
            <CopyImageButton blob={result} />
          </div>
        </div>
      )}
    </div>
  );
}
