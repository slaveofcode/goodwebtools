import { useState, type ReactNode } from 'react';
import { Plus, Trash2, Lock, Users, Upload, Download, Eye, EyeOff, ShieldAlert, Printer, KeyRound, ShieldCheck, Clock, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Dropzone } from '@/components/ui/Dropzone';
import { CopyButton } from '@/components/ui/CopyButton';
import { downloadService } from '@/services/download';
import type { Lang } from '@/i18n/config';
import {
  createVault, openWithPassword, openWithShares, vaultCapabilities,
  VAULT_EXT, type Account, type LegacyContent,
} from '@/tools/legacy/vault.lib';

type Mode = 'create' | 'open' | null;
const input = 'w-full border-2 border-border bg-muted px-3 py-2 text-sm outline-none focus:shadow-brutal-sm';
const emptyAccount = (): Account => ({ service: '', username: '', password: '', url: '', notes: '' });

// Custom neo-brutalist SVG scenes: currentColor strokes (theme-aware) + accent/muted/
// background fill tokens so they read in both light and dark mode. Decorative → aria-hidden.
const svgProps = {
  viewBox: '0 0 96 64', role: 'img', 'aria-hidden': true,
  className: 'h-16 w-full text-foreground', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const,
};

function SceneWrite() {
  return (
    <svg {...svgProps}>
      <rect x="14" y="6" width="42" height="52" className="fill-background" />
      <line x1="22" y1="18" x2="48" y2="18" /><line x1="22" y1="27" x2="48" y2="27" /><line x1="22" y1="36" x2="40" y2="36" />
      <circle cx="26" cy="48" r="4" className="fill-accent" /><path d="M30 48 h9 M37 48 v4" />
      <path d="M55 44 L74 25 l6 6 L61 50 l-8 2 z" className="fill-accent" />
    </svg>
  );
}
function SceneLock() {
  return (
    <svg {...svgProps}>
      <rect x="20" y="8" width="44" height="48" className="fill-background" /><line x1="20" y1="18" x2="64" y2="18" />
      <rect x="34" y="35" width="16" height="13" className="fill-accent" /><path d="M37 35 v-4 a5 5 0 0 1 10 0 v4" />
      <path d="M70 22 a6 6 0 0 1 11 -2 a5 5 0 0 1 1 10 h-11 a4.5 4.5 0 0 1 -1 -8 z" className="fill-muted" />
      <line x1="69" y1="15" x2="85" y2="31" />
    </svg>
  );
}
function SceneShares() {
  return (
    <svg {...svgProps}>
      <circle cx="48" cy="12" r="6" className="fill-accent" /><line x1="48" y1="18" x2="48" y2="24" />
      <path d="M16 24 H80 M16 24 v6 M32 24 v6 M48 24 v6 M64 24 v6 M80 24 v6" />
      <rect x="9" y="38" width="14" height="18" className="fill-accent" /><rect x="25" y="38" width="14" height="18" className="fill-accent" />
      <rect x="41" y="38" width="14" height="18" className="fill-accent" /><rect x="57" y="38" width="14" height="18" className="fill-background" />
      <rect x="73" y="38" width="14" height="18" className="fill-background" />
    </svg>
  );
}
function SceneOpen() {
  return (
    <svg {...svgProps}>
      <path d="M14 8 h16 M14 56 h16 M16 8 v6 l7 10 l-7 10 v6 M28 8 v6 l-7 10 l7 10 v6" />
      <path d="M18 12 h8 l-4 6 z" className="fill-accent" stroke="none" />
      <path d="M38 32 h9 M44 28 l4 4 l-4 4" />
      <rect x="54" y="26" width="34" height="24" className="fill-background" /><path d="M54 26 l17 12 l17 -12" />
      <path d="M71 45 c-3 -4 -8 -1 -8 2 c0 3 8 7 8 7 c0 0 8 -4 8 -7 c0 -3 -5 -6 -8 -2 z" className="fill-accent" stroke="none" />
    </svg>
  );
}

const SCENES = [SceneWrite, SceneLock, SceneShares, SceneOpen];

// Landing + illustration copy, per language. The interactive Create/Open forms
// stay English for now (a later phase); this is the explainer surface.
const T: Record<Lang, {
  intro: string; write: string; open: string; how: string;
  steps: [string, string][];
  sharesTitle: string; yourLetter: string; splitLabel: string; any3: string; spare: string; sharesBody: ReactNode;
  privacyTitle: string; privacyBody: string; handoffTitle: string; handoffBody: string;
}> = {
  en: {
    intro: 'Write a private letter — passwords, accounts, and final words — that your family can open only when the time comes. It is encrypted on your device; nothing is ever uploaded.',
    write: 'Write a new letter', open: 'Open a letter', how: 'How it works',
    steps: [
      ['Write', 'Your final message + account logins and passwords.'],
      ['Lock on your device', 'Encrypted with AES-256 right here. Nothing is uploaded to any server.'],
      ['Choose the keys', 'Protect it with a password, family shares, or both.'],
      ['Opened later', 'When the time comes, family unlocks it with the password or by combining shares.'],
    ],
    sharesTitle: 'The clever part: family shares',
    yourLetter: 'Your encrypted letter',
    splitLabel: 'split into 5 shares — give one to each relative',
    any3: 'any 3 unlock it →', spare: '2 spare — can be lost',
    sharesBody: <>All <strong>5</strong> shares go to 5 people. <strong>Any 3</strong> of them — it doesn’t matter which 3 — together open the letter, so no single person can open it alone and up to <strong>2</strong> shares can be lost. The solid vs. dashed boxes above just show one example trio; you pick the numbers (2-of-3, 3-of-5, 4-of-7…).</>,
    privacyTitle: 'Private by design.',
    privacyBody: 'Everything is encrypted and decrypted in your browser. Your passwords are never sent anywhere — not even to us.',
    handoffTitle: 'You arrange the handoff.',
    handoffBody: 'A private tool can’t detect when you’ve died, so it can’t auto-release. Share the password or the shares so they only come together when the time comes — tip: give one share to your lawyer or executor.',
  },
  id: {
    intro: 'Tulis surat pribadi — kata sandi, akun, dan pesan terakhir — yang hanya bisa dibuka keluarga saat waktunya tiba. Dienkripsi di perangkat Anda; tidak ada yang pernah diunggah.',
    write: 'Tulis surat baru', open: 'Buka surat', how: 'Cara kerjanya',
    steps: [
      ['Tulis', 'Pesan terakhir Anda + login dan kata sandi akun.'],
      ['Kunci di perangkat Anda', 'Dienkripsi dengan AES-256 langsung di sini. Tidak ada yang diunggah ke server.'],
      ['Pilih kuncinya', 'Lindungi dengan kata sandi, bagian keluarga, atau keduanya.'],
      ['Dibuka nanti', 'Saat waktunya tiba, keluarga membukanya dengan kata sandi atau dengan menggabungkan bagian.'],
    ],
    sharesTitle: 'Bagian cerdasnya: bagian keluarga',
    yourLetter: 'Surat terenkripsi Anda',
    splitLabel: 'dibagi menjadi 5 bagian — berikan satu ke tiap kerabat',
    any3: '3 mana pun membukanya →', spare: '2 cadangan — boleh hilang',
    sharesBody: <>Kelima bagian diberikan kepada 5 orang. <strong>3 bagian mana pun</strong> — tidak masalah yang mana — bersama-sama membuka surat, jadi tidak ada satu orang pun yang bisa membukanya sendirian dan hingga <strong>2</strong> bagian boleh hilang. Kotak solid vs. garis putus-putus di atas hanya menunjukkan satu contoh trio; Anda memilih angkanya (2-dari-3, 3-dari-5, 4-dari-7…).</>,
    privacyTitle: 'Privat secara desain.',
    privacyBody: 'Semuanya dienkripsi dan didekripsi di browser Anda. Kata sandi Anda tidak pernah dikirim ke mana pun — bahkan tidak ke kami.',
    handoffTitle: 'Anda mengatur penyerahannya.',
    handoffBody: 'Tool privat tidak bisa mengetahui kapan Anda meninggal, jadi tidak bisa merilis otomatis. Bagikan kata sandi atau bagian-bagiannya agar hanya dapat disatukan saat waktunya tiba — tips: berikan satu bagian kepada notaris atau pelaksana wasiat Anda.',
  },
};

/** Illustrated explainer shown on the landing screen. */
function HowItWorks({ lang }: { lang: Lang }) {
  const tr = T[lang] ?? T.en;
  return (
    <section aria-label={tr.how} className="space-y-5 border-2 border-border bg-muted/40 p-4">
      <h2 className="text-lg font-bold uppercase tracking-tight">{tr.how}</h2>

      {/* Four-step flow */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SCENES.map((Scene, i) => (
          <div key={i} className="relative border-2 border-border bg-background p-3 shadow-brutal-sm">
            <span className="absolute -top-3 -left-3 flex h-7 w-7 items-center justify-center border-2 border-border bg-accent text-sm font-bold text-accent-foreground">{i + 1}</span>
            <div className="mb-2 border-2 border-border bg-muted/40">
              <Scene />
            </div>
            <p className="font-bold">{tr.steps[i][0]}</p>
            <p className="text-sm text-muted-foreground">{tr.steps[i][1]}</p>
          </div>
        ))}
      </div>

      {/* The "family shares" concept, illustrated */}
      <div className="space-y-3 border-2 border-border bg-background p-4">
        <p className="flex items-center gap-2 font-bold uppercase tracking-wide"><Users className="h-4 w-4" /> {tr.sharesTitle}</p>
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="inline-flex items-center gap-2 border-2 border-border bg-accent px-3 py-1.5 font-bold text-accent-foreground">
            <Lock className="h-4 w-4" /> {tr.yourLetter}
          </div>
          <ArrowDown className="h-5 w-5 text-muted-foreground" />
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{tr.splitLabel}</p>
          <div className="flex flex-wrap items-start justify-center gap-x-5 gap-y-2">
            <div className="text-center">
              <div className="flex gap-2">
                {[1, 2, 3].map(n => (
                  <div key={n} className="flex h-12 w-12 flex-col items-center justify-center border-2 border-border bg-accent text-xs font-bold text-accent-foreground">
                    <Users className="h-4 w-4" />{n}
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-xs font-bold">{tr.any3}</p>
            </div>
            <div className="text-center">
              <div className="flex gap-2">
                {[4, 5].map(n => (
                  <div key={n} className="flex h-12 w-12 flex-col items-center justify-center border-2 border-dashed border-border bg-muted text-xs font-bold text-muted-foreground">
                    <Users className="h-4 w-4" />{n}
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{tr.spare}</p>
            </div>
          </div>
          <p className="max-w-lg text-sm text-muted-foreground">{tr.sharesBody}</p>
        </div>
      </div>

      {/* Privacy + the honest caveat */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex gap-2 border-2 border-border bg-background p-3 text-sm">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <p><strong>{tr.privacyTitle}</strong> {tr.privacyBody}</p>
        </div>
        <div className="flex gap-2 border-2 border-border bg-background p-3 text-sm">
          <Clock className="mt-0.5 h-5 w-5 shrink-0" />
          <p><strong>{tr.handoffTitle}</strong> {tr.handoffBody}</p>
        </div>
      </div>
    </section>
  );
}

export default function LegacyLetter({ lang = 'en' }: { lang?: Lang }) {
  const [mode, setMode] = useState<Mode>(null);
  const tr = T[lang] ?? T.en;
  return (
    <div className="space-y-4">
      {mode === null && (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">{tr.intro}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setMode('create')}><Lock className="h-4 w-4" /> {tr.write}</Button>
            <Button variant="secondary" onClick={() => setMode('open')}><Upload className="h-4 w-4" /> {tr.open}</Button>
          </div>
          <HowItWorks lang={lang} />
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
