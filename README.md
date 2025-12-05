# F1 Track Telemetry
Deployed app - https://aidanbolger.github.io/f1TrackTelemetry/

F1 Track Telemetry is a compact demo web app that visualizes per-lap Formula 1 telemetry alongside a high-resolution track preview. It combines a Leaflet map view of the circuit (GeoJSON) with per-sample telemetry playback (speed, throttle, brake, RPM, gear) and lightweight SVG-based analysis panels for quick visual inspection.

Core goals:
- Demonstrate mapping planar telemetry to Web Mercator for overlay on a GeoJSON track.
- Provide a responsive playback UI with small, focusable telemetry cards and compact SVG charts.
- Keep dependencies minimal while maintaining interactive, accessible UI controls.

Tech stack: React + TypeScript, Vite, Leaflet, plain CSS and handcrafted SVG components.

Where to find things:
- App: `frontend/react-app/src` (main UI and components)
- Track GeoJSON: `frontend/react-app/src/data/ca-1978.geojson`
- Per-lap telemetry: `frontend/react-app/src/data/laps/*.json`

Data sources

- Track GeoJSON: (https://github.com/bacinger/f1-circuits/tree/master)
- Telemetry laps: (https://github.com/TracingInsights/2025) — includes sample laps such as `HAM.json`, `PIA.json`, and `VER.json`.

If you want these to point to original external sources (for example an OpenStreetMap extract, official timing data, or a published telemetry dataset), tell me the URLs and I will add them here with proper attribution. If you prefer, I can also add brief notes about licensing for each external source.

If you'd like this description expanded into a short README section (usage, build, deploy), or prefer a single-line tagline for the project header, tell me the tone (concise, technical, or marketing) and I'll update it.
# F1TrackTelemetry

This repository contains the F1TrackTelemetry React app (Vite + React + TypeScript).

Quick commands:

```powershell
npm install
npm run dev
```

Build:

```powershell
npm run build
npm run preview
```

