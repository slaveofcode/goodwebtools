# Changelog

All notable changes to GoodWebTools are documented here.

## [1.0.0-beta.5] — 2026-08-28

### Added
- **AI Agent (Ask Agent):** a fully client-side assistant at `/ask-agent` (EN + Bahasa) that runs GoodWebTools tools for you by chatting — on-device via WebGPU or with your own API key (OpenAI, Anthropic, OpenRouter, Groq, Gemini, OpenCode). Over 40 tools run headless in the background — compress/convert/trim images, video and audio, make QR codes, hash and encode text, format JSON/CSV/TOML, and more — and every other tool is opened for you by smart routing across the whole library.
- **Home:** collapsible tool categories with a category jump-nav and a mobile floating category button for quick navigation.

### Changed
- Mobile header decluttered — language and theme controls moved into the overflow menu, keeping Search and Ask Agent one tap away.

## [1.0.0-beta.4] — 2026-08-27

A large batch bundling roughly a month of new tools and fixes.

### Added
- **Documents:** iWork viewer (Pages/Numbers/Keynote — now with real tables, images, and full slide navigation), legacy `.doc` viewer (Word 97–2003), PPTX slide rendering, DICOM medical-image viewer, EML email viewer, GEDCOM family-tree viewer, and PDF ↔ Word/Excel conversion.
- **Media:** **Teleprompter / Autocue** with voice-tracking, mirror, camera, and a phone-remote control; Text to Speech (on-device neural voices, WAV/MP3); Live Captions; local Music & Video players; a Meditation session generator; and focus & audio tools (white noise, binaural, metronome, tuner).
- **Games** (new category): 2048, Flying Bird, Snake, Dino Run, Block Puzzle, Onet Connect, and Wheel Spinner / Random Picker.
- **Calculators** (new category): Age & Weton, Unit Converter, KPR/mortgage, Zakat, THR, percentage/tip/discount, timezone, countdown, and roman numerals.
- **Testers** (new category): Device Test cluster — microphone, webcam, speaker, keyboard, mouse, and screen.
- **Image:** Pas Foto passport maker (guided camera capture with live framing help + auto-align), HEIC → JPG, Meme Generator, Color-Blindness Simulator, and Scan Deskew & Crop.
- **PDF:** true redaction, Sign PDF, Organize PDF, Booklet Imposition, Metadata Scrubber, and PDF → Excel (CSV).
- **Dev:** API Client, Cron tools (parse + natural-language → cron), Regex Tester, Barcode generator & scanner, QRIS decoder, WCAG contrast checker, NIK/KTP decoder, and a set of developer reference tools.
- **Bahasa Indonesia** interface: localized tool names, summaries, and category labels.

### Fixed
- Mobile playability for games (Snake on-screen D-pad; Dino Run no longer stretches in fullscreen), SSR hydration mismatches in 2048 and Block Puzzle, whiteboard autosave reliability, blank map tiles, QR/QRIS decoding from photos, and PDF image extraction.

### Changed
- Peer-to-peer tools (File Transfer, Video Call, and the Teleprompter phone remote) now use a TURN relay for reliable cross-network connectivity.
- Improved tool search (stemming) and reordered the homepage categories (Image, PDF, Documents, Dev first).

## [1.0.0-beta.3] — 2026-07-27

### Added
- Desktop app now **bundles FFmpeg**, so screen recording with audio works without a separate system FFmpeg install.

### Fixed
- **Unix Timestamp Converter** now detects and converts microsecond (16-digit) and nanosecond (19-digit) values instead of failing with a parse error.

### Changed
- Internal: resolved all source-code lint warnings (no behavior change).

## [1.0.0-beta.2] — 2026-07-27

### Fixed
- Desktop auto-updater now publishes its manifest + signatures (`latest.json` / `.sig`) so update checks work.
- Dark mode no longer resets to light when navigating between pages.
- SVG export handles multi-MB files; monochrome and image viewers render correctly.

### Changed
- **Settings** and **Hotkey Test** are now desktop-only — hidden on the web.

### Added
- New tools: **DB Diagram** (DBML ER designer with SQL/image export), **SVG Viewer & Converter**, **Image Viewer & Metadata**, **Black/White & Monochrome**.
- **Edit in Annotator** handoff on every image-producing tool.

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
