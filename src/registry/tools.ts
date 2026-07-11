import { Hash } from 'lucide-react';
import type { ToolDef } from '@/types/tool';

export const tools: ToolDef[] = [
  {
    id: 'hash-demo',
    name: 'Hash File',
    category: 'Dev',
    route: '/tools/hash-demo',
    keywords: ['hash', 'sha', 'sha256', 'sha-256', 'checksum', 'demo', 'validation', 'generate', 'file'],
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
