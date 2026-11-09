import { describe, it, expect, vi } from 'vitest';
import { MENU_ITEMS, MENU_GROUPS, toolUrl, pickLang, findMenuItem, embedUrl, DEFAULT_PANEL_TOOLS, PRODUCTIVITY_TOOLS, HANDY_PANEL_TOOLS } from './menus.js';
import { createHandoffStore, isFresh, bytesToBase64, TTL_MS } from './handoff-store.js';
import { searchTools, pushRecent, toggleFavorite } from './search.js';

describe('menus', () => {
  it('has unique ids and a tool + payload for each item', () => {
    expect(new Set(MENU_ITEMS.map(m => m.id)).size).toBe(MENU_ITEMS.length);
    for (const m of MENU_ITEMS) {
      expect(['image', 'selection', 'link', 'page', 'compare', 'password', 'page-text', 'page-links', 'page-shot']).toContain(m.payload);
      // Everything opens a tool except the ones handled in place (password) or on an extension page (links).
      if (!['password', 'page-links'].includes(m.payload)) expect(m.tool).toMatch(/^[a-z0-9-]+$/);
      if (m.group) expect(MENU_GROUPS[m.group]).toBeTruthy();
    }
    expect(findMenuItem('img-compress').tool).toBe('image-compress');
    expect(findMenuItem('nope')).toBeNull();
  });
  it('builds tool URLs with locale and handoff id', () => {
    expect(toolUrl('https://goodwebtools.com', 'json-viewer', 'en', 'abc-12345')).toBe('https://goodwebtools.com/tools/json-viewer/#gwt-handoff=abc-12345');
    expect(toolUrl('http://localhost:4321/', 'qr-gen', 'id')).toBe('http://localhost:4321/id/tools/qr-gen/');
    expect(toolUrl(undefined, 'base64', 'en')).toBe('https://goodwebtools.com/tools/base64/');
  });
  it('builds embed URLs for the side panel', () => {
    expect(embedUrl('https://goodwebtools.com', 'music-player', 'en')).toBe('https://goodwebtools.com/tools/music-player/?embed=1');
    expect(embedUrl('https://goodwebtools.com', 'notepad', 'id')).toBe('https://goodwebtools.com/id/tools/notepad/?embed=1');
    expect(DEFAULT_PANEL_TOOLS[0]).toBe('music-player');
  });
  it('picks the site language', () => {
    expect(pickLang('en', 'id')).toBe('en');
    expect(pickLang(undefined, 'id-ID')).toBe('id');
    expect(pickLang(undefined, 'en-US')).toBe('en');
  });
});

describe('handoff store', () => {
  const fakeSession = () => {
    const data = {};
    return {
      data,
      set: vi.fn(async o => Object.assign(data, o)),
      get: vi.fn(async k => (k in data ? { [k]: data[k] } : {})),
      remove: vi.fn(async k => { delete data[k]; }),
    };
  };
  it('hands a payload over once', async () => {
    const store = createHandoffStore(fakeSession());
    const id = await store.put({ kind: 'text', text: 'hi' });
    expect(id).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    expect(await store.take(id)).toEqual({ kind: 'text', text: 'hi' });
    expect(await store.take(id)).toBeNull();
  });
  it('survives a service-worker restart via session storage', async () => {
    const session = fakeSession();
    const id = await createHandoffStore(session).put({ kind: 'text', text: 'x' });
    expect(await createHandoffStore(session).take(id)).toEqual({ kind: 'text', text: 'x' });
  });
  it('expires after the TTL', async () => {
    const store = createHandoffStore(fakeSession());
    const id = await store.put({ kind: 'text', text: 'x' }, 0);
    expect(await store.take(id, TTL_MS + 1)).toBeNull();
    expect(isFresh({ at: 0 }, TTL_MS - 1)).toBe(true);
  });
  it('keeps big payloads in memory when session storage refuses them', async () => {
    const session = fakeSession();
    session.set = vi.fn(async () => { throw new Error('QUOTA_BYTES quota exceeded'); });
    const store = createHandoffStore(session);
    const id = await store.put({ kind: 'file', base64: 'x'.repeat(10) });
    expect(await store.take(id)).toEqual({ kind: 'file', base64: 'x'.repeat(10) });
  });
  it('encodes large byte arrays to base64', () => {
    const bytes = new Uint8Array(100000).map((_, i) => i % 256);
    expect(atob(bytesToBase64(bytes)).length).toBe(100000);
    expect(bytesToBase64(new TextEncoder().encode('hello'))).toBe(btoa('hello'));
  });
});

describe('search', () => {
  const tools = [
    { id: 'json-format', name: 'JSON Formatter', nameId: 'JSON Formatter', summary: 'Format JSON', keywords: ['json', 'beautify'] },
    { id: 'json-viewer', name: 'JSON Viewer', nameId: 'Penampil JSON', summary: 'Tree', keywords: ['json tree'] },
    { id: 'image-compress', name: 'Image Compressor', nameId: 'Kompres Gambar', summary: 'Shrink images', keywords: ['compress', 'kecilkan'] },
    { id: 'pdf-compress', name: 'Compress PDF', nameId: 'Kompres PDF', summary: 'Smaller PDFs', keywords: ['compress'] },
  ];
  it('ranks name matches first and needs every word to match', () => {
    expect(searchTools(tools, 'json view').map(t => t.id)).toEqual(['json-viewer']);
    expect(searchTools(tools, 'compress').map(t => t.id)).toEqual(['pdf-compress', 'image-compress']);
    expect(searchTools(tools, 'compress image').map(t => t.id)).toEqual(['image-compress']);
  });
  it('matches Indonesian names and keywords', () => {
    expect(searchTools(tools, 'penampil')[0].id).toBe('json-viewer');
    expect(searchTools(tools, 'kompres gambar')[0].id).toBe('image-compress');
  });
  it('returns nothing for an empty query', () => {
    expect(searchTools(tools, '   ')).toEqual([]);
  });
  it('keeps recents deduped and capped, and toggles favorites', () => {
    expect(pushRecent(['a', 'b', 'c'], 'b', 3)).toEqual(['b', 'a', 'c']);
    expect(pushRecent(['a', 'b', 'c'], 'd', 3)).toEqual(['d', 'a', 'b']);
    expect(toggleFavorite(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleFavorite(['a', 'b'], 'a')).toEqual(['b']);
  });
});

import { pickMimeType, formatDuration, recordingFileName, canHandOff, formatBytes, MAX_HANDOFF_BYTES, gifPlan } from './recording.js';

describe('recording helpers', () => {
  it('picks the best supported WebM type', () => {
    expect(pickMimeType(t => t === 'video/webm;codecs=vp8,opus' || t === 'video/webm')).toBe('video/webm;codecs=vp8,opus');
    expect(pickMimeType(() => false)).toBe('');
    expect(pickMimeType(() => { throw new Error('x'); })).toBe('');
  });
  it('formats durations', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65_000)).toBe('1:05');
    expect(formatDuration(3_723_000)).toBe('1:02:03');
  });
  it('names recordings by local date and time', () => {
    expect(recordingFileName(new Date(2026, 10, 5, 14, 3))).toBe('gwt-recording-2026-11-05-1403.webm');
  });
  it('hands off only reasonably small recordings', () => {
    expect(canHandOff(0)).toBe(false);
    expect(canHandOff(MAX_HANDOFF_BYTES)).toBe(true);
    expect(canHandOff(MAX_HANDOFF_BYTES + 1)).toBe(false);
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(52_428_800)).toBe('50 MB');
  });
});

import { colorFormats, largestFromSrcset, cleanImageList, imageFileName, uniqueNames, capturePlan, mediaKind, cleanMediaList, isMediaBlockedSite, parseM3u8, mediaExtension, strongPassword, linksToCsv } from './page-helpers.js';

describe('page helpers', () => {
  it('formats a picked color', () => {
    expect(colorFormats('#7c3aed')).toEqual({ hex: '#7C3AED', rgb: 'rgb(124, 58, 237)', hsl: 'hsl(262, 83%, 58%)' });
    expect(colorFormats('#ffffff').hsl).toBe('hsl(0, 0%, 100%)');
    expect(colorFormats('nope')).toBeNull();
  });
  it('picks the largest srcset candidate', () => {
    expect(largestFromSrcset('a.jpg 480w, b.jpg 1080w, c.jpg 720w')).toBe('b.jpg');
    expect(largestFromSrcset('a.jpg 1x, a@2x.jpg 2x')).toBe('a@2x.jpg');
    expect(largestFromSrcset('')).toBeNull();
  });
  it('cleans an image list: no duplicates, icons or odd URLs; biggest first', () => {
    const list = cleanImageList([
      { src: 'https://x/a.jpg', width: 800, height: 600 },
      { src: 'https://x/a.jpg', width: 800, height: 600 },
      { src: 'https://x/icon.png', width: 16, height: 16 },
      { src: 'blob:https://x/1', width: 500, height: 500 },
      { src: 'https://x/big.png', width: 2000, height: 1000 },
      { src: 'data:image/png;base64,AAA', width: 0, height: 0 },
    ]);
    expect(list.map(i => i.src)).toEqual(['https://x/big.png', 'https://x/a.jpg', 'data:image/png;base64,AAA']);
  });
  it('names downloaded images, keeping them unique', () => {
    expect(imageFileName('https://x/photos/My%20Cat.JPG?w=1', 0, 'webp')).toBe('001-My-Cat.webp');
    expect(imageFileName('data:image/png;base64,AA', 4, 'png')).toBe('005-image-5.png');
    expect(uniqueNames(['a.png', 'a.png', 'b.png', 'a.png'])).toEqual(['a.png', 'a-2.png', 'b.png', 'a-3.png']);
  });
  it('plans full-page capture steps', () => {
    expect(capturePlan(2500, 1000)).toEqual({ ys: [0, 1000, 1500], height: 2500, truncated: false });
    expect(capturePlan(800, 1000)).toEqual({ ys: [0], height: 800, truncated: false });
    expect(capturePlan(50000, 1000, 3000)).toEqual({ ys: [0, 1000, 2000], height: 3000, truncated: true });
  });
});

describe('media helpers', () => {
  it('classifies media by type or extension', () => {
    expect(mediaKind('https://x/a.MP3?t=1')).toBe('audio');
    expect(mediaKind('https://x/clip.webm')).toBe('video');
    expect(mediaKind('https://x/live/index.m3u8')).toBe('hls');
    expect(mediaKind('https://x/stream', 'application/vnd.apple.mpegurl')).toBe('hls');
    expect(mediaKind('https://x/file', 'audio/ogg')).toBe('audio');
    expect(mediaKind('https://x/page.html')).toBeNull();
  });
  it('cleans the media list: http(s) only, one per URL, video first, labels kept', () => {
    const list = cleanMediaList([
      { src: 'https://x/song.mp3', kind: null, label: '' },
      { src: 'https://x/song.mp3#t=10', kind: 'audio', label: 'My song' },
      { src: 'blob:https://x/1', kind: 'video' },
      { src: 'https://x/page', kind: null },
      { src: 'https://x/v.mp4', kind: 'video', label: 'Clip' },
      { src: 'https://x/hls/master.m3u8', kind: null },
      { src: 'https://x/no-ext', kind: 'video', label: '' },
    ]);
    expect(list).toEqual([
      { src: 'https://x/v.mp4', kind: 'video', label: 'Clip' },
      { src: 'https://x/no-ext', kind: 'video', label: '' },
      { src: 'https://x/hls/master.m3u8', kind: 'hls', label: '' },
      { src: 'https://x/song.mp3', kind: 'audio', label: 'My song' },
    ]);
  });
  it('blocks YouTube and SoundCloud pages', () => {
    for (const u of ['https://www.youtube.com/watch?v=a', 'https://m.youtube.com/', 'https://music.youtube.com/x', 'https://youtu.be/a', 'https://soundcloud.com/artist/track']) expect(isMediaBlockedSite(u)).toBe(true);
    for (const u of ['https://example.com/', 'https://notyoutube.com/', 'nope']) expect(isMediaBlockedSite(u)).toBe(false);
  });
  it('parses an HLS master playlist, best variant first', () => {
    const pl = parseM3u8('#EXTM3U\n#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=9,BANDWIDTH=800000,RESOLUTION=640x360\nlow/index.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=2400000,RESOLUTION=1280x720\nhttps://cdn/hi.m3u8\n', 'https://x/v/master.m3u8');
    expect(pl).toEqual({ type: 'master', variants: [
      { url: 'https://cdn/hi.m3u8', bandwidth: 2400000, resolution: '1280x720' },
      { url: 'https://x/v/low/index.m3u8', bandwidth: 800000, resolution: '640x360' },
    ] });
  });
  it('parses an HLS media playlist: segments, init, encryption, live', () => {
    const vod = parseM3u8('#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:4,\ns1.m4s\n#EXTINF:4,\ns2.m4s\n#EXT-X-ENDLIST', 'https://x/a/p.m3u8');
    expect(vod).toEqual({ type: 'media', segments: ['https://x/a/s1.m4s', 'https://x/a/s2.m4s'], init: 'https://x/a/init.mp4', encrypted: false, live: false });
    expect(parseM3u8('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="k"\n#EXTINF:4,\na.ts\n#EXT-X-ENDLIST', 'https://x/').encrypted).toBe(true);
    expect(parseM3u8('#EXTM3U\n#EXT-X-KEY:METHOD=NONE\n#EXTINF:4,\na.ts', 'https://x/')).toMatchObject({ encrypted: false, live: true });
    expect(parseM3u8('not a playlist', 'https://x/')).toBeNull();
  });
  it('picks a file extension for saved media', () => {
    expect(mediaExtension('https://x/a.ogg', 'audio/ogg', 'audio')).toBe('ogg');
    expect(mediaExtension('https://x/stream', 'audio/mpeg', 'audio')).toBe('mp3');
    expect(mediaExtension('https://x/stream', 'video/webm; codecs=vp9', 'video')).toBe('webm');
    expect(mediaExtension('https://x/stream', '', 'video')).toBe('mp4');
  });
});

describe('protected media and GIF plans', () => {
  it('drops protected media, and network-only finds on a DRM page', () => {
    const items = [
      { src: 'https://x/locked.mp4', kind: 'video', restricted: true },
      { src: 'https://x/locked.mp4', kind: null },
      { src: 'https://x/seg.mp4', kind: null, via: 'network' },
      { src: 'https://x/free.mp3', kind: 'audio' },
    ];
    expect(cleanMediaList(items).map(m => m.src)).toEqual(['https://x/seg.mp4', 'https://x/free.mp3']);
    expect(cleanMediaList(items, { drm: true }).map(m => m.src)).toEqual(['https://x/free.mp3']);
  });
  it('plans GIF size and length', () => {
    expect(gifPlan(1920, 1080, 45000)).toEqual({ width: 480, height: 270, fps: 10, seconds: 30, truncated: true });
    expect(gifPlan(320, 240, 4000)).toEqual({ width: 320, height: 240, fps: 10, seconds: 4, truncated: false });
    expect(gifPlan(641, 361, Infinity, { maxSeconds: 10 })).toMatchObject({ width: 480, height: 270, seconds: 10, truncated: false });
  });
});

import { waitForFrame, surfaceOf } from './capture-wait.js';

describe('waiting for the first capture frame', () => {
  it('resolves at once when a frame is there, without warning', async () => {
    const onSlow = vi.fn();
    await expect(waitForFrame({ readyState: 4, videoWidth: 800 }, { onSlow })).resolves.toEqual({ waited: false });
    expect(onSlow).not.toHaveBeenCalled();
  });
  it('warns once while a background tab sends nothing, then resolves when it shows', async () => {
    vi.useFakeTimers();
    try {
      const video = { readyState: 0, videoWidth: 0 };
      const onSlow = vi.fn();
      const done = waitForFrame(video, { slowMs: 1000, onSlow });
      await vi.advanceTimersByTimeAsync(3000);
      expect(onSlow).toHaveBeenCalledTimes(1);
      Object.assign(video, { readyState: 2, videoWidth: 1280 }); // the user switched to the tab
      await vi.advanceTimersByTimeAsync(200);
      await expect(done).resolves.toEqual({ waited: true });
    } finally {
      vi.useRealTimers();
    }
  });
  it('gives up with no-frame after the timeout', async () => {
    vi.useFakeTimers();
    try {
      const done = waitForFrame({ readyState: 0, videoWidth: 0 }, { slowMs: 10, timeoutMs: 500 });
      const caught = done.catch((e) => e.message);
      await vi.advanceTimersByTimeAsync(600);
      expect(await caught).toBe('no-frame');
    } finally {
      vi.useRealTimers();
    }
  });
  it('reads what was picked', () => {
    expect(surfaceOf({ getVideoTracks: () => [{ getSettings: () => ({ displaySurface: 'browser' }) }] })).toBe('browser');
    expect(surfaceOf(null)).toBe('');
  });
});

import { panelSections } from './search.js';
import fs from 'node:fs';
import path from 'node:path';

describe('more tools', () => {
  const index = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'tools-index.json'), 'utf8'));
  const tools = index.tools || index;
  const ids = new Set(tools.map((t) => t.id));
  const messages = (lang) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', '_locales', lang, 'messages.json'), 'utf8'));

  it('every menu item, productivity and side-panel pick is a real GoodWebTools tool', () => {
    for (const m of MENU_ITEMS) if (m.tool) expect(ids.has(m.tool), m.id).toBe(true);
    for (const id of [...PRODUCTIVITY_TOOLS, ...HANDY_PANEL_TOOLS, ...DEFAULT_PANEL_TOOLS]) expect(ids.has(id), id).toBe(true);
  });
  it('every menu label and submenu exists in English and Indonesian', () => {
    for (const lang of ['en', 'id']) {
      const msg = messages(lang);
      for (const k of [...MENU_ITEMS.map((m) => m.message), ...Object.values(MENU_GROUPS), 'menuSelCompareWith']) expect(msg[k]?.message, `${lang}:${k}`).toBeTruthy();
    }
  });
  it('makes strong passwords: right length, every character class, different each time', () => {
    const a = strongPassword(20);
    expect(a).toHaveLength(20);
    expect(a).toMatch(/[a-z]/);
    expect(a).toMatch(/[A-Z]/);
    expect(a).toMatch(/[0-9]/);
    expect(a).toMatch(/[!@#$%^&*\-_=+?]/);
    expect(strongPassword(20)).not.toBe(a);
  });
  it('writes links as CSV', () => {
    expect(linksToCsv([{ href: 'https://x/a', text: 'Hello, "you"' }, { href: 'https://x/b', text: '' }]))
      .toBe('url,text\nhttps://x/a,"Hello, ""you"""\nhttps://x/b,');
  });
  it('builds the side panel browse list: pinned, productivity, handy, then categories', () => {
    const s = panelSections(tools, { pinned: ['music-player', 'notepad'], productivity: ['notepad', 'pomodoro-timer'], handy: ['pomodoro-timer', 'uuid-gen'] });
    expect(s.slice(0, 3).map((x) => [x.key, x.tools.map((t) => t.id)])).toEqual([
      ['pinned', ['music-player', 'notepad']], ['productivity', ['pomodoro-timer']], ['handy', ['uuid-gen']],
    ]);
    const cats = s.filter((x) => x.key === 'category');
    expect(cats[0].title).toBe('Dev');
    expect(cats.some((x) => x.title === 'Legacy')).toBe(false);
    expect(cats.reduce((n, x) => n + x.tools.length, 0)).toBe(tools.filter((t) => t.category !== 'Legacy').length);
  });
});
