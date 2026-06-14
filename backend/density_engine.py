"""
FlowGenix — ML Density Engine
Computes crowd density heatmaps and detects hotspots from raw GPS pings.

Algorithms:
  - Kernel Density Estimation (KDE) via scipy for smooth heatmap generation
  - DBSCAN clustering via scikit-learn for hotspot detection
  - H3 hexagonal aggregation for spatial binning
"""

import math
from typing import List, Dict, Any
import numpy as np

try:
    from scipy.stats import gaussian_kde
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False

try:
    from sklearn.cluster import DBSCAN
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

try:
    import h3
    H3_AVAILABLE = True
except ImportError:
    H3_AVAILABLE = False

# ─── Constants ────────────────────────────────────────────────────────────────
H3_RESOLUTION = 9       # ~0.1 km² hexagons
KDE_GRID_SIZE = 40      # grid resolution for KDE heatmap
DBSCAN_EPS_KM = 0.15    # 150m radius for hotspot clustering
DBSCAN_MIN_SAMPLES = 3  # minimum 3 pings to form a cluster
KM_PER_LAT_DEG = 111.32

# ─── Heatmap Generation ───────────────────────────────────────────────────────
def compute_heatmap(pings: List[Dict]) -> List[Dict]:
    """
    Given a list of GPS pings, compute a KDE heatmap.
    Returns a list of {lat, lon, intensity} points.
    """
    if not pings or len(pings) < 2:
        return []

    lats = np.array([p["lat"] for p in pings])
    lons = np.array([p["lon"] for p in pings])

    if SCIPY_AVAILABLE and len(pings) >= 5:
        return _kde_heatmap(lats, lons)
    else:
        return _grid_heatmap(lats, lons)


def _kde_heatmap(lats: np.ndarray, lons: np.ndarray) -> List[Dict]:
    """Full KDE heatmap using scipy gaussian_kde."""
    try:
        lat_min, lat_max = lats.min(), lats.max()
        lon_min, lon_max = lons.min(), lons.max()

        # Add padding
        lat_pad = max((lat_max - lat_min) * 0.1, 0.005)
        lon_pad = max((lon_max - lon_min) * 0.1, 0.005)

        lat_grid = np.linspace(lat_min - lat_pad, lat_max + lat_pad, KDE_GRID_SIZE)
        lon_grid = np.linspace(lon_min - lon_pad, lon_max + lon_pad, KDE_GRID_SIZE)

        grid_lats, grid_lons = np.meshgrid(lat_grid, lon_grid)
        positions = np.vstack([grid_lats.ravel(), grid_lons.ravel()])

        data = np.vstack([lats, lons])
        kde = gaussian_kde(data, bw_method=0.15)
        density = kde(positions).reshape(grid_lats.shape)

        # Normalize to 0–1
        d_min, d_max = density.min(), density.max()
        if d_max > d_min:
            density = (density - d_min) / (d_max - d_min)

        points = []
        threshold = 0.05
        for i in range(KDE_GRID_SIZE):
            for j in range(KDE_GRID_SIZE):
                intensity = float(density[i, j])
                if intensity >= threshold:
                    points.append({
                        "lat": float(lat_grid[j]),
                        "lon": float(lon_grid[i]),
                        "intensity": round(intensity, 4)
                    })
        return points
    except Exception as e:
        print(f"[KDE] fallback to grid: {e}")
        return _grid_heatmap(lats, lons)


def _grid_heatmap(lats: np.ndarray, lons: np.ndarray) -> List[Dict]:
    """Simple grid-based heatmap fallback."""
    if len(lats) == 0:
        return []

    lat_min, lat_max = lats.min() - 0.005, lats.max() + 0.005
    lon_min, lon_max = lons.min() - 0.005, lons.max() + 0.005

    grid: Dict[tuple, int] = {}
    for lat, lon in zip(lats, lons):
        cell_lat = round(lat * 200) / 200  # ~55m cells
        cell_lon = round(lon * 200) / 200
        grid[(cell_lat, cell_lon)] = grid.get((cell_lat, cell_lon), 0) + 1

    max_count = max(grid.values()) if grid else 1
    return [
        {"lat": k[0], "lon": k[1], "intensity": round(v / max_count, 4)}
        for k, v in grid.items()
    ]


# ─── Hotspot Detection ────────────────────────────────────────────────────────
def detect_hotspots(pings: List[Dict]) -> List[Dict]:
    """
    Use DBSCAN to find crowd hotspots (dense clusters of GPS pings).
    Returns list of hotspot dicts with location, device count, and severity.
    """
    if not pings or len(pings) < DBSCAN_MIN_SAMPLES:
        return []

    lats = np.array([p["lat"] for p in pings])
    lons = np.array([p["lon"] for p in pings])

    # Convert to km for DBSCAN
    avg_lat = np.mean(lats)
    km_per_lon = KM_PER_LAT_DEG * math.cos(math.radians(avg_lat))

    coords_km = np.column_stack([
        lats * KM_PER_LAT_DEG,
        lons * km_per_lon
    ])

    if SKLEARN_AVAILABLE:
        labels = DBSCAN(
            eps=DBSCAN_EPS_KM,
            min_samples=DBSCAN_MIN_SAMPLES,
            metric="euclidean"
        ).fit_predict(coords_km)
    else:
        # Simple radius-based fallback
        labels = _simple_cluster(coords_km)

    hotspots = []
    unique_labels = set(labels)
    unique_labels.discard(-1)  # -1 = noise

    for label in unique_labels:
        mask = labels == label
        cluster_pings = [pings[i] for i in range(len(pings)) if mask[i]]
        cluster_lats = lats[mask]
        cluster_lons = lons[mask]

        center_lat = float(np.mean(cluster_lats))
        center_lon = float(np.mean(cluster_lons))
        unique_devices = len(set(p["device_id"] for p in cluster_pings))
        ping_count = len(cluster_pings)

        density = "HIGH" if unique_devices >= 10 else "MEDIUM" if unique_devices >= 4 else "LOW"

        hotspots.append({
            "id": f"hotspot_{label}",
            "lat": round(center_lat, 6),
            "lon": round(center_lon, 6),
            "device_count": unique_devices,
            "ping_count": ping_count,
            "density": density,
            "radius_m": int(DBSCAN_EPS_KM * 1000),
            "label": _zone_label(label)
        })

    # Sort by device count desc
    hotspots.sort(key=lambda x: x["device_count"], reverse=True)
    return hotspots[:10]  # max 10 hotspots


def _simple_cluster(coords: np.ndarray) -> np.ndarray:
    """Fallback clustering without scikit-learn."""
    labels = np.full(len(coords), -1, dtype=int)
    cluster_id = 0
    for i, c in enumerate(coords):
        if labels[i] != -1:
            continue
        distances = np.linalg.norm(coords - c, axis=1)
        neighbors = np.where(distances <= DBSCAN_EPS_KM)[0]
        if len(neighbors) >= DBSCAN_MIN_SAMPLES:
            labels[neighbors] = cluster_id
            cluster_id += 1
    return labels


def _zone_label(cluster_id: int) -> str:
    labels = [
        "Zone Alpha", "Zone Beta", "Zone Gamma", "Zone Delta",
        "Zone Epsilon", "Zone Zeta", "Zone Eta", "Zone Theta",
        "Central Hub", "Market Area"
    ]
    return labels[cluster_id % len(labels)]


# ─── Crowd Score ──────────────────────────────────────────────────────────────
def compute_crowd_score(pings: List[Dict]) -> int:
    """
    Compute a 0–100 crowd score from the ping data.
    Based on device count density and clustering.
    """
    if not pings:
        return 0

    unique_devices = len(set(p["device_id"] for p in pings))
    hotspots = detect_hotspots(pings)
    high_hotspots = sum(1 for h in hotspots if h["density"] == "HIGH")

    # Device density score (0–60)
    device_score = min(unique_devices * 1.5, 60)

    # Hotspot intensity score (0–40)
    hotspot_score = min(high_hotspots * 15 + len(hotspots) * 5, 40)

    total = int(device_score + hotspot_score)
    return min(total, 100)
