/**
 * Sanitize LLM-generated SVG before it's rendered/downloaded. The agent lets a
 * capable model "draw" icons/diagrams by emitting SVG markup; that markup is
 * untrusted (could carry <script>, event handlers, or foreignObject), so we
 * extract the <svg> element and run it through DOMPurify's SVG profile. Pure and
 * unit-testable (DOMPurify runs against jsdom in tests, the real DOM at runtime).
 */
import DOMPurify from 'dompurify';

/** Pull the first <svg>…</svg> out of a reply, tolerating markdown code fences. */
export function extractSvg(input: string): string {
  const unfenced = input.replace(/```(?:svg|xml|html)?/gi, '');
  const m = unfenced.match(/<svg[\s\S]*?<\/svg>/i);
  return m ? m[0] : '';
}

/**
 * Return a safe SVG string, or '' if the input isn't valid SVG. Strips scripts,
 * event handlers and foreignObject via DOMPurify's SVG profile.
 */
export function sanitizeSvg(input: string): string {
  const raw = extractSvg(input);
  if (!raw) return '';
  const clean = DOMPurify.sanitize(raw, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ['use'],
  });
  return /<svg[\s>]/i.test(clean) ? clean : '';
}

/** SVG string → a `data:` URL that renders in an <img>. */
export function svgToDataUrl(svg: string): string {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
