#!/usr/bin/env tsx
//
// scripts/ssg.ts
//
// Static site generation. Walks every route from the rogue route manifest
// — including dynamic routes that opt in via `export const staticPaths`
// (rogue 0.7.0) — and pre-renders each URL to `dist/<route>/index.html`
// using rogue's own SSR machinery. Also writes a sibling `data.json`
// containing the loader's return value so client-side navigations to
// known-static URLs can fetch it instead of hitting a (non-existent)
// SSR endpoint.
//
// Output, given `/seasons/[year].jsx` with a staticPaths()` enumerating
// 1950..2026:
//
//   dist/seasons/1950/index.html
//   dist/seasons/1950/data.json
//   ...
//   dist/seasons/2026/index.html
//   dist/seasons/2026/data.json
//
// Also writes `dist/404.html` — GH Pages serves it for unmatched paths,
// and rogue's `_404.jsx` (when present) gets pre-rendered into it.
//
// Run AFTER `vite build`. The chained `pnpm run build` script handles
// this. Honors BASE_PATH=/paddock/ when deploying to GH Pages so all
// emitted hrefs are correctly prefixed.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createServer, type ViteDevServer } from 'vite'
import { parseHTML } from 'linkedom'
// `setupDOM` is rogue's alias for installDom — installs a linkedom-backed
// DOM into globalThis before any runtime module that touches `document`
// loads. Required because the runtime is browser-first.
import { setupDOM } from '@jjordy/rogue/testing'

const BASE = (process.env.BASE_PATH ?? '/').replace(/\/?$/, '/')
const BASE_TRIM = BASE === '/' ? '' : BASE.replace(/\/$/, '')

await setupDOM()

if (!existsSync('dist/index.html')) {
  console.error('dist/index.html not found — run `vite build` first.')
  process.exit(1)
}

const vite: ViteDevServer = await createServer({
  base: BASE,
  server: { middlewareMode: true },
  appType: 'custom',
})

const { render, loadData } = await import('@jjordy/rogue/server')
const manifest = await vite.ssrLoadModule('virtual:jsx-wc/routes')

// ============================================================
// URL enumeration
//
// Two sources of URLs:
//   1. Fully-static patterns (no `:param`, no `*`) — render directly.
//   2. Dynamic routes whose page module exports `staticPaths` — call it
//      to get the param sets, expand each into a concrete URL.
//
// `/` is always included so the home page renders even if the project
// adds an explicit `/` route or omits one.
// ============================================================

interface RouteEntry {
  pattern: string
  static?: boolean
  load: () => Promise<any>
}

const urls = new Set<string>(['/'])
const staticRoutePatterns: string[] = []

for (const route of manifest.routes as RouteEntry[]) {
  if (!route.pattern.includes(':') && !route.pattern.includes('*')) {
    urls.add(route.pattern)
    continue
  }
  if (!route.static) continue

  const pageMod = await route.load()
  if (typeof pageMod.staticPaths !== 'function') {
    console.warn(`  ssg: route ${route.pattern} has static=true but no staticPaths() export — skipping`)
    continue
  }
  const sets = await pageMod.staticPaths()
  if (!Array.isArray(sets)) {
    console.warn(`  ssg: ${route.pattern} staticPaths() returned non-array — skipping`)
    continue
  }
  staticRoutePatterns.push(route.pattern)
  for (const entry of sets) {
    const params = entry?.params ?? {}
    const expanded = expandPattern(route.pattern, params)
    if (expanded != null) urls.add(expanded)
  }
}

const allUrls = [...urls]

// Expand `/seasons/:year` with `{ year: '2024' }` → `/seasons/2024`.
// Missing params → warn + skip.
function expandPattern(pattern: string, params: Record<string, unknown>): string | null {
  const out: string[] = []
  for (const seg of pattern.split('/')) {
    if (!seg) { out.push(''); continue }
    if (seg.startsWith(':')) {
      const name = seg.replace(/[:*]/g, '')
      const value = params[name]
      if (value == null) {
        console.warn(`  ssg: pattern ${pattern} missing param ${name} — skipping URL`)
        return null
      }
      out.push(String(value))
    } else {
      out.push(seg)
    }
  }
  return out.join('/').replace(/\/+/g, '/') || '/'
}

// ============================================================
// Render every URL
// ============================================================

const shell = readFileSync('dist/index.html', 'utf-8')

// Vite's `base` prefixes asset URLs (script/link tags emitted by the
// build), but root-relative hrefs/srcs in the SSR'd app body still need
// rewriting so links like <a href="/seasons"> become <a href="/paddock/seasons">.
function withBaseHrefs(html: string): string {
  if (!BASE_TRIM) return html
  const re = (attr: string) => new RegExp(`${attr}="/([^"/][^"]*)"`, 'g')
  return html
    .replace(re('href'), (m, rest) =>
      rest.startsWith(BASE_TRIM.slice(1) + '/') ? m : `href="${BASE_TRIM}/${rest}"`)
    .replace(re('src'), (m, rest) =>
      rest.startsWith(BASE_TRIM.slice(1) + '/') ? m : `src="${BASE_TRIM}/${rest}"`)
}

for (const url of allUrls) {
  // One loader call per URL. prefetchedData lets render() skip the second
  // invocation; the same value is JSON-encoded into the sibling data.json.
  const { data, status: dataStatus } = await loadData(url, vite)
  const { html: full, status } = await render(url, vite, { prefetchedData: data })

  const { document: src } = parseHTML(full)
  const appDiv = src.getElementById('app')
  const dataScript = [...src.querySelectorAll('script')]
    .find((s: any) => s.textContent && s.textContent.includes('__JSX_WC_DATA__'))

  const { document: out } = parseHTML(shell)
  const target = out.getElementById('app')
  if (target && appDiv) target.innerHTML = appDiv.innerHTML

  if (dataScript && out.body) {
    const s = out.createElement('script')
    s.textContent = dataScript.textContent
    out.body.insertBefore(s, out.body.firstChild)
  }

  const outDir = url === '/' ? 'dist' : `dist${url}`
  mkdirSync(outDir, { recursive: true })
  const htmlPath = `${outDir}/index.html`
  const html = '<!doctype html>\n' + withBaseHrefs(out.documentElement.outerHTML)
  writeFileSync(htmlPath, html)

  // Even null-data routes get a data.json — keeps the client-side router's
  // fetch from 404ing → HTML parse failure.
  writeFileSync(`${outDir}/data.json`, JSON.stringify(data ?? null))

  console.log(`  ssg: ${htmlPath} (${status})${dataStatus !== 200 ? ` [data ${dataStatus}]` : ''}`)
}

// ============================================================
// 404 — GH Pages serves 404.html for any unmatched path.
// Render rogue's _404 page (if present) into it.
// ============================================================

const { html: notFoundHtml } = await render('/__paddock_ssg_unmatched_path__', vite)
const { document: nfSrc } = parseHTML(notFoundHtml)
const nfApp = nfSrc.getElementById('app')
const { document: nfOut } = parseHTML(shell)
const nfTarget = nfOut.getElementById('app')
if (nfTarget && nfApp) nfTarget.innerHTML = nfApp.innerHTML
writeFileSync(
  'dist/404.html',
  '<!doctype html>\n' + withBaseHrefs(nfOut.documentElement.outerHTML),
)
console.log(`  ssg: dist/404.html`)

await vite.close()
console.log(
  `\nSSG complete: ${allUrls.length} URL${allUrls.length === 1 ? '' : 's'} + 404` +
  (staticRoutePatterns.length
    ? ` (${staticRoutePatterns.length} dynamic route${staticRoutePatterns.length === 1 ? '' : 's'} enumerated via staticPaths)`
    : ''),
)
process.exit(0)
