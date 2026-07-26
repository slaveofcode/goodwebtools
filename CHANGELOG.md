# Changelog

All notable changes to GoodWebTools are documented here.

## [1.0.0-beta.1] — 2026-07-19

### Desktop app (Tauri 2) — first beta release

**New features**

- **System-wide screenshot** via global hotkey (⌘⇧A on macOS)
  - Multi-display picker with live thumbnails
  - Region-selector overlay with drag-to-crop
  - Countdown window before capture
  - Main window auto-hides/restores around capture
- **Screen + audio recording**
  - Captures the full screen or a bounded region using platform-native APIs
  - Records system/microphone audio in parallel via FFmpeg (avfoundation / dshow / pulse)
  - Muxes audio + video on stop with graceful video-only fallback
- **System tray** (macOS menu bar)
  - Left-click to focus the main window
  - "Take Screenshot" shortcut directly from the tray menu
- **Native FFmpeg integration**
  - Bundled sidecar binary per platform (aarch64/x86_64 macOS, Windows, Linux)
  - Falls back to system `ffmpeg` if sidecar is absent
  - `bundle:check` pre-build script validates sidecar presence and icon assets
- **First-run permission wizard** (`/first-run`)
  - Checks Screen Recording, Microphone, and FFmpeg availability
  - One-click jump to System Preferences for each permission
  - Marks completion so the wizard only runs once
- **Settings page enhancements**
  - Desktop Preferences panel (screenshot format, tray toggle, launch-at-login)
  - Permission Status panel with live re-check
  - Auto-Updater panel (checks GitHub Releases, downloads and relaunches in place)
- **Download page** (`/download`)
  - Auto-detects OS and architecture, highlights the recommended installer
  - Links to GitHub Releases for macOS arm64/x64, Windows, Linux deb/AppImage
- **GitHub Actions release pipeline**
  - Builds macOS (Apple Silicon + Intel), Windows, Linux on `desktop-v*` tags
  - Runs full test suite before every build
  - Creates a GitHub Release (pre-release for alpha/beta tags)

**Service layer**

- `FileService` — native file dialogs and filesystem via `@tauri-apps/plugin-fs`
- `ClipboardService` — native clipboard via `@tauri-apps/plugin-clipboard-manager`
- `DownloadService` — native save dialog + ZIP support
- `AssetService` — intelligent cache management with configurable TTL
- `HotkeyService` — global shortcuts via `@tauri-apps/plugin-global-shortcut`

**Testing**

- 385 tests across 43 files (all passing)
- Full coverage for service layer Tauri implementations
- `global-hotkeys.ts` integration tests with module-isolation reset pattern

---

## [0.9.0] — prior web releases

See git log for the full history of the web app phases (tools 1–55, PDF suite,
ML image tools, Excalidraw whiteboard, SQLite playground, etc.).
