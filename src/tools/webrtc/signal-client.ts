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

/** Open a WebSocket to the signaling room and relay parsed messages. */
export function connectSignal(roomId: string, handlers: SignalHandlers): SignalClient {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}/api/signal/${roomId}`);

  ws.onopen = () => handlers.onOpen?.();
  ws.onmessage = e => {
    if (typeof e.data !== 'string') return;
    const msg = parseSignal(e.data);
    if (msg) handlers.onMessage(msg);
  };
  ws.onclose = () => handlers.onClose?.();
  ws.onerror = () => handlers.onError?.();

  return {
    send(msg: SignalMessage) {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    },
    close() {
      try { ws.close(); } catch { /* ignore */ }
    },
  };
}
