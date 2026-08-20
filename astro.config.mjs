import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://new.nuvya.vc',
  output: 'static',
  trailingSlash: 'never',
  integrations: [sitemap(), mdx()],
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
});
