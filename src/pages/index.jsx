import { loadJson } from '../lib/load'

const TOP_N = 5

export const loader = async () => {
  const standings = await loadJson('data/standings/current.json')
  const drivers = await loadJson('data/drivers.json')
  const constructors = await loadJson('data/constructors.json')
  const driversById = new Map(drivers.map((d) => [d.id, d]))
  const constructorsById = new Map(constructors.map((c) => [c.id, c]))

  const races = await loadJson(`data/races/${standings.year}.json`)

  // Decorate the top of each standings table with display names —
  // avoids inlining the full lookup tables on the home page.
  const topDrivers = standings.drivers.slice(0, TOP_N).map((s) => {
    const d = driversById.get(s.driverId)
    const c = s.constructorId ? constructorsById.get(s.constructorId) : null
    return {
      ...s,
      driverName: d ? `${d.givenName} ${d.familyName}` : s.driverId,
      constructorName: c ? c.name : s.constructorId,
    }
  })
  const topConstructors = standings.constructors.slice(0, TOP_N).map((s) => {
    const c = constructorsById.get(s.constructorId)
    return { ...s, constructorName: c ? c.name : s.constructorId }
  })

  // Last + next Race relative to build time. Date comparison only — the
  // home page rebuilds at least weekly, so a race-day SSG output will be
  // stale by the next cron tick at worst.
  const todayIso = new Date().toISOString().slice(0, 10)
  const past = races.filter((r) => r.date < todayIso)
  const future = races.filter((r) => r.date >= todayIso)
  past.sort((a, b) => b.date.localeCompare(a.date))
  future.sort((a, b) => a.date.localeCompare(b.date))
  const lastRace = past[0] ?? null
  const nextRace = future[0] ?? null

  return {
    standings: { year: standings.year, round: standings.round },
    topDrivers,
    topConstructors,
    lastRace,
    nextRace,
  }
}

export default function Home({ data }) {
  const { standings, topDrivers, topConstructors, lastRace, nextRace } = data
  return (
    <div>
      <h1>The {standings.year} Season</h1>
      <p class="lead">
        Standings after Round {standings.round}.{' '}
        <a href={`/seasons/${standings.year}`}>↪ full calendar</a>
      </p>

      <h2>Driver standings</h2>
      <table class="list-table">
        <thead>
          <tr>
            <th>Pos</th>
            <th>Driver</th>
            <th>Constructor</th>
            <th>Wins</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {topDrivers.map((d) => (
            <tr>
              <td class="num">{d.position}</td>
              <td><a href={`/drivers/${d.driverId}`}>{d.driverName}</a></td>
              <td>
                {d.constructorId
                  ? <a href={`/teams/${d.constructorId}`}>{d.constructorName}</a>
                  : <span class="meta">—</span>}
              </td>
              <td class="meta">{d.wins}</td>
              <td class="num">{d.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p class="meta">
        <a href="/drivers">↪ all {standings.year} Drivers</a>
      </p>

      <h2>Constructor standings</h2>
      <table class="list-table">
        <thead>
          <tr>
            <th>Pos</th>
            <th>Constructor</th>
            <th>Wins</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {topConstructors.map((c) => (
            <tr>
              <td class="num">{c.position}</td>
              <td><a href={`/teams/${c.constructorId}`}>{c.constructorName}</a></td>
              <td class="meta">{c.wins}</td>
              <td class="num">{c.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p class="meta">
        <a href="/teams">↪ all Constructors</a>
      </p>

      <h2>Race calendar</h2>
      <div class="race-pair">
        <div class="race-card race-card-past">
          <div class="race-card-label">Last Race</div>
          {lastRace ? (
            <>
              <a class="race-card-name" href={`/races/${lastRace.year}/${lastRace.round}`}>{lastRace.name}</a>
              <div class="race-card-date">Round {lastRace.round} · {lastRace.date}</div>
            </>
          ) : (
            <div class="race-card-name">Season hasn't started yet</div>
          )}
        </div>
        <div class="race-card race-card-next">
          <div class="race-card-label">Next Race</div>
          {nextRace ? (
            <>
              <a class="race-card-name" href={`/races/${nextRace.year}/${nextRace.round}`}>{nextRace.name}</a>
              <div class="race-card-date">Round {nextRace.round} · {nextRace.date}</div>
            </>
          ) : (
            <div class="race-card-name">Season finished</div>
          )}
        </div>
      </div>
    </div>
  )
}
