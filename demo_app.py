"""Quant Cockpit — DEMO backend. Serves SYNTHETIC telemetry only (no real account, no secrets).

Run:
    pip install fastapi uvicorn
    python demo_app.py            # serves API + built frontend on http://localhost:8000
"""
import datetime as dt
import os
import random

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

app = FastAPI(title="Quant Cockpit (demo)")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def _series(start, n, drift, vol, seed):
    random.seed(seed)
    v = float(start)
    t0 = dt.datetime.utcnow() - dt.timedelta(minutes=15 * n)
    out = []
    for i in range(n):
        v *= (1 + drift + random.gauss(0, vol))
        out.append({"t": (t0 + dt.timedelta(minutes=15 * i)).isoformat() + "Z", "v": round(v, 2)})
    return out


@app.get("/api/v1/cockpit/prop")
def prop():
    live = _series(5000, 120, 0.00010, 0.0020, 1)
    shadow = _series(5000, 120, 0.00018, 0.0017, 2)
    le, se, ds = live[-1]["v"], shadow[-1]["v"], shadow[0]["v"]
    peak = max(p["v"] for p in shadow)
    return {
        "live_equity": le, "shadow_equity": se, "day_start": ds,
        "day_pnl_shadow": (se - ds) / ds, "day_pnl_live": (le - live[0]["v"]) / live[0]["v"],
        "static_dd_shadow": (se - peak) / peak, "live_vs_shadow": (le - se) / se,
        "last_risk": "ok", "updated": shadow[-1]["t"],
        "positions": [{"symbol": "US500.demo", "shadow": 0.012, "mark": 5031.2},
                      {"symbol": "XAUUSD.demo", "shadow": 0.004, "mark": 2412.6}],
        "fills": [{"utc": shadow[-1]["t"], "symbol": "US500.demo", "delta": "+0.01",
                   "mode": "DEMO", "ref_px": "5030.0", "fill_px": "5030.4", "spread_px": "0.5"}],
        "live_series": live, "shadow_series": shadow,
    }


@app.get("/api/v1/cockpit/research")
def research():
    return {
        "sleeve": {"momentum_h4": {"label": "H4 · 52wk-high mom", "sharpe": 0.95, "t": 3.23, "dd": -0.31},
                   "lowbeta": {"label": "Low-beta", "sharpe": 0.88, "dd": -0.21},
                   "blend": {"label": "Sleeve", "sharpe": 0.97, "dd": -0.22}, "heldout": "sealed"},
        "scoreboard": [{"id": "H1", "status": "pass"}, {"id": "H4", "status": "star"},
                       {"id": "H14", "status": "pass"}, {"id": "H6", "status": "null"},
                       {"id": "H11", "status": "null"}, {"id": "H16", "status": "null"}],
        "pipeline": [{"name": "price panel · 2010–2026", "pct": 100, "color": "grn"},
                     {"name": "PIT universe", "pct": 100, "color": "cyan"},
                     {"name": "fundamentals · XBRL", "pct": 100, "color": "grn"}],
        "note": "demo telemetry · synthetic data",
    }


@app.get("/health")
def health():
    return {"ok": True}


_DIST = os.path.join(os.path.dirname(__file__), "frontend", "dist")


@app.get("/{full_path:path}")
def spa(full_path: str):
    if not os.path.isdir(_DIST):
        return {"msg": "Build the frontend first: cd frontend && npm install && npm run build"}
    cand = os.path.join(_DIST, full_path)
    return FileResponse(cand) if full_path and os.path.isfile(cand) else FileResponse(os.path.join(_DIST, "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
