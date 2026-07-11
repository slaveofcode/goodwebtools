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
