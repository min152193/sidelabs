import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    imageService: 'passthrough'
  }),
  integrations: [mdx()],
  vite: {
    ssr: {
      noExternal: ['gsap', 'three']
    }
  }
});
