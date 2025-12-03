import React from 'react'
import './SpeedDistanceChart.css'

type Turn = { index?: number; distance?: number; label?: string }

type Props = {
  distances: number[] // x
  speeds: number[] // y
  turns?: Turn[] // each turn either has index (into arrays) or distance
  height?: number
  padding?: number
  yLabel?: string
  lineColor?: string
}

function nearestIndexForDistance(distances: number[], d: number) {
  let best = 0
  let bestDiff = Infinity
  for (let i = 0; i < distances.length; i++) {
    const diff = Math.abs(distances[i] - d)
    if (diff < bestDiff) {
      bestDiff = diff
      best = i
    }
  }
  return best
}

export default function SpeedDistanceChart({
  distances,
  speeds,
  turns = [],
  height = 220,
  padding = 36,
  yLabel = 'Speed',
  lineColor = '#ffb400',
}: Props) {
  if (!distances || !speeds || distances.length === 0 || speeds.length === 0) {
    return null
  }

  const width = 720
  const w = width
  const h = height
  const pad = padding

  const minX = Math.min(...distances)
  const maxX = Math.max(...distances)
  const minY = Math.min(...speeds)
  const maxY = Math.max(...speeds)

  const mapX = (x: number) =>
    pad + ((x - minX) / (maxX - minX || 1)) * (w - pad * 2)
  const mapY = (y: number) =>
    pad + (1 - (y - minY) / (maxY - minY || 1)) * (h - pad * 2)

  const points = distances.map((d, i) => `${mapX(d)},${mapY(speeds[i])}`)
  const pathD = `M ${points.join(' L ')}`

  const xTicks = 6
  const yTicks = 4
  const xTickVals = [...Array(xTicks + 1)].map(
    (_, i) => minX + (i / xTicks) * (maxX - minX)
  )
  const yTickVals = [...Array(yTicks + 1)].map(
    (_, i) => minY + (i / yTicks) * (maxY - minY)
  )

  const resolvedTurns = turns
    .map((t) => {
      let idx = t.index
      if (idx == null && t.distance != null) {
        idx = nearestIndexForDistance(distances, t.distance)
      }
      if (idx == null) return null
      return { idx, distance: distances[idx], speed: speeds[idx], label: t.label }
    })
    .filter(Boolean) as { idx: number; distance: number; speed: number; label?: string }[]

  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null)
  const [hoverXY, setHoverXY] = React.useState<{ x: number; y: number } | null>(null)

  return (
    <div className="speed-distance-chart" style={{ width: w, position: 'relative' }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width={w}
        height={h}
        onMouseMove={(e) => {
          try {
            const rect = (e.currentTarget as SVGElement).getBoundingClientRect()
            const mx = e.clientX - rect.left
            // clamp
            const clamped = Math.max(pad, Math.min(w - pad, mx))
            // map back to distance value
            const xVal = minX + ((clamped - pad) / (w - pad * 2 || 1)) * (maxX - minX || 1)
            // find nearest index
            let best = 0
            let bestDiff = Infinity
            for (let i = 0; i < distances.length; i++) {
              const d = Math.abs(distances[i] - xVal)
              if (d < bestDiff) {
                bestDiff = d
                best = i
              }
            }
            ;(setHoverIndex as any)(best)
            ;(setHoverXY as any)({ x: mapX(distances[best]), y: mapY(speeds[best]) })
          } catch (err) {}
        }}
        onMouseLeave={() => {(setHoverIndex as any)(null); (setHoverXY as any)(null)}}
      >
        {/* hover visuals will be rendered inside SVG when state exists */}
        <rect x="0" y="0" width={w} height={h} className="sd-bg" rx="6" />
        <g className="sd-grid">
          {yTickVals.map((val, i) => {
            const y = mapY(val)
            return <line key={i} x1={pad} x2={w - pad} y1={y} y2={y} className="sd-grid-line" />
          })}
          {xTickVals.map((val, i) => {
            const x = mapX(val)
            return <line key={i} x1={x} x2={x} y1={pad} y2={h - pad} className="sd-grid-line" />
          })}
        </g>

        <g className="sd-axes">
          <text x={w / 2} y={h - 6} className="sd-axis-label">Distance</text>
          {/* rotate via SVG transform around a point so CSS transforms don't push it outside the viewBox */}
          <text
            x={12}
            y={h / 2}
            className="sd-axis-label sd-y"
            textAnchor="middle"
            transform={`rotate(-90 ${12} ${h / 2})`}
          >
            {yLabel}
          </text>
        </g>

        <g className="sd-ticks">
          {xTickVals.map((val, i) => (
            <text key={i} x={mapX(val)} y={h - pad + 14} className="sd-tick-label" textAnchor="middle">
              {Math.round(val)}
            </text>
          ))}
          {yTickVals.map((val, i) => (
            <text key={i} x={pad - 8} y={mapY(val) + 4} className="sd-tick-label">
              {Math.round(val)}
            </text>
          ))}
        </g>

        <path d={pathD} fill="none" className="sd-line" stroke={lineColor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        <path
          d={`${pathD} L ${mapX(maxX)},${h - pad} L ${mapX(minX)},${h - pad} Z`}
          className="sd-area"
          fillOpacity="0.04"
        />

        <g className="sd-turns">
          {resolvedTurns.map((t, i) => {
            const x = mapX(t.distance)
            const y = mapY(t.speed)
            return (
              <g key={i} className="sd-turn">
                <line x1={x} x2={x} y1={pad} y2={h - pad} className="sd-turn-line" />
                <circle cx={x} cy={y} r={4} className="sd-turn-dot" />
                {t.label ? <text x={x + 6} y={y - 8} className="sd-turn-label">{t.label}</text> : null}
              </g>
            )
          })}
        </g>

        {/* hover guide + dot */}
        {hoverIndex != null && hoverXY ? (
          <g className="sd-hover">
            <line x1={hoverXY.x} x2={hoverXY.x} y1={pad} y2={h - pad} className="sd-hover-line" />
            <circle cx={hoverXY.x} cy={hoverXY.y} r={4} className="sd-hover-dot" />
          </g>
        ) : null}
      </svg>

          {hoverIndex != null && hoverXY ? (
        <div className="sd-tooltip" style={{ left: hoverXY.x + 8, top: hoverXY.y - 28 }}>
            <div className="sd-tooltip-value">{yLabel}: {Number.isFinite(speeds[hoverIndex]) ? (speeds[hoverIndex] as number).toFixed(1) : String(speeds[hoverIndex])}</div>
          <div className="sd-tooltip-sub">{Math.round(distances[hoverIndex])} m</div>
        </div>
      ) : null}
    </div>
  )
}

// hover helper functions removed; state is managed with React hooks above
