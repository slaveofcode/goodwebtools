# GoodWebTools.com - Phase 0: Foundation Design

**Date:** 2026-07-12  
**Phase:** 0 (Foundation)  
**Status:** Design Approved  
**Next Phases:** 1-8 (Sequential implementation after Phase 0 validation)

---

## Executive Summary

Phase 0 establishes the architectural foundation for GoodWebTools.com - a privacy-first, client-side utility suite. This phase delivers:

- **Astro + React + Tailwind** static site with View Transitions
- **Layered services architecture** for maximum code reuse across 50+ planned tools
- **Command palette with fuzzy search** (⌘K/Ctrl+K) - instant tool discovery across all tools
- **Full PWA support** with offline capability (the privacy proof)
- **Cloudflare Pages deployment** with cross-origin isolation headers
- **Hash File demo tool** to validate the complete pipeline
- **Performance budget:** <120KB gzipped initial shell

All subsequent phases (1-8) build on this foundation, adding tools incrementally while maintaining the core architecture.

---

## 1. Project Structure & Architecture

### Directory Layout

```
gwt/
├── src/
│   ├── pages/                    # Astro routes (static HTML)
│   │   ├── index.astro          # Homepage with tool grid
│   │   ├── privacy.astro        # Privacy/verification page
│   │   └── tools/
│   │       └── [tool].astro     # Dynamic route per tool
│   ├── layouts/
│   │   └── Base.astro           # Root layout: <head>, ViewTransitions, shell slot
│   ├── components/
│   │   ├── shell/               # Shell components (persisted)
│   │   │   ├── ShellIsland.tsx  # Nav + command palette + theme toggle
│   │   │   ├── CommandPalette.tsx
│   │   │   └── ThemeToggle.tsx
│   │   └── ui/                  # Reusable UI components
│   │       ├── Dropzone.tsx
│   │       ├── ProgressBar.tsx
│   │       ├── FileList.tsx
│   │       └── ResultActions.tsx
│   ├── islands/                 # Per-tool React islands (lazy loaded)
│   │   └── demo/
│   │       └── HashDemo.tsx     # Validation tool island
│   ├── tools/                   # Pure logic (framework-agnostic)
│   │   └── demo/
│   │       ├── hash.lib.ts      # Hash logic
│   │       └── hash.worker.ts   # Worker entry
│   ├── services/                # Shared singleton services
│   │   ├── file.service.ts      # FileService
│   │   ├── worker.service.ts    # WorkerPool
│   │   ├── asset.service.ts     # AssetCache
│   │   ├── download.service.ts  # DownloadService
│   │   ├── progress.service.ts  # Progress/Toast
│   │   └── persistence.service.ts  # PersistenceService (auto-save, unsaved work guard)
│   ├── registry/                # Tool registry
│   │   ├── tools.ts             # Tool manifest (ToolDef[])
│   │   └── categories.ts        # Category definitions
│   ├── hooks/                   # React hooks
│   │   ├── useWorker.ts         # Worker integration hook
│   │   └── usePersistence.ts    # Persistence & unsaved work guard hook
│   └── styles/
│       └── global.css           # Tailwind imports + base styles
├── public/
│   ├── wasm/                    # Self-hosted WASM binaries
│   ├── icon-192.png             # PWA icons
│   ├── icon-512.png
│   └── manifest.json            # PWA manifest
├── _headers                     # Cloudflare: COOP/COEP/CSP
├── astro.config.mjs
├── tailwind.config.mjs
├── tsconfig.json
└── package.json
```

### Architectural Principles

1. **Pages are dumb** - Astro pages just mount islands, no logic
2. **Islands are views** - React islands handle UI and call services
3. **Tools are pure** - Logic in `/tools` is framework-agnostic, testable
4. **Services are singletons** - One WorkerPool, one AssetCache, etc.
5. **Registry drives everything** - Single manifest for routes, nav, search, lazy loading

---

## 2. Tool Registry System

The tool registry (`src/registry/tools.ts`) is the heart of the system - a typed manifest that drives navigation, routing, search, and lazy loading.

### ToolDef Interface

```typescript
interface ToolDef {
  id: string;                 // 'hash-demo'
  name: string;               // 'Hash File'
  category: Category;         // 'Dev' | 'PDF' | 'Image' | 'Files' | 'Draw' | 'Media'
  route: string;              // '/tools/hash-demo'
  keywords: string[];         // For command palette search
  icon: LucideIcon;          // From lucide-react
  summary: string;           // Short description
  load: () => Promise<{      // Dynamic import for code splitting
    default: React.ComponentType
  }>;
  needsIsolation?: boolean;  // Requires COOP/COEP (for Phase 7)
  assets?: AssetRef[];       // WASM/model URLs + sizes
  status: 'stable' | 'beta' | 'experimental';
}

interface AssetRef {
  url: string;
  byteSize: number;          // Size in bytes
  type: 'wasm' | 'model' | 'font' | 'image' | 'other';
  description: string;
}
```

### Example Registry Entry

```typescript
const hashDemo: ToolDef = {
  id: 'hash-demo',
  name: 'Hash File',
  category: 'Dev',
  route: '/tools/hash-demo',
  keywords: ['hash', 'sha256', 'checksum', 'demo'],
  icon: Hash,
  summary: 'Generate SHA-256 hash (validation demo)',
  load: () => import('@/islands/demo/HashDemo'),
  status: 'experimental'
};
```

### How It's Used

1. **Dynamic routing** - `[tool].astro` looks up the tool by route, loads its island
2. **Universal search (Command Palette)** - Fuzzy search across `name`, `keywords`, `summary`, and `category`
3. **Homepage grid** - Groups tools by `category`, displays `icon` + `name` + `summary`
4. **Lazy loading** - `load()` only called when tool page is accessed
5. **Asset prefetch** - Optional: prefetch hints for `assets` when hovering tool card

### Search Functionality

**The registry powers instant, client-side search via the command palette (⌘K/Ctrl+K):**

**Search algorithm:**
```typescript
function searchTools(query: string, tools: ToolDef[]): ToolDef[] {
  const lowerQuery = query.toLowerCase();
  
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
  
  // Exact name match (highest priority)
  if (tool.name.toLowerCase().includes(query)) score += 100;
  
  // Keyword match
  if (tool.keywords.some(k => k.toLowerCase().includes(query))) score += 50;
  
  // Summary match
  if (tool.summary.toLowerCase().includes(query)) score += 30;
  
  // Category match
  if (tool.category.toLowerCase().includes(query)) score += 20;
  
  // Fuzzy match bonus (for typos)
  score += fuzzyMatch(query, tool.name.toLowerCase());
  
  return score;
}
```

**Search features:**
- **Instant results** - All tools indexed in memory, no backend calls
- **Fuzzy matching** - Handles typos and partial matches
- **Ranked results** - Most relevant tools shown first
- **Keyboard shortcuts:**
  - `⌘K` or `Ctrl+K` - Open search palette
  - `Escape` - Close palette
  - `↑↓` - Navigate results
  - `Enter` - Open selected tool
  - `Tab` - Cycle through categories

**Example searches:**
- `"pdf"` → Shows all PDF tools (merge, split, compress, etc.)
- `"hash"` → Shows Hash File demo
- `"image compress"` → Shows image compressor
- `"sha256"` → Matches Hash File via keywords

---

## 3. Shared Services Architecture

Six core singleton services that all tools share.

### 1. FileService

Normalizes file input across multiple sources.

**API:**
```typescript
class FileService {
  // Get files from any input source
  async getFiles(source: FileSource): Promise<File[]>
  
  // For large files: get streaming handle
  async getFileHandle(file: File): Promise<FileSystemFileHandle | null>
  
  // OPFS scratch space for large file operations
  async createTempFile(name: string): Promise<FileSystemFileHandle>
  async cleanupTempFiles(): Promise<void>
}
```

**Supported sources:**
- Drag & drop onto Dropzone
- `<input type="file">` click
- Clipboard paste (images, text)
- File System Access API (when available)

### 2. WorkerPool

Manages worker lifecycle across tools.

**API:**
```typescript
class WorkerPool {
  // Get or create worker for a tool
  async getWorker<T>(toolId: string, workerUrl: string): Promise<Remote<T>>
  
  // Terminate worker (called on route change)
  terminateWorker(toolId: string): void
  
  // Cleanup all workers
  terminateAll(): void
}
```

**Behavior:**
- Spin up worker on tool open
- Terminate on route-away to free memory
- Cap concurrent workers by `navigator.hardwareConcurrency`
- Comlink RPC for ergonomic worker communication

### 3. AssetCache

Fetch-once, cache-forever for WASM/models with expiration.

**API:**
```typescript
class AssetCache {
  private readonly DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
  private readonly PROGRESS_THRESHOLD_BYTES = 1_024_000; // 1 MB
  
  // Fetch asset, return cached bytes if available
  async fetch(url: string, options?: {
    integrity?: string;     // SRI hash
    maxAgeMs?: number;      // TTL in milliseconds
    onProgress?: (loadedBytes: number, totalBytes: number) => void;
    showProgress?: boolean; // Auto-detect if > 1MB
  }): Promise<ArrayBuffer>
  
  // Check cache status without fetching
  async isCached(url: string): Promise<boolean>
}
```

**Features:**
- Cache API for WASM binaries
- IndexedDB for large ML models
- SRI hash verification
- Progress events for downloads > 1MB
- Auto-show progress bar for assets > 1MB
- Expiration tracking with timestamps

### 4. DownloadService

Unified download handling.

**API:**
```typescript
class DownloadService {
  // Trigger download (uses File System Access if available)
  async download(blob: Blob, filename: string): Promise<void>
  
  // Batch download (zip multiple files)
  async downloadZip(files: BlobFile[], zipName: string): Promise<void>
}
```

**Behavior:**
- File System Access API for "Save As" dialog (when available)
- Fallback to `<a download>` blob URL

### 5. Progress/Toast

Unified progress bars and notifications.

**API:**
```typescript
class ProgressService {
  // Show progress bar
  startProgress(id: string, label: string): void
  updateProgress(id: string, percent: number): void
  completeProgress(id: string): void
  
  // Show toast
  toast(message: string, type: 'success' | 'error' | 'info'): void
}
```

### 6. PersistenceService

Data persistence and unsaved work protection for stateful tools (Excalidraw, diagrams, editors).

**API:**
```typescript
class PersistenceService {
  // Auto-save to IndexedDB (for drafts)
  async autoSave(toolId: string, data: any): Promise<void>
  async loadAutoSave(toolId: string): Promise<any | null>
  async clearAutoSave(toolId: string): Promise<void>
  
  // Save to user's disk (File System Access API)
  async saveToFile(data: Blob, suggestedName: string, fileHandle?: FileSystemFileHandle): Promise<FileSystemFileHandle | null>
  async loadFromFile(accept?: string[]): Promise<{ data: ArrayBuffer; handle: FileSystemFileHandle } | null>
  
  // Track unsaved changes
  markDirty(toolId: string): void
  markClean(toolId: string): void
  isDirty(toolId: string): boolean
  
  // Confirm before navigation if dirty
  enableNavigationGuard(toolId: string): void
  disableNavigationGuard(toolId: string): void
}
```

**Features:**

1. **Auto-save to IndexedDB:**
   - Periodic auto-save every 30 seconds (configurable)
   - Per-tool storage with toolId as key
   - Automatic on tool mount/unmount
   - "Draft recovered" notification on reload

2. **Save to disk (File System Access API):**
   - "Save" button uses File System Access API when available
   - Keeps file handle for quick re-save (no dialog)
   - "Save As" to pick new location
   - Fallback to download blob if API unavailable
   - Suggested file extensions per tool (`.excalidraw`, `.json`, etc.)

3. **Unsaved work protection:**
   - Track dirty state per tool
   - Browser `beforeunload` event warning: "You have unsaved work. Leave anyway?"
   - Astro View Transitions navigation guard (same warning)
   - Toast reminder: "Don't forget to save your work"
   - Clear dirty flag after successful save

**Implementation:**

```typescript
// Example: Excalidraw tool integration
export default function ExcalidrawTool() {
  const [elements, setElements] = useState([]);
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);
  const persistence = usePersistence('excalidraw');
  
  // Load auto-save on mount
  useEffect(() => {
    const loadDraft = async () => {
      const draft = await persistence.loadAutoSave();
      if (draft) {
        setElements(draft.elements);
        toast('Draft recovered', 'info');
      }
    };
    loadDraft();
  }, []);
  
  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (elements.length > 0) {
        persistence.autoSave({ elements });
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [elements]);
  
  // Track changes
  const handleChange = (newElements: any[]) => {
    setElements(newElements);
    persistence.markDirty();
  };
  
  // Save to file
  const handleSave = async () => {
    const blob = new Blob([JSON.stringify({ elements })], { type: 'application/json' });
    const handle = await persistence.saveToFile(blob, 'drawing.excalidraw', fileHandle);
    if (handle) {
      setFileHandle(handle);
      persistence.markClean();
      toast('Saved successfully', 'success');
    }
  };
  
  // Load from file
  const handleLoad = async () => {
    const result = await persistence.loadFromFile(['.excalidraw', '.json']);
    if (result) {
      const data = JSON.parse(new TextDecoder().decode(result.data));
      setElements(data.elements);
      setFileHandle(result.handle);
      persistence.markClean();
    }
  };
  
  // Enable navigation guard
  useEffect(() => {
    persistence.enableNavigationGuard();
    return () => persistence.disableNavigationGuard();
  }, []);
  
  return (
    <div>
      <div className="toolbar">
        <button onClick={handleLoad}>Open</button>
        <button onClick={handleSave}>Save</button>
        <button onClick={() => handleSave()}>Save As</button>
      </div>
      <Excalidraw elements={elements} onChange={handleChange} />
    </div>
  );
}
```

**Navigation guard implementation:**

```typescript
// Browser beforeunload
window.addEventListener('beforeunload', (e) => {
  if (persistenceService.isDirty('excalidraw')) {
    e.preventDefault();
    e.returnValue = ''; // Modern browsers show generic message
  }
});

// Astro View Transitions guard
document.addEventListener('astro:before-swap', (e) => {
  if (persistenceService.isDirty('excalidraw')) {
    const confirmed = confirm('You have unsaved work. Leave anyway?');
    if (!confirmed) {
      e.preventDefault();
    }
  }
});
```

**Tools that use PersistenceService:**
- Excalidraw/whiteboard (Phase 6)
- Diagram/flowchart tools (Phase 6)
- Multi-cursor text editor (Phase 1)
- Markdown editor (Phase 1)
- HTML playground (Phase 1)
- Any tool with stateful editing

---

## 4. Shell, Navigation & Theme

### Persisted Shell Island

The shell (`src/components/shell/ShellIsland.tsx`) survives page navigation via Astro's `transition:persist`.

**Components:**

1. **Top navigation bar:**
   - Logo/site name (links to home)
   - Theme toggle (light/dark)
   - Search button with ⌘K shortcut hint (triggers command palette)

2. **Command Palette - Universal Tool Search** (via `cmdk`):
   - **Keyboard shortcut:** ⌘K (Mac) / Ctrl+K (Windows/Linux)
   - **Fuzzy search** across all available tools:
     - Searches tool `name` (e.g., "PDF Merge")
     - Searches `keywords` (e.g., "hash", "checksum", "sha256")
     - Searches `summary` descriptions
     - Searches `category` (e.g., "PDF", "Image", "Dev")
   - **Keyboard-first navigation:**
     - Arrow keys to navigate results
     - Enter to open selected tool
     - Escape to close palette
     - Tab to cycle through categories
   - **Results display:**
     - Tool icon (from lucide-react)
     - Tool name (highlighted matching text)
     - Category badge
     - Short summary
   - **Instant results** - no latency, all tools indexed client-side
   - **Accessible** - ARIA labels, screen reader support

3. **Global state** (via Nanostores):
   - Current theme ('light' | 'dark')
   - Worker status (for progress indicators)
   - Search history (recent tools, optional)
   - Persisted to localStorage

### Theme System

**Configuration:**
- Manual toggle only (no auto system preference)
- Tailwind dark mode via `class` strategy: `<html class="dark">`
- Theme stored in localStorage, applied on load to prevent flash
- Smooth transition via CSS transitions on theme change

**Tailwind configuration:**
```javascript
// tailwind.config.mjs
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        border: 'var(--border)',
        muted: 'var(--muted)',
        accent: 'var(--accent)',
      }
    }
  }
}
```

**CSS variables (minimal/clean palette):**
```css
:root {
  --background: 255 255 255;     /* White */
  --foreground: 23 23 23;        /* Near black */
  --border: 229 229 229;         /* Light gray */
  --muted: 250 250 250;          /* Subtle gray */
  --accent: 37 99 235;           /* Blue accent */
}

.dark {
  --background: 10 10 10;        /* Near black */
  --foreground: 250 250 250;     /* Off white */
  --border: 38 38 38;            /* Dark gray */
  --muted: 23 23 23;             /* Subtle dark */
  --accent: 96 165 250;          /* Lighter blue */
}
```

### Navigation Flow

1. User clicks tool card or uses ⌘K → navigate to `/tools/hash-demo`
2. Astro View Transition animates page change
3. Shell persists (no re-mount), tool island loads
4. WorkerPool spins up worker for that tool
5. On route-away, worker terminates to free memory

---

## 5. Worker Pipeline & Validation Tool

### Worker Architecture

Every tool follows the pattern: Island → Comlink → Worker → Logic → Results

**Standard worker setup:**

```typescript
// src/tools/demo/hash.worker.ts
import { expose } from 'comlink';

const api = {
  async hashFile(
    fileBuffer: ArrayBuffer,
    onProgress: (percent: number) => void
  ): Promise<string> {
    // Use WebCrypto
    const hashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer);
    
    // Report progress
    onProgress(100);
    
    // Return hex string
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
};

export type HashWorkerAPI = typeof api;
expose(api);
```

**Island using the worker:**

```typescript
// src/islands/demo/HashDemo.tsx
import { useState } from 'react';
import { proxy } from 'comlink';
import { useWorker } from '@/hooks/useWorker';
import type { HashWorkerAPI } from '@/tools/demo/hash.worker';

export default function HashDemo() {
  const [hash, setHash] = useState('');
  const [progress, setProgress] = useState(0);
  
  const workerApi = useWorker<HashWorkerAPI>(
    'hash-demo',
    new URL('@/tools/demo/hash.worker.ts', import.meta.url)
  );
  
  const handleFile = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const result = await workerApi.hashFile(
      buffer,
      proxy((pct) => setProgress(pct))
    );
    setHash(result);
  };
  
  return (
    <Dropzone onDrop={handleFile}>
      {hash && <div>SHA-256: {hash}</div>}
      {progress > 0 && <ProgressBar percent={progress} />}
    </Dropzone>
  );
}
```

**useWorker Hook:**

```typescript
// src/hooks/useWorker.ts
import { useEffect, useRef } from 'react';
import { wrap, Remote } from 'comlink';
import { workerPool } from '@/services/worker.service';

export function useWorker<T>(toolId: string, workerUrl: URL): Remote<T> {
  const workerRef = useRef<Remote<T>>();
  
  useEffect(() => {
    workerRef.current = workerPool.getWorker<T>(toolId, workerUrl.href);
    
    return () => {
      workerPool.terminateWorker(toolId);
    };
  }, [toolId, workerUrl]);
  
  return workerRef.current!;
}
```

### Validation Tool: Hash File Demo

**Purpose:** Prove the entire pipeline works before building real tools in Phase 1.

**Features:**
- **Input:** Drag & drop any file
- **Process:** Calculate SHA-256 hash in worker using WebCrypto
- **Output:** Display hex hash, show download button to save `.txt` with hash

**Validates:**
- Island → Worker communication (Comlink)
- FileService integration (Dropzone)
- Worker lifecycle (spin up, terminate on route-away)
- DownloadService (save hash as text file)
- Progress reporting
- Cross-origin isolation headers (needed for future SharedArrayBuffer)

**Ships as a real tool** - useful for checksum verification.

---

## 6. PWA & Offline Strategy

### Configuration

Using `@vite-pwa/astro` + Workbox for full PWA support.

```typescript
// astro.config.mjs (PWA integration)
VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: 'GoodWebTools',
    short_name: 'GWT',
    description: 'Privacy-first client-side utilities',
    theme_color: '#2563eb',
    background_color: '#ffffff',
    display: 'standalone',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
    ]
  },
  workbox: {
    // See caching strategy below
  }
})
```

### Caching Strategy - All Assets Expire

| Asset Type | Strategy | TTL | Rationale |
|------------|----------|-----|-----------|
| WASM binaries | NetworkFirst | 30 days | Check for updates, critical for security |
| ML models | NetworkFirst | 30 days | Large downloads, but need bug fixes |
| Tool islands (JS) | StaleWhileRevalidate | 7 days | Code updates, serve fast then refresh |
| CSS/Fonts | StaleWhileRevalidate | 14 days | Rarely change, but need updates |
| Icons/Images | CacheFirst | 30 days | Static assets |

**Workbox configuration:**

```javascript
workbox: {
  globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
  cleanupOutdatedCaches: true,
  
  runtimeCaching: [
    // WASM binaries - 30 days
    {
      urlPattern: /\.wasm$/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'wasm-cache',
        networkTimeoutSeconds: 5,
        expiration: {
          maxEntries: 20,
          maxAgeSeconds: 30 * 24 * 60 * 60,
          purgeOnQuotaError: true
        }
      }
    },
    
    // ML models - 30 days
    {
      urlPattern: /\.(onnx|tflite)$/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'model-cache',
        networkTimeoutSeconds: 10,
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 30 * 24 * 60 * 60,
          purgeOnQuotaError: true
        }
      }
    },
    
    // Tool chunks - 7 days
    {
      urlPattern: /\/islands\/.+\.js$/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'tool-chunks',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 7 * 24 * 60 * 60,
          purgeOnQuotaError: true
        }
      }
    },
    
    // Fonts/CSS - 14 days
    {
      urlPattern: /\.(woff2|css)$/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-assets',
        expiration: {
          maxEntries: 30,
          maxAgeSeconds: 14 * 24 * 60 * 60,
          purgeOnQuotaError: true
        }
      }
    },
    
    // Images - 30 days
    {
      urlPattern: /\.(png|svg|jpg|jpeg|webp)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'images',
        expiration: {
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60,
          purgeOnQuotaError: true
        }
      }
    }
  ]
}
```

### Cache Management Features

1. **Auto-cleanup:**
   - `cleanupOutdatedCaches: true` removes old service worker caches
   - `purgeOnQuotaError: true` clears LRU entries if storage quota exceeded
   - Expired entries automatically purged by Workbox

2. **Manual controls (Settings page):**
   - "Clear all caches" button
   - "Check for updates" button
   - Show cache size and age per category

3. **Update notifications:**
   - Service worker detects new version
   - Toast: "Update available - refresh to get the latest version"

### Asset Download Progress

**For assets > 1MB, show progress bar:**

```typescript
// AssetCache with progress
async fetch(url: string, options?: {
  integrity?: string;
  maxAgeMs?: number;
  onProgress?: (loadedBytes: number, totalBytes: number) => void;
  showProgress?: boolean; // Auto-detect if > 1MB
}): Promise<ArrayBuffer> {
  const response = await fetch(url);
  const totalBytes = parseInt(response.headers.get('content-length') || '0');
  
  // Auto-show progress for files > 1MB
  const shouldShowProgress = options?.showProgress ?? (totalBytes > this.PROGRESS_THRESHOLD_BYTES);
  
  if (!shouldShowProgress || !response.body) {
    return await response.arrayBuffer();
  }
  
  // Stream with progress
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loadedBytes = 0;
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    chunks.push(value);
    loadedBytes += value.length;
    options?.onProgress?.(loadedBytes, totalBytes);
  }
  
  // Concatenate chunks
  const data = new Uint8Array(loadedBytes);
  let offsetBytes = 0;
  for (const chunk of chunks) {
    data.set(chunk, offsetBytes);
    offsetBytes += chunk.length;
  }
  
  return data.buffer;
}
```

**Progress UI example:**

```typescript
if (modelStatus === 'loading') {
  const percentComplete = (downloadProgress.loadedBytes / downloadProgress.totalBytes) * 100;
  const loadedMB = (downloadProgress.loadedBytes / 1024 / 1024).toFixed(1);
  const totalMB = (downloadProgress.totalBytes / 1024 / 1024).toFixed(1);
  
  return (
    <div className="flex flex-col items-center gap-4 p-8">
      <Loader className="animate-spin" />
      <div className="text-center">
        <p className="font-medium">Downloading model...</p>
        <p className="text-sm text-muted-foreground">
          {loadedMB} MB / {totalMB} MB ({percentComplete.toFixed(0)}%)
        </p>
      </div>
      <ProgressBar percent={percentComplete} />
      <p className="text-xs text-muted-foreground">
        This download happens once and is cached for 30 days
      </p>
    </div>
  );
}
```

---

## 7. Build, Deployment & Performance

### Astro Configuration

```javascript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import { VitePWA } from '@vite-pwa/astro';

export default defineConfig({
  output: 'static',
  
  integrations: [
    react(),
    tailwind(),
    VitePWA({ /* PWA config */ })
  ],
  
  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'worker-vendor': ['comlink'],
            'ui-vendor': ['cmdk', 'lucide-react']
          }
        }
      }
    },
    
    worker: {
      format: 'es',
      plugins: []
    }
  }
});
```

### Cloudflare Pages Deployment

**`_headers` file (critical for cross-origin isolation):**

```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  
  # Cross-Origin Isolation (required for SharedArrayBuffer)
  Cross-Origin-Embedder-Policy: require-corp
  Cross-Origin-Opener-Policy: same-origin
  
  # Strict CSP - only self + wasm/model CDN
  Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self';

/wasm/*
  Cache-Control: public, max-age=31536000, immutable
  Cross-Origin-Resource-Policy: same-origin

/models/*
  Cache-Control: public, max-age=2592000
  Cross-Origin-Resource-Policy: same-origin
```

**GitHub Actions CI/CD:**

```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run build
      
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: goodwebtools
          directory: dist
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}
```

### Performance Budget

| Metric | Target | How We Achieve It |
|--------|--------|-------------------|
| Initial shell JS | < 120KB gzipped | Manual chunks, tree-shaking, lazy islands |
| Initial shell CSS | < 20KB gzipped | Tailwind purge, minimal custom CSS |
| First Contentful Paint | < 1.5s | Static HTML, minimal JS, preload fonts |
| Time to Interactive | < 2.5s | Defer non-critical JS, no blocking scripts |
| Lighthouse Performance | > 95 | Static site, optimized assets, lazy loading |
| Tool island load | < 50KB per tool | Code splitting, dynamic imports |
| WASM binary size | Varies by tool | Show size + download estimate before loading |

**Bundle analysis:**
- Run `vite-bundle-visualizer` on each build
- Fail CI if shell exceeds 150KB gzipped
- Track bundle size trends over time

**Performance monitoring:**
- Lighthouse CI on every PR
- Real user metrics via web-vitals (client-side only)
- Performance budget enforced in CI

---

## 8. Development Environment

### VS Code Setup

**Extensions (`.vscode/extensions.json`):**
```json
{
  "recommendations": [
    "astro-build.astro-vscode",
    "bradlc.vscode-tailwindcss",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

**Settings (`.vscode/settings.json`):**
```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "tailwindCSS.experimental.classRegex": [
    ["clsx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ],
  "files.associations": {
    "*.astro": "astro"
  },
  "[astro]": {
    "editor.defaultFormatter": "astro-build.astro-vscode"
  }
}
```

### TypeScript Configuration

```json
// tsconfig.json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },
    "resolveJsonModule": true,
    "allowJs": true,
    "noEmit": true
  }
}
```

### Package.json Scripts

```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "lint": "eslint src --ext .ts,.tsx,.astro",
    "lint:fix": "eslint src --ext .ts,.tsx,.astro --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx,astro,css}\"",
    "type-check": "tsc --noEmit",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "analyze": "astro build && vite-bundle-visualizer",
    "lighthouse": "lhci autorun"
  }
}
```

### Development Workflows

#### Adding a New Tool

1. **Register** in `src/registry/tools.ts`
2. **Create island** in `src/islands/category/NewTool.tsx`
3. **Create worker** in `src/tools/category/newtool.worker.ts`
4. **Add pure logic** (optional) in `src/tools/category/newtool.lib.ts`
5. **Write tests** in `src/tools/category/newtool.test.ts`
6. **Test locally** with `npm run dev`
7. **Commit** with conventional commit message

#### Fixing Bugs

1. **Reproduce** the bug locally
2. **Locate** the bug (island, worker, service)
3. **Write failing test** (TDD)
4. **Fix** with minimal changes
5. **Verify** with tests, lint, type-check, build
6. **Commit** with descriptive message

#### Improvements

**Performance:**
- Analyze bundle size
- Use dynamic imports for heavy libs
- Stream large files

**UX:**
- Add loading states
- Better error messages
- Accessibility improvements

**Features:**
- Add new options to worker API
- Add UI controls
- Document changes

#### Quality Checklist

Before committing:
- [ ] Code runs without errors
- [ ] Tests pass
- [ ] Type-check passes
- [ ] Lint passes
- [ ] Build succeeds
- [ ] Manual testing with samples
- [ ] No memory leaks
- [ ] Bundle size acceptable
- [ ] Keyboard navigation works
- [ ] Error handling robust
- [ ] Loading states clear
- [ ] Messages user-friendly

---

## 9. Privacy & Verifiability

### Privacy Guarantees

1. **No egress** - Strict CSP `connect-src 'self'` (users can verify in DevTools)
2. **Offline capable** - PWA works with network off (strongest proof)
3. **Open source** - Public GitHub repo (at launch)
4. **Reproducible builds** - Clone, build, diff against production
5. **Footer commit link** - Shows exact deployed commit
6. **SRI hashes** - All remote assets integrity-checked

### Privacy Page

Document on `/privacy`:
- "Verify it yourself" walkthrough
- DevTools Network tab guide
- Offline mode instructions
- Link to GitHub repo
- Reproducible build notes

---

## 10. Deployment Plan

### Phase 0 Deliverables

1. **Astro project** with all integrations configured
2. **Shared services** implemented and tested
3. **Tool registry** system working
4. **Persisted shell** with command palette and theme
5. **Hash File demo tool** fully functional
6. **PWA** configured with service worker
7. **Cloudflare Pages** deployment with headers
8. **CI/CD pipeline** via GitHub Actions
9. **Documentation** (README, CONTRIBUTING, architecture docs)
10. **Performance budget** verified (<120KB shell)

### Success Criteria

- [ ] Shell loads < 1.5s (FCP)
- [ ] Hash tool works offline after first use
- [ ] Command palette searches tools
- [ ] Theme toggle persists across navigation
- [ ] Worker terminates on route-away
- [ ] Progress bar shows for >1MB downloads
- [ ] Lighthouse score > 95
- [ ] Build passes CI checks
- [ ] PWA installable
- [ ] Privacy page renders correctly

### Next Steps After Phase 0

Once Phase 0 is validated:
1. **Review** - Verify architecture works, gather feedback
2. **Phase 1** - Dev/Office utilities (pure JS tools)
3. **Continuous** - Build Phases 2-8 sequentially

---

## Appendix A: Key Dependencies

```json
{
  "dependencies": {
    "astro": "^4.0.0",
    "@astrojs/react": "^3.0.0",
    "@astrojs/tailwind": "^5.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "tailwindcss": "^3.4.0",
    "@vite-pwa/astro": "^0.2.0",
    "comlink": "^4.4.1",
    "cmdk": "^0.2.0",
    "lucide-react": "^0.294.0",
    "nanostores": "^0.9.5",
    "@nanostores/react": "^0.7.1"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.1.0",
    "eslint": "^8.55.0",
    "prettier": "^3.1.0",
    "prettier-plugin-astro": "^0.12.0",
    "prettier-plugin-tailwindcss": "^0.5.0",
    "@cloudflare/pages-action": "^1.0.0"
  }
}
```

---

## Appendix B: Design Decisions

### Architectural Choices

| Decision | Option Chosen | Rationale |
|----------|--------------|-----------|
| Meta-framework | Astro (static) | Islands architecture, zero JS by default, per-page splitting |
| UI library | React 18 | Ecosystem fit (Excalidraw, Monaco), component maturity |
| Routing | Astro View Transitions + persist | True MPA, minimal JS, shell persists |
| Styling | Tailwind CSS | Fast, consistent, tree-shaken, lightweight |
| State | Nanostores | Minimal, framework-agnostic, perfect for shell state |
| Command palette | cmdk | Battle-tested (Linear, Raycast), great a11y |
| PWA | @vite-pwa/astro | Astro-native, Workbox integration |
| Hosting | Cloudflare Pages | Static, free, headers support, R2 integration |
| Theme | Light + Dark (manual) | Simpler than auto, user control |
| Repository | Private → Public | Develop privately, open source at launch |

### Performance Decisions

- Manual chunk splitting for vendors
- Lazy island loading per route
- Progress bars for assets > 1MB
- Service worker caching with expiration
- Build-time bundle analysis
- CI performance budget enforcement

---

**End of Phase 0 Design Document**

*This design is approved and ready for implementation planning.*
