import { defineConfig } from 'vite'
import { rogue, rogueRouter } from '@jjordy/rogue/vite'

// GitHub Pages serves the repo at /paddock/, not /. The deploy workflow
// sets BASE_PATH=/paddock/; dev and PR builds leave it unset and serve at /.
// Vite's `base` propagates to asset URLs and `import.meta.env.BASE_URL`,
// which rogue's runtime router honors when building hrefs.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [rogue(), rogueRouter()],
  esbuild: { jsx: 'preserve' },
})
