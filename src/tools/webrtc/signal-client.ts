import { parseSignal, type SignalMessage } from './signal.lib';

export interface SignalClient {
  send(msg: SignalMessage): void;
  close(): void;
}

export interface SignalHandlers {
  onMessage: (msg: SignalMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: () => void;
}

const KEEPALIVE_MS = 25000;

/** Open a WebSocket to the signaling room and relay parsed messages. */
export function connectSignal(roomId: string, handlers: SignalHandlers): SignalClient {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}/api/signal/${roomId}`);

  // Keepalive: the Durable Object auto-responds 'pong' (not relayed to the peer),
  // keeping the connection alive through idle-timeout proxies.
  let keepalive: ReturnType<typeof setInterval> | null = null;
  const stopKeepalive = () => { if (keepalive) { clearInterval(keepalive); keepalive = null; } };

  ws.onopen = () => {
    keepalive = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send('ping');
    }, KEEPALIVE_MS);
    handlers.onOpen?.();
  };
  ws.onmessage = e => {
    if (typeof e.data !== 'string' || e.data === 'pong') return;
    const msg = parseSignal(e.data);
    if (msg) handlers.onMessage(msg);
  };
  ws.onclose = () => { stopKeepalive(); handlers.onClose?.(); };
  ws.onerror = () => handlers.onError?.();

  return {
    send(msg: SignalMessage) {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    },
    close() {
      stopKeepalive();
      try { ws.close(); } catch { /* ignore */ }
    },
  };
}
