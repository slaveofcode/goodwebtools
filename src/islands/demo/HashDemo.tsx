import { useState, useEffect, useRef } from 'react';
import { wrap, proxy } from 'comlink';
import type { Remote } from 'comlink';
import { Dropzone } from '@/components/ui/Dropzone';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ResultActions } from '@/components/ui/ResultActions';
import type { HashWorkerAPI } from '@/tools/demo/hash.worker';
import HashWorker from '@/tools/demo/hash.worker?worker';

export default function HashDemo() {
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
    <div className="max-w-4xl mx-auto space-y-6">
      <Dropzone onDrop={handleFile} accept="*/*" multiple={false}>
        <div className="space-y-2">
          <p className="text-lg">Drop file here or click to browse</p>
          <p className="text-sm text-muted-foreground">
            {ready ? 'Generate SHA-256 hash' : 'Loading worker...'}
          </p>
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
