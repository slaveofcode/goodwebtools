import { useState, useEffect, useRef } from 'react';
import { Command } from 'cmdk';
import { searchTools } from '@/registry/tools';
import { localizedTool } from '@/registry/tool-i18n';
import { categories, categoryName } from '@/registry/categories';
import { isTauri } from '@/services/platform';
import { localizePath, type Lang } from '@/i18n/config';
import { useLang } from '@/i18n/shared';
import { routeQuery, prefillUrl } from '@/tools/agent/router.lib';

const AGENT_COPY: Record<Lang, { heading: string; open: (name: string) => string; placeholder: string }> = {
  en: { heading: 'Agent suggestion', open: (n) => `Open ${n}`, placeholder: 'Ask the agent — e.g. compress my video to 8 MB…' },
  id: { heading: 'Saran agen', open: (n) => `Buka ${n}`, placeholder: 'Tanya agen — mis. kompres video saya ke 8 MB…' },
};

export function CommandPalette() {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isDesktop, setIsDesktop] = useState(false);
  const [agentMode, setAgentMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Desktop-only tools (e.g. Hotkey Test) are excluded from web search results.
  const results = searchTools(search).filter(tool => isDesktop || !tool.desktopOnly);

  // Natural-language routing: for multi-word requests, surface a pinned "agent"
  // suggestion that opens the routed tool with its inputs pre-filled.
  const routed = search.trim().split(/\s+/).filter(Boolean).length > 1
    ? routeQuery(search, 1)
    : { candidates: [], params: {} };
  const agent = routed.candidates[0];
  const agentCopy = AGENT_COPY[lang] ?? AGENT_COPY.en;
  const agentHref = agent
    ? localizePath(agent.route, lang) + prefillUrl(agent.route, routed.params).slice(agent.route.length)
    : '';

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    // Let any element open search by clicking (dispatch 'gwt:open-search'),
    // so it works without a keyboard.
    const openSearch = () => { setAgentMode(false); setOpen(true); };
    const openAgent = () => { setAgentMode(true); setOpen(true); };
    setIsDesktop(isTauri());
    document.addEventListener('keydown', down);
    window.addEventListener('gwt:open-search', openSearch);
    window.addEventListener('gwt:open-agent', openAgent);
    return () => {
      document.removeEventListener('keydown', down);
      window.removeEventListener('gwt:open-search', openSearch);
      window.removeEventListener('gwt:open-agent', openAgent);
    };
  }, []);

  useEffect(() => {
    if (open) {
      // Focus input when palette opens
      setTimeout(() => inputRef.current?.focus(), 10);
    } else {
      // Clear search when closed
      setSearch('');
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setOpen(false)}>
      <div className="container mx-auto px-4 pt-[20vh]">
        <Command
          shouldFilter={false}
          className="mx-auto max-w-2xl border-[3px] border-border bg-background shadow-brutal-lg"
          onClick={e => e.stopPropagation()}
        >
          <Command.Input
            ref={inputRef}
            value={search}
            onValueChange={setSearch}
            placeholder={agentMode ? agentCopy.placeholder : 'SEARCH TOOLS...'}
            className="w-full border-b-2 border-border bg-transparent px-4 py-3 font-bold uppercase tracking-wide outline-none placeholder:text-muted-foreground"
          />
          <Command.List className="max-h-96 overflow-y-auto p-2">
            <Command.Empty className="px-4 py-8 text-center font-bold uppercase">
              No tools found.
            </Command.Empty>
            {agent && (
              <Command.Group
                heading={agentCopy.heading}
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-accent-foreground"
              >
                <Command.Item
                  value={`__agent__ ${search}`}
                  onSelect={() => { window.location.href = agentHref; }}
                  className="flex cursor-pointer items-center gap-3 border-2 border-transparent px-3 py-2 data-[selected=true]:border-border data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                >
                  <span className="text-lg" aria-hidden="true">→</span>
                  <div className="flex-1">
                    <p className="font-bold">{agentCopy.open(agent.name)}</p>
                    <p className="text-sm opacity-80">{search}</p>
                  </div>
                </Command.Item>
              </Command.Group>
            )}
            {categories.map(category => {
              const categoryTools = results.filter(t => t.category === category);
              if (categoryTools.length === 0) return null;
              return (
                <Command.Group
                  key={category}
                  heading={categoryName(category, lang)}
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground"
                >
                  {categoryTools.map(tool => {
                    const label = localizedTool(tool, lang);
                    return (
                    <Command.Item
                      key={tool.id}
                      // Keep both names searchable so Bahasa users can type either.
                      value={`${label.name} ${tool.name}`}
                      onSelect={() => {
                        window.location.href = localizePath(tool.route, lang);
                      }}
                      className="flex cursor-pointer items-center gap-3 border-2 border-transparent px-3 py-2 data-[selected=true]:border-border data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                    >
                      <tool.icon className="h-5 w-5" />
                      <div className="flex-1">
                        <p className="font-bold">{label.name}</p>
                        <p className="text-sm opacity-80">{label.summary}</p>
                      </div>
                    </Command.Item>
                    );
                  })}
                </Command.Group>
              );
            })}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
