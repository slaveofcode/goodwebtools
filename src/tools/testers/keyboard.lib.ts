/**
 * Physical keyboard layout for the keyboard tester, keyed by KeyboardEvent.code
 * so it is layout-independent (works for QWERTY/AZERTY/etc). Pure data + helpers;
 * the island listens for keydown/keyup and marks each `code` as tested.
 */

export interface KeyDef {
  /** KeyboardEvent.code, or '' for a spacer. */
  code: string;
  label: string;
  /** Relative width in key units (1 = a standard key). */
  w?: number;
}

/** A compact ANSI (US) layout. Only `code` is matched, so labels are cosmetic. */
export const KEY_ROWS: KeyDef[][] = [
  [
    { code: 'Escape', label: 'Esc' },
    { code: 'F1', label: 'F1' }, { code: 'F2', label: 'F2' }, { code: 'F3', label: 'F3' }, { code: 'F4', label: 'F4' },
    { code: 'F5', label: 'F5' }, { code: 'F6', label: 'F6' }, { code: 'F7', label: 'F7' }, { code: 'F8', label: 'F8' },
    { code: 'F9', label: 'F9' }, { code: 'F10', label: 'F10' }, { code: 'F11', label: 'F11' }, { code: 'F12', label: 'F12' },
  ],
  [
    { code: 'Backquote', label: '`' },
    { code: 'Digit1', label: '1' }, { code: 'Digit2', label: '2' }, { code: 'Digit3', label: '3' }, { code: 'Digit4', label: '4' },
    { code: 'Digit5', label: '5' }, { code: 'Digit6', label: '6' }, { code: 'Digit7', label: '7' }, { code: 'Digit8', label: '8' },
    { code: 'Digit9', label: '9' }, { code: 'Digit0', label: '0' }, { code: 'Minus', label: '-' }, { code: 'Equal', label: '=' },
    { code: 'Backspace', label: 'Backspace', w: 2 },
  ],
  [
    { code: 'Tab', label: 'Tab', w: 1.5 },
    { code: 'KeyQ', label: 'Q' }, { code: 'KeyW', label: 'W' }, { code: 'KeyE', label: 'E' }, { code: 'KeyR', label: 'R' },
    { code: 'KeyT', label: 'T' }, { code: 'KeyY', label: 'Y' }, { code: 'KeyU', label: 'U' }, { code: 'KeyI', label: 'I' },
    { code: 'KeyO', label: 'O' }, { code: 'KeyP', label: 'P' }, { code: 'BracketLeft', label: '[' }, { code: 'BracketRight', label: ']' },
    { code: 'Backslash', label: '\\', w: 1.5 },
  ],
  [
    { code: 'CapsLock', label: 'Caps', w: 1.75 },
    { code: 'KeyA', label: 'A' }, { code: 'KeyS', label: 'S' }, { code: 'KeyD', label: 'D' }, { code: 'KeyF', label: 'F' },
    { code: 'KeyG', label: 'G' }, { code: 'KeyH', label: 'H' }, { code: 'KeyJ', label: 'J' }, { code: 'KeyK', label: 'K' },
    { code: 'KeyL', label: 'L' }, { code: 'Semicolon', label: ';' }, { code: 'Quote', label: '\'' },
    { code: 'Enter', label: 'Enter', w: 2.25 },
  ],
  [
    { code: 'ShiftLeft', label: 'Shift', w: 2.25 },
    { code: 'KeyZ', label: 'Z' }, { code: 'KeyX', label: 'X' }, { code: 'KeyC', label: 'C' }, { code: 'KeyV', label: 'V' },
    { code: 'KeyB', label: 'B' }, { code: 'KeyN', label: 'N' }, { code: 'KeyM', label: 'M' }, { code: 'Comma', label: ',' },
    { code: 'Period', label: '.' }, { code: 'Slash', label: '/' },
    { code: 'ShiftRight', label: 'Shift', w: 2.75 },
  ],
  [
    { code: 'ControlLeft', label: 'Ctrl', w: 1.5 },
    { code: 'MetaLeft', label: 'Meta', w: 1.25 },
    { code: 'AltLeft', label: 'Alt', w: 1.25 },
    { code: 'Space', label: 'Space', w: 6.25 },
    { code: 'AltRight', label: 'Alt', w: 1.25 },
    { code: 'MetaRight', label: 'Meta', w: 1.25 },
    { code: 'ControlRight', label: 'Ctrl', w: 1.5 },
  ],
  [
    { code: 'ArrowLeft', label: '←' }, { code: 'ArrowUp', label: '↑' }, { code: 'ArrowDown', label: '↓' }, { code: 'ArrowRight', label: '→' },
  ],
];

/** Every `code` in the layout (excludes spacers). */
export function allCodes(): string[] {
  return KEY_ROWS.flat().map((k) => k.code).filter(Boolean);
}

/** Whether a KeyboardEvent.code is part of the drawn layout. */
export function isKnownCode(code: string): boolean {
  return allCodes().includes(code);
}

/** How many distinct layout keys have been tested. */
export function testedCount(tested: Set<string>): number {
  const codes = new Set(allCodes());
  let n = 0;
  for (const c of tested) if (codes.has(c)) n++;
  return n;
}
