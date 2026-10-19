import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import site from '../../data/site.json';
import { posts } from '../../lib';

export async function GET(context: APIContext) {
  const entries = await posts('news');
  return rss({
    title: `${site.name}: News`,
    description: site.description,
    site: context.site!,
    items: entries.map((e) => ({ title: e.data.title, pubDate: e.data.date, link: `/news/${e.id}`, description: e.data.summary })),
  });
}
