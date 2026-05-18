import { loadJson } from '../../../lib/load'

export const staticPaths = async () => {
  const seasons = await loadJson('data/seasons.json')
  const out = []
  for (const s of seasons) {
    const races = await loadJson(`data/races/${s.year}.json`)
    for (const r of races) {
      out.push({ params: { year: String(r.year), round: String(r.round) } })
    }
  }
  return out
}

export const loader = async ({ params }) => {
  const year = Number(params.year)
  const round = Number(params.round)
  const races = await loadJson(`data/races/${year}.json`)
  const race = races.find((r) => r.round === round)
  if (!race) return null

  // Results may not be synced yet for older Seasons — graceful fallback.
  let rawResults = null
  try {
    rawResults = await loadJson(`data/results/${year}/${round}.json`)
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }

  // Decorate per-row with display strings rather than including the full
  // drivers/constructors lookup tables in this page's data.json — those
  // would bloat every race's payload by ~250 KB. The trimmed row carries
  // only what the page renders.
  let results = null
  let finalOrder = []
  if (rawResults) {
    const drivers = await loadJson('data/drivers.json')
    const constructors = await loadJson('data/constructors.json')
    const driversById = new Map(drivers.map((d) => [d.id, d]))
    const constructorsById = new Map(constructors.map((c) => [c.id, c]))
    results = rawResults.map((r) => {
      const d = driversById.get(r.driverId)
      const c = constructorsById.get(r.constructorId)
      return {
        positionText: r.positionText,
        points: r.points,
        driverId: r.driverId,
        driverName: d ? `${d.givenName} ${d.familyName}` : r.driverId,
        constructorId: r.constructorId,
        constructorName: c ? c.name : r.constructorId,
        grid: r.grid,
        laps: r.laps,
        time: r.time,
        status: r.status,
      }
    })
    // Final classification order — used by the charts to pick which top-N
    // Drivers get distinct colors instead of the pale-grey wash.
    finalOrder = rawResults
      .filter((r) => r.position != null)
      .sort((a, b) => a.position - b.position)
      .map((r) => r.driverId)
  }

  // Per-Lap timings — heavy. Only synced for recent Seasons; missing
  // file is fine, the chart components render a graceful placeholder.
  let laps = null
  try {
    laps = await loadJson(`data/laps/${year}/${round}.json`)
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }

  return { race, results, laps, finalOrder }
}

export default function RaceDetail({ data }) {
  if (!data) {
    return (
      <div>
        <h1>Unknown race</h1>
        <p><a href="/seasons">↩ all Seasons</a></p>
      </div>
    )
  }
  const { race, results, laps, finalOrder } = data
  const vtName = `morph-races-${race.year}-${race.round}`
  return (
    <div>
      <div class="detail-hero" style={`view-transition-name: ${vtName}`}>
        <div class="detail-hero-tag-small">Round {race.round} · {race.year}</div>
        <h1>{race.name}</h1>
        <div class="detail-hero-meta">
          {race.date} · {race.circuitId} · <a href={`/seasons/${race.year}`}>{race.year} calendar</a>
        </div>
        <div class="detail-hero-tag">R{race.round}</div>
      </div>

      <div class="stat-grid">
        <div class="stat">
          <div class="stat-label">Date</div>
          <div class="stat-value">{race.date}</div>
        </div>
        {race.time && (
          <div class="stat">
            <div class="stat-label">Start (UTC)</div>
            <div class="stat-value">{race.time.replace('Z', '')}</div>
          </div>
        )}
        <div class="stat">
          <div class="stat-label">Circuit</div>
          <div class="stat-value">{race.circuitId}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Round</div>
          <div class="stat-value accent">{race.round}</div>
        </div>
      </div>

      <h2>Results</h2>
      {results == null ? (
        <p class="meta">
          Race results for Seasons before 2024 are not yet synced.{' '}
          The sync script's <code>RESULTS_SYNC_YEARS</code> list controls
          which years are covered — see the README.
        </p>
      ) : results.length === 0 ? (
        <p class="meta">
          No results recorded for this Race — Round {race.round} of the{' '}
          {race.year} Season may not have happened yet.
        </p>
      ) : (
        <table class="list-table">
          <thead>
            <tr>
              <th>Pos</th>
              <th>Driver</th>
              <th>Constructor</th>
              <th>Grid</th>
              <th>Laps</th>
              <th>Time / Status</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr>
                <td class="num">{r.positionText}</td>
                <td><a href={`/drivers/${r.driverId}`}>{r.driverName}</a></td>
                <td><a href={`/teams/${r.constructorId}`}>{r.constructorName}</a></td>
                <td class="meta">{r.grid}</td>
                <td class="meta">{r.laps}</td>
                <td class="meta">{r.time ?? r.status}</td>
                <td class="num">{r.points || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {laps && laps.drivers && laps.drivers.length > 0 && (
        <>
          <h2>Position evolution</h2>
          <position-chart data={JSON.stringify(laps)} finalOrder={JSON.stringify(finalOrder)}></position-chart>

          <h2>Lap times</h2>
          <lap-time-chart data={JSON.stringify(laps)} finalOrder={JSON.stringify(finalOrder)}></lap-time-chart>
        </>
      )}
    </div>
  )
}
