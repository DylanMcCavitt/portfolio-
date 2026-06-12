// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // Canonical origin — drives `Astro.site`, the `<link rel="canonical">` in the
  // layouts, and the absolute URLs in `src/pages/sitemap.xml.ts` (#25).
  site: 'https://dylanmccavitt.xyz',
});