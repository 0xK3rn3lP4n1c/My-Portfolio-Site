import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const localized = {
  title: z.string(),
  description: z.string(),
  date: z.coerce.date(),
  tags: z.array(z.string()).default([]),
  lang: z.enum(['tr', 'en']).default('tr'),
  draft: z.boolean().default(false),
};

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    ...localized,
    featured: z.boolean().default(false),
    repo: z.string().url().optional(),
    demo: z.string().url().optional(),
    embed: z.enum(['ronin']).optional(),
    gallery: z.array(z.object({ src: z.string(), title: z.string().optional() })).optional(),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({ ...localized }),
});

export const collections = { projects, blog };
