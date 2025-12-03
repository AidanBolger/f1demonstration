const fs = require('fs')
const path = require('path')

function project(lon, lat) {
  // Web Mercator projection (EPSG:3857)
  const R = 6378137.0
  const x = R * (lon * Math.PI / 180)
  const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2))
  return { x, y }
}

function unproject(x, y) {
  const R = 6378137.0
  const lon = (x / R) * 180 / Math.PI
  const lat = (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180 / Math.PI
  return { lon, lat }
}

function nearestPointOnPolylineMeters(pt, poly) {
  let best = null
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i]
    const b = poly[i + 1]
    const vx = b.x - a.x
    const vy = b.y - a.y
    const wx = pt.x - a.x
    const wy = pt.y - a.y
    const vLen2 = vx * vx + vy * vy
    let t = vLen2 === 0 ? 0 : (vx * wx + vy * wy) / vLen2
    t = Math.max(0, Math.min(1, t))
    const projX = a.x + t * vx
    const projY = a.y + t * vy
    const dx = projX - pt.x
    const dy = projY - pt.y
    const d2 = dx * dx + dy * dy
    if (!best || d2 < best.dist2) best = { x: projX, y: projY, dist2: d2 }
  }
  return best
}

function solveSimilarity(src, dst) {
  const n = Math.min(src.length, dst.length)
  if (n === 0) return { s: 1, cos: 1, sin: 0, tx: 0, ty: 0 }
  let sx = 0, sy = 0, dx = 0, dy = 0
  for (let i = 0; i < n; i++) {
    sx += src[i].x; sy += src[i].y
    dx += dst[i].x; dy += dst[i].y
  }
  const mx = sx / n, my = sy / n
  const mdx = dx / n, mdy = dy / n
  let cReal = 0, cImag = 0, denom = 0
  for (let i = 0; i < n; i++) {
    const xr = src[i].x - mx
    const xi = src[i].y - my
    const yr = dst[i].x - mdx
    const yi = dst[i].y - mdy
    cReal += yr * xr + yi * xi
    cImag += yi * xr - yr * xi
    denom += xr * xr + xi * xi
  }
  if (denom === 0) return { s: 1, cos: 1, sin: 0, tx: mdx - mx, ty: mdy - my }
  const mag = Math.hypot(cReal, cImag)
  const s = mag / denom
  const angle = Math.atan2(cImag, cReal)
  const cos = Math.cos(angle), sin = Math.sin(angle)
  const tx = mdx - s * (cos * mx - sin * my)
  const ty = mdy - s * (sin * mx + cos * my)
  return { s, cos, sin, tx, ty, angle }
}

function compute() {
  const repoRoot = path.resolve(__dirname, '..')
  const cornersPath = path.join(repoRoot, 'src', 'corners.json')
  const geoPath = path.join(repoRoot, 'src', 'data', 'ca-1978.json')
  if (!fs.existsSync(cornersPath)) throw new Error('corners.json not found: ' + cornersPath)
  if (!fs.existsSync(geoPath)) throw new Error('geojson not found: ' + geoPath)
  const corners = JSON.parse(fs.readFileSync(cornersPath, 'utf8'))
  const geo = JSON.parse(fs.readFileSync(geoPath, 'utf8'))
  const X = corners.X || []
  const Y = corners.Y || []
  const cornerPoints = []
  for (let i = 0; i < Math.min(X.length, Y.length); i++) cornerPoints.push({ x: X[i], y: Y[i], idx: i, num: (corners.CornerNumber||[])[i] })

  const coords = geo.features[0].geometry.coordinates
  const geoProj = coords.map(c => project(c[0], c[1]))

  // seed transform via bbox linear map
  const projXs = geoProj.map(p => p.x)
  const projYs = geoProj.map(p => p.y)
  const minPX = Math.min(...projXs), maxPX = Math.max(...projXs)
  const minPY = Math.min(...projYs), maxPY = Math.max(...projYs)
  const xs = cornerPoints.map(p => p.x)
  const ys = cornerPoints.map(p => p.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const seedSx = (maxPX - minPX) / (maxX - minX || 1)
  const seedSy = (maxPY - minPY) / (maxY - minY || 1)
  const seedS = (seedSx + seedSy) / 2
  let transform = { s: seedS || 1, cos: 1, sin: 0, tx: minPX - (seedS * minX), ty: minPY - (seedS * minY) }

  let prevError = Infinity
  for (let iter = 0; iter < 20; iter++) {
    const mappedNow = cornerPoints.map(cp => {
      const x = cp.x, y = cp.y
      const mx = transform.s * (transform.cos * x - transform.sin * y) + transform.tx
      const my = transform.s * (transform.sin * x + transform.cos * y) + transform.ty
      return { x: mx, y: my, idx: cp.idx }
    })
    const matches = []
    let totalDist2 = 0
    for (let i = 0; i < cornerPoints.length; i++) {
      const src = cornerPoints[i]
      const mapPt = mappedNow[i]
      const nearest = nearestPointOnPolylineMeters(mapPt, geoProj)
      matches.push({ src: { x: src.x, y: src.y }, dst: { x: nearest.x, y: nearest.y } })
      totalDist2 += nearest.dist2
    }
    const meanError = totalDist2 / cornerPoints.length
    const sol = solveSimilarity(matches.map(m => m.src), matches.map(m => m.dst))
    transform = sol
    if (Math.abs(prevError - meanError) < 1e-6) break
    prevError = meanError
  }

  // write out transform and metadata
  const out = {
    created_at: new Date().toISOString(),
    transform: transform,
    corners_count: cornerPoints.length,
    seedS: seedS,
    notes: 'Similarity transform (s, cos, sin, tx, ty). tx/ty are in EPSG:3857 meters; angle is in radians.'
  }
  const outPath = path.join(repoRoot, 'src', 'data', 'corner_transform.json')
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8')
  console.log('Wrote transform to', outPath)
}

try {
  compute()
} catch (e) {
  console.error(e && e.stack ? e.stack : e)
  process.exit(1)
}
