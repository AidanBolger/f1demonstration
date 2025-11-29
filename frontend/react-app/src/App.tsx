import React from 'react'
import TrackMap from './components/TrackMap'

// Import corners at build time so Vite bundles the data and the map can render synchronously.
import cornersData from './data/corners.json'
import caGeo from './data/ca-1978.json'

type Corners = {
  CornerNumber: number[]
  X: number[]
  Y: number[]
}

export default function App() {
  const corners: Corners = cornersData as unknown as Corners

  return (
    <div className="app">
      <header style={{ padding: '1rem 2rem' }}>
        <h1>F1 Demonstration — Track Viewer</h1>
      </header>
      <main style={{ padding: 12 }}>
        <p>Displaying track from <code>corners.json</code></p>
  <TrackMap corners={corners} highResGeo={caGeo} />
      </main>
    </div>
  )
}
