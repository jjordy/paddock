// <paddock-spark> — Tiny line chart for showing a single metric's shape
// across a sequence of points. No axes, no labels — just the curve
// and dots at each data point. The Driver detail page uses one per
// career metric (wins, podiums, points) to show season-over-season
// evolution; future generic uses can also pass arbitrary numeric series.
//
// Naming note: custom element names MUST contain a hyphen per the HTML
// spec; "sparkline" alone fails both customElements.define() AND rogue's
// auto-import (it only picks up kebab-case tags). Prefix-with-`paddock-`
// keeps it short while staying valid.

import { defineComponent } from '@jjordy/rogue'

defineComponent(({ values = '[]', color = '#e10600', height = '50', width = '180' }) => {
  const vals = JSON.parse(values() || '[]')
  const c = color()
  const W = Number(width())
  const H = Number(height())
  if (!Array.isArray(vals) || vals.length === 0) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} role="img">
        <rect width={W} height={H} fill="transparent" />
      </svg>
    )
  }
  let max = -Infinity
  let min = Infinity
  for (const v of vals) {
    if (v > max) max = v
    if (v < min) min = v
  }
  // Clamp to 0 baseline if all values are non-negative — anchors small
  // wins counts (e.g. 0/2/3) visually rather than rescaling away the gap.
  if (min >= 0) min = 0
  const range = Math.max(max - min, 1)
  const pad = 4
  const xScale = (i) =>
    vals.length === 1 ? W / 2 : pad + (i / (vals.length - 1)) * (W - 2 * pad)
  const yScale = (v) => pad + (1 - (v - min) / range) * (H - 2 * pad)

  let path = ''
  for (let i = 0; i < vals.length; i++) {
    path += (i === 0 ? 'M' : 'L') + xScale(i) + ',' + yScale(vals[i])
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img">
      <path d={path} stroke={c} stroke-width="2" fill="none" stroke-linejoin="round" />
      {vals.map((v, i) => (
        <circle cx={xScale(i)} cy={yScale(v)} r="2.5" fill={c} />
      ))}
      <style>{`
        :host { display: inline-block; }
        svg { display: block; width: 100%; height: auto; }
      `}</style>
    </svg>
  )
})
