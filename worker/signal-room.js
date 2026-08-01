import { DurableObject } from 'cloudflare:workers';

/**
 * SignalRoom — a 2-peer WebRTC signaling rendezvous.
 *
 * It is a dumb relay: it forwards the small SDP/ICE handshake messages between the
 * (at most) two peers in a room. Media and file bytes never pass through here — they
 * travel peer-to-peer over WebRTC once the handshake completes.
 *
 * Uses the WebSocket Hibernation API so the object costs nothing while idle.
 */
export class SignalRoom extends DurableObject {
  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const existing = this.ctx.getWebSockets();
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Room is limited to two peers.
    if (existing.length >= 2) {
      this.ctx.acceptWebSocket(server);
      server.send(JSON.stringify({ type: 'full' }));
      server.close(4001, 'full');
      return new Response(null, { status: 101, webSocket: client });
    }

    const role = existing.length === 0 ? 'host' : 'guest';
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ role });
    server.send(JSON.stringify({ type: 'welcome', role }));

    // When the guest arrives, tell the host so it starts the WebRTC offer.
    if (role === 'guest') {
      for (const ws of existing) {
        try { ws.send(JSON.stringify({ type: 'peer-joined' })); } catch { /* ignore */ }
      }
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  /** Relay every message verbatim to the other peer(s). */
  async webSocketMessage(ws, message) {
    for (const conn of this.ctx.getWebSockets()) {
      if (conn === ws) continue;
      try { conn.send(message); } catch { /* ignore */ }
    }
  }

  async webSocketClose(ws, code, reason) {
    for (const conn of this.ctx.getWebSockets()) {
      if (conn === ws) continue;
      try { conn.send(JSON.stringify({ type: 'peer-left' })); } catch { /* ignore */ }
    }
    try { ws.close(code, reason); } catch { /* ignore */ }
  }
}
