import { defineConfig } from 'vite'
import { rogue, rogueRouter } from '@jjordy/rogue/vite'

// GitHub Pages serves the repo at /paddock/, not /. The deploy workflow
// sets BASE_PATH=/paddock/; dev and PR builds leave it unset and serve at /.
// Vite's `base` propagates to asset URLs and `import.meta.env.BASE_URL`,
// which rogue's runtime router honors when building hrefs.

// Workaround for jjordy/rogue's nested-dynamic-route bug: rogue 0.7.0's
// `rogueRouter` plugin only converts the LEAF filename's `[name]` →
// `:name` (via stemToSegment), leaving intermediate directory names as
// literal `[year]` in the emitted patterns. The runtime matchPath only
// handles `:name`, so `/races/2024/1` won't match `/races/[year]/:round`.
// This post-processor rewrites the virtual route module's source to
// convert any surviving `[name]` to `:name`. Filed upstream against
// jjordy/rogue; remove this once the fix lands.
const fixNestedDynamicRoutes = () => ({
  name: 'paddock:fix-nested-dynamic-routes',
  enforce: 'post',
  transform(code, id) {
    if (!id.includes('virtual:jsx-wc/routes')) return null
    if (!code.includes('[')) return null
    // Only replace in the `pattern:` field of route objects to be safe.
    const next = code.replace(
      /pattern:\s*(['"`])([^'"`]+)\1/g,
      (_m, quote, pattern) => `pattern: ${quote}${pattern.replace(/\[([^\]]+)\]/g, ':$1')}${quote}`,
    )
    return next === code ? null : { code: next, map: null }
  },
})

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [rogue(), rogueRouter(), fixNestedDynamicRoutes()],
  esbuild: { jsx: 'preserve' },
})
