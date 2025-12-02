import React from 'react'
import TrackMap from './components/TrackMap'
import Navbar from './components/Navbar'

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
      <Navbar />
      <main className="app-main">
        <TrackMap corners={corners} highResGeo={caGeo} />
      </main>
    </div>
  )
}
