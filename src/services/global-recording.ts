// Global screen-recording manager.
//
// Recording must survive independent of the Screen Recorder component so a
// system-wide hotkey (⌘⇧R) can start/stop it from anywhere. This module is the
// single source of truth for recording state; both the global hotkey and the
// in-page UI drive it, and it emits DOM events the component subscribes to.

import { captureService } from './capture';
import type { RecordingHandle, Rectangle, DisplayInfo } from './capture';
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
let startedAt: number | null = null; // epoch ms when capture actually began

export function isRecording(): boolean {
  return activeHandle !== null;
}

/** Epoch ms the current recording started (after any countdown), or null. */
export function getRecordingStartedAt(): number | null {
  return startedAt;
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

/** Always bring the main window back to front (used when a recording stops, so
 *  ⌘⇧R reliably reveals the app regardless of who minimized it). */
async function showMainWindow(): Promise<void> {
  managedWindow = false;
  if (!isTauri()) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('show_main_window').catch(() => {});
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.slice(i, i + 8192));
  }
  return `data:${blob.type};base64,${btoa(binary)}`;
}

/**
 * Show a 5-second countdown centered on the target display before recording
 * starts. Also signals which screen is being recorded (the countdown appears on
 * it). The countdown window self-closes after counting down.
 */
async function showCountdown(displayId?: number): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await import('@tauri-apps/api/core');
  try {
    // Capture the area behind the 400×400 countdown window so it blends in.
    const displays = await captureService.listDisplays();
    const target =
      displays.find((d) => d.id === displayId) || displays.find((d) => d.isMain) || displays[0];
    if (target) {
      const bounds = {
        x: Math.floor((target.width - 400) / 2),
        y: Math.floor((target.height - 400) / 2),
        width: 400,
        height: 400,
        displayId: target.id,
      };
      try {
        localStorage.setItem(
          'countdown-screenshot',
          await blobToDataUrl(await captureService.captureRegion(bounds)),
        );
      } catch {
        /* the countdown still works without a background */
      }
    }
    await invoke('show_countdown', { displayId });
    // Countdown runs 5→1 then closes itself (~5.2s).
    await new Promise((r) => setTimeout(r, 5200));
  } finally {
    try {
      localStorage.removeItem('countdown-screenshot');
    } catch {
      /* ignore */
    }
  }
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
  countdown?: boolean;
}): Promise<void> {
  if (activeHandle || busy) return;
  busy = true;
  try {
    if (opts.manageWindow) await minimizeWindow();
    if (opts.countdown) await showCountdown(opts.displayId);
    activeHandle = await captureService.startRecording({
      format: opts.format,
      includeAudio: opts.includeAudio,
      fps: opts.fps,
      displayId: opts.displayId,
      bounds: opts.bounds,
    });
    startedAt = Date.now();
    emitState();
  } catch (e) {
    startedAt = null;
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
    startedAt = null;
    await showMainWindow(); // always reveal the app when recording ends
    emitState();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('gwt:recording-result', { detail: { blob } }));
    }
    return blob;
  } catch (e) {
    activeHandle = null;
    startedAt = null;
    await showMainWindow();
    emitState();
    throw e;
  } finally {
    busy = false;
  }
}

// ── Multi-display picker (shared with the screenshot flow's screen selector) ─

let pendingRecordingSelect = false;

/** True (once) if a screen pick is pending for a recording, so the shared
 *  `screen-selected` listener routes to recording instead of screenshot. */
export function consumePendingRecordingSelect(): boolean {
  if (!pendingRecordingSelect) return false;
  pendingRecordingSelect = false;
  return true;
}

/** Capture per-display thumbnails and open the screen-picker window; recording
 *  starts once the user picks (via `startRecordingOnDisplay`). */
async function showScreenPicker(displays: DisplayInfo[]): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  const thumbnails = await Promise.all(
    displays.map(async (display) => {
      try {
        const blob = await captureService.captureScreen({
          format: 'jpg',
          quality: 0.3,
          displayId: display.id,
        });
        return { display, dataUrl: await blobToDataUrl(blob) };
      } catch {
        return null;
      }
    }),
  );
  try {
    localStorage.setItem('gwt-screen-thumbnails', JSON.stringify(thumbnails.filter(Boolean)));
  } catch {
    /* ignore quota */
  }
  pendingRecordingSelect = true;
  await invoke('show_screen_selector');
}

/** Continue a recording after the user picks a display in the screen picker. */
export async function startRecordingOnDisplay(displayId: number): Promise<void> {
  saveRecorderSettings({ displayId });
  const s = getRecorderSettings();
  try {
    await startManaged({
      format: s.format,
      fps: s.fps,
      includeAudio: s.includeAudio,
      displayId,
      manageWindow: true,
      countdown: true,
    });
  } catch (e) {
    console.error('[GlobalRecording] start failed:', e);
  }
}

/**
 * Global hotkey entry point: toggle recording from anywhere. When starting with
 * multiple displays, the screen picker opens first; recording begins after the
 * user chooses. On stop, if the Screen Recorder page isn't open the file is
 * downloaded directly; otherwise the mounted component shows it.
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

  // Ignore repeat presses while the screen picker is already open.
  if (pendingRecordingSelect) return;

  // Starting: with multiple displays, ask which screen first.
  let displays: DisplayInfo[] = [];
  try {
    displays = await captureService.listDisplays();
  } catch {
    /* fall back to the configured display below */
  }

  if (displays.length > 1) {
    await showScreenPicker(displays);
    return; // recording begins in startRecordingOnDisplay after the user picks
  }

  // Single (or unknown) display — record it directly with the saved settings.
  const s = getRecorderSettings();
  try {
    await startManaged({
      format: s.format,
      fps: s.fps,
      includeAudio: s.includeAudio,
      displayId: displays[0]?.id ?? s.displayId,
      manageWindow: true,
      countdown: true,
    });
  } catch (e) {
    console.error('[GlobalRecording] start failed:', e);
  }
}
