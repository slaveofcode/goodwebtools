import type { APIRoute } from 'astro';
import { tools } from '@/registry/tools';
import { buildToolManifest } from '@/tools/pwa/manifest.lib';

export function getStaticPaths() {
  return tools.map(t => ({ params: { tool: t.id }, props: { name: t.name, summary: t.summary } }));
}

export const GET: APIRoute = ({ params, props }) => {
  const { name, summary } = props as { name: string; summary: string };
  const manifest = buildToolManifest({ id: params.tool as string, name, summary });
  return new Response(JSON.stringify(manifest), {
    headers: { 'content-type': 'application/manifest+json; charset=utf-8' },
  });
};
