import { describe, it, expect, vi } from 'vitest';
import { handoffIdFromHash, payloadToFile, deliverHandoff } from './companion-handoff';

/** Mark an element as React-owned, as hydration does. */
const hydrate = <T extends Element>(el: T) => Object.assign(el, { __reactProps$test: {} });

describe('handoffIdFromHash', () => {
  it('reads a handoff id', () => {
    expect(handoffIdFromHash('#gwt-handoff=3f2a9c1e-77b0-4d1e')).toBe('3f2a9c1e-77b0-4d1e');
  });
  it('ignores other hashes and malformed ids', () => {
    expect(handoffIdFromHash('')).toBeNull();
    expect(handoffIdFromHash('#room123')).toBeNull();
    expect(handoffIdFromHash('#gwt-handoff=short')).toBeNull();
    expect(handoffIdFromHash('#gwt-handoff=<script>alert(1)</script>')).toBeNull();
  });
});

describe('payloadToFile', () => {
  it('decodes base64 into a typed File', async () => {
    const f = payloadToFile({ kind: 'file', name: 'a.txt', type: 'text/plain', base64: btoa('hello') });
    expect(f.name).toBe('a.txt');
    expect(f.type).toBe('text/plain');
    expect(await f.text()).toBe('hello');
  });
});

describe('deliverHandoff', () => {
  it('waits for hydration, then types text into the first editable text box', async () => {
    document.body.innerHTML = '<textarea readonly></textarea><textarea id="in"></textarea>';
    const box = document.getElementById('in') as HTMLTextAreaElement;
    const onInput = vi.fn();
    box.addEventListener('input', onInput);
    const done = deliverHandoff(document, { kind: 'text', text: '{"a":1}' }, 2000, 10);
    setTimeout(() => hydrate(box), 30);
    expect(await done).toBe(true);
    expect(box.value).toBe('{"a":1}');
    expect(onInput).toHaveBeenCalledOnce();
  });

  it('puts a file into the first file input and fires change', async () => {
    document.body.innerHTML = '<input type="file" id="f">';
    const input = hydrate(document.getElementById('f') as HTMLInputElement);
    const onChange = vi.fn();
    input.addEventListener('change', onChange);
    // jsdom lacks DataTransfer; a minimal stand-in that builds a FileList-like object.
    class DT { files: File[] = []; items = { add: (f: File) => { this.files.push(f); } }; }
    vi.stubGlobal('DataTransfer', DT);
    Object.defineProperty(input, 'files', { writable: true, value: null });
    const ok = await deliverHandoff(document, { kind: 'file', name: 'p.png', type: 'image/png', base64: btoa('x') }, 500, 10);
    vi.unstubAllGlobals();
    expect(ok).toBe(true);
    expect((input.files as unknown as File[])[0].name).toBe('p.png');
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('gives up when the tool has nowhere to put the data', async () => {
    document.body.innerHTML = '<div>no inputs</div>';
    expect(await deliverHandoff(document, { kind: 'text', text: 'x' }, 50, 10)).toBe(false);
  });
});
