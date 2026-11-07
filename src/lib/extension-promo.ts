// When and how to suggest the GoodWebTools Companion browser extension.
// Shown only where it can be installed (desktop Chromium browsers), never when
// it's already installed, and not again for a while after it's dismissed.

export const PROMO_DISMISS_KEY = 'gwt.extPromo.dismissedAt';
/** How long a dismissal lasts. */
export const PROMO_SNOOZE_MS = 30 * 24 * 3600 * 1000;

export interface BrowserInfo {
  userAgent: string;
  /** navigator.userAgentData, where available. */
  uaData?: { mobile?: boolean; brands?: { brand: string }[] } | null;
  /** Running inside the GoodWebTools desktop app (Tauri). */
  desktopApp?: boolean;
}

/** Chrome, Edge, Brave, Opera, Vivaldi… on a desktop OS — where the Chrome Web Store installs extensions. */
export function canInstallExtension({ userAgent, uaData, desktopApp }: BrowserInfo): boolean {
  if (desktopApp) return false;
  const mobile = uaData?.mobile ?? /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent);
  if (mobile) return false;
  if (uaData?.brands?.length) return uaData.brands.some(b => /Chromium|Google Chrome|Microsoft Edge|Opera|Brave/i.test(b.brand));
  // Fallback: Chromium-based UA strings (Firefox and Safari don't carry "Chrome/").
  return /Chrome\/\d+/.test(userAgent) && !/Firefox\//.test(userAgent);
}

export function isSnoozed(dismissedAt: number | null | undefined, now = Date.now()): boolean {
  return !!dismissedAt && now - dismissedAt < PROMO_SNOOZE_MS;
}

export type PromoAngle = 'image' | 'text' | 'media' | 'general';

/** What to highlight on a tool page: right-click images, selected text, recording, or the launcher. */
export function promoAngle(category: string | undefined, toolId = ''): PromoAngle {
  if (category === 'Image' || /^(qr-read|image-)/.test(toolId)) return 'image';
  if (/^(json|base64|hash|word-counter|text-to-speech|qr-gen|url-encode|yaml|toml|sql|regex)/.test(toolId)) return 'text';
  if (/(record|video|screenshot|music-player)/.test(toolId)) return 'media';
  return 'general';
}
