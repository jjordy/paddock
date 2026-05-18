import { loadJson } from '../lib/load'

export async function loader() {
  const seasons = await loadJson('data/seasons.json')
  // Newest first — the most-likely-of-interest year sits at the top.
  seasons.sort((a, b) => b.year - a.year)
  return { seasons }
}

export default function SeasonsIndex({ data }) {
  const { seasons } = data
  const newest = seasons[0]?.year
  const oldest = seasons[seasons.length - 1]?.year
  return (
    <div>
      <h1>Seasons</h1>
      <p class="lead">
        Every World Championship Season from {oldest} to {newest} — {seasons.length}
        in total. Click any year for that Season's Race calendar.
      </p>
      <table class="list-table">
        <thead>
          <tr>
            <th>Season</th>
            <th>Wikipedia</th>
          </tr>
        </thead>
        <tbody>
          {seasons.map((s) => (
            <tr>
              <td><a href={`/seasons/${s.year}`}>{s.year}</a></td>
              <td class="meta">
                <a href={s.url} target="_blank" rel="noopener">{s.year} Formula One season</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
