import React from 'react'
import './Analysis.css'
import SpeedDistanceChart from './SpeedDistanceChart'

type Turn = { index?: number; distance?: number; label?: string }

type SvgData = {
  viewMinX: number
  viewMinY: number
  viewW: number
  viewH: number
  segPaths: { d: string; color: string }[]
  minSpeed?: number
  maxSpeed?: number
}

type Props = {
  positions: [number, number][]
  distances?: number[]
  speeds?: number[]
  turns?: Turn[]
  height?: string
  zoom?: number
}

export default function SpeedAnalysis({ positions, distances, speeds, turns, height = '320px', zoom = 1.5 }: Props) {
  if (!positions || positions.length < 2) return null

  // compute svg mapping & per-point speed segments (gradient)
  const svgData = React.useMemo(() => {
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

    const sp = (speeds || []).map(s => Number(s || 0))
    const minS = sp.length ? Math.min(...sp) : 0
    const maxS = sp.length ? Math.max(...sp) : 0
    const denom = maxS - minS || 1
    const getColorForSpeed = (v: number) => {
      const t = Math.max(0, Math.min(1, (v - minS) / denom))
      const hue = Math.round(240 - 240 * t)
      return `hsl(${hue}deg 85% 50%)`
    }

    const segPaths = [] as { d: string; color: string }[]
    for (let i = 0; i < positions.length - 1; i++) {
      const p1 = positions[i]
      const p2 = positions[i + 1]
      const x1 = mapX(p1[1])
      const y1 = mapY(p1[0])
      const x2 = mapX(p2[1])
      const y2 = mapY(p2[0])
      const sVal = sp[i] != null ? sp[i] : sp[i + 1]
      segPaths.push({ d: `M ${x1},${y1} L ${x2},${y2}`, color: getColorForSpeed(Number(sVal || 0)) })
    }

    return { viewMinX, viewMinY, viewW, viewH, segPaths, minSpeed: minS, maxSpeed: maxS }
  }, [positions, speeds, zoom])

  const cx = svgData.viewMinX + svgData.viewW / 2
  const cy = svgData.viewMinY + svgData.viewH / 2
  const transform = `rotate(-90 ${cx} ${cy})`

  return (
    <div style={{ marginTop: 12, textAlign: 'center' }}>
      <div className="sector-time-title">Speed Analysis</div>
      <div style={{ height: height, width: '100%', marginTop: 8 }}>
        <svg
          className="sector-time-svg"
          viewBox={`${svgData.viewMinX} ${svgData.viewMinY} ${svgData.viewW} ${svgData.viewH}`}
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
        >
          <rect x={svgData.viewMinX} y={svgData.viewMinY} width={svgData.viewW} height={svgData.viewH} rx={6} fill="var(--bg, var(--panel-bg, #061226))" />
          <g transform={transform}>
            {svgData.segPaths.map((s, i) => (
              <path key={i} d={s.d} stroke={s.color} strokeWidth={3} vectorEffect="non-scaling-stroke" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.95} />
            ))}
          </g>
        </svg>
      </div>

      {svgData && (svgData as any).minSpeed != null ? (
        <div className="sector-time-legend" style={{ marginTop: 8, padding: '0 8px' }}>
          <div
            className="sector-time-legend-bar"
            style={{
              background:
                'linear-gradient(90deg, hsl(240deg 85% 50%) 0%, hsl(180deg 85% 50%) 25%, hsl(120deg 85% 50%) 50%, hsl(60deg 85% 50%) 75%, hsl(0deg 85% 50%) 100%)',
            }}
          />
          <div className="sector-time-legend-labels">
            <span>{Math.round((svgData as any).minSpeed || 0)} km/h</span>
            <span>{Math.round((svgData as any).maxSpeed || 0)} km/h</span>
          </div>
        </div>
      ) : null}

      {distances && distances.length > 0 ? (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {speeds && speeds.length > 0 ? (
            <SpeedDistanceChart distances={distances} speeds={speeds} turns={turns} height={160} yLabel="Speed (km/h)" lineColor="#ffb400" />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
