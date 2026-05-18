import { loadJson } from '../../lib/load'

export const staticPaths = async () => {
  const constructors = await loadJson('data/constructors.json')
  return constructors.map((c) => ({ params: { constructorId: c.id } }))
}

export const loader = async ({ params }) => {
  const constructors = await loadJson('data/constructors.json')
  const constructor = constructors.find((c) => c.id === params.constructorId)
  if (!constructor) return null
  return { constructor }
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
  const { constructor } = data
  return (
    <div>
      <h1>{constructor.name}</h1>
      <p class="lead">
        <a href="/teams">↩ all Constructors</a>
      </p>

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

      <h2>More</h2>
      <p>
        <a href={constructor.url} target="_blank" rel="noopener">
          Wikipedia: {constructor.name}
        </a>
      </p>
      <p class="meta">
        Race-by-race history, championships, and titles chart land in a
        follow-up slice once per-race results are synced.
      </p>
    </div>
  )
}
