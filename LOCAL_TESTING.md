# Local Testing Checklist

## Quick Start

```bash
npm run dev
```

Visit: http://localhost:4321

---

## ✅ Feature Testing Checklist

### 1. Homepage & Navigation
- [ ] Homepage loads at http://localhost:4321
- [ ] No console errors in DevTools
- [ ] Privacy page accessible at http://localhost:4321/privacy

### 2. Theme System
- [ ] Theme toggle button visible in header
- [ ] Click toggle switches between light/dark
- [ ] Theme persists on page refresh
- [ ] No flash of wrong theme on load

### 3. Command Palette (⌘K)
- [ ] Press ⌘K (Mac) or Ctrl+K (Windows/Linux)
- [ ] Palette opens with input auto-focused
- [ ] Type to search immediately (no click needed)
- [ ] Empty search shows all tools
- [ ] Search "hash" → shows Hash File tool
- [ ] Search "sha" → shows Hash File tool
- [ ] Search "256" → shows Hash File tool
- [ ] Search "generate" → shows Hash File tool
- [ ] Click tool → navigates to tool page
- [ ] Press Escape → closes palette
- [ ] Click backdrop → closes palette

### 4. Hash Demo Tool
Visit: http://localhost:4321/tools/hash-demo

- [ ] Page loads without errors
- [ ] Dropzone visible with instructions
- [ ] Click dropzone → file picker opens
- [ ] Select a file → worker starts processing
- [ ] Progress bar shows during processing
- [ ] Hash result displays (64-character hex string)
- [ ] Download button appears after completion
- [ ] Click download → saves .sha256 file
- [ ] Drag & drop file → also works
- [ ] Theme toggle works on tool page
- [ ] ⌘K works on tool page

### 5. Service Worker (PWA)
Check DevTools → Application tab:

- [ ] Service worker registered
- [ ] Manifest shows "GoodWebTools"
- [ ] No service worker errors

### 6. Performance Verification
Check DevTools → Network tab:

- [ ] Initial page load < 100 KB transferred
- [ ] No external requests (all same-origin)
- [ ] Resources load from localhost only
- [ ] CSS and JS bundles are gzipped

### 7. Build Verification

```bash
npm run build
npm run preview
```

- [ ] Build completes without errors
- [ ] Preview server runs at http://localhost:4321
- [ ] All features work in production build
- [ ] Service worker generates (dist/sw.js exists)

---

## 🐛 Common Issues & Fixes

### Dev server won't start
```bash
# Kill existing process
pkill -f "astro dev"
# Restart
npm run dev
```

### Port 4321 already in use
```bash
# Kill process on port
lsof -ti:4321 | xargs kill -9
# Or use different port
npm run dev -- --port 3000
```

### Build errors
```bash
# Clean and rebuild
rm -rf dist/ .astro/
npm run build
```

### Theme not persisting
- Check browser localStorage (DevTools → Application → Local Storage)
- Should see `theme: "dark"` or `theme: "light"`

### Command palette not opening
- Check browser console for errors
- Verify keyboard shortcut (⌘K on Mac, Ctrl+K on Windows/Linux)
- Try clicking outside and retry

---

## 🧪 Manual Testing Script

Run through this quick test:

1. **Start fresh:**
   ```bash
   npm run dev
   ```

2. **Homepage:**
   - Visit http://localhost:4321
   - Toggle theme (light → dark → light)
   - Refresh page (theme should persist)

3. **Command Palette:**
   - Press ⌘K
   - Type "hash" (should show Hash File)
   - Press Escape to close

4. **Hash Tool:**
   - Press ⌘K, select "Hash File"
   - Create test file: `echo "test" > test.txt`
   - Drag test.txt into dropzone
   - Wait for hash result
   - Click download button
   - Verify test.txt.sha256 downloaded

5. **DevTools Check:**
   - Open Network tab
   - Reload page
   - Verify: All requests to localhost
   - Verify: No external domains

**If all pass:** ✅ Phase 0 working locally!

---

## 📝 Testing Notes

- **Browser compatibility:** Test in Chrome/Edge (modern browsers only)
- **File size limits:** Hash demo tested with files up to 100MB
- **Worker support:** Requires modern browser with Web Worker support
- **localStorage:** Required for theme persistence

---

## Next: Phase 1 Tools

Once local testing passes, you're ready to add Phase 1 tools:
1. JSON Formatter
2. Base64 Encoder
3. URL Encoder
4. And more...

Each new tool follows the same pattern as Hash Demo.
