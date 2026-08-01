import type { LucideIcon } from 'lucide-react';

export type Category = 'Dev' | 'PDF' | 'Image' | 'Files' | 'Draw' | 'Media' | 'Network' | 'Maps' | 'Playground';

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
  /** Hidden from web listings (grid + search); only shown in the Tauri desktop app. */
  desktopOnly?: boolean;
  assets?: AssetRef[];
  status: 'stable' | 'beta' | 'experimental';
}
