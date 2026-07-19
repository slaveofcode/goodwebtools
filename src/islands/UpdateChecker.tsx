import { useState, useEffect } from 'react';
import { isTauri } from '@tauri-apps/api/core';

interface UpdateInfo {
  version: string;
  date?: string;
  body?: string;
}

type State =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available'; info: UpdateInfo }
  | { status: 'up-to-date' }
  | { status: 'installing' }
  | { status: 'error'; message: string };

export default function UpdateChecker() {
  const [state, setState] = useState<State>({ status: 'idle' });
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    isTauri().then(setIsDesktop).catch(() => setIsDesktop(false));
  }, []);

  const check = async () => {
    setState({ status: 'checking' });
    try {
      // Dynamic import so the web build doesn't bundle Tauri APIs
      const { check: checkUpdate } = await import('@tauri-apps/plugin-updater');
      const update = await checkUpdate();
      if (update?.available) {
        setState({
          status: 'available',
          info: {
            version: update.version,
            date: update.date ?? undefined,
            body: update.body ?? undefined,
          },
        });
      } else {
        setState({ status: 'up-to-date' });
      }
    } catch (e) {
      setState({ status: 'error', message: String(e) });
    }
  };

  const install = async () => {
    if (state.status !== 'available') return;
    setState({ status: 'installing' });
    try {
      const { check: checkUpdate } = await import('@tauri-apps/plugin-updater');
      const update = await checkUpdate();
      if (update?.available) {
        await update.downloadAndInstall();
        // App will relaunch after install
      }
    } catch (e) {
      setState({ status: 'error', message: String(e) });
    }
  };

  if (!isDesktop) {
    return (
      <p className="text-sm text-muted-foreground">
        Auto-update is only available in the GoodWebTools desktop app.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {state.status === 'idle' && (
        <button
          onClick={check}
          className="border-2 border-foreground px-4 py-2 text-sm font-bold uppercase tracking-wide hover:bg-foreground hover:text-background transition-colors"
        >
          Check for updates
        </button>
      )}

      {state.status === 'checking' && (
        <p className="text-sm text-muted-foreground animate-pulse">Checking for updates…</p>
      )}

      {state.status === 'up-to-date' && (
        <div className="flex items-center gap-3">
          <span className="text-green-600 dark:text-green-400 font-bold">✓</span>
          <span className="text-sm">You're on the latest version.</span>
          <button onClick={check} className="text-xs text-muted-foreground hover:underline ml-auto">
            Check again
          </button>
        </div>
      )}

      {state.status === 'available' && (
        <div className="border-2 border-border p-4 space-y-3">
          <p className="text-sm font-bold">
            Update available: <span className="text-blue-600 dark:text-blue-400">v{state.info.version}</span>
            {state.info.date && (
              <span className="text-muted-foreground font-normal ml-2 text-xs">
                {new Date(state.info.date).toLocaleDateString()}
              </span>
            )}
          </p>
          {state.info.body && (
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto bg-muted p-3">
              {state.info.body}
            </pre>
          )}
          <button
            onClick={install}
            className="border-2 border-foreground bg-foreground text-background px-4 py-2 text-sm font-bold uppercase tracking-wide hover:opacity-90 transition-opacity"
          >
            Download &amp; Install
          </button>
        </div>
      )}

      {state.status === 'installing' && (
        <p className="text-sm text-muted-foreground animate-pulse">
          Downloading update… the app will restart when ready.
        </p>
      )}

      {state.status === 'error' && (
        <div className="space-y-2">
          <p className="text-sm text-red-600 dark:text-red-400">Update check failed: {state.message}</p>
          <button onClick={check} className="text-xs text-muted-foreground hover:underline">
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
