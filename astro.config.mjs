import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import AstroPWA from '@vite-pwa/astro';

export default defineConfig({
  output: 'static',
  vite: {
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
      exclude: ['pdfjs-dist/build/pdf.worker.min.mjs', 'mupdf', 'libarchive.js', 'onnxruntime-web'],
    },
  },
  integrations: [
    react(),
    tailwind(),
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
