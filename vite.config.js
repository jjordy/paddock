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
// rogueSsr's middleware only handles `Accept: application/json` and
// wraps the response as `{ data, params }`. Static routes expect the
// BARE loader value (matching the SSG-emitted shape), so we can't just
// rewrite into rogueSsr's content-neg path. This plugin handles
// `*/data.json` directly by calling rogue's `loadData` and returning
// the unwrapped value. Filed upstream as jjordy/rogue#61; drop once
// rogueSsr itself recognizes data.json paths.
const devDataJsonShim = () => ({
  name: 'paddock:dev-data-json',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.method !== 'GET' || !req.url || !req.url.endsWith('/data.json')) {
        return next()
      }
      try {
        const url = req.url.replace(/\/data\.json$/, '') || '/'
        const { loadData } = await server.ssrLoadModule('@jjordy/rogue/server')
        const { status, data } = await loadData(url, server)
        res.statusCode = status
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify(data ?? null))
      } catch (err) {
        server.ssrFixStacktrace?.(err)
        next(err)
      }
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
