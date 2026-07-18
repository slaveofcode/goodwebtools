import { useState, useEffect } from 'react';
import { Keyboard, Camera, MonitorPlay, Info } from 'lucide-react';
import { isTauri } from '@/services/platform';
import { Alert } from '@/components/ui/Alert';

interface HotkeyConfig {
  id: string;
  name: string;
  keys: string;
  description: string;
  icon: any;
  tool: string;
  toolPath: string;
}

const BUILT_IN_HOTKEYS: HotkeyConfig[] = [
  {
    id: 'screenshot',
    name: 'Screenshot',
    keys: 'CommandOrControl+Shift+X',
    description: 'Capture full screen screenshot',
    icon: Camera,
    tool: 'Screenshot',
    toolPath: '/tools/screenshot',
  },
  {
    id: 'screen-recorder',
    name: 'Screen Recorder',
    keys: 'CommandOrControl+Shift+R',
    description: 'Toggle screen recording (start/stop)',
    icon: MonitorPlay,
    tool: 'Screen Recorder',
    toolPath: '/tools/screen-recorder',
  },
];

export default function HotkeySettings() {
  const [inTauri, setInTauri] = useState(false);
  const [platform, setPlatform] = useState<'mac' | 'windows' | 'linux'>('mac');

  useEffect(() => {
    setInTauri(isTauri());

    // Detect platform
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes('mac')) setPlatform('mac');
      else if (ua.includes('win')) setPlatform('windows');
      else if (ua.includes('linux')) setPlatform('linux');
    }
  }, []);

  const formatKeysForPlatform = (keys: string): string => {
    if (platform === 'mac') {
      return keys
        .replace('CommandOrControl', '⌘')
        .replace('Command', '⌘')
        .replace('Control', '⌃')
        .replace('Ctrl', '⌃')
        .replace('Shift', '⇧')
        .replace('Alt', '⌥')
        .replace('Option', '⌥');
    } else {
      return keys
        .replace('CommandOrControl', 'Ctrl')
        .replace('Command', 'Ctrl')
        .replace('+', ' + ');
    }
  };

  if (!inTauri) {
    return (
      <Alert variant="info">
        <Info className="h-4 w-4" />
        <span>Global hotkeys are only available in the desktop app. <a href="/download" className="underline">Download GoodWebTools Desktop</a> to use this feature.</span>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border-2 border-border bg-muted/40 p-4">
        <div className="flex items-start gap-3">
          <Keyboard className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
          <div className="text-sm text-muted-foreground">
            <p className="mb-2">
              Global hotkeys are automatically registered when you open the relevant tools.
              They work system-wide, even when GoodWebTools is minimized or unfocused.
            </p>
            <p className="text-xs">
              <strong className="text-foreground">Note:</strong> Hotkeys are registered when you visit the tool page and unregistered when you leave.
              In a future update, you'll be able to keep them always active.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Available Hotkeys
        </h3>

        {BUILT_IN_HOTKEYS.map((hotkey) => {
          const Icon = hotkey.icon;
          return (
            <div
              key={hotkey.id}
              className="flex items-center justify-between rounded-lg border-2 border-border bg-background p-4 shadow-brutal-sm"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-border bg-muted">
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{hotkey.name}</span>
                    <a
                      href={hotkey.toolPath}
                      className="text-xs text-primary underline hover:text-primary/80"
                    >
                      Open tool
                    </a>
                  </div>
                  <p className="text-sm text-muted-foreground">{hotkey.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-md border-2 border-border bg-muted px-3 py-1.5 font-mono text-sm font-bold shadow-brutal-xs">
                  {formatKeysForPlatform(hotkey.keys)}
                </div>
                <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-green-600 bg-green-500/10">
                  <div className="h-2 w-2 rounded-full bg-green-600" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border-2 border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        <p>
          <strong className="text-foreground">Platform:</strong> {platform === 'mac' ? 'macOS' : platform === 'windows' ? 'Windows' : 'Linux'}
        </p>
        <p className="mt-2 text-xs">
          Want to customize these hotkeys or add more? Let us know on{' '}
          <a href="https://github.com/anthropics/claude-code/issues" target="_blank" rel="noopener" className="underline">
            GitHub
          </a>
        </p>
      </div>
    </div>
  );
}
