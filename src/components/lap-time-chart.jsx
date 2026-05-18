// <lap-time-chart> — Scatter plot of Lap times across a Race.
//
// X = Lap number, Y = lap time in seconds. One series per Driver.
// Top-5 finishers (by final position) get distinct colors; everyone
// else is a pale grey wash. Y axis is capped at 110% of the median
// Lap time so pit-stop outliers don't squash the race-pace scatter
// against the bottom of the plot — outliers are clipped, not hidden.
//
// Data prop is a JSON string of:
//   { drivers: [{ driverId, series: [{ lap, ms, position, time }] }] }
//
// Optional `finalOrder` is an array of driverIds in final classification
// order; used to pick the top-5. Falls back to whoever has the most
// laps if not provided.

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

  // Median lap time across ALL drivers — the cap for the Y axis.
  const allMs = []
  let maxLap = 0
  for (const d of drivers) {
    for (const p of d.series) {
      allMs.push(p.ms)
      if (p.lap > maxLap) maxLap = p.lap
    }
  }
  allMs.sort((a, b) => a - b)
  const medianMs = allMs[Math.floor(allMs.length / 2)]
  const yMaxMs = Math.round(medianMs * 1.10)
  const yMinMs = Math.max(0, Math.round(allMs[0] * 0.99))

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
  const ML = 60
  const MR = 160
  const MT = 20
  const MB = 36
  const plotW = W - ML - MR
  const plotH = H - MT - MB

  const xScale = (lap) => ML + (lap / maxLap) * plotW
  const yScale = (ms) => MT + plotH - ((ms - yMinMs) / (yMaxMs - yMinMs)) * plotH
  const inRange = (ms) => ms >= yMinMs && ms <= yMaxMs

  const fmtMs = (ms) => {
    const m = Math.floor(ms / 60000)
    const sec = ((ms % 60000) / 1000).toFixed(3)
    return m > 0 ? `${m}:${sec.padStart(6, '0')}` : sec
  }
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMinMs + (yMaxMs - yMinMs) * f))

  return (
    <div class="wrapper">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img">
        <rect x={ML} y={MT} width={plotW} height={plotH} fill="#fafafa" stroke="#1a1a1a" stroke-width="1" />

        {yTicks.map((v) => (
          <g>
            <line x1={ML} x2={ML + plotW} y1={yScale(v)} y2={yScale(v)} stroke="#e6e0d4" stroke-width="1" />
            <text x={ML - 8} y={yScale(v) + 4} text-anchor="end" font-family="ui-monospace, monospace" font-size="11" fill="#5a5a5a">{fmtMs(v)}</text>
          </g>
        ))}

        {Array.from({ length: maxLap + 1 }).map((_, lap) => lap).filter((lap) => lap > 0 && lap % 5 === 0).map((lap) => (
          <g>
            <line x1={xScale(lap)} x2={xScale(lap)} y1={MT + plotH} y2={MT + plotH + 4} stroke="#5a5a5a" stroke-width="1" />
            <text x={xScale(lap)} y={MT + plotH + 18} text-anchor="middle" font-family="ui-monospace, monospace" font-size="11" fill="#5a5a5a">{lap}</text>
          </g>
        ))}

        {/* Non-top-N drivers first */}
        {drivers.filter((d) => !topDriverIds.has(d.driverId)).map((d) => (
          <g>
            {d.series.filter((p) => inRange(p.ms)).map((p) => (
              <circle cx={xScale(p.lap)} cy={yScale(p.ms)} r="1.8" fill="#dcd5c6" />
            ))}
          </g>
        ))}
        {/* Top-N drivers — drawn last for prominence */}
        {drivers.filter((d) => topDriverIds.has(d.driverId)).map((d) => {
          const c = colorOf(d.driverId)
          return (
            <g>
              {d.series.filter((p) => inRange(p.ms)).map((p) => (
                <circle cx={xScale(p.lap)} cy={yScale(p.ms)} r="2.6" fill={c} />
              ))}
            </g>
          )
        })}

        {/* Top-N labels stacked at the right edge */}
        {order.slice(0, topN).map((id, i) => (
          <g>
            <rect x={W - MR + 8} y={MT + 8 + i * 22} width="10" height="10" fill={colors[i]} />
            <text x={W - MR + 24} y={MT + 18 + i * 22} font-family="ui-monospace, monospace" font-size="12" font-weight="700" fill={colors[i]}>{id}</text>
          </g>
        ))}

        <text x={ML + plotW / 2} y={H - 6} text-anchor="middle" font-family="ui-monospace, monospace" font-size="11" fill="#5a5a5a">LAP</text>
        <text x={12} y={MT + plotH / 2} transform={`rotate(-90 12 ${MT + plotH / 2})`} text-anchor="middle" font-family="ui-monospace, monospace" font-size="11" fill="#5a5a5a">LAP TIME</text>
      </svg>
      <style>{`
        :host { display: block; }
        .wrapper { width: 100%; margin: 1rem 0 1.5rem; }
        svg { width: 100%; height: auto; }
      `}</style>
    </div>
  )
})
