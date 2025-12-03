import React from 'react'
import './Analysis.css'
import SpeedDistanceChart from './SpeedDistanceChart'

type Props = {
  positions: [number, number][]
  brake?: number[]
  distances?: number[]
  turns?: { index?: number; distance?: number; label?: string }[]
  height?: string
  zoom?: number
}

export default function BrakeAnalysis({ positions, brake, distances, turns, height = '320px', zoom = 1.5 }: Props) {
  if (!positions || positions.length < 2) return null

  // Build colored segments: green when not braking (brake==0), red when braking (brake>0).
  const segments = React.useMemo(() => {
    if (!positions || positions.length < 2) return [] as { points: [number, number][]; color: string }[]
    if (!brake || brake.length < 2) {
      return [{ points: positions, color: '#2ecc71' }]
    }

    const segs: { points: [number, number][]; color: string }[] = []
    let currentColor = Number(brake[0]) > 0 ? '#ff3b30' : '#2ecc71'
    let currentPoints: [number, number][] = [positions[0]]

    for (let i = 0; i < positions.length - 1; i++) {
      const next = positions[i + 1]
      const braking = Number(brake[i]) > 0
      const colorForThis = braking ? '#ff3b30' : '#2ecc71'

      if (colorForThis === currentColor) {
        currentPoints.push(next)
      } else {
        currentPoints.push(next)
        segs.push({ points: currentPoints, color: currentColor })
        currentColor = colorForThis
        currentPoints = [next]
      }
    }

    if (currentPoints.length >= 2) segs.push({ points: currentPoints, color: currentColor })
    return segs
  }, [positions, brake])

  // Compute svg mapping and paths (tight bbox)
  const svgData = React.useMemo(() => {
    if (!positions || positions.length === 0) return null
    const lats = positions.map(p => p[0])
    const lngs = positions.map(p => p[1])
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)

    const lngRange = maxLng - minLng || 1
    const latRange = maxLat - minLat || 1

    const BASE = 1000
    const canvasW = Math.max(200, Math.round(BASE * (lngRange / Math.max(1e-9, latRange))))
    const canvasH = Math.max(200, Math.round(BASE * (latRange / Math.max(1e-9, lngRange))))

    const mapXtmp = (lng: number) => ((lng - minLng) / (lngRange)) * canvasW
    const mapYtmp = (lat: number) => (1 - (lat - minLat) / (latRange)) * canvasH

    const mapped = positions.map(p => ({ x: mapXtmp(p[1]), y: mapYtmp(p[0]) }))
    const xs = mapped.map(m => m.x)
    const ys = mapped.map(m => m.y)
    const minXmap = Math.min(...xs)
    const maxXmap = Math.max(...xs)
    const minYmap = Math.min(...ys)
    const maxYmap = Math.max(...ys)

    const pad = Math.max(2, Math.round(Math.max(maxXmap - minXmap, maxYmap - minYmap) * 0.005))
    let viewMinX = minXmap - pad
    let viewMinY = minYmap - pad
    let viewW = (maxXmap - minXmap) + pad * 2
    let viewH = (maxYmap - minYmap) + pad * 2

    if (zoom && zoom > 1) {
      const cx = viewMinX + viewW / 2
      const cy = viewMinY + viewH / 2
      const newW = viewW / zoom
      const newH = viewH / zoom
      viewMinX = cx - newW / 2
      viewMinY = cy - newH / 2
      viewW = newW
      viewH = newH
    }

    const mapX = (lng: number) => mapXtmp(lng)
    const mapY = (lat: number) => mapYtmp(lat)

    const brakeSegs = segments.map(s => {
      const pts = s.points.map(p => `${mapX(p[1])},${mapY(p[0])}`)
      return { d: `M ${pts.join(' L ')}`, color: s.color }
    })

    const turnMarkers = (turns || []).map(t => {
      let idx: number | undefined = (t as any).index
      if ((idx == null || idx < 0) && (t as any).distance != null && distances && distances.length) {
        const target = (t as any).distance
        let best = 0
        let bestDiff = Infinity
        for (let i = 0; i < distances.length; i++) {
          const d = Math.abs(distances[i] - target)
          if (d < bestDiff) { bestDiff = d; best = i }
        }
        idx = best
      }
      if (idx != null && idx >= 0 && idx < positions.length) {
        const p = positions[idx]
        return { x: mapX(p[1]), y: mapY(p[0]), label: (t as any).label }
      }
      return null
    }).filter(Boolean) as { x: number; y: number; label?: string }[]

    return { viewMinX, viewMinY, viewW, viewH, brakeSegs, turnMarkers }
  }, [positions, segments, turns, distances, zoom])

  if (!svgData) return null

  const cx = svgData.viewMinX + svgData.viewW / 2
  const cy = svgData.viewMinY + svgData.viewH / 2
  const transform = `rotate(-90 ${cx} ${cy})`

  return (
    <div className="sector-time-root" style={{ ['--sector-height' as any]: height }}>
      <div className="sector-time-block">
        <svg className="sector-time-svg"
          viewBox={`${svgData.viewMinX} ${svgData.viewMinY} ${svgData.viewW} ${svgData.viewH}`}
          width="100%"
          height={height}
          preserveAspectRatio="xMidYMid meet"
        >
          <rect x={svgData.viewMinX} y={svgData.viewMinY} width={svgData.viewW} height={svgData.viewH} rx={8} fill="var(--bg, var(--panel-bg, #061226))" />
          <g transform={transform}>
            {(svgData as any).brakeSegs.map((s: any, i: number) => (
              <path key={i} d={s.d} stroke={s.color} strokeWidth={3} vectorEffect="non-scaling-stroke" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.95} />
            ))}

            {svgData.turnMarkers.map((m, i) => (
              <g key={i}>
                <circle
                  cx={m.x}
                  cy={m.y}
                  r={Math.max(2, Math.round(Math.min(svgData.viewW, svgData.viewH) * 0.006 / zoom))}
                  fill="#ff3b30"
                  fillOpacity={0.45}
                  stroke="#ffffff"
                  strokeWidth={0.6}
                />
                {m.label ? <title>{String(m.label)}</title> : null}
              </g>
            ))}
          </g>
        </svg>

        {distances && distances.length > 0 ? (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {brake && brake.length > 0 ? (
            <SpeedDistanceChart distances={distances} speeds={brake} turns={turns} height={120} yLabel="Brake (%)" lineColor="#ff3b30" />
          ) : null}
        </div>
      ) : null}
      </div>
    </div>
  )
}
