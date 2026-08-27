import { useCallback, useEffect, useRef, useState } from 'react';
import { connectSignal, type SignalClient } from '@/tools/webrtc/signal-client';
import { createPeer, type PeerHandles } from '@/tools/webrtc/peer';
import type { SignalMessage } from '@/tools/webrtc/signal.lib';
import { encodeMsg, decodeMsg, type RemoteMsg } from '@/tools/media/teleprompter-remote.lib';

export type LinkStatus = 'idle' | 'waiting' | 'connecting' | 'connected' | 'disconnected' | 'error';

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
  const onMsgRef = useRef(onMessage);
  onMsgRef.current = onMessage;

  const wireChannel = useCallback((ch: RTCDataChannel) => {
    channelRef.current = ch;
    ch.onopen = () => setStatus('connected');
    ch.onclose = () => setStatus('disconnected');
    ch.onmessage = (e) => {
      if (typeof e.data !== 'string') return;
      const m = decodeMsg(e.data);
      if (m) onMsgRef.current(m);
    };
  }, []);

  const setupPeer = useCallback((initiator: boolean) => {
    peerRef.current?.close();
    peerRef.current = createPeer({
      initiator,
      sendSignal: (msg) => signalRef.current?.send(msg),
      onState: (s) => {
        if (s === 'connected') setStatus('connected');
        else if (s === 'failed' || s === 'disconnected' || s === 'closed') setStatus('disconnected');
      },
      onChannel: wireChannel,
    });
  }, [wireChannel]);

  const connect = useCallback((code: string, role: 'host' | 'guest') => {
    setStatus(role === 'host' ? 'waiting' : 'connecting');
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
  }, [setupPeer]);

  const send = useCallback((m: RemoteMsg) => {
    const ch = channelRef.current;
    if (ch && ch.readyState === 'open') ch.send(encodeMsg(m));
  }, []);

  const close = useCallback(() => {
    channelRef.current = null;
    peerRef.current?.close(); peerRef.current = null;
    signalRef.current?.close(); signalRef.current = null;
    setStatus('idle');
  }, []);

  useEffect(() => () => {
    channelRef.current = null;
    peerRef.current?.close();
    signalRef.current?.close();
  }, []);

  return { status, connect, send, close };
}
