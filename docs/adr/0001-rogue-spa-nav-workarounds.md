# Rogue SPA-nav workarounds (force-static routes + view-transition fallback)

We patch `@jjordy/rogue` 0.7.0 in two places to make SPA navigation work reliably on dumb static hosts (GitHub Pages, `vite preview`): a `forceStaticRoutes` Vite plugin that flags every route entry `static: true`, and a `patch-package` hunk on `runtime/router-view-transitions.js` that runs the route's `update` callback directly if `startViewTransition` rejects before invoking it. Both are documented as filed-upstream workarounds and should be removed once `jjordy/rogue` ships fixes.

## Why

Two bugs in rogue 0.7.0 combine to silently kill SPA navigation on Paddock:

1. **Loader fetch picks the wrong transport for non-dynamic pages.** Rogue only emits `static: true` for routes that export `staticPaths` — so pages like `/teams`, `/records`, `/compare` fall through to a content-negotiated `fetch('/teams', { Accept: 'application/json' })`. On GH Pages and `vite preview` that returns the HTML 404 page, the loader throws, and the view transition aborts mid-flight. Paddock SSGs **every** route (the SSG pass walks the full manifest and writes `<route>/data.json` for all of them), so the `static: true` path is always safe for us.

2. **`startViewTransition` can reject before running its update callback.** When the browser aborts the transition (timeout, conflicting `view-transition-name`, etc.) before `update` is invoked, rogue awaits `viewTransition.finished`, sees the rejection, and bails — leaving the DOM on the previous page. The destination page never renders, no error surfaces, the URL is just stuck.

Together: click a link to `/teams`, the transition silently dies, the page appears frozen. Reload works (SSG output is correct), but the SPA is broken.

## Consequences

- **`vite.config.js` ships a `forceStaticRoutes` plugin** that post-transforms the `virtual:jsx-wc/routes` module to inject `static: true` on every route entry. Safe **only** because we SSG every route — if we ever introduce a runtime-only route, this plugin must learn to skip it.
- **`patches/@jjordy__rogue.patch` carries a second hunk** wrapping rogue's `update` callback with a `updateRan` flag and falling back to a direct `await update()` on rejection. Managed via `pnpm`'s `patchedDependencies`.
- Both workarounds are scoped to rogue 0.7.0. On a rogue upgrade, re-test SPA nav to `/teams`, `/records`, `/compare` (the routes without `staticPaths`) and remove whichever workaround is no longer needed. The inline comments in both files point back here.
- We accept the maintenance cost of a patched dependency rather than pinning rogue or routing around the bugs at the page level — page-level fixes would leak rogue internals into Paddock pages and defeat the showcase intent.
