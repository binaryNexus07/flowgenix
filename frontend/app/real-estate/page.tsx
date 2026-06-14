"use client";
import { useEffect, useState } from "react";
import { Building2, TrendingUp, MapPin, BarChart2, FileText, Star } from "lucide-react";
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
  snapshot_time: string; crowd_score: number; active_devices: number;
  hotspot_count: number; density_level: string; peak_label: string;
}

function footfallScore(devices: number): number {
  return Math.min(100, Math.round(devices * 6.5));
}
function commercialGrade(score: number): { grade: string; label: string; color: string } {
  if (score >= 75) return { grade: "A+", label: "Premium Commercial", color: "text-yellow-400" };
  if (score >= 55) return { grade: "A",  label: "High Footfall",      color: "text-green-400" };
  if (score >= 35) return { grade: "B",  label: "Moderate Traffic",   color: "text-[#00d4ff]" };
  return             { grade: "C",  label: "Low Footfall",        color: "text-slate-400" };
}

export default function RealEstatePage() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [history,  setHistory]  = useState<Snapshot[]>([]);
  const [report,   setReport]   = useState(false);
  const BACKEND = getBackendUrl();

  useEffect(() => {
    const load = async () => {
      try {
        const [h, hist] = await Promise.all([
          fetch(`${BACKEND}/api/hotspots`).then(r => r.json()),
          fetch(`${BACKEND}/api/history?hours=24`).then(r => r.json()),
        ]);
        setHotspots(h.hotspots || []);
        setHistory(hist.snapshots || []);
      } catch {}
    };
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  const zones = hotspots.map(h => ({
    ...h,
    footfall: footfallScore(h.device_count),
    grade: commercialGrade(footfallScore(h.device_count)),
    estRentMultiplier: h.density === "HIGH" ? 2.4 : h.density === "MEDIUM" ? 1.6 : 1.0,
  })).sort((a, b) => b.footfall - a.footfall);

  const avgScore = history.length > 0
    ? Math.round(history.reduce((s, h) => s + h.crowd_score, 0) / history.length)
    : 0;

  return (
    <div className="min-h-screen" style={{ background: "#050a14", color: "#e2e8f0", fontFamily: "Inter,sans-serif" }}>
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d4a] sticky top-0 z-50 backdrop-blur-sm" style={{ background: "rgba(5,10,20,0.92)" }}>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-[#00d4ff] text-sm hover:underline">← Dashboard</Link>
          <div className="w-px h-4 bg-[#1e2d4a]" />
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-purple-400" />
            <span className="font-bold text-lg">Real Estate Intelligence</span>
          </div>
        </div>
        <button onClick={() => setReport(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-purple-600 to-[#7c3aed] text-white shadow-lg hover:opacity-90 transition-opacity">
          <FileText size={14} /> Generate Report
        </button>
      </header>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* KPI bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Zones Analysed", value: zones.length, icon: <MapPin size={14}/>, color: "text-purple-400" },
            { label: "Premium Zones (A+)", value: zones.filter(z=>z.grade.grade==="A+").length, icon: <Star size={14}/>, color: "text-yellow-400" },
            { label: "Avg Footfall Score", value: `${avgScore}/100`, icon: <BarChart2 size={14}/>, color: "text-[#00d4ff]" },
            { label: "Peak Zone", value: zones[0]?.label || "—", icon: <TrendingUp size={14}/>, color: "text-green-400" },
          ].map((s, i) => (
            <div key={i} className="rounded-xl border border-[#1e2d4a] bg-[#0d1526] p-4">
              <div className={`mb-2 ${s.color}`}>{s.icon}</div>
              <div className={`text-2xl font-black truncate ${s.color}`}>{s.value}</div>
              <div className="text-[11px] text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Zone scoring table */}
        <div className="rounded-xl border border-[#1e2d4a] bg-[#0d1526] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#1e2d4a] flex items-center justify-between">
            <div className="text-xs text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Building2 size={10} className="text-purple-400" /> Commercial Zone Footfall Index
            </div>
            <div className="text-[10px] text-slate-600">Updated live · scored from GPS density</div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] text-slate-500 uppercase tracking-widest border-b border-[#1e2d4a]">
                {["Zone","Grade","Footfall Score","Daily Devices","Density","Rent Multiplier","Coordinates"].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {zones.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                  No zone data — start demo simulator from dashboard
                </td></tr>
              ) : zones.map((z, i) => (
                <tr key={z.id} className="border-b border-[#0a1020] hover:bg-[#0a1828] transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-200">{z.label}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xl font-black ${z.grade.color}`}>{z.grade.grade}</span>
                    <div className={`text-[10px] ${z.grade.color} opacity-70`}>{z.grade.label}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-[#0a1020] rounded-full h-2 max-w-24">
                        <div className="h-2 rounded-full" style={{ width: `${z.footfall}%`, background: z.footfall >= 75 ? "#ffd700" : z.footfall >= 55 ? "#00ff88" : "#00d4ff" }} />
                      </div>
                      <span className="text-xs font-bold text-slate-300">{z.footfall}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#00d4ff] font-bold">{z.device_count * 48}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      z.density === "HIGH" ? "text-red-400 bg-red-500/10 border-red-500/30"
                      : z.density === "MEDIUM" ? "text-orange-400 bg-orange-500/10 border-orange-500/30"
                      : "text-green-400 bg-green-500/10 border-green-500/30"
                    }`}>{z.density}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-300 font-semibold">{z.estRentMultiplier}×</td>
                  <td className="px-4 py-3 font-mono text-[10px] text-slate-500">
                    <a href={`https://www.google.com/maps?q=${z.lat},${z.lon}`} target="_blank" className="text-[#00d4ff] hover:underline">
                      {z.lat.toFixed(4)}, {z.lon.toFixed(4)} ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 24h trend */}
        {history.length > 1 && (
          <div className="rounded-xl border border-[#1e2d4a] bg-[#0d1526] p-5">
            <div className="text-xs text-slate-400 uppercase tracking-widest mb-3">24h Footfall Trend</div>
            <div className="flex items-end gap-1 h-20">
              {history.slice(-48).map((s, i) => {
                const h = Math.max(4, Math.round((s.crowd_score / 100) * 80));
                return (
                  <div key={i} title={`Score: ${s.crowd_score} · ${new Date(s.snapshot_time).toLocaleTimeString()}`}
                    style={{ flex: 1, height: `${h}px`, background: "linear-gradient(to top, #7c3aed, #00d4ff)", borderRadius: 2, opacity: 0.75 }} />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Report modal */}
      {report && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0d1526] border border-[#1e2d4a] rounded-2xl p-6 max-w-lg w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Mobility Intelligence Report</h2>
              <button onClick={() => setReport(false)} className="text-slate-500 hover:text-white">✕</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-[#0a1020] rounded-lg border border-[#1e2d4a]">
                <div className="text-[10px] text-slate-500 uppercase mb-1">Report Period</div>
                <div className="font-semibold">{new Date().toLocaleDateString()} · Last 24 hours</div>
              </div>
              <div className="p-3 bg-[#0a1020] rounded-lg border border-[#1e2d4a]">
                <div className="text-[10px] text-slate-500 uppercase mb-1">Peak Zone</div>
                <div className="font-semibold text-yellow-400">{zones[0]?.label || "N/A"}</div>
                <div className="text-xs text-slate-400">{zones[0]?.device_count || 0} devices · Footfall score: {zones[0]?.footfall || 0}/100</div>
              </div>
              <div className="p-3 bg-[#0a1020] rounded-lg border border-[#1e2d4a]">
                <div className="text-[10px] text-slate-500 uppercase mb-1">Commercial Insight</div>
                <div className="text-xs text-slate-300 leading-relaxed">
                  {zones.filter(z=>z.grade.grade==="A+").length} premium zones identified with 2.4× rent multiplier potential.
                  {hotspots.filter(h=>h.density==="HIGH").length > 0 ? ` High-congestion at ${hotspots[0].label} suggests strong retail viability.` : " Moderate footfall across all zones."}
                  {" "}Recommend site survey at {zones[0]?.label || "top zone"} for commercial leasing.
                </div>
              </div>
              <div className="p-3 bg-[#0a1020] rounded-lg border border-[#1e2d4a]">
                <div className="text-[10px] text-slate-500 uppercase mb-2">2/3/4-Wheeler Mobility Index</div>
                {["2-Wheeler (Bike/Scooter)","3-Wheeler (Auto)","4-Wheeler (Car)"].map((v, i) => (
                  <div key={i} className="flex items-center justify-between py-1">
                    <span className="text-xs text-slate-400">{v}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-[#050a14] rounded-full">
                        <div className="h-1.5 rounded-full bg-gradient-to-r from-purple-500 to-[#00d4ff]"
                          style={{ width: `${[85,60,40][i]}%` }} />
                      </div>
                      <span className="text-xs text-[#00d4ff] font-bold">{[85,60,40][i]}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => setReport(false)}
              className="w-full mt-4 py-3 bg-gradient-to-r from-purple-600 to-[#7c3aed] text-white rounded-xl font-semibold text-sm">
              Download PDF (Coming Soon)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
