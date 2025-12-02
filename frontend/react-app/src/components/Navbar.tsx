import React from 'react'
import './Navbar.css'

export default function Navbar() {
  return (
    <header className="app-navbar">
      <div className="app-navbar-inner">
        <div className="app-title">F1 Track Telemetry</div>
        <div className="app-sub">Real-time circuit analysis and driver data visualization</div>
      </div>
    </header>
  )
}
