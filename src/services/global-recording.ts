// Global screen-recording manager.
//
// Recording must survive independent of the Screen Recorder component so a
// system-wide hotkey (⌘⇧R) can start/stop it from anywhere. This module is the
// single source of truth for recording state; both the global hotkey and the
// in-page UI drive it, and it emits DOM events the component subscribes to.

import { captureService } from './capture';
import type { RecordingHandle, Rectangle } from './capture';
import { isTauri } from './platform';

const SETTINGS_KEY = 'gwt-recorder-settings';
const RECORDER_ROUTE = '/tools/screen-recorder';

export interface RecorderSettings {
  displayId?: number;
  format: 'webm' | 'mp4';
  fps: number;
  includeAudio: boolean;
  hideWindow: boolean;
}

const DEFAULTS: RecorderSettings = {
  format: 'webm',
  fps: 10,
  includeAudio: false,
  hideWindow: true,
};

export function getRecorderSettings(): RecorderSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* ignore malformed settings */
  }
  return { ...DEFAULTS };
}

export function saveRecorderSettings(partial: Partial<RecorderSettings>): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...getRecorderSettings(), ...partial }));
  } catch {
    /* ignore quota errors */
  }
}

// ── Recording state (module singleton) ──────────────────────────────────────

let activeHandle: RecordingHandle | null = null;
let busy = false; // guards the start/stop transition
let managedWindow = false; // whether WE minimized the window (so WE restore it)

export function isRecording(): boolean {
  return activeHandle !== null;
}

function emitState(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('gwt:recording-state', { detail: { recording: isRecording() } }),
  );
}

async function minimizeWindow(): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('minimize_main_window');
  managedWindow = true;
  // Let the minimize animation settle before capture begins.
  await new Promise((r) => setTimeout(r, 250));
}

async function restoreWindow(): Promise<void> {
  if (!isTauri() || !managedWindow) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('show_main_window').catch(() => {});
  managedWindow = false;
}

/**
 * Start a recording. `manageWindow` lets the manager minimize/restore the main
 * window around the session (the hotkey path). No-op if already recording.
 */
export async function startManaged(opts: {
  format: 'webm' | 'mp4';
  fps: number;
  includeAudio: boolean;
  displayId?: number;
  bounds?: Rectangle;
  manageWindow: boolean;
}): Promise<void> {
  if (activeHandle || busy) return;
  busy = true;
  try {
    if (opts.manageWindow) await minimizeWindow();
    activeHandle = await captureService.startRecording({
      format: opts.format,
      includeAudio: opts.includeAudio,
      fps: opts.fps,
      displayId: opts.displayId,
      bounds: opts.bounds,
    });
    emitState();
  } catch (e) {
    await restoreWindow();
    throw e;
  } finally {
    busy = false;
  }
}

/** Stop the active recording and return the produced blob (or null if none). */
export async function stopManaged(): Promise<Blob | null> {
  if (!activeHandle || busy) return null;
  busy = true;
  const handle = activeHandle;
  try {
    const blob = await captureService.stopRecording(handle);
    activeHandle = null;
    await restoreWindow();
    emitState();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('gwt:recording-result', { detail: { blob } }));
    }
    return blob;
  } catch (e) {
    activeHandle = null;
    await restoreWindow();
    emitState();
    throw e;
  } finally {
    busy = false;
  }
}

/**
 * Global hotkey entry point: toggle a full-screen recording from anywhere.
 * On stop, if the Screen Recorder page isn't open (no UI to show the result),
 * the file is downloaded directly; otherwise the mounted component shows it.
 */
export async function toggleGlobalRecording(): Promise<void> {
  if (!isTauri()) return;

  if (isRecording()) {
    let blob: Blob | null = null;
    try {
      blob = await stopManaged();
    } catch (e) {
      console.error('[GlobalRecording] stop failed:', e);
      return;
    }
    if (!blob) return;

    const onRecorderPage =
      typeof window !== 'undefined' && window.location.pathname.startsWith(RECORDER_ROUTE);
    if (onRecorderPage) {
      // The mounted component already received `gwt:recording-result`.
      return;
    }
    // No recorder UI here — hand the file straight to the user.
    try {
      const { downloadService } = await import('./download');
      await downloadService.download(blob, `screen-recording.${getRecorderSettings().format}`);
    } catch (e) {
      console.error('[GlobalRecording] auto-download failed:', e);
    }
    return;
  }

  // Start a full-screen recording using the last-configured settings.
  const s = getRecorderSettings();
  try {
    await startManaged({
      format: s.format,
      fps: s.fps,
      includeAudio: s.includeAudio,
      displayId: s.displayId,
      manageWindow: true,
    });
  } catch (e) {
    console.error('[GlobalRecording] start failed:', e);
  }
}
