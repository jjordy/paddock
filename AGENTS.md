# AGENTS.md

Project conventions for AI coding agents working on `paddock`.

## What this is

`paddock` is an F1 stats dashboard built with [`@jjordy/rogue`](https://www.npmjs.com/package/@jjordy/rogue) — the JSX-to-web-components framework. It exists for two reasons:

1. **A useful site.** A clean, fast, deep archive of Formula 1 history (1950–present) covering seasons, races, drivers, constructors, and records.
2. **A showcase for rogue.** Every page is built to exercise a real `@jjordy/rogue` feature — `staticPaths`, signals, `defineComponent`, `useForm`, view transitions, prefetch. If you find yourself reaching for something rogue doesn't do, that's a signal: either find the rogue-native way or file an issue against `jjordy/rogue` first.

## Data source

[Jolpica-F1 API](https://github.com/jolpica/jolpica-f1) — a free, key-less continuation of the Ergast historical dataset. Same shape.

We do **not** fetch from the API at build time (~5500 requests, ~25 min). Instead:

- `scripts/sync-data.ts` fetches Jolpica-F1, normalizes, and writes to `data/*.json`.
- That script runs occasionally (manually + CI cron during race weekends).
- Loaders read from `data/` via `node:fs`. Build is seconds.

## Hosting

Pure SSG → GitHub Pages. No server. No client API calls at runtime.

The build runs `vite build` for the client + a separate SSG pass that walks every route from the manifest (using `staticPaths` from rogue 0.7.0 for `[year]`, `[round]`, `[driverId]`, `[constructorId]` segments) and writes `dist/` as a static site. ~10–15K URLs.

## Repository layout

```
src/
  main.ts           Client mount via @jjordy/rogue/router
  global.d.ts       Window + virtual:jsx-wc/routes types
  pages/
    _layout.jsx     Classic-motorsport shell (red/black/warm-white)
    _layout.css     Layout styles (page-level CSS, NOT component CSS)
    index.jsx       Home — standings + last race + next race
    seasons.jsx     Season index
    seasons/[year].jsx
    races/[year]/[round].jsx
    drivers.jsx
    drivers/[driverId].jsx
    teams.jsx
    teams/[constructorId].jsx
    records.jsx
    compare.jsx     Head-to-head — client-only, useForm
    about.jsx
  components/       Custom-element widgets (defineComponent files)
    driver-card.jsx
    team-badge.jsx
    flag-icon.jsx
    position-chart.jsx        Lap-by-lap position evolution
    lap-time-chart.jsx        Scatter of lap times
    championship-arc.jsx      Cumulative points across a season
    line-chart.jsx
    bar-chart.jsx
    sparkline.jsx
    standings-table.jsx
    stat-grid.jsx
data/               JSON files committed to the repo (output of sync-data)
scripts/
  sync-data.ts      Jolpica-F1 → data/ JSON. Idempotent.
docs/
  agents/           How agent skills should treat this repo
  adr/              Architecture decision records
CONTEXT.md          Domain glossary — F1 terms
```

## Authoring conventions

These mirror the `@jjordy/rogue` conventions — see [`jjordy/rogue` AGENTS.md](https://github.com/jjordy/rogue/blob/main/AGENTS.md) for the framework-side details. Paddock-specific overlays:

### Components

- **Filename = kebab-tag.** `src/components/driver-card.jsx` → `<driver-card>`.
- **SVG primitives, no chart library.** Every chart is hand-rolled SVG inside a `defineComponent`. No D3, no Chart.js, no Plotly. The whole point is to demonstrate that rogue + SVG + signals is enough.
- **Co-located CSS.** A sibling `.css` file is auto-imported as a constructible `CSSStyleSheet` and attached via `adoptedStyleSheets`.

### Pages

- File-system routing per rogue conventions.
- **Loaders read from `data/`, not the network.** Build is deterministic and offline-capable.
- **Dynamic segments use `staticPaths`.** Every `[year]`, `[round]`, `[driverId]`, `[constructorId]` page exports a `staticPaths()` returning the full enumeration from `data/`. That's what makes the SSG walk work.
- **Page-level CSS goes in a sibling `.css` file** (`_layout.css`), imported with `import './_layout.css'`. The sibling-CSS auto-import only applies to `defineComponent` components.

### Visual identity

Classic motorsport. Ferrari red `#e10600` on warm off-white `#f7f3ec`. Black for ink. No gradients, no shadows, no rounded blob shapes. Vintage poster typography: heavy uppercase headings, monospace small-caps for labels, thick red rules under section titles. Charts use red/black/grey only — no rainbow palettes.

## Build / publish

This project uses **pnpm**. The `packageManager` field pins the exact version; corepack picks it up automatically. The `pnpm.onlyBuiltDependencies` allowlist is **empty by default** — postinstall scripts for transitive deps are refused unless explicitly added. Mirrors jsx-wc's posture; same security rationale.

- `pnpm install` — install deps. "Ignored build scripts" warnings are the protection working.
- `pnpm run dev` — Vite dev server.
- `pnpm run build` — production static build into `dist/`.
- `pnpm run preview` — local preview of the built output.
- `pnpm run typecheck` — `tsc --noEmit`.

## Style

- **No comments that restate the code.** Lead with WHY: hidden constraints, invariants, workarounds.
- **Don't invent abstractions for hypothetical reuse.** Three similar pages is fine.
- **Use the glossary's vocabulary.** Domain terms come from [`CONTEXT.md`](./CONTEXT.md). Don't drift to synonyms.
- **No third-party chart libraries.** If a chart can't be expressed in SVG + signals, raise it before adding a dependency.
