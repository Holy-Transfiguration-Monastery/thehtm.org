import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const pages = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/pages' }),
  schema: z.object({ title: z.string() }),
});

const post = z.object({
  title: z.string(),
  date: z.coerce.date(),
  summary: z.string().optional(),
});
const news = defineCollection({ loader: glob({ pattern: '*.md', base: './src/content/news' }), schema: post });
const reading = defineCollection({ loader: glob({ pattern: '*.md', base: './src/content/reading' }), schema: post });

// Each music page. Its file name is its address: vespers.md -> /vespers
const music = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/music' }),
  schema: z.object({
    title: z.string(),
    menuTitle: z.string().nullish(),
    section: z.enum(['index', 'greek', 'english']),
    // Bare id ("menaion-hymns-according-to-month") or a path picked in the editor.
    parent: z.string().nullish().transform((p) => (p ? p.replace(/^.*\//, '').replace(/\.md$/, '') : null)),
    order: z.number().default(99),
    inMenu: z.boolean().default(true),
  }),
});

const albums = defineCollection({
  loader: glob({ pattern: '*.yml', base: './src/content/albums' }),
  schema: z.object({
    title: z.string(),
    order: z.number().default(99),
    intro: z.string().optional(),
    cover: z.string().optional(),
    photos: z.array(z.object({
      src: z.string(),
      thumb: z.string().optional(),
      caption: z.string().optional(),
    })),
  }),
});

export const collections = { pages, news, reading, music, albums };
