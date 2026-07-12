/**
 * GoodWebTools edge Worker.
 *
 * Serves ML model files from an R2 bucket at /models/* (no 25 MB asset limit,
 * same-origin so the privacy promise holds), and delegates every other request
 * to the static Astro build via the ASSETS binding. Cloudflare only invokes
 * this Worker for requests that don't match a prebuilt static asset, so static
 * pages are still served directly.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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
