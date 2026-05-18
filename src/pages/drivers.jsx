import { loadJson } from '../lib/load'

export async function loader() {
  const drivers = await loadJson('data/drivers.json')
  drivers.sort((a, b) => {
    const lf = a.familyName.localeCompare(b.familyName)
    return lf !== 0 ? lf : a.givenName.localeCompare(b.givenName)
  })
  return { drivers }
}

export default function DriversIndex({ data }) {
  const { drivers } = data
  return (
    <div>
      <h1>Drivers</h1>
      <p class="lead">
        Every Driver to have started a Race in the World Championship since
        1950 — {drivers.length} in total. Listed alphabetically by family name.
      </p>
      <table class="list-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Code</th>
            <th>Name</th>
            <th>Nationality</th>
            <th>Born</th>
          </tr>
        </thead>
        <tbody>
          {drivers.map((d) => (
            <tr>
              <td class="num">{d.number ?? ''}</td>
              <td class="code">{d.code ?? ''}</td>
              <td>
                <a href={`/drivers/${d.id}`}>{d.givenName} {d.familyName}</a>
              </td>
              <td class="meta">{d.nationality}</td>
              <td class="meta">{d.dateOfBirth}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
