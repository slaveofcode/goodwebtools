import { lazy, Suspense, useMemo } from 'react';
import { getToolById } from '@/registry/tools';

interface ToolHostProps {
  toolId: string;
}

/**
 * Client-side dynamic loader for a tool island. Looks the tool up in the
 * registry and lazily imports its component via the registry `load()` fn, so
 * one route file serves every tool without hardcoding imports.
 */
export default function ToolHost({ toolId }: ToolHostProps) {
  const tool = getToolById(toolId);

  const LazyTool = useMemo(() => {
    if (!tool) return null;
    return lazy(tool.load);
  }, [toolId]);

  if (!tool || !LazyTool) {
    return (
      <div className="py-12 text-center text-muted-foreground">Tool not found.</div>
    );
  }

  return (
    <Suspense
      fallback={<div className="py-12 text-center text-muted-foreground">Loading tool…</div>}
    >
      <LazyTool />
    </Suspense>
  );
}
