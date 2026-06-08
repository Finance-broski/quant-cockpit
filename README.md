# Quant Cockpit — Real-Time Trading Dashboard

A real-time monitoring cockpit for a systematic trading operation — live equity, positions,
fills, risk budget, and research status in one polished, sci-fi-styled view.

> Runs on **synthetic demo telemetry** — no real account or secrets. The production version
> wires the same UI to a live trading engine.

## Features
- **Live equity curve** (strategy vs benchmark), day P&L, drawdown, and risk-budget gauges
- **Open positions** + **recent fills** tables; a 24h session timeline with a live market-hours marker
- **Strategy/research panels** — factor sleeve, hypothesis scoreboard, data-pipeline status
- Animated SVG charts and count-up metrics (no heavy charting library), pinned section nav
- Auto-refresh via React Query against a FastAPI backend

## Tech
React 18 · Vite · React Query · a custom CSS design system (Space Grotesk / JetBrains Mono,
cyan-magenta HUD theme) · FastAPI · Python.

## Run it (sample data)
```bash
# 1) backend — synthetic telemetry
pip install fastapi uvicorn
python demo_app.py                # http://localhost:8000

# 2) frontend
cd frontend
npm install
npm run build                     # then open http://localhost:8000  (demo_app serves it)
# — or, for live-reload during dev:  npm run dev   (proxies /api to :8000)
```

*(Add a screenshot here — `docs/cockpit.png` — it's the single highest-impact thing for this repo.)*

---
*Showcase project. If you need a dashboard for your strategy, broker account, or data — live P&L,
screeners, monitoring — this is the kind of thing I build.*
