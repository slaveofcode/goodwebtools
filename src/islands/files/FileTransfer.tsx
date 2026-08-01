import { useEffect, useRef, useState } from 'react';
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

type Signaling = 'auto' | 'manual';
type ManualRole = 'send' | 'receive';

const ICE_KEY = 'gwt.webrtc.ice';
const SIGNALING_KEY = 'gwt.webrtc.signaling';

export default function FileTransfer() {
  const t = useFileTransfer();
  const [acked, setAcked] = useState(false);
  const [signaling, setSignaling] = useState<Signaling>('auto');
  const [iceText, setIceText] = useState('');
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

  const ice = () => effectiveIceServers(iceText);

  const start = () => {
    setAcked(true);
    if (signaling === 'auto') {
      t.connect(joining ? 'receive' : 'send', roomId, ice());
    }
    // manual: wait for the user to pick a role
  };

  const onDrop = (files: File[]) => {
    const f = files[0];
    if (f) { sentName.current = f.name; t.sendFile(f); }
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
      setManualErr(e instanceof Error ? e.message : 'Could not create the offer.');
    } finally {
      setManualBusy(false);
    }
  };
  const submitAnswer = async () => {
    setManualErr('');
    try { await t.manualAcceptAnswer(pastedAnswer.trim()); }
    catch (e) { setManualErr(e instanceof Error ? e.message : 'Invalid answer code.'); }
  };

  // Manual: receiver
  const chooseReceive = () => { setManualRole('receive'); setManualErr(''); };
  const submitOffer = async () => {
    setManualErr('');
    setManualBusy(true);
    try {
      setAnswerCode(await t.manualAcceptOffer(pastedOffer.trim(), ice()));
    } catch (e) {
      setManualErr(e instanceof Error ? e.message : 'Invalid offer code.');
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
            <ShieldCheck className="h-5 w-5" /> Before you connect
          </p>
          <p className="text-sm text-muted-foreground">
            {signaling === 'auto' ? (
              <>To introduce your two devices, GoodWebTools uses a small <strong>signaling server</strong> to
              exchange connection details (about 2&nbsp;KB). Your files transfer <strong>directly,
              peer-to-peer</strong>, and never pass through our server.</>
            ) : (
              <><strong>Manual mode uses no server at all.</strong> You&apos;ll copy-paste a connection code to the
              other person yourself. Files transfer directly, peer-to-peer.</>
            )}{' '}
            Connections are best-effort and may fail on restrictive networks unless you add your own TURN server.
          </p>

          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
            className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground"
          >
            <Settings className="h-4 w-4" /> Advanced connection settings
          </button>

          {showAdvanced && (
            <div className="space-y-3 border-2 border-border bg-muted/40 p-3">
              {!joining && (
                <div className="space-y-1.5">
                  <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">Connection method</span>
                  <div className="flex flex-wrap gap-2">
                    <Button variant={signaling === 'auto' ? 'primary' : 'secondary'} onClick={() => persistSignaling('auto')}>
                      Automatic (share a link)
                    </Button>
                    <Button variant={signaling === 'manual' ? 'primary' : 'secondary'} onClick={() => persistSignaling('manual')}>
                      Manual (copy-paste · no server)
                    </Button>
                  </div>
                </div>
              )}
              <label className="block space-y-1.5">
                <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  Your STUN / TURN servers (optional)
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
                  One per line. Leave empty to use public STUN. A TURN server makes connections work on strict networks.
                </span>
              </label>
            </div>
          )}

          <Button onClick={start}>Continue</Button>
        </div>
      </div>
    );
  }

  const statusLabel: Record<string, string> = {
    connecting: 'Connecting…',
    waiting: signaling === 'manual' ? 'Waiting to connect…' : 'Waiting for the other device to join…',
    connected: isSending ? 'Connected — choose a file to send.' : 'Connected — waiting for a file…',
    transferring: 'Transferring…',
    done: isSending ? 'Sent!' : 'Received!',
  };

  const codeBox = (value: string) => (
    <div className="space-y-1.5">
      <textarea readOnly value={value} rows={3} className="w-full resize-y break-all border-2 border-border bg-muted p-2 font-mono text-xs" />
      <CopyButton value={value} label="Copy code" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* ----- Manual mode ----- */}
      {signaling === 'manual' && !manualRole && (
        <div className="space-y-2">
          <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Manual connection — pick a role</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={chooseSend} disabled={manualBusy}>I&apos;m sending</Button>
            <Button variant="secondary" onClick={chooseReceive}>I&apos;m receiving</Button>
          </div>
        </div>
      )}

      {signaling === 'manual' && manualRole === 'send' && t.status !== 'connected' && t.status !== 'transferring' && t.status !== 'done' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-sm font-bold">Step 1 — send this offer code to the other person</p>
            {manualBusy && !offerCode ? <p className="text-sm text-muted-foreground">Preparing…</p> : codeBox(offerCode)}
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-bold">Step 2 — paste the answer code they send back</p>
            <textarea
              value={pastedAnswer}
              onChange={e => setPastedAnswer(e.target.value)}
              rows={3}
              spellCheck={false}
              className="w-full resize-y break-all border-2 border-border bg-muted p-2 font-mono text-xs outline-none focus:shadow-brutal-sm"
            />
            <Button onClick={submitAnswer} disabled={!pastedAnswer.trim()}>Connect</Button>
          </div>
        </div>
      )}

      {signaling === 'manual' && manualRole === 'receive' && t.status !== 'connected' && t.status !== 'transferring' && t.status !== 'done' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-sm font-bold">Step 1 — paste the offer code from the sender</p>
            <textarea
              value={pastedOffer}
              onChange={e => setPastedOffer(e.target.value)}
              rows={3}
              spellCheck={false}
              className="w-full resize-y break-all border-2 border-border bg-muted p-2 font-mono text-xs outline-none focus:shadow-brutal-sm"
            />
            <Button onClick={submitOffer} disabled={!pastedOffer.trim() || manualBusy}>Generate answer</Button>
          </div>
          {answerCode && (
            <div className="space-y-1.5">
              <p className="text-sm font-bold">Step 2 — send this answer code back to the sender</p>
              {codeBox(answerCode)}
            </div>
          )}
        </div>
      )}

      {manualErr && <Alert variant="error">{manualErr}</Alert>}

      {/* ----- Auto mode: shareable link ----- */}
      {signaling === 'auto' && !joining && (t.status === 'connecting' || t.status === 'waiting') && (
        <div className="space-y-2">
          <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Share this link with the other device</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="break-all border-2 border-border bg-muted px-3 py-2 text-sm">{link}</code>
            <CopyButton value={link} label="Copy link" />
          </div>
        </div>
      )}

      {/* ----- Shared status + transfer ----- */}
      {t.status !== 'error' && statusLabel[t.status] && (
        <p className="text-sm text-muted-foreground">{statusLabel[t.status]}</p>
      )}
      {t.error && <Alert variant="error">{t.error}</Alert>}

      {isSending && (t.status === 'connected' || t.status === 'done') && (
        <Dropzone onDrop={onDrop} multiple={false}>
          <div className="space-y-1">
            <p className="flex items-center justify-center gap-2 text-lg font-bold">
              <Send className="h-5 w-5" /> Drop a file to send
            </p>
            <p className="text-sm text-muted-foreground">or click to browse · sent directly to the other device</p>
          </div>
        </Dropzone>
      )}

      {(t.status === 'transferring' || (t.status === 'done' && isSending)) && (
        <ProgressBar percent={t.progress} label={isSending ? `Sending ${sentName.current}` : 'Transferring'} />
      )}

      {!isSending && t.incoming && (
        <div className="space-y-2 border-2 border-border p-3">
          <p className="text-sm font-bold">{t.incoming.name} · {formatBytes(t.incoming.size)}</p>
          {t.status === 'transferring' && <ProgressBar percent={t.progress} label="Receiving" />}
          {t.status === 'done' && t.receivedBlob && (
            <Button onClick={downloadReceived}>
              <Download className="h-4 w-4" /> Download file
            </Button>
          )}
        </div>
      )}

      <p className="border-t border-border pt-3 text-xs text-muted-foreground">
        <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
        Files transfer directly between devices (peer-to-peer).{' '}
        {signaling === 'manual'
          ? 'Manual mode uses no server at all.'
          : 'A minimal signaling server is used only to introduce the two devices (~2 KB handshake) — your files never pass through it.'}
      </p>
    </div>
  );
}
