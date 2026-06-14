"""
FlowGenix — SQLite Database Layer
Async SQLite via aiosqlite for GPS ping storage, retrieval, and density snapshots.
"""

import aiosqlite
from datetime import datetime, timezone
from typing import List, Dict, Optional

DB_PATH = "flowgenix.db"

CREATE_PINGS_TABLE = """
CREATE TABLE IF NOT EXISTS gps_pings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id   TEXT    NOT NULL,
    lat         REAL    NOT NULL,
    lon         REAL    NOT NULL,
    accuracy    REAL    DEFAULT 10.0,
    timestamp   TEXT    NOT NULL,
    created_at  TEXT    NOT NULL
);
"""

CREATE_SNAPSHOTS_TABLE = """
CREATE TABLE IF NOT EXISTS density_snapshots (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_time    TEXT    NOT NULL,
    crowd_score      INTEGER NOT NULL,
    active_devices   INTEGER NOT NULL,
    hotspot_count    INTEGER NOT NULL,
    density_level    TEXT    NOT NULL,
    peak_lat         REAL,
    peak_lon         REAL,
    peak_label       TEXT,
    peak_devices     INTEGER
);
"""

CREATE_INDEX         = "CREATE INDEX IF NOT EXISTS idx_created_at ON gps_pings(created_at);"
CREATE_SNAPSHOT_IDX  = "CREATE INDEX IF NOT EXISTS idx_snapshot_time ON density_snapshots(snapshot_time);"


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(CREATE_PINGS_TABLE)
        await db.execute(CREATE_SNAPSHOTS_TABLE)
        await db.execute(CREATE_INDEX)
        await db.execute(CREATE_SNAPSHOT_IDX)
        await db.commit()
    print("[DB] Initialized SQLite database")


async def save_gps_ping(device_id: str, lat: float, lon: float,
                        accuracy: float, timestamp: str):
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO gps_pings (device_id, lat, lon, accuracy, timestamp, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (device_id, lat, lon, accuracy, timestamp, now)
        )
        await db.commit()


async def get_recent_pings(seconds: int = 120) -> List[Dict]:
    cutoff = datetime.now(timezone.utc).timestamp() - seconds
    cutoff_iso = datetime.fromtimestamp(cutoff, tz=timezone.utc).isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT device_id, lat, lon, accuracy, timestamp, created_at "
            "FROM gps_pings WHERE created_at >= ? ORDER BY created_at DESC LIMIT 2000",
            (cutoff_iso,)
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]


async def get_ping_count(seconds: int = 60) -> int:
    cutoff = datetime.now(timezone.utc).timestamp() - seconds
    cutoff_iso = datetime.fromtimestamp(cutoff, tz=timezone.utc).isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT COUNT(DISTINCT device_id) FROM gps_pings WHERE created_at >= ?",
            (cutoff_iso,)
        ) as cursor:
            row = await cursor.fetchone()
            return row[0] if row else 0


async def cleanup_old_pings(keep_seconds: int = 3600):
    cutoff = datetime.now(timezone.utc).timestamp() - keep_seconds
    cutoff_iso = datetime.fromtimestamp(cutoff, tz=timezone.utc).isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM gps_pings WHERE created_at < ?", (cutoff_iso,))
        await db.commit()


async def save_density_snapshot(crowd_score: int, active_devices: int,
                                 hotspot_count: int, density_level: str,
                                 peak_zone: Optional[Dict] = None):
    """Save a crowd density snapshot for trend analysis."""
    now = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO density_snapshots "
            "(snapshot_time, crowd_score, active_devices, hotspot_count, density_level, "
            " peak_lat, peak_lon, peak_label, peak_devices) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                now, crowd_score, active_devices, hotspot_count, density_level,
                peak_zone.get("lat") if peak_zone else None,
                peak_zone.get("lon") if peak_zone else None,
                peak_zone.get("label") if peak_zone else None,
                peak_zone.get("devices") if peak_zone else None,
            )
        )
        await db.commit()


async def get_snapshot_history(hours: int = 24) -> List[Dict]:
    """Return density snapshots from the last N hours for trend charts."""
    cutoff = datetime.now(timezone.utc).timestamp() - (hours * 3600)
    cutoff_iso = datetime.fromtimestamp(cutoff, tz=timezone.utc).isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM density_snapshots WHERE snapshot_time >= ? "
            "ORDER BY snapshot_time ASC LIMIT 500",
            (cutoff_iso,)
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]
