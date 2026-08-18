/**
 * Solid-colour cycle for the dead-pixel / screen test. Pure data + a stepper;
 * the island renders each colour fullscreen and advances on tap/click/arrow.
 *
 * A stuck pixel shows up against solid primaries; a dead pixel shows against
 * white; backlight bleed and uniformity show against black and grey.
 */

export interface TestColor {
  name: string;
  hex: string;
  /** Text colour that stays readable over this background. */
  fg: string;
}

export const TEST_COLORS: TestColor[] = [
  { name: 'White', hex: '#ffffff', fg: '#000000' },
  { name: 'Black', hex: '#000000', fg: '#ffffff' },
  { name: 'Red', hex: '#ff0000', fg: '#ffffff' },
  { name: 'Green', hex: '#00ff00', fg: '#000000' },
  { name: 'Blue', hex: '#0000ff', fg: '#ffffff' },
  { name: 'Cyan', hex: '#00ffff', fg: '#000000' },
  { name: 'Magenta', hex: '#ff00ff', fg: '#000000' },
  { name: 'Yellow', hex: '#ffff00', fg: '#000000' },
  { name: 'Grey 50%', hex: '#808080', fg: '#ffffff' },
];

/** Index after moving `step` (±1) with wrap-around. */
export function stepIndex(current: number, step: number, length = TEST_COLORS.length): number {
  return ((current + step) % length + length) % length;
}
