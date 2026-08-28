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
