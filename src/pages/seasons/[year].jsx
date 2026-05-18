import { loadJson } from '../../lib/load'

export const staticPaths = async () => {
  const seasons = await loadJson('data/seasons.json')
  return seasons.map((s) => ({ params: { year: String(s.year) } }))
}

export const loader = async ({ params }) => {
  const year = Number(params.year)
  const races = await loadJson(`data/races/${params.year}.json`)
  // Per-round standings may not be synced for older Seasons — fall back
  // to null and the page hides the chart.
  let standings = null
  try {
    standings = await loadJson(`data/standings/${params.year}.json`)
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  return { year, races, standings }
}

export default function Season({ data }) {
  const { year, races, standings } = data
  const vtName = `morph-seasons-${year}`
  return (
    <div>
      <div class="detail-hero" style={`view-transition-name: ${vtName}`}>
        <div class="detail-hero-tag-small">Season</div>
        <h1>{year} Formula One</h1>
        <div class="detail-hero-meta">
          {races.length} {races.length === 1 ? 'Race' : 'Races'} · <a href="/seasons">all Seasons</a>
        </div>
        <div class="detail-hero-tag">{year}</div>
      </div>

      {standings && standings.rounds.length > 0 && (
        <>
          <h2>Championship arc</h2>
          <championship-arc data={JSON.stringify(standings)}></championship-arc>
        </>
      )}

      <h2>Race calendar</h2>
      <table class="list-table">
        <thead>
          <tr>
            <th>Round</th>
            <th>Race</th>
            <th>Circuit</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {races.map((r) => (
            <tr>
              <td class="num">{r.round}</td>
              <td>
                <a href={`/races/${r.year}/${r.round}`}>{r.name}</a>
              </td>
              <td class="meta">{r.circuitId}</td>
              <td class="meta">{r.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
