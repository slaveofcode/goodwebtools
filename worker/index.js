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

    // Same-origin proxy for Hugging Face model files. transformers.js fetches
    // Whisper weights from huggingface.co, which 302-redirects large files to a
    // CDN — the browser/Workbox can't reliably cache those redirected responses,
    // so the model re-downloaded on every refresh. Proxying resolves the redirect
    // server-side and returns the bytes same-origin with an immutable cache header,
    // so the browser HTTP-caches them and they survive refreshes.
    if (url.pathname.startsWith('/hf/')) {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method not allowed', { status: 405 });
      }
      const upstream = 'https://huggingface.co/' + url.pathname.slice('/hf/'.length) + url.search;
      const res = await fetch(upstream, {
        headers: { 'user-agent': 'goodwebtools-proxy' },
        cf: { cacheEverything: true, cacheTtl: 31536000 },
      });
      if (!res.ok && res.status !== 206) {
        return new Response('Upstream model fetch failed', { status: res.status || 502 });
      }
      const headers = new Headers(res.headers);
      headers.set('cache-control', 'public, max-age=31536000, immutable');
      headers.set('access-control-allow-origin', '*');
      headers.delete('set-cookie');
      return new Response(res.body, { status: res.status, headers });
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

    // Geo language hint: send first-time Indonesian visitors to the Bahasa (/id/)
    // version of localized public pages. Humans only — crawlers must see both trees,
    // and a manual choice (gwt.lang cookie, set by the header switcher) always wins.
    if (request.method === 'GET') {
      const accept = request.headers.get('accept') || '';
      const p = url.pathname;
      const isLocalized = p === '/' || p.startsWith('/tools/') || p.startsWith('/category/');
      const alreadyId = p === '/id' || p.startsWith('/id/');
      const cookie = request.headers.get('cookie') || '';
      const hasChoice = /(?:^|;\s*)gwt\.lang=/.test(cookie);
      const ua = request.headers.get('user-agent') || '';
      const isBot = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|preview|whatsapp|telegram|discord/i.test(ua);
      const country = request.cf && request.cf.country;
      if (accept.includes('text/html') && isLocalized && !alreadyId && !hasChoice && !isBot && country === 'ID') {
        const to = '/id' + (p === '/' ? '' : p);
        return Response.redirect(url.origin + to + url.search, 302);
      }
    }

    return env.ASSETS.fetch(request);
  },
};
