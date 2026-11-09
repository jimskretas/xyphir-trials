import { defineConfig } from 'vite';

// A relative base keeps the build valid on GitHub Pages project sites
// (https://<user>.github.io/<repo>/) without hard-coding the repository name.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
  },
});
