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
