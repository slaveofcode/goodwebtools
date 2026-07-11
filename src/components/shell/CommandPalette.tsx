import { useState, useEffect } from 'react';
import { Command } from 'cmdk';
import { searchTools } from '@/registry/tools';
import { categories } from '@/registry/categories';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const results = searchTools(search);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setOpen(false)}>
      <div className="container mx-auto px-4 pt-[20vh]">
        <Command className="bg-background border rounded-lg shadow-2xl max-w-2xl mx-auto" onClick={e => e.stopPropagation()}>
          <Command.Input value={search} onValueChange={setSearch} placeholder="Search tools..." className="w-full px-4 py-3 bg-transparent border-b outline-none" />
          <Command.List className="max-h-96 overflow-y-auto p-2">
            <Command.Empty className="px-4 py-8 text-center">No tools found.</Command.Empty>
            {categories.map(category => {
              const categoryTools = results.filter(t => t.category === category);
              if (categoryTools.length === 0) return null;
              return (
                <Command.Group key={category} heading={category}>
                  {categoryTools.map(tool => (
                    <Command.Item
                      key={tool.id}
                      value={tool.name}
                      onSelect={() => { window.location.href = tool.route; }}
                      className="flex items-center gap-3 px-3 py-2 rounded cursor-pointer hover:bg-muted"
                    >
                      <tool.icon className="w-5 h-5" />
                      <div className="flex-1">
                        <p className="font-medium">{tool.name}</p>
                        <p className="text-sm text-muted-foreground">{tool.summary}</p>
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
