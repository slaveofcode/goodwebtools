import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, parseAction, type LoopTool } from './loop.lib';

const TOOLS: LoopTool[] = [
  { name: 'base64_encode', description: 'Encode text to Base64', args: [{ name: 'text', type: 'string', required: true }] },
  { name: 'image_compress', description: 'Compress an image to a target KB', args: [{ name: 'file', type: 'file', required: true }, { name: 'targetKb', type: 'number', required: true }] },
];

describe('buildSystemPrompt', () => {
  it('lists tools with their args and the action protocol', () => {
    const p = buildSystemPrompt(TOOLS);
    expect(p).toContain('base64_encode(text:string)');
    expect(p).toContain('image_compress(file:file, targetKb:number)');
    expect(p).toContain('"action":"call_tool"');
    expect(p).toContain('"action":"final"');
    expect(p).toContain('UPLOAD');
  });
});

describe('parseAction', () => {
  it('parses a call_tool action', () => {
    expect(parseAction('{"action":"call_tool","tool":"base64_encode","args":{"text":"hi"}}'))
      .toEqual({ action: 'call_tool', tool: 'base64_encode', args: { text: 'hi' } });
  });
  it('parses a final action', () => {
    expect(parseAction('{"action":"final","text":"Done!"}')).toEqual({ action: 'final', text: 'Done!' });
  });
  it('recovers JSON wrapped in prose', () => {
    const r = parseAction('Sure: {"action":"call_tool","tool":"image_compress","args":{"file":"UPLOAD","targetKb":200}} ok');
    expect(r).toEqual({ action: 'call_tool', tool: 'image_compress', args: { file: 'UPLOAD', targetKb: 200 } });
  });
  it('recovers from a trailing extra closing brace (small-model junk)', () => {
    const r = parseAction('{"action":"call_tool","tool":"image-compress","args":{"targetKb":198}}}');
    expect(r).toEqual({ action: 'call_tool', tool: 'image-compress', args: { targetKb: 198 } });
  });
  it('drops non-scalar args', () => {
    const r = parseAction('{"action":"call_tool","tool":"x","args":{"a":{"n":1},"b":2}}');
    expect(r).toEqual({ action: 'call_tool', tool: 'x', args: { b: 2 } });
  });
  it('returns null on garbage or unknown action', () => {
    expect(parseAction('nope')).toBeNull();
    expect(parseAction('{"action":"weird"}')).toBeNull();
  });
});
