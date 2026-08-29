import { describe, it, expect } from 'vitest';
import { AGENT_EXECUTORS, scopeExecutors, executorFor, unknownExecutorIds, duplicateExecutorIds } from './executors';

describe('executor registry', () => {
  it('every executor maps to a real tool and declares a match fn', () => {
    expect(unknownExecutorIds()).toEqual([]);
    for (const e of AGENT_EXECUTORS) expect(typeof e.match).toBe('function');
  });
  it('has unique function names (toolIds)', () => {
    expect(duplicateExecutorIds()).toEqual([]);
  });
  it('scopes to the right tool for encode vs qr requests', () => {
    expect(scopeExecutors('encode base64 of hi').map(e => e.toolId)).toContain('base64');
    expect(scopeExecutors('make a qr for hello').map(e => e.toolId)).toContain('qr-gen');
  });
  it('does not scope image-compress for a plain mp3 request', () => {
    expect(scopeExecutors('compress my mp3').map(e => e.toolId)).not.toContain('image-compress');
  });
  it('scopes image-compress for an image request', () => {
    expect(scopeExecutors('compress this image to 100kb').map(e => e.toolId)).toContain('image-compress');
  });
  it('scopes audio-convert (not video/image) for "compress my mp3 to 3mb"', () => {
    const ids = scopeExecutors('compress my mp3 to 3mb').map(e => e.toolId);
    expect(ids).toContain('audio-convert');
    expect(ids).not.toContain('video-compress');
    expect(ids).not.toContain('image-compress');
  });
  it('scopes video-compress (not audio) for "compress this video to 5mb"', () => {
    const ids = scopeExecutors('compress this video to 5mb').map(e => e.toolId);
    expect(ids).toContain('video-compress');
    expect(ids).not.toContain('audio-convert');
  });
  it('scopes media-trim for a trim request and not compress tools', () => {
    const ids = scopeExecutors('trim my video from 0:10 to 0:30').map(e => e.toolId);
    expect(ids).toContain('media-trim');
    expect(ids).not.toContain('video-compress');
  });
  it('scopes video-to-audio for "convert mp4 to mp3" and "extract audio"', () => {
    expect(scopeExecutors('convert this mp4 to mp3').map(e => e.toolId)).toContain('video-to-audio');
    expect(scopeExecutors('extract the audio from this video').map(e => e.toolId)).toContain('video-to-audio');
  });
  it('scopes video-convert for "convert this video to webm" (not audio/compress)', () => {
    const ids = scopeExecutors('convert this video to webm').map(e => e.toolId);
    expect(ids).toContain('video-convert');
    expect(ids).not.toContain('video-to-audio');
    expect(ids).not.toContain('video-compress');
  });
  it('scopes video-to-gif for "turn this video into a gif"', () => {
    expect(scopeExecutors('turn this video into a gif').map(e => e.toolId)).toContain('video-to-gif');
  });
  it('keeps "video to mp3" on video-to-audio, not video-convert', () => {
    const ids = scopeExecutors('convert this video to mp3').map(e => e.toolId);
    expect(ids).toContain('video-to-audio');
    expect(ids).not.toContain('video-convert');
  });
  it('does not scope media-trim for image cropping (only for audio/video)', () => {
    expect(scopeExecutors('how to crop image').map(e => e.toolId)).not.toContain('media-trim');
    expect(scopeExecutors('crop this image').map(e => e.toolId)).not.toContain('media-trim');
    expect(scopeExecutors('crop this video').map(e => e.toolId)).toContain('media-trim');
    expect(scopeExecutors('cut this mp3').map(e => e.toolId)).toContain('media-trim');
  });
  it('scopes svg generation (svg-viewer) for draw/create requests', () => {
    expect(scopeExecutors('make a download icon').map(e => e.toolId)).toContain('svg-viewer');
    expect(scopeExecutors('draw a flowchart of a login process').map(e => e.toolId)).toContain('svg-viewer');
    expect(scopeExecutors('create an svg logo').map(e => e.toolId)).toContain('svg-viewer');
  });
  it('scopes the office/productivity tools', () => {
    expect(scopeExecutors('remove duplicate rows from this csv').map(e => e.toolId)).toContain('csv-dedupe');
    expect(scopeExecutors('convert this csv to excel').map(e => e.toolId)).toContain('spreadsheet-convert');
    expect(scopeExecutors('convert this xlsx to csv').map(e => e.toolId)).toContain('spreadsheet-convert');
    expect(scopeExecutors('word count of this text').map(e => e.toolId)).toContain('word-count');
  });
  it('scopes canvas-draw for chart/plot/procedural draw requests', () => {
    expect(scopeExecutors('draw a bar chart of my sales').map(e => e.toolId)).toContain('canvas-draw');
    expect(scopeExecutors('plot these data points on a canvas').map(e => e.toolId)).toContain('canvas-draw');
  });
  it('scopes the data interpreter (peek-data / run-on-data)', () => {
    expect(scopeExecutors('preview this csv file').map(e => e.toolId)).toContain('peek-data');
    expect(scopeExecutors('filter rows where amount is over 100 in this csv').map(e => e.toolId)).toContain('run-on-data');
    expect(scopeExecutors('pivot this data by region').map(e => e.toolId)).toContain('run-on-data');
  });
  it('scopes the PDF tools (compress/rotate/split), not image/video compress', () => {
    expect(scopeExecutors('compress this pdf').map(e => e.toolId)).toEqual(['pdf-compress']);
    expect(scopeExecutors('rotate my pdf 90 degrees').map(e => e.toolId)).toContain('pdf-rotate');
    expect(scopeExecutors('extract pages 1-3 from this pdf').map(e => e.toolId)).toContain('pdf-split');
    expect(scopeExecutors('merge these pdfs into one').map(e => e.toolId)).toContain('pdf-merge');
  });
  it('the pdf-merge executor declares a multiFile slot', () => {
    expect(executorFor('pdf-merge')?.multiFile?.key).toBe('files');
  });
  it('does not scope any media compressor for small talk', () => {
    expect(scopeExecutors('hello how are you today')).toEqual([]);
  });
  it('scopes the right text tool for each transform (no base64 collision)', () => {
    expect(scopeExecutors('format this json').map(e => e.toolId)).toEqual(['json-format']);
    expect(scopeExecutors('slugify My Blog Title').map(e => e.toolId)).toContain('slugify');
    expect(scopeExecutors('decode this jwt').map(e => e.toolId)).toContain('jwt-decode');
    expect(scopeExecutors('generate 3 paragraphs of lorem ipsum').map(e => e.toolId)).toContain('lorem-ipsum');
    expect(scopeExecutors('convert to UPPERCASE').map(e => e.toolId)).toContain('case-converter');
  });
  it('scopes the data-transform tools correctly', () => {
    expect(scopeExecutors('convert #3366ff to rgb').map(e => e.toolId)).toContain('color-convert');
    expect(scopeExecutors('convert this unix timestamp').map(e => e.toolId)).toContain('timestamp');
    expect(scopeExecutors('csv to json').map(e => e.toolId)).toContain('csv-json');
    expect(scopeExecutors('convert 255 base 10 to base 16').map(e => e.toolId)).toContain('base-convert');
    // base-convert must NOT be pulled in by "base64" (that's the base64 tool).
    const b64 = scopeExecutors('encode base64 ABCDEF').map(e => e.toolId);
    expect(b64).toContain('base64');
    expect(b64).not.toContain('base-convert');
    expect(scopeExecutors('clean the tracking params from this url').map(e => e.toolId)).toContain('url-cleaner');
    expect(scopeExecutors('generate a strong password').map(e => e.toolId)).toContain('password-gen');
    expect(scopeExecutors('convert this html to markdown').map(e => e.toolId)).toContain('html-markdown');
  });
  it('scopes terbilang, json-toml and cron-expression', () => {
    expect(scopeExecutors('terbilang 1500000').map(e => e.toolId)).toContain('terbilang');
    expect(scopeExecutors('convert this json to toml').map(e => e.toolId)).toContain('json-toml');
    expect(scopeExecutors('make a cron for every monday').map(e => e.toolId)).toContain('cron-expression');
  });
  it('recognizes the "img"/"pic"/"vid" abbreviations', () => {
    expect(scopeExecutors('compress img').map(e => e.toolId)).toContain('image-compress');
    expect(scopeExecutors('compress my pic to 100kb').map(e => e.toolId)).toContain('image-compress');
    expect(scopeExecutors('compress this vid').map(e => e.toolId)).toContain('video-compress');
  });
  it('scopes the reference / id lookup tools', () => {
    expect(scopeExecutors('what does http status 404 mean').map(e => e.toolId)).toContain('http-status');
    expect(scopeExecutors('mime type for webp').map(e => e.toolId)).toContain('mime-lookup');
    expect(scopeExecutors('format this sql query').map(e => e.toolId)).toContain('sql-format');
    expect(scopeExecutors('make fancy text').map(e => e.toolId)).toContain('fancy-text');
    expect(scopeExecutors('convert to braille').map(e => e.toolId)).toContain('braille-converter');
    expect(scopeExecutors('cidr for 192.168.1.0/24').map(e => e.toolId)).toContain('cidr-calculator');
    expect(scopeExecutors('decode this nik').map(e => e.toolId)).toContain('nik-decoder');
    expect(scopeExecutors('validate my npwp').map(e => e.toolId)).toContain('npwp-validator');
  });
  it('scopes the dual-input tools (contrast, regex, diff, emoji)', () => {
    expect(scopeExecutors('check the wcag contrast ratio').map(e => e.toolId)).toContain('contrast-checker');
    expect(scopeExecutors('search emoji for heart').map(e => e.toolId)).toContain('emoji-picker');
    expect(scopeExecutors('test this regex').map(e => e.toolId)).toContain('regex-tester');
    expect(scopeExecutors('diff these two texts').map(e => e.toolId)).toContain('text-diff');
  });
  it('scopes text-encrypt and vcard-csv', () => {
    expect(scopeExecutors('encrypt this message with a password').map(e => e.toolId)).toContain('text-encrypt');
    expect(scopeExecutors('convert this vcard to csv').map(e => e.toolId)).toContain('vcard-csv');
  });
  it('base64 no longer swallows bare "encode"/"decode"', () => {
    expect(scopeExecutors('url encode this').map(e => e.toolId)).not.toContain('base64');
    expect(scopeExecutors('base64 encode hello').map(e => e.toolId)).toContain('base64');
  });
  it('executorFor finds by id', () => {
    expect(executorFor('qr-gen')?.toolId).toBe('qr-gen');
    expect(executorFor('nope')).toBeUndefined();
  });
});
