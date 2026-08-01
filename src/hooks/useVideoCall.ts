import { useCallback, useEffect, useRef, useState } from 'react';
import { connectSignal, type SignalClient } from '@/tools/webrtc/signal-client';
import { createPeer, type PeerHandles } from '@/tools/webrtc/peer';
import { createManualConnection, type ManualConnection } from '@/tools/webrtc/manual';
import { encodeChat, decodeChat } from '@/tools/webrtc/chat.lib';

export type CallStatus = 'idle' | 'connecting' | 'waiting' | 'in-call' | 'ended' | 'error';
export type Facing = 'user' | 'environment';

export interface ChatMessage { id: string; mine: boolean; text: string; at: number }

const RECONNECT_MS = 1200;
const DISCONNECT_GRACE_MS = 5000;
const MAX_FAILURES = 4;
const BYE = JSON.stringify({ kind: 'bye' });

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function useVideoCall() {
  const signalRef = useRef<SignalClient | null>(null);
  const peerRef = useRef<PeerHandles | null>(null);
  const manualRef = useRef<ManualConnection | null>(null);
  const chatChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const videoSenderRef = useRef<RTCRtpSender | null>(null);
  const facingRef = useRef<Facing>('user');
  const iceRef = useRef<RTCIceServer[] | undefined>(undefined);
  const sharingRef = useRef(false);

  const reconnectRef = useRef<{ roomId: string } | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef(false);
  const connectedRef = useRef(false);
  const failuresRef = useRef(0);
  const openSignalingRef = useRef<() => void>(() => {});
  const handleFailureRef = useRef<() => void>(() => {});

  const [status, setStatus] = useState<CallStatus>('idle');
  const [error, setError] = useState('');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const clearReconnect = () => { if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; } };
  const clearDisconnect = () => { if (disconnectTimerRef.current) { clearTimeout(disconnectTimerRef.current); disconnectTimerRef.current = null; } };

  const stopSignalingAndPeer = useCallback(() => {
    clearReconnect();
    clearDisconnect();
    peerRef.current?.close();
    manualRef.current?.close();
    signalRef.current?.close();
    peerRef.current = null;
    manualRef.current = null;
    signalRef.current = null;
    chatChannelRef.current = null;
  }, []);

  const stopMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    screenStreamRef.current = null;
    cameraTrackRef.current = null;
    videoSenderRef.current = null;
    sharingRef.current = false;
  }, []);

  // --- Chat over the data channel ---
  const wireChat = useCallback((channel: RTCDataChannel) => {
    chatChannelRef.current = channel;
    channel.onmessage = e => {
      if (typeof e.data !== 'string') return;
      if (e.data === BYE) { stoppedRef.current = true; stopSignalingAndPeer(); setRemoteStream(null); setStatus('ended'); return; }
      const text = decodeChat(e.data);
      if (text) setMessages(m => [...m, { id: uid(), mine: false, text, at: Date.now() }]);
    };
  }, [stopSignalingAndPeer]);

  const sendChat = useCallback((text: string) => {
    const encoded = encodeChat(text);
    if (!encoded) return;
    const ch = chatChannelRef.current;
    if (ch && ch.readyState === 'open') ch.send(encoded);
    setMessages(m => [...m, { id: uid(), mine: true, text: text.trim(), at: Date.now() }]);
  }, []);

  const handleFailure = useCallback(() => {
    if (stoppedRef.current) return;
    clearDisconnect();
    connectedRef.current = false;
    peerRef.current?.close();
    peerRef.current = null;
    failuresRef.current += 1;
    if (!reconnectRef.current) {
      setError('The connection was lost.');
      setStatus('error');
    } else if (failuresRef.current > MAX_FAILURES) {
      setError('Couldn’t keep a stable connection on this network. Try again, or add your own TURN server in Advanced settings.');
      setStatus('error');
    } else {
      setStatus(s => (s === 'ended' ? s : 'connecting'));
      // scheduleReconnect defined below via ref
      if (typeof document === 'undefined' || !document.hidden) {
        clearReconnect();
        reconnectTimerRef.current = setTimeout(() => { if (!stoppedRef.current && !connectedRef.current) openSignalingRef.current(); }, RECONNECT_MS);
      }
    }
  }, []);
  useEffect(() => { handleFailureRef.current = handleFailure; }, [handleFailure]);

  const handlePcState = useCallback((state: RTCPeerConnectionState) => {
    if (state === 'connected') {
      connectedRef.current = true;
      failuresRef.current = 0;
      clearDisconnect();
      clearReconnect();
      signalRef.current?.close();
      signalRef.current = null;
      setStatus('in-call');
    } else if (state === 'disconnected') {
      clearDisconnect();
      disconnectTimerRef.current = setTimeout(() => handleFailureRef.current(), DISCONNECT_GRACE_MS);
    } else if (state === 'failed') {
      handleFailureRef.current();
    }
  }, []);

  const setupPeer = useCallback((initiator: boolean) => {
    peerRef.current?.close();
    peerRef.current = null;
    const signal = signalRef.current;
    if (!signal) return;
    const peer = createPeer({
      initiator,
      iceServers: iceRef.current,
      localStream: localStreamRef.current ?? undefined,
      sendSignal: msg => signal.send(msg),
      onState: handlePcState,
      onTrack: stream => { setRemoteStream(stream); },
      onChannel: wireChat,
    });
    peerRef.current = peer;
    videoSenderRef.current = peer.pc.getSenders().find(s => s.track?.kind === 'video') ?? null;
  }, [handlePcState, wireChat]);

  const scheduleReconnect = useCallback(() => {
    if (stoppedRef.current || connectedRef.current || !reconnectRef.current) return;
    clearReconnect();
    if (typeof document !== 'undefined' && document.hidden) return;
    reconnectTimerRef.current = setTimeout(() => {
      if (stoppedRef.current || connectedRef.current) return;
      openSignalingRef.current();
    }, RECONNECT_MS);
  }, []);

  const openSignaling = useCallback(() => {
    const info = reconnectRef.current;
    if (!info || stoppedRef.current || connectedRef.current) return;
    signalRef.current?.close();
    signalRef.current = null;
    signalRef.current = connectSignal(info.roomId, {
      onMessage: msg => {
        if (connectedRef.current) {
          if (msg.type === 'offer' || msg.type === 'answer' || msg.type === 'ice') peerRef.current?.applySignal(msg);
          return;
        }
        switch (msg.type) {
          case 'welcome':
            if (msg.role === 'guest') setupPeer(false);
            else setStatus('waiting');
            break;
          case 'peer-joined':
            setupPeer(true);
            break;
          case 'peer-left':
            peerRef.current?.close();
            peerRef.current = null;
            setStatus('waiting');
            break;
          case 'full':
            stoppedRef.current = true;
            setError('This call room is already full (two people are connected).');
            setStatus('error');
            break;
          case 'offer':
          case 'answer':
          case 'ice':
            peerRef.current?.applySignal(msg);
            break;
        }
      },
      onClose: () => { if (!connectedRef.current && !stoppedRef.current) scheduleReconnect(); },
      onError: () => { if (!connectedRef.current && !stoppedRef.current) scheduleReconnect(); },
    });
  }, [setupPeer, scheduleReconnect]);
  useEffect(() => { openSignalingRef.current = openSignaling; }, [openSignaling]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && reconnectRef.current && !connectedRef.current && !stoppedRef.current) scheduleReconnect();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [scheduleReconnect]);

  // --- Media capture ---
  const startMedia = useCallback(async (): Promise<boolean> => {
    setError('');
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('This browser can’t access the camera and microphone.');
      setStatus('error');
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facingRef.current }, audio: true });
      localStreamRef.current = stream;
      cameraTrackRef.current = stream.getVideoTracks()[0] ?? null;
      setLocalStream(stream);
      setMicOn(true);
      setCamOn(true);
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setHasMultipleCameras(devices.filter(d => d.kind === 'videoinput').length > 1);
      } catch { /* ignore */ }
      return true;
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      setError(name === 'NotAllowedError' || name === 'SecurityError'
        ? 'Camera/microphone access was blocked — allow it in your browser settings.'
        : 'Could not start the camera or microphone.');
      setStatus('error');
      return false;
    }
  }, []);

  // --- Signaling entry points ---
  const connect = useCallback((roomId: string, iceServers?: RTCIceServer[]) => {
    stopSignalingAndPeer();
    iceRef.current = iceServers;
    reconnectRef.current = { roomId };
    stoppedRef.current = false;
    connectedRef.current = false;
    failuresRef.current = 0;
    setError('');
    setRemoteStream(null);
    setStatus('connecting');
    openSignaling();
  }, [stopSignalingAndPeer, openSignaling]);

  const manualCreateOffer = useCallback(async (iceServers?: RTCIceServer[]): Promise<string> => {
    stopSignalingAndPeer();
    reconnectRef.current = null;
    stoppedRef.current = false;
    connectedRef.current = false;
    setError('');
    setStatus('connecting');
    const conn = createManualConnection({
      initiator: true,
      iceServers,
      localStream: localStreamRef.current ?? undefined,
      onState: handlePcState,
      onTrack: stream => setRemoteStream(stream),
      onChannel: wireChat,
    });
    manualRef.current = conn;
    videoSenderRef.current = conn.pc.getSenders().find(s => s.track?.kind === 'video') ?? null;
    const code = await conn.createOfferCode();
    setStatus('waiting');
    return code;
  }, [stopSignalingAndPeer, handlePcState, wireChat]);

  const manualAcceptAnswer = useCallback(async (answerCode: string) => {
    await manualRef.current?.acceptAnswer(answerCode);
  }, []);

  const manualAcceptOffer = useCallback(async (offerCode: string, iceServers?: RTCIceServer[]): Promise<string> => {
    stopSignalingAndPeer();
    reconnectRef.current = null;
    stoppedRef.current = false;
    connectedRef.current = false;
    setError('');
    setStatus('connecting');
    const conn = createManualConnection({
      initiator: false,
      iceServers,
      localStream: localStreamRef.current ?? undefined,
      onState: handlePcState,
      onTrack: stream => setRemoteStream(stream),
      onChannel: wireChat,
    });
    manualRef.current = conn;
    videoSenderRef.current = conn.pc.getSenders().find(s => s.track?.kind === 'video') ?? null;
    const answer = await conn.acceptOfferReturnAnswer(offerCode);
    setStatus('waiting');
    return answer;
  }, [stopSignalingAndPeer, handlePcState, wireChat]);

  // --- Controls ---
  const toggleMic = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  }, []);

  const toggleCam = useCallback(() => {
    const track = cameraTrackRef.current;
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
  }, []);

  const switchCamera = useCallback(async () => {
    if (sharingRef.current) return; // don't switch while screen sharing
    const next: Facing = facingRef.current === 'user' ? 'environment' : 'user';
    try {
      const ns = await navigator.mediaDevices.getUserMedia({ video: { facingMode: next }, audio: false });
      const newTrack = ns.getVideoTracks()[0];
      if (!newTrack) return;
      newTrack.enabled = camOn;
      if (videoSenderRef.current) await videoSenderRef.current.replaceTrack(newTrack);
      const old = cameraTrackRef.current;
      const stream = localStreamRef.current;
      if (stream && old) { stream.removeTrack(old); old.stop(); stream.addTrack(newTrack); }
      cameraTrackRef.current = newTrack;
      facingRef.current = next;
      setLocalStream(stream); // trigger re-render of the self-view
    } catch { /* ignore switch failure */ }
  }, [camOn]);

  const stopScreen = useCallback(async () => {
    const cam = cameraTrackRef.current;
    if (videoSenderRef.current && cam) { try { await videoSenderRef.current.replaceTrack(cam); } catch { /* */ } }
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    sharingRef.current = false;
    setSharing(false);
  }, []);

  const toggleScreenShare = useCallback(async () => {
    if (sharingRef.current) { await stopScreen(); return; }
    const md = navigator.mediaDevices as MediaDevices & { getDisplayMedia?: (c: MediaStreamConstraints) => Promise<MediaStream> };
    if (!md.getDisplayMedia) { setError('Screen sharing isn’t supported in this browser.'); return; }
    try {
      const display = await md.getDisplayMedia({ video: true });
      const screenTrack = display.getVideoTracks()[0];
      if (!screenTrack) return;
      screenStreamRef.current = display;
      if (videoSenderRef.current) await videoSenderRef.current.replaceTrack(screenTrack);
      screenTrack.onended = () => { void stopScreen(); };
      sharingRef.current = true;
      setSharing(true);
    } catch { /* user cancelled the picker */ }
  }, [stopScreen]);

  const hangUp = useCallback(() => {
    try { if (chatChannelRef.current?.readyState === 'open') chatChannelRef.current.send(BYE); } catch { /* */ }
    stoppedRef.current = true;
    reconnectRef.current = null;
    connectedRef.current = false;
    stopSignalingAndPeer();
    stopMedia();
    setLocalStream(null);
    setRemoteStream(null);
    setStatus('ended');
  }, [stopSignalingAndPeer, stopMedia]);

  useEffect(() => () => { stoppedRef.current = true; stopSignalingAndPeer(); stopMedia(); }, [stopSignalingAndPeer, stopMedia]);

  return {
    status,
    error,
    localStream,
    remoteStream,
    micOn,
    camOn,
    sharing,
    hasMultipleCameras,
    messages,
    startMedia,
    connect,
    manualCreateOffer,
    manualAcceptAnswer,
    manualAcceptOffer,
    toggleMic,
    toggleCam,
    switchCamera,
    toggleScreenShare,
    sendChat,
    hangUp,
  };
}
