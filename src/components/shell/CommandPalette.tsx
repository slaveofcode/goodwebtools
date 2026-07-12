import { useState, useEffect, useRef } from 'react';
import { Command } from 'cmdk';
import { searchTools } from '@/registry/tools';
import { categories } from '@/registry/categories';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const results = searchTools(search);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    // Let any element open search by clicking (dispatch 'gwt:open-search'),
    // so it works without a keyboard.
    const openSearch = () => setOpen(true);
    document.addEventListener('keydown', down);
    window.addEventListener('gwt:open-search', openSearch);
    return () => {
      document.removeEventListener('keydown', down);
      window.removeEventListener('gwt:open-search', openSearch);
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
          className="mx-auto max-w-2xl border-[3px] border-border bg-background shadow-brutal-lg"
          onClick={e => e.stopPropagation()}
        >
          <Command.Input
            ref={inputRef}
            value={search}
            onValueChange={setSearch}
            placeholder="SEARCH TOOLS..."
            className="w-full border-b-2 border-border bg-transparent px-4 py-3 font-bold uppercase tracking-wide outline-none placeholder:text-muted-foreground"
          />
          <Command.List className="max-h-96 overflow-y-auto p-2">
            <Command.Empty className="px-4 py-8 text-center font-bold uppercase">
              No tools found.
            </Command.Empty>
            {categories.map(category => {
              const categoryTools = results.filter(t => t.category === category);
              if (categoryTools.length === 0) return null;
              return (
                <Command.Group
                  key={category}
                  heading={category}
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground"
                >
                  {categoryTools.map(tool => (
                    <Command.Item
                      key={tool.id}
                      value={tool.name}
                      onSelect={() => {
                        window.location.href = tool.route;
                      }}
                      className="flex cursor-pointer items-center gap-3 border-2 border-transparent px-3 py-2 data-[selected=true]:border-border data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                    >
                      <tool.icon className="h-5 w-5" />
                      <div className="flex-1">
                        <p className="font-bold">{tool.name}</p>
                        <p className="text-sm opacity-80">{tool.summary}</p>
                      </div>
                    </Command.Item>
                  ))}
                </Command.Group>
              );
            })}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
