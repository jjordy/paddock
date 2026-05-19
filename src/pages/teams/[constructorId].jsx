import { loadJson } from '../../lib/load'

// Match the SYNCED_YEARS list on /records and /drivers/[driverId] — these
// are the Seasons we have per-Race results for. Career aggregates only
// reflect this window; the lead-in copy on the page calls that out.
const SYNCED_YEARS = [2024, 2025, 2026]

export const staticPaths = async () => {
  const constructors = await loadJson('data/constructors.json')
  return constructors.map((c) => ({ params: { constructorId: c.id } }))
}

export const loader = async ({ params }) => {
  const constructors = await loadJson('data/constructors.json')
  const constructor = constructors.find((c) => c.id === params.constructorId)
  if (!constructor) return null

  const drivers = await loadJson('data/drivers.json')
  const driversById = new Map(drivers.map((d) => [d.id, d]))

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
    let oneTwos = 0   // both cars in the top two — a Constructor brag
    let points = 0
    let dnfs = 0
    let bestFinish = null
    const driversSeen = new Set()
    for (const r of races) {
      let results
      try {
        results = await loadJson(`data/results/${year}/${r.round}.json`)
      } catch (err) {
        if (err.code === 'ENOENT') continue
        throw err
      }
      const teamRows = results.filter((x) => x.constructorId === constructor.id)
      if (teamRows.length === 0) continue
      racesEntered++
      for (const row of teamRows) {
        driversSeen.add(row.driverId)
        points += row.points
        if (row.position === 1) wins++
        if (row.position != null && row.position <= 3) podiums++
        if (row.position == null) dnfs++
        if (row.position != null && (bestFinish == null || row.position < bestFinish)) {
          bestFinish = row.position
        }
      }
      // 1-2: both cars finished in the top two.
      const tops = teamRows
        .map((x) => x.position)
        .filter((p) => p != null && p <= 2)
      if (tops.length >= 2) oneTwos++
    }
    if (racesEntered > 0) {
      careerSeasons.push({
        year,
        races: racesEntered,
        wins,
        podiums,
        oneTwos,
        points,
        dnfs,
        bestFinish,
        drivers: [...driversSeen].map((id) => {
          const d = driversById.get(id)
          return { id, name: d ? `${d.givenName} ${d.familyName}` : id }
        }),
      })
    }
  }

  const totals = careerSeasons.reduce(
    (a, s) => ({
      races: a.races + s.races,
      wins: a.wins + s.wins,
      podiums: a.podiums + s.podiums,
      oneTwos: a.oneTwos + s.oneTwos,
      points: a.points + s.points,
      dnfs: a.dnfs + s.dnfs,
    }),
    { races: 0, wins: 0, podiums: 0, oneTwos: 0, points: 0, dnfs: 0 },
  )

  // For the championship-arc chart: pick the most recent Season the
  // Constructor scored in, then load that Season's per-Round standings.
  // (The arc shows the whole field, so even a mid-pack Constructor gets
  // useful context for how the title fight played out around them.)
  let arcStandings = null
  let arcYear = null
  for (let i = careerSeasons.length - 1; i >= 0; i--) {
    const y = careerSeasons[i].year
    try {
      const s = await loadJson(`data/standings/${y}.json`)
      if (s.rounds && s.rounds.length > 0) {
        arcStandings = s
        arcYear = y
        break
      }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
  }

  return {
    constructor,
    careerSeasons,
    totals,
    syncedYears: SYNCED_YEARS,
    arcStandings,
    arcYear,
  }
}

export default function ConstructorDetail({ data }) {
  if (!data) {
    return (
      <div>
        <h1>Unknown constructor</h1>
        <p><a href="/teams">↩ all Constructors</a></p>
      </div>
    )
  }
  const { constructor, careerSeasons, totals, syncedYears, arcStandings, arcYear } = data
  const hasCareer = careerSeasons.length > 0
  const pointsSeries = careerSeasons.map((s) => s.points)
  const winsSeries = careerSeasons.map((s) => s.wins)
  const podiumsSeries = careerSeasons.map((s) => s.podiums)
  const vtName = `morph-teams-${constructor.id}`
  return (
    <div>
      <div class="detail-hero" style={`view-transition-name: ${vtName}`}>
        <div class="detail-hero-tag-small">Constructor</div>
        <h1>{constructor.name}</h1>
        <div class="detail-hero-meta">
          {constructor.nationality} · <a href="/teams">all Constructors</a>
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat">
          <div class="stat-label">Nationality</div>
          <div class="stat-value">{constructor.nationality}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Constructor ID</div>
          <div class="stat-value">{constructor.id}</div>
        </div>
      </div>

      {hasCareer && (
        <>
          <h2>Recent form ({syncedYears[0]}–{syncedYears[syncedYears.length - 1]})</h2>
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
              <div class="stat-label">1-2s</div>
              <div class="stat-value">{totals.oneTwos}</div>
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
                <th>1-2s</th>
                <th>Best</th>
                <th>DNFs</th>
                <th>Drivers</th>
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
                  <td class="meta">{s.oneTwos}</td>
                  <td class="meta">{s.bestFinish != null ? `P${s.bestFinish}` : '—'}</td>
                  <td class="meta">{s.dnfs}</td>
                  <td class="meta">
                    {s.drivers.map((d, i) => (
                      <>
                        {i > 0 ? ', ' : ''}
                        <a href={`/drivers/${d.id}`}>{d.name}</a>
                      </>
                    ))}
                  </td>
                  <td class="num">{s.points}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3>Evolution</h3>
          <div class="evolution-grid">
            <div class="evolution-cell">
              <div class="evolution-label">Points / Season</div>
              <paddock-spark values={JSON.stringify(pointsSeries)} color="#e10600"></paddock-spark>
            </div>
            <div class="evolution-cell">
              <div class="evolution-label">Wins / Season</div>
              <paddock-spark values={JSON.stringify(winsSeries)} color="#0a0a0a"></paddock-spark>
            </div>
            <div class="evolution-cell">
              <div class="evolution-label">Podiums / Season</div>
              <paddock-spark values={JSON.stringify(podiumsSeries)} color="#5a5a5a"></paddock-spark>
            </div>
          </div>
        </>
      )}

      {!hasCareer && (
        <p class="meta">
          Race-by-race history starts at {syncedYears[0]}. {constructor.name} hasn't
          entered a Grand Prix in the {syncedYears[0]}–{syncedYears[syncedYears.length - 1]}
          window — they'll surface here as scripts/sync-data.ts extends backwards.
        </p>
      )}

      {arcStandings && (
        <>
          <h2>{arcYear} title fight</h2>
          <p class="meta">
            All Constructors' cumulative points across {arcYear} — see how the
            year unfolded around {constructor.name}.
          </p>
          <constructor-championship-arc data={JSON.stringify(arcStandings)}></constructor-championship-arc>
        </>
      )}

      <h2>More</h2>
      <p>
        <a href={constructor.url} target="_blank" rel="noopener">
          Wikipedia: {constructor.name}
        </a>
      </p>
    </div>
  )
}
