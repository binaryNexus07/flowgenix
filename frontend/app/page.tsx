"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import {
  Activity, Zap, MapPin, Users, AlertTriangle,
  TrendingUp, Navigation, Shield, Truck, Building2,
  Radio, ChevronRight, Play, Square, RefreshCw, Wifi, WifiOff
} from "lucide-react";

const LiveMap = dynamic(() => import("@/components/LiveMap"), { ssr: false });

interface HeatPoint { lat: number; lon: number; intensity: number; }
interface Hotspot {
  id: string; lat: number; lon: number;
  device_count: number; ping_count: number;
  density: "HIGH" | "MEDIUM" | "LOW";
  label: string; radius_m: number;
}
interface Stats {
  active_devices: number; hotspot_count: number;
  crowd_score: number; density_level: string;
  peak_zone?: { lat: number; lon: number; label: string; devices: number } | null;
  last_updated: string;
}

// Auto-detect backend URL — uses env var in production, hostname-based locally
function getBackendUrl(): string {
  if (typeof window === "undefined") return "http://localhost:8000";
  // In production (Vercel), NEXT_PUBLIC_BACKEND_URL is set
  if (process.env.NEXT_PUBLIC_BACKEND_URL) {
    return process.env.NEXT_PUBLIC_BACKEND_URL;
  }
  // Local dev: auto-detect from window hostname
  const host = window.location.hostname;
  return `http://${host}:8000`;
}

export default function Dashboard() {
  const [heatmap, setHeatmap]     = useState<HeatPoint[]>([]);
  const [hotspots, setHotspots]   = useState<Hotspot[]>([]);
  const [stats, setStats]         = useState<Stats | null>(null);
  const [wsStatus, setWsStatus]   = useState<"connecting" | "live" | "offline">("connecting");
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoCity, setDemoCity]       = useState("delhi");
  const [demoDevices, setDemoDevices] = useState(50);
  const [lastPing, setLastPing]       = useState<string>("");
  const [pingsTotal, setPingsTotal]   = useState(0);
  const wsRef       = useRef<WebSocket | null>(null);
  const reconnectT  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const BACKEND     = useRef<string>("");

  // Init backend URL client-side only
  useEffect(() => {
    BACKEND.current = getBackendUrl();
    connectWS();
    startPolling();
    // Check demo status
    fetch(`${BACKEND.current}/api/demo/status`)
      .then(r => r.json())
      .then(d => setDemoRunning(d.running))
      .catch(() => {});
  }, []);

  // ── WebSocket ──────────────────────────────────────────────────────────────
  const connectWS = useCallback(() => {
    if (!BACKEND.current) return;
    const wsUrl = BACKEND.current.replace("http", "ws") + "/ws/live";
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      setWsStatus("connecting");
      ws.onopen  = () => setWsStatus("live");
      ws.onclose = () => {
        setWsStatus("offline");
        reconnectT.current = setTimeout(connectWS, 4000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "density_update") {
            if (data.heatmap_points?.length) setHeatmap(data.heatmap_points);
            if (data.hotspots)               setHotspots(data.hotspots);
            if (data.stats)                  setStats(data.stats);
            setLastPing(new Date().toLocaleTimeString());
          }
        } catch {}
      };
    } catch { setWsStatus("offline"); }
  }, []);

  // ── REST Polling fallback ──────────────────────────────────────────────────
  const startPolling = useCallback(() => {
    const poll = async () => {
      if (!BACKEND.current) return;
      try {
        const [sRes, hRes, hmRes] = await Promise.all([
          fetch(`${BACKEND.current}/api/stats`),
          fetch(`${BACKEND.current}/api/hotspots`),
          fetch(`${BACKEND.current}/api/heatmap`),
        ]);
        if (sRes.ok)  { const d = await sRes.json();  setStats(d); setLastPing(new Date().toLocaleTimeString()); }
        if (hRes.ok)  { const d = await hRes.json();  setHotspots(d.hotspots || []); }
        if (hmRes.ok) { const d = await hmRes.json(); if (d.heatmap_points?.length) setHeatmap(d.heatmap_points); }
      } catch {}
    };
    poll();
    const t = setInterval(poll, 4000);
    return () => clearInterval(t);
  }, []);

  // ── Demo Control ───────────────────────────────────────────────────────────
  const toggleDemo = async () => {
    if (!BACKEND.current) return;
    try {
      if (demoRunning) {
        await fetch(`${BACKEND.current}/api/demo/stop`, { method: "POST" });
        setDemoRunning(false);
      } else {
        await fetch(`${BACKEND.current}/api/demo/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ city: demoCity, devices: demoDevices })
        });
        setDemoRunning(true);
      }
    } catch (e) { console.error("Demo toggle error:", e); }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const scoreColor = (s: number) =>
    s >= 70 ? "text-red-400" : s >= 35 ? "text-orange-400" : "text-green-400";
  const scoreBg = (s: number) =>
    s >= 70 ? "from-red-500/20 to-red-900/10 border-red-500/30" : s >= 35 ? "from-orange-500/20 to-orange-900/10 border-orange-500/30" : "from-green-500/20 to-green-900/10 border-green-500/30";

  const densityBadge = (d: string) => ({
    HIGH:   "bg-red-500/20 text-red-400 border border-red-500/30",
    MEDIUM: "bg-orange-500/20 text-orange-400 border border-orange-500/30",
    LOW:    "bg-green-500/20 text-green-400 border border-green-500/30",
  }[d] ?? "bg-slate-500/20 text-slate-400 border border-slate-500/30");

  const sdkUrl = typeof window !== "undefined"
    ? `http://${window.location.hostname}:3000/sdk`
    : "/sdk";

  return (
    <div className="min-h-screen grid-bg" style={{ background: "#050a14" }}>

      {/* ── Top Nav ─────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d4a] sticky top-0 z-50 backdrop-blur-sm" style={{ background: "rgba(5,10,20,0.9)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#7c3aed] flex items-center justify-center shadow-lg">
            <Zap size={18} className="text-white" />
          </div>
          <div>
            <span className="text-xl font-black font-display gradient-text tracking-tight">FlowGenix</span>
            <div className="text-[10px] text-slate-500 -mt-0.5">Crowd Intelligence Platform</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* WS status */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#1e2d4a] bg-[#0d1526]">
            {wsStatus === "live"
              ? <Wifi size={12} className="text-green-400" />
              : wsStatus === "connecting"
              ? <RefreshCw size={12} className="text-yellow-400 animate-spin" />
              : <WifiOff size={12} className="text-red-400" />}
            <span className={`text-xs font-medium ${wsStatus === "live" ? "text-green-400" : wsStatus === "connecting" ? "text-yellow-400" : "text-red-400"}`}>
              {wsStatus === "live" ? "Live" : wsStatus === "connecting" ? "Connecting..." : "Offline"}
            </span>
            {lastPing && <span className="text-[10px] text-slate-600">· {lastPing}</span>}
          </div>

          <a href={`${BACKEND.current}/docs`} target="_blank"
            className="text-xs text-[#00d4ff] border border-[#1e2d4a] px-3 py-1.5 rounded-lg hover:border-[#00d4ff]/40 transition-colors">
            API Docs ↗
          </a>
          <a href="/sdk" target="_blank"
            className="text-xs bg-gradient-to-r from-[#00d4ff] to-[#7c3aed] text-white px-3 py-1.5 rounded-lg font-semibold shadow-lg">
            📱 Mobile SDK
          </a>
        </div>
      </header>

      <div className="p-5 grid grid-cols-12 gap-4">

        {/* ── LEFT: Stats ───────────────────────────────────────────── */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-4">

          {/* Crowd Score Card */}
          <div className={`card bg-gradient-to-br border ${scoreBg(stats?.crowd_score ?? 0)}`}>
            <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Activity size={10} /> Live Crowd Score
            </div>
            <div className={`text-7xl font-black font-display ${scoreColor(stats?.crowd_score ?? 0)} leading-none`}>
              {stats?.crowd_score ?? "--"}
            </div>
            <div className="text-xs text-slate-500 mt-1">/ 100</div>
            {stats?.density_level && (
              <span className={`inline-flex items-center gap-1 mt-3 px-3 py-1 rounded-full text-xs font-bold ${densityBadge(stats.density_level)}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                {stats.density_level} DENSITY
              </span>
            )}
          </div>

          {/* 4 stat tiles */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Active Devices", value: stats?.active_devices ?? 0, icon: <Users size={13} />, color: "text-[#00d4ff]", bg: "border-[#00d4ff]/20" },
              { label: "Hotspots", value: stats?.hotspot_count ?? 0, icon: <AlertTriangle size={13} />, color: "text-orange-400", bg: "border-orange-500/20" },
              { label: "GPS Signals", value: pingsTotal > 0 ? pingsTotal.toLocaleString() : `${((stats?.active_devices ?? 0) * 12)}`, icon: <Radio size={13} />, color: "text-purple-400", bg: "border-purple-500/20" },
              { label: "Zones Covered", value: Math.max(stats?.hotspot_count ?? 0, 1), icon: <MapPin size={13} />, color: "text-green-400", bg: "border-green-500/20" },
            ].map((s, i) => (
              <div key={i} className={`card p-3 border ${s.bg}`}>
                <div className={`mb-1.5 ${s.color}`}>{s.icon}</div>
                <div className={`text-2xl font-bold font-display ${s.color}`}>{s.value}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Peak Zone */}
          {stats?.peak_zone && (
            <div className="card border border-[#00d4ff]/20 bg-gradient-to-br from-[#00d4ff]/5 to-transparent">
              <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Navigation size={10} className="text-[#00d4ff]" /> Peak Zone
              </div>
              <div className="text-sm font-bold text-[#00d4ff]">{stats.peak_zone.label}</div>
              <div className="text-xs text-slate-400 mt-1">{stats.peak_zone.devices} devices · Highest density</div>
              <div className="text-[10px] text-slate-600 mt-1 font-mono">
                {stats.peak_zone.lat.toFixed(4)}, {stats.peak_zone.lon.toFixed(4)}
              </div>
            </div>
          )}

          {/* Hotspot List */}
          <div className="card flex-1">
            <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <AlertTriangle size={10} /> Active Hotspots ({hotspots.length})
            </div>
            {hotspots.length === 0 ? (
              <div className="text-center py-6">
                <div className="text-3xl mb-2">🌐</div>
                <div className="text-xs text-slate-500">No hotspots yet.<br />Start the demo simulator below.</div>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {hotspots.map((h, idx) => (
                  <div key={h.id} className="flex items-center justify-between p-2.5 rounded-lg bg-[#0a1020] border border-[#1e2d4a] hover:border-[#00d4ff]/20 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-600 text-xs font-mono">#{idx + 1}</span>
                      <div>
                        <div className="text-xs font-medium text-slate-200">{h.label}</div>
                        <div className="text-[10px] text-slate-500">{h.device_count} devices · {h.ping_count} pings</div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${densityBadge(h.density)}`}>
                      {h.density}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── CENTER: Map + Demo ────────────────────────────────────── */}
        <div className="col-span-12 lg:col-span-6 flex flex-col gap-4">

          {/* Map */}
          <div className="card p-0 overflow-hidden flex-1" style={{ minHeight: "480px" }}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1e2d4a]">
              <div className="flex items-center gap-2">
                <Navigation size={13} className="text-[#00d4ff]" />
                <span className="text-sm font-semibold text-slate-300">Live Crowd Density Map</span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500" /> HIGH
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-yellow-500" /> MED
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500" /> LOW
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00d4ff] animate-pulse" />
                  Updates every 3s
                </span>
              </div>
            </div>
            <LiveMap heatmap={heatmap} hotspots={hotspots} />
          </div>

          {/* Demo Control */}
          <div className="card">
            <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Play size={10} /> Demo Simulator
              {demoRunning && (
                <span className="ml-auto flex items-center gap-1 text-green-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  Running
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block uppercase tracking-wide">City</label>
                <select value={demoCity} onChange={e => setDemoCity(e.target.value)}
                  className="bg-[#0a1020] border border-[#1e2d4a] text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#00d4ff]">
                  {["delhi","mumbai","bangalore","hyderabad","pune"].map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block uppercase tracking-wide">Devices</label>
                <select value={demoDevices} onChange={e => setDemoDevices(Number(e.target.value))}
                  className="bg-[#0a1020] border border-[#1e2d4a] text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#00d4ff]">
                  {[10,25,50,100,200].map(n => (
                    <option key={n} value={n}>{n} devices</option>
                  ))}
                </select>
              </div>
              <button onClick={toggleDemo}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-sm transition-all ${
                  demoRunning
                    ? "bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25"
                    : "bg-gradient-to-r from-[#00d4ff] to-[#7c3aed] text-white hover:opacity-90 shadow-lg"
                }`}>
                {demoRunning ? <><Square size={13} /> Stop Demo</> : <><Play size={13} /> Start Demo</>}
              </button>
            </div>
            {demoRunning && (
              <div className="mt-3 p-2.5 bg-green-500/5 border border-green-500/20 rounded-lg text-xs text-green-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Simulating {demoDevices} pedestrians in {demoCity.charAt(0).toUpperCase() + demoCity.slice(1)} — heatmap updates every 3s
              </div>
            )}
          </div>

          {/* Mobile SDK QR Card */}
          <div className="card border border-[#7c3aed]/30 bg-gradient-to-br from-[#7c3aed]/5 to-transparent">
            <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Radio size={10} className="text-purple-400" /> Mobile SDK — Real GPS Input
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-300">Open on any phone on the same WiFi:</p>
                <code className="text-[#00d4ff] text-xs font-mono mt-1 block">{sdkUrl}</code>
                <p className="text-[10px] text-slate-500 mt-1">Allow location → your real GPS appears on map ↑</p>
              </div>
              <a href="/sdk" target="_blank"
                className="px-3 py-2 bg-purple-500/20 border border-purple-500/30 text-purple-400 rounded-lg text-xs font-semibold hover:bg-purple-500/30 transition-colors">
                Open SDK →
              </a>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Business Intelligence ──────────────────────────── */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-4">

          <div className="text-[10px] text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <TrendingUp size={10} /> Business Intelligence
          </div>

          {[
            {
              icon: <Truck size={16} className="text-[#00d4ff]" />,
              title: "Logistics & Delivery",
              insight: hotspots.some(h => h.density === "HIGH")
                ? `⚠️ ${hotspots.filter(h=>h.density==="HIGH").length} HIGH-congestion zones. Reroute deliveries via alternate streets. Est. delay: 12–18 min.`
                : "✅ All routes clear. Optimal delivery window active.",
              color: "#00d4ff",
              stat: hotspots.filter(h=>h.density==="HIGH").length > 0 ? `${hotspots.filter(h=>h.density==="HIGH").length} blocked zones` : "All clear",
            },
            {
              icon: <Building2 size={16} className="text-purple-400" />,
              title: "Real Estate Intel",
              insight: `${stats?.active_devices ?? 0} active signals tracked. ${hotspots.filter(h=>h.density!=="LOW").length} high-footfall zones → premium commercial opportunities.`,
              color: "#7c3aed",
              stat: `${hotspots.filter(h=>h.density!=="LOW").length} hotspots`,
            },
            {
              icon: <TrendingUp size={16} className="text-green-400" />,
              title: "OOH Advertising",
              insight: stats?.peak_zone
                ? `Peak eyeballs at "${stats.peak_zone.label}" — ${stats.peak_zone.devices} devices. Best slot for billboard/digital ad right now.`
                : "Start simulator to detect peak audience zones.",
              color: "#00ff88",
              stat: `${stats?.peak_zone?.devices ?? 0} impressions`,
            },
            {
              icon: <Shield size={16} className="text-orange-400" />,
              title: "Emergency Services",
              insight: hotspots.some(h => h.density === "HIGH")
                ? `🚨 High crowd density at ${hotspots[0]?.label}. Pre-position ambulance units. Crowd: ${hotspots[0]?.device_count} devices.`
                : "✅ All zones nominal. No surge alerts.",
              color: "#ff8c00",
              stat: hotspots.some(h=>h.density==="HIGH") ? "Alert Active" : "All Clear",
            },
          ].map((card, i) => (
            <div key={i} className="card hover:border-[#1e2d4a] transition-all group cursor-default">
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 rounded-lg bg-[#0a1020]">{card.icon}</div>
                <span className="text-[10px] font-mono" style={{ color: card.color }}>{card.stat}</span>
              </div>
              <div className="text-sm font-semibold text-slate-200 mb-1">{card.title}</div>
              <div className="text-xs text-slate-400 leading-relaxed">{card.insight}</div>
            </div>
          ))}

          {/* Live API preview */}
          <div className="card bg-[#020810] border border-green-500/10">
            <div className="text-[10px] text-green-500/60 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live API · GET /api/stats
            </div>
            <pre className="text-[10px] text-green-400 font-mono overflow-auto leading-relaxed">
{JSON.stringify({
  active_devices: stats?.active_devices ?? 0,
  crowd_score: stats?.crowd_score ?? 0,
  density_level: stats?.density_level ?? "LOW",
  hotspot_count: stats?.hotspot_count ?? 0,
  peak_zone: stats?.peak_zone?.label ?? null,
}, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
