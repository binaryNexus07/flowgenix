"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, TrendingUp, Users, Activity, Download } from "lucide-react";
import Link from "next/link";

function getBackendUrl() {
  if (typeof window === "undefined") return "http://localhost:8000";
  return process.env.NEXT_PUBLIC_BACKEND_URL || `http://${window.location.hostname}:8000`;
}

interface Hotspot {
  id: string; lat: number; lon: number;
  device_count: number; ping_count: number;
  density: "HIGH" | "MEDIUM" | "LOW"; label: string; radius_m: number;
}
interface Snapshot {
  id: number; snapshot_time: string; crowd_score: number;
  active_devices: number; hotspot_count: number; density_level: string;
  peak_label: string;
}

const densityColor = (d: string) =>
  d === "HIGH" ? "text-red-400 bg-red-500/10 border-red-500/30"
  : d === "MEDIUM" ? "text-orange-400 bg-orange-500/10 border-orange-500/30"
  : "text-green-400 bg-green-500/10 border-green-500/30";

export default function HotspotsPage() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [history,  setHistory]  = useState<Snapshot[]>([]);
  const [filter,   setFilter]   = useState<"ALL" | "HIGH" | "MEDIUM" | "LOW">("ALL");
  const [loading,  setLoading]  = useState(true);
  const BACKEND = getBackendUrl();

  const load = async () => {
    setLoading(true);
    try {
      const [h, hist] = await Promise.all([
        fetch(`${BACKEND}/api/hotspots`).then(r => r.json()),
        fetch(`${BACKEND}/api/history?hours=24`).then(r => r.json()),
      ]);
      setHotspots(h.hotspots || []);
      setHistory(hist.snapshots || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, []);

  const filtered = filter === "ALL" ? hotspots : hotspots.filter(h => h.density === filter);
  const maxScore = Math.max(...history.map(s => s.crowd_score), 1);

  return (
    <div className="min-h-screen" style={{ background: "#050a14", color: "#e2e8f0", fontFamily: "Inter,sans-serif" }}>
      {/* Nav */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d4a] sticky top-0 z-50 backdrop-blur-sm" style={{ background: "rgba(5,10,20,0.92)" }}>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-[#00d4ff] text-sm hover:underline">← Dashboard</Link>
          <div className="w-px h-4 bg-[#1e2d4a]" />
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-orange-400" />
            <span className="font-bold text-lg">Active Hotspots</span>
          </div>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0d1526] border border-[#1e2d4a] text-xs hover:border-[#00d4ff]/40 transition-colors">
          <RefreshCw size={12} className={loading ? "animate-spin text-[#00d4ff]" : "text-slate-400"} /> Refresh
        </button>
      </header>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Summary tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Hotspots", value: hotspots.length, icon: <AlertTriangle size={14} />, color: "text-orange-400" },
            { label: "HIGH Density", value: hotspots.filter(h=>h.density==="HIGH").length, icon: <Activity size={14} />, color: "text-red-400" },
            { label: "Total Devices", value: hotspots.reduce((a,h)=>a+h.device_count,0), icon: <Users size={14} />, color: "text-[#00d4ff]" },
            { label: "History Points", value: history.length, icon: <TrendingUp size={14} />, color: "text-purple-400" },
          ].map((s, i) => (
            <div key={i} className="rounded-xl border border-[#1e2d4a] bg-[#0d1526] p-4">
              <div className={`mb-2 ${s.color}`}>{s.icon}</div>
              <div className={`text-3xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Trend sparkline */}
        {history.length > 1 && (
          <div className="rounded-xl border border-[#1e2d4a] bg-[#0d1526] p-5">
            <div className="text-xs text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <TrendingUp size={10} className="text-purple-400" /> Crowd Score Trend (last 24h · {history.length} snapshots)
            </div>
            <div className="flex items-end gap-1 h-16">
              {history.slice(-60).map((s, i) => {
                const h = Math.max(4, Math.round((s.crowd_score / 100) * 64));
                const col = s.crowd_score >= 70 ? "#ff4757" : s.crowd_score >= 35 ? "#ff8c00" : "#00ff88";
                return (
                  <div key={i} title={`${s.crowd_score} · ${new Date(s.snapshot_time).toLocaleTimeString()}`}
                    style={{ flex: 1, height: `${h}px`, background: col, borderRadius: 2, opacity: 0.8, cursor: "default" }} />
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-slate-600 mt-1">
              <span>{history.length > 0 ? new Date(history[0].snapshot_time).toLocaleTimeString() : ""}</span>
              <span>{history.length > 0 ? new Date(history[history.length-1].snapshot_time).toLocaleTimeString() : ""}</span>
            </div>
          </div>
        )}

        {/* Filter bar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-2">
            {(["ALL","HIGH","MEDIUM","LOW"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  filter === f
                    ? "bg-[#00d4ff]/20 text-[#00d4ff] border-[#00d4ff]/40"
                    : "bg-[#0d1526] text-slate-400 border-[#1e2d4a] hover:border-slate-500"
                }`}>{f}</button>
            ))}
          </div>
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0d1526] border border-[#1e2d4a] text-xs text-slate-400 hover:text-[#00d4ff] transition-colors">
            <Download size={12} /> Export CSV
          </button>
        </div>

        {/* Hotspot table */}
        <div className="rounded-xl border border-[#1e2d4a] bg-[#0d1526] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2d4a] text-[10px] text-slate-500 uppercase tracking-widest">
                {["#","Zone","Density","Devices","Pings","Radius","Coordinates","Action"].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                  {loading ? "Loading..." : "No hotspots — start demo simulator from dashboard"}
                </td></tr>
              ) : filtered.map((h, i) => (
                <tr key={h.id} className="border-b border-[#0d1526] hover:bg-[#0a1828] transition-colors">
                  <td className="px-4 py-3 text-slate-600 font-mono text-xs">{i+1}</td>
                  <td className="px-4 py-3 font-semibold text-slate-200">{h.label}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${densityColor(h.density)}`}>
                      {h.density}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#00d4ff] font-bold">{h.device_count}</td>
                  <td className="px-4 py-3 text-slate-400">{h.ping_count}</td>
                  <td className="px-4 py-3 text-slate-400">{h.radius_m}m</td>
                  <td className="px-4 py-3 font-mono text-[10px] text-slate-500">
                    {h.lat.toFixed(4)}, {h.lon.toFixed(4)}
                  </td>
                  <td className="px-4 py-3">
                    <a href={`https://www.google.com/maps?q=${h.lat},${h.lon}`} target="_blank"
                      className="text-[10px] text-[#00d4ff] hover:underline">View ↗</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
