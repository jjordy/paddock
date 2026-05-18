import { loadJson } from '../../lib/load'

// Match the SYNCED_YEARS list on /records — these are the Seasons we
// have per-Race results for. Career aggregates only reflect this window
// (will expand as scripts/sync-data.ts grows its RESULTS_SYNC_YEARS).
const SYNCED_YEARS = [2024, 2025, 2026]

export const staticPaths = async () => {
  const drivers = await loadJson('data/drivers.json')
  return drivers.map((d) => ({ params: { driverId: d.id } }))
}

export const loader = async ({ params }) => {
  const drivers = await loadJson('data/drivers.json')
  const driver = drivers.find((d) => d.id === params.driverId)
  if (!driver) return null

  // Per-Season aggregate for this Driver. Per-file memoization in
  // loadJson means each (races, results) file is parsed once per build
  // — the 879 Driver pages × ~70 race files don't multiply.
  const careerSeasons = []
  for (const year of SYNCED_YEARS) {
    let races
    try {
      races = await loadJson(`data/races/${year}.json`)
    } catch (err) {
      if (err.code === 'ENOENT') continue
      throw err
    }
    let racesEntered = 0
    let wins = 0
    let podiums = 0
    let poles = 0
    let points = 0
    let fastestLaps = 0
    let dnfs = 0
    let bestFinish = null
    for (const r of races) {
      let results
      try {
        results = await loadJson(`data/results/${year}/${r.round}.json`)
      } catch (err) {
        if (err.code === 'ENOENT') continue
        throw err
      }
      const row = results.find((x) => x.driverId === driver.id)
      if (!row) continue
      racesEntered++
      points += row.points
      if (row.position === 1) wins++
      if (row.position != null && row.position <= 3) podiums++
      if (row.grid === 1) poles++
      if (row.fastestLapRank === 1) fastestLaps++
      if (row.position == null) dnfs++
      if (row.position != null && (bestFinish == null || row.position < bestFinish)) {
        bestFinish = row.position
      }
    }
    if (racesEntered > 0) {
      careerSeasons.push({
        year,
        races: racesEntered,
        wins,
        podiums,
        poles,
        points,
        fastestLaps,
        dnfs,
        bestFinish,
      })
    }
  }

  // Career totals — sum across the Seasons we have.
  const totals = careerSeasons.reduce(
    (a, s) => ({
      races: a.races + s.races,
      wins: a.wins + s.wins,
      podiums: a.podiums + s.podiums,
      poles: a.poles + s.poles,
      points: a.points + s.points,
      fastestLaps: a.fastestLaps + s.fastestLaps,
      dnfs: a.dnfs + s.dnfs,
    }),
    { races: 0, wins: 0, podiums: 0, poles: 0, points: 0, fastestLaps: 0, dnfs: 0 },
  )

  return { driver, careerSeasons, totals, syncedYears: SYNCED_YEARS }
}

export default function DriverDetail({ data }) {
  if (!data) {
    return (
      <div>
        <h1>Unknown driver</h1>
        <p><a href="/drivers">↩ all Drivers</a></p>
      </div>
    )
  }
  const { driver, careerSeasons, totals, syncedYears } = data
  const hasCareer = careerSeasons.length > 0
  const pointsSeries = careerSeasons.map((s) => s.points)
  const winsSeries = careerSeasons.map((s) => s.wins)
  const podiumsSeries = careerSeasons.map((s) => s.podiums)
  return (
    <div>
      <h1>{driver.givenName} {driver.familyName}</h1>
      <p class="lead">
        <a href="/drivers">↩ all Drivers</a>
      </p>

      <div class="stat-grid">
        {driver.number != null && (
          <div class="stat">
            <div class="stat-label">Number</div>
            <div class="stat-value accent">{driver.number}</div>
          </div>
        )}
        {driver.code && (
          <div class="stat">
            <div class="stat-label">Code</div>
            <div class="stat-value">{driver.code}</div>
          </div>
        )}
        <div class="stat">
          <div class="stat-label">Nationality</div>
          <div class="stat-value">{driver.nationality}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Born</div>
          <div class="stat-value">{driver.dateOfBirth}</div>
        </div>
      </div>

      {hasCareer && (
        <>
          <h2>Career ({syncedYears[0]}–{syncedYears[syncedYears.length - 1]})</h2>
          <div class="stat-grid">
            <div class="stat">
              <div class="stat-label">Races</div>
              <div class="stat-value">{totals.races}</div>
            </div>
            <div class="stat">
              <div class="stat-label">Wins</div>
              <div class="stat-value accent">{totals.wins}</div>
            </div>
            <div class="stat">
              <div class="stat-label">Podiums</div>
              <div class="stat-value">{totals.podiums}</div>
            </div>
            <div class="stat">
              <div class="stat-label">Poles</div>
              <div class="stat-value">{totals.poles}</div>
            </div>
            <div class="stat">
              <div class="stat-label">Fastest Laps</div>
              <div class="stat-value">{totals.fastestLaps}</div>
            </div>
            <div class="stat">
              <div class="stat-label">Points</div>
              <div class="stat-value">{totals.points}</div>
            </div>
            <div class="stat">
              <div class="stat-label">DNFs</div>
              <div class="stat-value">{totals.dnfs}</div>
            </div>
          </div>

          <h3>Per-Season</h3>
          <table class="list-table">
            <thead>
              <tr>
                <th>Season</th>
                <th>Races</th>
                <th>Wins</th>
                <th>Podiums</th>
                <th>Poles</th>
                <th>Best</th>
                <th>DNFs</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {careerSeasons.map((s) => (
                <tr>
                  <td><a href={`/seasons/${s.year}`}>{s.year}</a></td>
                  <td class="meta">{s.races}</td>
                  <td class="meta">{s.wins}</td>
                  <td class="meta">{s.podiums}</td>
                  <td class="meta">{s.poles}</td>
                  <td class="meta">{s.bestFinish != null ? `P${s.bestFinish}` : '—'}</td>
                  <td class="meta">{s.dnfs}</td>
                  <td class="num">{s.points}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3>Evolution</h3>
          <div class="evolution-grid">
            <div class="evolution-cell">
              <div class="evolution-label">Points / Season</div>
              <sparkline values={JSON.stringify(pointsSeries)} color="#e10600"></sparkline>
            </div>
            <div class="evolution-cell">
              <div class="evolution-label">Wins / Season</div>
              <sparkline values={JSON.stringify(winsSeries)} color="#0a0a0a"></sparkline>
            </div>
            <div class="evolution-cell">
              <div class="evolution-label">Podiums / Season</div>
              <sparkline values={JSON.stringify(podiumsSeries)} color="#5a5a5a"></sparkline>
            </div>
          </div>
        </>
      )}

      <h2>More</h2>
      <p>
        <a href={driver.url} target="_blank" rel="noopener">
          Wikipedia: {driver.givenName} {driver.familyName}
        </a>
      </p>
    </div>
  )
}
