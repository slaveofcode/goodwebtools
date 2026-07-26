import { useState } from 'react';
import { Eye, EyeOff, Lock, Unlock, ShieldCheck } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ResultActions } from '@/components/ui/ResultActions';
import { formatBytes } from '@/tools/image/canvas.lib';
import {
  encryptData,
  decryptData,
  encryptedName,
  decryptedName,
} from '@/tools/files/crypto.lib';

type Mode = 'encrypt' | 'decrypt';

export default function FileCrypt() {
  const [mode, setMode] = useState<Mode>('encrypt');
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onDrop = (files: File[]) => {
    setFile(files[0] ?? null);
    setResult(null);
    setError('');
  };

  const run = async () => {
    if (!file || !password) {
      setError(!file ? 'Choose a file first.' : 'Enter a password.');
      return;
    }
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const buffer = await file.arrayBuffer();
      if (mode === 'encrypt') {
        const out = await encryptData(buffer, password);
        setResult({
          blob: new Blob([out], { type: 'application/octet-stream' }),
          name: encryptedName(file.name),
        });
      } else {
        const out = await decryptData(new Uint8Array(buffer), password);
        setResult({ blob: new Blob([out]), name: decryptedName(file.name) });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operation failed.');
    } finally {
      setBusy(false);
    }
  };

  const weak = mode === 'encrypt' && password.length > 0 && password.length < 8;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          variant={mode === 'encrypt' ? 'primary' : 'secondary'}
          aria-pressed={mode === 'encrypt'}
          onClick={() => { setMode('encrypt'); setResult(null); setError(''); }}
        >
          <Lock className="h-4 w-4" />
          Encrypt
        </Button>
        <Button
          variant={mode === 'decrypt' ? 'primary' : 'secondary'}
          aria-pressed={mode === 'decrypt'}
          onClick={() => { setMode('decrypt'); setResult(null); setError(''); }}
        >
          <Unlock className="h-4 w-4" />
          Decrypt
        </Button>
      </div>

      <Dropzone onDrop={onDrop} multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">Drop a file or click to browse</p>
          <p className="text-sm text-muted-foreground">
            {mode === 'encrypt'
              ? 'Any file — locked with AES-256, never leaves your device'
              : 'Choose a .gwtenc file to unlock'}
          </p>
        </div>
      </Dropzone>

      {file && (
        <p className="text-sm text-muted-foreground">
          <span className="font-bold text-foreground">{file.name}</span> — {formatBytes(file.size)}
        </p>
      )}

      <label className="block space-y-1.5">
        <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Password
        </span>
        <div className="flex items-stretch gap-2">
          <input
            type={show ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') run(); }}
            autoComplete="off"
            placeholder={mode === 'encrypt' ? 'Choose a strong password' : 'Enter the password'}
            className="w-full max-w-md border-2 border-border bg-muted px-3 py-2 text-sm outline-none focus:shadow-brutal-sm"
          />
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            title={show ? 'Hide password' : 'Show password'}
            aria-label={show ? 'Hide password' : 'Show password'}
            className="border-2 border-border bg-muted p-2 shadow-brutal-sm press-brutal"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {weak && (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            Short passwords are easy to guess — use 8+ characters (a passphrase is best).
          </span>
        )}
      </label>

      <div className="flex flex-wrap gap-2">
        <Button onClick={run} disabled={!file || !password || busy}>
          {busy
            ? mode === 'encrypt' ? 'Encrypting…' : 'Decrypting…'
            : mode === 'encrypt' ? 'Encrypt file' : 'Decrypt file'}
        </Button>
        <Button variant="ghost" onClick={() => { setFile(null); setPassword(''); setResult(null); setError(''); }}>
          Clear
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {result && (
        <div className="space-y-2">
          <Alert variant="success">
            {mode === 'encrypt' ? 'Encrypted' : 'Decrypted'} — {formatBytes(result.blob.size)}
          </Alert>
          <ResultActions blob={result.blob} filename={result.name} />
        </div>
      )}

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        AES-256-GCM with a PBKDF2 key (250,000 iterations, SHA-256). Everything runs in your
        browser — the file and password never leave your device. There is no password recovery:
        lose the password and the file is unrecoverable.
      </p>
    </div>
  );
}
