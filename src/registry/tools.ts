import { Hash, Braces, Binary, Link, KeyRound, Fingerprint, KeySquare, FileDiff, Table, FileText, QrCode, ScanLine, Clock, Calculator, Palette, FilePlus2, Scissors, RotateCw, FileImage, FileX, Stamp, Image, Replace, Minimize2, Maximize2, Eraser, Archive, Lock, Unlock, Crop, Droplet, PenTool, Combine, ShieldCheck, FileCode, FileCode2, FileCog, FileArchive, FolderArchive, Sparkles, ScanFace, Scaling, Aperture, Wand2, PenLine, Shapes, Film, FileVideo, Music, AudioLines, MonitorPlay, Camera, Code2, Database, Keyboard, Contrast, Eye, ScanText, Receipt, Webcam, Mic, Send, Video, Wrench, Compass, Map, Waypoints, ImageDown, ScrollText, Ghost, FileSpreadsheet, BookOpen, FileType2, FileDown, GitCompare, FileOutput, CalendarClock, ClipboardPaste, PlugZap, Regex, Contact, Wallet, Network, Subtitles, Presentation, SquareUser, WholeWord, Percent, Baseline, CaseSensitive, Brush, AppWindow, ListOrdered, FileSignature, Shrink, Cake } from 'lucide-react';
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
    id: 'json-compare',
    name: 'JSON Deep Compare',
    category: 'Dev',
    route: '/tools/json-compare',
    keywords: ['json', 'compare', 'deep', 'equal', 'diff', 'object', 'structure'],
    icon: Braces,
    summary: 'Deep compare JSON objects ignoring property order',
    load: () => import('@/islands/dev/JsonCompare'),
    status: 'stable'
  },
  {
    id: 'hotkey-test',
    name: 'Hotkey Test',
    category: 'Dev',
    route: '/tools/hotkey-test',
    keywords: ['hotkey', 'shortcut', 'global', 'keyboard', 'test', 'keybinding'],
    icon: Keyboard,
    summary: 'Test global hotkey registration (desktop only)',
    load: () => import('@/islands/dev/HotkeyTest'),
    status: 'beta',
    desktopOnly: true
  },
  {
    id: 'api-client',
    name: 'API Client',
    category: 'Dev',
    route: '/tools/api-client',
    keywords: ['postman', 'insomnia', 'swagger', 'openapi', 'rest', 'http', 'api', 'debug', 'request', 'har', 'export', 'import'],
    icon: PlugZap,
    summary: 'REST API client — import Postman, Insomnia, Swagger or HAR and fire requests in your browser.',
    load: () => import('@/islands/dev/ApiClient'),
    status: 'beta'
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
    id: 'ghost-backup',
    name: 'Ghost Blog Backup',
    category: 'Dev',
    route: '/tools/ghost-backup',
    keywords: ['ghost', 'blog', 'backup', 'export', 'markdown', 'html', 'migrate', 'static site', 'cms', 'convert', 'json'],
    icon: Ghost,
    summary: 'Convert a Ghost export to Markdown or HTML files (ZIP)',
    load: () => import('@/islands/dev/GhostBackup'),
    status: 'beta'
  },
  {
    id: 'compare-lists',
    name: 'Compare Two Lists',
    category: 'Dev',
    route: '/tools/compare-lists',
    keywords: ['compare', 'lists', 'lines', 'diff', 'dedupe', 'duplicate', 'merge', 'union', 'intersection', 'difference', 'subtract', 'common', 'unique', 'set', 'text'],
    icon: GitCompare,
    summary: 'Merge, dedupe, subtract or find common lines between two lists',
    load: () => import('@/islands/dev/CompareLists'),
    status: 'beta'
  },
  {
    id: 'sql-format',
    name: 'SQL Formatter',
    category: 'Dev',
    route: '/tools/sql-format',
    keywords: ['sql', 'format', 'formatter', 'beautify', 'prettify', 'pretty', 'query', 'postgresql', 'mysql', 'sqlite', 'bigquery', 'database'],
    icon: Database,
    summary: 'Format and beautify SQL queries (PostgreSQL, MySQL, and more)',
    load: () => import('@/islands/dev/SqlFormat'),
    status: 'beta'
  },
  {
    id: 'regex-tester',
    name: 'Regex Tester',
    category: 'Dev',
    route: '/tools/regex-tester',
    keywords: ['regex', 'regexp', 'regular expression', 'test', 'match', 'pattern', 'pcre', 'javascript', 'python', 'java', 'go'],
    icon: Regex,
    summary: 'Test regular expressions with live highlighting and per-language code',
    load: () => import('@/islands/dev/RegexTester'),
    status: 'beta'
  },
  {
    id: 'qris-decoder',
    name: 'QRIS Decoder',
    category: 'Dev',
    route: '/tools/qris-decoder',
    keywords: ['qris', 'qr', 'emvco', 'payment', 'decode', 'nmid', 'merchant', 'indonesia', 'tlv'],
    icon: Wallet,
    summary: 'Decode a QRIS payment code — merchant, NMID, city, amount',
    load: () => import('@/islands/dev/QrisDecoder'),
    status: 'beta'
  },
  {
    id: 'hash-text',
    name: 'Hash Text',
    category: 'Dev',
    route: '/tools/hash-text',
    keywords: ['hash', 'text', 'md5', 'sha', 'sha256', 'sha512', 'crc32', 'checksum', 'digest'],
    icon: Hash,
    summary: 'MD5, SHA-1/256/512 and CRC32 hashes of any text',
    load: () => import('@/islands/dev/HashText'),
    status: 'beta'
  },
  {
    id: 'cidr-calculator',
    name: 'CIDR Calculator',
    category: 'Dev',
    route: '/tools/cidr-calculator',
    keywords: ['cidr', 'subnet', 'netmask', 'ip', 'ipv4', 'network', 'broadcast', 'calculator'],
    icon: Network,
    summary: 'IPv4 subnet calculator — network, broadcast, mask, host range',
    load: () => import('@/islands/dev/CidrCalculator'),
    status: 'beta'
  },
  {
    id: 'minifier',
    name: 'HTML/CSS/JS Minifier',
    category: 'Dev',
    route: '/tools/minifier',
    keywords: ['minify', 'minifier', 'html', 'css', 'js', 'javascript', 'compress', 'uglify'],
    icon: Minimize2,
    summary: 'Minify HTML, CSS and JavaScript in your browser',
    load: () => import('@/islands/dev/Minifier'),
    status: 'beta'
  },
  {
    id: 'subtitle-editor',
    name: 'Subtitle Editor (SRT/VTT)',
    category: 'Media',
    route: '/tools/subtitle-editor',
    keywords: ['subtitle', 'srt', 'vtt', 'webvtt', 'caption', 'convert', 'retime', 'editor'],
    icon: Subtitles,
    summary: 'Edit, retime and convert SRT and WebVTT subtitles',
    load: () => import('@/islands/media/SubtitleEditor'),
    status: 'beta'
  },
  {
    id: 'voice-recorder',
    name: 'Voice Recorder',
    category: 'Media',
    route: '/tools/voice-recorder',
    keywords: ['voice', 'recorder', 'audio', 'microphone', 'record', 'mic', 'dictaphone'],
    icon: Mic,
    summary: 'Record microphone audio and download it',
    load: () => import('@/islands/media/VoiceRecorder'),
    status: 'beta'
  },
  {
    id: 'pdf-extract-images',
    name: 'Extract Images from PDF',
    category: 'PDF',
    route: '/tools/pdf-extract-images',
    keywords: ['pdf', 'extract', 'images', 'image', 'pictures', 'embedded', 'export'],
    icon: FileImage,
    summary: 'Pull embedded images out of a PDF',
    load: () => import('@/islands/pdf/PdfExtractImages'),
    status: 'beta'
  },
  {
    id: 'pptx-viewer',
    name: 'PPTX Viewer',
    category: 'Documents',
    route: '/tools/pptx-viewer',
    keywords: ['pptx', 'powerpoint', 'slides', 'presentation', 'viewer', 'open', 'office'],
    icon: Presentation,
    summary: 'Open and read PowerPoint slides in your browser',
    load: () => import('@/islands/documents/PptxViewer'),
    status: 'beta'
  },
  {
    id: 'nik-decoder',
    name: 'NIK / KTP Decoder',
    category: 'Dev',
    route: '/tools/nik-decoder',
    keywords: ['nik', 'ktp', 'decode', 'validate', 'cek nik', 'indonesia', 'identity', 'birthdate', 'province'],
    icon: SquareUser,
    summary: 'Validate an Indonesian NIK and decode province, birth date & gender',
    load: () => import('@/islands/dev/NikDecoder'),
    status: 'beta'
  },
  {
    id: 'terbilang',
    name: 'Terbilang (Number to Words)',
    category: 'Dev',
    route: '/tools/terbilang',
    keywords: ['terbilang', 'number to words', 'angka', 'kwitansi', 'invoice', 'rupiah', 'spell', 'indonesia'],
    icon: WholeWord,
    summary: 'Convert numbers to Indonesian words for invoices & cheques',
    load: () => import('@/islands/dev/Terbilang'),
    status: 'beta'
  },
  {
    id: 'ppn-pph-calculator',
    name: 'PPN & PPh Calculator',
    category: 'Dev',
    route: '/tools/ppn-pph-calculator',
    keywords: ['ppn', 'pph', 'pajak', 'vat', 'tax', 'invoice', 'faktur', 'withholding', 'indonesia'],
    icon: Percent,
    summary: 'Calculate Indonesian PPN (VAT) and PPh withholding on invoices',
    load: () => import('@/islands/dev/TaxCalculator'),
    status: 'beta'
  },
  {
    id: 'word-counter',
    name: 'Word Counter',
    category: 'Dev',
    route: '/tools/word-counter',
    keywords: ['word counter', 'character count', 'count words', 'letters', 'sentences', 'reading time', 'text'],
    icon: Baseline,
    summary: 'Count words, characters, sentences & reading time',
    load: () => import('@/islands/dev/WordCounter'),
    status: 'beta'
  },
  {
    id: 'case-converter',
    name: 'Case Converter',
    category: 'Dev',
    route: '/tools/case-converter',
    keywords: ['case converter', 'uppercase', 'lowercase', 'title case', 'camelcase', 'snake_case', 'kebab-case', 'text'],
    icon: CaseSensitive,
    summary: 'Convert text between UPPER, lower, Title, camel, snake & kebab case',
    load: () => import('@/islands/dev/CaseConverter'),
    status: 'beta'
  },
  {
    id: 'text-cleanup',
    name: 'Text Cleanup',
    category: 'Dev',
    route: '/tools/text-cleanup',
    keywords: ['text cleaner', 'remove line breaks', 'remove blank lines', 'trim', 'strip html', 'remove accents', 'dedupe lines', 'sort lines'],
    icon: Brush,
    summary: 'Clean up text — trim, strip HTML, remove line breaks, dedupe & sort',
    load: () => import('@/islands/dev/TextCleanup'),
    status: 'beta'
  },
  {
    id: 'favicon-generator',
    name: 'Favicon Generator',
    category: 'Image',
    route: '/tools/favicon-generator',
    keywords: ['favicon', 'generator', 'ico', 'apple touch icon', 'manifest', 'website icon', 'png'],
    icon: AppWindow,
    summary: 'Turn an image into a favicon set (ICO, PNGs, manifest)',
    load: () => import('@/islands/image/FaviconGenerator'),
    status: 'beta'
  },
  {
    id: 'compress-to-size',
    name: 'Compress to Size',
    category: 'Files',
    route: '/tools/compress-to-size',
    keywords: ['compress', 'reduce file size', 'target size', 'compress jpg to 100kb', 'compress pdf', 'kompres pdf', 'kompres foto', 'compress image', 'kb', 'mb', 'shrink'],
    icon: Shrink,
    summary: 'Compress an image or PDF to a target file size (e.g. 100 KB)',
    load: () => import('@/islands/files/CompressToSize'),
    status: 'beta'
  },
  {
    id: 'age-calculator',
    name: 'Age & Weton Calculator',
    category: 'Calculators',
    route: '/tools/age-calculator',
    keywords: ['age calculator', 'how old am i', 'date of birth', 'weton', 'neptu', 'kalkulator usia', 'hitung umur', 'weton jawa', 'birthday', 'ulang tahun'],
    icon: Cake,
    summary: 'Work out an exact age plus your Javanese weton and neptu',
    load: () => import('@/islands/calculators/AgeWeton'),
    status: 'beta'
  },
  {
    id: 'pdf-organize',
    name: 'Organize PDF',
    category: 'PDF',
    route: '/tools/pdf-organize',
    keywords: ['organize pdf', 'reorder pages', 'rearrange', 'delete pages', 'page numbers', 'sort pdf'],
    icon: ListOrdered,
    summary: 'Drag to reorder or delete PDF pages and add page numbers',
    load: () => import('@/islands/pdf/PdfOrganize'),
    status: 'beta'
  },
  {
    id: 'pdf-sign',
    name: 'Sign PDF',
    category: 'PDF',
    route: '/tools/pdf-sign',
    keywords: ['sign pdf', 'esign', 'signature', 'e-signature', 'sign document', 'draw signature'],
    icon: FileSignature,
    summary: 'Draw or upload a signature and place it on a PDF',
    load: () => import('@/islands/pdf/PdfSign'),
    status: 'beta'
  },
  {
    id: 'cron-expression',
    name: 'Cron Expression',
    category: 'Dev',
    route: '/tools/cron-expression',
    keywords: ['cron', 'crontab', 'schedule', 'scheduler', 'expression', 'timer', 'interval', 'recurring', 'task', 'job', 'unix', 'linux', 'automation'],
    icon: CalendarClock,
    summary: 'Parse and explain cron expressions with next scheduled run times',
    load: () => import('@/islands/dev/CronExplainer'),
    status: 'beta'
  },
  {
    id: 'clipboard-inspector',
    name: 'Clipboard Inspector',
    category: 'Dev',
    route: '/tools/clipboard-inspector',
    keywords: ['clipboard', 'paste', 'copy', 'inspect', 'viewer', 'image', 'video', 'audio', 'text', 'html', 'file', 'binary', 'content'],
    icon: ClipboardPaste,
    summary: 'Inspect and save clipboard contents — text, images, video, audio, and files',
    load: () => import('@/islands/dev/ClipboardInspector'),
    status: 'beta'
  },
  {
    id: 'docx-viewer',
    name: 'Word (DOCX) Viewer',
    category: 'Documents',
    route: '/tools/docx-viewer',
    keywords: ['docx', 'word', 'viewer', 'open', 'read', 'document', 'office', 'preview', 'doc'],
    icon: FileText,
    summary: 'Open and read Word .docx files in your browser',
    load: () => import('@/islands/documents/DocxViewer'),
    status: 'beta'
  },
  {
    id: 'spreadsheet-viewer',
    name: 'Spreadsheet/CSV Viewer',
    category: 'Documents',
    route: '/tools/spreadsheet-viewer',
    keywords: ['spreadsheet', 'excel', 'xlsx', 'xls', 'ods', 'csv', 'viewer', 'open', 'read', 'sheet', 'opendocument', 'calc'],
    icon: FileSpreadsheet,
    summary: 'Open Excel, OpenDocument and CSV spreadsheets in your browser',
    load: () => import('@/islands/documents/SpreadsheetViewer'),
    status: 'beta'
  },
  {
    id: 'epub-reader',
    name: 'EPUB Reader',
    category: 'Documents',
    route: '/tools/epub-reader',
    keywords: ['epub', 'ebook', 'e-book', 'reader', 'book', 'read', 'viewer', 'open', 'kindle', 'ereader'],
    icon: BookOpen,
    summary: 'Read EPUB e-books in your browser with chapters and text sizing',
    load: () => import('@/islands/documents/EpubReader'),
    status: 'beta'
  },
  {
    id: 'odt-viewer',
    name: 'OpenDocument (ODT) Viewer',
    category: 'Documents',
    route: '/tools/odt-viewer',
    keywords: ['odt', 'opendocument', 'libreoffice', 'openoffice', 'writer', 'viewer', 'open', 'read', 'document', 'word processor'],
    icon: FileType2,
    summary: 'Open and read OpenDocument Text .odt files in your browser',
    load: () => import('@/islands/documents/OdtViewer'),
    status: 'beta'
  },
  {
    id: 'docx-to-pdf',
    name: 'Word (DOCX) to PDF',
    category: 'Documents',
    route: '/tools/docx-to-pdf',
    keywords: ['docx', 'word', 'pdf', 'convert', 'converter', 'doc to pdf', 'word to pdf', 'export', 'save as pdf'],
    icon: FileDown,
    summary: 'Convert Word .docx documents to PDF in your browser',
    load: () => import('@/islands/documents/DocxToPdf'),
    status: 'beta'
  },
  {
    id: 'pdf-to-docx',
    name: 'PDF to Word (DOCX)',
    category: 'Documents',
    route: '/tools/pdf-to-docx',
    keywords: ['pdf', 'docx', 'word', 'convert', 'converter', 'pdf to word', 'pdf to docx', 'editable', 'ocr', 'extract', 'scanned'],
    icon: FileOutput,
    summary: 'Convert a PDF to an editable Word document (with OCR for scans)',
    load: () => import('@/islands/documents/PdfToDocx'),
    status: 'beta'
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
    id: 'pdf-repair',
    name: 'Repair PDF',
    category: 'PDF',
    route: '/tools/pdf-repair',
    keywords: ['pdf', 'repair', 'fix', 'recover', 'damaged', 'corrupt', 'broken', 'restore', 'rebuild'],
    icon: Wrench,
    summary: 'Fix a damaged PDF so it opens again (client-side)',
    load: () => import('@/islands/pdf/PdfRepair'),
    status: 'beta'
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
    id: 'pas-foto',
    name: 'Pas Foto Maker',
    category: 'Image',
    route: '/tools/pas-foto',
    keywords: ['pas foto', 'pasfoto', 'id photo', 'passport photo', '2x3', '3x4', '4x6', 'foto ktp', 'print', 'background'],
    icon: Contact,
    summary: 'Make print-ready 2x3, 3x4 & 4x6 ID photos with a clean background',
    load: () => import('@/islands/image/PasFoto'),
    status: 'beta'
  },
  {
    id: 'image-heic-to-jpg',
    name: 'HEIC to JPG',
    category: 'Image',
    route: '/tools/image-heic-to-jpg',
    keywords: ['heic', 'heif', 'jpg', 'jpeg', 'convert', 'iphone', 'photo', 'apple'],
    icon: ImageDown,
    summary: 'Convert iPhone HEIC/HEIF photos to JPG',
    load: () => import('@/islands/image/HeicToJpg'),
    status: 'beta'
  },
  {
    id: 'image-viewer',
    name: 'Image Viewer & Metadata',
    category: 'Image',
    route: '/tools/image-viewer',
    keywords: ['image', 'viewer', 'metadata', 'exif', 'ico', 'favicon', 'dimensions', 'inspect'],
    icon: Eye,
    summary: 'View any image with dimensions, EXIF, and ICO sizes',
    load: () => import('@/islands/image/ImageViewer'),
    status: 'stable'
  },
  {
    id: 'svg-viewer',
    name: 'SVG Viewer & Converter',
    category: 'Image',
    route: '/tools/svg-viewer',
    keywords: ['svg', 'viewer', 'vector', 'rasterize', 'convert', 'png', 'jpeg', 'webp'],
    icon: FileImage,
    summary: 'View SVG files and export them as PNG, JPEG, or WebP',
    load: () => import('@/islands/image/SvgViewer'),
    status: 'stable'
  },
  {
    id: 'monochrome',
    name: 'Black/White & Monochrome',
    category: 'Image',
    route: '/tools/monochrome',
    keywords: ['monochrome', 'grayscale', 'greyscale', 'black and white', 'black white', 'bw', 'threshold', 'dither', 'desaturate'],
    icon: Contrast,
    summary: 'Convert images to grayscale, black & white, or dithered',
    load: () => import('@/islands/image/Monochrome'),
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
    id: 'image-stamp',
    name: 'Image Stamp',
    category: 'Image',
    route: '/tools/image-stamp',
    keywords: ['image', 'stamp', 'confidential', 'paid', 'draft', 'approved', 'rubber stamp', 'status', 'mark'],
    icon: Stamp,
    summary: 'Stamp CONFIDENTIAL, PAID and other status marks onto an image',
    load: () => import('@/islands/image/ImageStamp'),
    status: 'beta'
  },
  {
    id: 'image-qr',
    name: 'Add QR to Image',
    category: 'Image',
    route: '/tools/image-qr',
    keywords: ['image', 'qr', 'qrcode', 'qr code', 'overlay', 'corner', 'url', 'link', 'add'],
    icon: QrCode,
    summary: 'Overlay a QR code onto a corner of an image',
    load: () => import('@/islands/image/ImageQr'),
    status: 'beta'
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
    id: 'image-ocr',
    name: 'Image to Text (OCR)',
    category: 'Image',
    route: '/tools/image-ocr',
    keywords: ['ocr', 'receipt', 'scan', 'text', 'extract', 'recognize', 'read', 'document'],
    icon: ScanText,
    summary: 'Extract text from an image or PDF with on-device AI',
    load: () => import('@/islands/image/ImageOcr'),
    status: 'beta'
  },
  {
    id: 'image-receipt-scanner',
    name: 'Receipt Scanner',
    category: 'Image',
    route: '/tools/image-receipt-scanner',
    keywords: ['receipt', 'scanner', 'expense', 'invoice', 'ocr', 'extract', 'total', 'merchant'],
    icon: Receipt,
    summary: 'Pull merchant, date, and totals from a receipt on-device',
    load: () => import('@/islands/image/ReceiptScanner'),
    status: 'beta'
  },
  {
    id: 'camera-capture',
    name: 'Camera Capture',
    category: 'Image',
    route: '/tools/camera-capture',
    keywords: ['camera', 'webcam', 'photo', 'capture', 'snap', 'take picture', 'scan'],
    icon: Webcam,
    summary: 'Take a photo with your webcam or phone camera',
    load: () => import('@/islands/image/CameraTool'),
    status: 'beta'
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
    id: 'file-transfer',
    name: 'P2P File Transfer',
    category: 'Network',
    route: '/tools/file-transfer',
    keywords: ['file', 'transfer', 'send', 'share', 'p2p', 'peer to peer', 'webrtc', 'direct', 'device to device'],
    icon: Send,
    summary: 'Send a file directly to another device, peer-to-peer',
    load: () => import('@/islands/files/FileTransfer'),
    status: 'beta'
  },
  {
    id: 'video-call',
    name: 'Video Call',
    category: 'Network',
    route: '/tools/video-call',
    keywords: ['video', 'call', 'chat', 'webrtc', 'p2p', 'peer to peer', 'meeting', 'screen share', 'camera', 'conference'],
    icon: Video,
    summary: 'Peer-to-peer video call with screen sharing and chat',
    load: () => import('@/islands/network/VideoCall'),
    status: 'beta'
  },
  {
    id: 'optical-transfer',
    name: 'Optical File Transfer',
    category: 'Network',
    route: '/tools/optical-transfer',
    keywords: ['optical', 'qr', 'transfer', 'beam', 'camera', 'screen', 'offline', 'air-gap', 'no network', 'fountain', 'file'],
    icon: ScanLine,
    summary: 'Beam a file device-to-device with QR codes — no network at all',
    load: () => import('@/islands/network/OpticalTransfer'),
    status: 'beta'
  },
  {
    id: 'coord-convert',
    name: 'Coordinate Converter',
    category: 'Maps',
    route: '/tools/coord-convert',
    keywords: ['coordinate', 'gps', 'latitude', 'longitude', 'dms', 'utm', 'geohash', 'convert', 'lat', 'lng', 'map'],
    icon: Compass,
    summary: 'Convert GPS coordinates between DD, DMS, UTM and geohash',
    load: () => import('@/islands/maps/CoordConvert'),
    status: 'beta'
  },
  {
    id: 'map-explorer',
    name: 'Map Explorer',
    category: 'Maps',
    route: '/tools/map-explorer',
    keywords: ['map', 'maps', 'explore', 'search', 'place', 'coordinates', 'measure', 'distance', 'openstreetmap', 'pin', 'location'],
    icon: Map,
    summary: 'Search places, drop a pin for coordinates, and measure distance',
    load: () => import('@/islands/maps/MapExplorer'),
    status: 'beta'
  },
  {
    id: 'geo-viewer',
    name: 'GeoJSON / GPX / KML Viewer',
    category: 'Maps',
    route: '/tools/geo-viewer',
    keywords: ['geojson', 'gpx', 'kml', 'viewer', 'map', 'gps', 'track', 'route', 'geo', 'features'],
    icon: Waypoints,
    summary: 'View GeoJSON, GPX and KML files on a map — stays on your device',
    load: () => import('@/islands/maps/GeoViewer'),
    status: 'beta'
  },
  {
    id: 'static-map',
    name: 'Static Map Maker',
    category: 'Maps',
    route: '/tools/static-map',
    keywords: ['static', 'map', 'image', 'png', 'export', 'screenshot', 'snapshot', 'download', 'openstreetmap'],
    icon: ImageDown,
    summary: 'Frame a map and export it as a PNG image',
    load: () => import('@/islands/maps/StaticMap'),
    status: 'beta'
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
    id: 'legacy-letter',
    name: 'Digital Legacy Letter',
    category: 'Legacy',
    route: '/tools/legacy-letter',
    keywords: ['legacy', 'will', 'digital will', 'surat wasiat', 'wasiat', 'password', 'inheritance', 'family', 'encrypt', 'in case i die', 'dead man switch', 'secret', 'shamir'],
    icon: ScrollText,
    summary: 'Encrypt a private letter of passwords & final words for your family',
    load: () => import('@/islands/legacy/LegacyLetter'),
    status: 'beta'
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
    id: 'voice-to-text',
    name: 'Voice to Text',
    category: 'Media',
    route: '/tools/voice-to-text',
    keywords: ['voice', 'speech', 'transcribe', 'transcription', 'whisper', 'audio to text', 'dictation', 'subtitles', 'srt', 'vtt', 'stt'],
    icon: Mic,
    summary: 'Transcribe speech to text on-device (Whisper), with SRT/VTT export',
    load: () => import('@/islands/media/VoiceToText'),
    status: 'beta'
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
    id: 'code-scratchpad',
    name: 'Code Scratchpad',
    category: 'Playground',
    route: '/tools/code-scratchpad',
    keywords: ['code', 'editor', 'monaco', 'vscode', 'scratchpad', 'text', 'multi-cursor'],
    icon: Code2,
    summary: 'VS Code-grade multi-file editor, on-device',
    load: () => import('@/islands/playground/CodeScratchpad'),
    status: 'stable'
  },
  {
    id: 'sqlite-playground',
    name: 'SQLite Playground',
    category: 'Playground',
    route: '/tools/sqlite-playground',
    keywords: ['sqlite', 'sql', 'database', 'db', 'query', 'table', 'index', 'ddl', 'dml', 'playground'],
    icon: Database,
    summary: 'Run SQL against an on-device SQLite database',
    load: () => import('@/islands/playground/SqlitePlayground'),
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
    id: 'db-diagram',
    name: 'DB Diagram',
    category: 'Draw',
    route: '/tools/db-diagram',
    keywords: ['dbml', 'erd', 'er diagram', 'schema', 'database', 'diagram', 'sql', 'tables'],
    icon: Database,
    summary: 'Design database schemas in DBML with a live ER diagram, SQL and image export',
    load: () => import('@/islands/draw/DbDiagram'),
    status: 'beta'
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

/** Split text into lowercase word tokens (letters/digits). */
function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * Crude English stemmer — strips common inflection suffixes so "signed" →
 * "sign", "images" → "image", "converting" → "convert". Only strips when the
 * stem stays at least 3 chars, to avoid mangling short words.
 */
function stem(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('ies') && word.length > 4) return word.slice(0, -3) + 'y';
  for (const suffix of ['ing', 'ed', 'es', 's']) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) return word.slice(0, -suffix.length);
  }
  return word;
}

/** Score how well one query token matches a set of field tokens (0 = no match). */
function tokenScore(q: string, qStem: string, fieldTokens: string[], weight: number): number {
  let best = 0;
  for (const t of fieldTokens) {
    if (t === q) return weight; // exact — can't do better
    // Prefix either way ("sig"→"sign", "signed"→"sign") when the shorter side is meaningful.
    if ((t.startsWith(q) || q.startsWith(t)) && Math.min(t.length, q.length) >= 3) {
      best = Math.max(best, weight * 0.85);
      continue;
    }
    if (stem(t) === qStem) best = Math.max(best, weight * 0.7);
  }
  return best;
}

function calculateScore(tool: ToolDef, query: string): number {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return 0;

  const nameTokens = tokenize(tool.name);
  const keywordTokens = tool.keywords.flatMap(tokenize);
  const summaryTokens = tokenize(tool.summary);
  const categoryTokens = tokenize(tool.category);

  // Every query token must match somewhere (AND) so multi-word queries narrow.
  let score = 0;
  for (const q of queryTokens) {
    const qStem = stem(q);
    const best = Math.max(
      tokenScore(q, qStem, nameTokens, 100),
      tokenScore(q, qStem, keywordTokens, 80),
      tokenScore(q, qStem, summaryTokens, 30),
      tokenScore(q, qStem, categoryTokens, 20),
    );
    if (best === 0) return 0;
    score += best;
  }

  // Bonuses that reward tighter matches.
  const q = query.toLowerCase().trim();
  if (tool.name.toLowerCase() === q) score += 200;
  else if (tool.name.toLowerCase().includes(q)) score += 60;
  if (`${tool.name} ${tool.keywords.join(' ')} ${tool.summary}`.toLowerCase().includes(q)) score += 40;

  return score;
}
