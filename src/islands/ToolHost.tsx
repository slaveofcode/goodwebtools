import { Component, lazy, Suspense, useMemo, type ComponentType, type ReactNode } from 'react';
import { getToolById } from '@/registry/tools';
import type { Lang } from '@/i18n/config';

interface ToolHostProps {
  toolId: string;
  /** Current locale — forwarded to tools that localize their own UI. */
  lang?: Lang;
}

interface BoundaryProps {
  children: ReactNode;
}

interface BoundaryState {
  error: Error | null;
}

/** Catches render/hydration errors in a tool so it never silently blanks out. */
class ToolErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('Tool crashed:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="space-y-2 border-2 border-border bg-red-400 p-4 text-black shadow-brutal-sm">
          <p className="font-bold uppercase">This tool hit an error</p>
          <pre className="overflow-auto whitespace-pre-wrap break-words text-sm">
            {this.state.error.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Client-side dynamic loader for a tool island. Looks the tool up in the
 * registry and lazily imports its component via the registry `load()` fn, so
 * one route file serves every tool without hardcoding imports.
 */
export default function ToolHost({ toolId, lang }: ToolHostProps) {
  const tool = getToolById(toolId);

  // `tool` is a stable registry reference derived from `toolId`, so keying on
  // both is equivalent to keying on `toolId` alone — and satisfies the linter.
  const LazyTool = useMemo(() => {
    if (!tool) return null;
    // Tools take no required props; a few read an optional `lang`.
    return lazy(tool.load) as unknown as ComponentType<{ lang?: Lang }>;
  }, [toolId, tool]);

  if (!tool || !LazyTool) {
    return <div className="py-12 text-center text-muted-foreground">Tool not found.</div>;
  }

  return (
    <ToolErrorBoundary>
      <Suspense
        fallback={<div className="py-12 text-center text-muted-foreground">Loading tool…</div>}
      >
        <LazyTool lang={lang} />
      </Suspense>
    </ToolErrorBoundary>
  );
}
