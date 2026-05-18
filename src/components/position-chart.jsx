// <position-chart> — The iconic F1 position-evolution chart.
//
// X = Lap number, Y = running position. P1 at the top (Y axis inverted).
// One line per Driver. Top-5 finishers (by final position) get distinct
// colors; everyone else is a pale grey wash. Lines that drop off the
// chart (DNF or last lap completed) end where the data ends.
//
// Data prop is a JSON string of:
//   { drivers: [{ driverId, series: [{ lap, position }] }] }
// finalOrder is an array of driverIds in final classification order.

import { defineComponent } from '@jjordy/rogue'

defineComponent(({ data = '{}', finalOrder = '[]' }) => {
  const parsed = JSON.parse(data() || '{}')
  const orderList = JSON.parse(finalOrder() || '[]')
  const drivers = parsed.drivers ?? []
  if (drivers.length === 0) {
    return (
      <p class="empty">
        No per-Lap data synced for this Race yet.
        <style>{`.empty { color: #5a5a5a; font: 14px/1.5 ui-sans-serif, system-ui; margin: 1rem 0; }`}</style>
      </p>
    )
  }

  let maxLap = 0
  let maxPos = 0
  for (const d of drivers) {
    for (const p of d.series) {
      if (p.lap > maxLap) maxLap = p.lap
      if (p.position > maxPos) maxPos = p.position
    }
  }
  if (maxPos < 1) maxPos = 1

  const topN = 5
  const order = orderList.length > 0
    ? orderList
    : [...drivers].sort((a, b) => b.series.length - a.series.length).map((d) => d.driverId)
  const topDriverIds = new Set(order.slice(0, topN))

  const colors = ['#e10600', '#0a0a0a', '#444444', '#777777', '#a0a0a0']
  const colorOf = (driverId) => {
    const i = order.indexOf(driverId)
    return i >= 0 && i < topN ? colors[i] : '#dcd5c6'
  }

  const W = 1000
  const H = 460
  const ML = 56
  const MR = 160
  const MT = 24
  const MB = 36
  const plotW = W - ML - MR
  const plotH = H - MT - MB

  // Y axis inverted — P1 at top, last position at bottom.
  const xScale = (lap) => ML + (lap / maxLap) * plotW
  const yScale = (pos) => MT + ((pos - 1) / Math.max(maxPos - 1, 1)) * plotH

  const path = (s) => {
    let d = ''
    for (let i = 0; i < s.length; i++) {
      d += (i === 0 ? 'M' : 'L') + xScale(s[i].lap) + ',' + yScale(s[i].position)
    }
    return d
  }

  // Y-axis ticks at every 5 positions + P1 + last
  const yTicks = new Set([1, maxPos])
  for (let p = 5; p < maxPos; p += 5) yTicks.add(p)

  return (
    <div class="wrapper">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img">
        <rect x={ML} y={MT} width={plotW} height={plotH} fill="#fafafa" stroke="#1a1a1a" stroke-width="1" />

        {[...yTicks].sort((a, b) => a - b).map((pos) => (
          <g>
            <line x1={ML} x2={ML + plotW} y1={yScale(pos)} y2={yScale(pos)} stroke="#e6e0d4" stroke-width="1" />
            <text x={ML - 8} y={yScale(pos) + 4} text-anchor="end" font-family="ui-monospace, monospace" font-size="11" fill={pos === 1 ? '#e10600' : '#5a5a5a'} font-weight={pos === 1 ? '700' : '400'}>P{pos}</text>
          </g>
        ))}

        {Array.from({ length: maxLap + 1 }).map((_, lap) => lap).filter((lap) => lap > 0 && lap % 5 === 0).map((lap) => (
          <g>
            <line x1={xScale(lap)} x2={xScale(lap)} y1={MT + plotH} y2={MT + plotH + 4} stroke="#5a5a5a" stroke-width="1" />
            <text x={xScale(lap)} y={MT + plotH + 18} text-anchor="middle" font-family="ui-monospace, monospace" font-size="11" fill="#5a5a5a">{lap}</text>
          </g>
        ))}

        {drivers.filter((d) => !topDriverIds.has(d.driverId)).map((d) => (
          <path d={path(d.series)} fill="none" stroke="#dcd5c6" stroke-width="1" />
        ))}
        {drivers.filter((d) => topDriverIds.has(d.driverId)).map((d) => (
          <path d={path(d.series)} fill="none" stroke={colorOf(d.driverId)} stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" />
        ))}

        {/* Driver labels at the END of each top-N curve */}
        {drivers.filter((d) => topDriverIds.has(d.driverId)).map((d) => {
          const last = d.series[d.series.length - 1]
          if (!last) return null
          return (
            <text
              x={xScale(last.lap) + 8}
              y={yScale(last.position) + 4}
              font-family="ui-monospace, monospace"
              font-size="12"
              font-weight="700"
              fill={colorOf(d.driverId)}
            >
              {d.driverId}
            </text>
          )
        })}

        <text x={ML + plotW / 2} y={H - 6} text-anchor="middle" font-family="ui-monospace, monospace" font-size="11" fill="#5a5a5a">LAP</text>
        <text x={12} y={MT + plotH / 2} transform={`rotate(-90 12 ${MT + plotH / 2})`} text-anchor="middle" font-family="ui-monospace, monospace" font-size="11" fill="#5a5a5a">POSITION</text>
      </svg>
      <style>{`
        :host { display: block; }
        .wrapper { width: 100%; margin: 1rem 0 1.5rem; }
        svg { width: 100%; height: auto; }
      `}</style>
    </div>
  )
})
