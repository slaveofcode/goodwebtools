import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface PermissionStatus {
  screenRecording: boolean;
  microphone: boolean;
  ffmpegAvailable: boolean;
  firstRun: boolean;
}

function Row({ label, ok, action, onAction }: {
  label: string;
  ok: boolean;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <div className="flex items-center gap-3">
        <span className={`text-sm font-medium ${ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {ok ? '✓' : '✗'}
        </span>
        <span className="text-sm">{label}</span>
      </div>
      {!ok && action && onAction && (
        <button
          onClick={onAction}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          {action}
        </button>
      )}
    </div>
  );
}

export default function PermissionStatus() {
  const [perms, setPerms] = useState<PermissionStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const status = await invoke<PermissionStatus>('check_permissions');
      setPerms(status);
    } catch {
      // not in Tauri context
    }
  };

  useEffect(() => { load(); }, []);

  const openPrefs = (section: string) => {
    invoke('open_system_preferences', { section }).catch(() => {});
  };

  const recheck = async () => {
    setLoading(true);
    await load();
    setLoading(false);
  };

  if (!perms) return null;

  return (
    <div>
      <Row
        label="Screen Recording"
        ok={perms.screenRecording}
        action="Open System Preferences →"
        onAction={() => openPrefs('screen-recording')}
      />
      <Row
        label="Microphone"
        ok={perms.microphone}
        action="Open System Preferences →"
        onAction={() => openPrefs('microphone')}
      />
      <Row
        label="FFmpeg"
        ok={perms.ffmpegAvailable}
        action="Install: brew install ffmpeg"
        onAction={() => {}}
      />
      <div className="mt-4">
        <button
          onClick={recheck}
          disabled={loading}
          className="text-sm border border-border px-3 py-1.5 hover:bg-muted transition-colors disabled:opacity-50"
        >
          {loading ? 'Checking…' : 'Re-check permissions'}
        </button>
      </div>
    </div>
  );
}
