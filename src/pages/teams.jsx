import { loadJson } from '../lib/load'

export async function loader() {
  const constructors = await loadJson('data/constructors.json')
  constructors.sort((a, b) => a.name.localeCompare(b.name))
  return { constructors }
}

export default function TeamsIndex({ data }) {
  const { constructors } = data
  return (
    <div>
      <h1>Constructors</h1>
      <p class="lead">
        Every Constructor to have entered the World Championship — {constructors.length}
        in total. Listed alphabetically. The route says "teams" because it's
        the friendlier word; the data, the types, and the variable names use
        "Constructor" (see <a href="https://github.com/jjordy/paddock/blob/main/CONTEXT.md"><code>CONTEXT.md</code></a>).
      </p>
      <table class="list-table">
        <thead>
          <tr>
            <th>Constructor</th>
            <th>Nationality</th>
          </tr>
        </thead>
        <tbody>
          {constructors.map((c) => (
            <tr>
              <td><a href={`/teams/${c.id}`}>{c.name}</a></td>
              <td class="meta">{c.nationality}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
