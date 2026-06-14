"""
FlowGenix Backend — FastAPI Server
Hyperlocal Crowd Density & Traffic Intelligence Platform
"""

import asyncio
import json
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from database import (init_db, save_gps_ping, get_recent_pings,
                       get_ping_count, save_density_snapshot, get_snapshot_history)
from density_engine import compute_heatmap, detect_hotspots, compute_crowd_score
from websocket_manager import ConnectionManager
from simulator import GPSSimulator

# ─── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    asyncio.create_task(broadcast_loop())
    yield

app = FastAPI(
    title="FlowGenix API",
    description="Hyperlocal Crowd Density & Traffic Intelligence Platform",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

manager = ConnectionManager()
simulator = GPSSimulator()

# ─── Background broadcast loop ─────────────────────────────────────────────────
async def broadcast_loop():
    """Push real-time updates to all connected WebSocket clients every 3 seconds.
       Also saves a density snapshot every ~30 seconds for historical trend data.
    """
    broadcast_count = 0
    while True:
        try:
            await asyncio.sleep(3)
            pings = await get_recent_pings(seconds=120)
            if not pings:
                continue
            heatmap  = compute_heatmap(pings)
            hotspots = detect_hotspots(pings)
            count    = await get_ping_count(seconds=60)
            score    = compute_crowd_score(pings)
            level    = "HIGH" if score > 70 else "MEDIUM" if score > 35 else "LOW"
            peak     = hotspots[0] if hotspots else None
            peak_zone = {
                "lat": peak["lat"], "lon": peak["lon"],
                "label": peak["label"], "devices": peak["device_count"]
            } if peak else None

            payload = {
                "type": "density_update",
                "heatmap_points": heatmap,
                "hotspots": hotspots,
                "stats": {
                    "active_devices": count,
                    "hotspot_count": len(hotspots),
                    "crowd_score": score,
                    "density_level": level,
                    "peak_zone": peak_zone,
                    "last_updated": datetime.now(timezone.utc).isoformat()
                }
            }
            await manager.broadcast(json.dumps(payload))

            # Save snapshot every 10 broadcasts (~30 seconds)
            broadcast_count += 1
            if broadcast_count % 10 == 0:
                await save_density_snapshot(score, count, len(hotspots), level, peak_zone)

        except Exception as e:
            print(f"[broadcast] error: {e}")

# ─── GPS Ingestion ──────────────────────────────────────────────────────────────
@app.post("/api/gps")
async def ingest_gps(payload: dict):
    """
    Receive a GPS ping from a device.
    Body: { device_id, lat, lon, accuracy, timestamp }
    """
    try:
        device_id = payload.get("device_id", "unknown")
        lat = float(payload["lat"])
        lon = float(payload["lon"])
        accuracy = float(payload.get("accuracy", 10.0))
        ts = payload.get("timestamp", datetime.now(timezone.utc).isoformat())

        # Basic validation
        if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
            return JSONResponse({"error": "Invalid coordinates"}, status_code=400)

        await save_gps_ping(device_id, lat, lon, accuracy, ts)

        # Quick density for this zone
        pings = await get_recent_pings(seconds=120)
        score = compute_crowd_score(pings)
        level = "HIGH" if score > 70 else "MEDIUM" if score > 35 else "LOW"

        return {
            "status": "received",
            "zone_density": level,
            "crowd_score": score,
            "active_devices": len(set(p["device_id"] for p in pings))
        }
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# ─── Heatmap ──────────────────────────────────────────────────────────────────
@app.get("/api/heatmap")
async def get_heatmap(
    lat: Optional[float] = Query(None),
    lon: Optional[float] = Query(None),
    radius: int = Query(5000)
):
    """Return KDE heatmap points for the last 2 minutes of pings."""
    pings = await get_recent_pings(seconds=120)
    heatmap = compute_heatmap(pings)
    return {
        "heatmap_points": heatmap,
        "point_count": len(heatmap),
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


# ─── Stats ────────────────────────────────────────────────────────────────────
@app.get("/api/stats")
async def get_stats():
    """Return real-time crowd statistics."""
    pings = await get_recent_pings(seconds=120)
    hotspots = detect_hotspots(pings)
    count = await get_ping_count(seconds=60)
    score = compute_crowd_score(pings)

    peak = None
    if hotspots:
        peak = {
            "lat": hotspots[0]["lat"],
            "lon": hotspots[0]["lon"],
            "label": hotspots[0].get("label", "Zone Alpha"),
            "devices": hotspots[0]["device_count"]
        }

    return {
        "active_devices": count,
        "hotspot_count": len(hotspots),
        "crowd_score": score,
        "density_level": "HIGH" if score > 70 else "MEDIUM" if score > 35 else "LOW",
        "peak_zone": peak,
        "last_updated": datetime.now(timezone.utc).isoformat()
    }


# ─── Hotspots ─────────────────────────────────────────────────────────────────
@app.get("/api/hotspots")
async def get_hotspots():
    """Return detected crowd hotspots."""
    pings = await get_recent_pings(seconds=120)
    hotspots = detect_hotspots(pings)
    return {"hotspots": hotspots, "count": len(hotspots)}


# ─── Demo Control ─────────────────────────────────────────────────────────────
@app.post("/api/demo/start")
async def demo_start(payload: dict = {}):
    """Start the GPS demo simulator."""
    city = payload.get("city", "delhi")
    devices = payload.get("devices", 50)
    simulator.start(city=city, num_devices=devices)
    return {"status": "started", "simulated_devices": devices, "city": city}


@app.post("/api/demo/stop")
async def demo_stop():
    """Stop the GPS demo simulator."""
    simulator.stop()
    return {"status": "stopped"}


@app.get("/api/demo/status")
async def demo_status():
    """Check demo simulator status."""
    return {
        "running": simulator.running,
        "simulated_devices": simulator.num_devices,
        "pings_sent": simulator.pings_sent
    }


# ─── Historical Data ─────────────────────────────────────────────────────────
@app.get("/api/history")
async def get_history(hours: int = Query(default=24, le=168)):
    """Return density snapshots for trend analysis. Default: last 24h, max 7 days."""
    snapshots = await get_snapshot_history(hours=hours)
    return {"snapshots": snapshots, "count": len(snapshots), "hours": hours}


# ─── Health ───────────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "FlowGenix API", "version": "2.0.0"}


# ─── WebSocket ────────────────────────────────────────────────────────────────
@app.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        pings    = await get_recent_pings(seconds=120)
        heatmap  = compute_heatmap(pings)
        hotspots = detect_hotspots(pings)
        count    = await get_ping_count(seconds=60)
        score    = compute_crowd_score(pings)
        level    = "HIGH" if score > 70 else "MEDIUM" if score > 35 else "LOW"
        peak     = hotspots[0] if hotspots else None
        await websocket.send_text(json.dumps({
            "type": "density_update",
            "heatmap_points": heatmap,
            "hotspots": hotspots,
            "stats": {
                "active_devices": count,
                "hotspot_count": len(hotspots),
                "crowd_score": score,
                "density_level": level,
                "peak_zone": {"lat": peak["lat"], "lon": peak["lon"],
                              "label": peak["label"], "devices": peak["device_count"]} if peak else None,
                "last_updated": datetime.now(timezone.utc).isoformat()
            }
        }))
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)



if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
