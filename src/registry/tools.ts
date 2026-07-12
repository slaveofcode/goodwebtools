import { Hash, Braces, Binary, Link, KeyRound, Fingerprint, KeySquare, FileDiff, Table, FileText, QrCode, ScanLine, Clock, Calculator, Palette, FilePlus2, Scissors, RotateCw, FileImage, FileX, Stamp, Image } from 'lucide-react';
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
    keywords: ['base64', 'encode', 'decode', 'btoa', 'atob', 'binary'],
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
    keywords: ['csv', 'json', 'convert', 'spreadsheet', 'table', 'transform'],
    icon: Table,
    summary: 'Convert between CSV and JSON',
    load: () => import('@/islands/dev/CsvJson'),
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
    name: 'Color Converter',
    category: 'Dev',
    route: '/tools/color-convert',
    keywords: ['color', 'colour', 'hex', 'rgb', 'hsl', 'convert', 'picker', 'palette'],
    icon: Palette,
    summary: 'Convert colors between HEX, RGB, and HSL',
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
    id: 'hash-demo',
    name: 'Hash File',
    category: 'Dev',
    route: '/tools/hash-demo',
    keywords: ['hash', 'sha', 'sha256', 'sha-256', 'checksum', 'generate', 'file'],
    icon: Hash,
    summary: 'Generate SHA-256 hash of a file',
    load: () => import('@/islands/demo/HashDemo'),
    status: 'beta'
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
