"""
FlowGenix — GPS Demo Simulator (v2)
Writes pings DIRECTLY to SQLite — no HTTP calls, no port assumptions.
Works identically on localhost and Railway/any cloud host.
"""

import math
import random
import time
import threading
import uuid
import sqlite3
from datetime import datetime, timezone
from typing import List, Tuple, Dict

# ─── City Seed Locations ──────────────────────────────────────────────────────
CITY_CENTERS: Dict[str, Tuple[float, float]] = {
    "delhi":     (28.6139, 77.2090),   # Connaught Place
    "mumbai":    (18.9220, 72.8347),   # Churchgate
    "bangalore": (12.9716, 77.5946),   # MG Road
    "hyderabad": (17.3850, 78.4867),   # Hussain Sagar
    "pune":      (18.5204, 73.8567),   # FC Road
}

ATTRACTION_OFFSETS = [
    (0.000,  0.000),   # Central market
    (0.003,  0.002),   # Bus stand
    (-0.002, 0.004),   # Shopping mall
    (0.004, -0.003),   # Metro station
    (-0.003, -0.002),  # Food street
]

DB_PATH = "flowgenix.db"


class SimulatedDevice:
    """One simulated pedestrian moving toward attraction points."""

    def __init__(self, device_id: str, center_lat: float, center_lon: float):
        self.device_id = device_id
        self.center_lat = center_lat
        self.center_lon = center_lon

        offset = random.choice(ATTRACTION_OFFSETS)
        self.target_lat = center_lat + offset[0] + random.uniform(-0.001, 0.001)
        self.target_lon = center_lon + offset[1] + random.uniform(-0.001, 0.001)

        spread = 0.008
        self.lat = center_lat + random.uniform(-spread, spread)
        self.lon = center_lon + random.uniform(-spread, spread)

        self.speed = random.uniform(0.00002, 0.00008)
        self.noise = random.uniform(0.00001, 0.00003)
        self.steps_before_new_target = random.randint(20, 60)
        self.step_count = 0

    def step(self) -> dict:
        """Move one step, return ping dict."""
        self.step_count += 1

        if self.step_count >= self.steps_before_new_target:
            offset = random.choice(ATTRACTION_OFFSETS)
            self.target_lat = self.center_lat + offset[0] + random.uniform(-0.001, 0.001)
            self.target_lon = self.center_lon + offset[1] + random.uniform(-0.001, 0.001)
            self.steps_before_new_target = random.randint(15, 50)
            self.step_count = 0

        d_lat = self.target_lat - self.lat
        d_lon = self.target_lon - self.lon
        dist = math.sqrt(d_lat ** 2 + d_lon ** 2)

        if dist > 0:
            self.lat += (d_lat / dist) * self.speed + random.uniform(-self.noise, self.noise)
            self.lon += (d_lon / dist) * self.speed + random.uniform(-self.noise, self.noise)

        return {
            "device_id": self.device_id,
            "lat":       round(self.lat, 7),
            "lon":       round(self.lon, 7),
            "accuracy":  round(random.uniform(3.0, 15.0), 1),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }


class GPSSimulator:
    """
    Manages a fleet of simulated GPS devices.
    Writes directly to SQLite — no HTTP, no port assumptions, works everywhere.
    """

    def __init__(self):
        self.running = False
        self.num_devices = 0
        self.pings_sent = 0
        self._thread: threading.Thread = None
        self._devices: List[SimulatedDevice] = []

    def start(self, city: str = "delhi", num_devices: int = 50):
        if self.running:
            self.stop()

        center = CITY_CENTERS.get(city, CITY_CENTERS["delhi"])
        self.num_devices = num_devices
        self._devices = [
            SimulatedDevice(f"sim-{uuid.uuid4().hex[:8]}", center[0], center[1])
            for _ in range(num_devices)
        ]
        self.pings_sent = 0
        self.running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        print(f"[Simulator] Started {num_devices} devices in {city}")

    def stop(self):
        self.running = False
        if self._thread:
            self._thread.join(timeout=3)
        print("[Simulator] Stopped")

    def _save_ping(self, ping: dict):
        """Write one GPS ping directly to SQLite — no HTTP, works on any host."""
        now = datetime.now(timezone.utc).isoformat()
        try:
            conn = sqlite3.connect(DB_PATH, timeout=5)
            conn.execute(
                "INSERT INTO gps_pings "
                "(device_id, lat, lon, accuracy, timestamp, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (ping["device_id"], ping["lat"], ping["lon"],
                 ping["accuracy"], ping["timestamp"], now)
            )
            conn.commit()
            conn.close()
            self.pings_sent += 1
        except Exception as e:
            print(f"[Simulator] DB write error: {e}")

    def _run_loop(self):
        """Background thread: step all devices and write pings to DB."""
        while self.running:
            batch_start = time.time()

            random.shuffle(self._devices)
            for device in self._devices:
                if not self.running:
                    break
                ping = device.step()
                self._save_ping(ping)
                time.sleep(random.uniform(0.02, 0.08))

            elapsed = time.time() - batch_start
            sleep_time = max(0, 5.0 - elapsed)
            time.sleep(sleep_time)
