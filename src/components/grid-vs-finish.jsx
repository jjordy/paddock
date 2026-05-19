// <grid-vs-finish> — Slope chart of starting-grid → finishing-position
// for one Race. Two vertical position columns (Grid on the left, Finish
// on the right), one connecting line per Driver.
//
// Color rules — keeps the classic-motorsport palette:
//   winner       → Ferrari red, bold (P1 always reads first)
//   gainers      → black, weighted by magnitude
//   no-change    → medium grey
//   losers       → pale grey
//   DNF          → pale grey dashed line ending in the "DNF" row
//
// Data prop is a JSON string of:
//   [{ driverId, driverName, grid, position }]
// where `position` is the final classification (1-based) or null for a
// non-finisher. `grid` of 0 in the source means a pit-lane start; we
// treat it as starting from the back.

import { defineComponent } from '@jjordy/rogue'

defineComponent(({ data = '[]' }) => {
  const rows = JSON.parse(data() || '[]')
  if (rows.length === 0) {
    return (
      <p class="empty">
        No grid / finish data for this Race.
        <style>{`.empty { color: #5a5a5a; font: 14px/1.5 ui-sans-serif, system-ui; margin: 1rem 0; }`}</style>
      </p>
    )
  }

  // Position range. Pit-lane starts (grid === 0) treated as one slot
  // behind the last grid slot so the slope is visible.
  const finishes = rows.map((r) => r.position).filter((p) => p != null)
  const grids = rows.map((r) => (r.grid > 0 ? r.grid : null)).filter((g) => g != null)
  const maxPos = Math.max(finishes.length ? Math.max(...finishes) : 0, grids.length ? Math.max(...grids) : 0)
  if (maxPos < 1) {
    return null
  }
  const dnfRow = maxPos + 2 // gap then a DNF row at the bottom

  const W = 1000
  const H = Math.max(360, dnfRow * 22 + 80)
  const ML = 60
  const MR = 60
  const MT = 28
  const MB = 36
  const plotW = W - ML - MR
  const plotH = H - MT - MB

  const xGrid = ML + 110
  const xFinish = ML + plotW - 110

  const yScale = (pos) => MT + ((pos - 1) / Math.max(dnfRow - 1, 1)) * plotH
  // Pit-lane → render at maxPos + 1 (just above the DNF row)
  const startSlot = (row) => (row.grid > 0 ? row.grid : maxPos + 1)
  const endSlot = (row) => (row.position != null ? row.position : dnfRow)

  const colorFor = (row) => {
    if (row.position === 1) return { stroke: '#e10600', width: 3, weight: 700, opacity: 1 }
    if (row.position == null) return { stroke: '#bdb6a7', width: 1, weight: 400, opacity: 0.9, dash: '4 4' }
    const delta = row.grid > 0 ? row.grid - row.position : (maxPos + 1) - row.position
    if (delta > 0) {
      // Gainer — stronger black for bigger jumps.
      const w = delta >= 8 ? 2.6 : delta >= 4 ? 2.1 : 1.6
      return { stroke: '#0a0a0a', width: w, weight: 700, opacity: 1 }
    }
    if (delta < 0) return { stroke: '#bdb6a7', width: 1.2, weight: 400, opacity: 0.95 }
    return { stroke: '#5a5a5a', width: 1.4, weight: 500, opacity: 1 }
  }

  // Pull a Driver label — 3-letter code if it ends with one in the
  // driverId (we don't have code on this row), else family name from
  // the supplied driverName.
  const labelFor = (row) => {
    if (row.driverCode) return row.driverCode
    if (row.driverName) {
      const last = row.driverName.split(' ').slice(-1)[0]
      return last.slice(0, 3).toUpperCase()
    }
    return row.driverId.slice(0, 3).toUpperCase()
  }

  // Sort so DNFs render first (under the live runners) and the winner last.
  const ordered = [...rows].sort((a, b) => {
    const aDnf = a.position == null ? 0 : 1
    const bDnf = b.position == null ? 0 : 1
    if (aDnf !== bDnf) return aDnf - bDnf
    if (a.position === 1) return 1
    if (b.position === 1) return -1
    return 0
  })

  const posTicks = []
  for (let p = 1; p <= maxPos; p++) {
    if (p === 1 || p === maxPos || p % 5 === 0) posTicks.push(p)
  }

  return (
    <div class="wrapper">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img">
        {/* Column headers */}
        <text x={xGrid} y={MT - 10} text-anchor="middle" font-family="ui-monospace, monospace" font-size="12" font-weight="700" fill="#1a1a1a">GRID</text>
        <text x={xFinish} y={MT - 10} text-anchor="middle" font-family="ui-monospace, monospace" font-size="12" font-weight="700" fill="#1a1a1a">FINISH</text>

        {/* Vertical guide rails for each column */}
        <line x1={xGrid} x2={xGrid} y1={MT} y2={MT + plotH} stroke="#1a1a1a" stroke-width="1" />
        <line x1={xFinish} x2={xFinish} y1={MT} y2={MT + plotH} stroke="#1a1a1a" stroke-width="1" />

        {/* Y-axis position labels (both edges) */}
        {posTicks.map((p) => (
          <g>
            <text x={ML - 8} y={yScale(p) + 4} text-anchor="end" font-family="ui-monospace, monospace" font-size="11" fill="#5a5a5a">P{p}</text>
            <text x={W - MR + 8} y={yScale(p) + 4} text-anchor="start" font-family="ui-monospace, monospace" font-size="11" fill="#5a5a5a">P{p}</text>
          </g>
        ))}
        <text x={ML - 8} y={yScale(dnfRow) + 4} text-anchor="end" font-family="ui-monospace, monospace" font-size="11" fill="#bdb6a7">DNF</text>
        <text x={W - MR + 8} y={yScale(dnfRow) + 4} text-anchor="start" font-family="ui-monospace, monospace" font-size="11" fill="#bdb6a7">DNF</text>

        {/* Connecting slope lines + endpoint dots + driver labels */}
        {ordered.map((row) => {
          const sy = yScale(startSlot(row))
          const ey = yScale(endSlot(row))
          const c = colorFor(row)
          return (
            <g opacity={c.opacity}>
              <line
                x1={xGrid}
                x2={xFinish}
                y1={sy}
                y2={ey}
                stroke={c.stroke}
                stroke-width={c.width}
                stroke-dasharray={c.dash ?? null}
                stroke-linecap="round"
              />
              <circle cx={xGrid} cy={sy} r={row.position === 1 ? 4 : 3} fill={c.stroke} />
              <circle cx={xFinish} cy={ey} r={row.position === 1 ? 4 : 3} fill={c.stroke} />
              <text
                x={xGrid - 10}
                y={sy + 4}
                text-anchor="end"
                font-family="ui-monospace, monospace"
                font-size="11"
                font-weight={c.weight}
                fill={c.stroke}
              >
                {labelFor(row)}
              </text>
              <text
                x={xFinish + 10}
                y={ey + 4}
                text-anchor="start"
                font-family="ui-monospace, monospace"
                font-size="11"
                font-weight={c.weight}
                fill={c.stroke}
              >
                {labelFor(row)}
              </text>
            </g>
          )
        })}
      </svg>
      <style>{`
        :host { display: block; }
        .wrapper { width: 100%; margin: 1rem 0 1.5rem; }
        svg { width: 100%; height: auto; }
      `}</style>
    </div>
  )
})
