"""
FlowGenix — GPS Demo Simulator
Simulates realistic pedestrian movement patterns for demo purposes.
Sends GPS pings to the local API, creating crowd build-up effects.
"""

import asyncio
import math
import random
import time
import threading
import uuid
from datetime import datetime, timezone
from typing import List, Tuple, Dict

import httpx

# ─── City Seed Locations ──────────────────────────────────────────────────────
CITY_CENTERS: Dict[str, Tuple[float, float]] = {
    "delhi": (28.6139, 77.2090),       # Connaught Place
    "mumbai": (18.9220, 72.8347),      # Churchgate
    "bangalore": (12.9716, 77.5946),   # MG Road
    "hyderabad": (17.3850, 78.4867),   # Hussain Sagar
    "pune": (18.5204, 73.8567),        # FC Road
    "custom": (28.6139, 77.2090),
}

# Simulated attraction points (relative offset from center in degrees)
ATTRACTION_OFFSETS = [
    (0.000, 0.000),    # Central market
    (0.003, 0.002),    # Bus stand
    (-0.002, 0.004),   # Shopping mall
    (0.004, -0.003),   # Metro station
    (-0.003, -0.002),  # Food street
]


class SimulatedDevice:
    """Represents a single simulated pedestrian device."""

    def __init__(self, device_id: str, center_lat: float, center_lon: float):
        self.device_id = device_id
        self.center_lat = center_lat
        self.center_lon = center_lon

        # Pick an attraction point to move toward
        offset = random.choice(ATTRACTION_OFFSETS)
        self.target_lat = center_lat + offset[0] + random.uniform(-0.001, 0.001)
        self.target_lon = center_lon + offset[1] + random.uniform(-0.001, 0.001)

        # Start at a random position around center
        spread = 0.008
        self.lat = center_lat + random.uniform(-spread, spread)
        self.lon = center_lon + random.uniform(-spread, spread)

        # Walking speed (degrees per step ~5-10 km/h pedestrian)
        self.speed = random.uniform(0.00002, 0.00008)
        self.noise = random.uniform(0.00001, 0.00003)
        self.steps_before_new_target = random.randint(20, 60)
        self.step_count = 0

    def step(self):
        """Move one step toward current target with some random noise."""
        self.step_count += 1

        # Pick a new target occasionally
        if self.step_count >= self.steps_before_new_target:
            offset = random.choice(ATTRACTION_OFFSETS)
            self.target_lat = self.center_lat + offset[0] + random.uniform(-0.001, 0.001)
            self.target_lon = self.center_lon + offset[1] + random.uniform(-0.001, 0.001)
            self.steps_before_new_target = random.randint(15, 50)
            self.step_count = 0

        # Move toward target
        d_lat = self.target_lat - self.lat
        d_lon = self.target_lon - self.lon
        dist = math.sqrt(d_lat**2 + d_lon**2)

        if dist > 0:
            self.lat += (d_lat / dist) * self.speed + random.uniform(-self.noise, self.noise)
            self.lon += (d_lon / dist) * self.speed + random.uniform(-self.noise, self.noise)

        return {
            "device_id": self.device_id,
            "lat": round(self.lat, 7),
            "lon": round(self.lon, 7),
            "accuracy": round(random.uniform(3.0, 15.0), 1),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }


class GPSSimulator:
    """Manages a fleet of simulated GPS devices."""

    def __init__(self, api_url: str = "http://localhost:8000"):
        self.api_url = api_url
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

    def _run_loop(self):
        """Background thread: move all devices and send pings."""
        with httpx.Client(timeout=5.0) as client:
            while self.running:
                batch_start = time.time()

                # Stagger device pings across the interval
                random.shuffle(self._devices)
                for device in self._devices:
                    if not self.running:
                        break
                    ping = device.step()
                    try:
                        client.post(f"{self.api_url}/api/gps", json=ping)
                        self.pings_sent += 1
                    except Exception:
                        pass
                    time.sleep(random.uniform(0.02, 0.08))  # Spread pings

                elapsed = time.time() - batch_start
                sleep_time = max(0, 5.0 - elapsed)  # Target ~5s per cycle
                time.sleep(sleep_time)
