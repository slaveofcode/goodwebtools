/**
 * GoodWebTools edge Worker.
 *
 * Serves ML model files from an R2 bucket at /models/* (no 25 MB asset limit,
 * same-origin so the privacy promise holds), and delegates every other request
 * to the static Astro build via the ASSETS binding. Cloudflare only invokes
 * this Worker for requests that don't match a prebuilt static asset, so static
 * pages are still served directly.
 *
 * It also hosts a tiny WebRTC signaling rendezvous at /api/signal/<roomId> (a
 * Durable Object), used by the P2P tools to exchange the ~2KB SDP/ICE handshake.
 * Media and file bytes travel peer-to-peer and never reach this Worker.
 */
export { SignalRoom } from './signal-room.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/signal/')) {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426 });
      }
      const roomId = url.pathname.slice('/api/signal/'.length);
      if (!/^[a-z0-9]{6,32}$/.test(roomId)) {
        return new Response('Bad room id', { status: 400 });
      }
      return env.SIGNAL.getByName(roomId).fetch(request);
    }

    if (url.pathname.startsWith('/models/')) {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method not allowed', { status: 405 });
      }
      const key = decodeURIComponent(url.pathname.slice('/models/'.length));
      const object = await env.MODELS.get(key);
      if (!object || !object.body) return new Response('Model not found', { status: 404 });

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      // Models are immutable and versioned by filename — cache hard.
      headers.set('cache-control', 'public, max-age=31536000, immutable');
      return new Response(object.body, { headers });
    }

    return env.ASSETS.fetch(request);
  },
};
