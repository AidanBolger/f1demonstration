import React, { useMemo } from 'react'
import { MapContainer, useMap, CircleMarker, GeoJSON, Tooltip, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
// load precomputed transform (written by scripts/compute_transform.js)
import cornerTransform from '../data/corner_transform.json'
// telemetry (driver lap) files are in `src/data/laps` (loaded dynamically)
import driversData from '../data/drivers.json'
import './TrackMap.css'

// Explicit per-driver lap importers so we only load when user selects a driver.
// This avoids Vite complaining about template dynamic imports while still not preloading other laps.
const lapImporters: Record<string, () => Promise<any>> = {
  ALB: () => import('../data/laps/ALB.json'),
  ALO: () => import('../data/laps/ALO.json'),
  ANT: () => import('../data/laps/ANT.json'),
  BEA: () => import('../data/laps/BEA.json'),
  BOR: () => import('../data/laps/BOR.json'),
  COL: () => import('../data/laps/COL.json'),
  GAS: () => import('../data/laps/GAS.json'),
  HAD: () => import('../data/laps/HAD.json'),
  HAM: () => import('../data/laps/HAM.json'),
  HUL: () => import('../data/laps/HUL.json'),
  LAW: () => import('../data/laps/LAW.json'),
  LEC: () => import('../data/laps/LEC.json'),
  NOR: () => import('../data/laps/NOR.json'),
  OCO: () => import('../data/laps/OCO.json'),
  PIA: () => import('../data/laps/PIA.json'),
  RUS: () => import('../data/laps/RUS.json'),
  SAI: () => import('../data/laps/SAI.json'),
  STR: () => import('../data/laps/STR.json'),
  TSU: () => import('../data/laps/TSU.json'),
  VER: () => import('../data/laps/VER.json'),
}

// default padding used for fitBounds (tight)
const DEFAULT_PADDING: [number, number] = [10, 10]

type Corners = {
  CornerNumber: number[]
  X: number[]
  Y: number[]
  Angle?: number[]
  Distance?: number[]
  Rotation?: number[]
}

type DisplayCorner = { lat: number; lon: number; idx: number; num?: number }

// FitBounds removed — we now use FitBoundsGeo for the geographic GeoJSON view.

function FitBoundsGeo({ coords }: { coords: [number, number][] }) {
  const map = useMap()
  React.useEffect(() => {
    if (!coords || coords.length === 0) return
    const latlngs = coords.map(c => L.latLng(c[1], c[0]))
    const bounds = L.latLngBounds(latlngs as any)
    setTimeout(() => map.invalidateSize(), 0)
    // Use tight padding so the track fills more of the viewport by default
    map.fitBounds(bounds, { padding: DEFAULT_PADDING })
  }, [map, coords])
  return null
}

export default function TrackMap({
  corners,
  highResGeo,
  selectedDriverCode: selectedDriverCodeProp,
  onSelectDriver,
  telemetry: telemetryProp,
  telemetryLatLngs: telemetryLatLngsProp
}: {
  corners: Corners | null
  highResGeo?: any
  selectedDriverCode?: string
  onSelectDriver?: (code: string) => void
  telemetry?: any
  telemetryLatLngs?: [number, number][]
}) {
  // allow either controlled (props) or uncontrolled (internal state) usage
  const [internalSelectedDriverCode, setInternalSelectedDriverCode] = React.useState<string>('VER')
  const selectedDriverCode = selectedDriverCodeProp ?? internalSelectedDriverCode
  const setSelectedDriverCode = (code: string) => {
    if (onSelectDriver) onSelectDriver(code)
    else setInternalSelectedDriverCode(code)
  }
  const mapRef = React.useRef<any | null>(null)
  const playbackRef = React.useRef<HTMLDivElement | null>(null)
  const telemetryRef = React.useRef<HTMLDivElement | null>(null)
  const cornerPoints = useMemo(() => {
    if (!corners) return [] as { x: number; y: number; idx: number; num?: number }[]
    const { X, Y, CornerNumber } = corners
    const out: { x: number; y: number; idx: number; num?: number }[] = []
    for (let i = 0; i < Math.min(X.length, Y.length); i++) {
      out.push({ x: X[i], y: Y[i], idx: i, num: CornerNumber?.[i] })
    }
    return out
  }, [corners])

  // debug info about corners bbox
  React.useEffect(() => {
    if (!cornerPoints.length) return
    const xs = cornerPoints.map(p => p.x)
    const ys = cornerPoints.map(p => p.y)
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    console.log('TrackMap debug: corners', cornerPoints.length, 'X range', minX, maxX, 'Y range', minY, maxY)
  }, [cornerPoints])

  // We'll render a single geographic map (WGS84) using the high-res GeoJSON.
  // The corners coordinates are in the project's planar XY space. To overlay them on the geographic GeoJSON
  // we do a best-effort linear mapping from the corners bounding box to the GeoJSON bbox (affine scale+translate).
  // This is a heuristic — if you want a precise georeference we can compute an affine/helmert transform from control points.
  const mappedCorners = useMemo(() => {
    if (!highResGeo || !highResGeo.features || !highResGeo.features.length) return [] as { lat: number; lon: number; idx: number; num?: number }[]
    if (!cornerPoints.length) return [] as { lat: number; lon: number; idx: number; num?: number }[]

    // GeoJSON bbox (compute from the first feature coordinates)
    const coords: [number, number][] = highResGeo.features[0].geometry.coordinates
    const lons = coords.map(c => c[0])
    const lats = coords.map(c => c[1])
    const minLon = Math.min(...lons), maxLon = Math.max(...lons)
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)

    // corners bbox
    const xs = cornerPoints.map(p => p.x)
    const ys = cornerPoints.map(p => p.y)
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)

    // Map x->lon and y->lat linearly. Note: if the Y axis orientation differs, this simple linear mapping may flip the track vertically.
    const mapXtoLon = (x: number) => {
      if (maxX === minX) return (minLon + maxLon) / 2
      return ((x - minX) / (maxX - minX)) * (maxLon - minLon) + minLon
    }
    const mapYtoLat = (y: number) => {
      if (maxY === minY) return (minLat + maxLat) / 2
      return ((y - minY) / (maxY - minY)) * (maxLat - minLat) + minLat
    }

    return cornerPoints.map(c => ({ lat: mapYtoLat(c.y), lon: mapXtoLon(c.x), idx: c.idx, num: c.num }))
  }, [highResGeo, cornerPoints])

  // (ICP removed) We rely on a precomputed transform for display; mappedCorners remains as a simple bbox fallback.

    // If a precomputed transform exists (written by scripts/compute_transform.js), use it to map corners
    const precomputedMappedCorners = useMemo(() => {
      try {
        const t = (cornerTransform && (cornerTransform as any).transform) ? (cornerTransform as any).transform : null
        if (!t) return [] as { lon: number; lat: number; idx: number; num?: number }[]
        const s = t.s, cos = t.cos, sin = t.sin, tx = t.tx, ty = t.ty
        return cornerPoints.map(cp => {
          const x = cp.x, y = cp.y
          const px = s * (cos * x - sin * y) + tx
          const py = s * (sin * x + cos * y) + ty
          const latlng = L.CRS.EPSG3857.unproject(L.point(px, py))
          return { lon: latlng.lng, lat: latlng.lat, idx: cp.idx, num: cp.num }
        })
      } catch (e) {
        // fallback: empty so UI uses refinedMappedCorners
        return [] as { lon: number; lat: number; idx: number; num?: number }[]
      }
    }, [cornerPoints])

    // choose display positions: prefer precomputed transform, else fall back to bbox linear mapping
    const displayCorners = useMemo<DisplayCorner[]>(() => {
      if (precomputedMappedCorners && precomputedMappedCorners.length) return precomputedMappedCorners as DisplayCorner[]
      return mappedCorners as DisplayCorner[]
    }, [precomputedMappedCorners, mappedCorners])

    // --- Telemetry: support dynamic lap selection (controlled via props or internal) ---
    const [lapFilename, setLapFilename] = React.useState<string>(`${selectedDriverCode}.json`)
    const [telemetryModule, setTelemetryModule] = React.useState<any | null>(null)
    const telemetry = telemetryProp ?? (telemetryModule && telemetryModule.tel ? telemetryModule.tel : null)

    // Build a simple driver object for display/use in this component.
    const driversList: any[] = (driversData && (driversData as any).drivers) ? (driversData as any).drivers : []
    const matched = driversList.find(d => d.driver === selectedDriverCode) || driversList[0] || { driver: 'VER', team: 'Red Bull Racing', color: '#1E22AA' }
    const driver = { name: matched.driver, team: matched.team, color: matched.color }

    // When a driver is selected, load that driver's lap via the explicit importer map.
    React.useEffect(() => {
      // only perform dynamic import when telemetry is not provided via props
      if (telemetryProp) return
      let cancelled = false
      const filename = `${selectedDriverCode}.json`
      setLapFilename(filename)
      const importer = (lapImporters as any)[selectedDriverCode]
      if (!importer) {
        console.warn('No importer for driver', selectedDriverCode)
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
    }, [selectedDriverCode, telemetryProp])

    const telemetryLatLngs = telemetryLatLngsProp ?? useMemo(() => {
      if (!telemetry || !telemetry.x || !telemetry.y) return [] as [number, number][]
      const xs: number[] = telemetry.x
      const ys: number[] = telemetry.y
      // prefer using precomputed transform if available
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
      // fallback: try simple bbox mapping into highResGeo (if present)
      if (highResGeo && highResGeo.features && highResGeo.features[0]) {
        const coords: [number, number][] = highResGeo.features[0].geometry.coordinates
        const lons = coords.map(c => c[0])
        const lats = coords.map(c => c[1])
        const minLon = Math.min(...lons), maxLon = Math.max(...lons)
        const minLat = Math.min(...lats), maxLat = Math.max(...lats)
        const minX = Math.min(...xs), maxX = Math.max(...xs)
        const minY = Math.min(...ys), maxY = Math.max(...ys)
        const mapXtoLon = (x: number) => (maxX === minX) ? (minLon + maxLon) / 2 : ((x - minX) / (maxX - minX)) * (maxLon - minLon) + minLon
        const mapYtoLat = (y: number) => (maxY === minY) ? (minLat + maxLat) / 2 : ((y - minY) / (maxY - minY)) * (maxLat - minLat) + minLat
        return xs.map((x, i) => ([mapYtoLat(ys[i]), mapXtoLon(x)] as [number, number]))
      }
      return [] as [number, number][]
    }, [telemetry, highResGeo])

    // playback state
    const [currentIndex, setCurrentIndex] = React.useState(0)
    const [playing, setPlaying] = React.useState(false)
    const [speed, setSpeed] = React.useState(1) // 1x

    // Refs for high-performance animation (avoid stale closures)
    const markerRef = React.useRef<L.CircleMarker | null>(null)
    const playStartWallRef = React.useRef<number | null>(null)
    const playStartTelRef = React.useRef<number | null>(null)
    const speedRef = React.useRef<number>(speed)
    speedRef.current = speed

    // helper: find segment index i where times[i] <= t <= times[i+1]
    const findSegmentIndex = React.useCallback((t: number) => {
      if (!telemetry || !telemetry.time) return 0
      const arr = telemetry.time
      const n = arr.length
      if (n === 0) return 0
      if (t <= arr[0]) return 0
      if (t >= arr[n - 1]) return Math.max(0, n - 2)
      let lo = 0, hi = n - 1
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2)
        if (arr[mid] <= t && t <= arr[mid + 1]) return mid
        if (arr[mid] < t) lo = mid + 1
        else hi = mid - 1
      }
      return Math.max(0, Math.min(n - 2, lo - 1))
    }, [telemetry])

    // Driver marker setup and update
    React.useEffect(() => {
      const map = mapRef.current
      if (!map || !telemetryLatLngs || telemetryLatLngs.length === 0) return
      // ensure we have a Leaflet map instance
      try {
        const latlng = telemetryLatLngs[currentIndex]
        if (!markerRef.current) {
          markerRef.current = L.circleMarker([latlng[0], latlng[1]], {
            radius: 7,
            color: driver?.color || '#3a17ff', // stroke uses driver color
            weight: 4,
            fillColor: '#ffffff', // fill is white
            fillOpacity: 1,
            interactive: false
          }).addTo(map)
        } else {
          markerRef.current.setLatLng([latlng[0], latlng[1]])
          try { markerRef.current.setStyle({ fillColor: '#ffffff', color: driver?.color || '#3a17ff' }) } catch (e) {}
        }
      } catch (e) {
        // ignore
      }
      return () => {
        if (markerRef.current) {
          try { markerRef.current.remove() } catch (e) {}
          markerRef.current = null
        }
      }
    }, [mapRef.current, telemetryLatLngs, currentIndex])

    // Update marker style when the selected driver's color changes
    React.useEffect(() => {
      if (markerRef.current) {
        try { markerRef.current.setStyle({ fillColor: '#ffffff', color: driver?.color || '#3a17ff' }) } catch (e) {}
      }
    }, [driver?.color])

    // main RAF loop: update marker position by telemetry time interpolation
    React.useEffect(() => {
      if (!telemetry || !telemetry.time || telemetry.time.length === 0) return
      let rafId: number | null = null

      const step = () => {
        if (!playing) return
        const startWall = playStartWallRef.current ?? performance.now()
        const startTel = playStartTelRef.current ?? telemetry.time[currentIndex] ?? 0
        const elapsedSec = (performance.now() - startWall) / 1000
        const targetTime = startTel + elapsedSec * (speedRef.current || 1)

        // clamp to telemetry range
        const times = telemetry.time
        const lastTime = times[times.length - 1]
        const t = Math.max(times[0], Math.min(lastTime, targetTime))

        const i = findSegmentIndex(t)
        const t0 = times[i]
        const t1 = times[i + 1] ?? t0
        const alpha = t1 === t0 ? 0 : (t - t0) / (t1 - t0)

        const p0 = telemetryLatLngs[i]
        const p1 = telemetryLatLngs[i + 1] ?? p0
        const lat = p0[0] + alpha * (p1[0] - p0[0])
        const lon = p0[1] + alpha * (p1[1] - p0[1])

        // update raw Leaflet marker
        if (markerRef.current) markerRef.current.setLatLng([lat, lon])

        // update HUD index occasionally (setState every frame is acceptable but keep it minimal)
        const approxIndex = Math.round(i + alpha)
        setCurrentIndex(Math.max(0, Math.min(telemetry.time.length - 1, approxIndex)))

        rafId = requestAnimationFrame(step)
      }

      if (playing) {
        // initialize play anchors
        playStartWallRef.current = playStartWallRef.current ?? performance.now()
        playStartTelRef.current = playStartTelRef.current ?? (telemetry.time[currentIndex] ?? 0)
        rafId = requestAnimationFrame(step)
      } else {
        // clear anchors so resume will rebase
        playStartWallRef.current = null
        playStartTelRef.current = null
      }

      return () => { if (rafId) cancelAnimationFrame(rafId) }
    }, [playing, telemetry, telemetryLatLngs, currentIndex, findSegmentIndex])

    // helper to round displayed telemetry values to whole numbers
    const roundDisplay = (v: any) => {
      if (v === null || v === undefined) return '-'
      if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v)
      const n = Number(v)
      return Number.isFinite(n) ? Math.round(n) : v
    }

    // format a telemetry value as percent (0-100). Accepts 0..1 or 0..100 inputs.
    const formatPercent = (v: any): number | null => {
      if (v === null || v === undefined) return null
      const n = Number(v)
      if (!Number.isFinite(n)) return null
      let p = n
      if (p >= 0 && p <= 1) p = p * 100
      // clamp
      if (p < 0) p = 0
      if (p > 100) p = 100
      return Math.round(p)
    }

    // format distance to kilometers with two decimals
    const formatKm = (v: any): string => {
      if (v === null || v === undefined) return '-'
      const n = Number(v)
      if (!Number.isFinite(n)) return '-'
      const km = n / 1000
      return (Math.round(km * 100) / 100).toFixed(2) + ' km'
    }

    // format time in seconds with three decimal places
    const formatTime = (v: any): string => {
      if (v === null || v === undefined) return '-'
      const n = Number(v)
      if (!Number.isFinite(n)) return '-'
      return n.toFixed(3) + 's'
    }

    // percent (0-100) for the current position of the time range slider
    const rangePercent = React.useMemo(() => {
      if (!telemetry || !telemetry.time || telemetry.time.length <= 1) return 0
      return Math.round((currentIndex / Math.max(1, telemetry.time.length - 1)) * 100)
    }, [telemetry, currentIndex])

    // Keep the playback box exactly the same pixel width as the telemetry box on desktop
    React.useLayoutEffect(() => {
      if (!playbackRef.current || !telemetryRef.current) return

      const update = () => {
        try {
          // on small screens we want the media query to control full-width behavior
          if (window.innerWidth <= 900) {
            playbackRef.current!.style.width = ''
            return
          }
          const w = telemetryRef.current!.offsetWidth
          playbackRef.current!.style.width = w ? `${w}px` : ''
        } catch (e) {}
      }

      update()
      const ResizeObserverCtor = (window as any).ResizeObserver as any | undefined
      const ro = ResizeObserverCtor ? new ResizeObserverCtor((entries: any) => update()) : null
      if (telemetryRef.current && ro) ro.observe(telemetryRef.current)
      window.addEventListener('resize', update)
      return () => {
        try { if (ro && telemetryRef.current) ro.unobserve(telemetryRef.current) } catch (e) {}
        window.removeEventListener('resize', update)
      }
    }, [telemetryRef.current, playbackRef.current, telemetry, currentIndex])


  return (
    <div className="tm-container">
      {/* Left column: map */}
      <div className="tm-left">
        {!highResGeo || !highResGeo.features || !highResGeo.features.length ? (
          <div style={{ padding: 20 }}>No high-resolution GeoJSON track provided.</div>
        ) : (
          <>
          <MapContainer
            ref={(m: any) => { mapRef.current = m }}
            center={[highResGeo.features[0].geometry.coordinates[0][1], highResGeo.features[0].geometry.coordinates[0][0]]}
            zoom={14}
            className="tm-map"
          >
            <FitBoundsGeo coords={highResGeo.features[0].geometry.coordinates as [number, number][]} />
            <GeoJSON data={highResGeo} style={{ color: '#ffffff5b', weight: 6, opacity: 0.95 }} />

            {/* telemetry polyline */}
            {telemetryLatLngs && telemetryLatLngs.length > 0 && (
              <Polyline positions={telemetryLatLngs.map(p => [p[0], p[1]])} pathOptions={{ color: driver?.color || '#ffb400', weight: 3, opacity: 0.9 }} />
            )}

            {/* playback marker is handled by a single raw Leaflet L.marker (markerRef) to avoid re-render jitter */}

            {/* corner display disabled for now */}

            </MapContainer>

            {/* Refit map button (moved out of controls) */}
            <button
              className="tm-refit-button"
              title="Refit map (tight padding)"
              onClick={() => {
                try {
                  if (!mapRef.current || !highResGeo || !highResGeo.features || !highResGeo.features.length) return
                  const coords: [number, number][] = highResGeo.features[0].geometry.coordinates
                  const latlngs = coords.map(c => L.latLng(c[1], c[0]))
                  const bounds = L.latLngBounds(latlngs as any)
                  setTimeout(() => mapRef.current.invalidateSize(), 0)
                  mapRef.current.fitBounds(bounds, { padding: DEFAULT_PADDING })
                } catch (e) {}
              }}
            >
              Refit Map
            </button>
          </>
        )}
      </div>


      {/* Right column: playback on top, telemetry below */}
      <div className="tm-right">
        <div className="tm-playback" ref={playbackRef}>
          <div className="tm-event-label">Circuit Gilles Villeneuve (Montreal) — 2025 Qualifying</div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <button onClick={() => setPlaying(p => !p)} className="tm-play-button">{playing ? 'Pause' : 'Play'}</button>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <label style={{ fontSize: 15, color:'#cfe3ff' }}>Speed</label>
              <div className="tm-driver-select-wrap">
                <select className="tm-driver-select tm-speed-select" value={speed} onChange={e => setSpeed(Number(e.target.value))}>
                  <option value={0.25}>0.25x</option>
                  <option value={0.5}>0.5x</option>
                  <option value={1}>1x</option>
                  <option value={2}>2x</option>
                  <option value={4}>4x</option>
                </select>
              </div>
            </div>
          </div>

          {telemetry && telemetry.time && (
            <input
              type="range"
              min={0}
              max={Math.max(0, telemetry.time.length - 1)}
              value={currentIndex}
              onChange={e => { setCurrentIndex(Number(e.target.value)); setPlaying(false) }}
              className="tm-range"
              style={{
                background: `linear-gradient(90deg, var(--play-color, #00bcd4) ${rangePercent}%, #141824 ${rangePercent}%)`
              }}
            />
          )}
        </div>

      <div className="tm-telemetry" ref={telemetryRef} style={{ ['--driver-color' as any]: driver?.color || '#3a17ff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          
          <div className="tm-driver-chip">
            <div className="tm-driver-label" style={{ color: '#cfe3ff' }}>Driver</div>
            <div className="tm-driver-swatch" style={{ background: driver?.color || '#ccc' }} />
            <div className="tm-driver-select-wrap">
              <select
                className="tm-driver-select"
                value={selectedDriverCode}
                onChange={e => setSelectedDriverCode(e.target.value)}
                style={{ color: driver?.color || undefined }}
              >
                {driversList.map(d => (
                  <option key={d.driver} value={d.driver} style={{ color: d.color || undefined }}>{d.driver} — {d.team}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        

        

        {/* Telemetry metrics as individual cards */}
        {telemetry && (
          <div className="tm-telemetry-wrap" style={{ ['--driver-color' as any]: driver?.color || '#3a17ff' }}>
            <div className="tm-metrics-row">
              <div className="tm-metric-card">
                <div className="tm-metric-label">Time</div>
                <div className="tm-metric-value">{formatTime(telemetry.time?.[currentIndex] ?? 0)}</div>
              </div>

              <div className="tm-metric-card">
                <div className="tm-metric-label">Distance</div>
                <div className="tm-metric-value">{formatKm(telemetry.distance?.[currentIndex])}</div>
              </div>
            </div>
            <div className="tm-metrics-row">
              <div className="tm-metric-card">
                <div className="tm-metric-label">Speed</div>
                <div className="tm-metric-value">{String(roundDisplay(telemetry.speed?.[currentIndex]))} km/h</div>
              </div>

              <div className="tm-metric-card">
                <div className="tm-metric-label">RPM</div>
                <div className="tm-metric-value">{String(roundDisplay(telemetry.rpm?.[currentIndex]))}</div>
              </div>

            </div>

            {/* Gear box: fixed width (~two metric cards) with label above and horizontal gear row */}
            <div className="tm-gear-box" style={{ ['--driver-color' as any]: driver?.color || '#3a17ff' }}>
              <div className="tm-gear-box-label">Gear</div>
              <div className="tm-gear-row" role="list" aria-label="Gear selection">
                {['N','1','2','3','4','5','6','7','8'].map(g => {
                  const raw = telemetry.gear?.[currentIndex]
                  let isActive = false
                  if (raw === null || raw === undefined) isActive = false
                  else {
                    const n = Number(raw)
                    if (Number.isFinite(n)) {
                      // treat 0 or negative as Neutral
                      if (g === 'N') isActive = n <= 0
                      else isActive = n === Number(g)
                    } else {
                      // non-numeric (maybe 'N')
                      isActive = String(raw).toUpperCase() === g
                    }
                  }
                  return (
                    <div key={g} className={"tm-gear-item" + (isActive ? ' active' : '')} role="listitem" aria-current={isActive || undefined}>
                      {g}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Moved: Throttle and Brake metrics below the gearbox */}
            <div className="tm-metrics-row" style={{ marginTop: 8 }}>
              <div className="tm-metric-card">
                <div className="tm-metric-label">Brake</div>
                <div>
                  {(() => {
                    const pct = formatPercent(telemetry.brake?.[currentIndex])
                    return (
                      <div className="tm-bar tm-bar-vertical" title={pct !== null ? `${pct}%` : 'n/a'}>
                        <div className="tm-bar-fill-brake" style={{ height: pct !== null ? `${pct}%` : '0%' }} />
                        {pct !== null && <div className="tm-bar-label">{pct}%</div>}
                      </div>
                    )
                  })()}
                </div>
              </div>

              <div className="tm-metric-card">
                <div className="tm-metric-label">Throttle</div>
                <div>
                  {(() => {
                    const pct = formatPercent(telemetry.throttle?.[currentIndex])
                    return (
                      <div className="tm-bar tm-bar-vertical" title={pct !== null ? `${pct}%` : 'n/a'}>
                        <div className="tm-bar-fill-throttle" style={{ height: pct !== null ? `${pct}%` : '0%' }} />
                        {pct !== null && <div className="tm-bar-label">{pct}%</div>}
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>

            {/* <div className="tm-metric-label" style={{ textAlign: 'left' }}>Position (X, Y)</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#2d2c33ab" }}>{String(roundDisplay(telemetry.x?.[currentIndex]))}, {String(roundDisplay(telemetry.y?.[currentIndex]))}</div> */}

          </div>
        )}
        </div>
      </div>
    </div>
  )
}
