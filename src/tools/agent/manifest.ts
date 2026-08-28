/**
 * Structured tool descriptors: the single source of truth for both A's
 * deterministic slot-fill and B's model function-calling schema. Descriptions
 * reuse the registry; slots are hand-authored per tool that accepts prefill.
 */
import { tools, getToolById } from '@/registry/tools';

export type SlotKey = 'size' | 'number' | 'text' | 'url';
export interface ToolSlot { key: SlotKey; label: string; required: boolean }
export interface ToolManifestEntry { id: string; route: string; description: string; slots: ToolSlot[] }

// Only tools that accept a prefill param need an entry here; others are route-only.
const SLOT_OVERRIDES: Record<string, ToolSlot[]> = {
  'video-compress': [{ key: 'size', label: 'Target size', required: false }],
  'qr-gen': [{ key: 'text', label: 'Text or URL', required: false }],
  'base64': [{ key: 'text', label: 'Text', required: false }],
  'roman-numerals': [{ key: 'number', label: 'Number', required: false }],
  'text-encrypt': [{ key: 'text', label: 'Message', required: false }],
  'timer-stopwatch': [{ key: 'number', label: 'Minutes', required: false }],
  'unit-converter': [{ key: 'number', label: 'Value', required: false }],
};

export const toolManifest: ToolManifestEntry[] = tools
  .filter(t => !t.desktopOnly)
  .map(t => ({
    id: t.id,
    route: t.route,
    description: `${t.name} — ${t.summary}. Keywords: ${t.keywords.join(', ')}`,
    slots: SLOT_OVERRIDES[t.id] ?? [],
  }));

export function manifestFor(id: string): ToolManifestEntry | undefined {
  return getToolById(id) ? toolManifest.find(e => e.id === id) : undefined;
}
