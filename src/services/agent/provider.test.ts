import { describe, it, expect, vi, afterEach } from 'vitest';
import { createCloudProvider } from './provider';

afterEach(() => { vi.restoreAllMocks(); });

function mockFetchOnce(json: unknown, ok = true) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok, json: async () => json,
  } as Response);
}

describe('createCloudProvider', () => {
  it('is marked capable (cloud models get the full tool catalog + chaining)', () => {
    const p = createCloudProvider({ kind: 'openai', baseUrl: 'https://api.example.com/v1', model: 'm', apiKey: 'sk-1' });
    expect(p.capable).toBe(true);
  });
  it('calls the provider directly when not proxied (OpenAI-compatible)', async () => {
    const f = mockFetchOnce({ choices: [{ message: { content: 'hi there' } }] });
    const p = createCloudProvider({ kind: 'openai', baseUrl: 'https://api.example.com/v1', model: 'm', apiKey: 'sk-1' });
    const out = await p.chat([{ role: 'user', content: 'hi' }]);
    expect(out).toBe('hi there');
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://api.example.com/v1/chat/completions');
    expect((init as RequestInit).headers).toMatchObject({ authorization: 'Bearer sk-1' });
  });

  it('routes through /api/llm-proxy with x-llm-target when proxied', async () => {
    const f = mockFetchOnce({ choices: [{ message: { content: 'proxied ok' } }] });
    const p = createCloudProvider({ kind: 'openai', baseUrl: 'https://opencode.ai/zen/go/v1', model: 'm', apiKey: 'sk-2', proxy: true });
    const out = await p.chat([{ role: 'user', content: 'hi' }]);
    expect(out).toBe('proxied ok');
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('/api/llm-proxy');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['x-llm-target']).toBe('https://opencode.ai/zen/go/v1/chat/completions');
    expect(headers.authorization).toBe('Bearer sk-2');
  });

  it('parses OpenAI tool_calls into ToolCall[] and sends the tools', async () => {
    const f = mockFetchOnce({ choices: [{ message: { content: '', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'qr-gen', arguments: '{"text":"hi"}' } }] } }] });
    const p = createCloudProvider({ kind: 'openai', baseUrl: 'https://api.example.com/v1', model: 'm', apiKey: 'sk-1' });
    const turn = await p.chatTools!([{ role: 'user', content: 'make a qr' }], [{ name: 'qr-gen', description: 'qr', parameters: { type: 'object', properties: { text: { type: 'string' } } } }]);
    expect(turn.calls).toEqual([{ id: 'c1', name: 'qr-gen', args: { text: 'hi' } }]);
    const body = JSON.parse((f.mock.calls[0][1] as RequestInit).body as string);
    expect(body.tools[0].function.name).toBe('qr-gen');
    expect(body.tool_choice).toBe('auto');
  });
  it('returns final text with no calls', async () => {
    mockFetchOnce({ choices: [{ message: { content: 'All done!' } }] });
    const p = createCloudProvider({ kind: 'openai', baseUrl: 'x', model: 'm', apiKey: 'k' });
    expect(await p.chatTools!([{ role: 'user', content: 'hi' }], [])).toEqual({ text: 'All done!', calls: [] });
  });
  it('parses Anthropic tool_use blocks', async () => {
    mockFetchOnce({ content: [{ type: 'text', text: 'sure' }, { type: 'tool_use', id: 't1', name: 'svg-viewer', input: { svg: '<svg/>' } }] });
    const p = createCloudProvider({ kind: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'claude', apiKey: 'k' });
    const turn = await p.chatTools!([{ role: 'user', content: 'draw' }], [{ name: 'svg-viewer', description: 'd', parameters: {} }]);
    expect(turn.text).toBe('sure');
    expect(turn.calls).toEqual([{ id: 't1', name: 'svg-viewer', args: { svg: '<svg/>' } }]);
  });
  it('proxies the Anthropic messages endpoint with x-llm-target', async () => {
    const f = mockFetchOnce({ content: [{ text: 'claude reply' }] });
    const p = createCloudProvider({ kind: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'claude', apiKey: 'sk-3', proxy: true });
    const out = await p.chat([{ role: 'user', content: 'hi' }]);
    expect(out).toBe('claude reply');
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('/api/llm-proxy');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['x-llm-target']).toBe('https://api.anthropic.com/v1/messages');
    expect(headers['x-api-key']).toBe('sk-3');
  });
});
