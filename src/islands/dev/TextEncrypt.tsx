import { useState } from 'react';
import { usePrefill } from '@/hooks/usePrefill';
import { Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/TextArea';
import { CopyButton } from '@/components/ui/CopyButton';
import { encryptText, decryptText } from '@/tools/dev/textcrypt.lib';
import type { Lang } from '@/i18n/config';

type Mode = 'encrypt' | 'decrypt';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Encrypt a message with a password (AES-256) so only someone with the password can read it — then share the scrambled text safely. All in your browser; the password never leaves your device.',
    encrypt: 'Encrypt', decrypt: 'Decrypt', password: 'Password',
    inEnc: 'Message to encrypt', inDec: 'Encrypted text to decrypt',
    outEnc: 'Encrypted text', outDec: 'Decrypted message',
    run: 'Encrypt', runDec: 'Decrypt', copy: 'Copy',
    needPw: 'Enter a password.', failEnc: 'Could not encrypt.', failDec: 'Wrong password or invalid text.',
    placeholderEnc: 'Type a secret message…', placeholderDec: 'Paste the encrypted text…',
  },
  id: {
    intro: 'Enkripsi pesan dengan kata sandi (AES-256) agar hanya yang punya kata sandi bisa membacanya — lalu bagikan teks teracak dengan aman. Semua di browser Anda; kata sandi tidak pernah keluar dari perangkat.',
    encrypt: 'Enkripsi', decrypt: 'Dekripsi', password: 'Kata sandi',
    inEnc: 'Pesan untuk dienkripsi', inDec: 'Teks terenkripsi untuk didekripsi',
    outEnc: 'Teks terenkripsi', outDec: 'Pesan terdekripsi',
    run: 'Enkripsi', runDec: 'Dekripsi', copy: 'Salin',
    needPw: 'Masukkan kata sandi.', failEnc: 'Tidak dapat mengenkripsi.', failDec: 'Kata sandi salah atau teks tidak valid.',
    placeholderEnc: 'Ketik pesan rahasia…', placeholderDec: 'Tempel teks terenkripsi…',
  },
};

export default function TextEncrypt({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const prefill = usePrefill();
  const [mode, setMode] = useState<Mode>('encrypt');
  const [text, setText] = useState(prefill.text ?? '');
  const [password, setPassword] = useState('');
  const [out, setOut] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    if (!password) { setError(t.needPw); return; }
    setBusy(true); setError(''); setOut('');
    try {
      setOut(mode === 'encrypt' ? await encryptText(text, password) : await decryptText(text, password));
    } catch {
      setError(mode === 'encrypt' ? t.failEnc : t.failDec);
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (m: Mode) => { setMode(m); setOut(''); setError(''); };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="flex gap-1">
        <button onClick={() => switchMode('encrypt')} aria-pressed={mode === 'encrypt'}
          className={`flex items-center gap-2 border-2 px-4 py-2 text-sm font-bold uppercase tracking-wide ${mode === 'encrypt' ? 'border-border bg-accent text-accent-foreground shadow-brutal' : 'border-border'}`}>
          <Lock className="h-4 w-4" />{t.encrypt}
        </button>
        <button onClick={() => switchMode('decrypt')} aria-pressed={mode === 'decrypt'}
          className={`flex items-center gap-2 border-2 px-4 py-2 text-sm font-bold uppercase tracking-wide ${mode === 'decrypt' ? 'border-border bg-accent text-accent-foreground shadow-brutal' : 'border-border'}`}>
          <Unlock className="h-4 w-4" />{t.decrypt}
        </button>
      </div>

      <div className="space-y-1">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{mode === 'encrypt' ? t.inEnc : t.inDec}</span>
        <TextArea value={text} onChange={e => setText(e.target.value)} rows={5}
          placeholder={mode === 'encrypt' ? t.placeholderEnc : t.placeholderDec} className="font-mono text-sm" />
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.password}</span>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="off"
          className="w-full border-2 border-border bg-muted p-2 text-sm" />
      </label>

      <Button onClick={run} disabled={busy || !text.trim()}>{busy ? '…' : (mode === 'encrypt' ? t.run : t.runDec)}</Button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {out && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{mode === 'encrypt' ? t.outEnc : t.outDec}</span>
            <CopyButton value={out} label={t.copy} />
          </div>
          <textarea readOnly value={out} rows={5} className="w-full break-all border-2 border-border bg-muted p-2 font-mono text-sm" />
        </div>
      )}
    </div>
  );
}
