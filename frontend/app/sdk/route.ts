import { NextResponse } from 'next/server';

// Inline the SDK so it works on Vercel (no filesystem access to ../mobile-sdk/)
// NEXT_PUBLIC_BACKEND_URL is injected at build time from Vercel env vars
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';

export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <title>FlowGenix SDK — Join the Crowd</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#050a14;color:#e2e8f0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px}
    .logo{font-size:2.2rem;font-weight:800;background:linear-gradient(135deg,#00d4ff,#7c3aed);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:8px}
    .tagline{font-size:.85rem;color:#64748b;margin-bottom:40px;text-align:center}
    .card{background:#0d1526;border:1px solid #1e2d4a;border-radius:20px;padding:28px;width:100%;max-width:340px}
    .server-row{display:flex;align-items:center;gap:8px;margin-bottom:16px;padding:10px 12px;background:#0a1020;border-radius:8px;border:1px solid #1e2d4a}
    .server-row input{flex:1;background:transparent;border:none;color:#00d4ff;font-size:.78rem;font-family:monospace;outline:none}
    .server-row label{font-size:.7rem;color:#64748b;white-space:nowrap}
    .pulse-ring{width:80px;height:80px;border-radius:50%;background:#0d1526;border:3px solid #00d4ff;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:2rem;transition:border-color .3s}
    .pulse-ring.active{animation:pulse 2s ease-in-out infinite;border-color:#00ff88}
    .pulse-ring.error{border-color:#ff4757}
    @keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(0,255,136,.4)}50%{box-shadow:0 0 0 20px rgba(0,255,136,0)}}
    .status-title{font-size:1.1rem;font-weight:700;margin-bottom:6px;text-align:center}
    .status-sub{font-size:.8rem;color:#64748b;margin-bottom:24px;line-height:1.5;text-align:center}
    .stat-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-top:1px solid #1e2d4a;font-size:.82rem}
    .stat-label{color:#64748b}
    .stat-value{color:#00d4ff;font-weight:600;font-family:monospace}
    .stat-value.green{color:#00ff88}
    .btn{width:100%;padding:14px;border-radius:12px;border:none;font-size:1rem;font-weight:700;cursor:pointer;margin-top:20px;transition:all .2s}
    .btn-start{background:linear-gradient(135deg,#00d4ff,#7c3aed);color:#fff}
    .btn-stop{background:#1e2d4a;color:#ff4757;border:1px solid #ff4757}
    .btn:active{transform:scale(.97)}
    .density-badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:.75rem;font-weight:700}
    .density-HIGH{background:#ff4757;color:#fff}
    .density-MEDIUM{background:#ffa502;color:#000}
    .density-LOW{background:#2ed573;color:#000}
    .density-UNKNOWN{background:#1e2d4a;color:#64748b}
    .device-id{font-size:.7rem;color:#334155;margin-top:20px;font-family:monospace;word-break:break-all;text-align:center}
  </style>
</head>
<body>
<div class="logo">⚡ FlowGenix</div>
<p class="tagline">Hyperlocal Crowd Intelligence · Share your signal</p>
<div class="card">
  <div class="server-row">
    <label>API:</label>
    <input type="text" id="apiInput" placeholder="https://your-backend.railway.app" />
    <button onclick="saveUrl()" style="background:#00d4ff;color:#000;border:none;padding:4px 8px;border-radius:6px;font-size:.7rem;font-weight:700;cursor:pointer">SET</button>
  </div>
  <div class="pulse-ring" id="ring">📍</div>
  <div class="status-title" id="statusTitle">Ready to Start</div>
  <div class="status-sub" id="statusSub">Tap the button below to share your location and join the crowd intelligence network.</div>
  <div class="stat-row"><span class="stat-label">📡 Connection</span><span class="stat-value" id="connStatus">Idle</span></div>
  <div class="stat-row"><span class="stat-label">📍 GPS Accuracy</span><span class="stat-value" id="accuracy">—</span></div>
  <div class="stat-row"><span class="stat-label">🔢 Pings Sent</span><span class="stat-value green" id="pingCount">0</span></div>
  <div class="stat-row"><span class="stat-label">🌐 Zone Density</span><div><span class="density-badge density-UNKNOWN" id="densityBadge">UNKNOWN</span></div></div>
  <div class="stat-row"><span class="stat-label">👥 Active Devices</span><span class="stat-value" id="activeDevices">—</span></div>
  <button class="btn btn-start" id="mainBtn" onclick="toggle()">🚀 Start Sharing Location</button>
  <div class="device-id" id="deviceLabel"></div>
</div>
<script>
  // Backend URL priority: 1) localStorage override, 2) injected from Vercel env, 3) auto-detect
  const INJECTED = '${BACKEND_URL}';
  function detectUrl(){
    const stored = localStorage.getItem('fg_backend');
    if(stored) return stored;
    if(INJECTED) return INJECTED;
    const h = window.location.hostname;
    if(!h || h==='') return 'http://10.34.4.145:8000';
    if(h==='localhost'||h==='127.0.0.1') return 'http://localhost:8000';
    const proto = window.location.protocol==='https:' ? 'https' : 'http';
    return proto+'://'+h+':8000';
  }
  let BACKEND = detectUrl();
  document.getElementById('apiInput').value = BACKEND;

  function saveUrl(){
    const v = document.getElementById('apiInput').value.trim();
    if(v){ BACKEND=v; localStorage.setItem('fg_backend',v); testConn(); }
  }

  async function testConn(){
    const el = document.getElementById('connStatus');
    el.textContent='Testing...'; el.style.color='#64748b';
    try{
      const r = await fetch(BACKEND+'/api/health',{signal:AbortSignal.timeout(5000)});
      if(r.ok){ el.textContent='Server OK ✓'; el.style.color='#00ff88'; }
      else throw 0;
    }catch{ el.textContent='Cannot reach server'; el.style.color='#ff4757'; }
  }

  function getDeviceId(){
    let id=localStorage.getItem('fg_device');
    if(!id){ id='mob-'+Math.random().toString(36).substr(2,12); localStorage.setItem('fg_device',id); }
    return id;
  }
  const DEVICE_ID = getDeviceId();
  document.getElementById('deviceLabel').textContent='Device: '+DEVICE_ID;
  testConn();

  let tracking=false, pingCount=0, watchId=null, pingTimer=null, lastPos=null;

  function toggle(){ tracking ? stop() : start(); }

  function start(){
    if(!navigator.geolocation){ setErr('GPS not available'); return; }
    tracking=true;
    document.getElementById('mainBtn').className='btn btn-stop';
    document.getElementById('mainBtn').textContent='⛔ Stop Sharing';
    document.getElementById('statusTitle').textContent='Acquiring GPS...';
    document.getElementById('statusSub').textContent='Please allow location access if prompted.';
    document.getElementById('ring').className='pulse-ring';
    watchId=navigator.geolocation.watchPosition(onPos, onErr, {enableHighAccuracy:true,maximumAge:3000,timeout:10000});
    pingTimer=setInterval(()=>{ if(lastPos) send(lastPos); }, 5000);
  }

  function stop(){
    tracking=false;
    if(watchId) navigator.geolocation.clearWatch(watchId);
    if(pingTimer) clearInterval(pingTimer);
    watchId=null; pingTimer=null;
    document.getElementById('mainBtn').className='btn btn-start';
    document.getElementById('mainBtn').textContent='🚀 Start Sharing Location';
    document.getElementById('statusTitle').textContent='Sharing Stopped';
    document.getElementById('statusSub').textContent='Thanks for contributing! Tap to start again.';
    document.getElementById('ring').className='pulse-ring';
    document.getElementById('connStatus').textContent='Idle';
  }

  function onPos(p){
    lastPos=p;
    document.getElementById('accuracy').textContent=p.coords.accuracy.toFixed(0)+'m';
    document.getElementById('statusTitle').textContent='Live — Sending Data';
    document.getElementById('statusSub').textContent='Your anonymized location is helping map crowd density in real time.';
    document.getElementById('ring').className='pulse-ring active';
    document.getElementById('ring').textContent='📡';
    send(p);
  }

  function onErr(e){ setErr('GPS Error: '+e.message); }

  async function send(p){
    if(!tracking) return;
    try{
      const r=await fetch(BACKEND+'/api/gps',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({device_id:DEVICE_ID,lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy||10,timestamp:new Date().toISOString()}),
        signal:AbortSignal.timeout(5000)
      });
      if(r.ok){
        const d=await r.json();
        pingCount++;
        document.getElementById('pingCount').textContent=pingCount;
        document.getElementById('connStatus').textContent='Connected ✓';
        document.getElementById('connStatus').style.color='#00ff88';
        const den=d.zone_density||'UNKNOWN';
        const b=document.getElementById('densityBadge');
        b.textContent=den; b.className='density-badge density-'+den;
        if(d.active_devices!=null) document.getElementById('activeDevices').textContent=d.active_devices;
      } else {
        document.getElementById('connStatus').textContent='Server error '+r.status;
        document.getElementById('connStatus').style.color='#ff4757';
      }
    }catch(e){
      document.getElementById('connStatus').textContent='Cannot reach server';
      document.getElementById('connStatus').style.color='#ffa502';
    }
  }

  function setErr(msg){
    document.getElementById('statusTitle').textContent='Error';
    document.getElementById('statusSub').textContent=msg;
    document.getElementById('ring').className='pulse-ring error';
    document.getElementById('ring').textContent='⚠️';
  }
</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}
