import { useState } from 'react';
import { proxy } from 'comlink';
import { useWorker } from '@/hooks/useWorker';
import { Dropzone } from '@/components/ui/Dropzone';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ResultActions } from '@/components/ui/ResultActions';
import type { HashWorkerAPI } from '@/tools/demo/hash.worker';

export default function HashDemo() {
  const [hash, setHash] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState('');
  const [processing, setProcessing] = useState(false);

  const worker = useWorker<HashWorkerAPI>(
    'hash-demo',
    new URL('@/tools/demo/hash.worker.ts', import.meta.url)
  );

  const handleFile = async (files: File[]) => {
    if (files.length === 0 || !worker) return;

    const file = files[0];
    setFileName(file.name);
    setProcessing(true);
    setProgress(0);

    try {
      const buffer = await file.arrayBuffer();
      const result = await worker.hashFile(
        buffer,
        proxy((pct) => setProgress(pct))
      );
      setHash(result);
    } catch (error) {
      console.error('Hash failed:', error);
    } finally {
      setProcessing(false);
    }
  };

  const resultBlob = hash
    ? new Blob([`${hash}  ${fileName}\n`], { type: 'text/plain' })
    : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Dropzone onDrop={handleFile} accept="*/*" multiple={false}>
        <div className="space-y-2">
          <p className="text-lg">Drop file here or click to browse</p>
          <p className="text-sm text-muted-foreground">Generate SHA-256 hash</p>
        </div>
      </Dropzone>

      {processing && <ProgressBar percent={progress} label="Hashing..." />}

      {hash && (
        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <h3 className="font-medium mb-2">SHA-256 Hash</h3>
            <code className="text-sm break-all">{hash}</code>
          </div>
          <ResultActions blob={resultBlob} filename={`${fileName}.sha256`} disabled={processing} />
        </div>
      )}
    </div>
  );
}
