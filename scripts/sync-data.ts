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
// Stubs for the heavier per-race fetches. Wired up in later phases —
// each one is bounded by the Race set already in data/races/, so they
// can be added incrementally without re-running the top-level walk.
// ============================================================

// async function syncResultsForRace(year: number, round: number): Promise<boolean> {
//   // GET {year}/{round}/results.json → MRData.RaceTable.Races[0].Results
//   // Normalize to: { position, driverId, constructorId, grid, status,
//   // laps, points, time?, fastestLap? }
//   // Write data/results/{year}/{round}.json
//   throw new Error('not yet implemented')
// }

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

async function main() {
  console.log(`Sync from ${API_BASE}`)
  await mkdir(DATA_DIR, { recursive: true })
  const seasons = await syncSeasons()
  await syncDrivers()
  await syncConstructors()
  await syncCircuits()
  await syncAllRaces(seasons)
  console.log('Done.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
