import { useCallback, useEffect, useRef, useState } from 'react';
import { connectSignal, type SignalClient } from '@/tools/webrtc/signal-client';
import { createPeer, type PeerHandles } from '@/tools/webrtc/peer';
import { createManualConnection, type ManualConnection } from '@/tools/webrtc/manual';
import {
  CHUNK_SIZE,
  chunkCount,
  chunkRange,
  percent,
  encodeMeta,
  decodeMeta,
  type TransferMeta,
} from '@/tools/webrtc/file-transfer.lib';

export type TransferStatus =
  | 'idle'
  | 'connecting'
  | 'waiting'
  | 'connected'
  | 'transferring'
  | 'done'
  | 'error';

export type TransferMode = 'send' | 'receive';

const HIGH_WATER = 8 * 1024 * 1024; // pause sending above this bufferedAmount
const RECONNECT_MS = 1500;

export function useFileTransfer() {
  const signalRef = useRef<SignalClient | null>(null);
  const peerRef = useRef<PeerHandles | null>(null);
  const manualRef = useRef<ManualConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const modeRef = useRef<TransferMode>('send');
  const iceRef = useRef<RTCIceServer[] | undefined>(undefined);
  const recvRef = useRef<{ meta: TransferMeta | null; chunks: ArrayBuffer[]; received: number }>({
    meta: null,
    chunks: [],
    received: 0,
  });

  // Auto-mode reconnection bookkeeping.
  const reconnectRef = useRef<{ mode: TransferMode; roomId: string } | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef(false); // set once the room is full or on reset/unmount
  const connectedRef = useRef(false); // true once the P2P data channel is open
  const openSignalingRef = useRef<() => void>(() => {});

  const [status, setStatus] = useState<TransferStatus>('idle');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [incoming, setIncoming] = useState<{ name: string; size: number } | null>(null);
  const [receivedBlob, setReceivedBlob] = useState<Blob | null>(null);

  const clearReconnect = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const cleanup = useCallback(() => {
    clearReconnect();
    channelRef.current?.close();
    peerRef.current?.close();
    manualRef.current?.close();
    signalRef.current?.close();
    channelRef.current = null;
    peerRef.current = null;
    manualRef.current = null;
    signalRef.current = null;
    recvRef.current = { meta: null, chunks: [], received: 0 };
  }, []);

  const handleState = useCallback((state: RTCPeerConnectionState) => {
    if (state === 'connected') connectedRef.current = true;
    if (state === 'failed' || state === 'disconnected') {
      // A P2P drop after we were connected is terminal; before, let signaling retry.
      if (connectedRef.current) {
        setError('The peer-to-peer connection dropped.');
        setStatus('error');
      }
    }
  }, []);

  const handleRecv = useCallback((data: string | ArrayBuffer) => {
    const r = recvRef.current;
    if (typeof data === 'string') {
      const meta = decodeMeta(data);
      if (meta) {
        r.meta = meta;
        r.chunks = [];
        r.received = 0;
        setIncoming({ name: meta.name, size: meta.size });
        setStatus('transferring');
        setProgress(0);
      }
      return;
    }
    if (!r.meta) return;
    r.chunks.push(data);
    r.received += data.byteLength;
    setProgress(percent(r.received, r.meta.size));
    if (r.received >= r.meta.size) {
      setReceivedBlob(new Blob(r.chunks, { type: r.meta.mime || 'application/octet-stream' }));
      setStatus('done');
    }
  }, []);

  const wireChannel = useCallback((channel: RTCDataChannel) => {
    channel.binaryType = 'arraybuffer';
    channelRef.current = channel;
    if (modeRef.current === 'receive') {
      channel.onmessage = e => handleRecv(e.data as string | ArrayBuffer);
    }
    const markOpen = () => {
      connectedRef.current = true;
      clearReconnect();
      setStatus('connected');
    };
    channel.onopen = markOpen;
    channel.onclose = () => { /* transfer completion is driven by byte count */ };
    if (channel.readyState === 'open') markOpen();
  }, [handleRecv]);

  const setupPeer = useCallback((initiator: boolean) => {
    if (peerRef.current || !signalRef.current) return;
    const signal = signalRef.current;
    peerRef.current = createPeer({
      initiator,
      iceServers: iceRef.current,
      sendSignal: msg => signal.send(msg),
      onState: handleState,
      onChannel: wireChannel,
    });
  }, [wireChannel, handleState]);

  const scheduleReconnect = useCallback(() => {
    if (stoppedRef.current || connectedRef.current || !reconnectRef.current) return;
    clearReconnect();
    if (typeof document !== 'undefined' && document.hidden) return; // wait for foreground
    reconnectTimerRef.current = setTimeout(() => {
      if (stoppedRef.current || connectedRef.current) return;
      openSignalingRef.current();
    }, RECONNECT_MS);
  }, []);

  // (Re)open the signaling socket for the current auto-mode room.
  const openSignaling = useCallback(() => {
    const info = reconnectRef.current;
    if (!info || stoppedRef.current || connectedRef.current) return;
    // Close only the stale socket/peer; keep transfer state.
    peerRef.current?.close();
    peerRef.current = null;
    signalRef.current?.close();
    signalRef.current = null;

    signalRef.current = connectSignal(info.roomId, {
      onMessage: msg => {
        switch (msg.type) {
          case 'welcome':
            if (msg.role === 'guest') setupPeer(false);
            else setStatus('waiting');
            break;
          case 'peer-joined':
            setupPeer(true);
            break;
          case 'peer-left':
            // Only meaningful before the P2P channel is up; after, ignore.
            if (!connectedRef.current) { peerRef.current?.close(); peerRef.current = null; setStatus('waiting'); }
            break;
          case 'full':
            stoppedRef.current = true;
            setError('This transfer room is already full (two devices are connected).');
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

  const connect = useCallback((mode: TransferMode, roomId: string, iceServers?: RTCIceServer[]) => {
    cleanup();
    modeRef.current = mode;
    iceRef.current = iceServers;
    reconnectRef.current = { mode, roomId };
    stoppedRef.current = false;
    connectedRef.current = false;
    setError('');
    setProgress(0);
    setReceivedBlob(null);
    setIncoming(null);
    setStatus('connecting');
    openSignaling();
  }, [cleanup, openSignaling]);

  // Reconnect signaling as soon as the tab returns to the foreground (e.g. after
  // switching apps to share the link) — until the P2P channel is established.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && reconnectRef.current && !connectedRef.current && !stoppedRef.current) {
        scheduleReconnect();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [scheduleReconnect]);

  // --- Manual signaling (serverless copy-paste) ---
  const manualCreateOffer = useCallback(async (iceServers?: RTCIceServer[]): Promise<string> => {
    cleanup();
    stoppedRef.current = true; // no auto-reconnect in manual mode
    reconnectRef.current = null;
    connectedRef.current = false;
    modeRef.current = 'send';
    setError('');
    setProgress(0);
    setReceivedBlob(null);
    setIncoming(null);
    setStatus('connecting');
    const conn = createManualConnection({ initiator: true, iceServers, onState: handleState, onChannel: wireChannel });
    manualRef.current = conn;
    const code = await conn.createOfferCode();
    setStatus('waiting');
    return code;
  }, [cleanup, wireChannel, handleState]);

  const manualAcceptAnswer = useCallback(async (answerCode: string): Promise<void> => {
    await manualRef.current?.acceptAnswer(answerCode);
  }, []);

  const manualAcceptOffer = useCallback(async (offerCode: string, iceServers?: RTCIceServer[]): Promise<string> => {
    cleanup();
    stoppedRef.current = true;
    reconnectRef.current = null;
    connectedRef.current = false;
    modeRef.current = 'receive';
    setError('');
    setProgress(0);
    setReceivedBlob(null);
    setIncoming(null);
    setStatus('connecting');
    const conn = createManualConnection({ initiator: false, iceServers, onState: handleState, onChannel: wireChannel });
    manualRef.current = conn;
    const answer = await conn.acceptOfferReturnAnswer(offerCode);
    setStatus('waiting');
    return answer;
  }, [cleanup, wireChannel, handleState]);

  const sendFile = useCallback(async (file: File) => {
    const channel = channelRef.current;
    if (!channel || channel.readyState !== 'open') return;
    setStatus('transferring');
    setProgress(0);
    channel.bufferedAmountLowThreshold = 1024 * 1024;
    channel.send(encodeMeta({ name: file.name, size: file.size, mime: file.type || 'application/octet-stream' }));

    const total = chunkCount(file.size);
    for (let i = 0; i < total; i++) {
      const [start, end] = chunkRange(i, file.size);
      const buf = await file.slice(start, end).arrayBuffer();
      channel.send(buf);
      setProgress(percent(end, file.size));
      if (channel.bufferedAmount > HIGH_WATER) {
        await new Promise<void>(resolve => {
          const onLow = () => { channel.removeEventListener('bufferedamountlow', onLow); resolve(); };
          channel.addEventListener('bufferedamountlow', onLow);
        });
      }
    }
    setProgress(100);
    setStatus('done');
  }, []);

  const reset = useCallback(() => {
    stoppedRef.current = true;
    reconnectRef.current = null;
    connectedRef.current = false;
    cleanup();
    setStatus('idle');
    setError('');
    setProgress(0);
    setIncoming(null);
    setReceivedBlob(null);
  }, [cleanup]);

  useEffect(() => () => { stoppedRef.current = true; cleanup(); }, [cleanup]);

  return {
    status,
    error,
    progress,
    incoming,
    receivedBlob,
    connect,
    manualCreateOffer,
    manualAcceptAnswer,
    manualAcceptOffer,
    sendFile,
    reset,
    CHUNK_SIZE,
  };
}
