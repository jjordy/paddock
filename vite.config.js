import { defineConfig } from 'vite'
import { rogue, rogueRouter, rogueSsr } from '@jjordy/rogue/vite'

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

// Static-flagged routes in rogue 0.7.0 fetch `${url}/data.json` in BOTH
// production (where SSG emitted the file) and dev (where it didn't).
// rogueSsr's middleware handles `Accept: application/json` content
// negotiation but doesn't recognize `*/data.json` paths, so static-route
// client-side nav 404s in dev. This plugin rewrites the request before
// it reaches rogueSsr — strip the suffix, force JSON accept, fall through
// to rogueSsr's existing JSON path. Filed upstream as jjordy/rogue#61;
// drop once rogueSsr itself handles data.json paths.
const devDataJsonShim = () => ({
  name: 'paddock:dev-data-json',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.method === 'GET' && req.url && req.url.endsWith('/data.json')) {
        const rewritten = req.url.replace(/\/data\.json$/, '') || '/'
        req.url = rewritten
        // rogueSsr reads `req.originalUrl ?? req.url` (it has its own
        // reason for preferring originalUrl) so we have to overwrite both.
        if (req.originalUrl) req.originalUrl = rewritten
        req.headers.accept = 'application/json'
      }
      next()
    })
  },
})

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  // Order matters: devDataJsonShim rewrites the URL BEFORE rogueSsr sees
  // it, so rogueSsr's existing Accept: JSON branch handles the response.
  plugins: [rogue(), rogueRouter(), devDataJsonShim(), rogueSsr(), fixNestedDynamicRoutes()],
  esbuild: { jsx: 'preserve' },
})
