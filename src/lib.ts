import { getCollection, type CollectionEntry } from 'astro:content';

export type MusicEntry = CollectionEntry<'music'>;
export type MusicNode = { entry: MusicEntry; children: MusicNode[] };

const byOrder = (a: MusicEntry, b: MusicEntry) => a.data.order - b.data.order || a.data.title.localeCompare(b.data.title);

/** Music pages as a tree: { greek: [...], english: [...] }. */
export async function musicTree() {
  const all = (await getCollection('music')).filter((e) => e.data.section !== 'index');
  const build = (parent: string | null, section: string): MusicNode[] =>
    all
      .filter((e) => (e.data.parent ?? null) === parent && e.data.section === section)
      .sort(byOrder)
      .map((entry) => ({ entry, children: build(entry.id, section) }));
  return { greek: build(null, 'greek'), english: build(null, 'english') };
}

export async function posts(kind: 'news' | 'reading') {
  return (await getCollection(kind)).sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export const formatDate = (d: Date) =>
  d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

type Post = CollectionEntry<'news' | 'reading'>;

/** First image in a post's Markdown, for card thumbnails. */
export const firstImage = (e: Post) => e.body?.match(/!\[[^\]]*\]\(([^)\s]+)/)?.[1];

/** Short plain-text teaser: the summary if set, else the opening words of the body. */
export function excerpt(e: Post, max = 170) {
  if (e.data.summary) return e.data.summary;
  const text = (e.body ?? '')
    .split('\n')
    .filter((l) => !/^\s*(!\[|<|_.*_\s*$|\*.*\*\s*$)/.test(l)) // images, HTML, caption lines
    .join(' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_#>`|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? text.slice(0, text.lastIndexOf(' ', max)) + '…' : text;
}

/** Number of distinct hymn PDFs linked from the music pages. */
export async function hymnCount() {
  const urls = new Set<string>();
  for (const e of await getCollection('music')) for (const m of e.body?.matchAll(/\(([^)\s]+\.pdf)\)/g) ?? []) urls.add(m[1]);
  return urls.size;
}

/** Distinct hymn PDFs linked from one music page. */
export const pdfCount = (e: MusicEntry) => new Set([...(e.body?.matchAll(/\(([^)\s]+\.pdf)\)/g) ?? [])].map((m) => m[1])).size;

/** Hymn PDFs on a music page and every page beneath it. */
export const subtreeCount = (n: MusicNode): number => pdfCount(n.entry) + n.children.reduce((s, c) => s + subtreeCount(c), 0);
