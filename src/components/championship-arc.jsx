// <championship-arc> — Cumulative-points curve for one Season.
//
// Data is passed as a JSON-stringified attribute so the host page can
// serialize it once and the custom element parses on instantiation.
// The element observes `data` so future round-by-round updates would
// trigger a re-render — relevant if/when in-season standings stream
// in instead of being baked at SSG time.
//
// Vocabulary follows CONTEXT.md: Round (x-axis), cumulative points
// (y-axis), one curve per Driver.

import { defineComponent } from '@jjordy/rogue'

defineComponent(({ data = '{}' }) => {
  // Props are signal getters in rogue — call data() to read the current
  // string value. The destructure default '{}' is picked up by the
  // compiler and injected as the spec default, so the value is always
  // defined and we can JSON.parse safely.
  const raw = data()
  const parsed = raw ? JSON.parse(raw) : {}
  const rounds = parsed.rounds ?? []
  if (rounds.length === 0) {
    return (
      <p class="empty">
        No per-Round standings synced for this Season yet.
        <style>{`
          .empty { color: #5a5a5a; font: 14px/1.5 ui-sans-serif, system-ui; margin: 1rem 0; }
        `}</style>
      </p>
    )
  }

  // Build per-Driver { round, points } series across rounds.
  const series = {}
  for (const r of rounds) {
    for (const s of r.drivers) {
      let arr = series[s.driverId]
      if (!arr) { arr = []; series[s.driverId] = arr }
      arr.push({ round: r.round, points: s.points })
    }
  }

  // Sort Drivers by their LAST-round position so the title-contending
  // curves end up at the top of the legend.
  const finalRound = rounds[rounds.length - 1]
  const driverIds = finalRound.drivers
    .filter((d) => series[d.driverId])
    .map((d) => d.driverId)

  const topN = 5
  // Classic motorsport palette: leader in Ferrari red, runners-up in
  // descending black-to-grey, everyone else in pale grey.
  const colors = ['#e10600', '#0a0a0a', '#444444', '#777777', '#a0a0a0']

  // Coordinate system. Generous right margin to fit Driver name labels
  // at the end of each top-N curve.
  const W = 1000
  const H = 500
  const ML = 56
  const MR = 160
  const MT = 24
  const MB = 36
  const plotW = W - ML - MR
  const plotH = H - MT - MB

  const maxRound = finalRound.round
  let maxPoints = 0
  for (const id of driverIds) {
    for (const p of series[id]) if (p.points > maxPoints) maxPoints = p.points
  }
  if (maxPoints === 0) maxPoints = 1

  // Round to a nice number for the Y-axis ticks.
  const niceCeil = (n) => {
    const order = Math.pow(10, Math.floor(Math.log10(n)))
    return Math.ceil(n / order) * order
  }
  const yMax = niceCeil(maxPoints)

  const xScale = (round) => ML + (round / maxRound) * plotW
  const yScale = (points) => MT + plotH - (points / yMax) * plotH

  const path = (s) => {
    let d = ''
    for (let i = 0; i < s.length; i++) {
      d += (i === 0 ? 'M' : 'L') + xScale(s[i].round) + ',' + yScale(s[i].points)
    }
    return d
  }

  // Y-axis tick values: 0, ¼, ½, ¾, full.
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax * f))

  return (
    <div class="wrapper">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img">
        {/* Plot area background */}
        <rect x={ML} y={MT} width={plotW} height={plotH} fill="#fafafa" stroke="#1a1a1a" stroke-width="1" />

        {/* Gridlines + Y-axis labels */}
        {yTicks.map((v) => (
          <g>
            <line x1={ML} x2={ML + plotW} y1={yScale(v)} y2={yScale(v)} stroke="#e6e0d4" stroke-width="1" />
            <text x={ML - 8} y={yScale(v) + 4} text-anchor="end" font-family="ui-monospace, monospace" font-size="11" fill="#5a5a5a">{v}</text>
          </g>
        ))}

        {/* X-axis ticks every 2 rounds for readability */}
        {Array.from({ length: maxRound + 1 }, (_, i) => i).filter((r) => r > 0 && r % 2 === 0).map((r) => (
          <g>
            <line x1={xScale(r)} x2={xScale(r)} y1={MT + plotH} y2={MT + plotH + 4} stroke="#5a5a5a" stroke-width="1" />
            <text x={xScale(r)} y={MT + plotH + 18} text-anchor="middle" font-family="ui-monospace, monospace" font-size="11" fill="#5a5a5a">{r}</text>
          </g>
        ))}

        {/* Non-top-N driver curves first (so top N draw over them) */}
        {driverIds.slice(topN).map((id) => (
          <path d={path(series[id])} fill="none" stroke="#dcd5c6" stroke-width="1" />
        ))}

        {/* Top-N curves */}
        {driverIds.slice(0, topN).map((id, i) => (
          <path d={path(series[id])} fill="none" stroke={colors[i]} stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
        ))}

        {/* Driver name labels at the right edge of each top-N curve */}
        {driverIds.slice(0, topN).map((id, i) => {
          const last = series[id][series[id].length - 1]
          return (
            <text
              x={xScale(last.round) + 8}
              y={yScale(last.points) + 4}
              font-family="ui-monospace, monospace"
              font-size="12"
              font-weight="700"
              fill={colors[i]}
            >
              {id}
            </text>
          )
        })}

        {/* X-axis label */}
        <text x={ML + plotW / 2} y={H - 6} text-anchor="middle" font-family="ui-monospace, monospace" font-size="11" fill="#5a5a5a">ROUND</text>
        {/* Y-axis label */}
        <text x={12} y={MT + plotH / 2} transform={`rotate(-90 12 ${MT + plotH / 2})`} text-anchor="middle" font-family="ui-monospace, monospace" font-size="11" fill="#5a5a5a">POINTS</text>
      </svg>
      <style>{`
        :host { display: block; }
        .wrapper { width: 100%; margin: 1rem 0 1.5rem; }
        svg { width: 100%; height: auto; }
      `}</style>
    </div>
  )
})
