/**
 * Favicon generator — turn one image into a full favicon set (ICO + PNGs +
 * web manifest + HTML snippet). Browser-only encode; the manifest/snippet
 * builders are pure.
 */
import { processImage } from './canvas.lib';
import { imageToIco } from './encode.lib';

export const FAVICON_SIZES: { name: string; size: number }[] = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'favicon-48x48.png', size: 48 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'android-chrome-192x192.png', size: 192 },
  { name: 'android-chrome-512x512.png', size: 512 },
];

/** Build a site.webmanifest referencing the generated PNGs. */
export function buildManifest(appName: string): string {
  return JSON.stringify(
    {
      name: appName,
      short_name: appName,
      icons: [
        { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
      ],
      theme_color: '#ffffff',
      background_color: '#ffffff',
      display: 'standalone',
    },
    null,
    2,
  );
}

/** The <link> tags to paste into a site's <head>. */
export function htmlSnippet(): string {
  return [
    '<link rel="icon" type="image/x-icon" href="/favicon.ico">',
    '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">',
    '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
    '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">',
    '<link rel="manifest" href="/site.webmanifest">',
  ].join('\n');
}

export interface FaviconFile {
  name: string;
  blob: Blob;
  /** Pixel size for the PNG previews (absent for ico/manifest/snippet). */
  size?: number;
}

/** Generate the full favicon set from a source image. */
export async function generateFavicons(file: File, appName: string): Promise<FaviconFile[]> {
  const files: FaviconFile[] = [];
  files.push({ name: 'favicon.ico', blob: await imageToIco(file, [16, 32, 48]) });
  for (const { name, size } of FAVICON_SIZES) {
    const { blob } = await processImage(file, { mimeType: 'image/png', width: size, height: size });
    files.push({ name, blob, size });
  }
  files.push({
    name: 'site.webmanifest',
    blob: new Blob([buildManifest(appName)], { type: 'application/manifest+json' }),
  });
  files.push({
    name: 'favicon-html-snippet.txt',
    blob: new Blob([htmlSnippet()], { type: 'text/plain' }),
  });
  return files;
}
