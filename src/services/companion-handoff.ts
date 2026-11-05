// Receives data the GoodWebTools Companion extension hands to a tool page — an
// image or selected text from a right-click menu, a URL from the launcher — and
// loads it into the tool as if the user had picked the file or pasted the text.
//
// Delivery is generic: the first file input gets the file, the first editable
// text box gets the text. That covers almost every tool without per-tool code.
import { requestHandoff, type HandoffPayload } from './companion';

const HASH_KEY = 'gwt-handoff';

/** The handoff id from a `#gwt-handoff=<id>` hash, or null. */
export function handoffIdFromHash(hash: string): string | null {
  const m = new RegExp(`^#${HASH_KEY}=([A-Za-z0-9-]{8,64})$`).exec(hash);
  return m ? m[1] : null;
}

/** Turn a file payload into a File. */
export function payloadToFile(p: Extract<HandoffPayload, { kind: 'file' }>): File {
  const bin = atob(p.base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], p.name || 'file', { type: p.type || 'application/octet-stream' });
}

const hydrated = (el: Element) => Object.keys(el).some(k => k.startsWith('__reactProps'));
const visible = (el: HTMLElement) => !el.closest('[hidden]') && el.getAttribute('aria-hidden') !== 'true';

/** The element a payload goes into, once React owns it. */
function findTarget(root: ParentNode, p: HandoffPayload): HTMLInputElement | HTMLTextAreaElement | null {
  if (p.kind === 'file') {
    const input = root.querySelector<HTMLInputElement>('input[type=file]');
    return input && hydrated(input) ? input : null;
  }
  const boxes = [...root.querySelectorAll<HTMLTextAreaElement | HTMLInputElement>('textarea, input[type=text], input:not([type])')]
    .filter(el => !el.readOnly && !el.disabled && visible(el));
  const box = boxes.find(el => el instanceof HTMLTextAreaElement) ?? boxes[0];
  return box && hydrated(box) ? box : null;
}

/** Put the payload into the element, firing the events React listens for. */
function inject(el: HTMLInputElement | HTMLTextAreaElement, p: HandoffPayload): void {
  if (p.kind === 'file' && el instanceof HTMLInputElement) {
    const dt = new DataTransfer();
    dt.items.add(payloadToFile(p));
    el.files = dt.files;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  if (p.kind === 'text') {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, p.text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
  }
}

/** Wait (up to `timeoutMs`) for the tool to hydrate, then load the payload into it. Resolves whether it was delivered. */
export function deliverHandoff(root: ParentNode, p: HandoffPayload, timeoutMs = 20000, stepMs = 150): Promise<boolean> {
  return new Promise(resolve => {
    const started = Date.now();
    const tick = () => {
      const el = findTarget(root, p);
      if (el) { inject(el, p); resolve(true); return; }
      if (Date.now() - started > timeoutMs) { resolve(false); return; }
      setTimeout(tick, stepMs);
    };
    tick();
  });
}

/** On a tool page: if the URL carries a handoff id, fetch the payload from the extension and load it. */
export async function runHandoff(): Promise<void> {
  if (typeof window === 'undefined') return;
  const id = handoffIdFromHash(window.location.hash);
  if (!id) return;
  // Drop the id from the URL straight away: it's single-use and shouldn't be bookmarked or shared.
  history.replaceState(history.state, '', window.location.pathname + window.location.search);
  const payload = await requestHandoff(id);
  if (payload) await deliverHandoff(document, payload);
}
