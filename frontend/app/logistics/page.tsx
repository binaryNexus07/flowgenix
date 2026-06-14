"use client";
import { useEffect, useState } from "react";
import { Truck, AlertTriangle, CheckCircle, Navigation, Clock, Route } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";

const LiveMap = dynamic(() => import("@/components/LiveMap"), { ssr: false });

function getBackendUrl() {
  if (typeof window === "undefined") return "http://localhost:8000";
  return process.env.NEXT_PUBLIC_BACKEND_URL || `http://${window.location.hostname}:8000`;
}

interface Hotspot {
  id: string; lat: number; lon: number;
  device_count: number; ping_count: number;
  density: "HIGH" | "MEDIUM" | "LOW"; label: string; radius_m: number;
}
interface HeatPoint { lat: number; lon: number; intensity: number; }

export default function LogisticsPage() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [heatmap,  setHeatmap]  = useState<HeatPoint[]>([]);
  const [routeMode, setRouteMode] = useState(false);
  const BACKEND = getBackendUrl();

  useEffect(() => {
    const load = async () => {
      try {
        const [h, hm] = await Promise.all([
          fetch(`${BACKEND}/api/hotspots`).then(r => r.json()),
          fetch(`${BACKEND}/api/heatmap`).then(r => r.json()),
        ]);
        setHotspots(h.hotspots || []);
        setHeatmap(hm.heatmap_points || []);
      } catch {}
    };
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, []);

  const blockedZones = hotspots.filter(h => h.density === "HIGH");
  const cautionZones = hotspots.filter(h => h.density === "MEDIUM");
  const clearZones   = hotspots.filter(h => h.density === "LOW");

  return (
    <div className="min-h-screen" style={{ background: "#050a14", color: "#e2e8f0", fontFamily: "Inter,sans-serif" }}>
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d4a] sticky top-0 z-50 backdrop-blur-sm" style={{ background: "rgba(5,10,20,0.92)" }}>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-[#00d4ff] text-sm hover:underline">← Dashboard</Link>
          <div className="w-px h-4 bg-[#1e2d4a]" />
          <div className="flex items-center gap-2">
            <Truck size={16} className="text-[#00d4ff]" />
            <span className="font-bold text-lg">Logistics Intelligence</span>
          </div>
        </div>
        <button onClick={() => setRouteMode(!routeMode)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
            routeMode
              ? "bg-[#00d4ff]/20 text-[#00d4ff] border-[#00d4ff]/50"
              : "bg-[#0d1526] text-slate-300 border-[#1e2d4a] hover:border-[#00d4ff]/40"
          }`}>
          <Route size={14} /> {routeMode ? "Route Mode ON — click map" : "Enable Route Analysis"}
        </button>
      </header>

      <div className="p-6 grid grid-cols-12 gap-5 max-w-7xl mx-auto">
        {/* LEFT: Zone intelligence */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          {/* Status tiles */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Blocked Zones", value: blockedZones.length, color: "text-red-400", bg: "border-red-500/20 bg-red-500/5" },
              { label: "Caution", value: cautionZones.length, color: "text-orange-400", bg: "border-orange-500/20 bg-orange-500/5" },
              { label: "Clear Routes", value: clearZones.length + 3, color: "text-green-400", bg: "border-green-500/20 bg-green-500/5" },
            ].map((s, i) => (
              <div key={i} className={`rounded-xl border p-3 text-center ${s.bg}`}>
                <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                <div className="text-[10px] text-slate-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* HIGH — Avoid list */}
          <div className="rounded-xl border border-red-500/20 bg-[#0d1526] p-4">
            <div className="text-[10px] text-red-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <AlertTriangle size={10} /> Avoid Zones — HIGH Congestion
            </div>
            {blockedZones.length === 0 ? (
              <p className="text-xs text-slate-500">No high-congestion zones active</p>
            ) : blockedZones.map((h, i) => (
              <div key={h.id} className="flex items-center justify-between py-2 border-b border-[#1e2d4a] last:border-0">
                <div>
                  <div className="text-sm font-semibold text-red-300">{h.label}</div>
                  <div className="text-[10px] text-slate-500">{h.device_count} devices · {h.radius_m}m radius</div>
                </div>
                <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">AVOID</span>
              </div>
            ))}
          </div>

          {/* Delivery recommendations */}
          <div className="rounded-xl border border-[#1e2d4a] bg-[#0d1526] p-4">
            <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Clock size={10} /> Delivery Window Recommendations
            </div>
            {[
              { time: "06:00 – 08:00", label: "Optimal — low pedestrian density", color: "text-green-400" },
              { time: "10:00 – 12:00", label: blockedZones.length > 0 ? "Avoid central zones" : "Clear — standard window", color: blockedZones.length > 0 ? "text-orange-400" : "text-green-400" },
              { time: "12:00 – 15:00", label: "Peak lunch congestion", color: "text-red-400" },
              { time: "20:00 – 22:00", label: "Optimal — evening clear", color: "text-green-400" },
            ].map((w, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-[#0a1020] last:border-0">
                <div className={`text-xs font-mono font-bold ${w.color} whitespace-nowrap pt-0.5`}>{w.time}</div>
                <div className={`text-xs ${w.color}`}>{w.label}</div>
              </div>
            ))}
          </div>

          {/* Route mode instructions */}
          <div className="rounded-xl border border-[#00d4ff]/20 bg-[#0d1526] p-4">
            <div className="text-[10px] text-[#00d4ff] uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Navigation size={10} /> Route Analysis — How to use
            </div>
            <ol className="text-xs text-slate-400 space-y-1.5 list-decimal pl-4">
              <li>Click <span className="text-[#00d4ff] font-semibold">"Enable Route Analysis"</span> button above</li>
              <li>Click your <span className="text-green-400">origin point</span> on the map</li>
              <li>Click your <span className="text-orange-400">destination point</span></li>
              <li>System checks if route crosses HIGH hotspot zones</li>
              <li>Green line = clear, Red+Green = alternate suggested</li>
            </ol>
          </div>
        </div>

        {/* RIGHT: Map */}
        <div className="col-span-12 lg:col-span-8">
          <div className="rounded-xl border border-[#1e2d4a] overflow-hidden" style={{ height: "580px" }}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1e2d4a] bg-[#0d1526]">
              <div className="flex items-center gap-2">
                <Truck size={13} className="text-[#00d4ff]" />
                <span className="text-sm font-semibold">Live Congestion Map</span>
                {routeMode && <span className="text-xs bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/30 px-2 py-0.5 rounded-full">Route Mode Active</span>}
              </div>
              <div className="flex items-center gap-3 text-[10px] text-slate-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Blocked</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> Caution</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Clear</span>
              </div>
            </div>
            <div style={{ height: "calc(100% - 44px)" }}>
              <LiveMap heatmap={heatmap} hotspots={hotspots} routeMode={routeMode} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
