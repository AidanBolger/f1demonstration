import React from 'react'
import './Navbar.css'

export default function Navbar() {
  return (
    <header className="app-navbar">
      <div className="app-navbar-inner">
        <div className="app-title-block">
          <div className="app-title">F1 Track Telemetry</div>
          <div className="app-sub">Real-time circuit analysis and driver data visualization</div>
        </div>
        {/* Placeholder nav links - replace text/href as needed */}
        <nav className="app-nav-links" aria-label="Primary navigation">
          <a className="app-nav-link" href="https://github.com/TracingInsights/2025" target="_blank">Lap Data</a>
          <a className="app-nav-link" href="https://github.com/bacinger/f1-circuits/tree/master" target="_blank">Track Data</a>
        </nav>
      </div>
    </header>
  )
}
