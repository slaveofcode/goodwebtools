import { useState, useEffect } from 'react';
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
  const [worker, setWorker] = useState<Remote<HashWorkerAPI> | null>(null);

  useEffect(() => {
    console.log('Initializing worker...');
    const workerInstance = new HashWorker();
    console.log('Worker instance created:', workerInstance);

    const wrappedWorker = wrap<HashWorkerAPI>(workerInstance);
    console.log('Worker wrapped with Comlink');
    console.log('Wrapped worker type:', typeof wrappedWorker);
    console.log('Wrapped worker keys:', Object.keys(wrappedWorker));
    console.log('Has hashFile?', 'hashFile' in wrappedWorker);

    // Test if hashFile exists as a property
    if (wrappedWorker.hashFile) {
      console.log('hashFile type:', typeof wrappedWorker.hashFile);
    } else {
      console.error('hashFile method not found on wrapped worker!');
    }

    setWorker(wrappedWorker);

    return () => {
      console.log('Terminating worker...');
      workerInstance.terminate();
    };
  }, []);

  const handleFile = async (files: File[]) => {
    console.log('handleFile called with:', files.length, 'files');
    console.log('Worker available:', !!worker);

    if (files.length === 0 || !worker) {
      console.warn('No files or worker not ready');
      return;
    }

    const file = files[0];
    console.log('Processing file:', file.name, file.size, 'bytes');
    setFileName(file.name);
    setProcessing(true);
    setProgress(0);

    try {
      console.log('Reading file buffer...');
      const buffer = await file.arrayBuffer();
      console.log('Buffer size:', buffer.byteLength);

      console.log('Calling worker.hashFile...');
      const result = await worker.hashFile(
        buffer,
        proxy((pct) => {
          console.log('Progress:', pct);
          setProgress(pct);
        })
      );
      console.log('Hash result:', result);
      setHash(result);
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
