import { Hash, Braces, Binary, Link, KeyRound, Fingerprint, KeySquare, FileDiff, Table, FileText, QrCode, ScanLine, Clock, Calculator, Palette, FilePlus2, Scissors, RotateCw, FileImage, FileX, Stamp, Image, Replace, Minimize2, Maximize2, Eraser, Archive, Lock, Unlock, Crop, Droplet, PenTool, Combine, ShieldCheck, FileCode, FileCode2, FileCog, FileArchive, FolderArchive, Sparkles, ScanFace, Scaling, Aperture, Wand2, PenLine, Shapes, Film, FileVideo, Music, AudioLines, MonitorPlay, Camera } from 'lucide-react';
import type { ToolDef } from '@/types/tool';

export const tools: ToolDef[] = [
  {
    id: 'json-format',
    name: 'JSON Formatter',
    category: 'Dev',
    route: '/tools/json-format',
    keywords: ['json', 'format', 'beautify', 'prettify', 'minify', 'validate', 'lint'],
    icon: Braces,
    summary: 'Format, minify, and validate JSON',
    load: () => import('@/islands/dev/JsonFormat'),
    status: 'stable'
  },
  {
    id: 'base64',
    name: 'Base64 Encode / Decode',
    category: 'Dev',
    route: '/tools/base64',
    keywords: ['base64', 'encode', 'encoder', 'decode', 'decoder', 'btoa', 'atob', 'binary'],
    icon: Binary,
    summary: 'Encode and decode Base64 text',
    load: () => import('@/islands/dev/Base64'),
    status: 'stable'
  },
  {
    id: 'url-encode',
    name: 'URL Encode / Decode',
    category: 'Dev',
    route: '/tools/url-encode',
    keywords: ['url', 'uri', 'encode', 'decode', 'percent', 'escape', 'querystring'],
    icon: Link,
    summary: 'Encode and decode URL components',
    load: () => import('@/islands/dev/UrlEncode'),
    status: 'stable'
  },
  {
    id: 'jwt-decode',
    name: 'JWT Decoder',
    category: 'Dev',
    route: '/tools/jwt-decode',
    keywords: ['jwt', 'json web token', 'decode', 'header', 'payload', 'claims', 'auth'],
    icon: KeyRound,
    summary: 'Decode JWT header and payload (no verification)',
    load: () => import('@/islands/dev/JwtDecode'),
    status: 'stable'
  },
  {
    id: 'uuid-gen',
    name: 'UUID Generator',
    category: 'Dev',
    route: '/tools/uuid-gen',
    keywords: ['uuid', 'guid', 'v4', 'generate', 'random', 'id', 'identifier'],
    icon: Fingerprint,
    summary: 'Generate random UUID v4 identifiers',
    load: () => import('@/islands/dev/UuidGen'),
    status: 'stable'
  },
  {
    id: 'password-gen',
    name: 'Password Generator',
    category: 'Dev',
    route: '/tools/password-gen',
    keywords: ['password', 'passphrase', 'generate', 'random', 'secure', 'strong', 'secret'],
    icon: KeySquare,
    summary: 'Generate strong random passwords',
    load: () => import('@/islands/dev/PasswordGen'),
    status: 'stable'
  },
  {
    id: 'text-diff',
    name: 'Text Diff',
    category: 'Dev',
    route: '/tools/text-diff',
    keywords: ['diff', 'compare', 'text', 'difference', 'changes', 'merge'],
    icon: FileDiff,
    summary: 'Compare two texts line by line',
    load: () => import('@/islands/dev/TextDiff'),
    status: 'stable'
  },
  {
    id: 'csv-json',
    name: 'CSV ↔ JSON',
    category: 'Dev',
    route: '/tools/csv-json',
    keywords: ['csv', 'json', 'convert', 'spreadsheet', 'table', 'transform', 'delimiter', 'semicolon', 'pipe', 'tab'],
    icon: Table,
    summary: 'Convert between CSV and JSON (comma, semicolon, tab, pipe)',
    load: () => import('@/islands/dev/CsvJson'),
    status: 'stable'
  },
  {
    id: 'json-yaml',
    name: 'JSON ↔ YAML',
    category: 'Dev',
    route: '/tools/json-yaml',
    keywords: ['json', 'yaml', 'yml', 'convert', 'transform', 'config'],
    icon: FileCode2,
    summary: 'Convert between JSON and YAML',
    load: () => import('@/islands/dev/JsonYaml'),
    status: 'stable'
  },
  {
    id: 'json-xml',
    name: 'JSON ↔ XML',
    category: 'Dev',
    route: '/tools/json-xml',
    keywords: ['json', 'xml', 'convert', 'transform', 'markup'],
    icon: FileCode,
    summary: 'Convert between JSON and XML',
    load: () => import('@/islands/dev/JsonXml'),
    status: 'stable'
  },
  {
    id: 'json-toml',
    name: 'JSON ↔ TOML',
    category: 'Dev',
    route: '/tools/json-toml',
    keywords: ['json', 'toml', 'convert', 'transform', 'config'],
    icon: FileCog,
    summary: 'Convert between JSON and TOML',
    load: () => import('@/islands/dev/JsonToml'),
    status: 'stable'
  },
  {
    id: 'markdown',
    name: 'Markdown Preview',
    category: 'Dev',
    route: '/tools/markdown',
    keywords: ['markdown', 'md', 'preview', 'render', 'html', 'readme'],
    icon: FileText,
    summary: 'Live Markdown editor and preview',
    load: () => import('@/islands/dev/Markdown'),
    status: 'stable'
  },
  {
    id: 'qr-gen',
    name: 'QR Code Generator',
    category: 'Dev',
    route: '/tools/qr-gen',
    keywords: ['qr', 'qrcode', 'qr code', 'generate', 'barcode', 'url'],
    icon: QrCode,
    summary: 'Generate a QR code from text or a URL',
    load: () => import('@/islands/dev/QrGen'),
    status: 'stable'
  },
  {
    id: 'qr-read',
    name: 'QR Code Reader',
    category: 'Dev',
    route: '/tools/qr-read',
    keywords: ['qr', 'qrcode', 'read', 'scan', 'decode', 'reader'],
    icon: ScanLine,
    summary: 'Decode a QR code from an image',
    load: () => import('@/islands/dev/QrRead'),
    status: 'stable'
  },
  {
    id: 'timestamp',
    name: 'Timestamp Converter',
    category: 'Dev',
    route: '/tools/timestamp',
    keywords: ['timestamp', 'unix', 'epoch', 'date', 'time', 'iso', 'convert'],
    icon: Clock,
    summary: 'Convert between Unix time and dates',
    load: () => import('@/islands/dev/Timestamp'),
    status: 'stable'
  },
  {
    id: 'base-convert',
    name: 'Number Base Converter',
    category: 'Dev',
    route: '/tools/base-convert',
    keywords: ['base', 'binary', 'octal', 'decimal', 'hex', 'hexadecimal', 'radix', 'convert', 'number'],
    icon: Calculator,
    summary: 'Convert numbers between binary, octal, decimal, and hex',
    load: () => import('@/islands/dev/BaseConvert'),
    status: 'stable'
  },
  {
    id: 'color-convert',
    name: 'Color Converter / Picker',
    category: 'Dev',
    route: '/tools/color-convert',
    keywords: ['color', 'colour', 'hex', 'rgb', 'hsl', 'convert', 'picker', 'palette'],
    icon: Palette,
    summary: 'Pick or Convert colors between HEX, RGB, and HSL',
    load: () => import('@/islands/dev/ColorConvert'),
    status: 'stable'
  },
  {
    id: 'pdf-merge',
    name: 'Merge PDFs',
    category: 'PDF',
    route: '/tools/pdf-merge',
    keywords: ['pdf', 'merge', 'combine', 'join', 'concatenate', 'append'],
    icon: FilePlus2,
    summary: 'Combine multiple PDFs into one',
    load: () => import('@/islands/pdf/PdfMerge'),
    status: 'stable'
  },
  {
    id: 'pdf-split',
    name: 'Split PDF',
    category: 'PDF',
    route: '/tools/pdf-split',
    keywords: ['pdf', 'split', 'extract', 'pages', 'range', 'separate'],
    icon: Scissors,
    summary: 'Extract a range of pages into a new PDF',
    load: () => import('@/islands/pdf/PdfSplit'),
    status: 'stable'
  },
  {
    id: 'pdf-rotate',
    name: 'Rotate PDF',
    category: 'PDF',
    route: '/tools/pdf-rotate',
    keywords: ['pdf', 'rotate', 'turn', 'orientation', 'landscape', 'portrait'],
    icon: RotateCw,
    summary: 'Rotate every page of a PDF',
    load: () => import('@/islands/pdf/PdfRotate'),
    status: 'stable'
  },
  {
    id: 'pdf-to-image',
    name: 'PDF to Images',
    category: 'PDF',
    route: '/tools/pdf-to-image',
    keywords: ['pdf', 'image', 'png', 'render', 'convert', 'export', 'page'],
    icon: Image,
    summary: 'Render each PDF page to a PNG image',
    load: () => import('@/islands/pdf/PdfToImage'),
    status: 'stable'
  },
  {
    id: 'images-to-pdf',
    name: 'Images to PDF',
    category: 'PDF',
    route: '/tools/images-to-pdf',
    keywords: ['image', 'images', 'jpg', 'jpeg', 'png', 'pdf', 'convert', 'combine'],
    icon: FileImage,
    summary: 'Combine PNG/JPG images into a PDF',
    load: () => import('@/islands/pdf/ImagesToPdf'),
    status: 'stable'
  },
  {
    id: 'pdf-delete',
    name: 'Delete PDF Pages',
    category: 'PDF',
    route: '/tools/pdf-delete',
    keywords: ['pdf', 'delete', 'remove', 'pages', 'drop', 'trim'],
    icon: FileX,
    summary: 'Remove pages from a PDF',
    load: () => import('@/islands/pdf/PdfDelete'),
    status: 'stable'
  },
  {
    id: 'pdf-watermark',
    name: 'Watermark PDF',
    category: 'PDF',
    route: '/tools/pdf-watermark',
    keywords: ['pdf', 'watermark', 'stamp', 'confidential', 'draft', 'text'],
    icon: Stamp,
    summary: 'Add a diagonal text watermark to a PDF',
    load: () => import('@/islands/pdf/PdfWatermark'),
    status: 'stable'
  },
  {
    id: 'pdf-compress',
    name: 'Compress PDF',
    category: 'PDF',
    route: '/tools/pdf-compress',
    keywords: ['pdf', 'compress', 'shrink', 'optimize', 'reduce', 'size'],
    icon: Archive,
    summary: 'Reduce PDF file size',
    load: () => import('@/islands/pdf/PdfCompress'),
    status: 'stable'
  },
  {
    id: 'pdf-protect',
    name: 'Protect PDF',
    category: 'PDF',
    route: '/tools/pdf-protect',
    keywords: ['pdf', 'protect', 'password', 'encrypt', 'lock', 'secure'],
    icon: Lock,
    summary: 'Add a password to a PDF (AES-256)',
    load: () => import('@/islands/pdf/PdfProtect'),
    status: 'stable'
  },
  {
    id: 'pdf-unlock',
    name: 'Unlock PDF',
    category: 'PDF',
    route: '/tools/pdf-unlock',
    keywords: ['pdf', 'unlock', 'password', 'decrypt', 'remove', 'unprotect'],
    icon: Unlock,
    summary: 'Remove a password from a PDF',
    load: () => import('@/islands/pdf/PdfUnlock'),
    status: 'stable'
  },
  {
    id: 'image-convert',
    name: 'Image Converter',
    category: 'Image',
    route: '/tools/image-convert',
    keywords: ['image', 'convert', 'png', 'jpg', 'jpeg', 'webp', 'format'],
    icon: Replace,
    summary: 'Convert images between PNG, JPEG, and WebP',
    load: () => import('@/islands/image/ImageConvert'),
    status: 'stable'
  },
  {
    id: 'image-compress',
    name: 'Image Compressor',
    category: 'Image',
    route: '/tools/image-compress',
    keywords: ['image', 'compress', 'shrink', 'optimize', 'reduce', 'size', 'webp', 'jpeg'],
    icon: Minimize2,
    summary: 'Shrink image file size by re-encoding',
    load: () => import('@/islands/image/ImageCompress'),
    status: 'stable'
  },
  {
    id: 'image-resize',
    name: 'Image Resizer',
    category: 'Image',
    route: '/tools/image-resize',
    keywords: ['image', 'resize', 'scale', 'dimensions', 'width', 'height', 'pixels'],
    icon: Maximize2,
    summary: 'Resize an image to exact pixel dimensions',
    load: () => import('@/islands/image/ImageResize'),
    status: 'stable'
  },
  {
    id: 'image-annotate',
    name: 'Image Annotator',
    category: 'Image',
    route: '/tools/image-annotate',
    keywords: ['image', 'annotate', 'screenshot', 'markup', 'draw', 'arrow', 'blur', 'highlight', 'text', 'rectangle', 'edit'],
    icon: PenTool,
    summary: 'Annotate a screenshot: arrows, text, shapes, highlighter, blur',
    load: () => import('@/islands/image/ImageAnnotate'),
    status: 'stable'
  },
  {
    id: 'image-crop',
    name: 'Image Cropper',
    category: 'Image',
    route: '/tools/image-crop',
    keywords: ['image', 'crop', 'trim', 'cut', 'selection', 'region'],
    icon: Crop,
    summary: 'Crop an image by dragging a selection',
    load: () => import('@/islands/image/ImageCrop'),
    status: 'stable'
  },
  {
    id: 'image-watermark',
    name: 'Image Watermark',
    category: 'Image',
    route: '/tools/image-watermark',
    keywords: ['image', 'watermark', 'text', 'stamp', 'copyright', 'overlay'],
    icon: Droplet,
    summary: 'Add a text watermark to an image',
    load: () => import('@/islands/image/ImageWatermark'),
    status: 'stable'
  },
  {
    id: 'image-merge',
    name: 'Merge Images',
    category: 'Image',
    route: '/tools/image-merge',
    keywords: ['image', 'merge', 'combine', 'join', 'stack', 'collage', 'concatenate', 'stitch', 'vertical', 'horizontal'],
    icon: Combine,
    summary: 'Combine multiple images into one, vertically or horizontally',
    load: () => import('@/islands/image/ImageMerge'),
    status: 'stable'
  },
  {
    id: 'image-upscale',
    name: 'Image Upscaler',
    category: 'Image',
    route: '/tools/image-upscale',
    keywords: ['upscale', 'enlarge', 'super resolution', 'esrgan', 'ai', 'resize', 'sharpen', 'hd', '2x', '4x'],
    icon: Scaling,
    summary: 'Enlarge images 2–4× with on-device AI (ESRGAN)',
    load: () => import('@/islands/image/ImageUpscale'),
    status: 'stable'
  },
  {
    id: 'image-object-remove',
    name: 'Object Remover',
    category: 'Image',
    route: '/tools/image-object-remove',
    keywords: ['object', 'remove', 'remover', 'inpaint', 'inpainting', 'lama', 'erase', 'cleanup', 'ai', 'magic'],
    icon: Wand2,
    summary: 'Paint over an object and erase it with AI inpainting (LaMa)',
    load: () => import('@/islands/image/ObjectRemove'),
    status: 'experimental'
  },
  {
    id: 'image-portrait-blur',
    name: 'Portrait Blur',
    category: 'Image',
    route: '/tools/image-portrait-blur',
    keywords: ['portrait', 'bokeh', 'background', 'blur', 'depth', 'subject', 'ai', 'photo'],
    icon: Aperture,
    summary: 'Keep the subject sharp and blur the background (bokeh)',
    load: () => import('@/islands/image/PortraitBlur'),
    status: 'stable'
  },
  {
    id: 'image-face-blur',
    name: 'Face Blur',
    category: 'Image',
    route: '/tools/image-face-blur',
    keywords: ['face', 'blur', 'anonymize', 'privacy', 'redact', 'hide', 'pixelate', 'ai', 'detect'],
    icon: ScanFace,
    summary: 'Auto-detect and hide faces with on-device AI',
    load: () => import('@/islands/image/FaceBlur'),
    status: 'stable'
  },
  {
    id: 'image-bg-remove',
    name: 'Background Remover',
    category: 'Image',
    route: '/tools/image-bg-remove',
    keywords: ['background', 'remove', 'remover', 'cutout', 'transparent', 'ai', 'isnet', 'subject', 'segment'],
    icon: Sparkles,
    summary: 'Remove an image background with on-device AI',
    load: () => import('@/islands/image/BackgroundRemove'),
    status: 'stable'
  },
  {
    id: 'image-scrub',
    name: 'Image Metadata Scrubber',
    category: 'Image',
    route: '/tools/image-scrub',
    keywords: ['image', 'exif', 'metadata', 'gps', 'location', 'strip', 'remove', 'privacy', 'scrub'],
    icon: Eraser,
    summary: 'Remove EXIF, GPS, and all metadata from an image',
    load: () => import('@/islands/image/ImageScrub'),
    status: 'stable'
  },
  {
    id: 'file-crypt',
    name: 'File Encrypt / Decrypt',
    category: 'Files',
    route: '/tools/file-crypt',
    keywords: ['file', 'encrypt', 'decrypt', 'password', 'aes', 'aes-256', 'lock', 'secure', 'protect', 'crypto'],
    icon: ShieldCheck,
    summary: 'Password-encrypt any file with AES-256 (client-side)',
    load: () => import('@/islands/files/FileCrypt'),
    status: 'stable'
  },
  {
    id: 'zip',
    name: 'Zip / Unzip',
    category: 'Files',
    route: '/tools/zip',
    keywords: ['zip', 'unzip', 'archive', 'compress', 'extract', 'bundle', 'files', 'folder'],
    icon: FileArchive,
    summary: 'Create a .zip from files, or extract one (client-side)',
    load: () => import('@/islands/files/ZipTool'),
    status: 'stable'
  },
  {
    id: 'archive-extract',
    name: 'Archive Extractor',
    category: 'Files',
    route: '/tools/archive-extract',
    keywords: ['rar', '7z', 'tar', 'gz', 'gzip', 'bzip2', 'xz', 'zstd', 'extract', 'unarchive', 'decompress', 'archive'],
    icon: FolderArchive,
    summary: 'Extract RAR, 7z, TAR, GZ, ZIP and more (client-side)',
    load: () => import('@/islands/files/ArchiveExtract'),
    status: 'stable'
  },
  {
    id: 'file-split',
    name: 'File Split / Join',
    category: 'Files',
    route: '/tools/file-split',
    keywords: ['split', 'join', 'chunk', 'part', 'divide', 'merge', 'concatenate', 'large', 'file'],
    icon: Scissors,
    summary: 'Split a large file into parts, or rejoin them (client-side)',
    load: () => import('@/islands/files/FileSplit'),
    status: 'stable'
  },
  {
    id: 'hash',
    name: 'Hash File',
    category: 'Dev',
    route: '/tools/hash',
    keywords: ['hash', 'sha', 'sha256', 'sha-256', 'checksum', 'generate', 'file', 'digest'],
    icon: Hash,
    summary: 'Generate a SHA-256 hash of a file',
    load: () => import('@/islands/dev/HashFile'),
    status: 'stable'
  },
  {
    id: 'video-to-gif',
    name: 'Video → GIF',
    category: 'Media',
    route: '/tools/video-to-gif',
    keywords: ['video', 'gif', 'convert', 'animated', 'mp4', 'webm', 'clip', 'ffmpeg'],
    icon: Film,
    summary: 'Turn a video clip into an animated GIF (client-side)',
    load: () => import('@/islands/media/VideoToGif'),
    status: 'stable'
  },
  {
    id: 'video-convert',
    name: 'Video Converter',
    category: 'Media',
    route: '/tools/video-convert',
    keywords: ['video', 'convert', 'compress', 'trim', 'cut', 'resize', 'mp4', 'webm', 'mov', 'transcode', 'ffmpeg'],
    icon: FileVideo,
    summary: 'Convert, compress, trim or resize video (client-side)',
    load: () => import('@/islands/media/VideoConvert'),
    status: 'stable'
  },
  {
    id: 'video-to-audio',
    name: 'Video → Audio',
    category: 'Media',
    route: '/tools/video-to-audio',
    keywords: ['video', 'audio', 'extract', 'rip', 'mp3', 'm4a', 'wav', 'opus', 'sound', 'ffmpeg'],
    icon: Music,
    summary: 'Extract the audio track from a video (client-side)',
    load: () => import('@/islands/media/VideoToAudio'),
    status: 'stable'
  },
  {
    id: 'audio-convert',
    name: 'Audio Converter',
    category: 'Media',
    route: '/tools/audio-convert',
    keywords: ['audio', 'convert', 'trim', 'mp3', 'm4a', 'wav', 'opus', 'flac', 'bitrate', 'ffmpeg'],
    icon: AudioLines,
    summary: 'Convert, re-encode or trim audio files (client-side)',
    load: () => import('@/islands/media/AudioConvert'),
    status: 'stable'
  },
  {
    id: 'screen-recorder',
    name: 'Screen Recorder',
    category: 'Media',
    route: '/tools/screen-recorder',
    keywords: ['screen', 'record', 'recorder', 'capture', 'video', 'webm', 'display', 'mic'],
    icon: MonitorPlay,
    summary: 'Record your screen, window or tab (client-side)',
    load: () => import('@/islands/media/ScreenRecorder'),
    status: 'stable'
  },
  {
    id: 'screenshot',
    name: 'Screenshot',
    category: 'Media',
    route: '/tools/screenshot',
    keywords: ['screenshot', 'screen', 'capture', 'crop', 'grab', 'png', 'jpg', 'display'],
    icon: Camera,
    summary: 'Capture your screen with a countdown, then crop (client-side)',
    load: () => import('@/islands/media/Screenshot'),
    status: 'stable'
  },
  {
    id: 'whiteboard',
    name: 'Whiteboard',
    category: 'Draw',
    route: '/tools/whiteboard',
    keywords: ['whiteboard', 'draw', 'sketch', 'diagram', 'flowchart', 'mindmap', 'excalidraw', 'canvas'],
    icon: Shapes,
    summary: 'Sketch, diagram, and mind-map on an infinite canvas',
    load: () => import('@/islands/draw/Whiteboard'),
    status: 'stable'
  },
  {
    id: 'signature',
    name: 'Signature Pad',
    category: 'Draw',
    route: '/tools/signature',
    keywords: ['signature', 'sign', 'draw', 'autograph', 'pen', 'png', 'svg'],
    icon: PenLine,
    summary: 'Draw a signature and export it as PNG or SVG',
    load: () => import('@/islands/draw/SignaturePad'),
    status: 'stable'
  }
];

export function getToolById(id: string): ToolDef | undefined {
  return tools.find(tool => tool.id === id);
}

export function getToolByRoute(route: string): ToolDef | undefined {
  return tools.find(tool => tool.route === route);
}

export function searchTools(query: string): ToolDef[] {
  // Return all tools if query is empty
  if (!query || query.trim() === '') {
    return tools;
  }

  const lowerQuery = query.toLowerCase().trim();

  return tools
    .map(tool => ({
      tool,
      score: calculateScore(tool, lowerQuery)
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ tool }) => tool);
}

function calculateScore(tool: ToolDef, query: string): number {
  let score = 0;

  const lowerName = tool.name.toLowerCase();
  const lowerSummary = tool.summary.toLowerCase();
  const lowerCategory = tool.category.toLowerCase();

  // Exact name match
  if (lowerName === query) score += 200;
  // Name contains query
  if (lowerName.includes(query)) score += 100;

  // Keywords match
  if (tool.keywords.some(k => k.toLowerCase() === query)) score += 150;
  if (tool.keywords.some(k => k.toLowerCase().includes(query))) score += 50;

  // Summary/description match (including subtitle)
  if (lowerSummary.includes(query)) score += 30;

  // Category match
  if (lowerCategory.includes(query)) score += 20;

  return score;
}
