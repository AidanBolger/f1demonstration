import React from 'react'
import TrackMap from './components/TrackMap'
import L from 'leaflet'
import Navbar from './components/Navbar'
import driversData from './data/drivers.json'
import cornerTransform from './data/corner_transform.json'

// Import corners at build time so Vite bundles the data and the map can render synchronously.
import cornersData from './data/corners.json'
import caGeo from './data/ca-1978.json'
import BrakeAnalysis from './components/BrakeAnalysis'
import SpeedAnalysis from './components/SpeedAnalysis'
// Explicit per-driver lap importers so we only load when user selects a driver.
const lapImporters: Record<string, () => Promise<any>> = {
  ALB: () => import('./data/laps/ALB.json'),
  ALO: () => import('./data/laps/ALO.json'),
  ANT: () => import('./data/laps/ANT.json'),
  BEA: () => import('./data/laps/BEA.json'),
  BOR: () => import('./data/laps/BOR.json'),
  COL: () => import('./data/laps/COL.json'),
  GAS: () => import('./data/laps/GAS.json'),
  HAD: () => import('./data/laps/HAD.json'),
  HAM: () => import('./data/laps/HAM.json'),
  HUL: () => import('./data/laps/HUL.json'),
  LAW: () => import('./data/laps/LAW.json'),
  LEC: () => import('./data/laps/LEC.json'),
  NOR: () => import('./data/laps/NOR.json'),
  OCO: () => import('./data/laps/OCO.json'),
  PIA: () => import('./data/laps/PIA.json'),
  RUS: () => import('./data/laps/RUS.json'),
  SAI: () => import('./data/laps/SAI.json'),
  STR: () => import('./data/laps/STR.json'),
  TSU: () => import('./data/laps/TSU.json'),
  VER: () => import('./data/laps/VER.json'),
}

type Driver = { driver: string; team: string; color: string }

type Corners = {
  CornerNumber: number[]
  X: number[]
  Y: number[]
}

export default function App() {
  const corners: Corners = cornersData as unknown as Corners

  // Lifted selection + telemetry state so analyses and TrackMap share the same data
  const [selectedDriverCode, setSelectedDriverCode] = React.useState<string>('VER')
  const [telemetryModule, setTelemetryModule] = React.useState<any | null>(null)
  const telemetry = telemetryModule && telemetryModule.tel ? telemetryModule.tel : null

  React.useEffect(() => {
    let cancelled = false
    const importer = (lapImporters as any)[selectedDriverCode]
    if (!importer) {
      setTelemetryModule(null)
      return
    }
    importer().then((mod: any) => {
      if (cancelled) return
      setTelemetryModule((mod && (mod as any).default) ? (mod as any).default : mod)
    }).catch((err: any) => {
      console.warn('Failed to import lap for', selectedDriverCode, err)
      if (!cancelled) setTelemetryModule(null)
    })
    return () => { cancelled = true }
  }, [selectedDriverCode])

  const telemetryLatLngs = React.useMemo(() => {
    if (!telemetry || !telemetry.x || !telemetry.y) return [] as [number, number][]
    const xs: number[] = telemetry.x
    const ys: number[] = telemetry.y
    const t = (cornerTransform && (cornerTransform as any).transform) ? (cornerTransform as any).transform : null
    if (t) {
      const s = t.s, cos = t.cos, sin = t.sin, tx = t.tx, ty = t.ty
      return xs.map((x, i) => {
        const y = ys[i]
        const px = s * (cos * x - sin * y) + tx
        const py = s * (sin * x + cos * y) + ty
        const latlng = L.CRS.EPSG3857.unproject(L.point(px, py))
        return [latlng.lat, latlng.lng] as [number, number]
      })
    }

    if (caGeo && caGeo.features && caGeo.features[0]) {
      const coords: any = caGeo.features[0].geometry.coordinates
      const lons = (coords as any[]).map((c: any) => c[0])
      const lats = (coords as any[]).map((c: any) => c[1])
      const minLon = Math.min(...lons), maxLon = Math.max(...lons)
      const minLat = Math.min(...lats), maxLat = Math.max(...lats)
      const minX = Math.min(...xs), maxX = Math.max(...xs)
      const minY = Math.min(...ys), maxY = Math.max(...ys)
      const mapXtoLon = (x: number) => (maxX === minX) ? (minLon + maxLon) / 2 : ((x - minX) / (maxX - minX)) * (maxLon - minLon) + minLon
      const mapYtoLat = (y: number) => (maxY === minY) ? (minLat + maxLat) / 2 : ((y - minY) / (maxY - minY)) * (maxLat - minLat) + minLat
      return xs.map((x, i) => ([mapYtoLat(ys[i]), mapXtoLon(x)] as [number, number]))
    }
    return [] as [number, number][]
  }, [telemetry])

  // compute turn markers by finding nearest telemetry index for each corner coordinate
  const turnsForChart = React.useMemo(() => {
    if (!telemetry || !telemetryLatLngs || telemetryLatLngs.length === 0) return [] as { distance?: number; label?: string }[]
    const t = (cornerTransform && (cornerTransform as any).transform) ? (cornerTransform as any).transform : null
    const cornerXs = (corners && (corners as any).X) ? (corners as any).X : []
    const cornerYs = (corners && (corners as any).Y) ? (corners as any).Y : []
    const cornerNums = (corners && (corners as any).CornerNumber) ? (corners as any).CornerNumber : []
    const latlngsForCorners: [number, number][] = []
    if (t) {
      const s = t.s, cos = t.cos, sin = t.sin, tx = t.tx, ty = t.ty
      for (let i = 0; i < cornerXs.length; i++) {
        const x = cornerXs[i]
        const y = cornerYs[i]
        const px = s * (cos * x - sin * y) + tx
        const py = s * (sin * x + cos * y) + ty
        const latlng = L.CRS.EPSG3857.unproject(L.point(px, py))
        latlngsForCorners.push([latlng.lat, latlng.lng])
      }
    }

    const turns: { distance?: number; label?: string }[] = []
    const telemetryDistances: number[] = telemetry.distance || telemetry.distances || []
    for (let i = 0; i < latlngsForCorners.length; i++) {
      const c = latlngsForCorners[i]
      let bestIdx = -1
      let bestDist = Infinity
      for (let j = 0; j < telemetryLatLngs.length; j++) {
        const tll = telemetryLatLngs[j]
        const dx = tll[0] - c[0]
        const dy = tll[1] - c[1]
        const d2 = dx * dx + dy * dy
        if (d2 < bestDist) {
          bestDist = d2
          bestIdx = j
        }
      }
      if (bestIdx >= 0) {
        turns.push({ distance: telemetryDistances && telemetryDistances[bestIdx] != null ? telemetryDistances[bestIdx] : undefined, label: cornerNums[i] != null ? String(cornerNums[i]) : `Turn ${i + 1}` })
      }
    }
    return turns
  }, [telemetry, telemetryLatLngs, corners])

  // driver color lookup
  const driversList: Driver[] = (driversData && (driversData as any).drivers) ? (driversData as any).drivers : []
  const matched = driversList.find(d => d.driver === selectedDriverCode) || driversList[0] || { driver: 'VER', team: 'Red Bull Racing', color: '#1E22AA' }
  const driver = { name: matched.driver, team: matched.team, color: matched.color }

  return (
    <div className="app">
      <Navbar />
      <main className="app-main">
        <TrackMap
          corners={corners}
          highResGeo={caGeo}
          selectedDriverCode={selectedDriverCode}
          onSelectDriver={setSelectedDriverCode}
          telemetry={telemetry}
          telemetryLatLngs={telemetryLatLngs}
        />

        <div className="sector-time-block" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <BrakeAnalysis
            positions={telemetryLatLngs}
            brake={telemetry?.brake}
            distances={telemetry?.distance}
            turns={turnsForChart}
          />

          <SpeedAnalysis
            positions={telemetryLatLngs}
            distances={telemetry?.distance}
            speeds={telemetry?.speed}
            turns={turnsForChart}
          />
        </div>
      </main>
    </div>
  )
}
