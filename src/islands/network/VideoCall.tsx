import { useEffect, useRef, useState } from 'react';
import {
  Video, VideoOff, Mic, MicOff, MonitorUp, SwitchCamera, PhoneOff, Send, ShieldCheck, Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { CopyButton } from '@/components/ui/CopyButton';
import { useVideoCall } from '@/hooks/useVideoCall';
import { makeRoomId, roomLink, roomIdFromHash } from '@/tools/webrtc/signal.lib';
import { effectiveIceServers } from '@/tools/webrtc/ice.lib';

type Signaling = 'auto' | 'manual';
type ManualRole = 'call' | 'answer';

const ICE_KEY = 'gwt.webrtc.ice';
const SIGNALING_KEY = 'gwt.webrtc.signaling';
const ROUTE = '/tools/video-call';

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

export default function VideoCall() {
  const c = useVideoCall();
  const [acked, setAcked] = useState(false);
  const [signaling, setSignaling] = useState<Signaling>('auto');
  const [iceText, setIceText] = useState('');
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
  const ice = () => effectiveIceServers(iceText);

  const start = async () => {
    setAcked(true);
    const ok = await c.startMedia();
    if (!ok) return;
    if (signaling === 'auto') c.connect(roomId, ice());
  };

  const chooseCall = async () => {
    setManualRole('call'); setManualErr(''); setManualBusy(true);
    try { setOfferCode(await c.manualCreateOffer(ice())); }
    catch (e) { setManualErr(e instanceof Error ? e.message : 'Could not create the invite.'); }
    finally { setManualBusy(false); }
  };
  const submitAnswer = async () => {
    setManualErr('');
    try { await c.manualAcceptAnswer(pastedAnswer.trim()); }
    catch (e) { setManualErr(e instanceof Error ? e.message : 'Invalid answer code.'); }
  };
  const chooseAnswer = () => { setManualRole('answer'); setManualErr(''); };
  const submitOffer = async () => {
    setManualErr(''); setManualBusy(true);
    try { setAnswerCode(await c.manualAcceptOffer(pastedOffer.trim(), ice())); }
    catch (e) { setManualErr(e instanceof Error ? e.message : 'Invalid invite code.'); }
    finally { setManualBusy(false); }
  };

  const sendChat = () => { if (chatInput.trim()) { c.sendChat(chatInput); setChatInput(''); } };

  const codeBox = (value: string) => (
    <div className="space-y-1.5">
      <textarea readOnly value={value} rows={3} className="w-full resize-y break-all border-2 border-border bg-muted p-2 font-mono text-xs" />
      <CopyButton value={value} label="Copy code" />
    </div>
  );

  // ---------- Ack + settings gate ----------
  if (!acked) {
    return (
      <div className="space-y-4">
        <div className="space-y-3 border-2 border-border p-4">
          <p className="flex items-center gap-2 text-lg font-bold"><ShieldCheck className="h-5 w-5" /> Before you connect</p>
          <p className="text-sm text-muted-foreground">
            {signaling === 'auto' ? (
              <>To introduce your two devices, GoodWebTools uses a small <strong>signaling server</strong> to exchange
              connection details (about 2&nbsp;KB). Your video, audio, and chat travel <strong>directly, peer-to-peer</strong>,
              and never pass through our server.</>
            ) : (
              <><strong>Manual mode uses no server at all.</strong> You&apos;ll copy-paste an invite code to the other person
              yourself. Video, audio and chat travel directly, peer-to-peer.</>
            )}{' '}
            You&apos;ll be asked for camera and microphone access. Connections are best-effort and may fail on restrictive
            networks unless you add your own TURN server.
          </p>

          <button type="button" onClick={() => setShowAdvanced(v => !v)} className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground">
            <Settings className="h-4 w-4" /> Advanced connection settings
          </button>
          {showAdvanced && (
            <div className="space-y-3 border-2 border-border bg-muted/40 p-3">
              {!joining && (
                <div className="space-y-1.5">
                  <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">Connection method</span>
                  <div className="flex flex-wrap gap-2">
                    <Button variant={signaling === 'auto' ? 'primary' : 'secondary'} onClick={() => persistSignaling('auto')}>Automatic (share a link)</Button>
                    <Button variant={signaling === 'manual' ? 'primary' : 'secondary'} onClick={() => persistSignaling('manual')}>Manual (copy-paste · no server)</Button>
                  </div>
                </div>
              )}
              <label className="block space-y-1.5">
                <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">Your STUN / TURN servers (optional)</span>
                <textarea value={iceText} onChange={e => persistIce(e.target.value)} rows={3} spellCheck={false}
                  placeholder={'stun:stun.example.com:3478\nturn:turn.example.com:3478 username credential'}
                  className="w-full resize-y border-2 border-border bg-background p-2 font-mono text-xs outline-none focus:shadow-brutal-sm" />
                <span className="block text-xs text-muted-foreground">One per line. Leave empty to use public STUN. A TURN server makes calls work on strict networks.</span>
              </label>
            </div>
          )}
          <Button onClick={start}>Continue</Button>
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
          <p className="text-lg font-bold">Call ended</p>
          <Button onClick={() => location.reload()}>Start a new call</Button>
        </div>
      )}

      {/* Video area */}
      {c.status !== 'ended' && (
        <div className="relative overflow-hidden border-2 border-border bg-black">
          <VideoTile stream={c.remoteStream} className="max-h-[70vh] w-full bg-black object-contain" />
          {!c.remoteStream && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/80">
              {c.status === 'waiting' && !joining ? 'Share the link below to invite someone…'
                : c.status === 'waiting' ? 'Waiting to connect…'
                : c.status === 'connecting' ? 'Connecting…'
                : 'Setting up your camera…'}
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
            {c.micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}{c.micOn ? 'Mute' : 'Unmute'}
          </Button>
          <Button variant={c.camOn ? 'secondary' : 'primary'} onClick={c.toggleCam} aria-pressed={!c.camOn}>
            {c.camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}{c.camOn ? 'Camera off' : 'Camera on'}
          </Button>
          <Button variant={c.sharing ? 'primary' : 'secondary'} onClick={c.toggleScreenShare}>
            <MonitorUp className="h-4 w-4" />{c.sharing ? 'Stop sharing' : 'Share screen'}
          </Button>
          {c.hasMultipleCameras && !c.sharing && (
            <Button variant="secondary" onClick={c.switchCamera}><SwitchCamera className="h-4 w-4" />Flip</Button>
          )}
          <Button variant="secondary" onClick={() => setShowChat(s => !s)}>Chat{c.messages.length ? ` (${c.messages.length})` : ''}</Button>
          <Button variant="ghost" onClick={c.hangUp}><PhoneOff className="h-4 w-4" />Hang up</Button>
        </div>
      )}

      {/* Auto link (creator, before connect) */}
      {signaling === 'auto' && !joining && !inCall && c.status !== 'ended' && (
        <div className="space-y-2">
          <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Share this link to invite someone</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="break-all border-2 border-border bg-muted px-3 py-2 text-sm">{link}</code>
            <CopyButton value={link} label="Copy link" />
          </div>
        </div>
      )}

      {/* Manual mode */}
      {signaling === 'manual' && !manualRole && !inCall && c.status !== 'ended' && (
        <div className="space-y-2">
          <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Manual connection — pick a role</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={chooseCall} disabled={manualBusy}>I&apos;m calling</Button>
            <Button variant="secondary" onClick={chooseAnswer}>I&apos;m answering</Button>
          </div>
        </div>
      )}
      {signaling === 'manual' && manualRole === 'call' && !inCall && c.status !== 'ended' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-sm font-bold">Step 1 — send this invite code to the other person</p>
            {manualBusy && !offerCode ? <p className="text-sm text-muted-foreground">Preparing…</p> : codeBox(offerCode)}
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-bold">Step 2 — paste the answer code they send back</p>
            <textarea value={pastedAnswer} onChange={e => setPastedAnswer(e.target.value)} rows={3} spellCheck={false}
              className="w-full resize-y break-all border-2 border-border bg-muted p-2 font-mono text-xs outline-none focus:shadow-brutal-sm" />
            <Button onClick={submitAnswer} disabled={!pastedAnswer.trim()}>Connect</Button>
          </div>
        </div>
      )}
      {signaling === 'manual' && manualRole === 'answer' && !inCall && c.status !== 'ended' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-sm font-bold">Step 1 — paste the invite code from the caller</p>
            <textarea value={pastedOffer} onChange={e => setPastedOffer(e.target.value)} rows={3} spellCheck={false}
              className="w-full resize-y break-all border-2 border-border bg-muted p-2 font-mono text-xs outline-none focus:shadow-brutal-sm" />
            <Button onClick={submitOffer} disabled={!pastedOffer.trim() || manualBusy}>Generate answer</Button>
          </div>
          {answerCode && (
            <div className="space-y-1.5">
              <p className="text-sm font-bold">Step 2 — send this answer code back to the caller</p>
              {codeBox(answerCode)}
            </div>
          )}
        </div>
      )}

      {/* Chat panel */}
      {showChat && (inCall || c.messages.length > 0) && (
        <div className="space-y-2 border-2 border-border p-3">
          <div className="max-h-56 space-y-1.5 overflow-y-auto">
            {c.messages.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
            {c.messages.map(m => (
              <p key={m.id} className={`text-sm ${m.mine ? 'text-right' : ''}`}>
                <span className={`inline-block max-w-[85%] border-2 border-border px-2 py-1 ${m.mine ? 'bg-accent text-accent-foreground' : 'bg-muted'}`}>{m.text}</span>
              </p>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendChat(); }}
              placeholder="Type a message…"
              className="flex-1 border-2 border-border bg-muted px-3 py-2 text-sm outline-none focus:shadow-brutal-sm" />
            <Button onClick={sendChat} disabled={!chatInput.trim()}><Send className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      <p className="border-t border-border pt-3 text-xs text-muted-foreground">
        <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
        Video, audio and chat travel directly between devices (peer-to-peer).{' '}
        {signaling === 'manual' ? 'Manual mode uses no server at all.' : 'A minimal signaling server only introduces the two devices — your media never passes through it.'}
      </p>
    </div>
  );
}
