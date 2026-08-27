import { useCallback, useEffect, useRef, useState } from 'react';
import { connectSignal, type SignalClient } from '@/tools/webrtc/signal-client';
import { createPeer, type PeerHandles } from '@/tools/webrtc/peer';
import type { SignalMessage } from '@/tools/webrtc/signal.lib';
import { DEFAULT_ICE_SERVERS } from '@/tools/webrtc/ice.lib';
import { encodeMsg, decodeMsg, type RemoteMsg } from '@/tools/media/teleprompter-remote.lib';

/**
 * Fetch short-lived TURN credentials so pairing works across strict NATs (a
 * phone on mobile data). Falls back to STUN-only if TURN isn't configured.
 */
async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const res = await fetch('/api/turn', { cache: 'no-store' });
    if (!res.ok) return DEFAULT_ICE_SERVERS;
    const data = (await res.json()) as { iceServers?: RTCIceServer | RTCIceServer[] };
    const t = data.iceServers;
    const turn = Array.isArray(t) ? t : t ? [t] : [];
    return turn.length ? [...DEFAULT_ICE_SERVERS, ...turn] : DEFAULT_ICE_SERVERS;
  } catch {
    return DEFAULT_ICE_SERVERS;
  }
}

export type LinkStatus = 'idle' | 'waiting' | 'connecting' | 'connected' | 'disconnected' | 'error';

/** Let a transient ICE 'disconnected' self-heal before we report a drop. */
const DISCONNECT_GRACE_MS = 5000;

/**
 * Pair two devices for the teleprompter over the shared WebRTC stack and carry
 * RemoteMsg control traffic on the data channel. The host waits for the guest;
 * on `peer-joined` the host offers, the guest answers. Only the room code + SDP/
 * ICE touch the signaling server — the messages themselves stay peer-to-peer.
 */
export function useTeleprompterLink(onMessage: (m: RemoteMsg) => void) {
  const [status, setStatus] = useState<LinkStatus>('idle');
  const signalRef = useRef<SignalClient | null>(null);
  const peerRef = useRef<PeerHandles | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iceRef = useRef<RTCIceServer[]>(DEFAULT_ICE_SERVERS);
  const onMsgRef = useRef(onMessage);
  onMsgRef.current = onMessage;

  const clearDisconnect = useCallback(() => {
    if (disconnectTimerRef.current) { clearTimeout(disconnectTimerRef.current); disconnectTimerRef.current = null; }
  }, []);

  const wireChannel = useCallback((ch: RTCDataChannel) => {
    channelRef.current = ch;
    ch.onopen = () => { clearDisconnect(); setStatus('connected'); };
    ch.onclose = () => setStatus('disconnected');
    ch.onmessage = (e) => {
      if (typeof e.data !== 'string') return;
      const m = decodeMsg(e.data);
      if (m) onMsgRef.current(m);
    };
  }, [clearDisconnect]);

  const setupPeer = useCallback((initiator: boolean) => {
    peerRef.current?.close();
    peerRef.current = createPeer({
      initiator,
      sendSignal: (msg) => signalRef.current?.send(msg),
      onState: (s) => {
        if (s === 'connected') { clearDisconnect(); setStatus('connected'); }
        // A bare ICE 'disconnected' is often transient — wait before reporting it.
        else if (s === 'disconnected') {
          clearDisconnect();
          disconnectTimerRef.current = setTimeout(() => setStatus('disconnected'), DISCONNECT_GRACE_MS);
        } else if (s === 'failed' || s === 'closed') { clearDisconnect(); setStatus('disconnected'); }
      },
      onChannel: wireChannel,
      iceServers: iceRef.current,
    });
  }, [wireChannel, clearDisconnect]);

  const connect = useCallback((code: string, role: 'host' | 'guest') => {
    setStatus(role === 'host' ? 'waiting' : 'connecting');
    // Get TURN credentials first so the peer (created on the next signaling
    // message) can traverse strict NATs; then open the signaling channel.
    void fetchIceServers().then((ice) => {
      iceRef.current = ice;
      signalRef.current = connectSignal(code, {
        onMessage: (msg: SignalMessage) => {
          switch (msg.type) {
            case 'welcome': if (msg.role === 'guest') setupPeer(false); else setStatus('waiting'); break;
            case 'peer-joined': setupPeer(true); break;
            case 'peer-left': setStatus('disconnected'); break;
            case 'full': setStatus('error'); break;
            default: void peerRef.current?.applySignal(msg); // offer / answer / ice
          }
        },
        onError: () => setStatus('error'),
      });
    });
  }, [setupPeer]);

  const send = useCallback((m: RemoteMsg) => {
    const ch = channelRef.current;
    if (ch && ch.readyState === 'open') ch.send(encodeMsg(m));
  }, []);

  const close = useCallback(() => {
    clearDisconnect();
    channelRef.current = null;
    peerRef.current?.close(); peerRef.current = null;
    signalRef.current?.close(); signalRef.current = null;
    setStatus('idle');
  }, [clearDisconnect]);

  useEffect(() => () => {
    if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
    channelRef.current = null;
    peerRef.current?.close();
    signalRef.current?.close();
  }, []);

  return { status, connect, send, close };
}
