export default function Home() {
  return (
    <div>
      <h1>paddock</h1>
      <p class="lead">
        An F1 stats dashboard built with <code>@jjordy/rogue</code> — every
        season, every race, every driver, every constructor from 1950 to today.
      </p>
      <p>
        This is a scaffold placeholder. The real home page will surface the
        current championship standings, the most recent race, and the next
        race on the calendar.
      </p>
      <h2>What's coming</h2>
      <ul>
        <li><a href="/seasons">Seasons</a> — championship arcs across every year</li>
        <li><a href="/drivers">Drivers</a> — career stats and evolution charts</li>
        <li><a href="/teams">Constructors</a> — team history and titles</li>
        <li><a href="/records">Records</a> — the all-time record book</li>
        <li><a href="/compare">Compare</a> — head-to-head driver comparisons</li>
      </ul>
      <p>
        Data comes from the <a href="https://github.com/jolpica/jolpica-f1">Jolpica-F1 API</a>,
        a continuation of the Ergast historical dataset.
      </p>
    </div>
  )
}
