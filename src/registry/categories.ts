import type { Category } from '@/types/tool';

export const categories: Category[] = [
  'Dev',
  'PDF',
  'Image',
  'Files',
  'Draw',
  'Media',
  'Network',
  'Playground'
];

export const categoryColors: Record<Category, string> = {
  Dev: 'bg-blue-500',
  PDF: 'bg-red-500',
  Image: 'bg-green-500',
  Files: 'bg-yellow-500',
  Draw: 'bg-purple-500',
  Media: 'bg-pink-500',
  Network: 'bg-cyan-500',
  Playground: 'bg-orange-500'
};

/**
 * Categories whose tools use a limited server-side component. Everything else on
 * GoodWebTools runs fully client-side; Network tools additionally use a minimal
 * signaling server to introduce two devices (only the ~2KB WebRTC handshake — no
 * media or file bytes pass through it), and this can be disabled entirely with the
 * manual (serverless) connection mode.
 */
export const categoryNotes: Partial<Record<Category, string>> = {
  Network: 'These tools connect two devices directly (peer-to-peer). By default a minimal signaling server only introduces the devices — your media and files never pass through it — and you can switch to a fully serverless manual mode or bring your own STUN/TURN servers.',
};
