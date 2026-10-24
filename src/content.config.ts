import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Module sections: src/content/modules/{slug}/{lang}/{1..4}.mdx
 * Entry id: "{slug}/{lang}/{n}".
 */
const sections = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/modules' }),
  schema: z.object({
    /** Optional override of the section title from src/data/modules.ts. */
    title: z.string().optional(),
  }),
});

export const collections = { sections };
