import type { LucideIcon } from 'lucide-react';

export type Category = 'Dev' | 'PDF' | 'Image' | 'Files' | 'Draw' | 'Media' | 'Network' | 'Maps' | 'Playground';

export interface AssetRef {
  url: string;
  byteSize: number;
  type: 'wasm' | 'model' | 'font' | 'image' | 'other';
  description: string;
}

export interface ToolFaq {
  q: string;
  a: string;
}

/**
 * Per-tool SEO content, authored and keyed by tool id (see registry/tool-seo).
 * All fields optional — a tool with no entry renders exactly as before. This is
 * the raw material for richer <title>/description, on-page copy, and FAQPage/
 * HowTo structured data. Kept out of ToolDef so the registry stays lean and this
 * layer can go per-language later.
 */
export interface ToolSeoContent {
  /** Optimized <title> body ("| GoodWebTools" is appended). ~45-55 chars. */
  title?: string;
  /** Unique meta/OG description. ~150-160 chars. */
  description?: string;
  /** Lead paragraph shown under the H1 (unique, keyword-aware). */
  intro?: string;
  /** "How to use" steps → rendered on-page + HowTo JSON-LD. */
  howTo?: string[];
  /** FAQ → rendered on-page + FAQPage JSON-LD. */
  faqs?: ToolFaq[];
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
  /** Hidden from web listings (grid + search); only shown in the Tauri desktop app. */
  desktopOnly?: boolean;
  assets?: AssetRef[];
  status: 'stable' | 'beta' | 'experimental';
}
