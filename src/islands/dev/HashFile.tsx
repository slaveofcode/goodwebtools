import { useState, useEffect, useRef } from 'react';
import { wrap, proxy } from 'comlink';
import type { Remote } from 'comlink';
import { Dropzone } from '@/components/ui/Dropzone';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ResultActions } from '@/components/ui/ResultActions';
import { CopyButton } from '@/components/ui/CopyButton';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { HASH_ALGORITHMS, type HashAlgorithm } from '@/tools/dev/hash.lib';
import type { HashWorkerAPI } from '@/tools/dev/hash.worker';
import HashWorker from '@/tools/dev/hash.worker?worker';

export default function HashFile() {
  const [file, setFile] = useState<File | null>(null);
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>('sha-256');
  const [hash, setHash] = useState('');
  const [progress, setProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  // Comlink proxies are callable, so keep the worker API in a ref (storing it
  // in state makes React treat it as a functional updater and invoke it).
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

  const runHash = async (target: File, algo: HashAlgorithm) => {
    const workerApi = workerApiRef.current;
    if (!workerApi) return;
    setProcessing(true);
    setProgress(0);
    setHash('');
    setError('');
    try {
      const digest = await workerApi.hashFile(target, algo, proxy((p: number) => setProgress(p)));
      setHash(digest);
    } catch (e) {
      setError('Hashing failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setProcessing(false);
    }
  };

  const onDrop = (files: File[]) => {
    if (files.length === 0) return;
    setFile(files[0]);
    runHash(files[0], algorithm);
  };

  const changeAlgorithm = (algo: HashAlgorithm) => {
    setAlgorithm(algo);
    if (file) runHash(file, algo);
  };

  const active = HASH_ALGORITHMS.find(a => a.key === algorithm)!;
  const fileName = file?.name ?? '';
  const resultBlob = hash ? new Blob([`${hash}  ${fileName}\n`], { type: 'text/plain' }) : null;

  return (
    <div className="space-y-6">
      <Dropzone onDrop={onDrop} accept="*/*" multiple={false}>
        <div className="space-y-2">
          <p className="text-lg font-bold">Drop file here or click to browse</p>
          <p className="text-sm text-muted-foreground">
            {ready ? 'Hashed in a worker, streamed in chunks — handles large files' : 'Loading engine…'}
          </p>
        </div>
      </Dropzone>

      <div className="space-y-1.5">
        <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">Algorithm</span>
        <div className="flex flex-wrap gap-2">
          {HASH_ALGORITHMS.map(a => (
            <Button
              key={a.key}
              variant={algorithm === a.key ? 'primary' : 'secondary'}
              aria-pressed={algorithm === a.key}
              onClick={() => changeAlgorithm(a.key)}
              disabled={processing}
            >
              {a.label}
            </Button>
          ))}
        </div>
      </div>

      {processing && <ProgressBar percent={progress} label="Hashing…" />}

      {error && <Alert variant="error">{error}</Alert>}

      {hash && !processing && (
        <div className="space-y-3 border-2 border-border bg-muted p-4 shadow-brutal-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="min-w-0 truncate text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {active.label} — {fileName}
            </h3>
            <CopyButton value={hash} />
          </div>
          <code className="block break-all text-sm">{hash}</code>
          <ResultActions blob={resultBlob} filename={`${fileName}.${active.ext}`} disabled={processing} />
        </div>
      )}
    </div>
  );
}
