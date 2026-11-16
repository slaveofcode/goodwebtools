import { defineCollection, z } from 'astro:content';

/**
 * How-to guides (src/content/guides/<lang>/<slug>.md). The same slug in each
 * language is the same article, so pages link to each other with hreflang.
 */
const guides = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string().max(80),
    description: z.string().max(170),
    tool: z.string(),
    related: z.array(z.string()).default([]),
    updated: z.coerce.date(),
  }),
});

export const collections = { guides };
