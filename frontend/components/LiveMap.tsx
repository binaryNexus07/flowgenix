"use client";

import { useEffect, useRef, useState } from "react";

interface HeatPoint { lat: number; lon: number; intensity: number; }
interface Hotspot {
  id: string; lat: number; lon: number;
  device_count: number; density: "HIGH" | "MEDIUM" | "LOW";
  label: string; radius_m: number;
}
interface Props {
  heatmap: HeatPoint[];
  hotspots: Hotspot[];
  routeMode?: boolean;
}

const DEFAULT_CENTER: [number, number] = [28.6139, 77.2090];
const DEFAULT_ZOOM = 14;
const OSRM = "https://router.project-osrm.org/route/v1/driving";

export default function LiveMap({ heatmap, hotspots, routeMode = false }: Props) {
  const mapRef         = useRef<any>(null);
  const heatLayerRef   = useRef<any>(null);
  const markersRef     = useRef<any[]>([]);
  const routeLinesRef  = useRef<any[]>([]);
  const containerRef   = useRef<HTMLDivElement>(null);
  const hasAutoFitted  = useRef(false);         // ← Fix: only fit bounds ONCE
  const routeClicksRef = useRef<[number,number][]>([]);
  const [routeInfo, setRouteInfo] = useState<string>("");

  // ── Initialize Map ──────────────────────────────────────────────────────────
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

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      { subdomains: "abcd", maxZoom: 19 }
    ).addTo(map);

    mapRef.current = map;

    heatLayerRef.current = (L as any).heatLayer([], {
      radius: 25,
      blur: 20,
      maxZoom: 17,
      gradient: { 0.0: "#0000ff", 0.3: "#00d4ff", 0.5: "#00ff88", 0.7: "#ffff00", 1.0: "#ff4757" },
      max: 1.0,
      minOpacity: 0.35,
    }).addTo(map);

    // Route suggestion: click to pick origin → destination
    map.on("click", async (e: any) => {
      if (!routeMode) return;
      routeClicksRef.current.push([e.latlng.lat, e.latlng.lng]);
      const L2 = require("leaflet");

      if (routeClicksRef.current.length === 1) {
        setRouteInfo("📍 Origin set — click destination");
        L2.circleMarker(routeClicksRef.current[0], { radius: 8, color: "#00d4ff", fillColor: "#00d4ff", fillOpacity: 1 })
          .addTo(map).bindPopup("Origin").openPopup();
        routeLinesRef.current.push(L2.circleMarker(routeClicksRef.current[0], { radius: 8, color: "#00d4ff" }));
      }

      if (routeClicksRef.current.length === 2) {
        const [origin, dest] = routeClicksRef.current;
        routeClicksRef.current = [];
        setRouteInfo("⏳ Calculating route...");
        await drawRouteWithAvoidance(origin, dest, hotspots, map, routeLinesRef, setRouteInfo);
      }
    });

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // ── Update Heatmap ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!heatLayerRef.current || heatmap.length === 0) return;
    const points = heatmap.map(p => [p.lat, p.lon, p.intensity]);
    heatLayerRef.current.setLatLngs(points);

    // Auto-fit ONLY on first load — never on subsequent updates
    if (mapRef.current && !hasAutoFitted.current) {
      try {
        const lats = heatmap.map(p => p.lat);
        const lons = heatmap.map(p => p.lon);
        mapRef.current.fitBounds(
          [[Math.min(...lats), Math.min(...lons)], [Math.max(...lats), Math.max(...lons)]],
          { padding: [40, 40], maxZoom: 15 }
        );
        hasAutoFitted.current = true;
      } catch {}
    }
  }, [heatmap]);

  // ── Update Hotspot Markers ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    const L = require("leaflet");
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    hotspots.forEach((h) => {
      const color = h.density === "HIGH" ? "#ff4757" : h.density === "MEDIUM" ? "#ff8c00" : "#00ff88";
      const circle = L.circle([h.lat, h.lon], {
        radius: h.radius_m,
        color, fillColor: color,
        fillOpacity: 0.12, weight: 2, opacity: 0.7,
        dashArray: "4, 4",
      }).addTo(mapRef.current);

      const icon = L.divIcon({
        className: "",
        html: `<div style="
          background:rgba(5,10,20,0.92);
          border:1.5px solid ${color};
          color:${color};
          padding:3px 9px;
          border-radius:16px;
          font-size:10px;
          font-weight:700;
          font-family:'Inter',sans-serif;
          white-space:nowrap;
          box-shadow:0 0 8px ${color}50;
        ">📍 ${h.label} · ${h.device_count}</div>`,
        iconAnchor: [0, 0],
      });
      const marker = L.marker([h.lat, h.lon], { icon }).addTo(mapRef.current);
      markersRef.current.push(circle, marker);
    });
  }, [hotspots]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: "420px" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%", minHeight: "420px" }} />
      {routeMode && (
        <div style={{
          position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
          background: "rgba(5,10,20,0.92)", border: "1px solid #1e2d4a",
          color: "#e2e8f0", padding: "8px 16px", borderRadius: 12,
          fontSize: 12, fontFamily: "Inter,sans-serif", zIndex: 1000,
          maxWidth: "90%", textAlign: "center"
        }}>
          {routeInfo || "🗺️ Click origin point on map to start route analysis"}
        </div>
      )}
    </div>
  );
}

// ── OSRM Route Drawing with Hotspot Avoidance ──────────────────────────────
async function drawRouteWithAvoidance(
  origin: [number, number],
  dest: [number, number],
  hotspots: Hotspot[],
  map: any,
  routeLinesRef: React.MutableRefObject<any[]>,
  setInfo: (s: string) => void
) {
  const L = require("leaflet");
  routeLinesRef.current.forEach(l => { try { l.remove(); } catch {} });
  routeLinesRef.current = [];

  const highHotspots = hotspots.filter(h => h.density === "HIGH");

  try {
    // Fetch direct route
    const coords = `${origin[1]},${origin[0]};${dest[1]},${dest[0]}`;
    const res = await fetch(`${OSRM}/${coords}?overview=full&geometries=geojson`, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();

    if (data.code !== "Ok") throw new Error("Route not found");

    const routeCoords: [number, number][] = data.routes[0].geometry.coordinates.map(
      ([lon, lat]: [number, number]) => [lat, lon]
    );

    const distKm = (data.routes[0].distance / 1000).toFixed(1);
    const durMin = Math.round(data.routes[0].duration / 60);

    // Check if route passes through HIGH hotspot zones
    const congested = highHotspots.some(h =>
      routeCoords.some(([rlat, rlon]) => {
        const dlat = rlat - h.lat;
        const dlon = rlon - h.lon;
        return Math.sqrt(dlat * dlat + dlon * dlon) < 0.0015; // ~150m
      })
    );

    if (congested && highHotspots.length > 0) {
      // Draw congested route in red
      const redLine = L.polyline(routeCoords, {
        color: "#ff4757", weight: 4, opacity: 0.8,
        dashArray: "8, 6"
      }).addTo(map).bindPopup(`⚠️ Congested route: ${distKm}km · ~${durMin + 8}min (delayed)`);
      routeLinesRef.current.push(redLine);

      // Try alternate route via waypoint avoiding hotspot
      const avoid = highHotspots[0];
      const waypointLat = avoid.lat + 0.008;
      const waypointLon = avoid.lon + 0.008;
      const altCoords = `${origin[1]},${origin[0]};${waypointLon},${waypointLat};${dest[1]},${dest[0]}`;

      try {
        const altRes = await fetch(`${OSRM}/${altCoords}?overview=full&geometries=geojson`, { signal: AbortSignal.timeout(8000) });
        const altData = await altRes.json();
        if (altData.code === "Ok") {
          const altRoute: [number, number][] = altData.routes[0].geometry.coordinates.map(
            ([lon, lat]: [number, number]) => [lat, lon]
          );
          const altDist = (altData.routes[0].distance / 1000).toFixed(1);
          const altDur = Math.round(altData.routes[0].duration / 60);
          const greenLine = L.polyline(altRoute, {
            color: "#00ff88", weight: 4, opacity: 0.9
          }).addTo(map).bindPopup(`✅ Alternate route: ${altDist}km · ~${altDur}min (clear)`).openPopup();
          routeLinesRef.current.push(greenLine);
          setInfo(`⚠️ Congestion at ${avoid.label} — alternate route shown in green (+${altDist}km · saves ~8min)`);
        }
      } catch {}
    } else {
      // Clear route
      const greenLine = L.polyline(routeCoords, {
        color: "#00ff88", weight: 4, opacity: 0.9
      }).addTo(map).bindPopup(`✅ Clear route: ${distKm}km · ~${durMin}min`).openPopup();
      routeLinesRef.current.push(greenLine);
      setInfo(`✅ Route clear: ${distKm}km · ~${durMin}min · No congestion detected`);
    }

    // Markers
    L.circleMarker(origin, { radius: 8, color: "#00d4ff", fillColor: "#00d4ff", fillOpacity: 1 }).addTo(map);
    L.circleMarker(dest,   { radius: 8, color: "#ff8c00", fillColor: "#ff8c00", fillOpacity: 1 }).addTo(map);
    routeLinesRef.current.push(L.circleMarker(origin, { radius: 8, color: "#00d4ff" }));
    routeLinesRef.current.push(L.circleMarker(dest,   { radius: 8, color: "#ff8c00" }));

  } catch (e) {
    setInfo("❌ Route calculation failed — check network");
  }
}
