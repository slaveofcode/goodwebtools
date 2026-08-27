import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Video, VideoOff, Mic, MicOff, MonitorUp, SwitchCamera, PhoneOff, Send, ShieldCheck, Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { CopyButton } from '@/components/ui/CopyButton';
import { useVideoCall } from '@/hooks/useVideoCall';
import { makeRoomId, roomLink, roomIdFromHash } from '@/tools/webrtc/signal.lib';
import { effectiveIceServers } from '@/tools/webrtc/ice.lib';
import { fetchTurnServers } from '@/tools/webrtc/turn';
import type { Lang } from '@/i18n/config';

type Signaling = 'auto' | 'manual';
type ManualRole = 'call' | 'answer';

const ICE_KEY = 'gwt.webrtc.ice';
const SIGNALING_KEY = 'gwt.webrtc.signaling';
const ROUTE = '/tools/video-call';

const TR: Record<Lang, {
  beforeConnect: string;
  introAuto: ReactNode; introManual: ReactNode; askAccess: string;
  advancedSettings: string; connMethod: string; autoMethod: string; manualMethod: string;
  stunLabel: string; stunHint: string; continue: string;
  callEnded: string; startNew: string;
  overlayShare: string; overlayWaiting: string; overlayConnecting: string; overlaySettingUp: string;
  mute: string; unmute: string; camOff: string; camOn: string;
  stopSharing: string; shareScreen: string; flip: string; chat: string; hangUp: string;
  shareInvite: string; copyLink: string;
  pickRole: string; imCalling: string; imAnswering: string;
  step1Invite: string; preparing: string; step2Answer: string; connect: string;
  step1PasteInvite: string; genAnswer: string; step2SendAnswer: string; copyCode: string;
  noMessages: string; typeMessage: string;
  footerLine: string; footerManual: string; footerAuto: string;
  errCreateInvite: string; errInvalidAnswer: string; errInvalidInvite: string;
}> = {
  en: {
    beforeConnect: 'Before you connect',
    introAuto: (
      <>To introduce your two devices, GoodWebTools uses a small <strong>signaling server</strong> to exchange
      connection details (about 2&nbsp;KB). Your video, audio, and chat travel <strong>directly, peer-to-peer</strong>,
      and never pass through our server.</>
    ),
    introManual: (
      <><strong>Manual mode uses no server at all.</strong> You&apos;ll copy-paste an invite code to the other person
      yourself. Video, audio and chat travel directly, peer-to-peer.</>
    ),
    askAccess: 'You’ll be asked for camera and microphone access. Connections are best-effort and may fail on restrictive networks unless you add your own TURN server.',
    advancedSettings: 'Advanced connection settings',
    connMethod: 'Connection method',
    autoMethod: 'Automatic (share a link)',
    manualMethod: 'Manual (copy-paste · no server)',
    stunLabel: 'Your STUN / TURN servers (optional)',
    stunHint: 'One per line. Leave empty to use public STUN. A TURN server makes calls work on strict networks.',
    continue: 'Continue',
    callEnded: 'Call ended',
    startNew: 'Start a new call',
    overlayShare: 'Share the link below to invite someone…',
    overlayWaiting: 'Waiting to connect…',
    overlayConnecting: 'Connecting…',
    overlaySettingUp: 'Setting up your camera…',
    mute: 'Mute',
    unmute: 'Unmute',
    camOff: 'Camera off',
    camOn: 'Camera on',
    stopSharing: 'Stop sharing',
    shareScreen: 'Share screen',
    flip: 'Flip',
    chat: 'Chat',
    hangUp: 'Hang up',
    shareInvite: 'Share this link to invite someone',
    copyLink: 'Copy link',
    pickRole: 'Manual connection — pick a role',
    imCalling: 'I’m calling',
    imAnswering: 'I’m answering',
    step1Invite: 'Step 1 — send this invite code to the other person',
    preparing: 'Preparing…',
    step2Answer: 'Step 2 — paste the answer code they send back',
    connect: 'Connect',
    step1PasteInvite: 'Step 1 — paste the invite code from the caller',
    genAnswer: 'Generate answer',
    step2SendAnswer: 'Step 2 — send this answer code back to the caller',
    copyCode: 'Copy code',
    noMessages: 'No messages yet.',
    typeMessage: 'Type a message…',
    footerLine: 'Video, audio and chat travel directly between devices (peer-to-peer).',
    footerManual: 'Manual mode uses no server at all.',
    footerAuto: 'A minimal signaling server only introduces the two devices — your media never passes through it.',
    errCreateInvite: 'Could not create the invite.',
    errInvalidAnswer: 'Invalid answer code.',
    errInvalidInvite: 'Invalid invite code.',
  },
  id: {
    beforeConnect: 'Sebelum Anda terhubung',
    introAuto: (
      <>Untuk mengenalkan kedua perangkat Anda, GoodWebTools memakai sebuah <strong>signaling server</strong> kecil untuk
      bertukar detail koneksi (sekitar 2&nbsp;KB). Video, audio, dan chat Anda berjalan <strong>langsung, peer-to-peer</strong>,
      dan tidak pernah melewati server kami.</>
    ),
    introManual: (
      <><strong>Mode manual tidak memakai server sama sekali.</strong> Anda menyalin-tempel kode undangan ke orang lain
      sendiri. Video, audio, dan chat berjalan langsung, peer-to-peer.</>
    ),
    askAccess: 'Anda akan diminta izin akses kamera dan mikrofon. Koneksi bersifat best-effort dan bisa gagal di jaringan yang ketat kecuali Anda menambahkan server TURN sendiri.',
    advancedSettings: 'Pengaturan koneksi lanjutan',
    connMethod: 'Metode koneksi',
    autoMethod: 'Otomatis (bagikan tautan)',
    manualMethod: 'Manual (salin-tempel · tanpa server)',
    stunLabel: 'Server STUN / TURN Anda (opsional)',
    stunHint: 'Satu per baris. Kosongkan untuk memakai STUN publik. Server TURN membuat panggilan berfungsi di jaringan ketat.',
    continue: 'Lanjutkan',
    callEnded: 'Panggilan berakhir',
    startNew: 'Mulai panggilan baru',
    overlayShare: 'Bagikan tautan di bawah untuk mengundang seseorang…',
    overlayWaiting: 'Menunggu untuk terhubung…',
    overlayConnecting: 'Menghubungkan…',
    overlaySettingUp: 'Menyiapkan kamera Anda…',
    mute: 'Bisukan',
    unmute: 'Aktifkan suara',
    camOff: 'Matikan kamera',
    camOn: 'Nyalakan kamera',
    stopSharing: 'Berhenti berbagi',
    shareScreen: 'Bagikan layar',
    flip: 'Balik',
    chat: 'Chat',
    hangUp: 'Tutup',
    shareInvite: 'Bagikan tautan ini untuk mengundang seseorang',
    copyLink: 'Salin tautan',
    pickRole: 'Koneksi manual — pilih peran',
    imCalling: 'Saya memanggil',
    imAnswering: 'Saya menjawab',
    step1Invite: 'Langkah 1 — kirim kode undangan ini ke orang lain',
    preparing: 'Menyiapkan…',
    step2Answer: 'Langkah 2 — tempel kode answer yang mereka kirim balik',
    connect: 'Hubungkan',
    step1PasteInvite: 'Langkah 1 — tempel kode undangan dari pemanggil',
    genAnswer: 'Buat answer',
    step2SendAnswer: 'Langkah 2 — kirim kode answer ini balik ke pemanggil',
    copyCode: 'Salin kode',
    noMessages: 'Belum ada pesan.',
    typeMessage: 'Ketik pesan…',
    footerLine: 'Video, audio, dan chat berjalan langsung antar perangkat (peer-to-peer).',
    footerManual: 'Mode manual tidak memakai server sama sekali.',
    footerAuto: 'Signaling server minimal hanya mengenalkan kedua perangkat — media Anda tidak pernah melewatinya.',
    errCreateInvite: 'Tidak bisa membuat undangan.',
    errInvalidAnswer: 'Kode answer tidak valid.',
    errInvalidInvite: 'Kode undangan tidak valid.',
  },
};

function VideoTile({ stream, muted, mirror, className }: { stream: MediaStream | null; muted?: boolean; mirror?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={`${mirror ? 'scale-x-[-1] ' : ''}${className ?? ''}`}
    />
  );
}

export default function VideoCall({ lang = 'en' }: { lang?: Lang }) {
  const c = useVideoCall();
  const tr = TR[lang] ?? TR.en;
  const [acked, setAcked] = useState(false);
  const [signaling, setSignaling] = useState<Signaling>('auto');
  const [iceText, setIceText] = useState('');
  // Provided TURN servers (from /api/turn) so calls work across strict NATs.
  const [turn, setTurn] = useState<RTCIceServer[]>([]);
  useEffect(() => { fetchTurnServers().then(setTurn); }, []);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [joining, setJoining] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [link, setLink] = useState('');

  const [manualRole, setManualRole] = useState<ManualRole | null>(null);
  const [offerCode, setOfferCode] = useState('');
  const [answerCode, setAnswerCode] = useState('');
  const [pastedAnswer, setPastedAnswer] = useState('');
  const [pastedOffer, setPastedOffer] = useState('');
  const [manualBusy, setManualBusy] = useState(false);
  const [manualErr, setManualErr] = useState('');

  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    try {
      setIceText(localStorage.getItem(ICE_KEY) ?? '');
      const s = localStorage.getItem(SIGNALING_KEY);
      if (s === 'manual' || s === 'auto') setSignaling(s);
    } catch { /* ignore */ }
    const fromHash = roomIdFromHash(window.location.hash);
    if (fromHash) { setJoining(true); setSignaling('auto'); setRoomId(fromHash); }
    else { const id = makeRoomId(); setRoomId(id); setLink(roomLink(window.location.origin, id, ROUTE)); }
  }, []);

  const persistIce = (t: string) => { setIceText(t); try { localStorage.setItem(ICE_KEY, t); } catch { /* */ } };
  const persistSignaling = (s: Signaling) => { setSignaling(s); try { localStorage.setItem(SIGNALING_KEY, s); } catch { /* */ } };
  const ice = () => [...turn, ...effectiveIceServers(iceText)];

  const start = async () => {
    setAcked(true);
    const ok = await c.startMedia();
    if (!ok) return;
    if (signaling === 'auto') c.connect(roomId, ice());
  };

  const chooseCall = async () => {
    setManualRole('call'); setManualErr(''); setManualBusy(true);
    try { setOfferCode(await c.manualCreateOffer(ice())); }
    catch (e) { setManualErr(e instanceof Error ? e.message : tr.errCreateInvite); }
    finally { setManualBusy(false); }
  };
  const submitAnswer = async () => {
    setManualErr('');
    try { await c.manualAcceptAnswer(pastedAnswer.trim()); }
    catch (e) { setManualErr(e instanceof Error ? e.message : tr.errInvalidAnswer); }
  };
  const chooseAnswer = () => { setManualRole('answer'); setManualErr(''); };
  const submitOffer = async () => {
    setManualErr(''); setManualBusy(true);
    try { setAnswerCode(await c.manualAcceptOffer(pastedOffer.trim(), ice())); }
    catch (e) { setManualErr(e instanceof Error ? e.message : tr.errInvalidInvite); }
    finally { setManualBusy(false); }
  };

  const sendChat = () => { if (chatInput.trim()) { c.sendChat(chatInput); setChatInput(''); } };

  const codeBox = (value: string) => (
    <div className="space-y-1.5">
      <textarea readOnly value={value} rows={3} className="w-full resize-y break-all border-2 border-border bg-muted p-2 font-mono text-xs" />
      <CopyButton value={value} label={tr.copyCode} />
    </div>
  );

  // ---------- Ack + settings gate ----------
  if (!acked) {
    return (
      <div className="space-y-4">
        <div className="space-y-3 border-2 border-border p-4">
          <p className="flex items-center gap-2 text-lg font-bold"><ShieldCheck className="h-5 w-5" /> {tr.beforeConnect}</p>
          <p className="text-sm text-muted-foreground">
            {signaling === 'auto' ? tr.introAuto : tr.introManual}{' '}
            {tr.askAccess}
          </p>

          <button type="button" onClick={() => setShowAdvanced(v => !v)} className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground">
            <Settings className="h-4 w-4" /> {tr.advancedSettings}
          </button>
          {showAdvanced && (
            <div className="space-y-3 border-2 border-border bg-muted/40 p-3">
              {!joining && (
                <div className="space-y-1.5">
                  <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">{tr.connMethod}</span>
                  <div className="flex flex-wrap gap-2">
                    <Button variant={signaling === 'auto' ? 'primary' : 'secondary'} onClick={() => persistSignaling('auto')}>{tr.autoMethod}</Button>
                    <Button variant={signaling === 'manual' ? 'primary' : 'secondary'} onClick={() => persistSignaling('manual')}>{tr.manualMethod}</Button>
                  </div>
                </div>
              )}
              <label className="block space-y-1.5">
                <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">{tr.stunLabel}</span>
                <textarea value={iceText} onChange={e => persistIce(e.target.value)} rows={3} spellCheck={false}
                  placeholder={'stun:stun.example.com:3478\nturn:turn.example.com:3478 username credential'}
                  className="w-full resize-y border-2 border-border bg-background p-2 font-mono text-xs outline-none focus:shadow-brutal-sm" />
                <span className="block text-xs text-muted-foreground">{tr.stunHint}</span>
              </label>
            </div>
          )}
          <Button onClick={start}>{tr.continue}</Button>
        </div>
      </div>
    );
  }

  const inCall = c.status === 'in-call';

  return (
    <div className="space-y-4">
      {c.error && <Alert variant="error">{c.error}</Alert>}
      {manualErr && <Alert variant="error">{manualErr}</Alert>}

      {c.status === 'ended' && (
        <div className="space-y-3 border-2 border-border p-4">
          <p className="text-lg font-bold">{tr.callEnded}</p>
          <Button onClick={() => location.reload()}>{tr.startNew}</Button>
        </div>
      )}

      {/* Video area */}
      {c.status !== 'ended' && (
        <div className="relative overflow-hidden border-2 border-border bg-black">
          <VideoTile stream={c.remoteStream} className="max-h-[70vh] w-full bg-black object-contain" />
          {!c.remoteStream && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/80">
              {c.status === 'waiting' && !joining ? tr.overlayShare
                : c.status === 'waiting' ? tr.overlayWaiting
                : c.status === 'connecting' ? tr.overlayConnecting
                : tr.overlaySettingUp}
            </div>
          )}
          {/* Local self-view */}
          <div className="absolute bottom-3 right-3 w-28 overflow-hidden border-2 border-white/70 bg-black sm:w-40">
            <VideoTile stream={c.localStream} muted mirror className="w-full" />
          </div>
        </div>
      )}

      {/* Controls */}
      {(inCall || c.status === 'connecting' || c.status === 'waiting') && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={c.micOn ? 'secondary' : 'primary'} onClick={c.toggleMic} aria-pressed={!c.micOn}>
            {c.micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}{c.micOn ? tr.mute : tr.unmute}
          </Button>
          <Button variant={c.camOn ? 'secondary' : 'primary'} onClick={c.toggleCam} aria-pressed={!c.camOn}>
            {c.camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}{c.camOn ? tr.camOff : tr.camOn}
          </Button>
          <Button variant={c.sharing ? 'primary' : 'secondary'} onClick={c.toggleScreenShare}>
            <MonitorUp className="h-4 w-4" />{c.sharing ? tr.stopSharing : tr.shareScreen}
          </Button>
          {c.hasMultipleCameras && !c.sharing && (
            <Button variant="secondary" onClick={c.switchCamera}><SwitchCamera className="h-4 w-4" />{tr.flip}</Button>
          )}
          <Button variant="secondary" onClick={() => setShowChat(s => !s)}>{tr.chat}{c.messages.length ? ` (${c.messages.length})` : ''}</Button>
          <Button variant="ghost" onClick={c.hangUp}><PhoneOff className="h-4 w-4" />{tr.hangUp}</Button>
        </div>
      )}

      {/* Auto link (creator, before connect) */}
      {signaling === 'auto' && !joining && !inCall && c.status !== 'ended' && (
        <div className="space-y-2">
          <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{tr.shareInvite}</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="break-all border-2 border-border bg-muted px-3 py-2 text-sm">{link}</code>
            <CopyButton value={link} label={tr.copyLink} />
          </div>
        </div>
      )}

      {/* Manual mode */}
      {signaling === 'manual' && !manualRole && !inCall && c.status !== 'ended' && (
        <div className="space-y-2">
          <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{tr.pickRole}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={chooseCall} disabled={manualBusy}>{tr.imCalling}</Button>
            <Button variant="secondary" onClick={chooseAnswer}>{tr.imAnswering}</Button>
          </div>
        </div>
      )}
      {signaling === 'manual' && manualRole === 'call' && !inCall && c.status !== 'ended' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-sm font-bold">{tr.step1Invite}</p>
            {manualBusy && !offerCode ? <p className="text-sm text-muted-foreground">{tr.preparing}</p> : codeBox(offerCode)}
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-bold">{tr.step2Answer}</p>
            <textarea value={pastedAnswer} onChange={e => setPastedAnswer(e.target.value)} rows={3} spellCheck={false}
              className="w-full resize-y break-all border-2 border-border bg-muted p-2 font-mono text-xs outline-none focus:shadow-brutal-sm" />
            <Button onClick={submitAnswer} disabled={!pastedAnswer.trim()}>{tr.connect}</Button>
          </div>
        </div>
      )}
      {signaling === 'manual' && manualRole === 'answer' && !inCall && c.status !== 'ended' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-sm font-bold">{tr.step1PasteInvite}</p>
            <textarea value={pastedOffer} onChange={e => setPastedOffer(e.target.value)} rows={3} spellCheck={false}
              className="w-full resize-y break-all border-2 border-border bg-muted p-2 font-mono text-xs outline-none focus:shadow-brutal-sm" />
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

      {/* Chat panel */}
      {showChat && (inCall || c.messages.length > 0) && (
        <div className="space-y-2 border-2 border-border p-3">
          <div className="max-h-56 space-y-1.5 overflow-y-auto">
            {c.messages.length === 0 && <p className="text-sm text-muted-foreground">{tr.noMessages}</p>}
            {c.messages.map(m => (
              <p key={m.id} className={`text-sm ${m.mine ? 'text-right' : ''}`}>
                <span className={`inline-block max-w-[85%] border-2 border-border px-2 py-1 ${m.mine ? 'bg-accent text-accent-foreground' : 'bg-muted'}`}>{m.text}</span>
              </p>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendChat(); }}
              placeholder={tr.typeMessage}
              className="flex-1 border-2 border-border bg-muted px-3 py-2 text-sm outline-none focus:shadow-brutal-sm" />
            <Button onClick={sendChat} disabled={!chatInput.trim()}><Send className="h-4 w-4" /></Button>
          </div>
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
