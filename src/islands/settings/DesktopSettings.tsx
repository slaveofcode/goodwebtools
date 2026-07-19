import { useState, useEffect } from 'react';
import { isTauri } from '@tauri-apps/api/core';

interface DesktopPrefs {
  startOnLogin: boolean;
  showInTray: boolean;
  screenshotFormat: 'png' | 'jpg';
  screenshotQuality: number;
}

const STORAGE_KEY = 'gwt_desktop_prefs';

function loadPrefs(): DesktopPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaults(), ...JSON.parse(raw) };
  } catch {}
  return defaults();
}

function defaults(): DesktopPrefs {
  return {
    startOnLogin: false,
    showInTray: true,
    screenshotFormat: 'png',
    screenshotQuality: 90,
  };
}

export default function DesktopSettings() {
  const [prefs, setPrefs] = useState<DesktopPrefs>(loadPrefs);
  const [saved, setSaved] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    isTauri().then(setIsDesktop).catch(() => setIsDesktop(false));
  }, []);

  const update = <K extends keyof DesktopPrefs>(key: K, value: DesktopPrefs[K]) => {
    setPrefs(p => ({ ...p, [key]: value }));
    setSaved(false);
  };

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!isDesktop) {
    return (
      <p className="text-sm text-muted-foreground">
        Desktop settings are only available in the GoodWebTools desktop app.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Show in system tray</p>
          <p className="text-xs text-muted-foreground">Keep GoodWebTools accessible from the menu bar</p>
        </div>
        <button
          role="switch"
          aria-checked={prefs.showInTray}
          onClick={() => update('showInTray', !prefs.showInTray)}
          className={`relative w-10 h-5 rounded-full transition-colors focus:outline-none ${
            prefs.showInTray ? 'bg-blue-600' : 'bg-gray-400 dark:bg-gray-600'
          }`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            prefs.showInTray ? 'translate-x-5' : 'translate-x-0.5'
          }`} />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Launch at login</p>
          <p className="text-xs text-muted-foreground">Start GoodWebTools when you log in</p>
        </div>
        <button
          role="switch"
          aria-checked={prefs.startOnLogin}
          onClick={() => update('startOnLogin', !prefs.startOnLogin)}
          className={`relative w-10 h-5 rounded-full transition-colors focus:outline-none ${
            prefs.startOnLogin ? 'bg-blue-600' : 'bg-gray-400 dark:bg-gray-600'
          }`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            prefs.startOnLogin ? 'translate-x-5' : 'translate-x-0.5'
          }`} />
        </button>
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Screenshot format</p>
        <div className="flex gap-3">
          {(['png', 'jpg'] as const).map(fmt => (
            <button
              key={fmt}
              onClick={() => update('screenshotFormat', fmt)}
              className={`px-4 py-1.5 text-sm border-2 uppercase font-bold tracking-wide transition-colors ${
                prefs.screenshotFormat === fmt
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border hover:border-foreground'
              }`}
            >
              {fmt}
            </button>
          ))}
        </div>
      </div>

      {prefs.screenshotFormat === 'jpg' && (
        <div>
          <p className="text-sm font-medium mb-2">
            JPEG quality: <span className="font-mono">{prefs.screenshotQuality}%</span>
          </p>
          <input
            type="range"
            min={50}
            max={100}
            step={5}
            value={prefs.screenshotQuality}
            onChange={e => update('screenshotQuality', Number(e.target.value))}
            className="w-full"
          />
        </div>
      )}

      <button
        onClick={save}
        className="border-2 border-foreground bg-foreground text-background font-bold text-sm px-4 py-2 hover:opacity-90 transition-opacity"
      >
        {saved ? 'Saved ✓' : 'Save preferences'}
      </button>
    </div>
  );
}
