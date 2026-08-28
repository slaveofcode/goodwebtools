import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import AstroPWA from '@vite-pwa/astro';
import sitemap from '@astrojs/sitemap';

// --- Deploy-context gating ---------------------------------------------------
// Production and staging share one Cloudflare Worker, so we can't tell them apart
// by build mode (both run `astro build`). Instead, use the branch that Cloudflare
// Workers Builds injects (WORKERS_CI_BRANCH) to decide: only the production branch
// (`main`) loads Google Analytics and is indexable; every other branch (develop /
// preview builds) runs analytics-free and emits robots `noindex`.
//
// Only applied on Workers Builds (WORKERS_CI=1) so local/manual builds keep their
// existing behavior. An explicitly-set PUBLIC_* env var always wins (overrides).
// The production Google Analytics ID is provided by the deploy environment
// (SITE_GA_ID build var), not hard-coded — so forks never report to the
// upstream Analytics property. Owner sets SITE_GA_ID on the production build.
const PROD_GA_ID = process.env.SITE_GA_ID || '';
if (process.env.WORKERS_CI === '1') {
  const isProductionBranch = (process.env.WORKERS_CI_BRANCH || '') === 'main';
  if (process.env.PUBLIC_GA_ID === undefined) {
    process.env.PUBLIC_GA_ID = isProductionBranch ? PROD_GA_ID : '';
  }
  // Indexing is OPT-OUT, not auto-gated by branch: the WORKERS_CI_BRANCH check
  // proved unreliable in the production build (it silently noindex'd the whole
  // live site — the same failure that once blanked Google Analytics, which we
  // fixed by not trusting the branch env). So pages are index,follow by default
  // and only noindex when PUBLIC_NOINDEX is explicitly set to "1"/"true".
  // Non-production Workers (e.g. goodwebtools-staging) set PUBLIC_NOINDEX=1 as a
  // build var so preview deploys stay out of the index.
}

export default defineConfig({
  output: 'static',
  // Canonical origin — powers <link rel="canonical">, OG URLs, and the sitemap.
  site: 'https://goodwebtools.com',
  trailingSlash: 'ignore',
  vite: {
    plugins: [
      // Dev-only shim for the worker's /api/llm-proxy route (see worker/index.js).
      // Astro dev serves via Vite, not the Cloudflare Worker, so the CORS-blocked
      // cloud LLM providers (OpenCode Go/Zen) would 404 in `npm run dev` without
      // this. Mirrors the worker's host-allowlist + header-forward behavior.
      {
        name: 'gwt-llm-proxy-dev',
        configureServer(server) {
          const ALLOWED = new Set([
            'api.openai.com', 'api.deepseek.com', 'openrouter.ai', 'opencode.ai',
            'generativelanguage.googleapis.com', 'api.groq.com', 'api.anthropic.com',
          ]);
          server.middlewares.use('/api/llm-proxy', async (req, res) => {
            const sendJson = (status, obj) => {
              res.statusCode = status;
              res.setHeader('content-type', 'application/json');
              res.end(JSON.stringify(obj));
            };
            if (req.method !== 'POST') return sendJson(405, { error: { message: 'Method not allowed' } });
            const target = req.headers['x-llm-target'];
            let host;
            try {
              const u = new URL(target);
              if (u.protocol !== 'https:') return sendJson(400, { error: { message: 'Target must be https' } });
              host = u.hostname;
            } catch {
              return sendJson(400, { error: { message: 'Bad x-llm-target URL' } });
            }
            if (!ALLOWED.has(host)) return sendJson(403, { error: { message: 'Provider host not allowed: ' + host } });
            const chunks = [];
            for await (const c of req) chunks.push(c);
            const fwd = {};
            for (const h of ['content-type', 'authorization', 'x-api-key', 'anthropic-version', 'anthropic-dangerous-direct-browser-access']) {
              if (req.headers[h]) fwd[h] = req.headers[h];
            }
            try {
              const upstream = await fetch(target, { method: 'POST', headers: fwd, body: Buffer.concat(chunks) });
              const text = await upstream.text();
              res.statusCode = upstream.status;
              res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json');
              res.end(text);
            } catch (e) {
              sendJson(502, { error: { message: 'Proxy fetch failed: ' + ((e && e.message) || e) } });
            }
          });
        },
      },
    ],
    resolve: {
      alias: {
        // @tensorflow/tfjs-core pulls in node-fetch (+ its CJS whatwg-url) for its
        // Node platform; the browser build never uses it, but Vite still resolves
        // the import and fails ESM interop. Map it to a browser-fetch stub.
        'node-fetch': new URL('./src/stubs/node-fetch.js', import.meta.url).pathname,
      },
    },
    build: {
      rollupOptions: {
        // Tauri API imports are only available in Tauri context, externalize for web build
        external: [/^@tauri-apps\//],
        output: {
          // epub.js bundles from source (its `module` field is src/index.js) into a
          // ~2 MB chunk that Rollup would otherwise name `index.*` — undetectable by
          // the workbox globIgnore. Force stable names so the EPUB reader's heavy,
          // lazily-imported deps stay out of the PWA precache (see globIgnores below).
          // jszip is shared with docx-preview, so it gets its own chunk rather than
          // being merged into epubjs.
          manualChunks(id) {
            if (id.includes('node_modules/epubjs')) return 'epubjs';
            if (id.includes('node_modules/jszip')) return 'jszip';
            // Prettier (Code Beautifier) is large and lazily-imported per language.
            // Give every prettier chunk a stable `prettier-` prefix so it can be
            // kept out of the PWA precache via globIgnores while still code-split
            // per language plugin (loaded on demand, not in the island chunk).
            if (id.includes('node_modules/prettier/plugins/')) {
              const m = id.match(/plugins\/([a-z0-9]+)/i);
              return m ? `prettier-${m[1]}` : 'prettier-plugin';
            }
            if (id.includes('node_modules/prettier/')) return 'prettier-standalone';
            // WebLLM (on-device model runtime, Sub-project B) is ~6 MB and only
            // loaded on demand in the agent chat — keep it in a stable-named
            // chunk so it stays out of the PWA precache via globIgnores.
            if (id.includes('node_modules/@mlc-ai/web-llm')) return 'web-llm';
          },
        },
      },
    },
    // mupdf/pdf.js workers use dynamic import() (code-splitting), which requires
    // ES-module workers rather than Vite's default IIFE format.
    worker: {
      format: 'es',
    },
    optimizeDeps: {
      // Pre-bundle heavy deps used only by lazily-imported tool islands, so
      // Vite doesn't discover them mid-request and force a reload that makes
      // in-flight dynamic imports fail ("Failed to fetch dynamically imported
      // module"). pdfjs worker is excluded — it's loaded via ?url.
      include: ['pdf-lib', 'pdfjs-dist', 'marked', 'dompurify', 'qrcode', 'jsqr', 'comlink', 'fflate', 'gifenc', 'yaml', 'fast-xml-parser', 'smol-toml', 'hash-wasm', 'highlight.js/lib/core', 'highlight.js/lib/languages/json', 'highlight.js/lib/languages/yaml', 'highlight.js/lib/languages/xml', 'highlight.js/lib/languages/ini', '@imgly/background-removal', '@mediapipe/tasks-vision', 'upscaler', '@tensorflow/tfjs'],
      // mupdf is a large wasm module used only inside a worker — don't pre-bundle it.
      // @tauri-apps/api must be excluded - it's only available in Tauri runtime
      exclude: ['pdfjs-dist/build/pdf.worker.min.mjs', 'mupdf', 'libarchive.js', 'onnxruntime-web', '@ffmpeg/ffmpeg', '@ffmpeg/util', '@sqlite.org/sqlite-wasm', '@tauri-apps/api'],
    },
  },
  integrations: [
    react(),
    tailwind(),
    sitemap({
      // Emit hreflang alternates linking each page to its /id/ counterpart.
      i18n: { defaultLocale: 'en', locales: { en: 'en', id: 'id' } },
    }),
    AstroPWA({
      mode: 'production',
      base: '/',
      scope: '/',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      registerType: 'autoUpdate',
      manifest: {
        name: 'GoodWebTools',
        short_name: 'GWT',
        description: 'Privacy-first client-side utilities',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        navigateFallback: '/404',
        globPatterns: ['**/*.{css,js,html,svg,png,ico,txt,woff2}'],
        // Monaco's language workers (ts.worker is ~12 MB) and its main chunk are
        // route-level and far exceed the precache size limit — load them on demand
        // instead of precaching them into the service worker. The DB Diagram tool's
        // chunk (~16 MB, bundles @dbml/core + react-flow) is the same case.
        globIgnores: [
          '**/ts.worker-*.js',
          '**/editor.worker-*.js',
          '**/json.worker-*.js',
          '**/css.worker-*.js',
          '**/html.worker-*.js',
          '**/monaco-setup*.js',
          '**/DbDiagram*.js',
          '**/ppu-paddle-ocr*.js',
          '**/ort-*.wasm',
          '**/transformers*.js',
          '**/*huggingface*.js',
          '**/maplibre-gl*.js',
          '**/xlsx*.js',
          '**/epubjs*.js',
          '**/jszip*.js',
          '**/html2canvas*.js',
          '**/heic-to*.js',
          '**/libheif*.js',
          '**/terser*.js',
          '**/csso*.js',
          '**/zxing*.js',
          '**/prettier-*.js',
          '**/web-llm*.js',
          '**/webllm*.js',
          'og/*.png',
        ],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // On-device ML model weights + runtime (Whisper from Hugging Face, ORT
            // wasm from jsDelivr, PaddleOCR models from GitHub raw/LFS). CacheFirst so
            // they load from our cache on refresh instead of re-downloading. Immutable,
            // versioned by URL.
            urlPattern: /^https:\/\/([^/]*\.)?(huggingface\.co|hf\.co)\/.*|^https:\/\/cdn\.jsdelivr\.net\/.*|^https:\/\/(raw|media)\.githubusercontent\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ml-models-cache',
              expiration: {
                maxEntries: 120,
                maxAgeSeconds: 60 * 60 * 24 * 90 // 90 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: false,
        navigateFallbackAllowlist: [/^\//]
      },
      experimental: {
        directoryAndTrailingSlashHandler: true
      }
    })
  ]
});
