# 🌊 FlowGenix

**Hyperlocal Crowd Density & Traffic Intelligence Platform**

Real-time crowd monitoring powered by anonymous GPS signals from smartphones.

---

## Quick Start

### 1. Start Backend (Python FastAPI)
```bash
cd backend
pip install -r requirements.txt
python main.py
# API running at http://localhost:8000
# API docs at http://localhost:8000/docs
```

### 2. Start Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
# Dashboard at http://localhost:3000
```

### 3. Open Mobile SDK
Open `mobile-sdk/index.html` in a browser (or serve it).
Or visit `http://localhost:3000/sdk` (proxied).

---

## Architecture

```
GPS Devices (Mobile PWA)
      ↓ POST /api/gps
FastAPI Backend (Python)
      ↓ KDE + DBSCAN ML
SQLite Database
      ↓ WebSocket push
Next.js Dashboard (React)
      ↓ Leaflet Heatmap
```

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/gps` | POST | Ingest a GPS ping |
| `/api/heatmap` | GET | KDE heatmap data |
| `/api/stats` | GET | Live crowd stats |
| `/api/hotspots` | GET | Detected hotspots |
| `/api/demo/start` | POST | Start GPS simulator |
| `/api/demo/stop` | POST | Stop simulator |
| `/ws/live` | WS | Real-time updates |
| `/docs` | GET | Auto API documentation |

## Tech Stack

- **Backend**: Python FastAPI + SQLite + scipy + scikit-learn
- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS + Leaflet.js
- **ML**: Kernel Density Estimation (KDE) + DBSCAN clustering
- **Real-time**: WebSockets (native FastAPI)
- **Mobile SDK**: Progressive Web App (browser GPS API)

## Author

**Sumit Bansal** | sumitbansal1290@gmail.com
