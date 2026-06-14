"""
FlowGenix — SQLite Database Layer
Async SQLite via aiosqlite for GPS ping storage and retrieval.
"""

import aiosqlite
from datetime import datetime, timezone
from typing import List, Dict

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

CREATE_INDEX = """
CREATE INDEX IF NOT EXISTS idx_created_at ON gps_pings(created_at);
"""


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(CREATE_PINGS_TABLE)
        await db.execute(CREATE_INDEX)
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
    """Return all pings from the last N seconds."""
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
    """Return count of unique devices active in the last N seconds."""
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
    """Delete pings older than keep_seconds to prevent DB bloat."""
    cutoff = datetime.now(timezone.utc).timestamp() - keep_seconds
    cutoff_iso = datetime.fromtimestamp(cutoff, tz=timezone.utc).isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM gps_pings WHERE created_at < ?", (cutoff_iso,))
        await db.commit()
