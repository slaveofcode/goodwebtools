/**
 * VS Code-style keybindings for the Monaco editor, expressed as the numeric
 * chords Monaco's addAction/addCommand expect. Kept pure (the KeyMod/KeyCode
 * constants are injected) so the exact combos are unit-tested and can't silently
 * drift. Wired up in MonacoEditor.
 */

export interface MonacoKeys {
  KeyMod: { CtrlCmd: number; Shift: number; Alt: number; WinCtrl: number };
  KeyCode: Record<string, number>;
}

export interface EditorKeybindings {
  /** Cmd/Ctrl+Shift+L — select all occurrences of the current selection. */
  selectAllOccurrences: number;
  /** Cmd/Ctrl+S — save the active file. */
  save: number;
  /** Cmd/Ctrl+O — open a file from disk. */
  open: number;
}

export function editorKeybindings({ KeyMod, KeyCode }: MonacoKeys): EditorKeybindings {
  return {
    selectAllOccurrences: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyL,
    save: KeyMod.CtrlCmd | KeyCode.KeyS,
    open: KeyMod.CtrlCmd | KeyCode.KeyO,
  };
}
