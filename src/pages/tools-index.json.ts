import type { APIRoute } from 'astro';
import { tools } from '@/registry/tools';
import { buildToolsIndex } from '@/registry/tools-index';

// Static tool list for the GoodWebTools Companion extension's launcher.
export const GET: APIRoute = () =>
  new Response(JSON.stringify(buildToolsIndex(tools)), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
