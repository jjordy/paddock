import { loadJson } from '../../lib/load'

export const staticPaths = async () => {
  const drivers = await loadJson('data/drivers.json')
  return drivers.map((d) => ({ params: { driverId: d.id } }))
}

export const loader = async ({ params }) => {
  const drivers = await loadJson('data/drivers.json')
  const driver = drivers.find((d) => d.id === params.driverId)
  if (!driver) return null
  return { driver }
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
  const { driver } = data
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

      <h2>More</h2>
      <p>
        <a href={driver.url} target="_blank" rel="noopener">
          Wikipedia: {driver.givenName} {driver.familyName}
        </a>
      </p>
      <p class="meta">
        Career stats and per-season evolution chart land in a follow-up slice.
      </p>
    </div>
  )
}
