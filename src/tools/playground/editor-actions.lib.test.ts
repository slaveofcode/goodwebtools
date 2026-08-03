import { describe, it, expect } from 'vitest';
import { editorKeybindings } from './editor-actions.lib';

// The real Monaco enum values (monaco-editor 0.52): KeyMod.CtrlCmd=2048,
// Shift=1024; KeyCode.KeyL=42, KeyS=49, KeyO=45. Locking the exact chords guards
// against an accidental combo change (e.g. KeyL → KeyK).
const KEYS = {
  KeyMod: { CtrlCmd: 2048, Shift: 1024, Alt: 512, WinCtrl: 256 },
  KeyCode: { KeyL: 42, KeyS: 49, KeyO: 45 },
};

describe('editorKeybindings', () => {
  const kb = editorKeybindings(KEYS);

  it('binds Select All Occurrences to Cmd/Ctrl+Shift+L', () => {
    expect(kb.selectAllOccurrences).toBe(2048 | 1024 | 42); // 3114
  });
  it('binds Save to Cmd/Ctrl+S', () => {
    expect(kb.save).toBe(2048 | 49); // 2097
  });
  it('binds Open to Cmd/Ctrl+O', () => {
    expect(kb.open).toBe(2048 | 45); // 2093
  });
});
