import { loadJson } from '../../lib/load'

export const staticPaths = async () => {
  const seasons = await loadJson('data/seasons.json')
  return seasons.map((s) => ({ params: { year: String(s.year) } }))
}

export const loader = async ({ params }) => {
  const races = await loadJson(`data/races/${params.year}.json`)
  return { year: Number(params.year), races }
}

export default function Season({ data }) {
  const { year, races } = data
  return (
    <div>
      <h1>{year} Season</h1>
      <p class="lead">
        {races.length} {races.length === 1 ? 'Race' : 'Races'} this Season.
        Click any Round for the full Race report.{' '}
        <a href="/seasons">↩ all Seasons</a>
      </p>
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
