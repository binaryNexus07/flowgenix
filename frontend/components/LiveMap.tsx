"use client";

import { useEffect, useRef } from "react";

interface HeatPoint { lat: number; lon: number; intensity: number; }
interface Hotspot {
  id: string; lat: number; lon: number;
  device_count: number; density: "HIGH" | "MEDIUM" | "LOW";
  label: string; radius_m: number;
}

interface Props {
  heatmap: HeatPoint[];
  hotspots: Hotspot[];
}

// Default center: Connaught Place, Delhi
const DEFAULT_CENTER: [number, number] = [28.6139, 77.2090];
const DEFAULT_ZOOM = 13;

export default function LiveMap({ heatmap, hotspots }: Props) {
  const mapRef       = useRef<any>(null);
  const heatLayerRef = useRef<any>(null);
  const markersRef   = useRef<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Initialize Map ──────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined" || mapRef.current) return;

    const L = require("leaflet");
    require("leaflet/dist/leaflet.css");
    require("leaflet.heat");

    const map = L.map(containerRef.current!, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      attributionControl: false,
    });

    // Dark tile layer
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      { subdomains: "abcd", maxZoom: 19 }
    ).addTo(map);

    // Attribution (small)
    L.control.attribution({ prefix: false }).addTo(map);

    mapRef.current = map;

    // Init empty heat layer
    heatLayerRef.current = (L as any).heatLayer([], {
      radius: 30,
      blur: 25,
      maxZoom: 17,
      gradient: { 0.0: "#0000ff", 0.3: "#00ffff", 0.5: "#00ff00", 0.7: "#ffff00", 1.0: "#ff0000" },
      max: 1.0,
      minOpacity: 0.3,
    }).addTo(map);

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // ── Update Heatmap ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!heatLayerRef.current || heatmap.length === 0) return;
    const points = heatmap.map(p => [p.lat, p.lon, p.intensity]);
    heatLayerRef.current.setLatLngs(points);

    // Auto-fit map to data bounds
    if (mapRef.current && heatmap.length > 0) {
      try {
        const lats = heatmap.map(p => p.lat);
        const lons = heatmap.map(p => p.lon);
        const bounds = [
          [Math.min(...lats), Math.min(...lons)],
          [Math.max(...lats), Math.max(...lons)],
        ];
        mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      } catch {}
    }
  }, [heatmap]);

  // ── Update Hotspot Markers ───────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    const L = require("leaflet");

    // Remove old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    hotspots.forEach((h) => {
      const color = h.density === "HIGH" ? "#ff4757" : h.density === "MEDIUM" ? "#ff8c00" : "#00ff88";

      // Pulsing circle
      const circle = L.circle([h.lat, h.lon], {
        radius: h.radius_m,
        color: color,
        fillColor: color,
        fillOpacity: 0.08,
        weight: 2,
        opacity: 0.6,
        dashArray: "5, 5",
      }).addTo(mapRef.current);

      // Label marker
      const icon = L.divIcon({
        className: "",
        html: `
          <div style="
            background: rgba(5,10,20,0.9);
            border: 1.5px solid ${color};
            color: ${color};
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 700;
            font-family: 'Inter', sans-serif;
            white-space: nowrap;
            box-shadow: 0 0 10px ${color}40;
          ">
            📍 ${h.label} · ${h.device_count} devices
          </div>`,
        iconAnchor: [0, 0],
      });
      const marker = L.marker([h.lat, h.lon], { icon }).addTo(mapRef.current);

      markersRef.current.push(circle, marker);
    });
  }, [hotspots]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", minHeight: "420px" }}
    />
  );
}
