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
  if (process.env.PUBLIC_NOINDEX === undefined) {
    process.env.PUBLIC_NOINDEX = isProductionBranch ? '' : '1';
  }
}

export default defineConfig({
  output: 'static',
  // Canonical origin — powers <link rel="canonical">, OG URLs, and the sitemap.
  site: 'https://goodwebtools.com',
  trailingSlash: 'ignore',
  vite: {
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
