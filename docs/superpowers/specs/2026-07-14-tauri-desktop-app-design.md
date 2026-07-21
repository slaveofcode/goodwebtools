# GoodWebTools Desktop App Design Specification

**Author:** Claude + Kresna  
**Date:** 2026-07-14  
**Status:** Approved for Implementation  
**Version:** 1.0

---

## Executive Summary

This document specifies the architecture and implementation plan for **GoodWebTools Desktop**, a native desktop application built with Tauri 2 that wraps the existing web application and unlocks OS-level capabilities impossible in browsers:

- **System-wide screen capture** without consent pickers (ScreenCaptureKit / Windows.Graphics.Capture)
- **Global hotkeys** that work while the app is backgrounded or other apps are focused
- **Desktop region selector** (transparent overlay for marquee-select over the entire desktop)
- **System audio capture** on all platforms (not just Chrome/Windows)
- **Native FFmpeg** for 5-10× faster video processing
- **Native file dialogs** with no browser sandbox restrictions
- **Fully offline operation** (all WASM + ML models bundled)

**Core Architecture Principle:** One codebase, two shells (web + Tauri). All 55 tools share the same React components and logic. A service abstraction layer auto-detects the shell and routes to browser APIs (web) or Rust IPC (desktop). Zero code duplication.

**Scope:** Approach 3 (Big Bang) — ship v1.0 with all 5 native capabilities, all 55 tools refactored, complete desktop experience (Settings, system tray, auto-updater, permission wizard).

**Timeline:** 6-8 weeks from kickoff to v1.0.0 stable release.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Repository Structure](#2-repository-structure)
3. [Service Layer Design](#3-service-layer-design)
4. [Tauri Backend (Rust) Architecture](#4-tauri-backend-rust-architecture)
5. [Tool Refactoring Strategy](#5-tool-refactoring-strategy)
6. [Desktop-Specific Features](#6-desktop-specific-features)
7. [Download Page & Asset Serving](#7-download-page--asset-serving)
8. [Build & Release Pipeline](#8-build--release-pipeline)
9. [Testing Strategy](#9-testing-strategy)
10. [Error Handling & Edge Cases](#10-error-handling--edge-cases)
11. [Migration Path & Rollout Plan](#11-migration-path--rollout-plan)
12. [Success Metrics](#12-success-metrics)
13. [Post-Launch Roadmap](#13-post-launch-roadmap)

---

## 1. Architecture Overview

### 1.1 Core Principle

**One codebase, two shells (web + Tauri), unified by a service abstraction layer.**

```
┌─────────────────────────────────────────────────┐
│  React Tool Components (55 tools)              │
│  - Unchanged UI logic                          │
│  - Import from service layer, not browser APIs │
└─────────────┬───────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────┐
│  Service Layer (shell-agnostic interface)     │
│  - CaptureService, FileService, etc.          │
│  - Auto-detects shell via window.__TAURI__    │
└─────────────┬───────────────────────────────────┘
              │
        ┌─────┴─────┐
        │           │
┌───────▼─────┐  ┌──▼──────────────┐
│ Browser     │  │ Tauri Native    │
│ - fetch()   │  │ - Rust IPC      │
│ - File API  │  │ - ScreenKit     │
│ - MediaAPI  │  │ - Native dialog │
└─────────────┘  └─────────────────┘
```

### 1.2 Build Outputs

1. **Web:** `npm run build` → `dist/` → Cloudflare Workers (unchanged)
2. **Desktop:** `npm run build` → `dist/` → `tauri build` → `.dmg`/`.msi`/`.AppImage`

### 1.3 Key Architectural Decisions

- **Monorepo:** `src-tauri/` lives alongside `src/`, single `package.json`
- **Service registry:** Global singletons (`@/services/*`) detect shell at module load
- **No code duplication:** Tools, components, styles shared 100%
- **Astro unchanged:** Static build stays the same; Tauri consumes the `dist/` output
- **Asset bundling:** WASM + ML models copied into Tauri resources (no R2 dependency for desktop)

---

## 2. Repository Structure

### 2.1 Monorepo Layout

```
gwt/
├── src/                          # Existing Astro + React code
│   ├── islands/                  # Tool components (refactor to use services)
│   ├── services/                 # NEW: Service layer
│   │   ├── capture/
│   │   │   ├── index.ts          # Auto-exports browser or tauri impl
│   │   │   ├── browser.ts        # getDisplayMedia, MediaRecorder
│   │   │   ├── tauri.ts          # Rust IPC for ScreenCaptureKit
│   │   │   └── types.ts          # Shared interfaces
│   │   ├── file/
│   │   │   ├── index.ts
│   │   │   ├── browser.ts        # File System Access API
│   │   │   └── tauri.ts          # Native save/open dialog
│   │   ├── download/             # Browser download() vs Tauri fs::write
│   │   ├── asset/                # fetch vs Tauri asset protocol
│   │   ├── hotkey/               # No-op vs Tauri global-shortcut
│   │   ├── clipboard/            # Navigator.clipboard vs Tauri clipboard
│   │   └── platform/             # Shell detection utilities
│   ├── pages/
│   │   ├── download.astro        # NEW: Desktop app download page
│   │   └── settings.astro        # Extended with desktop-specific settings
│   └── ...
├── src-tauri/                    # NEW: Tauri Rust backend
│   ├── src/
│   │   ├── main.rs               # Window setup, tray, menu
│   │   ├── commands.rs           # IPC command handlers
│   │   ├── capture/
│   │   │   ├── mod.rs
│   │   │   ├── macos.rs          # ScreenCaptureKit (macOS 12.3+)
│   │   │   ├── windows.rs        # Windows.Graphics.Capture
│   │   │   └── linux.rs          # PipeWire portal
│   │   ├── hotkeys.rs            # Global shortcut registration
│   │   ├── overlay.rs            # Desktop marquee (transparent window)
│   │   ├── audio.rs              # System audio loopback capture
│   │   └── ffmpeg.rs             # Native ffmpeg via child process
│   ├── Cargo.toml
│   ├── tauri.conf.json           # Tauri config (bundler, permissions, etc.)
│   ├── icons/                    # App icons (1024x1024 source)
│   └── resources/                # Bundled assets (WASM, models)
│       ├── wasm/                 # mupdf, sqlite, ffmpeg.wasm, etc.
│       └── models/               # ML models (~540 MB)
├── worker/                       # NEW: Download tracking endpoint
│   └── download-tracker.js       # Logs download events, redirects to GitHub
├── scripts/
│   ├── bundle-tauri-assets.mjs   # NEW: Copy WASM/models to src-tauri/resources
│   └── ...
├── .github/
│   └── workflows/
│       └── release.yml           # NEW: tauri-action matrix build
├── package.json                  # Add tauri CLI scripts
└── ...
```

### 2.2 New npm Scripts

```json
{
  "scripts": {
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "tauri:bundle": "npm run build && tauri build"
  }
}
```

### 2.3 Asset Bundling Strategy

**Script:** `scripts/bundle-tauri-assets.mjs` runs before `tauri build`

**Purpose:** Copy `public/wasm/*` and `public/models/*` → `src-tauri/resources/`

**Result:** Desktop app loads from `asset://localhost/resources/*` (no network)

---

## 3. Service Layer Design

### 3.1 Six Core Services

All services abstract shell-specific APIs:

1. **CaptureService** — Screen/window/region capture, video recording
2. **FileService** — Open/save files with native dialogs
3. **DownloadService** — Save files to disk
4. **AssetService** — Load WASM/models from bundle
5. **HotkeyService** — Register global hotkeys
6. **ClipboardService** — Advanced clipboard operations

### 3.2 Service Interface Pattern

**Example: CaptureService**

```typescript
// src/services/capture/types.ts
export interface CaptureService {
  captureScreen(options?: CaptureOptions): Promise<Blob>;
  captureWindow(windowId?: string): Promise<Blob>;
  captureRegion(bounds: Rectangle): Promise<Blob>;
  startRecording(options: RecordOptions): Promise<RecordingHandle>;
  stopRecording(handle: RecordingHandle): Promise<Blob>;
  showRegionSelector(): Promise<Rectangle | null>;
  getCapabilities(): CaptureServiceCapabilities;
}

export interface CaptureOptions {
  format?: 'png' | 'jpeg';
  quality?: number;
  includeAudio?: boolean;
  systemAudio?: boolean; // Tauri-only
}

export interface CaptureServiceCapabilities {
  systemCapture: boolean;    // Capture without picker
  regionSelector: boolean;   // Desktop overlay
  systemAudio: boolean;      // System audio loopback
  globalHotkeys: boolean;    // OS-level hotkeys
}
```

### 3.3 Shell Detection & Auto-Export

```typescript
// src/services/capture/index.ts
import type { CaptureService } from './types';

let instance: CaptureService;

if (typeof window !== 'undefined' && window.__TAURI__) {
  const { TauriCaptureService } = await import('./tauri');
  instance = new TauriCaptureService();
} else {
  const { BrowserCaptureService } = await import('./browser');
  instance = new BrowserCaptureService();
}

export const captureService = instance;
export type { CaptureService, CaptureOptions } from './types';
```

### 3.4 Browser Implementation (Example)

```typescript
// src/services/capture/browser.ts
import type { CaptureService, CaptureOptions } from './types';

export class BrowserCaptureService implements CaptureService {
  async captureScreen(options?: CaptureOptions): Promise<Blob> {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { mediaSource: 'screen' }
    });
    
    const video = document.createElement('video');
    video.srcObject = stream;
    await video.play();
    
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    
    stream.getTracks().forEach(t => t.stop());
    
    return new Promise(resolve => {
      canvas.toBlob(blob => resolve(blob!), 
        `image/${options?.format || 'png'}`, 
        options?.quality
      );
    });
  }
  
  async showRegionSelector(): Promise<Rectangle | null> {
    // Not possible in browser
    return null;
  }
  
  getCapabilities() {
    return {
      systemCapture: false,
      regionSelector: false,
      systemAudio: false,
      globalHotkeys: false,
    };
  }
}
```

### 3.5 Tauri Implementation (Example)

```typescript
// src/services/capture/tauri.ts
import { invoke } from '@tauri-apps/api/tauri';
import type { CaptureService, CaptureOptions, Rectangle } from './types';

export class TauriCaptureService implements CaptureService {
  async captureScreen(options?: CaptureOptions): Promise<Blob> {
    try {
      const imageBytes: Uint8Array = await invoke('capture_screen', { options });
      return new Blob([imageBytes], { type: `image/${options?.format || 'png'}` });
    } catch (error) {
      // Fallback to browser API if native fails
      console.warn('Native capture failed, falling back to browser API', error);
      return this.browserFallback(options);
    }
  }
  
  async showRegionSelector(): Promise<Rectangle | null> {
    return await invoke('show_region_selector');
  }
  
  getCapabilities() {
    const platform = navigator.platform;
    return {
      systemCapture: true,
      regionSelector: platform !== 'Linux', // Linux WIP
      systemAudio: true,
      globalHotkeys: true,
    };
  }
  
  private async browserFallback(options?: CaptureOptions): Promise<Blob> {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    // ... same as browser impl
  }
}
```

### 3.6 Tool Usage (Unchanged Interface)

```tsx
// src/islands/media/Screenshot.tsx
import { captureService } from '@/services/capture';

export default function Screenshot() {
  const [capabilities, setCapabilities] = useState(captureService.getCapabilities());
  
  const handleCapture = async () => {
    if (capabilities.regionSelector) {
      const region = await captureService.showRegionSelector();
      if (region) {
        const blob = await captureService.captureRegion(region);
        // ... process image
      }
    } else {
      const blob = await captureService.captureScreen();
      // ... process image
    }
  };
  
  return (
    <div>
      <button onClick={handleCapture}>
        {capabilities.regionSelector ? 'Select Region' : 'Capture Screen'}
      </button>
    </div>
  );
}
```

**Key benefit:** Tool doesn't know or care if it's running in browser or Tauri. Same code works everywhere.

---

## 4. Tauri Backend (Rust) Architecture

### 4.1 Main Window & System Tray (`main.rs`)

**Responsibilities:**
- Initialize Tauri app with permissions
- Create main window (loads `index.html` from bundled `dist/`)
- System tray setup with menu:
  - "Capture Screenshot" → Triggers screenshot command
  - "Record Screen" → Opens screen recorder tool
  - "Open GoodWebTools" → Shows/focuses window
  - "Settings" → Opens settings page
  - "Quit" → Exits app
- Window close behavior: minimize to tray (configurable in Settings)
- First-run permission wizard detection

**Example:**
```rust
use tauri::{Manager, SystemTray, SystemTrayMenu, CustomMenuItem};

fn main() {
    let tray_menu = SystemTrayMenu::new()
        .add_item(CustomMenuItem::new("screenshot", "Capture Screenshot\tCmd+Shift+5"))
        .add_item(CustomMenuItem::new("record", "Record Screen\tCmd+Shift+6"))
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(CustomMenuItem::new("open", "Open GoodWebTools"))
        .add_item(CustomMenuItem::new("settings", "Settings"))
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(CustomMenuItem::new("quit", "Quit"));
    
    let system_tray = SystemTray::new().with_menu(tray_menu);
    
    tauri::Builder::default()
        .system_tray(system_tray)
        .on_system_tray_event(|app, event| {
            // Handle tray menu clicks
        })
        .on_window_event(|event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event.event() {
                // Minimize to tray instead of quit
                event.window().hide().unwrap();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            capture_screen,
            capture_region,
            show_region_selector,
            // ... all commands
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 4.2 IPC Commands (`commands.rs`)

**Tauri commands exposed to frontend:**

```rust
use tauri::command;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct CaptureOptions {
    format: Option<String>,
    quality: Option<f32>,
    include_audio: Option<bool>,
    system_audio: Option<bool>,
}

#[command]
pub async fn capture_screen(options: CaptureOptions) -> Result<Vec<u8>, String> {
    #[cfg(target_os = "macos")]
    return crate::capture::macos::capture_screen(options).await;
    
    #[cfg(target_os = "windows")]
    return crate::capture::windows::capture_screen(options).await;
    
    #[cfg(target_os = "linux")]
    return crate::capture::linux::capture_screen(options).await;
}

#[command]
pub async fn show_region_selector() -> Result<Option<Rectangle>, String> {
    crate::overlay::show_selector().await
}

#[command]
pub async fn register_hotkey(combo: String, callback_id: String) -> Result<String, String> {
    crate::hotkeys::register(combo, callback_id).await
}

// ... more commands
```

### 4.3 Platform-Specific Capture

**macOS (`capture/macos.rs`):**
```rust
use screencapturekit::*;

pub async fn capture_screen(options: CaptureOptions) -> Result<Vec<u8>, String> {
    // Check permission first
    if !CGPreflightScreenCaptureAccess() {
        return Err("Screen recording permission denied".into());
    }
    
    let content = SCShareableContent::current();
    let display = content.displays.first()
        .ok_or("No display found")?;
    
    let stream = SCStream::new(display, content, SCStreamConfiguration::default());
    let frame = stream.capture_frame().await?;
    
    // Convert to PNG/JPEG
    let image_data = frame.to_image(options.format.as_deref().unwrap_or("png"))?;
    
    Ok(image_data)
}
```

**Windows (`capture/windows.rs`):**
```rust
use windows::Graphics::Capture::*;

pub async fn capture_screen(options: CaptureOptions) -> Result<Vec<u8>, String> {
    let access = GraphicsCaptureAccess::RequestAccessAsync(
        GraphicsCaptureAccessKind::Programmatic
    ).await.map_err(|e| format!("Access denied: {:?}", e))?;
    
    // Capture primary monitor
    let item = GraphicsCaptureItem::TryCreateFromDisplayId(/* ... */)?;
    let frame_pool = Direct3D11CaptureFramePool::Create(/* ... */)?;
    let session = frame_pool.CreateCaptureSession(item)?;
    
    session.StartCapture()?;
    let frame = frame_pool.TryGetNextFrame()?;
    
    // Convert to image bytes
    let image_data = frame_to_bytes(frame, &options)?;
    
    Ok(image_data)
}
```

**Linux (`capture/linux.rs`):**
```rust
use ashpd::desktop::screenshot::*;

pub async fn capture_screen(options: CaptureOptions) -> Result<Vec<u8>, String> {
    let request = ScreenshotRequest::default()
        .interactive(false);
    
    let response = request.send().await
        .map_err(|e| format!("Portal request failed: {}", e))?;
    
    // Load image from file URI
    let image_data = std::fs::read(response.uri().path())?;
    
    Ok(image_data)
}
```

### 4.4 Desktop Region Selector (`overlay.rs`)

**Creates transparent, always-on-top, fullscreen window:**

```rust
use tauri::{Window, Manager};

pub async fn show_selector() -> Result<Option<Rectangle>, String> {
    let app = APP_HANDLE.get().unwrap();
    
    // Create transparent overlay window
    let overlay = tauri::WindowBuilder::new(
        app,
        "overlay",
        tauri::WindowUrl::App("overlay.html".into())
    )
    .title("Select Region")
    .fullscreen(true)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .decorations(false)
    .build()?;
    
    // Wait for user selection via event
    let (tx, rx) = tokio::sync::oneshot::channel();
    
    overlay.listen("region-selected", move |event| {
        let bounds: Rectangle = serde_json::from_str(event.payload()).unwrap();
        tx.send(Some(bounds)).ok();
    });
    
    overlay.listen("cancelled", move |_| {
        tx.send(None).ok();
    });
    
    let result = rx.await.unwrap_or(None);
    overlay.close()?;
    
    Ok(result)
}
```

### 4.5 Global Hotkeys (`hotkeys.rs`)

```rust
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

pub async fn register(combo: String, callback_id: String) -> Result<String, String> {
    let app = APP_HANDLE.get().unwrap();
    let shortcut = Shortcut::new(combo.as_str())
        .map_err(|e| format!("Invalid shortcut: {}", e))?;
    
    let id = format!("hotkey_{}", uuid::Uuid::new_v4());
    
    app.global_shortcut().register(shortcut, move || {
        // Emit event to frontend
        app.emit_all(&format!("hotkey:{}", callback_id), ()).ok();
    })?;
    
    Ok(id)
}
```

### 4.6 System Audio Capture (`audio.rs`)

**macOS:** AVFoundation + ScreenCaptureKit audio stream  
**Windows:** WASAPI loopback mode  
**Linux:** PulseAudio monitor source or PipeWire loopback

```rust
pub async fn start_system_audio_capture() -> Result<AudioHandle, String> {
    #[cfg(target_os = "macos")]
    return crate::audio::macos::start_capture().await;
    
    #[cfg(target_os = "windows")]
    return crate::audio::windows::start_capture().await;
    
    #[cfg(target_os = "linux")]
    return crate::audio::linux::start_capture().await;
}
```

### 4.7 Native FFmpeg Integration (`ffmpeg.rs`)

**Bundles platform-specific ffmpeg binary:**

```rust
use std::process::{Command, Stdio};

pub async fn convert_video(
    input: Vec<u8>,
    output_format: String,
) -> Result<Vec<u8>, String> {
    // Write input to temp file
    let temp_input = std::env::temp_dir().join("input.mp4");
    std::fs::write(&temp_input, input)?;
    
    let temp_output = std::env::temp_dir().join(format!("output.{}", output_format));
    
    // Get bundled ffmpeg path
    let ffmpeg_path = get_bundled_ffmpeg_path()?;
    
    // Run ffmpeg
    let status = Command::new(ffmpeg_path)
        .args(&[
            "-i", temp_input.to_str().unwrap(),
            "-c:v", "libx264",
            "-preset", "fast",
            temp_output.to_str().unwrap()
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .status()?;
    
    if !status.success() {
        return Err("FFmpeg conversion failed".into());
    }
    
    let output = std::fs::read(&temp_output)?;
    
    // Cleanup
    std::fs::remove_file(temp_input).ok();
    std::fs::remove_file(temp_output).ok();
    
    Ok(output)
}

fn get_bundled_ffmpeg_path() -> Result<PathBuf, String> {
    #[cfg(target_os = "macos")]
    return Ok(PathBuf::from("resources/ffmpeg/macos/ffmpeg"));
    
    #[cfg(target_os = "windows")]
    return Ok(PathBuf::from("resources/ffmpeg/windows/ffmpeg.exe"));
    
    #[cfg(target_os = "linux")]
    {
        // Try system ffmpeg first
        if which::which("ffmpeg").is_ok() {
            return Ok(PathBuf::from("ffmpeg"));
        }
        return Err("FFmpeg not found. Please install: sudo apt install ffmpeg".into());
    }
}
```

---

## 5. Tool Refactoring Strategy

### 5.1 Refactoring Pattern

**Before (direct browser API):**
```tsx
// src/islands/media/Screenshot.tsx
async function captureScreen() {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { mediaSource: 'screen' }
  });
  // ... canvas rendering ...
}
```

**After (service layer):**
```tsx
// src/islands/media/Screenshot.tsx
import { captureService } from '@/services/capture';

async function captureScreen() {
  const imageBlob = await captureService.captureScreen({ format: 'png' });
  // imageBlob ready to use
}
```

### 5.2 Tool Categories & Refactoring Order

**Week 1-2: Infrastructure + High-Value Tools**
1. Build service layer (all 6 services, browser + Tauri impls)
2. Refactor **Screen Recorder** + **Screenshot** (2 tools)
3. Refactor **Code Scratchpad** (1 tool)

**Week 3-4: File & Media Tools**
4. Refactor all **PDF tools** (10 tools)
5. Refactor **Video Converter**, **Audio Converter** (2 tools)
6. Refactor **Zip**, **Archive Extract**, **File Encrypt**, **File Split** (4 tools)

**Week 5: Image & ML Tools**
7. Refactor all **Image tools** (14 tools)
8. Test bundled ML models load correctly from Tauri resources

**Week 6: Dev Tools + Polish**
9. Refactor remaining **Dev/text tools** (17 tools)
10. Refactor **Whiteboard**, **Signature Pad**, **SQLite Playground** (3 tools)
11. Integration testing, bug fixes

**Total:** 55 tools refactored

### 5.3 Backwards Compatibility

**Critical:** Web app must continue working during and after refactoring.

**Strategy:**
- Service layer auto-detects browser vs Tauri
- If `window.__TAURI__` is undefined → browser implementations run
- No feature flags, no conditional imports in tools
- Web deployment unchanged (services compile to browser impls)

**Testing:**
- Run each refactored tool in **both** browser and Tauri
- Existing tool behavior must be preserved in browser
- Native enhancements only apply in Tauri

---

## 6. Desktop-Specific Features

### 6.1 First-Run Permission Wizard

**Trigger:** Runs once on first app launch (tracked via Tauri store).

**Flow:**
1. **Welcome screen:** "Welcome to GoodWebTools Desktop"
2. **Permission checklist:**
   - ☐ Screen Recording (macOS/Windows)
   - ☐ Accessibility (macOS, for global hotkeys)
   - ☐ Microphone (optional)
3. **Action buttons:** "Open System Preferences" / "Skip for Now" / "Done"

**Implementation:**
- Astro page: `src/pages/first-run.astro` (only shown in Tauri)
- Checks permission status via Tauri commands
- Links open System Preferences/Settings to Privacy & Security
- "Skip" → hides wizard, shows banner in app
- "Done" → marks wizard complete in Tauri store

### 6.2 Settings Page

**Route:** `src/pages/settings.astro`

**Sections:**

**General:**
- Default save location (folder picker, Tauri-only)
- Keep app running in background when closed (toggle, default: ON)
- Launch at system startup (toggle, default: OFF)
- Theme (Light / Dark / System)

**Global Hotkeys:** (Tauri-only)
- Screenshot: `[Cmd+Shift+5]` (editable combo box)
- Screen Recorder: `[Cmd+Shift+6]`
- Region Selector: `[Cmd+Shift+4]`
- "Record Hotkey" button (press any combo to capture)
- Reset to defaults

**Privacy:**
- **Usage Analytics:** `[ON]` (toggle, default: ON)
  - "Help improve GoodWebTools by sending anonymous usage data"
- **Crash Reporting:** `[OFF]` (toggle, default: ASK on first crash)
  - "Automatically send crash reports when the app fails"
- Links to privacy policy

**Updates:** (Tauri-only)
- Auto-update: `[ON]` (toggle, default: ON)
- Check for updates now (button)
- Current version: `v1.0.0`

**Storage:**
- Cache size: `1.2 GB`
- Clear cache (button)
- Open app data folder (button)

**About:**
- Version, build date
- Open source license (MIT)
- GitHub repo link
- Report an issue link

**Permission Status:** (Tauri-only)
- Screen Recording: ✅ Granted / ❌ Denied (with "Grant Access" button)
- Accessibility: ✅ Granted / ❌ Denied
- Microphone: ✅ Granted / ⚠️ Optional

### 6.3 System Tray / Menu Bar

**Always visible** (even when window closed).

**Menu structure:**
```
GoodWebTools
├── Capture Screenshot       (Cmd+Shift+5)
├── Record Screen            (Cmd+Shift+6)
├── ──────────────
├── Open GoodWebTools
├── Settings
├── ──────────────
├── Check for Updates
├── About
├── ──────────────
└── Quit
```

**Behavior:**
- Click menu item → triggers action immediately
- Tray icon persists while app is "closed" (minimized to tray)
- Global hotkeys work while app is hidden

### 6.4 Window Management

**Close button behavior:**
- Default: Minimize to tray (window hidden, app keeps running)
- If "Keep running in background" = OFF: Quit app
- Cmd+Q (macOS) / Alt+F4 (Windows): Always quits

**Window state persistence:**
- Remembers size, position across restarts
- Stored in Tauri store: `~/.config/goodwebtools/state.json`

### 6.5 Auto-Updater

**Uses `tauri-plugin-updater`:**

1. App checks GitHub Releases API on startup (if auto-update enabled)
2. Compares current version with latest release
3. If newer version available:
   - Shows notification: "GoodWebTools v1.1.0 is available"
   - Downloads installer in background
4. Once downloaded: "Update ready — Restart to install"
5. User clicks "Restart" → app quits, installer runs

**Fallback:** If updater fails, show manual download link

---

## 7. Download Page & Asset Serving

### 7.1 Download Page (`src/pages/download.astro`)

**URL:** `goodwebtools.com/download`

**Layout:**
- Hero: "GoodWebTools Desktop"
- Primary download button (OS-detected): "Download for macOS (Apple Silicon)"
- Secondary platform links: macOS (Intel), Windows, Linux
- "What's new in Desktop?" feature list
- Link to release notes on GitHub

**OS/Architecture Detection:**
```typescript
const userAgent = Astro.request.headers.get('user-agent') || '';
const platform = detectPlatform(userAgent); // 'macos-arm64' | 'macos-x64' | 'windows' | 'linux'
```

**Client-side architecture refinement:**
- JavaScript checks `navigator.platform` for Apple Silicon detection
- Shows both macOS download buttons if unsure

### 7.2 Download Tracking Endpoint

**Endpoint:** `goodwebtools.com/api/download/:platform`

**Implementation:** Cloudflare Worker (`worker/download-tracker.js`)

**Flow:**
1. User clicks "Download for macOS" → hits `/api/download/macos-arm64`
2. Worker logs download event (OS, architecture, timestamp, country)
3. Worker **immediately redirects** (HTTP 302) to GitHub release asset URL
4. Actual file bytes stream **directly from GitHub to user**

**Benefits:**
- Track downloads without bandwidth costs
- Zero Worker CPU overhead (just redirect)
- GitHub's CDN handles delivery

**Implementation:**
```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const platform = url.pathname.split('/').pop();
    const channel = url.searchParams.get('channel') || 'stable';
    
    // Log download
    await logDownload(platform, channel, request, env);
    
    // Fetch release from GitHub
    const release = await getRelease(channel, env.GITHUB_TOKEN);
    
    // Map platform to asset
    const assetMap = {
      'macos-arm64': /GoodWebTools.*aarch64\.dmg$/,
      'macos-x64': /GoodWebTools.*x64\.dmg$/,
      'windows': /GoodWebTools.*\.msi$/,
      'linux-appimage': /GoodWebTools.*\.AppImage$/,
      'linux-deb': /GoodWebTools.*\.deb$/,
    };
    
    const asset = release.assets.find(a => assetMap[platform]?.test(a.name));
    
    if (!asset) {
      return new Response('Asset not found', { status: 404 });
    }
    
    // Redirect to GitHub
    return Response.redirect(asset.browser_download_url, 302);
  }
};
```

### 7.3 Staging Releases

**Strategy:** Pre-release tags on GitHub

**Production:**
```bash
git tag desktop-v1.0.0
→ GitHub Release (stable)
→ download page shows under "Stable Release"
```

**Beta:**
```bash
git tag desktop-v1.1.0-beta.1
→ GitHub Release (pre-release flag)
→ download page shows under "Beta Release (Testing)"
```

**Detection:**
```javascript
// worker/download-tracker.js
async function getRelease(channel, token) {
  if (channel === 'beta') {
    const res = await fetch('https://api.github.com/repos/slaveofcode/goodwebtools/releases');
    const releases = await res.json();
    return releases.find(r => r.prerelease);
  } else {
    const res = await fetch('https://api.github.com/repos/slaveofcode/goodwebtools/releases/latest', {
      headers: { 'Authorization': `token ${token}` }
    });
    return res.json();
  }
}
```

**Download URL:**
- Stable: `/api/download/macos-arm64`
- Beta: `/api/download/macos-arm64?channel=beta`

### 7.4 Cloudflare Costs (Download Tracking)

**Free tier:**
- Workers: 100,000 requests/day free
- Bandwidth: Unlimited (redirects are cheap)

**At scale:**
- 1,000 downloads/day = 30k req/month = **FREE**
- 10,000 downloads/day = 300k req/month = **FREE**
- 100,000 downloads/day = 3M req/month = **$5/mo**

**Recommendation:** Start with free tier, monitor usage.

---

## 8. Build & Release Pipeline

### 8.1 GitHub Actions Workflow

**File:** `.github/workflows/release.yml`

**Triggers:** Push tags matching `desktop-v*`

**Matrix build:**
```yaml
name: Release Desktop App

on:
  push:
    tags:
      - 'desktop-v*'

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: 'macos-latest'
            target: 'aarch64-apple-darwin'
          - platform: 'macos-latest'
            target: 'x86_64-apple-darwin'
          - platform: 'windows-latest'
            target: 'x86_64-pc-windows-msvc'
          - platform: 'ubuntu-22.04'
            target: 'x86_64-unknown-linux-gnu'

    runs-on: ${{ matrix.platform }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}
      
      - name: Install dependencies (Ubuntu)
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.0-dev librsvg2-dev
      
      - name: Install Node dependencies
        run: npm ci
      
      - name: Build Astro (web assets)
        run: npm run build
        
      - name: Bundle Tauri assets
        run: node scripts/bundle-tauri-assets.mjs
      
      - name: Build Tauri app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: 'GoodWebTools ${{ github.ref_name }}'
          releaseBody: 'See CHANGELOG.md for details.'
          releaseDraft: false
          prerelease: ${{ contains(github.ref_name, 'beta') || contains(github.ref_name, 'alpha') }}
```

**Outputs:**
- `.dmg` files (macOS Intel + Apple Silicon)
- `.msi` installer (Windows)
- `.AppImage` + `.deb` (Linux)
- Automatically attached to GitHub Release

### 8.2 Asset Bundling Script

**File:** `scripts/bundle-tauri-assets.mjs`

**Purpose:** Copy WASM + ML models into Tauri resources before build

```javascript
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const SOURCE_DIRS = ['public/wasm', 'public/models'];
const TARGET_DIR = 'src-tauri/resources';

console.log('Bundling assets for Tauri...');

mkdirSync(TARGET_DIR, { recursive: true });

for (const sourceDir of SOURCE_DIRS) {
  const targetSubDir = join(TARGET_DIR, sourceDir.replace('public/', ''));
  mkdirSync(targetSubDir, { recursive: true });
  copyRecursive(sourceDir, targetSubDir);
}

function copyRecursive(src, dest) {
  const files = readdirSync(src);
  for (const file of files) {
    const srcPath = join(src, file);
    const destPath = join(dest, file);
    if (statSync(srcPath).isDirectory()) {
      mkdirSync(destPath, { recursive: true });
      copyRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
      console.log(`  ✓ ${srcPath} → ${destPath}`);
    }
  }
}

console.log('Asset bundling complete.');
```

### 8.3 Release Asset Naming

**Format:** `GoodWebTools_{version}_{arch}.{ext}`

**Examples:**
- `GoodWebTools_1.0.0_aarch64.dmg` (macOS Apple Silicon)
- `GoodWebTools_1.0.0_x64.dmg` (macOS Intel)
- `GoodWebTools_1.0.0_x64.msi` (Windows)
- `GoodWebTools_1.0.0_amd64.AppImage` (Linux)
- `GoodWebTools_1.0.0_amd64.deb` (Debian/Ubuntu)

### 8.4 Code Signing (Future Phase)

**Currently:** Ship unsigned (users see warnings).

**When ready to sign:**

**macOS:**
1. Enroll in Apple Developer Program ($99/year)
2. Create signing certificate + provisioning profile
3. Add to GitHub secrets: `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`
4. Update workflow with notarization steps

**Windows:**
1. Purchase code signing certificate (~$200-400/year)
2. Add to GitHub secrets: `WINDOWS_CERTIFICATE`
3. Update `tauri.conf.json` with certificate thumbprint

**Linux:** No signing required

### 8.5 Release Process

**Steps:**
```bash
# 1. Finish features, test locally
npm run tauri:dev

# 2. Update version in package.json and tauri.conf.json

# 3. Commit and tag
git add .
git commit -m "chore: bump version to 1.0.0"
git tag desktop-v1.0.0
git push origin develop
git push origin desktop-v1.0.0

# 4. GitHub Actions builds (~15-20 min)
# 5. Test installers on each platform
# 6. Edit release notes on GitHub
# 7. Publish release
```

---

## 9. Testing Strategy

### 9.1 Testing Layers

**Layer 1: Service Unit Tests**
- Test each service independently (browser and Tauri)
- Mock Tauri IPC calls in tests
- Verify fallback behavior

**Layer 2: Tool Integration Tests**
- Test refactored tools use services correctly
- Verify tools work in both browser and Tauri contexts

**Layer 3: Tauri Command Tests**
- Test Rust IPC commands with mock data
- Verify permission checks work

**Layer 4: End-to-End Tests**
- Manual testing checklist (all platforms)
- Test each native capability

### 9.2 Platform-Specific Testing Matrix

| Feature | macOS | Windows | Linux |
|---------|-------|---------|-------|
| Screen capture (no picker) | ✓ | ✓ | ✓ |
| Desktop region selector | ✓ | ✓ | ✓ |
| Global hotkeys | ✓ | ✓ | ✓ |
| System audio capture | ✓ | ✓ | ✓ |
| Native file dialogs | ✓ | ✓ | ✓ |
| System tray icon | ✓ | ✓ | ✓ |
| Auto-updater | ✓ | ✓ | ✓ |

### 9.3 Regression Testing (Web App)

**Critical:** Ensure web app continues working.

**Test suite:**
1. Run existing tests: `npm test` (all 259 tests must pass)
2. Visual regression: Screenshot each tool in browser
3. Smoke test: Open every tool, verify no console errors

**CI check:**
```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm test
      - run: npm run build
```

### 9.4 Manual Testing Checklist (Pre-Release)

**Desktop app:**
- [ ] First launch triggers permission wizard
- [ ] Screen capture works without picker
- [ ] Desktop region selector overlay works
- [ ] Global hotkey triggers from any app
- [ ] System audio records in screen recording
- [ ] Native file dialogs open for all file tools
- [ ] Settings persist across restarts
- [ ] System tray menu works
- [ ] Close window minimizes to tray
- [ ] Auto-updater detects new version
- [ ] All 55 tools work correctly
- [ ] App works completely offline
- [ ] Analytics opt-out works

**Web app (regression):**
- [ ] All tools still work in browser
- [ ] Service Worker still caches assets
- [ ] No new console errors
- [ ] All 259 tests pass

### 9.5 Beta Testing Program

1. **Internal alpha** (week 1-2): Developer + close testers
2. **Public beta** (week 3-4): Tag `desktop-v1.0.0-beta.1`, collect feedback
3. **Release candidate** (week 5): Tag `desktop-v1.0.0-rc.1`, final testing
4. **v1.0.0 stable** (week 6): Tag `desktop-v1.0.0`, announce publicly

---

## 10. Error Handling & Edge Cases

### 10.1 Permission Denial Handling (All Platforms)

#### macOS

**Required permissions:**
- Screen Recording (System Preferences → Privacy & Security)
- Accessibility (for global hotkeys)
- Microphone (optional)

**Error handling:**
```typescript
async captureScreen(options: CaptureOptions): Promise<Blob> {
  try {
    const hasPermission = await invoke('check_screen_recording_permission');
    if (!hasPermission) {
      throw new PermissionError('screen_recording', 'macOS', 
        'Open System Preferences → Privacy & Security → Screen Recording and enable GoodWebTools.'
      );
    }
    return await invoke('capture_screen', { options });
  } catch (error) {
    // Handle...
  }
}
```

**Rust helper:**
```rust
#[tauri::command]
pub fn open_system_settings(permission: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let url = match permission.as_str() {
            "screen_recording" => "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
            "accessibility" => "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
            "microphone" => "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone",
            _ => return Err("Unknown permission".into()),
        };
        std::process::Command::new("open").arg(url).spawn().ok();
    }
    Ok(())
}
```

#### Windows

**Required permissions:**
- Graphics Capture (granted automatically on first use)
- Microphone (Windows privacy settings)

**Error handling:**
```typescript
async captureScreen(options: CaptureOptions): Promise<Blob> {
  try {
    return await invoke('capture_screen', { options });
  } catch (error) {
    if (error.includes('access denied') || error.includes('0x80070005')) {
      throw new PermissionError('graphics_capture', 'Windows',
        'Screen capture was blocked. Try:\n' +
        '1. Settings → Privacy & Security → Screenshots and apps\n' +
        '2. Enable "Let apps record your screen"'
      );
    }
    throw error;
  }
}
```

**Rust helper:**
```rust
#[cfg(target_os = "windows")]
{
    let url = match permission.as_str() {
        "graphics_capture" => "ms-settings:privacy-graphicscaptureprogrammatic",
        "microphone" => "ms-settings:privacy-microphone",
        _ => "ms-settings:privacy",
    };
    std::process::Command::new("cmd")
        .args(&["/C", "start", url])
        .spawn()
        .ok();
}
```

#### Linux

**Desktop portals (Wayland):**
- Uses XDG Desktop Portal (PipeWire)
- User selects screen/window each time (by design)

**Error handling:**
```typescript
async captureScreen(options: CaptureOptions): Promise<Blob> {
  try {
    return await invoke('capture_screen', { options });
  } catch (error) {
    if (error.includes('portal')) {
      throw new PermissionError('portal', 'Linux',
        'Screen capture requires Desktop Portal support.\n' +
        'Ensure xdg-desktop-portal and pipewire are installed:\n' +
        '  sudo apt install xdg-desktop-portal pipewire'
      );
    }
    if (error.includes('cancelled')) {
      throw new UserCancelledError('Screen capture cancelled by user.');
    }
    throw error;
  }
}
```

#### Unified Permission Error UI

```typescript
// src/components/PermissionErrorModal.tsx
function PermissionErrorModal({ error, onRetry, onCancel }) {
  const { permission, platform, instructions } = error;
  
  return (
    <Modal title={`${permission} Permission Required`}>
      <p>GoodWebTools needs {permission} access to use this feature.</p>
      
      <div className="instructions">
        <p><strong>How to grant permission ({platform}):</strong></p>
        <pre>{instructions}</pre>
      </div>
      
      {platform !== 'Linux' && (
        <button onClick={() => invoke('open_system_settings', { permission })}>
          Open System Settings
        </button>
      )}
      
      <div className="actions">
        <button onClick={onCancel}>Cancel</button>
        <button onClick={onRetry}>I've Granted Permission — Retry</button>
      </div>
    </Modal>
  );
}
```

**Settings page permission status:**
```tsx
<section>
  <h3>Permissions Status</h3>
  <ul>
    <li>
      Screen Recording: {permissions?.screenRecording ? '✅ Granted' : '❌ Denied'}
      {!permissions?.screenRecording && (
        <button onClick={() => invoke('open_system_settings', { permission: 'screen_recording' })}>
          Grant Access
        </button>
      )}
    </li>
    <li>Accessibility: {permissions?.accessibility ? '✅ Granted' : '❌ Denied'}</li>
    <li>Microphone: {permissions?.microphone ? '✅ Granted' : '⚠️ Optional'}</li>
  </ul>
</section>
```

### 10.2 Platform Feature Detection

```typescript
export interface CaptureServiceCapabilities {
  systemCapture: boolean;
  regionSelector: boolean;
  systemAudio: boolean;
  globalHotkeys: boolean;
}

getCapabilities(): CaptureServiceCapabilities {
  const platform = navigator.platform;
  return {
    systemCapture: true,
    regionSelector: platform !== 'Linux', // Linux WIP
    systemAudio: true,
    globalHotkeys: true,
  };
}
```

**UI adapts:**
```tsx
const capabilities = captureService.getCapabilities();

{capabilities.regionSelector ? (
  <button onClick={selectRegion}>Select Region</button>
) : (
  <button onClick={captureFullScreen}>Capture Full Screen</button>
)}
```

### 10.3 Graceful Degradation

**If native feature fails, fall back to browser:**

```typescript
async captureScreen(options: CaptureOptions): Promise<Blob> {
  try {
    return await this.nativeCapture(options);
  } catch (error) {
    console.warn('Native capture failed, falling back to browser API', error);
    return await this.browserFallback(options);
  }
}
```

### 10.4 Offline Asset Loading

```typescript
// src/services/asset/tauri.ts
import { convertFileSrc } from '@tauri-apps/api/tauri';

async loadModel(path: string): Promise<ArrayBuffer> {
  const assetUrl = convertFileSrc(`resources/${path}`);
  const response = await fetch(assetUrl);
  if (!response.ok) {
    throw new Error(`Failed to load bundled asset: ${path}`);
  }
  return response.arrayBuffer();
}
```

### 10.5 Large File Handling

```typescript
const MAX_VIDEO_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB
const MAX_IMAGE_SIZE = 500 * 1024 * 1024;      // 500 MB

async function processVideo(file: File) {
  if (file.size > MAX_VIDEO_SIZE) {
    throw new Error(
      `File too large (${formatBytes(file.size)}). Maximum: ${formatBytes(MAX_VIDEO_SIZE)}.`
    );
  }
  
  return convertVideo(file, {
    onProgress: (percent) => updateProgress(percent)
  });
}
```

### 10.6 Multi-Monitor Support

```rust
#[tauri::command]
pub async fn list_displays() -> Result<Vec<Display>, String> {
    // Platform-specific: enumerate displays
}

#[tauri::command]
pub async fn capture_display(display_id: String) -> Result<Vec<u8>, String> {
    // Capture specific display by ID
}
```

**UI shows display picker:**
```tsx
const displays = await invoke('list_displays');

<select onChange={e => setDisplayId(e.target.value)}>
  {displays.map(d => (
    <option key={d.id} value={d.id}>
      {d.name} {d.is_primary && '(Primary)'} - {d.bounds.width}×{d.bounds.height}
    </option>
  ))}
</select>
```

### 10.7 Update Failures

```typescript
import { checkUpdate, installUpdate } from '@tauri-apps/api/updater';

async function checkForUpdates() {
  try {
    const { shouldUpdate, manifest } = await checkUpdate();
    if (shouldUpdate) {
      const willUpdate = confirm(`Update to ${manifest.version} available. Install now?`);
      if (willUpdate) {
        await installUpdate();
      }
    }
  } catch (error) {
    console.error('Update check failed:', error);
    showNotification({
      title: 'Update Available',
      message: 'Auto-update failed. Download manually?',
      actions: [
        { label: 'Download', onClick: () => open('https://goodwebtools.com/download') }
      ]
    });
  }
}
```

### 10.8 Crash Recovery & Reporting

**Two separate privacy controls:**

1. **Usage Analytics** (default: ON)
   - Which tools are used, feature adoption
   - Google Analytics (web) + custom telemetry (desktop)

2. **Crash Reporting** (default: ASK on first crash)
   - Stack traces, error messages, system info
   - Sentry or Tauri's crash handler

**Settings page:**
```tsx
<section>
  <h3>Privacy</h3>
  
  <label>
    <input type="checkbox" checked={analyticsEnabled} onChange={toggleAnalytics} />
    Usage Analytics
  </label>
  <p className="text-sm">
    Help improve GoodWebTools by sending anonymous usage data. 
    No file contents or personal data is collected.
  </p>
  
  <label>
    <input type="checkbox" checked={crashReportingEnabled} onChange={toggleCrashReporting} />
    Crash Reporting
  </label>
  <p className="text-sm">
    Automatically send crash reports when the app fails. 
    Includes error messages and stack traces. No file contents are included.
  </p>
</section>
```

**First crash flow:**
```
┌─────────────────────────────────────────┐
│ GoodWebTools encountered an error       │
│                                         │
│ Would you like to send a crash report? │
│                                         │
│ The report includes:                   │
│ • Error message and stack trace        │
│ • App version and OS details           │
│ • Memory usage at time of crash        │
│                                         │
│ ✗ No file contents or personal data    │
│                                         │
│ [ ] Always send crash reports          │
│                                         │
│ [Don't Send]  [Send Report]            │
└─────────────────────────────────────────┘
```

**What crash reports include:**
- ✓ Error message, stack trace
- ✓ App version, OS version, architecture
- ✓ Memory usage, active tool
- ✗ File contents, file names, personal data, IP addresses

**Implementation (Sentry recommended):**
```rust
// src-tauri/src/main.rs
let _guard = sentry::init(("https://your-dsn@sentry.io/project", sentry::ClientOptions {
    release: Some(env!("CARGO_PKG_VERSION").into()),
    before_send: Some(Arc::new(|event| {
        if crash_reporting_enabled() {
            Some(event)
        } else {
            None
        }
    })),
    ..Default::default()
}));
```

---

## 11. Migration Path & Rollout Plan

### 11.1 Development Phases (6-8 weeks)

**Phase 0: Foundation (Week 1)**
- Set up Tauri project (`src-tauri/`)
- Configure `tauri.conf.json`
- Build service layer interfaces (TypeScript)
- Create `PlatformService` to detect shell
- First "Hello World" Tauri build

**Phase 1: Core Services (Week 1-2)**
- Implement all 6 services (browser + Tauri)
- Build Rust IPC commands
- Unit tests for service layer
- Verify service detection works

**Phase 2: Native Capture (Week 2-3)**
- macOS: ScreenCaptureKit integration
- Windows: Windows.Graphics.Capture
- Linux: PipeWire portal
- Desktop region selector overlay
- Global hotkey registration

**Phase 3: High-Value Tools (Week 3)**
- Refactor Screen Recorder + Screenshot (2 tools)
- Refactor Code Scratchpad (1 tool)
- Prove architecture works end-to-end

**Phase 4: File & Media Tools (Week 4)**
- Refactor PDF tools (10 tools)
- Refactor Video/Audio converters (5 tools)
- Refactor File tools (4 tools)
- Integrate native FFmpeg

**Phase 5: Image & ML Tools (Week 5)**
- Refactor all Image tools (14 tools)
- Bundle ML models in Tauri resources
- Test fully offline

**Phase 6: Remaining Tools (Week 5-6)**
- Refactor Dev/Text tools (17 tools)
- Refactor Drawing tools (2 tools)
- Refactor SQLite Playground (1 tool)

**Phase 7: Desktop Features (Week 6)**
- First-run permission wizard
- Settings page (all sections)
- System tray menu
- Auto-updater integration
- Analytics + crash reporting

**Phase 8: Build & Release (Week 6-7)**
- GitHub Actions workflow
- Asset bundling script
- Download page + tracking endpoint
- Test installers on all platforms

**Phase 9: Testing & Polish (Week 7)**
- Manual testing checklist
- Bug fixes
- Performance optimization

**Phase 10: Beta Release (Week 7)**
- Tag `desktop-v1.0.0-beta.1`
- Announce on GitHub
- Collect feedback

**Phase 11: v1.0.0 Stable (Week 8)**
- Tag `desktop-v1.0.0`
- Update download page
- Announce publicly

### 11.2 Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Platform-specific bugs | Test on all platforms continuously (VMs for Win/Linux) |
| ML models bundle too large | Analyze usage, consider lazy download or "lite" build |
| Refactoring breaks web app | Run full test suite after each tool refactored |
| Permission flows confuse users | Clear first-run wizard with screenshots, beta test with non-technical users |
| Timeline slips | Phase 3 proves architecture; can ship with subset of tools |

---

## 12. Success Metrics

**Launch targets (first 3 months):**
- 1,000 desktop app downloads
- <5% crash rate
- 70%+ retention (users who download use it weekly)
- Top 3 most-used tools identified via analytics

**Quality bars:**
- All 259 existing tests pass
- No regression in web app functionality
- <50ms service layer overhead vs direct browser APIs
- <200 MB app bundle size (excluding ML models)

---

## 13. Post-Launch Roadmap

**v1.1 (3 months after v1.0):**
- System audio capture (capability #4)
- Native FFmpeg fast-paths (capability #5)
- Performance optimizations
- User-reported bug fixes

**v1.2 (6 months):**
- Linux desktop marquee selector (full parity)
- Scrolling capture of web pages
- Plugin system (community-contributed tools)

**v2.0 (12 months):**
- Native window capture of other apps
- OCR integration
- Cloud sync (optional, privacy-preserving)

---

## Appendix A: Technology Stack

**Frontend:**
- Astro 4.16+ (static site generator)
- React 18+ (tool islands)
- Tailwind CSS (styling)
- Monaco Editor (code scratchpad)

**Backend (Desktop):**
- Tauri 2 (Rust + webview wrapper)
- ScreenCaptureKit (macOS capture)
- Windows.Graphics.Capture (Windows capture)
- PipeWire (Linux capture)

**Services:**
- Cloudflare Workers (web hosting)
- Cloudflare R2 (ML models for web)
- GitHub Releases (desktop installers)
- GitHub Actions (CI/CD)
- Sentry (crash reporting, optional)

**Build Tools:**
- Vite (bundler)
- TypeScript (type safety)
- Vitest (testing)
- Tauri CLI (desktop builds)

---

## Appendix B: Deployment Matrix

| Artifact | Source | Build Command | Deploy Target | Trigger |
|----------|--------|---------------|---------------|---------|
| Web app | `src/` | `npm run build` | Cloudflare Workers | `git push origin main` |
| Desktop (macOS ARM) | `src/` + `src-tauri/` | `tauri build --target aarch64-apple-darwin` | GitHub Releases | `git tag desktop-v*` |
| Desktop (macOS Intel) | `src/` + `src-tauri/` | `tauri build --target x86_64-apple-darwin` | GitHub Releases | `git tag desktop-v*` |
| Desktop (Windows) | `src/` + `src-tauri/` | `tauri build --target x86_64-pc-windows-msvc` | GitHub Releases | `git tag desktop-v*` |
| Desktop (Linux) | `src/` + `src-tauri/` | `tauri build --target x86_64-unknown-linux-gnu` | GitHub Releases | `git tag desktop-v*` |

---

## Appendix C: File Size Estimates

| Component | Size | Notes |
|-----------|------|-------|
| Astro `dist/` | ~15 MB | HTML/CSS/JS + small WASM |
| ML models | ~540 MB | ESRGAN, LaMa, Background Removal, MediaPipe |
| Native FFmpeg (macOS) | ~70 MB | Universal binary |
| Native FFmpeg (Windows) | ~80 MB | x64 binary |
| Tauri runtime | ~5 MB | Webview wrapper |
| **Total desktop bundle** | ~700-750 MB | First launch download |

**Optimizations considered:**
- Lazy-load ML models on first use (reduces initial download)
- Offer "Desktop Lite" without ML tools (~100 MB)
- On-demand FFmpeg download for video tools

---

## Sign-Off

**Approved by:** Kresna (kresnapmn@gmail.com)  
**Date:** 2026-07-14  
**Next Step:** Invoke `writing-plans` skill to create implementation plan

---

**End of Design Specification**
