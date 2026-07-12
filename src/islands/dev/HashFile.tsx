import { useState, useEffect, useRef } from 'react';
import { wrap, proxy } from 'comlink';
import type { Remote } from 'comlink';
import { Dropzone } from '@/components/ui/Dropzone';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ResultActions } from '@/components/ui/ResultActions';
import { CopyButton } from '@/components/ui/CopyButton';
import type { HashWorkerAPI } from '@/tools/dev/hash.worker';
import HashWorker from '@/tools/dev/hash.worker?worker';

export default function HashFile() {
  const [hash, setHash] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [ready, setReady] = useState(false);

  // Store the Comlink proxy in a ref. Comlink proxies are callable functions,
  // so keeping them in useState causes React to treat them as functional
  // updaters and invoke them. A ref sidesteps that entirely.
  const workerApiRef = useRef<Remote<HashWorkerAPI> | null>(null);

  useEffect(() => {
    const workerInstance = new HashWorker();
    workerApiRef.current = wrap<HashWorkerAPI>(workerInstance);
    setReady(true);

    return () => {
      workerInstance.terminate();
      workerApiRef.current = null;
      setReady(false);
    };
  }, []);

  const handleFile = async (files: File[]) => {
    const workerApi = workerApiRef.current;
    if (files.length === 0 || !workerApi) return;

    const file = files[0];
    setFileName(file.name);
    setProcessing(true);
    setProgress(0);
    setHash('');

    try {
      const fileBuffer = await file.arrayBuffer();
      const hashHex = await workerApi.hashFile(
        fileBuffer,
        proxy((percent: number) => setProgress(percent))
      );
      setHash(hashHex);
    } catch (error) {
      console.error('Hash failed:', error);
      alert('Error: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setProcessing(false);
    }
  };

  const resultBlob = hash
    ? new Blob([`${hash}  ${fileName}\n`], { type: 'text/plain' })
    : null;

  return (
    <div className="space-y-6">
      <Dropzone onDrop={handleFile} accept="*/*" multiple={false}>
        <div className="space-y-2">
          <p className="text-lg font-bold">Drop file here or click to browse</p>
          <p className="text-sm text-muted-foreground">
            {ready ? 'Generate a SHA-256 hash' : 'Loading engine…'}
          </p>
        </div>
      </Dropzone>

      {processing && <ProgressBar percent={progress} label="Hashing…" />}

      {hash && (
        <div className="space-y-3 border-2 border-border bg-muted p-4 shadow-brutal-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="min-w-0 truncate text-sm font-bold uppercase tracking-wide text-muted-foreground">
              SHA-256 — {fileName}
            </h3>
            <CopyButton value={hash} />
          </div>
          <code className="block break-all text-sm">{hash}</code>
          <ResultActions blob={resultBlob} filename={`${fileName}.sha256`} disabled={processing} />
        </div>
      )}
    </div>
  );
}
