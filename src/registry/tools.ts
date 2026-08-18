import { Hash, Braces, Binary, Link, KeyRound, Fingerprint, KeySquare, FileDiff, Table, FileText, QrCode, ScanLine, Clock, Calculator, Palette, FilePlus2, Scissors, RotateCw, FileImage, FileX, Stamp, Image, Replace, Minimize2, Maximize2, Eraser, Archive, Lock, Unlock, Crop, Droplet, PenTool, Combine, ShieldCheck, FileCode, FileCode2, FileCog, FileArchive, FolderArchive, Sparkles, ScanFace, Scaling, Aperture, Wand2, PenLine, Shapes, Film, FileVideo, Music, AudioLines, MonitorPlay, Camera, Code2, Database, Keyboard, Contrast, Eye, ScanText, Receipt, Webcam, Mic, Send, Video, Wrench, Compass, Map, Waypoints, ImageDown, ScrollText, Ghost, FileSpreadsheet, BookOpen, FileType2, FileDown, GitCompare, FileOutput, CalendarClock, ClipboardPaste, PlugZap, Regex, Contact, Wallet, Network, Subtitles, Presentation, SquareUser, WholeWord, Percent, Baseline, CaseSensitive, Brush, AppWindow, ListOrdered, FileSignature, Shrink, Cake, Ruler, Timer, Highlighter, Gauge, Speech, Accessibility, Tags, Link2Off, Home, HeartHandshake, Gift, Barcode, Disc3, Sticker, Glasses, HeartPulse, BookCopy, Users, Grip, MailOpen, Scan, Activity, Grid3x3, Bird, ServerCog, Pilcrow, MonitorSmartphone, Volume2, Monitor, MousePointerClick, ListChecks, Landmark, Hourglass, Globe, Smile, Waves, Music4 } from 'lucide-react';
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
    id: 'white-noise',
    name: 'White Noise & Rain',
    category: 'Media',
    route: '/tools/white-noise',
    keywords: ['white noise', 'pink noise', 'brown noise', 'rain sounds', 'noise generator', 'focus', 'sleep sounds'],
    icon: Waves,
    summary: 'Generate white, pink or brown noise & rain to focus or sleep',
    load: () => import('@/islands/media/WhiteNoise'),
    status: 'beta'
  },
  {
    id: 'ambient-generator',
    name: 'Ambient & Binaural Generator',
    category: 'Media',
    route: '/tools/ambient-generator',
    keywords: ['binaural beats', 'isochronic tones', 'ambient generator', 'focus sounds', 'alpha theta delta', 'meditation sounds'],
    icon: AudioLines,
    summary: 'Generate binaural & isochronic tones with a noise bed',
    load: () => import('@/islands/media/AmbientGenerator'),
    status: 'beta'
  },
  {
    id: 'metronome',
    name: 'Metronome',
    category: 'Media',
    route: '/tools/metronome',
    keywords: ['metronome', 'bpm', 'tempo', 'beat', 'tap tempo', 'time signature', 'practice music'],
    icon: Music4,
    summary: 'A precise metronome with tap tempo & time signatures',
    load: () => import('@/islands/media/Metronome'),
    status: 'beta'
  },
  {
    id: 'tuner',
    name: 'Instrument Tuner',
    category: 'Media',
    route: '/tools/tuner',
    keywords: ['tuner', 'guitar tuner', 'instrument tuner', 'chromatic tuner', 'pitch detector', 'ukulele tuner', 'violin tuner'],
    icon: Gauge,
    summary: 'Tune guitar, ukulele or voice with pitch & cents readout',
    load: () => import('@/islands/media/Tuner'),
    status: 'beta'
  },
  {
    id: 'device-test',
    name: 'Device Test',
    category: 'Testers',
    route: '/tools/device-test',
    keywords: ['device test', 'pre-call check', 'mic camera speaker test', 'test my devices', 'video call check'],
    icon: ListChecks,
    summary: 'Check your mic, camera, speakers, keyboard, mouse & screen',
    load: () => import('@/islands/testers/DeviceTest'),
    status: 'beta'
  },
  {
    id: 'mic-test',
    name: 'Microphone Test',
    category: 'Testers',
    route: '/tools/mic-test',
    keywords: ['mic test', 'microphone test', 'test my mic', 'audio input', 'is my mic working', 'level meter'],
    icon: Mic,
    summary: 'Test your mic with a live waveform, meter and playback',
    load: () => import('@/islands/testers/MicTest'),
    status: 'beta'
  },
  {
    id: 'webcam-test',
    name: 'Webcam Test',
    category: 'Testers',
    route: '/tools/webcam-test',
    keywords: ['webcam test', 'camera test', 'test my camera', 'is my webcam working', 'video preview'],
    icon: Webcam,
    summary: 'Check your webcam picture, framing and resolution',
    load: () => import('@/islands/testers/WebcamTest'),
    status: 'beta'
  },
  {
    id: 'speaker-test',
    name: 'Speaker Test',
    category: 'Testers',
    route: '/tools/speaker-test',
    keywords: ['speaker test', 'headphone test', 'left right channel test', 'audio test', 'stereo test', 'tone generator'],
    icon: Volume2,
    summary: 'Test speakers/headphones — L/R channels, tones & sweep',
    load: () => import('@/islands/testers/SpeakerTest'),
    status: 'beta'
  },
  {
    id: 'keyboard-test',
    name: 'Keyboard Test',
    category: 'Testers',
    route: '/tools/keyboard-test',
    keywords: ['keyboard test', 'key tester', 'dead key', 'stuck key', 'is my keyboard working', 'key press test'],
    icon: Keyboard,
    summary: 'Find a dead or stuck key on a visual keyboard layout',
    load: () => import('@/islands/testers/KeyboardTest'),
    status: 'beta'
  },
  {
    id: 'mouse-test',
    name: 'Mouse Test',
    category: 'Testers',
    route: '/tools/mouse-test',
    keywords: ['mouse test', 'click test', 'double click test', 'double click drift', 'scroll test', 'button test'],
    icon: MousePointerClick,
    summary: 'Test mouse buttons, scroll & double-click drift',
    load: () => import('@/islands/testers/MouseTest'),
    status: 'beta'
  },
  {
    id: 'screen-test',
    name: 'Dead Pixel Test',
    category: 'Testers',
    route: '/tools/screen-test',
    keywords: ['dead pixel test', 'screen test', 'stuck pixel', 'monitor test', 'display test', 'backlight bleed'],
    icon: Monitor,
    summary: 'Fullscreen colour cycler to spot dead or stuck pixels',
    load: () => import('@/islands/testers/ScreenTest'),
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
    id: 'pptx-to-pdf',
    name: 'PPTX to PDF',
    category: 'Documents',
    route: '/tools/pptx-to-pdf',
    keywords: ['pptx to pdf', 'powerpoint to pdf', 'ppt to pdf', 'convert', 'slides to pdf', 'presentation', 'pptx ke pdf'],
    icon: FileOutput,
    summary: 'Convert PowerPoint slides (.pptx) to a PDF',
    load: () => import('@/islands/documents/PptxToPdf'),
    status: 'beta'
  },
  {
    id: 'doc-viewer',
    name: 'Legacy .doc Viewer',
    category: 'Documents',
    route: '/tools/doc-viewer',
    keywords: ['doc', 'word 97', 'legacy doc', 'old word', 'open doc', 'binary doc', 'msword', 'buka doc', 'word lama'],
    icon: FileText,
    summary: 'Open and read old Word .doc (pre-2007 binary) files',
    load: () => import('@/islands/documents/DocViewer'),
    status: 'beta'
  },
  {
    id: 'gedcom-viewer',
    name: 'GEDCOM Viewer',
    category: 'Documents',
    route: '/tools/gedcom-viewer',
    keywords: ['gedcom', 'ged', 'family tree', 'genealogy', 'ancestry', 'silsilah', 'keluarga', 'family history'],
    icon: Users,
    summary: 'Open and browse a GEDCOM family-tree file privately',
    load: () => import('@/islands/documents/GedcomViewer'),
    status: 'beta'
  },
  {
    id: 'eml-viewer',
    name: 'EML Email Viewer',
    category: 'Documents',
    route: '/tools/eml-viewer',
    keywords: ['eml', 'email viewer', 'open eml', 'outlook', 'message', 'rfc822', 'mail', 'buka eml', 'baca email'],
    icon: MailOpen,
    summary: 'Open and read .eml email files with attachments',
    load: () => import('@/islands/documents/EmlViewer'),
    status: 'beta'
  },
  {
    id: 'dicom-viewer',
    name: 'DICOM Viewer',
    category: 'Documents',
    route: '/tools/dicom-viewer',
    keywords: ['dicom', 'dcm', 'medical image', 'mri', 'ct scan', 'xray', 'x-ray', 'radiology', 'viewer', 'citra medis'],
    icon: Activity,
    summary: 'View DICOM medical images (.dcm) with window/level',
    load: () => import('@/islands/documents/DicomViewer'),
    status: 'beta'
  },
  {
    id: 'iwork-viewer',
    name: 'iWork Viewer (Pages/Numbers/Keynote)',
    category: 'Documents',
    route: '/tools/iwork-viewer',
    keywords: ['iwork', 'pages', 'numbers', 'keynote', 'apple', 'open pages', 'mac document', 'buka pages', 'viewer'],
    icon: FileType2,
    summary: 'Open Apple Pages, Numbers & Keynote files on any device',
    load: () => import('@/islands/documents/IWorkViewer'),
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
    id: 'slugify',
    name: 'Slugify',
    category: 'Dev',
    route: '/tools/slugify',
    keywords: ['slugify', 'slug', 'url slug', 'permalink', 'seo slug', 'kebab', 'url friendly', 'text to slug'],
    icon: Link,
    summary: 'Turn any text or title into a clean, URL-safe slug',
    load: () => import('@/islands/dev/Slugify'),
    status: 'beta'
  },
  {
    id: 'http-status',
    name: 'HTTP Status Codes',
    category: 'Dev',
    route: '/tools/http-status',
    keywords: ['http status code', '404', '422', '500', '301', 'status code lookup', 'response code', 'rest api'],
    icon: ServerCog,
    summary: 'Look up any HTTP status code — number, class or name',
    load: () => import('@/islands/dev/HttpStatus'),
    status: 'beta'
  },
  {
    id: 'mime-lookup',
    name: 'MIME Type Lookup',
    category: 'Dev',
    route: '/tools/mime-lookup',
    keywords: ['mime type', 'content type', 'media type', 'file extension', 'mime lookup', 'application/json', 'image/png'],
    icon: FileType2,
    summary: 'Find the MIME type for a file extension (and vice versa)',
    load: () => import('@/islands/dev/MimeLookup'),
    status: 'beta'
  },
  {
    id: 'lorem-ipsum',
    name: 'Lorem Ipsum Generator',
    category: 'Dev',
    route: '/tools/lorem-ipsum',
    keywords: ['lorem ipsum', 'placeholder text', 'dummy text', 'filler text', 'paragraphs', 'mockup text', 'lipsum'],
    icon: Pilcrow,
    summary: 'Generate placeholder Lorem Ipsum by paragraph, sentence or word',
    load: () => import('@/islands/dev/LoremIpsum'),
    status: 'beta'
  },
  {
    id: 'browser-info',
    name: 'What Is My Browser',
    category: 'Dev',
    route: '/tools/browser-info',
    keywords: ['my user agent', 'what is my browser', 'screen size', 'viewport size', 'browser info', 'my resolution', 'device info'],
    icon: MonitorSmartphone,
    summary: 'See your user agent, browser, screen & viewport size and more',
    load: () => import('@/islands/dev/BrowserInfo'),
    status: 'beta'
  },
  {
    id: 'emoji-picker',
    name: 'Emoji & Symbol Picker',
    category: 'Dev',
    route: '/tools/emoji-picker',
    keywords: ['emoji picker', 'special characters', 'symbols', 'em dash', 'degree symbol', 'copy emoji', 'unicode', 'currency symbols'],
    icon: Smile,
    summary: 'Search and copy emoji & special characters (—, °, ±, €, ⌘)',
    load: () => import('@/islands/dev/EmojiPicker'),
    status: 'beta'
  },
  {
    id: 'roman-numerals',
    name: 'Roman Numeral Converter',
    category: 'Calculators',
    route: '/tools/roman-numerals',
    keywords: ['roman numerals', 'roman numeral converter', 'number to roman', 'roman to number', 'MMXXVI', 'date in roman'],
    icon: Landmark,
    summary: 'Convert numbers to Roman numerals and back (1–3999)',
    load: () => import('@/islands/calculators/RomanNumeral'),
    status: 'beta'
  },
  {
    id: 'percentage-calculator',
    name: 'Percentage Calculator',
    category: 'Calculators',
    route: '/tools/percentage-calculator',
    keywords: ['percentage calculator', 'tip calculator', 'discount calculator', 'percent off', 'percent change', 'split the bill'],
    icon: Percent,
    summary: 'Percentages, tips and discounts — split a bill, % off & change',
    load: () => import('@/islands/calculators/PercentageCalc'),
    status: 'beta'
  },
  {
    id: 'countdown',
    name: 'Countdown Timer',
    category: 'Calculators',
    route: '/tools/countdown',
    keywords: ['countdown', 'days until', 'days until date', 'countdown timer', 'deadline', 'time until', 'date difference'],
    icon: Hourglass,
    summary: 'Count down to a date — days, hours, minutes & seconds left',
    load: () => import('@/islands/calculators/Countdown'),
    status: 'beta'
  },
  {
    id: 'timezone-converter',
    name: 'Time Zone Converter',
    category: 'Calculators',
    route: '/tools/timezone-converter',
    keywords: ['timezone converter', 'time zone converter', 'meeting planner', 'world clock', 'time difference', 'convert time'],
    icon: Globe,
    summary: 'Convert times across zones & plan meetings across regions',
    load: () => import('@/islands/calculators/TimezoneConverter'),
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
    id: 'emergency-medical-card',
    name: 'Emergency Medical Card',
    category: 'Files',
    route: '/tools/emergency-medical-card',
    keywords: ['emergency', 'medical card', 'ice', 'in case of emergency', 'allergies', 'blood type', 'medical id', 'kartu medis', 'darurat', 'qr'],
    icon: HeartPulse,
    summary: 'Make a printable emergency medical card with a QR code',
    load: () => import('@/islands/dev/EmergencyCard'),
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
    id: 'unit-converter',
    name: 'Unit Converter',
    category: 'Calculators',
    route: '/tools/unit-converter',
    keywords: ['unit converter', 'convert units', 'length', 'weight', 'temperature', 'celsius fahrenheit', 'km to miles', 'kg to lb', 'konversi satuan', 'metric imperial'],
    icon: Ruler,
    summary: 'Convert length, mass, temperature, volume, speed and more',
    load: () => import('@/islands/calculators/UnitConverter'),
    status: 'beta'
  },
  {
    id: 'pomodoro-timer',
    name: 'Pomodoro Timer',
    category: 'Calculators',
    route: '/tools/pomodoro-timer',
    keywords: ['pomodoro', 'timer', 'focus timer', 'productivity', 'countdown', 'study timer', 'work break', 'timer pomodoro', 'fokus'],
    icon: Timer,
    summary: 'A configurable Pomodoro focus timer with breaks',
    load: () => import('@/islands/calculators/TimerPomodoro'),
    status: 'beta'
  },
  {
    id: 'typing-test',
    name: 'Typing Speed Test',
    category: 'Calculators',
    route: '/tools/typing-test',
    keywords: ['typing test', 'typing speed', 'wpm', 'words per minute', 'typing accuracy', 'tes mengetik', 'kecepatan mengetik', 'keyboard'],
    icon: Gauge,
    summary: 'Measure your typing speed (WPM) and accuracy',
    load: () => import('@/islands/calculators/TypingTest'),
    status: 'beta'
  },
  {
    id: 'kpr-calculator',
    name: 'KPR / Mortgage Calculator',
    category: 'Calculators',
    route: '/tools/kpr-calculator',
    keywords: ['kpr', 'mortgage', 'cicilan', 'home loan', 'kalkulator kpr', 'angsuran', 'amortization', 'installment', 'bunga', 'pinjaman'],
    icon: Home,
    summary: 'Calculate monthly home-loan installments and amortisation',
    load: () => import('@/islands/calculators/KprCalculator'),
    status: 'beta'
  },
  {
    id: 'zakat-calculator',
    name: 'Zakat Calculator',
    category: 'Calculators',
    route: '/tools/zakat-calculator',
    keywords: ['zakat', 'kalkulator zakat', 'zakat maal', 'zakat penghasilan', 'nisab', 'kalkulator zakat mal', 'sedekah', 'islam'],
    icon: HeartHandshake,
    summary: 'Calculate zakat maal and zakat penghasilan (2.5%)',
    load: () => import('@/islands/calculators/ZakatCalculator'),
    status: 'beta'
  },
  {
    id: 'thr-calculator',
    name: 'THR Calculator',
    category: 'Calculators',
    route: '/tools/thr-calculator',
    keywords: ['thr', 'tunjangan hari raya', 'kalkulator thr', 'holiday allowance', 'thr proporsional', 'gaji', 'karyawan', 'lebaran'],
    icon: Gift,
    summary: 'Calculate THR (holiday allowance), full or prorated',
    load: () => import('@/islands/calculators/ThrCalculator'),
    status: 'beta'
  },
  {
    id: 'wheel-spinner',
    name: 'Wheel Spinner / Random Picker',
    category: 'Games',
    route: '/tools/wheel-spinner',
    keywords: ['wheel', 'spinner', 'random picker', 'wheel of names', 'random name', 'giveaway', 'decision', 'roda putar', 'undian', 'pemilih acak'],
    icon: Disc3,
    summary: 'Spin a wheel to pick a name or option at random',
    load: () => import('@/islands/games/WheelSpinner'),
    status: 'beta'
  },
  {
    id: '2048',
    name: '2048 Game',
    category: 'Games',
    route: '/tools/2048',
    keywords: ['2048', 'game', 'puzzle', 'tiles', 'merge', 'number game', 'cheat', 'auto solve', 'main 2048'],
    icon: Grid3x3,
    summary: 'Play 2048 with undo and an auto-play cheat',
    load: () => import('@/islands/games/Game2048'),
    status: 'beta'
  },
  {
    id: 'flappy-bird',
    name: 'Flying Bird Game',
    category: 'Games',
    route: '/tools/flappy-bird',
    keywords: ['flappy bird', 'flying bird', 'game', 'arcade', 'tap game', 'burung terbang', 'game burung'],
    icon: Bird,
    summary: 'A flappy-bird style arcade game — tap to fly through the gaps',
    load: () => import('@/islands/games/FlappyBird'),
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
    id: 'pdf-redact',
    name: 'Redact PDF',
    category: 'PDF',
    route: '/tools/pdf-redact',
    keywords: ['redact pdf', 'redaction', 'black out', 'remove text', 'hide sensitive', 'censor pdf', 'sensor pdf', 'blackout', 'privacy'],
    icon: Highlighter,
    summary: 'Permanently remove sensitive text and images from a PDF',
    load: () => import('@/islands/pdf/PdfRedact'),
    status: 'beta'
  },
  {
    id: 'pdf-scrub-metadata',
    name: 'PDF Metadata Scrubber',
    category: 'PDF',
    route: '/tools/pdf-scrub-metadata',
    keywords: ['pdf metadata', 'remove metadata', 'scrub metadata', 'author', 'strip metadata', 'xmp', 'privacy', 'clean pdf', 'metadata pdf'],
    icon: Tags,
    summary: 'Remove hidden author, dates and XMP metadata from a PDF',
    load: () => import('@/islands/pdf/PdfScrubMetadata'),
    status: 'beta'
  },
  {
    id: 'pdf-to-excel',
    name: 'PDF to Excel (CSV)',
    category: 'PDF',
    route: '/tools/pdf-to-excel',
    keywords: ['pdf to excel', 'pdf to csv', 'extract table', 'pdf table', 'spreadsheet', 'convert', 'pdf ke excel', 'tabel pdf'],
    icon: FileSpreadsheet,
    summary: 'Extract PDF tables and text into a CSV for Excel (best effort)',
    load: () => import('@/islands/pdf/PdfToExcel'),
    status: 'beta'
  },
  {
    id: 'pdf-booklet',
    name: 'PDF Booklet Imposition',
    category: 'PDF',
    route: '/tools/pdf-booklet',
    keywords: ['booklet', 'imposition', 'saddle stitch', 'zine', 'print booklet', 'fold', '2-up', 'signature', 'buku lipat'],
    icon: BookCopy,
    summary: 'Rearrange PDF pages to print and fold into a booklet',
    load: () => import('@/islands/pdf/BookletImposition'),
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
    id: 'barcode-generator',
    name: 'Barcode Generator',
    category: 'Dev',
    route: '/tools/barcode-generator',
    keywords: ['barcode', 'code 128', 'ean', 'ean13', 'upc', 'code 39', 'itf', 'generate barcode', 'buat barcode'],
    icon: Barcode,
    summary: 'Generate Code 128, EAN, UPC and other barcodes as PNG/SVG',
    load: () => import('@/islands/image/BarcodeGenerator'),
    status: 'beta'
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
    id: 'contrast-checker',
    name: 'WCAG Contrast Checker',
    category: 'Dev',
    route: '/tools/contrast-checker',
    keywords: ['contrast', 'wcag', 'accessibility', 'a11y', 'color contrast', 'aa', 'aaa', 'contrast ratio', 'kontras', 'aksesibilitas'],
    icon: Accessibility,
    summary: 'Check text/background colour contrast against WCAG AA & AAA',
    load: () => import('@/islands/dev/ContrastChecker'),
    status: 'beta'
  },
  {
    id: 'braille-converter',
    name: 'Braille Converter',
    category: 'Dev',
    route: '/tools/braille-converter',
    keywords: ['braille', 'braille converter', 'text to braille', 'grade 1', 'unicode braille', 'accessibility', 'huruf braille'],
    icon: Grip,
    summary: 'Convert text to Grade 1 Unicode braille',
    load: () => import('@/islands/dev/BrailleConverter'),
    status: 'beta'
  },
  {
    id: 'url-cleaner',
    name: 'URL Tracking Stripper',
    category: 'Dev',
    route: '/tools/url-cleaner',
    keywords: ['url', 'tracking', 'utm', 'fbclid', 'gclid', 'clean url', 'remove tracking', 'strip parameters', 'privacy', 'share link'],
    icon: Link2Off,
    summary: 'Remove utm_, fbclid, gclid and other tracking parameters from links',
    load: () => import('@/islands/dev/UrlStripper'),
    status: 'beta'
  },
  {
    id: 'invoice-generator',
    name: 'Invoice Generator',
    category: 'Dev',
    route: '/tools/invoice-generator',
    keywords: ['invoice', 'invoice generator', 'faktur', 'kwitansi', 'billing', 'tax', 'ppn', 'receipt', 'buat invoice', 'pdf invoice'],
    icon: FileText,
    summary: 'Create a printable invoice with tax (PPN) and save as PDF',
    load: () => import('@/islands/dev/InvoiceGenerator'),
    status: 'beta'
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
    id: 'meme-generator',
    name: 'Meme Generator',
    category: 'Image',
    route: '/tools/meme-generator',
    keywords: ['meme', 'meme generator', 'caption', 'top text', 'bottom text', 'impact', 'buat meme', 'image macro'],
    icon: Sticker,
    summary: 'Add classic top/bottom captions to an image',
    load: () => import('@/islands/image/MemeGenerator'),
    status: 'beta'
  },
  {
    id: 'color-blindness-sim',
    name: 'Color Blindness Simulator',
    category: 'Image',
    route: '/tools/color-blindness-sim',
    keywords: ['color blindness', 'colour blind', 'protanopia', 'deuteranopia', 'tritanopia', 'accessibility', 'a11y', 'cvd', 'simulator', 'buta warna'],
    icon: Glasses,
    summary: 'Preview an image as seen with colour-vision deficiencies',
    load: () => import('@/islands/image/ColorBlindSim'),
    status: 'beta'
  },
  {
    id: 'scan-deskew',
    name: 'Scan Deskew & Crop',
    category: 'Image',
    route: '/tools/scan-deskew',
    keywords: ['deskew', 'perspective', 'crop', 'straighten', 'document scan', 'scanner', 'auto crop', 'luruskan', 'pindai dokumen'],
    icon: Scan,
    summary: 'Straighten and crop a photo of a document (perspective fix)',
    load: () => import('@/islands/image/DeskewTool'),
    status: 'beta'
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
    id: 'text-to-speech',
    name: 'Text to Speech',
    category: 'Media',
    route: '/tools/text-to-speech',
    keywords: ['text to speech', 'tts', 'read aloud', 'speak text', 'voice', 'narrate', 'teks ke suara', 'baca teks', 'speech synthesis'],
    icon: Speech,
    summary: 'Read text aloud with your browser’s built-in voices',
    load: () => import('@/islands/media/TextToSpeech'),
    status: 'beta'
  },
  {
    id: 'live-captions',
    name: 'Live Captions',
    category: 'Media',
    route: '/tools/live-captions',
    keywords: ['live captions', 'captions', 'subtitles', 'speech to text', 'accessibility', 'hard of hearing', 'teks langsung', 'transkrip langsung'],
    icon: Subtitles,
    summary: 'Large live captions of spoken speech (uses browser speech recognition)',
    load: () => import('@/islands/media/LiveCaptions'),
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
