// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.thehtm.org',
  // Emit /information.html etc. Cloudflare serves them at /information.
  build: { format: 'file' },
  trailingSlash: 'never',
  integrations: [sitemap()],
});
