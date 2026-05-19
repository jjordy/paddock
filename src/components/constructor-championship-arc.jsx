// <constructor-championship-arc> — Cumulative-points curve per
// Constructor for one Season. Shares input shape with
// <championship-arc>: the per-Round standings file has Driver entries
// only, so we sum each Round's Driver points into the Constructor that
// scored them.
//
// Vocabulary follows CONTEXT.md: Round (x-axis), cumulative points
// (y-axis), one curve per Constructor.

import { defineComponent } from '@jjordy/rogue'

defineComponent(({ data = '{}' }) => {
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

  // Per-Constructor cumulative points per Round. Note the standings file
  // carries the Driver's cumulative season total, NOT the Round delta —
  // so summing the Round's Driver totals directly gives the Constructor's
  // cumulative total for that Round.
  const series = {}
  for (const r of rounds) {
    const totals = new Map()
    for (const s of r.drivers) {
      if (!s.constructorId) continue
      totals.set(s.constructorId, (totals.get(s.constructorId) ?? 0) + s.points)
    }
    for (const [cid, points] of totals) {
      let arr = series[cid]
      if (!arr) { arr = []; series[cid] = arr }
      arr.push({ round: r.round, points })
    }
  }

  // Sort Constructors by their LAST-round cumulative total so the title
  // contenders end up first in the legend.
  const finalRound = rounds[rounds.length - 1]
  const finalTotals = new Map()
  for (const s of finalRound.drivers) {
    if (!s.constructorId) continue
    finalTotals.set(s.constructorId, (finalTotals.get(s.constructorId) ?? 0) + s.points)
  }
  const constructorIds = [...finalTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cid]) => cid)
    .filter((cid) => series[cid])

  const topN = 5
  const colors = ['#e10600', '#0a0a0a', '#444444', '#777777', '#a0a0a0']

  const W = 1000
  const H = 500
  const ML = 56
  const MR = 200
  const MT = 24
  const MB = 36
  const plotW = W - ML - MR
  const plotH = H - MT - MB

  const maxRound = finalRound.round
  let maxPoints = 0
  for (const id of constructorIds) {
    for (const p of series[id]) if (p.points > maxPoints) maxPoints = p.points
  }
  if (maxPoints === 0) maxPoints = 1

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

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax * f))

  return (
    <div class="wrapper">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img">
        <rect x={ML} y={MT} width={plotW} height={plotH} fill="#fafafa" stroke="#1a1a1a" stroke-width="1" />

        {yTicks.map((v) => (
          <g>
            <line x1={ML} x2={ML + plotW} y1={yScale(v)} y2={yScale(v)} stroke="#e6e0d4" stroke-width="1" />
            <text x={ML - 8} y={yScale(v) + 4} text-anchor="end" font-family="ui-monospace, monospace" font-size="11" fill="#5a5a5a">{v}</text>
          </g>
        ))}

        {Array.from({ length: maxRound + 1 }, (_, i) => i).filter((r) => r > 0 && r % 2 === 0).map((r) => (
          <g>
            <line x1={xScale(r)} x2={xScale(r)} y1={MT + plotH} y2={MT + plotH + 4} stroke="#5a5a5a" stroke-width="1" />
            <text x={xScale(r)} y={MT + plotH + 18} text-anchor="middle" font-family="ui-monospace, monospace" font-size="11" fill="#5a5a5a">{r}</text>
          </g>
        ))}

        {constructorIds.slice(topN).map((id) => (
          <path d={path(series[id])} fill="none" stroke="#dcd5c6" stroke-width="1" />
        ))}

        {constructorIds.slice(0, topN).map((id, i) => (
          <path d={path(series[id])} fill="none" stroke={colors[i]} stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
        ))}

        {constructorIds.slice(0, topN).map((id, i) => {
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

        <text x={ML + plotW / 2} y={H - 6} text-anchor="middle" font-family="ui-monospace, monospace" font-size="11" fill="#5a5a5a">ROUND</text>
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
