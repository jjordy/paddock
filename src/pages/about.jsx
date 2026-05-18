export default function About() {
  return (
    <div>
      <h1>About</h1>
      <p class="lead">
        <strong>paddock</strong> is an F1 stats dashboard. The full World
        Championship archive from 1950 to today — every Season, every Race,
        every Driver, every Constructor — in one place.
      </p>

      <h2>Built with rogue</h2>
      <p>
        Every page is rendered by <a href="https://github.com/jjordy/rogue">
        <code>@jjordy/rogue</code></a>, a JSX-to-web-components framework with
        fine-grained signal reactivity, file-system routing, and true SSR
        hydration. There is no virtual DOM, and no diff.
      </p>
      <p>
        The site is pure SSG. Every URL is pre-rendered at build time and
        served as a static file from GitHub Pages — no server, no client API
        calls, no waterfall. The route enumeration is driven by rogue 0.7.0's
        <code>staticPaths</code>: every <code>[year]</code>, <code>[round]</code>,
        <code>[driverId]</code>, and <code>[constructorId]</code> page declares
        the URLs it should be generated for, and the SSG pass runs each loader
        exactly once.
      </p>
      <p>
        Every chart is hand-rolled SVG inside a <code>defineComponent</code>
        web component. No charting library — the point is to demonstrate
        that rogue + SVG + signals is enough.
      </p>

      <h2>Data</h2>
      <p>
        The archive comes from the <a href="https://github.com/jolpica/jolpica-f1">
        Jolpica-F1 API</a>, a free continuation of the Ergast historical
        dataset. A weekly GitHub Action runs a sync script that pulls the
        latest data into JSON files committed to the repo, opens an
        auto-PR if anything changed, and triggers a fresh deploy on merge.
      </p>

      <h2>Source</h2>
      <p>
        Repository: <a href="https://github.com/jjordy/paddock">github.com/jjordy/paddock</a>.
        Issues and contributions welcome.
      </p>
    </div>
  )
}
