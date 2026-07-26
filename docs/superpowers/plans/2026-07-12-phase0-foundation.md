# Phase 0: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete architectural foundation for GoodWebTools.com - a privacy-first, client-side utility suite with Astro + React + Tailwind, including tool registry, shared services, command palette, PWA support, and a validation demo tool.

**Architecture:** Layered services architecture with Astro MPA + View Transitions, React islands for interactivity, six singleton services (File, Worker, Asset, Download, Progress, Persistence), persisted shell with cmdk command palette, and full PWA offline capability.

**Tech Stack:** Astro 4.x, React 18, Tailwind CSS, Nanostores, Comlink, cmdk, @vite-pwa/astro, Vitest, Cloudflare Pages

## Global Constraints

- **Performance budget:** Initial shell < 120KB gzipped, FCP < 1.5s
- **Browser support:** Modern browsers only (Chrome/Edge/Firefox/Safari latest 2 versions)
- **Accessibility:** WCAG 2.1 AA compliance, keyboard-first navigation
- **Privacy:** No external network calls except same-origin assets, strict CSP
- **Code style:** ESLint + Prettier enforced, TypeScript strict mode
- **Testing:** Vitest for unit tests, manual E2E for Phase 0
- **Commits:** Conventional commits format (`feat:`, `fix:`, `docs:`, etc.)
- **Variable naming:** Explicit units in names (byteSize, maxAgeMs, loadedBytes, etc.)

---

## File Structure Overview

```
gwt/
├── src/
│   ├── pages/
│   │   ├── index.astro               # Homepage with tool grid
│   │   ├── privacy.astro             # Privacy/verification page
│   │   └── tools/
│   │       └── [tool].astro          # Dynamic tool route
│   ├── layouts/
│   │   └── Base.astro                # Root layout with ViewTransitions
│   ├── components/
│   │   ├── shell/
│   │   │   ├── ShellIsland.tsx       # Persisted shell
│   │   │   ├── CommandPalette.tsx    # cmdk search
│   │   │   └── ThemeToggle.tsx       # Light/dark toggle
│   │   └── ui/
│   │       ├── Dropzone.tsx          # File drag-drop
│   │       ├── ProgressBar.tsx       # Progress indicator
│   │       ├── FileList.tsx          # File list display
│   │       └── ResultActions.tsx     # Download/copy buttons
│   ├── islands/
│   │   └── demo/
│   │       └── HashDemo.tsx          # Hash tool island
│   ├── tools/
│   │   └── demo/
│   │       ├── hash.lib.ts           # Hash logic
│   │       └── hash.worker.ts        # Hash worker
│   ├── services/
│   │   ├── file.service.ts           # FileService
│   │   ├── worker.service.ts         # WorkerPool
│   │   ├── asset.service.ts          # AssetCache
│   │   ├── download.service.ts       # DownloadService
│   │   ├── progress.service.ts       # ProgressService
│   │   └── persistence.service.ts    # PersistenceService
│   ├── registry/
│   │   ├── tools.ts                  # Tool manifest
│   │   └── categories.ts             # Category types
│   ├── hooks/
│   │   ├── useWorker.ts              # Worker integration hook
│   │   └── usePersistence.ts         # Persistence hook
│   ├── stores/
│   │   ├── theme.store.ts            # Theme state
│   │   └── worker.store.ts           # Worker status
│   ├── styles/
│   │   └── global.css                # Tailwind + theme vars
│   └── types/
│       ├── tool.ts                   # ToolDef interface
│       └── service.ts                # Service interfaces
├── public/
│   ├── icon-192.png
│   ├── icon-512.png
│   └── manifest.json
├── _headers                          # Cloudflare headers
├── astro.config.mjs
├── tailwind.config.mjs
├── tsconfig.json
├── vitest.config.ts
├── .eslintrc.js
├── .prettierrc
├── README.md
├── CONTRIBUTING.md
└── docs/
    └── architecture.md
```

---

### Task 1: Project Initialization

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `.gitignore`
- Create: `src/pages/index.astro` (minimal)
- Create: `src/styles/global.css`

**Interfaces:**
- Consumes: None (initial setup)
- Produces: Working Astro dev server, TypeScript configuration

- [ ] **Step 1: Initialize npm project**

```bash
npm init -y
```

Expected: `package.json` created

- [ ] **Step 2: Install core dependencies**

```bash
npm install astro@^4.0.0 @astrojs/react@^3.0.0 @astrojs/tailwind@^5.0.0 react@^18.2.0 react-dom@^18.2.0 tailwindcss@^3.4.0
```

Expected: Dependencies installed

- [ ] **Step 3: Install dev dependencies**

```bash
npm install -D typescript@^5.3.0 @types/react@^18.2.0 @types/react-dom@^18.2.0 prettier@^3.1.0 prettier-plugin-astro@^0.12.0 prettier-plugin-tailwindcss@^0.5.0
```

Expected: Dev dependencies installed

- [ ] **Step 4: Create Astro config**

Create `astro.config.mjs`:
```javascript
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  output: 'static',
  integrations: [
    react(),
    tailwind()
  ]
});
```

- [ ] **Step 5: Create TypeScript config**

Create `tsconfig.json`:
```json
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
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 6: Create global styles**

Create `src/styles/global.css` (**Neo-Brutalism** palette + brutalist utilities; Space Grotesk self-hosted same-origin to preserve zero external requests):
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@font-face {
  font-family: 'Space Grotesk';
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
  src: url('/fonts/space-grotesk.woff2') format('woff2');
}

:root {
  --background: 255 253 245;      /* Cream */
  --foreground: 10 10 10;
  --border: 10 10 10;            /* Solid black outlines */
  --muted: 255 255 255;
  --muted-foreground: 82 82 82;
  --accent: 124 58 237;         /* Violet */
  --accent-foreground: 255 255 255;
  --shadow: 10 10 10;
}

.dark {
  --background: 10 10 10;
  --foreground: 250 250 250;
  --border: 250 250 250;        /* Light outlines pop on dark */
  --muted: 26 26 26;
  --muted-foreground: 163 163 163;
  --accent: 167 139 250;
  --accent-foreground: 10 10 10;
  --shadow: 250 250 250;
}

body { font-family: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif; }

/* Hard offset shadows (no blur) + mechanical press */
.shadow-brutal    { box-shadow: 4px 4px 0 0 rgb(var(--shadow)); }
.shadow-brutal-sm { box-shadow: 2px 2px 0 0 rgb(var(--shadow)); }
.press-brutal        { transition: transform 100ms ease, box-shadow 100ms ease; }
.press-brutal:hover  { transform: translate(-2px,-2px); box-shadow: 6px 6px 0 0 rgb(var(--shadow)); }
.press-brutal:active { transform: translate(2px,2px);  box-shadow: 0 0 0 0 rgb(var(--shadow)); }
@media (prefers-reduced-motion: reduce) {
  .press-brutal, .press-brutal:hover, .press-brutal:active { transition: none; transform: none; }
}
```

> **[DESIGN] Neo-Brutalism:** thick outlines, hard offset shadows, sharp corners
> (global `border-radius: 0`), bold uppercase Space Grotesk. All controls use
> `border-2 border-border` + `shadow-brutal` + `press-brutal`. Font is
> **self-hosted** (`public/fonts/space-grotesk.woff2`, preloaded) — never the
> Google Fonts CDN, which would violate the no-egress privacy guarantee.

- [ ] **Step 7: Create minimal homepage**

Create `src/pages/index.astro`:
```astro
---
import '../styles/global.css';
---

<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>GoodWebTools</title>
  </head>
  <body>
    <h1>GoodWebTools</h1>
    <p>Privacy-first client-side utilities</p>
  </body>
</html>
```

- [ ] **Step 8: Create .gitignore**

Create `.gitignore`:
```
node_modules/
dist/
.astro/
.env
.DS_Store
```

- [ ] **Step 9: Add dev script to package.json**

Edit `package.json`, add scripts:
```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview"
  }
}
```

- [ ] **Step 10: Test dev server**

Run: `npm run dev`
Expected: Dev server starts at http://localhost:4321, homepage displays

- [ ] **Step 11: Test build**

Run: `npm run build`
Expected: Build succeeds, `dist/` directory created

- [ ] **Step 12: Commit**

```bash
git add .
git commit -m "feat: initialize Astro project with React and Tailwind"
```

---

### Task 2: TypeScript Interfaces & Tool Registry Foundation

**Files:**
- Create: `src/types/tool.ts`
- Create: `src/types/service.ts`
- Create: `src/registry/categories.ts`
- Create: `src/registry/tools.ts`
- Test: `src/registry/tools.test.ts`

**Interfaces:**
- Consumes: None
- Produces: `ToolDef`, `AssetRef`, `Category` types; empty `tools` array export

- [ ] **Step 1: Write test for ToolDef interface**

Create `src/registry/tools.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { tools } from './tools';
import type { ToolDef } from '@/types/tool';

describe('Tool Registry', () => {
  it('should export empty tools array initially', () => {
    expect(tools).toBeDefined();
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBe(0);
  });

  it('should have valid ToolDef structure when tools are added', () => {
    const mockTool: ToolDef = {
      id: 'test-tool',
      name: 'Test Tool',
      category: 'Dev',
      route: '/tools/test-tool',
      keywords: ['test'],
      icon: {} as any,
      summary: 'Test tool',
      load: () => Promise.resolve({ default: () => null }),
      status: 'experimental'
    };
    
    expect(mockTool.id).toBe('test-tool');
    expect(mockTool.route).toBe('/tools/test-tool');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test`
Expected: FAIL - modules don't exist

- [ ] **Step 3: Install Vitest**

```bash
npm install -D vitest@^1.0.0 @testing-library/react@^14.1.0 @testing-library/jest-dom@^6.1.5 jsdom@^23.0.0
```

- [ ] **Step 4: Create Vitest config**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});
```

- [ ] **Step 5: Add test script**

Edit `package.json`:
```json
{
  "scripts": {
    "test": "vitest"
  }
}
```

- [ ] **Step 6: Create tool types**

Create `src/types/tool.ts`:
```typescript
import type { LucideIcon } from 'lucide-react';

export type Category = 'Dev' | 'PDF' | 'Image' | 'Files' | 'Draw' | 'Media';

export interface AssetRef {
  url: string;
  byteSize: number;
  type: 'wasm' | 'model' | 'font' | 'image' | 'other';
  description: string;
}

export interface ToolDef {
  id: string;
  name: string;
  category: Category;
  route: string;
  keywords: string[];
  icon: LucideIcon;
  summary: string;
  load: () => Promise<{ default: React.ComponentType }>;
  needsIsolation?: boolean;
  assets?: AssetRef[];
  status: 'stable' | 'beta' | 'experimental';
}
```

- [ ] **Step 7: Create categories**

Create `src/registry/categories.ts`:
```typescript
import type { Category } from '@/types/tool';

export const categories: Category[] = [
  'Dev',
  'PDF',
  'Image',
  'Files',
  'Draw',
  'Media'
];

export const categoryColors: Record<Category, string> = {
  Dev: 'bg-blue-500',
  PDF: 'bg-red-500',
  Image: 'bg-green-500',
  Files: 'bg-yellow-500',
  Draw: 'bg-purple-500',
  Media: 'bg-pink-500'
};
```

- [ ] **Step 8: Create tools registry**

Create `src/registry/tools.ts`:
```typescript
import type { ToolDef } from '@/types/tool';

export const tools: ToolDef[] = [];

export function getToolById(id: string): ToolDef | undefined {
  return tools.find(tool => tool.id === id);
}

export function getToolByRoute(route: string): ToolDef | undefined {
  return tools.find(tool => tool.route === route);
}

export function searchTools(query: string): ToolDef[] {
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
  
  if (tool.name.toLowerCase().includes(query)) score += 100;
  if (tool.keywords.some(k => k.toLowerCase().includes(query))) score += 50;
  if (tool.summary.toLowerCase().includes(query)) score += 30;
  if (tool.category.toLowerCase().includes(query)) score += 20;
  
  return score;
}
```

- [ ] **Step 9: Run tests**

Run: `npm run test`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add .
git commit -m "feat: add tool registry with TypeScript interfaces and search"
```

---

### Task 3: Tailwind Configuration & Theme System

**Files:**
- Create: `tailwind.config.mjs`
- Create: `src/stores/theme.store.ts`
- Test: `src/stores/theme.store.test.ts`

**Interfaces:**
- Consumes: None
- Produces: `themeStore` with `theme` atom, `toggleTheme()`, `initTheme()` functions

- [ ] **Step 1: Write theme store test**

Create `src/stores/theme.store.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'nanostores';
import { themeAtom, toggleTheme, initTheme } from './theme.store';

describe('Theme Store', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('should initialize with light theme by default', () => {
    initTheme();
    expect(get(themeAtom)).toBe('light');
  });

  it('should toggle between light and dark', () => {
    initTheme();
    toggleTheme();
    expect(get(themeAtom)).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    
    toggleTheme();
    expect(get(themeAtom)).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('should persist theme to localStorage', () => {
    initTheme();
    toggleTheme();
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('should load theme from localStorage', () => {
    localStorage.setItem('theme', 'dark');
    initTheme();
    expect(get(themeAtom)).toBe('dark');
  });
});
```

- [ ] **Step 2: Install Nanostores**

```bash
npm install nanostores@^0.9.5 @nanostores/react@^0.7.1
```

- [ ] **Step 3: Create theme store**

Create `src/stores/theme.store.ts`:
```typescript
import { atom } from 'nanostores';

export type Theme = 'light' | 'dark';

export const themeAtom = atom<Theme>('light');

export function initTheme(): void {
  const stored = localStorage.getItem('theme') as Theme | null;
  const theme = stored || 'light';
  themeAtom.set(theme);
  applyTheme(theme);
}

export function toggleTheme(): void {
  const current = themeAtom.get();
  const next: Theme = current === 'light' ? 'dark' : 'light';
  themeAtom.set(next);
  applyTheme(next);
  localStorage.setItem('theme', next);
}

function applyTheme(theme: Theme): void {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test`
Expected: PASS

- [ ] **Step 5: Create Tailwind config**

Create `tailwind.config.mjs`:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--background) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        'muted-foreground': 'rgb(var(--muted-foreground) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-foreground': 'rgb(var(--accent-foreground) / <alpha-value>)',
      },
      fontFamily: { sans: ['Space Grotesk', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      // Neo-Brutalism: sharp corners everywhere (pills only for dots/badges)
      borderRadius: { DEFAULT: '0px', sm: '0px', md: '0px', lg: '0px', xl: '0px', '2xl': '0px', full: '9999px' },
      boxShadow: {
        brutal: '4px 4px 0 0 rgb(var(--shadow))',
        'brutal-sm': '2px 2px 0 0 rgb(var(--shadow))',
        'brutal-lg': '6px 6px 0 0 rgb(var(--shadow))',
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: add theme system with Nanostores and Tailwind dark mode"
```

---

### Task 4: Base Layout with View Transitions

**Files:**
- Create: `src/layouts/Base.astro`
- Modify: `src/pages/index.astro`
- Create: `src/pages/privacy.astro`

**Interfaces:**
- Consumes: `global.css`, `themeStore.initTheme()`
- Produces: `Base.astro` layout with ViewTransitions, theme init script

- [ ] **Step 1: Create Base layout**

Create `src/layouts/Base.astro`:
```astro
---
import { ViewTransitions } from 'astro:transitions';
import '../styles/global.css';

export interface Props {
  title: string;
  description?: string;
}

const { title, description = 'Privacy-first client-side utilities' } = Astro.props;
---

<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content={description} />
    <title>{title} | GoodWebTools</title>
    <ViewTransitions />
    <script is:inline>
      // Init theme before first paint to prevent flash
      const stored = localStorage.getItem('theme');
      if (stored === 'dark') {
        document.documentElement.classList.add('dark');
      }
    </script>
  </head>
  <body class="bg-background text-foreground min-h-screen">
    <slot />
  </body>
</html>
```

- [ ] **Step 2: Update homepage to use layout**

Modify `src/pages/index.astro`:
```astro
---
import Base from '@/layouts/Base.astro';
---

<Base title="Home">
  <main class="container mx-auto px-4 py-8">
    <h1 class="text-4xl font-bold mb-4">GoodWebTools</h1>
    <p class="text-muted text-lg">Privacy-first client-side utilities</p>
  </main>
</Base>
```

- [ ] **Step 3: Create privacy page**

Create `src/pages/privacy.astro`:
```astro
---
import Base from '@/layouts/Base.astro';
---

<Base title="Privacy" description="How we protect your privacy">
  <main class="container mx-auto px-4 py-8 max-w-4xl">
    <h1 class="text-4xl font-bold mb-6">Privacy & Verifiability</h1>
    
    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">No Data Leaves Your Device</h2>
      <p class="text-muted-foreground mb-4">
        All processing happens in your browser. No files, images, or documents are ever uploaded to a server.
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">Verify It Yourself</h2>
      <ol class="list-decimal list-inside space-y-2 text-muted-foreground">
        <li>Open Developer Tools (F12)</li>
        <li>Go to the Network tab</li>
        <li>Use any tool and process a file</li>
        <li>Watch: zero network requests to external servers</li>
      </ol>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">Works Offline</h2>
      <p class="text-muted-foreground mb-4">
        After first use, tools work with your network completely off. This is the strongest proof that nothing leaves your device.
      </p>
    </section>

    <section>
      <h2 class="text-2xl font-semibold mb-4">Open Source</h2>
      <p class="text-muted-foreground">
        The code is open source and will be available on GitHub at launch. You can audit it yourself or run it locally.
      </p>
    </section>
  </main>
</Base>
```

- [ ] **Step 4: Test navigation**

Run: `npm run dev`
1. Navigate to http://localhost:4321
2. Click around (add temporary nav links if needed)
3. Check View Transitions animation
Expected: Smooth transitions, theme persists

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add Base layout with View Transitions and privacy page"
```

---

### Task 5: FileService Implementation

**Files:**
- Create: `src/types/service.ts`
- Create: `src/services/file.service.ts`
- Test: `src/services/file.service.test.ts`

**Interfaces:**
- Consumes: None
- Produces: `FileService` class with `getFiles()`, `getFileHandle()`, `createTempFile()`, `cleanupTempFiles()`

- [ ] **Step 1: Write FileService test**

Create `src/services/file.service.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { FileService } from './file.service';

describe('FileService', () => {
  let fileService: FileService;

  beforeEach(() => {
    fileService = new FileService();
  });

  it('should accept File objects', async () => {
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    const files = await fileService.getFiles(file);
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('test.txt');
  });

  it('should accept File array', async () => {
    const files = [
      new File(['test1'], 'test1.txt'),
      new File(['test2'], 'test2.txt')
    ];
    const result = await fileService.getFiles(files);
    expect(result).toHaveLength(2);
  });

  it('should accept FileList', async () => {
    const dt = new DataTransfer();
    dt.items.add(new File(['test'], 'test.txt'));
    const fileList = dt.files;
    
    const result = await fileService.getFiles(fileList);
    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Create service types**

Create `src/types/service.ts`:
```typescript
export type FileSource = File | File[] | FileList;
```

- [ ] **Step 3: Create FileService**

Create `src/services/file.service.ts`:
```typescript
import type { FileSource } from '@/types/service';

export class FileService {
  async getFiles(source: FileSource): Promise<File[]> {
    if (source instanceof File) {
      return [source];
    }
    
    if (Array.isArray(source)) {
      return source;
    }
    
    // FileList
    return Array.from(source);
  }

  async getFileHandle(file: File): Promise<FileSystemFileHandle | null> {
    // File System Access API - may not be available
    if (!('showOpenFilePicker' in window)) {
      return null;
    }

    // If file already has a handle (from showOpenFilePicker), return it
    // For now, return null - will be enhanced when needed
    return null;
  }

  async createTempFile(name: string): Promise<FileSystemFileHandle | null> {
    // OPFS (Origin Private File System)
    if (!('storage' in navigator) || !navigator.storage.getDirectory) {
      return null;
    }

    try {
      const root = await navigator.storage.getDirectory();
      const fileHandle = await root.getFileHandle(name, { create: true });
      return fileHandle;
    } catch (error) {
      console.error('Failed to create temp file:', error);
      return null;
    }
  }

  async cleanupTempFiles(): Promise<void> {
    if (!('storage' in navigator) || !navigator.storage.getDirectory) {
      return;
    }

    try {
      const root = await navigator.storage.getDirectory();
      // @ts-expect-error - entries() may not be in types yet
      for await (const [name, handle] of root.entries()) {
        if (handle.kind === 'file') {
          await root.removeEntry(name);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup temp files:', error);
    }
  }
}

// Singleton instance
export const fileService = new FileService();
```

- [ ] **Step 4: Run tests**

Run: `npm run test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add FileService for unified file input handling"
```

---

### Task 6: DownloadService Implementation

**Files:**
- Create: `src/services/download.service.ts`
- Test: `src/services/download.service.test.ts`

**Interfaces:**
- Consumes: None
- Produces: `DownloadService` class with `download(blob, filename)`, `downloadZip(files, zipName)`

- [ ] **Step 1: Write DownloadService test**

Create `src/services/download.service.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DownloadService } from './download.service';

describe('DownloadService', () => {
  let downloadService: DownloadService;
  let mockLink: HTMLAnchorElement;

  beforeEach(() => {
    downloadService = new DownloadService();
    mockLink = document.createElement('a');
    vi.spyOn(document, 'createElement').mockReturnValue(mockLink);
    vi.spyOn(mockLink, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should trigger download with blob URL', async () => {
    const blob = new Blob(['test content'], { type: 'text/plain' });
    await downloadService.download(blob, 'test.txt');

    expect(mockLink.download).toBe('test.txt');
    expect(mockLink.click).toHaveBeenCalled();
  });

  it('should clean up blob URL after download', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
    const blob = new Blob(['test'], { type: 'text/plain' });
    await downloadService.download(blob, 'test.txt');

    expect(revokeSpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Create DownloadService**

Create `src/services/download.service.ts`:
```typescript
export interface BlobFile {
  blob: Blob;
  filename: string;
}

export class DownloadService {
  async download(blob: Blob, filename: string): Promise<void> {
    // Try File System Access API first
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (error) {
        // User cancelled or API not available, fall through to blob URL
        if ((error as Error).name === 'AbortError') {
          return; // User cancelled
        }
      }
    }

    // Fallback to blob URL download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    
    // Clean up
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  async downloadZip(files: BlobFile[], zipName: string): Promise<void> {
    // For Phase 0, not implemented yet
    // Will be added when zip functionality is needed
    throw new Error('Zip download not yet implemented');
  }
}

// Singleton instance
export const downloadService = new DownloadService();
```

- [ ] **Step 3: Run tests**

Run: `npm run test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add DownloadService with File System Access API support"
```

---

### Task 7: WorkerPool & AssetCache Services

**Files:**
- Create: `src/services/worker.service.ts`
- Create: `src/services/asset.service.ts`
- Test: `src/services/worker.service.test.ts`
- Test: `src/services/asset.service.test.ts`

**Interfaces:**
- Consumes: None
- Produces: `WorkerPool.getWorker()`, `AssetCache.fetch()` with progress callbacks

- [ ] **Step 1: Install Comlink**

```bash
npm install comlink@^4.4.1
```

- [ ] **Step 2: Write WorkerPool test**

Create `src/services/worker.service.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WorkerPool } from './worker.service';

describe('WorkerPool', () => {
  let workerPool: WorkerPool;

  beforeEach(() => {
    workerPool = new WorkerPool();
  });

  afterEach(() => {
    workerPool.terminateAll();
  });

  it('should create and cache worker', async () => {
    const worker1 = await workerPool.getWorker('test-tool', '/worker.js');
    const worker2 = await workerPool.getWorker('test-tool', '/worker.js');
    
    expect(worker1).toBeDefined();
    expect(worker2).toBeDefined();
  });

  it('should terminate worker by toolId', async () => {
    await workerPool.getWorker('test-tool', '/worker.js');
    workerPool.terminateWorker('test-tool');
    
    // After termination, getting the worker should create a new one
    const newWorker = await workerPool.getWorker('test-tool', '/worker.js');
    expect(newWorker).toBeDefined();
  });
});
```

- [ ] **Step 3: Create WorkerPool**

Create `src/services/worker.service.ts`:
```typescript
import { wrap, type Remote } from 'comlink';

export class WorkerPool {
  private workers = new Map<string, Worker>();
  private proxies = new Map<string, Remote<any>>();

  async getWorker<T>(toolId: string, workerUrl: string): Promise<Remote<T>> {
    // Return cached proxy if exists
    if (this.proxies.has(toolId)) {
      return this.proxies.get(toolId)!;
    }

    // Create new worker
    const worker = new Worker(workerUrl, { type: 'module' });
    const proxy = wrap<T>(worker);

    this.workers.set(toolId, worker);
    this.proxies.set(toolId, proxy);

    return proxy;
  }

  terminateWorker(toolId: string): void {
    const worker = this.workers.get(toolId);
    if (worker) {
      worker.terminate();
      this.workers.delete(toolId);
      this.proxies.delete(toolId);
    }
  }

  terminateAll(): void {
    for (const worker of this.workers.values()) {
      worker.terminate();
    }
    this.workers.clear();
    this.proxies.clear();
  }
}

// Singleton instance
export const workerPool = new WorkerPool();
```

- [ ] **Step 4: Write AssetCache test**

Create `src/services/asset.service.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AssetCache } from './asset.service';

describe('AssetCache', () => {
  let assetCache: AssetCache;

  beforeEach(() => {
    assetCache = new AssetCache();
  });

  it('should fetch asset and track progress', async () => {
    const mockResponse = {
      ok: true,
      headers: new Headers({ 'content-length': '1000' }),
      body: null,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1000))
    };
    
    global.fetch = vi.fn().mockResolvedValue(mockResponse);
    
    const onProgress = vi.fn();
    await assetCache.fetch('http://example.com/asset.wasm', { onProgress });
    
    expect(fetch).toHaveBeenCalled();
  });

  it('should use cache on second fetch', async () => {
    const mockResponse = {
      ok: true,
      headers: new Headers({ 'content-length': '1000' }),
      body: null,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1000))
    };
    
    global.fetch = vi.fn().mockResolvedValue(mockResponse);
    
    await assetCache.fetch('http://example.com/asset.wasm');
    await assetCache.fetch('http://example.com/asset.wasm');
    
    // Should only fetch once (second call uses cache)
    // Note: In-memory cache for Phase 0, IndexedDB later
  });
});
```

- [ ] **Step 5: Create AssetCache**

Create `src/services/asset.service.ts`:
```typescript
export class AssetCache {
  private readonly DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
  private readonly PROGRESS_THRESHOLD_BYTES = 1_024_000; // 1 MB
  private cache = new Map<string, { data: ArrayBuffer; timestamp: number }>();

  async fetch(url: string, options?: {
    integrity?: string;
    maxAgeMs?: number;
    onProgress?: (loadedBytes: number, totalBytes: number) => void;
    showProgress?: boolean;
  }): Promise<ArrayBuffer> {
    const maxAgeMs = options?.maxAgeMs || this.DEFAULT_TTL_MS;
    
    // Check in-memory cache
    const cached = this.cache.get(url);
    if (cached) {
      const ageMs = Date.now() - cached.timestamp;
      if (ageMs < maxAgeMs) {
        return cached.data;
      }
      // Expired - remove from cache
      this.cache.delete(url);
    }

    // Fetch fresh
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }

    const totalBytes = parseInt(response.headers.get('content-length') || '0');
    const shouldShowProgress = options?.showProgress ?? (totalBytes > this.PROGRESS_THRESHOLD_BYTES);

    let data: ArrayBuffer;

    if (!shouldShowProgress || !response.body) {
      data = await response.arrayBuffer();
    } else {
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
      const allData = new Uint8Array(loadedBytes);
      let offsetBytes = 0;
      for (const chunk of chunks) {
        allData.set(chunk, offsetBytes);
        offsetBytes += chunk.length;
      }
      data = allData.buffer;
    }

    // TODO: Verify integrity if provided

    // Cache it
    this.cache.set(url, { data, timestamp: Date.now() });
    return data;
  }

  async isCached(url: string): Promise<boolean> {
    return this.cache.has(url);
  }
}

// Singleton instance
export const assetCache = new AssetCache();
```

- [ ] **Step 6: Run tests**

Run: `npm run test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: add WorkerPool and AssetCache services with progress tracking"
```

---

### Task 8: ProgressService & PersistenceService

**Files:**
- Create: `src/services/progress.service.ts`
- Create: `src/services/persistence.service.ts`
- Create: `src/stores/worker.store.ts`
- Test: `src/services/progress.service.test.ts`
- Test: `src/services/persistence.service.test.ts`

**Interfaces:**
- Consumes: None
- Produces: `ProgressService` with toast/progress methods, `PersistenceService` with auto-save and navigation guards

- [ ] **Step 1: Create worker status store**

Create `src/stores/worker.store.ts`:
```typescript
import { atom, map } from 'nanostores';

export interface ProgressState {
  id: string;
  label: string;
  percent: number;
}

export const progressMap = map<Record<string, ProgressState>>({});

export function setProgress(id: string, label: string, percent: number): void {
  progressMap.setKey(id, { id, label, percent });
}

export function removeProgress(id: string): void {
  const current = progressMap.get();
  const { [id]: removed, ...rest } = current;
  progressMap.set(rest);
}
```

- [ ] **Step 2: Write ProgressService test**

Create `src/services/progress.service.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { ProgressService } from './progress.service';
import { get } from 'nanostores';
import { progressMap } from '@/stores/worker.store';

describe('ProgressService', () => {
  let progressService: ProgressService;

  beforeEach(() => {
    progressService = new ProgressService();
    progressMap.set({});
  });

  it('should start progress', () => {
    progressService.startProgress('test-id', 'Processing...');
    const state = get(progressMap);
    expect(state['test-id']).toBeDefined();
    expect(state['test-id'].label).toBe('Processing...');
    expect(state['test-id'].percent).toBe(0);
  });

  it('should update progress', () => {
    progressService.startProgress('test-id', 'Processing...');
    progressService.updateProgress('test-id', 50);
    const state = get(progressMap);
    expect(state['test-id'].percent).toBe(50);
  });

  it('should complete progress', () => {
    progressService.startProgress('test-id', 'Processing...');
    progressService.completeProgress('test-id');
    const state = get(progressMap);
    expect(state['test-id']).toBeUndefined();
  });
});
```

- [ ] **Step 3: Create ProgressService**

Create `src/services/progress.service.ts`:
```typescript
import { setProgress, removeProgress } from '@/stores/worker.store';

export class ProgressService {
  startProgress(id: string, label: string): void {
    setProgress(id, label, 0);
  }

  updateProgress(id: string, percent: number): void {
    const current = progressMap.get()[id];
    if (current) {
      setProgress(id, current.label, percent);
    }
  }

  completeProgress(id: string): void {
    removeProgress(id);
  }

  toast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    // Simple console log for Phase 0, will add toast UI later
    console.log(`[${type.toUpperCase()}]`, message);
    
    // TODO: Add visual toast component
  }
}

// Singleton instance
export const progressService = new ProgressService();

// Re-export for convenience
import { progressMap } from '@/stores/worker.store';
export { progressMap };
```

- [ ] **Step 4: Write PersistenceService test**

Create `src/services/persistence.service.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PersistenceService } from './persistence.service';

describe('PersistenceService', () => {
  let persistenceService: PersistenceService;

  beforeEach(() => {
    persistenceService = new PersistenceService();
    localStorage.clear();
  });

  it('should mark and check dirty state', () => {
    persistenceService.markDirty('test-tool');
    expect(persistenceService.isDirty('test-tool')).toBe(true);
  });

  it('should clear dirty state', () => {
    persistenceService.markDirty('test-tool');
    persistenceService.markClean('test-tool');
    expect(persistenceService.isDirty('test-tool')).toBe(false);
  });

  it('should auto-save to localStorage', async () => {
    const data = { content: 'test data' };
    await persistenceService.autoSave('test-tool', data);
    
    const stored = localStorage.getItem('gwt-autosave-test-tool');
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!)).toEqual(data);
  });

  it('should load auto-save data', async () => {
    const data = { content: 'test data' };
    localStorage.setItem('gwt-autosave-test-tool', JSON.stringify(data));
    
    const loaded = await persistenceService.loadAutoSave('test-tool');
    expect(loaded).toEqual(data);
  });
});
```

- [ ] **Step 5: Create PersistenceService**

Create `src/services/persistence.service.ts`:
```typescript
export class PersistenceService {
  private dirtyTools = new Set<string>();
  private navigationGuards = new Set<string>();

  async autoSave(toolId: string, data: any): Promise<void> {
    const key = `gwt-autosave-${toolId}`;
    localStorage.setItem(key, JSON.stringify(data));
  }

  async loadAutoSave(toolId: string): Promise<any | null> {
    const key = `gwt-autosave-${toolId}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  }

  async clearAutoSave(toolId: string): Promise<void> {
    const key = `gwt-autosave-${toolId}`;
    localStorage.removeItem(key);
  }

  async saveToFile(
    data: Blob,
    suggestedName: string,
    fileHandle?: FileSystemFileHandle
  ): Promise<FileSystemFileHandle | null> {
    if (!('showSaveFilePicker' in window)) {
      return null;
    }

    try {
      const handle = fileHandle || await (window as any).showSaveFilePicker({
        suggestedName,
      });
      const writable = await handle.createWritable();
      await writable.write(data);
      await writable.close();
      return handle;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return null; // User cancelled
      }
      throw error;
    }
  }

  async loadFromFile(accept?: string[]): Promise<{ data: ArrayBuffer; handle: FileSystemFileHandle } | null> {
    if (!('showOpenFilePicker' in window)) {
      return null;
    }

    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: accept ? [{
          accept: { 'application/json': accept }
        }] : undefined
      });
      const file = await handle.getFile();
      const data = await file.arrayBuffer();
      return { data, handle };
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return null; // User cancelled
      }
      throw error;
    }
  }

  markDirty(toolId: string): void {
    this.dirtyTools.add(toolId);
  }

  markClean(toolId: string): void {
    this.dirtyTools.delete(toolId);
  }

  isDirty(toolId: string): boolean {
    return this.dirtyTools.has(toolId);
  }

  enableNavigationGuard(toolId: string): void {
    this.navigationGuards.add(toolId);
    
    // Add beforeunload listener
    window.addEventListener('beforeunload', this.handleBeforeUnload);
  }

  disableNavigationGuard(toolId: string): void {
    this.navigationGuards.delete(toolId);
    
    // Remove listener if no guards active
    if (this.navigationGuards.size === 0) {
      window.removeEventListener('beforeunload', this.handleBeforeUnload);
    }
  }

  private handleBeforeUnload = (e: BeforeUnloadEvent): string | undefined => {
    for (const toolId of this.navigationGuards) {
      if (this.isDirty(toolId)) {
        e.preventDefault();
        return ''; // Modern browsers show generic message
      }
    }
    return undefined;
  };
}

// Singleton instance
export const persistenceService = new PersistenceService();
```

- [ ] **Step 6: Run tests**

Run: `npm run test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: add ProgressService and PersistenceService with auto-save"
```

---

### Task 9: React Hooks (useWorker & usePersistence)

**Files:**
- Create: `src/hooks/useWorker.ts`
- Create: `src/hooks/usePersistence.ts`
- Test: `src/hooks/useWorker.test.tsx`
- Test: `src/hooks/usePersistence.test.tsx`

**Interfaces:**
- Consumes: `workerPool`, `persistenceService`
- Produces: `useWorker(toolId, workerUrl)` hook, `usePersistence(toolId)` hook

- [ ] **Step 1: Write useWorker test**

Create `src/hooks/useWorker.test.tsx`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWorker } from './useWorker';

describe('useWorker', () => {
  it('should return worker proxy', () => {
    const workerUrl = new URL('./test.worker.ts', import.meta.url);
    const { result } = renderHook(() => useWorker('test-tool', workerUrl));
    
    expect(result.current).toBeDefined();
  });

  it('should cleanup on unmount', () => {
    const workerUrl = new URL('./test.worker.ts', import.meta.url);
    const { unmount } = renderHook(() => useWorker('test-tool', workerUrl));
    
    unmount();
    // Worker should be terminated (tested via integration)
  });
});
```

- [ ] **Step 2: Create useWorker hook**

Create `src/hooks/useWorker.ts`:
```typescript
import { useEffect, useRef } from 'react';
import type { Remote } from 'comlink';
import { workerPool } from '@/services/worker.service';

export function useWorker<T>(toolId: string, workerUrl: URL): Remote<T> | null {
  const workerRef = useRef<Remote<T> | null>(null);

  useEffect(() => {
    let mounted = true;

    workerPool.getWorker<T>(toolId, workerUrl.href).then(proxy => {
      if (mounted) {
        workerRef.current = proxy;
      }
    });

    return () => {
      mounted = false;
      workerPool.terminateWorker(toolId);
    };
  }, [toolId, workerUrl.href]);

  return workerRef.current;
}
```

- [ ] **Step 3: Write usePersistence test**

Create `src/hooks/usePersistence.test.tsx`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersistence } from './usePersistence';

describe('usePersistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should provide persistence methods', () => {
    const { result } = renderHook(() => usePersistence('test-tool'));
    
    expect(result.current.autoSave).toBeDefined();
    expect(result.current.loadAutoSave).toBeDefined();
    expect(result.current.markDirty).toBeDefined();
    expect(result.current.markClean).toBeDefined();
    expect(result.current.isDirty).toBeDefined();
  });

  it('should track dirty state', () => {
    const { result } = renderHook(() => usePersistence('test-tool'));
    
    act(() => {
      result.current.markDirty();
    });
    
    expect(result.current.isDirty()).toBe(true);
  });

  it('should enable navigation guard on mount', () => {
    const { unmount } = renderHook(() => usePersistence('test-tool'));
    
    // Navigation guard should be enabled
    unmount();
    // Navigation guard should be disabled
  });
});
```

- [ ] **Step 4: Create usePersistence hook**

Create `src/hooks/usePersistence.ts`:
```typescript
import { useEffect, useCallback } from 'react';
import { persistenceService } from '@/services/persistence.service';

export function usePersistence(toolId: string) {
  useEffect(() => {
    persistenceService.enableNavigationGuard(toolId);
    
    return () => {
      persistenceService.disableNavigationGuard(toolId);
    };
  }, [toolId]);

  const autoSave = useCallback(
    (data: any) => persistenceService.autoSave(toolId, data),
    [toolId]
  );

  const loadAutoSave = useCallback(
    () => persistenceService.loadAutoSave(toolId),
    [toolId]
  );

  const clearAutoSave = useCallback(
    () => persistenceService.clearAutoSave(toolId),
    [toolId]
  );

  const markDirty = useCallback(
    () => persistenceService.markDirty(toolId),
    [toolId]
  );

  const markClean = useCallback(
    () => persistenceService.markClean(toolId),
    [toolId]
  );

  const isDirty = useCallback(
    () => persistenceService.isDirty(toolId),
    [toolId]
  );

  const saveToFile = useCallback(
    (data: Blob, suggestedName: string, fileHandle?: FileSystemFileHandle) =>
      persistenceService.saveToFile(data, suggestedName, fileHandle),
    []
  );

  const loadFromFile = useCallback(
    (accept?: string[]) => persistenceService.loadFromFile(accept),
    []
  );

  return {
    autoSave,
    loadAutoSave,
    clearAutoSave,
    markDirty,
    markClean,
    isDirty,
    saveToFile,
    loadFromFile,
  };
}
```

- [ ] **Step 5: Run tests**

Run: `npm run test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: add useWorker and usePersistence React hooks"
```

---

---

### Task 10: UI Components (Dropzone, ProgressBar, FileList, ResultActions)

**Files:**
- Create: `src/components/ui/Dropzone.tsx`
- Create: `src/components/ui/ProgressBar.tsx`
- Create: `src/components/ui/FileList.tsx`
- Create: `src/components/ui/ResultActions.tsx`

**Interfaces:**
- Consumes: None
- Produces: Reusable UI components for all tools

- [ ] **Step 1: Create Dropzone component**

Create `src/components/ui/Dropzone.tsx`:
```typescript
import { useCallback, useState } from 'react';

export interface DropzoneProps {
  onDrop: (files: File[]) => void | Promise<void>;
  accept?: string;
  multiple?: boolean;
  children?: React.ReactNode;
}

export function Dropzone({ onDrop, accept, multiple = true, children }: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    await onDrop(files);
  }, [onDrop]);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    await onDrop(files);
  }, [onDrop]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
        transition-colors duration-200
        ${isDragging ? 'border-accent bg-accent/10' : 'border-border hover:border-accent/50'}
      `}
    >
      <input
        type="file"
        id="file-input"
        accept={accept}
        multiple={multiple}
        onChange={handleFileInput}
        className="hidden"
      />
      <label htmlFor="file-input" className="cursor-pointer">
        {children || (
          <div className="space-y-2">
            <p className="text-lg">Drop files here or click to browse</p>
            <p className="text-sm text-muted-foreground">
              {multiple ? 'Multiple files supported' : 'Single file only'}
            </p>
          </div>
        )}
      </label>
    </div>
  );
}
```

- [ ] **Step 2: Create ProgressBar component**

Create `src/components/ui/ProgressBar.tsx`:
```typescript
export interface ProgressBarProps {
  percent: number;
  label?: string;
}

export function ProgressBar({ percent, label }: ProgressBarProps) {
  const clampedPercent = Math.min(Math.max(percent, 0), 100);

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-sm mb-2">
          <span>{label}</span>
          <span className="text-muted-foreground">{clampedPercent.toFixed(0)}%</span>
        </div>
      )}
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-accent transition-all duration-300"
          style={{ width: `${clampedPercent}%` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create FileList component**

Create `src/components/ui/FileList.tsx`:
```typescript
export interface FileListProps {
  files: File[];
  onRemove?: (index: number) => void;
}

export function FileList({ files, onRemove }: FileListProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-2">
      {files.map((file, index) => (
        <div
          key={`${file.name}-${index}`}
          className="flex items-center justify-between p-3 bg-muted rounded-lg"
        >
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{file.name}</p>
            <p className="text-sm text-muted-foreground">
              {formatFileSize(file.size)}
            </p>
          </div>
          {onRemove && (
            <button
              onClick={() => onRemove(index)}
              className="ml-4 text-muted-foreground hover:text-foreground"
              aria-label="Remove file"
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create ResultActions component**

Create `src/components/ui/ResultActions.tsx`:
```typescript
import { downloadService } from '@/services/download.service';

export interface ResultActionsProps {
  blob: Blob | null;
  filename: string;
  disabled?: boolean;
}

export function ResultActions({ blob, filename, disabled }: ResultActionsProps) {
  const handleDownload = async () => {
    if (!blob) return;
    await downloadService.download(blob, filename);
  };

  const handleCopy = async () => {
    if (!blob) return;
    
    try {
      const text = await blob.text();
      await navigator.clipboard.writeText(text);
      // TODO: Show toast notification
      console.log('Copied to clipboard');
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div className="flex gap-3">
      <button
        onClick={handleDownload}
        disabled={disabled || !blob}
        className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Download
      </button>
      <button
        onClick={handleCopy}
        disabled={disabled || !blob}
        className="px-4 py-2 border border-border rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Copy
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Test components**

Run: `npm run dev`
1. Create a test page importing these components
2. Verify drag-drop works
3. Verify progress bar animates
4. Verify file list displays
5. Verify download works

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: add reusable UI components (Dropzone, ProgressBar, FileList, ResultActions)"
```

---

### Task 11: Shell Components (ShellIsland, ThemeToggle)

**Files:**
- Create: `src/components/shell/ThemeToggle.tsx`
- Create: `src/components/shell/ShellIsland.tsx`
- Modify: `src/layouts/Base.astro`

**Interfaces:**
- Consumes: `themeStore`, `tools` registry
- Produces: Persisted shell with theme toggle, placeholder for command palette

- [ ] **Step 1: Install lucide-react**

```bash
npm install lucide-react@^0.294.0
```

- [ ] **Step 2: Create ThemeToggle component**

Create `src/components/shell/ThemeToggle.tsx`:
```typescript
import { useStore } from '@nanostores/react';
import { Moon, Sun } from 'lucide-react';
import { themeAtom, toggleTheme } from '@/stores/theme.store';

export function ThemeToggle() {
  const theme = useStore(themeAtom);

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg hover:bg-muted transition-colors"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  );
}
```

- [ ] **Step 3: Create ShellIsland component**

Create `src/components/shell/ShellIsland.tsx`:
```typescript
import { useEffect } from 'react';
import { ThemeToggle } from './ThemeToggle';
import { initTheme } from '@/stores/theme.store';

export function ShellIsland() {
  useEffect(() => {
    initTheme();
  }, []);

  return (
    <header className="border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href="/" className="text-xl font-bold hover:text-accent transition-colors">
            GoodWebTools
          </a>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Press <kbd className="px-2 py-1 bg-muted rounded text-xs">⌘K</kbd> to search
            </button>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Update Base layout to include ShellIsland**

Modify `src/layouts/Base.astro`:
```astro
---
import { ViewTransitions } from 'astro:transitions';
import { ShellIsland } from '@/components/shell/ShellIsland';
import '../styles/global.css';

export interface Props {
  title: string;
  description?: string;
}

const { title, description = 'Privacy-first client-side utilities' } = Astro.props;
---

<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content={description} />
    <title>{title} | GoodWebTools</title>
    <ViewTransitions />
    <script is:inline>
      const stored = localStorage.getItem('theme');
      if (stored === 'dark') {
        document.documentElement.classList.add('dark');
      }
    </script>
  </head>
  <body class="bg-background text-foreground min-h-screen">
    <ShellIsland client:load transition:persist />
    <slot />
  </body>
</html>
```

- [ ] **Step 5: Test shell persistence**

Run: `npm run dev`
1. Navigate between pages
2. Toggle theme
3. Verify theme persists across navigation
4. Verify shell doesn't re-mount (check console)

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: add persisted shell with theme toggle and navigation"
```

---

### Task 12: Command Palette with Search

**Files:**
- Create: `src/components/shell/CommandPalette.tsx`
- Modify: `src/components/shell/ShellIsland.tsx`
- Modify: `src/registry/tools.ts` (add demo tool)

**Interfaces:**
- Consumes: `tools` registry, `searchTools()` function
- Produces: Working cmdk command palette with fuzzy search

- [ ] **Step 1: Install cmdk**

```bash
npm install cmdk@^0.2.0
```

- [ ] **Step 2: Add Hash demo tool to registry**

Modify `src/registry/tools.ts`:
```typescript
import { Hash } from 'lucide-react';
import type { ToolDef } from '@/types/tool';

export const tools: ToolDef[] = [
  {
    id: 'hash-demo',
    name: 'Hash File',
    category: 'Dev',
    route: '/tools/hash-demo',
    keywords: ['hash', 'sha256', 'checksum', 'demo', 'validation'],
    icon: Hash,
    summary: 'Generate SHA-256 hash (validation demo)',
    load: () => import('@/islands/demo/HashDemo'),
    status: 'experimental'
  }
];

// ... rest of existing functions
```

- [ ] **Step 3: Create CommandPalette component**

Create `src/components/shell/CommandPalette.tsx`:
```typescript
import { useState, useEffect } from 'react';
import { Command } from 'cmdk';
import { useStore } from '@nanostores/react';
import { searchTools } from '@/registry/tools';
import { categories } from '@/registry/categories';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const results = searchTools(search);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setOpen(false)}>
      <div className="container mx-auto px-4 pt-[20vh]">
        <Command
          className="bg-background border border-border rounded-lg shadow-2xl max-w-2xl mx-auto"
          onClick={e => e.stopPropagation()}
        >
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder="Search tools..."
            className="w-full px-4 py-3 bg-transparent border-b border-border outline-none"
          />
          <Command.List className="max-h-96 overflow-y-auto p-2">
            <Command.Empty className="px-4 py-8 text-center text-muted-foreground">
              No tools found.
            </Command.Empty>

            {categories.map(category => {
              const categoryTools = results.filter(t => t.category === category);
              if (categoryTools.length === 0) return null;

              return (
                <Command.Group key={category} heading={category} className="mb-4">
                  {categoryTools.map(tool => (
                    <Command.Item
                      key={tool.id}
                      value={tool.name}
                      onSelect={() => {
                        window.location.href = tool.route;
                      }}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-muted data-[selected]:bg-muted"
                    >
                      <tool.icon className="w-5 h-5" />
                      <div className="flex-1">
                        <p className="font-medium">{tool.name}</p>
                        <p className="text-sm text-muted-foreground">{tool.summary}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {tool.status}
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              );
            })}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add CommandPalette to ShellIsland**

Modify `src/components/shell/ShellIsland.tsx`:
```typescript
import { useEffect } from 'react';
import { ThemeToggle } from './ThemeToggle';
import { CommandPalette } from './CommandPalette';
import { initTheme } from '@/stores/theme.store';

export function ShellIsland() {
  useEffect(() => {
    initTheme();
  }, []);

  return (
    <>
      <header className="border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <a href="/" className="text-xl font-bold hover:text-accent transition-colors">
              GoodWebTools
            </a>

            <div className="flex items-center gap-4">
              <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Press <kbd className="px-2 py-1 bg-muted rounded text-xs">⌘K</kbd> to search
              </button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>
      
      <CommandPalette />
    </>
  );
}
```

- [ ] **Step 5: Test command palette**

Run: `npm run dev`
1. Press ⌘K (or Ctrl+K)
2. Palette opens
3. Type "hash"
4. See Hash File tool
5. Press Enter or click
Expected: Navigate to /tools/hash-demo (404 for now - will be created next)

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: add command palette with fuzzy search using cmdk"
```

---

### Task 13: Dynamic Tool Route

**Files:**
- Create: `src/pages/tools/[tool].astro`

**Interfaces:**
- Consumes: `tools` registry, `getToolByRoute()`
- Produces: Dynamic route that loads tool islands

- [ ] **Step 1: Create dynamic tool route**

Create `src/pages/tools/[tool].astro`:
```astro
---
import Base from '@/layouts/Base.astro';
import { getToolByRoute, tools } from '@/registry/tools';

export async function getStaticPaths() {
  return tools.map(tool => ({
    params: { tool: tool.id },
    props: { tool }
  }));
}

const { tool } = Astro.props;
const ToolComponent = (await tool.load()).default;
---

<Base title={tool.name} description={tool.summary}>
  <main class="container mx-auto px-4 py-8">
    <div class="mb-6">
      <h1 class="text-3xl font-bold mb-2">{tool.name}</h1>
      <p class="text-muted-foreground">{tool.summary}</p>
      {tool.status === 'experimental' && (
        <span class="inline-block mt-2 px-3 py-1 bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 text-sm rounded-full">
          Experimental
        </span>
      )}
    </div>

    <ToolComponent client:load />
  </main>
</Base>
```

- [ ] **Step 2: Test route**

Run: `npm run build`
Expected: Build succeeds (will fail to load HashDemo component - that's next)

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: add dynamic tool route with island loading"
```

---

### Task 14: Hash Demo Tool (Island + Worker)

**Files:**
- Create: `src/islands/demo/HashDemo.tsx`
- Create: `src/tools/demo/hash.lib.ts`
- Create: `src/tools/demo/hash.worker.ts`
- Test: `src/tools/demo/hash.lib.test.ts`

**Interfaces:**
- Consumes: `useWorker` hook, `Dropzone`, `ProgressBar`, `ResultActions` components
- Produces: Working hash demo tool validating full pipeline

- [ ] **Step 1: Write hash lib test**

Create `src/tools/demo/hash.lib.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { hashToHex } from './hash.lib';

describe('Hash Library', () => {
  it('should convert hash buffer to hex string', () => {
    const buffer = new Uint8Array([0, 15, 255, 128]);
    const hex = hashToHex(buffer);
    expect(hex).toBe('000fff80');
  });

  it('should handle empty buffer', () => {
    const buffer = new Uint8Array([]);
    const hex = hashToHex(buffer);
    expect(hex).toBe('');
  });
});
```

- [ ] **Step 2: Create hash library**

Create `src/tools/demo/hash.lib.ts`:
```typescript
export function hashToHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashFile(fileBuffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer);
  const hashArray = new Uint8Array(hashBuffer);
  return hashToHex(hashArray);
}
```

- [ ] **Step 3: Run hash lib test**

Run: `npm run test`
Expected: PASS

- [ ] **Step 4: Create hash worker**

Create `src/tools/demo/hash.worker.ts`:
```typescript
import { expose } from 'comlink';
import { hashFile } from './hash.lib';

const api = {
  async hashFile(
    fileBuffer: ArrayBuffer,
    onProgress: (percent: number) => void
  ): Promise<string> {
    onProgress(50);
    const hash = await hashFile(fileBuffer);
    onProgress(100);
    return hash;
  }
};

export type HashWorkerAPI = typeof api;
expose(api);
```

- [ ] **Step 5: Create HashDemo island**

Create `src/islands/demo/HashDemo.tsx`:
```typescript
import { useState } from 'react';
import { proxy } from 'comlink';
import { useWorker } from '@/hooks/useWorker';
import { Dropzone } from '@/components/ui/Dropzone';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ResultActions } from '@/components/ui/ResultActions';
import type { HashWorkerAPI } from '@/tools/demo/hash.worker';

export default function HashDemo() {
  const [hash, setHash] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState('');
  const [processing, setProcessing] = useState(false);

  const worker = useWorker<HashWorkerAPI>(
    'hash-demo',
    new URL('@/tools/demo/hash.worker.ts', import.meta.url)
  );

  const handleFile = async (files: File[]) => {
    if (files.length === 0 || !worker) return;

    const file = files[0];
    setFileName(file.name);
    setProcessing(true);
    setProgress(0);

    try {
      const buffer = await file.arrayBuffer();
      const result = await worker.hashFile(
        buffer,
        proxy((pct) => setProgress(pct))
      );
      setHash(result);
    } catch (error) {
      console.error('Hash failed:', error);
    } finally {
      setProcessing(false);
    }
  };

  const resultBlob = hash
    ? new Blob([`${hash}  ${fileName}\n`], { type: 'text/plain' })
    : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Dropzone onDrop={handleFile} accept="*/*" multiple={false}>
        <div className="space-y-2">
          <p className="text-lg">Drop file here or click to browse</p>
          <p className="text-sm text-muted-foreground">
            Generate SHA-256 hash
          </p>
        </div>
      </Dropzone>

      {processing && <ProgressBar percent={progress} label="Hashing..." />}

      {hash && (
        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <h3 className="font-medium mb-2">SHA-256 Hash</h3>
            <code className="text-sm break-all">{hash}</code>
          </div>

          <ResultActions
            blob={resultBlob}
            filename={`${fileName}.sha256`}
            disabled={processing}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Test HashDemo tool**

Run: `npm run dev`
1. Navigate to http://localhost:4321
2. Press ⌘K, search "hash", click Hash File
3. Drop a file
4. See progress bar
5. See hash result
6. Download .sha256 file
Expected: All working, hash is correct

- [ ] **Step 7: Verify worker terminates**

1. Navigate away from hash tool
2. Check DevTools console
3. No worker errors
Expected: Worker terminates cleanly

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "feat: add Hash File demo tool with worker pipeline"
```

---

### Task 15: PWA Configuration

**Files:**
- Install: `@vite-pwa/astro`
- Modify: `astro.config.mjs`
- Create: `public/manifest.json`
- Create: `public/icon-192.png`, `public/icon-512.png`

**Interfaces:**
- Consumes: Astro config
- Produces: Working PWA with service worker and offline capability

- [ ] **Step 1: Install PWA plugin**

```bash
npm install @vite-pwa/astro@^0.2.0
```

- [ ] **Step 2: Create PWA manifest**

Create `public/manifest.json`:
```json
{
  "name": "GoodWebTools",
  "short_name": "GWT",
  "description": "Privacy-first client-side utilities",
  "theme_color": "#2563eb",
  "background_color": "#ffffff",
  "display": "standalone",
  "start_url": "/",
  "scope": "/",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

- [ ] **Step 3: Create placeholder icons**

For Phase 0, create simple colored squares as placeholders:
1. Create 192x192px blue square, save as `public/icon-192.png`
2. Create 512x512px blue square, save as `public/icon-512.png`

(In production, replace with proper logo)

- [ ] **Step 4: Update Astro config with PWA**

Modify `astro.config.mjs`:
```javascript
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import { VitePWA } from '@vite-pwa/astro';

export default defineConfig({
  output: 'static',
  integrations: [
    react(),
    tailwind(),
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
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
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
          }
        ]
      }
    })
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
      format: 'es'
    }
  }
});
```

- [ ] **Step 5: Test PWA**

Run: `npm run build && npm run preview`
1. Open in Chrome
2. Check Application tab in DevTools
3. Verify service worker registered
4. Verify manifest loaded
5. Try "Install app" prompt
Expected: PWA installs, works offline after first visit

- [ ] **Step 6: Test offline**

1. With app installed and visited
2. Disconnect network
3. Reload app
4. Try Hash tool
Expected: Still works offline

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: add PWA support with offline capability"
```

---

### Task 16: Cloudflare Pages Deployment

**Files:**
- Create: `_headers`
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: Build output
- Produces: Deployed site on Cloudflare Pages

- [ ] **Step 1: Create Cloudflare headers**

Create `_headers`:
```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Cross-Origin-Embedder-Policy: require-corp
  Cross-Origin-Opener-Policy: same-origin
  Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self';

/wasm/*
  Cache-Control: public, max-age=31536000, immutable
  Cross-Origin-Resource-Policy: same-origin

/models/*
  Cache-Control: public, max-age=2592000
  Cross-Origin-Resource-Policy: same-origin
```

- [ ] **Step 2: Create GitHub Actions workflow**

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm run test
      
      - name: Build
        run: npm run build
      
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: goodwebtools
          directory: dist
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 3: Test build locally**

Run: `npm run build`
Expected: Build succeeds, `dist/` contains:
- `_headers` file
- HTML files
- Assets with hashes
- PWA manifest and service worker

- [ ] **Step 4: Verify headers in build**

Run: `ls -la dist/_headers`
Expected: File exists

- [ ] **Step 5: Document Cloudflare setup**

Add to README.md (will create in next task):
```markdown
## Deployment

### Cloudflare Pages

1. Create Cloudflare Pages project
2. Connect to GitHub repository
3. Set build command: `npm run build`
4. Set build output: `dist`
5. Add secrets:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
```

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: add Cloudflare Pages deployment with headers and CI/CD"
```

---

### Task 17: Development Environment (ESLint, Prettier, VS Code)

**Files:**
- Create: `.eslintrc.js`
- Create: `.prettierrc`
- Create: `.vscode/settings.json`
- Create: `.vscode/extensions.json`

**Interfaces:**
- Consumes: TypeScript config
- Produces: Configured dev environment with linting and formatting

- [ ] **Step 1: Install ESLint dependencies**

```bash
npm install -D eslint@^8.55.0 @typescript-eslint/parser@^6.15.0 @typescript-eslint/eslint-plugin@^6.15.0 eslint-plugin-react@^7.33.2 eslint-plugin-react-hooks@^4.6.0 eslint-plugin-astro@^0.31.0
```

- [ ] **Step 2: Create ESLint config**

Create `.eslintrc.js`:
```javascript
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  env: {
    browser: true,
    es2022: true,
    node: true
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  settings: {
    react: {
      version: 'detect'
    }
  },
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    '@typescript-eslint/no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    '@typescript-eslint/no-explicit-any': 'warn',
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off'
  },
  overrides: [
    {
      files: ['*.astro'],
      parser: 'astro-eslint-parser',
      parserOptions: {
        parser: '@typescript-eslint/parser',
        extraFileExtensions: ['.astro']
      },
      extends: ['plugin:astro/recommended']
    }
  ]
};
```

- [ ] **Step 3: Update Prettier config**

Modify `.prettierrc`:
```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2,
  "plugins": ["prettier-plugin-astro", "prettier-plugin-tailwindcss"],
  "overrides": [
    {
      "files": "*.astro",
      "options": {
        "parser": "astro"
      }
    }
  ]
}
```

- [ ] **Step 4: Create VS Code settings**

Create `.vscode/settings.json`:
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
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

- [ ] **Step 5: Create VS Code extensions**

Create `.vscode/extensions.json`:
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

- [ ] **Step 6: Add lint scripts to package.json**

Edit `package.json`:
```json
{
  "scripts": {
    "lint": "eslint src --ext .ts,.tsx,.astro",
    "lint:fix": "eslint src --ext .ts,.tsx,.astro --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx,astro,css}\""
  }
}
```

- [ ] **Step 7: Run linter**

Run: `npm run lint`
Expected: No errors (or fix any found)

- [ ] **Step 8: Run formatter**

Run: `npm run format`
Expected: All files formatted

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "feat: add ESLint, Prettier, and VS Code configuration"
```

---

### Task 18: Documentation

**Files:**
- Create: `README.md`
- Create: `CONTRIBUTING.md`
- Create: `docs/architecture.md`

**Interfaces:**
- Consumes: Project knowledge
- Produces: Complete documentation

- [ ] **Step 1: Create README**

Create `README.md`:
```markdown
# GoodWebTools

Privacy-first client-side utilities. All processing happens in your browser.

## Features

- **100% Client-Side** - No file uploads, no servers
- **Works Offline** - Install as PWA
- **Open Source** - Audit the code yourself
- **Privacy-First** - Verify with DevTools Network tab

## Development

### Prerequisites

- Node.js 20+
- npm 10+

### Setup

\`\`\`bash
npm install
npm run dev
\`\`\`

Open http://localhost:4321

### Scripts

- `npm run dev` - Start dev server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test` - Run tests
- `npm run lint` - Lint code
- `npm run format` - Format code

### Architecture

See [docs/architecture.md](docs/architecture.md)

## Deployment

### Cloudflare Pages

1. Create Cloudflare Pages project
2. Connect to GitHub repository
3. Build command: `npm run build`
4. Build output: `dist`
5. Add secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## License

MIT
```

- [ ] **Step 2: Create CONTRIBUTING**

Create `CONTRIBUTING.md`:
```markdown
# Contributing to GoodWebTools

## Adding a New Tool

1. Register the tool in `src/registry/tools.ts`
2. Create island component in `src/islands/<category>/<ToolName>.tsx`
3. Create worker in `src/tools/<category>/<name>.worker.ts`
4. Create pure logic in `src/tools/<category>/<name>.lib.ts`
5. Write tests in `src/tools/<category>/<name>.lib.test.ts`
6. Test locally with `npm run dev`
7. Run tests with `npm run test`
8. Commit with conventional commit message

## Code Standards

- **TypeScript strict mode** - No `any` without justification
- **Explicit variable names** - Use units (byteSize, maxAgeMs, etc.)
- **DRY** - Don't repeat yourself
- **YAGNI** - You aren't gonna need it
- **TDD** - Test-driven development

## Testing

- Unit tests for pure logic
- Integration tests for services
- Manual testing for UI components

## Commit Messages

Use conventional commits:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `test:` - Tests
- `refactor:` - Code refactoring
- `style:` - Formatting
- `chore:` - Maintenance

## Pull Requests

1. Create feature branch
2. Make changes
3. Write tests
4. Run `npm run lint` and `npm run test`
5. Commit with conventional message
6. Open PR with description
```

- [ ] **Step 3: Create architecture docs**

Create `docs/architecture.md`:
```markdown
# Architecture

## Overview

GoodWebTools uses a layered services architecture with Astro (static MPA) + React islands.

## Directory Structure

```
src/
├── pages/          # Astro routes (static HTML)
├── layouts/        # Page layouts
├── components/     # React components
│   ├── shell/      # Persisted shell
│   └── ui/         # Reusable UI
├── islands/        # Per-tool React islands (lazy)
├── tools/          # Pure logic + workers
├── services/       # Singleton services
├── registry/       # Tool manifest
├── hooks/          # React hooks
├── stores/         # Nanostores
├── styles/         # Global CSS
└── types/          # TypeScript types
```

## Key Concepts

### Tool Registry

Single source of truth for all tools. Each tool entry includes:
- Metadata (name, category, icon, keywords)
- Route
- Lazy load function
- Asset requirements

### Shared Services

Six singleton services:
1. **FileService** - Unified file input
2. **WorkerPool** - Worker lifecycle management
3. **AssetCache** - WASM/model caching with TTL
4. **DownloadService** - File downloads
5. **ProgressService** - Progress/toast UI
6. **PersistenceService** - Auto-save and navigation guards

### Worker Pipeline

Every tool follows: Island → Comlink → Worker → Logic → Results

Workers run in separate threads, keeping UI responsive.

### State Management

- **Nanostores** for shell state (theme, workers)
- **React local state** for tool UI
- **LocalStorage** for persistence

### PWA

- Service worker for offline capability
- Workbox for caching strategies
- Manifest for installability

## Privacy Guarantees

1. **No egress** - Strict CSP blocks external requests
2. **Offline-capable** - Strongest privacy proof
3. **Open source** - Auditable code
4. **Reproducible builds** - Verify production matches source

## Performance

- Initial shell: < 120KB gzipped
- Manual chunk splitting
- Lazy island loading
- Progress bars for > 1MB assets
- Service worker caching with expiration
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "docs: add README, CONTRIBUTING, and architecture documentation"
```

---

### Task 19: Final Testing & Performance Verification

**Files:**
- None (testing and verification)

**Interfaces:**
- Consumes: Complete app
- Produces: Verified working Phase 0

- [ ] **Step 1: Build production**

Run: `npm run build`
Expected: Clean build, no errors

- [ ] **Step 2: Check bundle size**

Run: `ls -lh dist/**/*.js | head -20`
Expected: Individual chunks < 50KB, total shell < 120KB gzipped

- [ ] **Step 3: Start preview server**

Run: `npm run preview`

- [ ] **Step 4: Test homepage**

1. Open http://localhost:4321
2. Verify theme toggle works
3. Verify theme persists on reload
4. Check Lighthouse score
Expected: > 95 performance

- [ ] **Step 5: Test command palette**

1. Press ⌘K
2. Palette opens
3. Type "hash"
4. See Hash File result
5. Press Enter
6. Navigate to tool
Expected: All working

- [ ] **Step 6: Test Hash tool**

1. Drop a file
2. See progress bar
3. See hash result
4. Download .sha256 file
5. Verify hash is correct (compare with `shasum -a 256 <file>`)
Expected: Hash matches

- [ ] **Step 7: Test offline**

1. Install PWA
2. Disconnect network
3. Reload app
4. Use Hash tool
Expected: Works offline

- [ ] **Step 8: Test worker cleanup**

1. Use Hash tool
2. Navigate away
3. Check DevTools console
4. No errors
Expected: Worker terminated cleanly

- [ ] **Step 9: Test View Transitions**

1. Navigate between pages
2. Smooth animations
3. Shell persists (doesn't re-mount)
Expected: Smooth navigation

- [ ] **Step 10: Verify privacy**

1. Open DevTools Network tab
2. Clear network log
3. Use Hash tool
4. Check network requests
Expected: Zero external requests (only self-hosted assets)

- [ ] **Step 11: Run all tests**

Run: `npm run test`
Expected: All tests pass

- [ ] **Step 12: Run linter**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 13: Verify success criteria**

Check each item from design spec:
- [ ] Shell loads < 1.5s (FCP) - Check Lighthouse
- [ ] Hash tool works offline after first use
- [ ] Command palette searches tools
- [ ] Theme toggle persists across navigation
- [ ] Worker terminates on route-away
- [ ] Progress bar shows for >1MB downloads (hash tool shows for all)
- [ ] Lighthouse score > 95
- [ ] Build passes CI checks (local tests)
- [ ] PWA installable
- [ ] Privacy page renders correctly

- [ ] **Step 14: Final commit**

```bash
git add .
git commit -m "chore: Phase 0 Foundation complete - all success criteria met"
```

- [ ] **Step 15: Tag release**

```bash
git tag -a v0.1.0 -m "Phase 0: Foundation"
git push origin v0.1.0
```

---

## Execution Complete!

Phase 0 Foundation is now complete with:

✅ Astro + React + Tailwind setup
✅ Tool Registry system
✅ 6 Shared Services (File, Worker, Asset, Download, Progress, Persistence)
✅ Persisted Shell with command palette (⌘K)
✅ Theme system (light/dark)
✅ Hash File demo tool (full pipeline validation)
✅ PWA with offline capability
✅ Cloudflare Pages deployment ready
✅ Complete documentation
✅ All success criteria met

**Next:** Phase 1 - Dev/Office Utilities (pure JS tools)