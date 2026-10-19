# thehtm.org

Website of The Holy Transfiguration Monastery, Brookline, MA.

- **Built with:** [Astro](https://astro.build) (static site)
- **Editor for the monks:** [Pages CMS](https://pagescms.org), configured in `.pages.yml`
- **Search:** [Pagefind](https://pagefind.app)
- **Hosting:** Cloudflare Pages

It replaces the old Weebly site. Every old address still works.

## Working on the site

```sh
npm install
npm run dev          # http://localhost:4321, live reload
npm run build        # builds to dist/ and indexes search
npm run verify       # checks every old URL and every internal link/PDF
npm run preview:cf   # serves dist/ the way Cloudflare will (redirects, clean URLs)
```

Requires Node 22 or newer.

## Where things live

| What | Where |
|---|---|
| News posts | `src/content/news/*.md` |
| Spiritual Reading posts | `src/content/reading/*.md` |
| Music pages | `src/content/music/*.md`. The file name is the address: `vespers.md` → `/vespers`. Menu position comes from `section`, `parent` and `order`. |
| Photo albums | `src/content/albums/*.yml` |
| Home and Information text | `src/content/pages/` |
| Contact details, menu, recommended links | `src/data/site.json` |
| Old site files (214 PDFs, images) | `public/uploads/...`, kept at their original paths |
| New uploads from the editor | `public/files/` (PDFs), `public/images/uploads/` (photos) |
| Old URL redirects | `public/_redirects` |
| Layout and design | `src/layouts/Base.astro`, `src/styles/global.css` |

## URLs

Cloudflare serves pages without `.html`, so `/information.html` redirects permanently to `/information`. Post URLs (`/news/<slug>`) and all PDF URLs are unchanged from the Weebly site. Weebly's older `/1/post/...` and `/2/post/...` links redirect to the right posts.

## Deploying (Cloudflare Pages)

Connect the GitHub repo in Cloudflare → Workers & Pages → Create → Pages → Connect to Git.

- Build command: `npm run build`
- Output directory: `dist`
- Node version: read from `.node-version`

Every push to `main` deploys. Other branches get preview URLs.

## Migration (already done, kept for reference)

`scripts/migrate.mjs` converted the 2022 Weebly export (`~/Downloads/thehtm_org/896071982121838626-1659113465.zip`) into the files above:

```sh
node scripts/migrate.mjs <unzipped-export-dir>
```

Re-running it **overwrites** these hand-edited files:

- `pages/home.md`
- `pages/information.md`
- `music/music.md`
- `music/vespers.md`
- `music/divine-liturgy.md`

Back them up first.

## Design (this edition)

This repo is the **modern redesign** of the faithful rebuild in `../thehtm-site`. The content,
URLs, scripts and editor setup are identical; only the templates and `src/styles/global.css` differ.

- Same palette and type as the original: near-black surfaces, oxblood `#560007`, red `#f64c3f` links, Georgia serif.
- Full-width layout with a sticky header, a photo hero on the home page, and card grids for posts, albums and the music index.
- Byzantine touches rather than "web app" ones: sharp corners everywhere, double-rule borders like an icon frame,
  letter-spaced uppercase serif labels, a muted gold `--gold` for hairlines and the ✠ ornaments.
- The full menu needs about 1180px; below `1200px` it collapses behind a Menu button (no JavaScript).
