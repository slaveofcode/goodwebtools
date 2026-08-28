import { describe, it, expect } from 'vitest';
import { buildToolCallMessages, parseToolCall, type AgentTool } from './chat.lib';

const TOOLS: AgentTool[] = [
  { id: 'video-compress', name: 'Video Compressor', description: 'Compress a video to a target size', slots: [{ key: 'size', label: 'Target size' }] },
  { id: 'qr-gen', name: 'QR Code Generator', description: 'Make a QR code', slots: [{ key: 'text', label: 'Text' }] },
];

describe('buildToolCallMessages', () => {
  it('emits a system prompt listing the tools + the user turn', () => {
    const msgs = buildToolCallMessages('compress my video to 8mb', TOOLS);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe('system');
    expect(msgs[0].content).toContain('video-compress');
    expect(msgs[0].content).toContain('slots: size');
    expect(msgs[1]).toEqual({ role: 'user', content: 'compress my video to 8mb' });
  });
});

describe('parseToolCall', () => {
  it('parses a clean JSON tool-call', () => {
    const r = parseToolCall('{"toolId":"video-compress","params":{"size":"8MB"},"reply":"Opening it."}');
    expect(r).toEqual({ toolId: 'video-compress', params: { size: '8MB' }, reply: 'Opening it.' });
  });
  it('recovers JSON wrapped in prose/markdown', () => {
    const r = parseToolCall('Sure! ```json\n{"toolId":"qr-gen","params":{"text":"hi"},"reply":"On it"}\n``` done');
    expect(r?.toolId).toBe('qr-gen');
    expect(r?.params).toEqual({ text: 'hi' });
  });
  it('coerces a null tool and drops non-scalar params', () => {
    const r = parseToolCall('{"toolId":null,"params":{"a":{"x":1},"n":5},"reply":"hm"}');
    expect(r).toEqual({ toolId: null, params: { n: 5 }, reply: 'hm' });
  });
  it('returns null on unparseable text', () => {
    expect(parseToolCall('no json here')).toBeNull();
    expect(parseToolCall('{broken')).toBeNull();
  });
});
