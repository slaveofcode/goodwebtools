import { useState } from 'react';
import { Plus, Trash2, Lock, Users, Upload, Download, Eye, EyeOff, ShieldAlert, Printer, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Dropzone } from '@/components/ui/Dropzone';
import { CopyButton } from '@/components/ui/CopyButton';
import { downloadService } from '@/services/download';
import {
  createVault, openWithPassword, openWithShares, vaultCapabilities,
  VAULT_EXT, type Account, type LegacyContent,
} from '@/tools/legacy/vault.lib';

type Mode = 'create' | 'open' | null;
const input = 'w-full border-2 border-border bg-muted px-3 py-2 text-sm outline-none focus:shadow-brutal-sm';
const emptyAccount = (): Account => ({ service: '', username: '', password: '', url: '', notes: '' });

export default function LegacyLetter() {
  const [mode, setMode] = useState<Mode>(null);
  return (
    <div className="space-y-4">
      {mode === null && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Write a private letter — passwords, accounts, and final words — that your family can open only
            when the time comes. It is encrypted <strong>on your device</strong>; nothing is ever uploaded.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setMode('create')}><Lock className="h-4 w-4" /> Write a new letter</Button>
            <Button variant="secondary" onClick={() => setMode('open')}><Upload className="h-4 w-4" /> Open a letter</Button>
          </div>
        </div>
      )}
      {mode === 'create' && <CreateView onBack={() => setMode(null)} />}
      {mode === 'open' && <OpenView onBack={() => setMode(null)} />}
    </div>
  );
}

function CreateView({ onBack }: { onBack: () => void }) {
  const [message, setMessage] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([emptyAccount()]);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [useShares, setUseShares] = useState(false);
  const [n, setN] = useState(5);
  const [k, setK] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ file: string; shares: string[] } | null>(null);

  const setAccount = (i: number, patch: Partial<Account>) =>
    setAccounts(a => a.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const generate = async () => {
    setError('');
    const usePw = password.length > 0;
    if (!usePw && !useShares) { setError('Choose at least one way to unlock: a password or family shares.'); return; }
    if (usePw && password !== confirm) { setError('The passwords do not match.'); return; }
    if (usePw && password.length < 8) { setError('Use a password of at least 8 characters.'); return; }
    if (useShares && (k < 2 || n < k || n > 20)) { setError('Check the family-share numbers (threshold ≥ 2, and total ≥ threshold).'); return; }
    const content: LegacyContent = {
      message,
      accounts: accounts.filter(a => a.service.trim() || a.username?.trim() || a.password?.trim()),
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setBusy(true);
    try {
      const res = await createVault(content, { password: usePw ? password : undefined, shares: useShares ? { n, k } : undefined });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the letter.');
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack}>← Back</Button>
        <Alert variant="success">Your encrypted letter is ready. Download it and keep it safe.</Alert>
        <Button onClick={() => downloadService.download(new Blob([result.file], { type: 'application/json' }), `surat-wasiat.${VAULT_EXT}`)}>
          <Download className="h-4 w-4" /> Download the letter (.{VAULT_EXT})
        </Button>

        {result.shares.length > 0 && (
          <div className="space-y-2 border-2 border-border p-3">
            <p className="flex items-center gap-2 font-bold uppercase tracking-wide"><Users className="h-4 w-4" /> Family shares — hand out {k} of these {result.shares.length} are needed</p>
            <p className="text-sm text-muted-foreground">Give each share to a different trusted person (a relative — and consider giving one to your lawyer/executor). No single person can open the letter alone; any {k} together can.</p>
            {result.shares.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate border-2 border-border bg-muted px-2 py-1 text-xs">{s}</code>
                <CopyButton value={s} label={`#${i + 1}`} />
              </div>
            ))}
          </div>
        )}

        <div className="border-2 border-border bg-muted px-3 py-2 text-sm">
          <p className="flex items-center gap-2 font-bold"><ShieldAlert className="h-4 w-4" /> Keep it recoverable</p>
          <p className="mt-1 text-muted-foreground">
            This letter can be opened <strong>only</strong> with its password{result.shares.length > 0 ? ` or ${k} family shares` : ''}.
            If those are lost, the contents are gone forever — by design, so no one else can read them. Store the
            file and the way to unlock it separately.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setResult(null)}>Edit the letter</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Button variant="ghost" onClick={onBack}>← Back</Button>

      <div className="space-y-2">
        <label className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Your message</label>
        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5} placeholder="Final words for your family…" className={input} />
      </div>

      <div className="space-y-3">
        <label className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Accounts &amp; secrets</label>
        {accounts.map((a, i) => (
          <div key={i} className="space-y-2 border-2 border-border p-3">
            <div className="flex gap-2">
              <input value={a.service} onChange={e => setAccount(i, { service: e.target.value })} placeholder="Service (e.g. Instagram)" className={input} />
              {accounts.length > 1 && <Button variant="ghost" aria-label="Remove" onClick={() => setAccounts(x => x.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={a.username} onChange={e => setAccount(i, { username: e.target.value })} placeholder="Username / email" className={input} />
              <input value={a.password} onChange={e => setAccount(i, { password: e.target.value })} placeholder="Password / PIN" className={input} />
              <input value={a.url} onChange={e => setAccount(i, { url: e.target.value })} placeholder="Website (optional)" className={input} />
              <input value={a.notes} onChange={e => setAccount(i, { notes: e.target.value })} placeholder="Notes (e.g. 2FA on my phone)" className={input} />
            </div>
          </div>
        ))}
        <Button variant="secondary" onClick={() => setAccounts(a => [...a, emptyAccount()])}><Plus className="h-4 w-4" /> Add account</Button>
      </div>

      <div className="space-y-3 border-2 border-border p-3">
        <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">How family will unlock it</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className={input} />
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirm password" className={input} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={useShares} onChange={e => setUseShares(e.target.checked)} />
          <span className="font-bold">Also split into family shares</span>
          <span className="text-muted-foreground">— so no single person can open it alone</span>
        </label>
        {useShares && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">Any <input type="number" min={2} max={n} value={k} onChange={e => setK(Math.max(2, Math.min(n, +e.target.value)))} className="w-16 border-2 border-border bg-muted px-2 py-1" /></label>
            <label className="flex items-center gap-2">of <input type="number" min={k} max={20} value={n} onChange={e => setN(Math.max(k, Math.min(20, +e.target.value)))} className="w-16 border-2 border-border bg-muted px-2 py-1" /> shares</label>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Set a password, family shares, or both. At least one is required.</p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      <Button onClick={generate} disabled={busy}><Lock className="h-4 w-4" /> {busy ? 'Encrypting…' : 'Encrypt & create letter'}</Button>
    </div>
  );
}

function OpenView({ onBack }: { onBack: () => void }) {
  const [file, setFile] = useState<string | null>(null);
  const [caps, setCaps] = useState<{ password: boolean; shares: { n: number; k: number } | null } | null>(null);
  const [password, setPassword] = useState('');
  const [sharesText, setSharesText] = useState('');
  const [content, setContent] = useState<LegacyContent | null>(null);
  const [reveal, setReveal] = useState<Record<number, boolean>>({});
  const [error, setError] = useState('');

  const onDrop = async (files: File[]) => {
    setError(''); setContent(null);
    const f = files[0];
    if (!f) return;
    try {
      const text = await f.text();
      setCaps(vaultCapabilities(text));
      setFile(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read this file.');
      setFile(null); setCaps(null);
    }
  };

  const openPw = async () => {
    if (!file) return;
    setError('');
    try { setContent(await openWithPassword(file, password)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not open the letter.'); }
  };
  const openShares = async () => {
    if (!file) return;
    setError('');
    try {
      const list = sharesText.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      setContent(await openWithShares(file, list));
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not open the letter.'); }
  };

  if (content) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="ghost" onClick={onBack}>← Back</Button>
          <Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print / Save PDF</Button>
        </div>
        {content.message && (
          <div className="space-y-1 border-2 border-border p-4">
            <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Message</p>
            <p className="whitespace-pre-wrap">{content.message}</p>
          </div>
        )}
        {content.accounts.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Accounts &amp; secrets</p>
            {content.accounts.map((a, i) => (
              <div key={i} className="space-y-1 border-2 border-border p-3">
                <p className="font-bold">{a.service || '(untitled)'}</p>
                {a.username && <Row label="Username" value={a.username} />}
                {a.password && (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="w-24 shrink-0 font-bold text-muted-foreground">Password</span>
                    <code className="border-2 border-border bg-muted px-2 py-0.5">{reveal[i] ? a.password : '••••••••'}</code>
                    <button onClick={() => setReveal(r => ({ ...r, [i]: !r[i] }))} aria-label="Reveal" className="press-brutal">{reveal[i] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                    <CopyButton value={a.password} label="Copy" />
                  </div>
                )}
                {a.url && <Row label="Website" value={a.url} />}
                {a.notes && <Row label="Notes" value={a.notes} />}
              </div>
            ))}
          </div>
        )}
        {content.createdAt && <p className="text-xs text-muted-foreground">Written {content.createdAt}.</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack}>← Back</Button>
      {!file && (
        <Dropzone onDrop={onDrop} accept={`.${VAULT_EXT},application/json`} multiple={false}>
          <div className="space-y-1">
            <p className="text-lg font-bold">Drop the letter file (.{VAULT_EXT})</p>
            <p className="text-sm text-muted-foreground">It is decrypted here on your device — nothing is uploaded.</p>
          </div>
        </Dropzone>
      )}

      {file && caps && (
        <div className="space-y-4">
          {caps.password && (
            <div className="space-y-2 border-2 border-border p-3">
              <p className="flex items-center gap-2 font-bold uppercase tracking-wide"><KeyRound className="h-4 w-4" /> Open with password</p>
              <div className="flex gap-2">
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') openPw(); }} placeholder="Password" className={input} />
                <Button onClick={openPw}>Open</Button>
              </div>
            </div>
          )}
          {caps.shares && (
            <div className="space-y-2 border-2 border-border p-3">
              <p className="flex items-center gap-2 font-bold uppercase tracking-wide"><Users className="h-4 w-4" /> Open with family shares</p>
              <p className="text-sm text-muted-foreground">Paste {caps.shares.k} of the {caps.shares.n} shares, one per line.</p>
              <textarea value={sharesText} onChange={e => setSharesText(e.target.value)} rows={caps.shares.k + 1} placeholder={'gwt-wasiat.v1.…\ngwt-wasiat.v1.…'} className={input} />
              <Button onClick={openShares}>Combine &amp; open</Button>
            </div>
          )}
          <Button variant="ghost" onClick={() => { setFile(null); setCaps(null); setError(''); }}>Choose a different file</Button>
        </div>
      )}

      {error && <Alert variant="error">{error}</Alert>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="w-24 shrink-0 font-bold text-muted-foreground">{label}</span>
      <span className="min-w-0 break-all">{value}</span>
      <CopyButton value={value} label="Copy" />
    </div>
  );
}
