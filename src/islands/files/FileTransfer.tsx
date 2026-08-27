import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Send, Download, ShieldCheck, Settings } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { CopyButton } from '@/components/ui/CopyButton';
import { downloadService } from '@/services/download';
import { useFileTransfer } from '@/hooks/useFileTransfer';
import { makeRoomId, roomLink, roomIdFromHash } from '@/tools/webrtc/signal.lib';
import { formatBytes } from '@/tools/webrtc/file-transfer.lib';
import { effectiveIceServers } from '@/tools/webrtc/ice.lib';
import { fetchTurnServers } from '@/tools/webrtc/turn';
import type { Lang } from '@/i18n/config';

type Signaling = 'auto' | 'manual';
type ManualRole = 'send' | 'receive';

const ICE_KEY = 'gwt.webrtc.ice';
const SIGNALING_KEY = 'gwt.webrtc.signaling';

const TR: Record<Lang, {
  beforeConnect: string;
  introAuto: ReactNode; introManual: ReactNode; bestEffort: string;
  advancedSettings: string; connMethod: string; autoMethod: string; manualMethod: string;
  stunLabel: string; stunHint: string; continue: string;
  copyCode: string; copyLink: string; shareLink: string;
  pickRole: string; imSending: string; imReceiving: string;
  step1Offer: string; preparing: string; step2Answer: string; connect: string;
  step1PasteOffer: string; genAnswer: string; step2SendAnswer: string;
  chooseDifferent: string; pickFile: string; sentDirectly: string; pickItNow: string;
  readyToSend: (name: string) => string; sending: (name: string) => string;
  transferring: string; receiving: string; downloadFile: string;
  footerLine: string; footerManual: string; footerAuto: string;
  stConnecting: string; stWaitingManual: string; stWaitingAuto: string;
  stConnectedSend: string; stConnectedRecv: string; stTransferring: string;
  stSent: string; stReceived: string;
  errCreateOffer: string; errInvalidAnswer: string; errInvalidOffer: string;
}> = {
  en: {
    beforeConnect: 'Before you connect',
    introAuto: (
      <>To introduce your two devices, GoodWebTools uses a small <strong>signaling server</strong> to
      exchange connection details (about 2&nbsp;KB). Your files transfer <strong>directly,
      peer-to-peer</strong>, and never pass through our server.</>
    ),
    introManual: (
      <><strong>Manual mode uses no server at all.</strong> You&apos;ll copy-paste a connection code to the
      other person yourself. Files transfer directly, peer-to-peer.</>
    ),
    bestEffort: 'Connections are best-effort and may fail on restrictive networks unless you add your own TURN server.',
    advancedSettings: 'Advanced connection settings',
    connMethod: 'Connection method',
    autoMethod: 'Automatic (share a link)',
    manualMethod: 'Manual (copy-paste · no server)',
    stunLabel: 'Your STUN / TURN servers (optional)',
    stunHint: 'One per line. Leave empty to use public STUN. A TURN server makes connections work on strict networks.',
    continue: 'Continue',
    copyCode: 'Copy code',
    copyLink: 'Copy link',
    shareLink: 'Share this link with the other device',
    pickRole: 'Manual connection — pick a role',
    imSending: 'I’m sending',
    imReceiving: 'I’m receiving',
    step1Offer: 'Step 1 — send this offer code to the other person',
    preparing: 'Preparing…',
    step2Answer: 'Step 2 — paste the answer code they send back',
    connect: 'Connect',
    step1PasteOffer: 'Step 1 — paste the offer code from the sender',
    genAnswer: 'Generate answer',
    step2SendAnswer: 'Step 2 — send this answer code back to the sender',
    chooseDifferent: 'Choose a different file',
    pickFile: 'Pick a file to send',
    sentDirectly: 'Sent directly to the other device.',
    pickItNow: 'Pick it now — it sends automatically once the other device connects.',
    readyToSend: (name) => `Ready to send: ${name} — waiting for the other device…`,
    sending: (name) => `Sending ${name}`,
    transferring: 'Transferring',
    receiving: 'Receiving',
    downloadFile: 'Download file',
    footerLine: 'Files transfer directly between devices (peer-to-peer).',
    footerManual: 'Manual mode uses no server at all.',
    footerAuto: 'A minimal signaling server is used only to introduce the two devices (~2 KB handshake) — your files never pass through it.',
    stConnecting: 'Connecting…',
    stWaitingManual: 'Waiting to connect…',
    stWaitingAuto: 'Waiting for the other device to join…',
    stConnectedSend: 'Connected — choose a file to send.',
    stConnectedRecv: 'Connected — waiting for a file…',
    stTransferring: 'Transferring…',
    stSent: 'Sent!',
    stReceived: 'Received!',
    errCreateOffer: 'Could not create the offer.',
    errInvalidAnswer: 'Invalid answer code.',
    errInvalidOffer: 'Invalid offer code.',
  },
  id: {
    beforeConnect: 'Sebelum Anda terhubung',
    introAuto: (
      <>Untuk mengenalkan kedua perangkat Anda, GoodWebTools memakai sebuah <strong>signaling server</strong> kecil
      untuk bertukar detail koneksi (sekitar 2&nbsp;KB). File Anda ditransfer <strong>langsung,
      peer-to-peer</strong>, dan tidak pernah melewati server kami.</>
    ),
    introManual: (
      <><strong>Mode manual tidak memakai server sama sekali.</strong> Anda menyalin-tempel kode koneksi ke
      orang lain sendiri. File ditransfer langsung, peer-to-peer.</>
    ),
    bestEffort: 'Koneksi bersifat best-effort dan bisa gagal di jaringan yang ketat kecuali Anda menambahkan server TURN sendiri.',
    advancedSettings: 'Pengaturan koneksi lanjutan',
    connMethod: 'Metode koneksi',
    autoMethod: 'Otomatis (bagikan tautan)',
    manualMethod: 'Manual (salin-tempel · tanpa server)',
    stunLabel: 'Server STUN / TURN Anda (opsional)',
    stunHint: 'Satu per baris. Kosongkan untuk memakai STUN publik. Server TURN membuat koneksi berfungsi di jaringan ketat.',
    continue: 'Lanjutkan',
    copyCode: 'Salin kode',
    copyLink: 'Salin tautan',
    shareLink: 'Bagikan tautan ini dengan perangkat lain',
    pickRole: 'Koneksi manual — pilih peran',
    imSending: 'Saya mengirim',
    imReceiving: 'Saya menerima',
    step1Offer: 'Langkah 1 — kirim kode offer ini ke orang lain',
    preparing: 'Menyiapkan…',
    step2Answer: 'Langkah 2 — tempel kode answer yang mereka kirim balik',
    connect: 'Hubungkan',
    step1PasteOffer: 'Langkah 1 — tempel kode offer dari pengirim',
    genAnswer: 'Buat answer',
    step2SendAnswer: 'Langkah 2 — kirim kode answer ini balik ke pengirim',
    chooseDifferent: 'Pilih file lain',
    pickFile: 'Pilih file untuk dikirim',
    sentDirectly: 'Dikirim langsung ke perangkat lain.',
    pickItNow: 'Pilih sekarang — file terkirim otomatis begitu perangkat lain terhubung.',
    readyToSend: (name) => `Siap dikirim: ${name} — menunggu perangkat lain…`,
    sending: (name) => `Mengirim ${name}`,
    transferring: 'Mentransfer',
    receiving: 'Menerima',
    downloadFile: 'Unduh file',
    footerLine: 'File ditransfer langsung antar perangkat (peer-to-peer).',
    footerManual: 'Mode manual tidak memakai server sama sekali.',
    footerAuto: 'Signaling server minimal hanya dipakai untuk mengenalkan kedua perangkat (handshake ~2 KB) — file Anda tidak pernah melewatinya.',
    stConnecting: 'Menghubungkan…',
    stWaitingManual: 'Menunggu untuk terhubung…',
    stWaitingAuto: 'Menunggu perangkat lain bergabung…',
    stConnectedSend: 'Terhubung — pilih file untuk dikirim.',
    stConnectedRecv: 'Terhubung — menunggu file…',
    stTransferring: 'Mentransfer…',
    stSent: 'Terkirim!',
    stReceived: 'Diterima!',
    errCreateOffer: 'Tidak bisa membuat offer.',
    errInvalidAnswer: 'Kode answer tidak valid.',
    errInvalidOffer: 'Kode offer tidak valid.',
  },
};

export default function FileTransfer({ lang = 'en' }: { lang?: Lang }) {
  const t = useFileTransfer();
  const tr = TR[lang] ?? TR.en;
  const [acked, setAcked] = useState(false);
  const [signaling, setSignaling] = useState<Signaling>('auto');
  const [iceText, setIceText] = useState('');
  // Provided TURN servers (from /api/turn) so transfers work across strict NATs.
  const [turn, setTurn] = useState<RTCIceServer[]>([]);
  useEffect(() => { fetchTurnServers().then(setTurn); }, []);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Auto mode
  const [joining, setJoining] = useState(false); // arrived via a shared link → receiver
  const [roomId, setRoomId] = useState('');
  const [link, setLink] = useState('');

  // Manual mode
  const [manualRole, setManualRole] = useState<ManualRole | null>(null);
  const [offerCode, setOfferCode] = useState('');
  const [answerCode, setAnswerCode] = useState('');
  const [pastedAnswer, setPastedAnswer] = useState('');
  const [pastedOffer, setPastedOffer] = useState('');
  const [manualBusy, setManualBusy] = useState(false);
  const [manualErr, setManualErr] = useState('');
  const [queuedName, setQueuedName] = useState('');

  const sentName = useRef('');

  // Restore saved settings + decide role from the URL hash.
  useEffect(() => {
    try {
      setIceText(localStorage.getItem(ICE_KEY) ?? '');
      const savedSig = localStorage.getItem(SIGNALING_KEY);
      if (savedSig === 'manual' || savedSig === 'auto') setSignaling(savedSig);
    } catch { /* ignore */ }

    const fromHash = roomIdFromHash(window.location.hash);
    if (fromHash) {
      setJoining(true);
      setSignaling('auto'); // a shared link is always automatic signaling
      setRoomId(fromHash);
    } else {
      const id = makeRoomId();
      setRoomId(id);
      setLink(roomLink(window.location.origin, id));
    }
  }, []);

  const persistIce = (text: string) => {
    setIceText(text);
    try { localStorage.setItem(ICE_KEY, text); } catch { /* ignore */ }
  };
  const persistSignaling = (s: Signaling) => {
    setSignaling(s);
    try { localStorage.setItem(SIGNALING_KEY, s); } catch { /* ignore */ }
  };

  const ice = () => [...turn, ...effectiveIceServers(iceText)];

  const start = () => {
    setAcked(true);
    if (signaling === 'auto') {
      t.connect(joining ? 'receive' : 'send', roomId, ice());
    }
    // manual: wait for the user to pick a role
  };

  const onDrop = (files: File[]) => {
    const f = files[0];
    if (f) { sentName.current = f.name; setQueuedName(f.name); t.queueFile(f); }
  };

  const downloadReceived = () => {
    if (t.receivedBlob && t.incoming) downloadService.download(t.receivedBlob, t.incoming.name);
  };

  // Manual: sender
  const chooseSend = async () => {
    setManualRole('send');
    setManualErr('');
    setManualBusy(true);
    try {
      setOfferCode(await t.manualCreateOffer(ice()));
    } catch (e) {
      setManualErr(e instanceof Error ? e.message : tr.errCreateOffer);
    } finally {
      setManualBusy(false);
    }
  };
  const submitAnswer = async () => {
    setManualErr('');
    try { await t.manualAcceptAnswer(pastedAnswer.trim()); }
    catch (e) { setManualErr(e instanceof Error ? e.message : tr.errInvalidAnswer); }
  };

  // Manual: receiver
  const chooseReceive = () => { setManualRole('receive'); setManualErr(''); };
  const submitOffer = async () => {
    setManualErr('');
    setManualBusy(true);
    try {
      setAnswerCode(await t.manualAcceptOffer(pastedOffer.trim(), ice()));
    } catch (e) {
      setManualErr(e instanceof Error ? e.message : tr.errInvalidOffer);
    } finally {
      setManualBusy(false);
    }
  };

  const isSending = signaling === 'auto' ? !joining : manualRole === 'send';

  // ---------- Ack + settings gate ----------
  if (!acked) {
    return (
      <div className="space-y-4">
        <div className="space-y-3 border-2 border-border p-4">
          <p className="flex items-center gap-2 text-lg font-bold">
            <ShieldCheck className="h-5 w-5" /> {tr.beforeConnect}
          </p>
          <p className="text-sm text-muted-foreground">
            {signaling === 'auto' ? tr.introAuto : tr.introManual}{' '}
            {tr.bestEffort}
          </p>

          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
            className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground"
          >
            <Settings className="h-4 w-4" /> {tr.advancedSettings}
          </button>

          {showAdvanced && (
            <div className="space-y-3 border-2 border-border bg-muted/40 p-3">
              {!joining && (
                <div className="space-y-1.5">
                  <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">{tr.connMethod}</span>
                  <div className="flex flex-wrap gap-2">
                    <Button variant={signaling === 'auto' ? 'primary' : 'secondary'} onClick={() => persistSignaling('auto')}>
                      {tr.autoMethod}
                    </Button>
                    <Button variant={signaling === 'manual' ? 'primary' : 'secondary'} onClick={() => persistSignaling('manual')}>
                      {tr.manualMethod}
                    </Button>
                  </div>
                </div>
              )}
              <label className="block space-y-1.5">
                <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  {tr.stunLabel}
                </span>
                <textarea
                  value={iceText}
                  onChange={e => persistIce(e.target.value)}
                  rows={3}
                  spellCheck={false}
                  placeholder={'stun:stun.example.com:3478\nturn:turn.example.com:3478 username credential'}
                  className="w-full resize-y border-2 border-border bg-background p-2 font-mono text-xs outline-none focus:shadow-brutal-sm"
                />
                <span className="block text-xs text-muted-foreground">
                  {tr.stunHint}
                </span>
              </label>
            </div>
          )}

          <Button onClick={start}>{tr.continue}</Button>
        </div>
      </div>
    );
  }

  const statusLabel: Record<string, string> = {
    connecting: tr.stConnecting,
    waiting: signaling === 'manual' ? tr.stWaitingManual : tr.stWaitingAuto,
    connected: isSending ? tr.stConnectedSend : tr.stConnectedRecv,
    transferring: tr.stTransferring,
    done: isSending ? tr.stSent : tr.stReceived,
  };

  const codeBox = (value: string) => (
    <div className="space-y-1.5">
      <textarea readOnly value={value} rows={3} className="w-full resize-y break-all border-2 border-border bg-muted p-2 font-mono text-xs" />
      <CopyButton value={value} label={tr.copyCode} />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* ----- Manual mode ----- */}
      {signaling === 'manual' && !manualRole && (
        <div className="space-y-2">
          <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{tr.pickRole}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={chooseSend} disabled={manualBusy}>{tr.imSending}</Button>
            <Button variant="secondary" onClick={chooseReceive}>{tr.imReceiving}</Button>
          </div>
        </div>
      )}

      {signaling === 'manual' && manualRole === 'send' && t.status !== 'connected' && t.status !== 'transferring' && t.status !== 'done' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-sm font-bold">{tr.step1Offer}</p>
            {manualBusy && !offerCode ? <p className="text-sm text-muted-foreground">{tr.preparing}</p> : codeBox(offerCode)}
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-bold">{tr.step2Answer}</p>
            <textarea
              value={pastedAnswer}
              onChange={e => setPastedAnswer(e.target.value)}
              rows={3}
              spellCheck={false}
              className="w-full resize-y break-all border-2 border-border bg-muted p-2 font-mono text-xs outline-none focus:shadow-brutal-sm"
            />
            <Button onClick={submitAnswer} disabled={!pastedAnswer.trim()}>{tr.connect}</Button>
          </div>
        </div>
      )}

      {signaling === 'manual' && manualRole === 'receive' && t.status !== 'connected' && t.status !== 'transferring' && t.status !== 'done' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-sm font-bold">{tr.step1PasteOffer}</p>
            <textarea
              value={pastedOffer}
              onChange={e => setPastedOffer(e.target.value)}
              rows={3}
              spellCheck={false}
              className="w-full resize-y break-all border-2 border-border bg-muted p-2 font-mono text-xs outline-none focus:shadow-brutal-sm"
            />
            <Button onClick={submitOffer} disabled={!pastedOffer.trim() || manualBusy}>{tr.genAnswer}</Button>
          </div>
          {answerCode && (
            <div className="space-y-1.5">
              <p className="text-sm font-bold">{tr.step2SendAnswer}</p>
              {codeBox(answerCode)}
            </div>
          )}
        </div>
      )}

      {manualErr && <Alert variant="error">{manualErr}</Alert>}

      {/* ----- Auto mode: shareable link ----- */}
      {signaling === 'auto' && !joining && (t.status === 'connecting' || t.status === 'waiting') && (
        <div className="space-y-2">
          <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{tr.shareLink}</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="break-all border-2 border-border bg-muted px-3 py-2 text-sm">{link}</code>
            <CopyButton value={link} label={tr.copyLink} />
          </div>
        </div>
      )}

      {/* ----- Shared status + transfer ----- */}
      {t.status !== 'error' && statusLabel[t.status] && (
        <p className="text-sm text-muted-foreground">{statusLabel[t.status]}</p>
      )}
      {t.error && <Alert variant="error">{t.error}</Alert>}

      {isSending && (t.status === 'connecting' || t.status === 'waiting' || t.status === 'connected') && (
        <div className="space-y-2">
          <Dropzone onDrop={onDrop} multiple={false}>
            <div className="space-y-1">
              <p className="flex items-center justify-center gap-2 text-lg font-bold">
                <Send className="h-5 w-5" /> {queuedName ? tr.chooseDifferent : tr.pickFile}
              </p>
              <p className="text-sm text-muted-foreground">
                {t.status === 'connected' ? tr.sentDirectly : tr.pickItNow}
              </p>
            </div>
          </Dropzone>
          {queuedName && (t.status === 'connecting' || t.status === 'waiting') && (
            <p className="text-sm font-bold">{tr.readyToSend(queuedName)}</p>
          )}
        </div>
      )}

      {(t.status === 'transferring' || (t.status === 'done' && isSending)) && (
        <ProgressBar percent={t.progress} label={isSending ? tr.sending(sentName.current) : tr.transferring} />
      )}

      {!isSending && t.incoming && (
        <div className="space-y-2 border-2 border-border p-3">
          <p className="text-sm font-bold">{t.incoming.name} · {formatBytes(t.incoming.size)}</p>
          {t.status === 'transferring' && <ProgressBar percent={t.progress} label={tr.receiving} />}
          {t.status === 'done' && t.receivedBlob && (
            <Button onClick={downloadReceived}>
              <Download className="h-4 w-4" /> {tr.downloadFile}
            </Button>
          )}
        </div>
      )}

      <p className="border-t border-border pt-3 text-xs text-muted-foreground">
        <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
        {tr.footerLine}{' '}
        {signaling === 'manual' ? tr.footerManual : tr.footerAuto}
      </p>
    </div>
  );
}
