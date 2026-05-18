// /records — All-time record book. Aggregates over the per-Season
// standings files that are synced (currently 2024+). For Seasons
// pre-2024, we don't yet have per-Race results, so the "career"
// records reflect a 3-Season window — this page calls that out
// explicitly rather than pretending to be the full all-time book.

import { loadJson } from '../lib/load'

const SYNCED_YEARS = [2024, 2025, 2026]

export const loader = async () => {
  // Aggregate over the per-Round standings: the *last* round of each
  // Season gives the final standings (or the most recent if the Season
  // is in progress). Per-Driver: wins, podium finishes (positions 1–3),
  // points; per-Constructor: wins, points.
  const driverWins = new Map() // driverId → wins
  const driverPodiums = new Map()
  const driverPoints = new Map()
  const constructorWins = new Map()
  const constructorPoints = new Map()

  // Use per-Race results to count wins/podiums (more granular than
  // standings deltas, and we already loaded the data for slice 8).
  for (const year of SYNCED_YEARS) {
    let races
    try {
      races = await loadJson(`data/races/${year}.json`)
    } catch (err) {
      if (err.code === 'ENOENT') continue
      throw err
    }
    for (const r of races) {
      let results
      try {
        results = await loadJson(`data/results/${year}/${r.round}.json`)
      } catch (err) {
        if (err.code === 'ENOENT') continue
        throw err
      }
      for (const row of results) {
        const dWins = driverWins.get(row.driverId) ?? 0
        const dPodiums = driverPodiums.get(row.driverId) ?? 0
        const dPoints = driverPoints.get(row.driverId) ?? 0
        if (row.position === 1) driverWins.set(row.driverId, dWins + 1)
        if (row.position != null && row.position <= 3) driverPodiums.set(row.driverId, dPodiums + 1)
        driverPoints.set(row.driverId, dPoints + row.points)

        const cWins = constructorWins.get(row.constructorId) ?? 0
        const cPoints = constructorPoints.get(row.constructorId) ?? 0
        if (row.position === 1) constructorWins.set(row.constructorId, cWins + 1)
        constructorPoints.set(row.constructorId, cPoints + row.points)
      }
    }
  }

  // Champions per Season — last entry in the per-Round standings.
  const champions = []
  for (const year of SYNCED_YEARS) {
    let standings
    try {
      standings = await loadJson(`data/standings/${year}.json`)
    } catch (err) {
      if (err.code === 'ENOENT') continue
      throw err
    }
    const finalRound = standings.rounds[standings.rounds.length - 1]
    if (!finalRound) continue
    const winner = finalRound.drivers[0]
    if (!winner) continue
    champions.push({
      year,
      driverId: winner.driverId,
      points: winner.points,
      // The constructor field can be missing for in-progress Seasons.
      constructorId: winner.constructorId,
    })
  }

  // Top-N lists. Resolve display names from the lookup tables but
  // pass only the trimmed projection in the data.json — full tables
  // would double the page payload.
  const drivers = await loadJson('data/drivers.json')
  const constructors = await loadJson('data/constructors.json')
  const driversById = new Map(drivers.map((d) => [d.id, d]))
  const constructorsById = new Map(constructors.map((c) => [c.id, c]))

  const topN = (map, n) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([id, count]) => ({ id, count }))

  const decorateDriver = (e) => {
    const d = driversById.get(e.id)
    return {
      ...e,
      name: d ? `${d.givenName} ${d.familyName}` : e.id,
    }
  }
  const decorateConstructor = (e) => {
    const c = constructorsById.get(e.id)
    return {
      ...e,
      name: c ? c.name : e.id,
    }
  }
  const decorateChampion = (e) => {
    const d = driversById.get(e.driverId)
    const c = e.constructorId ? constructorsById.get(e.constructorId) : null
    return {
      ...e,
      driverName: d ? `${d.givenName} ${d.familyName}` : e.driverId,
      constructorName: c ? c.name : e.constructorId,
    }
  }

  return {
    syncedYears: SYNCED_YEARS,
    topWinsDrivers: topN(driverWins, 10).map(decorateDriver),
    topPodiumsDrivers: topN(driverPodiums, 10).map(decorateDriver),
    topPointsDrivers: topN(driverPoints, 10).map(decorateDriver),
    topWinsConstructors: topN(constructorWins, 10).map(decorateConstructor),
    topPointsConstructors: topN(constructorPoints, 10).map(decorateConstructor),
    champions: champions.map(decorateChampion).reverse(), // newest first
  }
}

export default function Records({ data }) {
  const {
    syncedYears,
    topWinsDrivers,
    topPodiumsDrivers,
    topPointsDrivers,
    topWinsConstructors,
    topPointsConstructors,
    champions,
  } = data
  return (
    <div>
      <h1>Records</h1>
      <p class="lead">
        Aggregated over Seasons {syncedYears[0]}–{syncedYears[syncedYears.length - 1]}.
        Older Seasons land here as the sync script extends backwards —
        the current window is what scripts/sync-data.ts has covered.
      </p>

      <h2>Champions</h2>
      <table class="list-table">
        <thead>
          <tr><th>Season</th><th>Champion</th><th>Constructor</th><th>Pts</th></tr>
        </thead>
        <tbody>
          {champions.map((c) => (
            <tr>
              <td class="num"><a href={`/seasons/${c.year}`}>{c.year}</a></td>
              <td><a href={`/drivers/${c.driverId}`}>{c.driverName}</a></td>
              <td>
                {c.constructorId
                  ? <a href={`/teams/${c.constructorId}`}>{c.constructorName}</a>
                  : <span class="meta">—</span>}
              </td>
              <td class="num">{c.points}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Most Race Wins — Drivers</h2>
      <table class="list-table">
        <thead><tr><th>#</th><th>Driver</th><th>Wins</th></tr></thead>
        <tbody>
          {topWinsDrivers.map((d, i) => (
            <tr>
              <td class="num">{i + 1}</td>
              <td><a href={`/drivers/${d.id}`}>{d.name}</a></td>
              <td class="num">{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Most Podium Finishes — Drivers</h2>
      <table class="list-table">
        <thead><tr><th>#</th><th>Driver</th><th>Podiums</th></tr></thead>
        <tbody>
          {topPodiumsDrivers.map((d, i) => (
            <tr>
              <td class="num">{i + 1}</td>
              <td><a href={`/drivers/${d.id}`}>{d.name}</a></td>
              <td class="num">{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Most Points — Drivers</h2>
      <table class="list-table">
        <thead><tr><th>#</th><th>Driver</th><th>Pts</th></tr></thead>
        <tbody>
          {topPointsDrivers.map((d, i) => (
            <tr>
              <td class="num">{i + 1}</td>
              <td><a href={`/drivers/${d.id}`}>{d.name}</a></td>
              <td class="num">{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Most Race Wins — Constructors</h2>
      <table class="list-table">
        <thead><tr><th>#</th><th>Constructor</th><th>Wins</th></tr></thead>
        <tbody>
          {topWinsConstructors.map((c, i) => (
            <tr>
              <td class="num">{i + 1}</td>
              <td><a href={`/teams/${c.id}`}>{c.name}</a></td>
              <td class="num">{c.count}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Most Points — Constructors</h2>
      <table class="list-table">
        <thead><tr><th>#</th><th>Constructor</th><th>Pts</th></tr></thead>
        <tbody>
          {topPointsConstructors.map((c, i) => (
            <tr>
              <td class="num">{i + 1}</td>
              <td><a href={`/teams/${c.id}`}>{c.name}</a></td>
              <td class="num">{c.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
