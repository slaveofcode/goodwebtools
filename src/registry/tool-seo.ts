import type { ToolSeoContent } from '@/types/tool';

/**
 * Per-tool SEO content, keyed by tool id. Authored (not templated) so each page
 * carries unique title/description + on-page copy (intro, how-to, FAQ) that also
 * feeds FAQPage/HowTo structured data. Tools without an entry fall back to the
 * registry name/summary — nothing breaks, they're just less rich.
 *
 * Style guide for entries:
 * - title: ~45-55 chars, lead with the value ("Free …"), include the primary verb(s).
 * - description: 150-160 chars, benefit + the privacy hook (in-browser, no upload).
 * - intro: 1-2 sentences, natural prose, mentions what you paste/drop and the outcome.
 * - howTo: 3-5 short imperative steps.
 * - faqs: 3-4 real questions a searcher would ask; answers 1-3 sentences.
 */
export const toolSeo: Record<string, ToolSeoContent> = {
  'json-format': {
    title: 'Free JSON Formatter, Validator & Minifier',
    description:
      'Format, beautify, minify and validate JSON online — free and 100% private. Your JSON is processed entirely in your browser and never uploaded. No sign-up.',
    intro:
      'Paste messy or minified JSON and instantly format it into clean, properly-indented, readable output — or minify it back down for production. Everything runs on your device, so even sensitive payloads never leave your browser.',
    howTo: [
      'Paste or type your JSON into the input area.',
      'The tool validates it as you go and flags any syntax error with its location.',
      'Choose Format to pretty-print with indentation, or Minify to strip whitespace.',
      'Copy the result or download it — your data never leaves your browser.',
    ],
    faqs: [
      {
        q: 'Is my JSON data uploaded to a server?',
        a: 'No. All formatting, validation and minifying happens locally in your browser with JavaScript. Your JSON never leaves your device, which makes it safe for confidential or proprietary data.',
      },
      {
        q: 'Why is my JSON showing as invalid?',
        a: "It means the text doesn't follow JSON syntax rules — commonly a missing comma, an unclosed bracket or brace, single quotes instead of double quotes, or a trailing comma. The tool points to where the problem is so you can fix it.",
      },
      {
        q: "What's the difference between formatting and minifying?",
        a: 'Formatting (beautifying) adds indentation and line breaks so JSON is easy to read. Minifying removes all unnecessary whitespace to make the file as small as possible for faster transfer and storage.',
      },
      {
        q: 'Does the JSON formatter work offline?',
        a: 'Yes. GoodWebTools is a Progressive Web App, so once the page has loaded once it keeps working with no internet connection.',
      },
    ],
  },
};

export function getToolSeo(id: string): ToolSeoContent | undefined {
  return toolSeo[id];
}
