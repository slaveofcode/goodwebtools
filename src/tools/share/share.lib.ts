/**
 * Share-intent helpers for the Share button. Pure and framework-free so the
 * island stays thin. No third-party SDKs — every channel is a plain intent URL
 * (nothing is loaded from Meta/X/etc.), matching the site's privacy stance.
 */

export type ShareChannel = 'x' | 'facebook' | 'whatsapp' | 'telegram' | 'email' | 'copy';

export interface ShareTarget {
  /** Canonical URL being shared. */
  url: string;
  /** Human title (page/tool name). */
  title: string;
  /** Optional longer blurb; falls back to the title. */
  text?: string;
}

/** Channels shown in the UI, in order. `copy` is handled specially (no intent URL). */
export const SHARE_CHANNELS: { id: ShareChannel; label: string }[] = [
  { id: 'x', label: 'X' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'email', label: 'Email' },
  { id: 'copy', label: 'Copy link' },
];

/** The share-intent URL for a channel. `copy` has none — copy the URL directly instead. */
export function shareIntentUrl(channel: Exclude<ShareChannel, 'copy'>, target: ShareTarget): string {
  const url = encodeURIComponent(target.url);
  const title = encodeURIComponent(target.title);
  const text = encodeURIComponent(target.text ?? target.title);
  switch (channel) {
    case 'x':
      return `https://x.com/intent/tweet?url=${url}&text=${text}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    case 'whatsapp':
      return `https://api.whatsapp.com/send?text=${text}%20${url}`;
    case 'telegram':
      return `https://t.me/share/url?url=${url}&text=${text}`;
    case 'email':
      return `mailto:?subject=${title}&body=${text}%20${url}`;
  }
}

/** Whether the browser exposes the native share sheet (mobile, some desktop). */
export function canNativeShare(nav: Navigator | undefined = typeof navigator !== 'undefined' ? navigator : undefined): boolean {
  return !!nav && typeof nav.share === 'function';
}
