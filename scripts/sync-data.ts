#!/usr/bin/env tsx
//
// scripts/sync-data.ts
//
// Pulls F1 data from the Jolpica-F1 API (https://api.jolpi.ca/ergast/f1)
// and writes JSON files under data/. Idempotent — files are only written
// when their normalized contents change, so re-running over already-fresh
// data is a near-no-op and the auto-PR workflow stays quiet.
//
// Coverage today (Phase 4 skeleton):
//   data/seasons.json                   every World Championship season
//   data/drivers.json                   every driver in the archive
//   data/constructors.json              every constructor
//   data/circuits.json                  every circuit
//   data/races/<year>.json              the race calendar for one season
//
// Coverage deferred to later phases (functions are stubbed below):
//   data/results/<year>/<round>.json    per-race results
//   data/qualifying/<year>/<round>.json qualifying classification
//   data/laps/<year>/<round>.json       lap-by-lap times (heavy)
//   data/pitstops/<year>/<round>.json   pit stops
//
// Run with: pnpm run sync-data

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const API_BASE = 'https://api.jolpi.ca/ergast/f1'
const DATA_DIR = 'data'

// Jolpica's published 4 req/sec ceiling is much stricter in practice —
// even 2 req/sec trips a 429 on most requests once the sliding window
// fills. 1500 ms (0.67 req/sec) keeps the walk quiet without a backoff
// cascade. The full archive walk lands in ~2 min at this pace; the
// Retry-After-aware backoff below picks up any residual 429s.
const REQUEST_DELAY_MS = 1500

// How many times to retry after a 429 before giving up.
const MAX_RETRIES = 4

// Max page size Ergast/Jolpica allow. Higher = fewer round trips.
const PAGE_LIMIT = 100

// ============================================================
// Output schema — what rogue loaders consume from data/
// ============================================================

interface Season {
  year: number
  url: string
}

interface Driver {
  id: string         // Jolpica `driverId`: "verstappen", "hamilton"
  code: string | null // 3-letter abbreviation (modern era only)
  number: number | null // permanent number (modern era only)
  givenName: string
  familyName: string
  dateOfBirth: string
  nationality: string
  url: string
}

interface Constructor {
  id: string         // Jolpica `constructorId`: "ferrari", "mercedes"
  name: string
  nationality: string
  url: string
}

interface Circuit {
  id: string         // Jolpica `circuitId`: "monza", "monaco"
  name: string
  locality: string
  country: string
  lat: number
  lng: number
  url: string
}

interface Race {
  year: number
  round: number     // 1-based Round within the Season — see CONTEXT.md
  name: string      // "Monaco Grand Prix"
  date: string      // ISO date
  time: string | null // ISO time-of-day, often null for pre-2000 races
  circuitId: string // FK → Circuit.id
  url: string
}

interface DriverStanding {
  position: number
  points: number
  wins: number
  driverId: string          // FK → Driver.id
  constructorId: string | null // Current Constructor — last in Ergast's array
}

interface ConstructorStanding {
  position: number
  points: number
  wins: number
  constructorId: string     // FK → Constructor.id
}

interface CurrentStandings {
  year: number             // Season the standings are after
  round: number            // Most recently completed Round
  drivers: DriverStanding[]
  constructors: ConstructorStanding[]
}

interface RaceResult {
  position: number | null  // null for DNF/DNS/DSQ — see positionText
  positionText: string     // "1", "R" (retired), "D" (DSQ), "W" (withdrawn), "N" (not classified)
  points: number
  driverId: string         // FK → Driver.id
  constructorId: string    // FK → Constructor.id
  grid: number             // Starting Grid position; 0 = pit lane start
  laps: number             // Laps completed
  status: string           // "Finished" | "+1 Lap" | "Engine" | "Accident" | ...
  time: string | null      // Winner: "1:30:21.123". Others: "+5.123" gap. DNF: null.
  fastestLapRank: number | null    // 1 = fastest lap of the Race
  fastestLapNumber: number | null  // which Lap was fastest
  fastestLapTime: string | null    // "1:21.345"
}

// ============================================================
// Network + I/O primitives
// ============================================================

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

/**
 * Fetch one Ergast page. The Jolpica responses are JSON, paginated via
 * `?limit=&offset=`, with the total available count in `MRData.total`.
 *
 * On 429 (rate-limited) we honor the Retry-After header if present,
 * otherwise back off exponentially (2s, 4s, 8s, ...). Other non-2xx
 * statuses fail fast — they almost always indicate a programming
 * mistake (bad path, bad query) that retries won't fix.
 */
async function fetchPage(path: string, offset: number): Promise<any> {
  const url = `${API_BASE}/${path}?limit=${PAGE_LIMIT}&offset=${offset}`
  for (let attempt = 0; ; attempt++) {
    await sleep(REQUEST_DELAY_MS)
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (res.ok) return res.json()
    if (res.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = Number(res.headers.get('retry-after'))
      const backoff = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 2000 * Math.pow(2, attempt)
      process.stdout.write(`[429, sleeping ${backoff} ms] `)
      await sleep(backoff)
      continue
    }
    throw new Error(`HTTP ${res.status} for ${url}`)
  }
}

/**
 * Walk every page of an Ergast collection endpoint, concatenating the
 * extracted items. `extract` plucks the relevant list off `MRData`.
 */
async function fetchAll<T>(
  path: string,
  extract: (page: any) => T[],
): Promise<T[]> {
  const out: T[] = []
  let offset = 0
  while (true) {
    const page = await fetchPage(path, offset)
    const items = extract(page)
    if (items.length === 0) break
    out.push(...items)
    const total = Number(page.MRData.total)
    offset += items.length
    if (offset >= total) break
  }
  return out
}

/**
 * Write `data` as pretty-printed JSON to `path` only if the serialized
 * contents differ from what's already on disk. Returns whether the file
 * was actually touched — the caller logs the count.
 */
async function writeIfChanged(path: string, data: unknown): Promise<boolean> {
  const json = JSON.stringify(data, null, 2) + '\n'
  try {
    const existing = await readFile(path, 'utf8')
    if (existing === json) return false
  } catch (err: any) {
    if (err.code !== 'ENOENT') throw err
  }
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, json, 'utf8')
  return true
}

// ============================================================
// Per-entity sync functions — each owns its endpoint, normalizer,
// and output file. Top-level entities live at data/<name>.json;
// per-season entities live at data/<name>/<year>.json.
// ============================================================

async function syncSeasons(): Promise<Season[]> {
  process.stdout.write('  seasons       ... ')
  const raw = await fetchAll<any>('seasons', p => p.MRData.SeasonTable.Seasons)
  const seasons: Season[] = raw.map(s => ({
    year: Number(s.season),
    url: s.url,
  }))
  const changed = await writeIfChanged(join(DATA_DIR, 'seasons.json'), seasons)
  console.log(`${seasons.length} (${changed ? 'updated' : 'unchanged'})`)
  return seasons
}

async function syncDrivers(): Promise<void> {
  process.stdout.write('  drivers       ... ')
  const raw = await fetchAll<any>('drivers', p => p.MRData.DriverTable.Drivers)
  const drivers: Driver[] = raw.map(d => ({
    id: d.driverId,
    code: d.code ?? null,
    number: d.permanentNumber ? Number(d.permanentNumber) : null,
    givenName: d.givenName,
    familyName: d.familyName,
    dateOfBirth: d.dateOfBirth,
    nationality: d.nationality,
    url: d.url,
  }))
  const changed = await writeIfChanged(join(DATA_DIR, 'drivers.json'), drivers)
  console.log(`${drivers.length} (${changed ? 'updated' : 'unchanged'})`)
}

async function syncConstructors(): Promise<void> {
  process.stdout.write('  constructors  ... ')
  const raw = await fetchAll<any>(
    'constructors',
    p => p.MRData.ConstructorTable.Constructors,
  )
  const constructors: Constructor[] = raw.map(c => ({
    id: c.constructorId,
    name: c.name,
    nationality: c.nationality,
    url: c.url,
  }))
  const changed = await writeIfChanged(
    join(DATA_DIR, 'constructors.json'),
    constructors,
  )
  console.log(`${constructors.length} (${changed ? 'updated' : 'unchanged'})`)
}

async function syncCircuits(): Promise<void> {
  process.stdout.write('  circuits      ... ')
  const raw = await fetchAll<any>('circuits', p => p.MRData.CircuitTable.Circuits)
  const circuits: Circuit[] = raw.map(c => ({
    id: c.circuitId,
    name: c.circuitName,
    locality: c.Location.locality,
    country: c.Location.country,
    lat: Number(c.Location.lat),
    lng: Number(c.Location.long),
    url: c.url,
  }))
  const changed = await writeIfChanged(join(DATA_DIR, 'circuits.json'), circuits)
  console.log(`${circuits.length} (${changed ? 'updated' : 'unchanged'})`)
}

async function syncRacesForSeason(year: number): Promise<boolean> {
  const raw = await fetchAll<any>(
    `${year}/races`,
    p => p.MRData.RaceTable.Races,
  )
  const races: Race[] = raw.map(r => ({
    year: Number(r.season),
    round: Number(r.round),
    name: r.raceName,
    date: r.date,
    time: r.time ?? null,
    circuitId: r.Circuit.circuitId,
    url: r.url,
  }))
  return writeIfChanged(join(DATA_DIR, 'races', `${year}.json`), races)
}

async function syncAllRaces(seasons: Season[]): Promise<void> {
  process.stdout.write(`  races         ... `)
  let changed = 0
  for (const s of seasons) {
    if (await syncRacesForSeason(s.year)) changed++
  }
  console.log(`${seasons.length} seasons (${changed} updated)`)
}

// ============================================================
// Per-race results
//
// Bounded by the Race set already in data/races/, so a per-Round walk
// can be added incrementally without touching the top-level entities.
// One file per Race: data/results/<year>/<round>.json, containing the
// per-Driver classified result rows.
//
// RESULTS_SYNC_YEARS controls which Seasons get a results pass on every
// run. Older Seasons can be backfilled by widening this list — once a
// (year, round).json is written, idempotent writes mean later syncs
// will only touch it again if the API actually returns different data.
// ============================================================

const RESULTS_SYNC_YEARS: number[] = [2024, 2025, 2026]

// Years for which we sync per-round Driver standings — the data the
// championship-arc chart on /seasons/[year] consumes. Heavier than the
// final-only standings (one request per Round), so it's gated separately.
const ROUND_STANDINGS_SYNC_YEARS: number[] = [2024, 2025, 2026]

// Years for which we sync per-Lap timing — the data the lap-time-chart
// and position-chart components on /races/[year]/[round] consume. The
// heaviest endpoint (one Race × ~60 Laps × ~20 Drivers = ~1200 rows,
// often paginated) so gated separately and intentionally narrow.
const LAPS_SYNC_YEARS: number[] = [2025, 2026]

async function syncResultsForRace(year: number, round: number): Promise<boolean> {
  const raw = await fetchAll<any>(
    `${year}/${round}/results`,
    p => p.MRData.RaceTable.Races[0]?.Results ?? [],
  )
  const results: RaceResult[] = raw.map(r => ({
    position: ['R', 'D', 'W', 'N', 'E'].includes(r.positionText)
      ? null
      : Number(r.position),
    positionText: r.positionText,
    points: Number(r.points),
    driverId: r.Driver.driverId,
    constructorId: r.Constructor.constructorId,
    grid: Number(r.grid),
    laps: Number(r.laps),
    status: r.status,
    time: r.Time?.time ?? null,
    fastestLapRank: r.FastestLap?.rank ? Number(r.FastestLap.rank) : null,
    fastestLapNumber: r.FastestLap?.lap ? Number(r.FastestLap.lap) : null,
    fastestLapTime: r.FastestLap?.Time?.time ?? null,
  }))
  return writeIfChanged(
    join(DATA_DIR, 'results', String(year), `${round}.json`),
    results,
  )
}

async function syncAllResults(): Promise<void> {
  for (const year of RESULTS_SYNC_YEARS) {
    process.stdout.write(`  results ${year}  ... `)
    const races = await loadRacesForSeason(year)
    if (races.length === 0) {
      console.log('no races — skipping')
      continue
    }
    let changed = 0
    for (const r of races) {
      if (await syncResultsForRace(r.year, r.round)) changed++
    }
    console.log(`${races.length} races (${changed} updated)`)
  }
}

async function loadRacesForSeason(year: number): Promise<Race[]> {
  const { readFile } = await import('node:fs/promises')
  try {
    const text = await readFile(join(DATA_DIR, 'races', `${year}.json`), 'utf8')
    return JSON.parse(text)
  } catch (err: any) {
    if (err.code === 'ENOENT') return []
    throw err
  }
}

// ============================================================
// Per-Race Lap timings — every Lap of every Driver in a Race. Powers
// the lap-time scatter and the iconic position-evolution chart on
// /races/[year]/[round]. Ergast returns this as one entry per Lap with
// embedded Timings per Driver; we transpose into per-Driver series so
// each chart can pull one Driver's curve in a single iteration.
// ============================================================

function parseTimeMs(s: string): number {
  // "1:23.456" → 83456 ms. "23.456" → 23456 ms.
  const parts = s.split(':')
  if (parts.length === 2) {
    return Math.round(Number(parts[0]) * 60000 + Number(parts[1]) * 1000)
  }
  return Math.round(Number(parts[0]) * 1000)
}

async function syncLapsForRace(year: number, round: number): Promise<boolean> {
  const raw = await fetchAll<any>(
    `${year}/${round}/laps`,
    p => p.MRData.RaceTable.Races[0]?.Laps ?? [],
  )

  // Transpose Ergast's per-Lap-with-embedded-Timings shape into one
  // series per Driver. Drivers who retire mid-race get a shorter series.
  const byDriver = new Map<string, Array<{ lap: number; time: string; position: number; ms: number }>>()
  for (const lap of raw) {
    const lapNum = Number(lap.number)
    for (const t of lap.Timings ?? []) {
      let s = byDriver.get(t.driverId)
      if (!s) { s = []; byDriver.set(t.driverId, s) }
      s.push({
        lap: lapNum,
        time: t.time,
        position: Number(t.position),
        ms: parseTimeMs(t.time),
      })
    }
  }
  const drivers = [...byDriver.entries()].map(([driverId, series]) => ({
    driverId,
    series,
  }))
  return writeIfChanged(
    join(DATA_DIR, 'laps', String(year), `${round}.json`),
    { drivers },
  )
}

async function syncAllLaps(): Promise<void> {
  for (const year of LAPS_SYNC_YEARS) {
    process.stdout.write(`  laps ${year}     ... `)
    const races = await loadRacesForSeason(year)
    if (races.length === 0) {
      console.log('no races — skipping')
      continue
    }
    let changed = 0
    for (const r of races) {
      if (await syncLapsForRace(r.year, r.round)) changed++
    }
    console.log(`${races.length} races (${changed} updated)`)
  }
}

// ============================================================
// Per-Round Driver Standings — one snapshot per (year, round) of the
// Driver standings AFTER that Round. The championship-arc chart on
// /seasons/[year] joins these into a cumulative-points curve.
//
// One file per Season: data/standings/<year>.json — `rounds[i]` is the
// table after Round (i+1).
// ============================================================

async function syncRoundStandingsForYear(year: number): Promise<boolean> {
  const races = await loadRacesForSeason(year)
  if (races.length === 0) return false
  const rounds: { round: number; drivers: any[] }[] = []
  for (const race of races) {
    // Skip future rounds — they have no standings yet, and the endpoint
    // returns the most recent prior standings, which would duplicate.
    const raw = await fetchPage(
      `${year}/${race.round}/driverStandings`,
      0,
    )
    const list = raw.MRData.StandingsTable.StandingsLists[0]
    if (!list || Number(list.round) !== race.round) continue
    rounds.push({
      round: race.round,
      drivers: list.DriverStandings.map((s: any) => ({
        position: Number(s.position),
        points: Number(s.points),
        wins: Number(s.wins),
        driverId: s.Driver.driverId,
        constructorId:
          s.Constructors?.[s.Constructors.length - 1]?.constructorId ?? null,
      })),
    })
  }
  return writeIfChanged(join(DATA_DIR, 'standings', `${year}.json`), { year, rounds })
}

async function syncAllRoundStandings(): Promise<void> {
  for (const year of ROUND_STANDINGS_SYNC_YEARS) {
    process.stdout.write(`  round-stand ${year} ... `)
    const changed = await syncRoundStandingsForYear(year)
    console.log(changed ? 'updated' : 'unchanged')
  }
}

// ============================================================
// Current Standings — Driver + Constructor leaderboards for the
// most-recently-completed Round of the current Season. The home page
// surfaces the top of both tables; later phases will fan out to per-
// season standings for the championship-arc chart.
// ============================================================

async function syncCurrentStandings(): Promise<void> {
  process.stdout.write(`  standings     ... `)
  // The /current/* endpoints always resolve to the active Season; using a
  // hard-coded year would risk going stale on January 1.
  const driverRaw = await fetchAll<any>(
    'current/driverStandings',
    p => p.MRData.StandingsTable.StandingsLists[0]?.DriverStandings ?? [],
  )
  const constructorRaw = await fetchAll<any>(
    'current/constructorStandings',
    p => p.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings ?? [],
  )

  // The drivers and constructors lists for the same Season share the
  // outer StandingsList — read year/round from a fresh request rather
  // than holding the page in memory.
  const meta = await fetchPage('current/driverStandings', 0)
  const list = meta.MRData.StandingsTable.StandingsLists[0]
  const year = list ? Number(list.season) : new Date().getFullYear()
  const round = list ? Number(list.round) : 0

  const standings: CurrentStandings = {
    year,
    round,
    drivers: driverRaw.map((s: any) => ({
      position: Number(s.position),
      points: Number(s.points),
      wins: Number(s.wins),
      driverId: s.Driver.driverId,
      constructorId:
        s.Constructors?.[s.Constructors.length - 1]?.constructorId ?? null,
    })),
    constructors: constructorRaw.map((s: any) => ({
      position: Number(s.position),
      points: Number(s.points),
      wins: Number(s.wins),
      constructorId: s.Constructor.constructorId,
    })),
  }
  const changed = await writeIfChanged(
    join(DATA_DIR, 'standings', 'current.json'),
    standings,
  )
  console.log(
    `${year} after R${round} (${standings.drivers.length} drivers / ${standings.constructors.length} constructors, ${changed ? 'updated' : 'unchanged'})`,
  )
}

// ============================================================
// Stubs for additional per-race fetches. Each is bounded by the Race
// set in data/races/, so they can be added without touching the
// top-level walk.
// ============================================================

// async function syncQualifyingForRace(year: number, round: number): Promise<boolean> {
//   // GET {year}/{round}/qualifying.json
//   // Normalize per-driver: { position, driverId, constructorId, q1?, q2?, q3? }
//   throw new Error('not yet implemented')
// }

// async function syncPitStopsForRace(year: number, round: number): Promise<boolean> {
//   // GET {year}/{round}/pitstops.json — only available 2011+
//   throw new Error('not yet implemented')
// }

// async function syncLapsForRace(year: number, round: number): Promise<boolean> {
//   // GET {year}/{round}/laps.json — heavy, only available 1996+, paginate
//   // hard (one race can be 1500+ rows). Consider a separate workflow that
//   // runs less often than the main sync.
//   throw new Error('not yet implemented')
// }

// ============================================================
// Main orchestrator
// ============================================================

// `--only=standings` skips the full-archive walk and only refreshes the
// current standings — used for fast iteration when extending the home
// page or championship-arc chart. The cron passes no args, so the
// weekly run still covers everything.
const ONLY = process.argv.find(a => a.startsWith('--only='))?.slice('--only='.length)

async function main() {
  console.log(`Sync from ${API_BASE}` + (ONLY ? ` [only=${ONLY}]` : ''))
  await mkdir(DATA_DIR, { recursive: true })
  if (ONLY == null) {
    const seasons = await syncSeasons()
    await syncDrivers()
    await syncConstructors()
    await syncCircuits()
    await syncAllRaces(seasons)
    await syncAllResults()
  }
  if (ONLY == null || ONLY === 'standings') {
    await syncCurrentStandings()
  }
  if (ONLY == null || ONLY === 'round-standings') {
    await syncAllRoundStandings()
  }
  if (ONLY == null || ONLY === 'laps') {
    await syncAllLaps()
  }
  console.log('Done.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
