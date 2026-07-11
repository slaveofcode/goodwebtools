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
