// /compare — Head-to-head Driver comparison. Client-only interactive
// page: pick two Drivers, see their bio data side-by-side. Future
// iterations can layer career stats once those are pre-aggregated.
//
// Loader returns the full Driver list (already exposed via /drivers
// so paying the same payload cost is fine here) and the URL search
// params if present — `?a=hamilton&b=verstappen` deep-links to a
// specific comparison.

import { signal, effect } from '@jjordy/rogue'
import { loadJson } from '../lib/load'

export const loader = async ({ url }) => {
  const drivers = await loadJson('data/drivers.json')
  drivers.sort((a, b) => a.familyName.localeCompare(b.familyName))
  const u = new URL(url, 'http://x') // base only matters for parsing
  return {
    drivers,
    initialA: u.searchParams.get('a') ?? null,
    initialB: u.searchParams.get('b') ?? null,
  }
}

export default function Compare({ data }) {
  const { drivers, initialA, initialB } = data
  const byId = new Map(drivers.map((d) => [d.id, d]))

  const [a, setA] = signal(initialA && byId.has(initialA) ? initialA : '')
  const [b, setB] = signal(initialB && byId.has(initialB) ? initialB : '')

  // Reflect the current selection in the URL so the comparison is
  // shareable. Skipped during SSG/SSR — window is a linkedom shim
  // there and `window.location.href` is undefined.
  effect(() => {
    const aId = a()
    const bId = b()
    if (import.meta.env.SSR) return
    if (typeof window === 'undefined' || !window.location?.href) return
    const u = new URL(window.location.href)
    if (aId) u.searchParams.set('a', aId); else u.searchParams.delete('a')
    if (bId) u.searchParams.set('b', bId); else u.searchParams.delete('b')
    const next = u.pathname + (u.search ? u.search : '')
    if (window.location.pathname + window.location.search !== next) {
      window.history.replaceState(null, '', next)
    }
  })

  const renderDriverCard = (id, label) => {
    const d = id ? byId.get(id) : null
    return (
      <div class="compare-card">
        <div class="compare-card-label">{label}</div>
        {d ? (
          <div class="compare-card-body">
            <div class="compare-card-name">
              <a href={`/drivers/${d.id}`}>{d.givenName} {d.familyName}</a>
            </div>
            <dl>
              <dt>Code</dt><dd>{d.code ?? '—'}</dd>
              <dt>Number</dt><dd>{d.number ?? '—'}</dd>
              <dt>Nationality</dt><dd>{d.nationality}</dd>
              <dt>Born</dt><dd>{d.dateOfBirth}</dd>
            </dl>
          </div>
        ) : (
          <div class="compare-card-empty">Pick a Driver →</div>
        )}
      </div>
    )
  }

  return (
    <div>
      <h1>Compare Drivers</h1>
      <p class="lead">
        Pick any two Drivers from the archive — including Drivers from
        Seasons decades apart. The URL updates so the comparison is
        shareable.
      </p>

      <div class="compare-pickers">
        <label class="picker">
          <span class="picker-label">Driver A</span>
          {/* `bind:value` on <select> fails during SSR because linkedom's
              HTMLSelectElement has no `value` setter; an onChange-only
              binding renders cleanly server-side. The default-option-
              first means deep-link ?a= won't pre-select the dropdown
              until the user picks — the cards do still reflect it via
              the signal. */}
          <select onChange={(e) => setA(e.target.value)}>
            <option value="">— pick —</option>
            {drivers.map((d) => (
              <option value={d.id} selected={d.id === initialA}>{d.familyName}, {d.givenName}</option>
            ))}
          </select>
        </label>
        <span class="vs">vs</span>
        <label class="picker">
          <span class="picker-label">Driver B</span>
          <select onChange={(e) => setB(e.target.value)}>
            <option value="">— pick —</option>
            {drivers.map((d) => (
              <option value={d.id} selected={d.id === initialB}>{d.familyName}, {d.givenName}</option>
            ))}
          </select>
        </label>
      </div>

      <div class="compare-grid">
        {renderDriverCard(a(), 'A')}
        {renderDriverCard(b(), 'B')}
      </div>

      <p class="meta">
        Head-to-head career stats (wins, podiums, poles, fastest laps)
        will surface here once the full archive is post-processed into
        per-Driver aggregates.
      </p>
    </div>
  )
}
