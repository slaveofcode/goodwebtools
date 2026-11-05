import type { ToolDef } from '@/types/tool';
import { localizedTool } from './tool-i18n';

/** One tool as listed in /tools-index.json (read by the Companion extension's launcher). */
export interface ToolIndexEntry {
  id: string;
  route: string;
  category: string;
  name: string;
  summary: string;
  nameId: string;
  summaryId: string;
  keywords: string[];
}

/** Plain, serialisable tool list (no icons or loaders) in EN + ID. */
export function buildToolsIndex(list: ToolDef[]): ToolIndexEntry[] {
  return list.map(t => {
    const id = localizedTool(t, 'id');
    return {
      id: t.id,
      route: t.route,
      category: t.category,
      name: t.name,
      summary: t.summary,
      nameId: id.name,
      summaryId: id.summary,
      keywords: t.keywords ?? [],
    };
  });
}
