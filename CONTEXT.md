# paddock

`paddock` is an F1 stats dashboard. It surfaces the full Formula 1 archive — every Season, every Race, every Driver, every Constructor — from 1950 to today. The data comes from [Jolpica-F1](https://github.com/jolpica/jolpica-f1), a continuation of the Ergast historical dataset.

This glossary fixes the vocabulary the codebase, issues, and PRs should use. When in doubt about a term, this file wins. Most terms come straight from Formula 1's own usage — we don't invent jargon here, we just write down which existing term we picked when there were synonyms.

## Language

### Time and structure

**Season**:
A single calendar year of the F1 World Championship — e.g. the 2024 Season. Bounded by the year integer. Has a Driver champion and a Constructor champion.
_Avoid_: Year, championship year (a Season *contains* a championship; it is not synonymous with one).

**Round**:
The 1-based ordinal of a Race within its Season. The 2024 Bahrain Grand Prix is Round 1; Abu Dhabi is the final Round. Used in the route `/races/[year]/[round]`.
_Avoid_: Race number, event number.

**Race**:
A single Grand Prix event — qualifying + race day, at one Circuit, on one weekend. Uniquely identified by `(Season, Round)`. The unit a results table is built around.
_Avoid_: Event, GP, Grand Prix in URLs (we say "race" in the URL slug; "Grand Prix" is reserved for human-readable display names like "Monaco Grand Prix").

**Circuit**:
The physical track the Race is held at. One Circuit can host many Races across many Seasons (Monza, Silverstone). Has a country, locality, and coordinates in the Jolpica payload.
_Avoid_: Track (we use it loosely in prose, but data fields and component names use Circuit).

### People and organizations

**Driver**:
A person who has driven in at least one Race. Identified by `driverId` (Jolpica's slug — `verstappen`, `hamilton`, `senna`). Has a permanent number (modern era), nationality, dates, and a career across one or more Constructors.
_Avoid_: Racer, pilot.

**Constructor**:
The team entity that enters cars in the championship — Ferrari, Mercedes, McLaren. Identified by `constructorId` (Jolpica's slug). Earns Constructor's Championship points separately from its drivers.
_Avoid_: Team (we use "Team" in casual UI copy and the `/teams` route — it's the friendlier word — but the data model, the typescript types, and the variable names are `Constructor` because that's the canonical F1 term and it disambiguates from informal "team" in chat).

**Entry**:
A `(Driver, Constructor, Season)` triple. A Driver can switch Constructors mid-Season, producing multiple Entries for one (Driver, Season) pair. Career stats aggregate over Entries, not over Drivers.
_Avoid_: Stint (overloaded — see below), assignment.

### Race weekend

**Qualifying**:
The pre-race session that determines starting Grid position. Modern format is three knockout rounds (Q1, Q2, Q3). Each Driver's fastest lap counts. Produces a Qualifying result row distinct from the Race result row.
_Avoid_: Quali (informal; we never use it in code or docs).

**Sprint**:
A short race held on Saturday at select rounds (introduced 2021). Has its own grid (set by a separate Sprint Qualifying or by the Friday qualifying, depending on the season's format) and awards reduced points. Distinct from the main Race.
_Avoid_: Sprint race (redundant), short race.

**Grid**:
The starting order of cars on the Race grid. Position 1 is pole. Set by Qualifying, then adjusted by penalties (grid drops). The Grid position for a Driver is a property of their Race entry, not their Qualifying result.
_Avoid_: Starting positions (plural; we say Grid for the whole thing and "grid position" for one slot).

**Lap**:
One traversal of the Circuit during the Race. Numbered 1..N. Each Lap has a per-Driver lap time. The dataset for `<lap-time-chart>` and `<position-chart>` is one row per (Race, Driver, Lap).
_Avoid_: Tour, circuit (the noun is taken).

**Stint**:
A continuous run of Laps on one set of tyres for one Driver in one Race. Bounded by pit stops (or the race start / finish). A typical Race has 2–3 Stints per Driver.
_Avoid_: Run, segment.

**Pit stop**:
A scheduled stop in the pit lane to change tyres (and occasionally to repair damage). Boundary between Stints. Has a lap number and a stationary time.
_Avoid_: Pit (the verb), tyre change.

### Outcomes

**Podium**:
The top three Race finishers — P1, P2, P3 — who stand on the podium after the Race. As a stat, "Podiums" counts the number of races a Driver or Constructor has finished in the top three.
_Avoid_: Top three (we use Podium for the set and "podium finishes" for the count).

**DNF**:
Did Not Finish. A Driver who started the Race but did not see the chequered flag — engine failure, crash, retirement. The Race result row records the status (`+1 Lap`, `Engine`, `Accident`, `Retired`).
_Avoid_: Retirement (the word means something different in driver biography: a Driver's career retirement). Use DNF for the in-race outcome, "retired" only when speaking of a Driver leaving the sport.

**DNS**:
Did Not Start. A Driver who qualified but didn't take the formation lap (mechanical failure on the grid, injury). Distinct from DNF — never started.

**DSQ**:
Disqualified. A finishing position later removed by the stewards (technical infringement, dangerous driving). Stats should treat DSQ as a non-finish.

**Pole**:
The fastest Qualifying time, awarded Grid position 1. "Poles" as a career stat counts Qualifying P1s.
_Avoid_: Pole position (redundant in code; fine in prose).

**Fastest lap**:
The fastest individual Lap of the Race. In some seasons, awards a championship point if the Driver also finishes in the top 10. Stored as a per-Race fact on one Driver.
_Avoid_: FL (in code, write it out), best lap.

### Stats and aggregations

**Standings**:
A point-ordered ranking of Drivers or Constructors. Always relative to a Season (live mid-season, final at year-end). "Driver Standings" and "Constructor Standings" are separate tables — never combined.
_Avoid_: Leaderboard (suggests a real-time scoreboard, not a championship table), ranking.

**Career stats**:
Aggregates across a Driver's full life in F1 — total Races, Wins, Podiums, Poles, fastest laps, championships. Computed at sync time and cached in `data/`, not recomputed in loaders.
_Avoid_: Lifetime stats, all-time stats.

**Championship arc**:
The cumulative points curve for one Driver (or Constructor) across one Season — Round 1 cumulative on the x-axis, points total on the y-axis. The visualisation that makes a title fight legible.
_Avoid_: Points progression, season chart.

**Position evolution**:
The lap-by-lap running order across one Race — lap number on the x-axis, position on the y-axis (inverted: P1 at the top), one line per Driver. The iconic F1 chart.
_Avoid_: Lap chart (ambiguous — also used for lap times), position chart (that's the *component name*; the *concept* is "Position evolution").

## Relationships

- A **Season** contains many **Race**s, each identified by its **Round** within that Season.
- A **Race** has one **Qualifying** session (and at select Rounds, a **Sprint**). Qualifying sets the **Grid**.
- Each **Race** produces a result row per **Driver** that includes their **Grid** position, their finishing position, and their status (finished, **DNF**, **DNS**, **DSQ**).
- Each **Driver** drives for one or more **Constructor**s per **Season** — each (Driver, Constructor, Season) tuple is an **Entry**.
- A Driver's Race performance is sliced into **Stint**s, separated by **Pit stop**s. Each Stint contains many **Lap**s.
- **Standings** are computed by summing Race points (and any **Fastest lap** point) over the **Season**'s **Race**s for each Driver and Constructor.
- **Career stats** aggregate over a Driver's **Entry** history across **Season**s; **Podium**s, **Pole**s, wins, and championships are all career-level counts.

## Example dialogue

> **Dev:** What's the canonical URL for the 2008 Italian race?
> **Domain expert:** `/races/2008/14`. The path uses the **Season** year and the **Round**. The `[round]` segment is the 1-based ordinal of the **Race** within the **Season** — Monza was Round 14 in 2008. Don't put the GP name in the URL; the route is `[year]/[round]`.

> **Dev:** When I say a Driver has "5 podiums in 2023", does that include Sprint podiums?
> **Domain expert:** No. **Podium** by default means a top-three Race finish. **Sprint** results are a separate table and a separate count. If you mean both, the stat is "5 race podiums + 2 sprint podiums" — always disambiguate.

> **Dev:** The chart on `/drivers/[driverId]` showing wins-per-season — what do we call that?
> **Domain expert:** Not a "career chart" — too generic. Not a **Championship arc** either; that's the cumulative-points curve within a single **Season**. This is the **Career stats** time series — wins on the y-axis, **Season** on the x. We don't have a single noun for it yet; flag it for `/grill-with-docs` if we add the page.

## Flagged ambiguities

- **"Team" vs "Constructor"**: User-facing copy and the `/teams` route use **Team** because it's the friendlier English word. The data model, types, file names, and variable names use **Constructor** because that's F1's canonical term and the Jolpica payload key. When writing an issue title or a hypothesis, prefer **Constructor**.
- **"Race" vs "Grand Prix"**: In URLs, route names, file paths: **race**. In human-readable display strings: **Grand Prix** or the event's proper name ("Monaco Grand Prix", "British Grand Prix"). Code never builds a string by concatenating "Grand Prix" — it pulls the `raceName` from the Jolpica payload.
- **"DNF" vs "retired"**: An in-race **DNF** is *not* a Driver "retiring" — that word means leaving the sport (career retirement). A Driver who DNF'd in 8 races is not "retired 8 times". Be precise.
- **"Lap chart"**: Ambiguous and to be avoided. We have a `<lap-time-chart>` (scatter of times) and a `<position-chart>` (lap-by-lap running order, a.k.a. **Position evolution**). Use the component name or the concept name, never "lap chart".
