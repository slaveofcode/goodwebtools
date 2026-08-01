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
const RECONNECT_MS = 1200;
const DISCONNECT_GRACE_MS = 5000; // let a transient ICE 'disconnected' self-heal first

export function useFileTransfer() {
  const signalRef = useRef<SignalClient | null>(null);
  const peerRef = useRef<PeerHandles | null>(null);
  const manualRef = useRef<ManualConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const modeRef = useRef<TransferMode>('send');
  const iceRef = useRef<RTCIceServer[] | undefined>(undefined);
  const pendingFileRef = useRef<File | null>(null); // selected before the channel is open
  const recvRef = useRef<{ meta: TransferMeta | null; chunks: ArrayBuffer[]; received: number }>({
    meta: null,
    chunks: [],
    received: 0,
  });

  // Auto-mode reconnection bookkeeping.
  const reconnectRef = useRef<{ mode: TransferMode; roomId: string } | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef(false); // set once the room is full or on reset/unmount
  const connectedRef = useRef(false); // true once the P2P data channel is open
  const failuresRef = useRef(0); // consecutive re-establish attempts (capped)
  const openSignalingRef = useRef<() => void>(() => {});
  const handleFailureRef = useRef<() => void>(() => {});

  const [status, setStatus] = useState<TransferStatus>('idle');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [incoming, setIncoming] = useState<{ name: string; size: number } | null>(null);
  const [receivedBlob, setReceivedBlob] = useState<Blob | null>(null);

  const clearReconnect = () => {
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
  };
  const clearDisconnect = () => {
    if (disconnectTimerRef.current) { clearTimeout(disconnectTimerRef.current); disconnectTimerRef.current = null; }
  };

  const cleanup = useCallback(() => {
    clearReconnect();
    clearDisconnect();
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

  // Send a file the moment the channel is open (queued if picked earlier).
  // pendingFileRef is cleared on send, so this can't double-send.
  const flushPending = useCallback(() => {
    const ch = channelRef.current;
    if (modeRef.current === 'send' && pendingFileRef.current && ch && ch.readyState === 'open') {
      const f = pendingFileRef.current;
      pendingFileRef.current = null;
      void sendFile(f);
    }
  }, [sendFile]);

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
      failuresRef.current = 0;
      clearReconnect();
      clearDisconnect();
      // Once P2P is up, signaling is no longer needed — close it to avoid churn.
      signalRef.current?.close();
      signalRef.current = null;
      setStatus(s => (s === 'transferring' || s === 'done' ? s : 'connected'));
      flushPending();
    };
    channel.onopen = markOpen;
    if (channel.readyState === 'open') markOpen();
  }, [handleRecv, flushPending]);

  const setupPeer = useCallback((initiator: boolean) => {
    // Replace any stale peer (e.g. re-negotiating after a drop).
    peerRef.current?.close();
    peerRef.current = null;
    const signal = signalRef.current;
    if (!signal) return;
    peerRef.current = createPeer({
      initiator,
      iceServers: iceRef.current,
      sendSignal: msg => signal.send(msg),
      onState: state => {
        if (state === 'connected') {
          connectedRef.current = true;
          clearDisconnect();
        } else if (state === 'disconnected') {
          // Transient (e.g. sender backgrounded to pick a file). Let it self-heal,
          // then re-establish if it doesn't.
          clearDisconnect();
          disconnectTimerRef.current = setTimeout(() => handleFailureRef.current(), DISCONNECT_GRACE_MS);
        } else if (state === 'failed') {
          handleFailureRef.current();
        }
      },
      onChannel: wireChannel,
    });
  }, [wireChannel]);

  const scheduleReconnect = useCallback(() => {
    if (stoppedRef.current || connectedRef.current || !reconnectRef.current) return;
    clearReconnect();
    if (typeof document !== 'undefined' && document.hidden) return; // wait for foreground
    reconnectTimerRef.current = setTimeout(() => {
      if (stoppedRef.current || connectedRef.current) return;
      openSignalingRef.current();
    }, RECONNECT_MS);
  }, []);

  // A hard drop: tear the peer down and re-establish through signaling (auto mode)
  // or surface an error (manual mode has no server to renegotiate through).
  const MAX_FAILURES = 4;
  const handleFailure = useCallback(() => {
    if (stoppedRef.current) return;
    clearDisconnect();
    connectedRef.current = false;
    peerRef.current?.close();
    peerRef.current = null;
    failuresRef.current += 1;
    if (!reconnectRef.current) {
      // Manual mode: no server to renegotiate through.
      setError('The connection was lost. Please start over.');
      setStatus('error');
    } else if (failuresRef.current > MAX_FAILURES) {
      setError('Couldn’t keep a stable connection on this network. Try again, or add your own TURN server in Advanced settings.');
      setStatus('error');
    } else {
      setStatus(s => (s === 'done' ? s : 'connecting'));
      scheduleReconnect();
    }
  }, [scheduleReconnect]);
  useEffect(() => { handleFailureRef.current = handleFailure; }, [handleFailure]);

  // (Re)open the signaling socket for the current auto-mode room.
  const openSignaling = useCallback(() => {
    const info = reconnectRef.current;
    if (!info || stoppedRef.current || connectedRef.current) return;
    signalRef.current?.close();
    signalRef.current = null;

    signalRef.current = connectSignal(info.roomId, {
      onMessage: msg => {
        if (connectedRef.current) {
          // Already connected over P2P — ignore signaling churn except a hard failure path.
          if (msg.type === 'offer' || msg.type === 'answer' || msg.type === 'ice') peerRef.current?.applySignal(msg);
          return;
        }
        switch (msg.type) {
          case 'welcome':
            if (msg.role === 'guest') setupPeer(false); // will answer the host's offer
            else setStatus('waiting'); // host waits for the guest to (re)join
            break;
          case 'peer-joined':
            setupPeer(true); // (re)start the offer for the peer that just joined
            break;
          case 'peer-left':
            peerRef.current?.close();
            peerRef.current = null;
            setStatus('waiting');
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
    failuresRef.current = 0;
    setError('');
    setProgress(0);
    setReceivedBlob(null);
    setIncoming(null);
    setStatus('connecting');
    openSignaling();
  }, [cleanup, openSignaling]);

  // Reconnect signaling as soon as the tab returns to the foreground (e.g. after
  // switching apps to share the link, or opening the file picker).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && reconnectRef.current && !connectedRef.current && !stoppedRef.current) {
        scheduleReconnect();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [scheduleReconnect]);

  // Queue a file to send; sends immediately if already connected, else on connect.
  const queueFile = useCallback((file: File) => {
    pendingFileRef.current = file;
    const ch = channelRef.current;
    if (ch && ch.readyState === 'open') flushPending();
  }, [flushPending]);

  // --- Manual signaling (serverless copy-paste) ---
  const manualCreateOffer = useCallback(async (iceServers?: RTCIceServer[]): Promise<string> => {
    cleanup();
    stoppedRef.current = false;
    reconnectRef.current = null; // no auto-reconnect in manual mode
    connectedRef.current = false;
    modeRef.current = 'send';
    setError('');
    setProgress(0);
    setReceivedBlob(null);
    setIncoming(null);
    setStatus('connecting');
    const conn = createManualConnection({
      initiator: true,
      iceServers,
      onState: s => { if (s === 'connected') connectedRef.current = true; else if (s === 'failed') handleFailureRef.current(); },
      onChannel: wireChannel,
    });
    manualRef.current = conn;
    const code = await conn.createOfferCode();
    setStatus('waiting');
    return code;
  }, [cleanup, wireChannel]);

  const manualAcceptAnswer = useCallback(async (answerCode: string): Promise<void> => {
    await manualRef.current?.acceptAnswer(answerCode);
  }, []);

  const manualAcceptOffer = useCallback(async (offerCode: string, iceServers?: RTCIceServer[]): Promise<string> => {
    cleanup();
    stoppedRef.current = false;
    reconnectRef.current = null;
    connectedRef.current = false;
    modeRef.current = 'receive';
    setError('');
    setProgress(0);
    setReceivedBlob(null);
    setIncoming(null);
    setStatus('connecting');
    const conn = createManualConnection({
      initiator: false,
      iceServers,
      onState: s => { if (s === 'connected') connectedRef.current = true; else if (s === 'failed') handleFailureRef.current(); },
      onChannel: wireChannel,
    });
    manualRef.current = conn;
    const answer = await conn.acceptOfferReturnAnswer(offerCode);
    setStatus('waiting');
    return answer;
  }, [cleanup, wireChannel]);

  const reset = useCallback(() => {
    stoppedRef.current = true;
    reconnectRef.current = null;
    connectedRef.current = false;
    pendingFileRef.current = null;
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
    queueFile,
    sendFile,
    reset,
    CHUNK_SIZE,
  };
}
