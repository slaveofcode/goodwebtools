import { useEffect, useRef, useState } from 'react';
import { Share2, Mail, Link2, Check, Smartphone } from 'lucide-react';
import { shareIntentUrl, canNativeShare, type ShareChannel } from '@/tools/share/share.lib';

interface ShareButtonProps {
  url: string;
  title: string;
  text?: string;
  /** Optional extra classes for the wrapper. */
  className?: string;
}

// Accurate brand glyphs (monochrome, currentColor) — lucide's socials are the old
// marks, so we inline simple-icons paths for X/Facebook/WhatsApp/Telegram.
function BrandIcon({ channel }: { channel: ShareChannel }) {
  const common = { className: 'h-4 w-4', viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true } as const;
  switch (channel) {
    case 'x':
      return (
        <svg {...common}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
      );
    case 'facebook':
      return (
        <svg {...common}><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
      );
    case 'whatsapp':
      return (
        <svg {...common}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" /></svg>
      );
    case 'telegram':
      return (
        <svg {...common}><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
      );
    default:
      return null;
  }
}

const ICON_BTN =
  'inline-flex h-9 w-9 items-center justify-center border-2 border-border bg-muted text-foreground shadow-brutal-sm press-brutal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export default function ShareButton({ url, title, text, className = '' }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [native, setNative] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => setNative(canNativeShare()), []);

  // Close the row on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const openIntent = (channel: Exclude<ShareChannel, 'copy'>) => {
    const href = shareIntentUrl(channel, { url, title, text });
    if (channel === 'email') { window.location.href = href; return; }
    window.open(href, '_blank', 'noopener,noreferrer,width=600,height=520');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked — ignore */ }
  };

  const nativeShare = async () => {
    try { await navigator.share({ title, text: text ?? title, url }); setOpen(false); }
    catch { /* user cancelled — ignore */ }
  };

  const onMain = () => { if (native) void nativeShare(); else setOpen(o => !o); };

  return (
    <div ref={rootRef} className={`relative inline-flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={onMain}
        aria-haspopup={!native}
        aria-expanded={native ? undefined : open}
        aria-label="Share"
        className="inline-flex items-center gap-2 border-2 border-border bg-muted px-3 py-2 text-sm font-bold uppercase tracking-wide text-foreground shadow-brutal-sm press-brutal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Share2 className="h-4 w-4" /> Share
      </button>

      {/* Native devices get the main button; a caret still exposes explicit channels. */}
      {native && (
        <button type="button" onClick={() => setOpen(o => !o)} aria-label="More share options" aria-expanded={open} className={ICON_BTN}>
          <span aria-hidden className="text-lg leading-none">⋯</span>
        </button>
      )}

      {open && (
        <div role="group" aria-label="Share to" className="absolute left-0 top-full z-30 mt-2 flex flex-wrap items-center gap-1.5 border-2 border-border bg-background p-2 shadow-brutal">
          {native && (
            <button type="button" onClick={nativeShare} aria-label="Device share" title="Device share" className={ICON_BTN}><Smartphone className="h-4 w-4" /></button>
          )}
          <button type="button" onClick={() => openIntent('x')} aria-label="Share on X" title="X" className={ICON_BTN}><BrandIcon channel="x" /></button>
          <button type="button" onClick={() => openIntent('facebook')} aria-label="Share on Facebook" title="Facebook" className={ICON_BTN}><BrandIcon channel="facebook" /></button>
          <button type="button" onClick={() => openIntent('whatsapp')} aria-label="Share on WhatsApp" title="WhatsApp" className={ICON_BTN}><BrandIcon channel="whatsapp" /></button>
          <button type="button" onClick={() => openIntent('telegram')} aria-label="Share on Telegram" title="Telegram" className={ICON_BTN}><BrandIcon channel="telegram" /></button>
          <button type="button" onClick={() => openIntent('email')} aria-label="Share by email" title="Email" className={ICON_BTN}><Mail className="h-4 w-4" /></button>
          <button type="button" onClick={copy} aria-label="Copy link" title={copied ? 'Copied' : 'Copy link'} className={ICON_BTN}>
            {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
          </button>
        </div>
      )}
    </div>
  );
}
