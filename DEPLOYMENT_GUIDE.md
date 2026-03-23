# ELIXI Deployment Guide – Production Setup with Full Features

> Run ELIXI AI Desktop Assistant in production with all subsystems, voice, automation, and memory enabled.

**Last Updated:** March 2026  
**Version:** ELIXI 1.0.0 (Full Stack Deployment)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [System Requirements](#system-requirements)
3. [Pre-Deployment Checklist](#pre-deployment-checklist)
4. [Step-by-Step Deployment](#step-by-step-deployment)
5. [Service Health & Monitoring](#service-health--monitoring)
6. [Troubleshooting](#troubleshooting)
7. [Production Configuration](#production-configuration)
8. [Automated Startup Scripts](#automated-startup-scripts)

---

## Architecture Overview

ELIXI runs as a fully integrated stack of four independent services communicating via REST API and WebSockets:

```
┌─────────────────────────────────────────────────┐
│           ELIXI Electron Desktop App             │
│    (1200×800, frameless, Windows/Mac/Linux)      │
└─────────────────┬───────────────────────────────┘
                  │
        ┌─────────┼─────────┐
        │         │         │
        ▼         ▼         ▼
   VOICE        BACKEND    SETTINGS
   PAGE         API        PAGE
        │        │         │
        └────────┴─────────┘
             │
    Socket.IO (ws) + REST
             │
   ┌─────────┴──────────┐
   │                    │
   ▼                    ▼
Backend Server      Voice Engine
(Node.js)           (Python FastAPI)
 Port 3001           Port 8001
   │                  │
   │                  ├─→ STT (Whisper/Vosk)
   │                  ├─→ TTS (pyttsx3)
   │                  ├─→ Wake Word Detection
   │                  └─→ Voice Activity (WebRTC VAD)
   │
   └──────────┬────────────────┐
              │                │
              ▼                ▼
         AI Engine         Ollama LLM
       (Python FastAPI)   (Local inference)
        Port 8000         Port 11434
         │
         ├─→ Intent Classification
         ├─→ Emotion Detection
         ├─→ Memory Managers (Short/Long-term)
         ├─→ Task Planning & Decomposition
         └─→ Habit Tracking
```

### Service Dependency Graph

```
Electron App (Port 5173 dev / bundled prod)
    ↓ ws://localhost:3001
    Backend Server (Node.js, Port 3001)
        ↓ http://localhost:8000 & :8001
        AI Engine (Python, Port 8000) + Voice Engine (Python, Port 8001)
            ↓ http://localhost:11434
            Ollama (Local LLM inference)
```

---

## System Requirements

### Hardware (Minimum)

- **CPU:** Intel i7/Ryzen 5+ (8+ cores recommended)
- **RAM:** 16 GB (24 GB+ for large LLMs)
- **Storage:** 40 GB free (10 GB app + 30 GB models)
- **GPU:** NVIDIA CUDA 12+ recommended (optional but enhances speed 10–100×)

### Software (Required)

| Component         | Version  | Purpose                                |
|-------------------|----------|----------------------------------------|
| **Node.js**       | 20.x LTS | Desktop & backend runtime              |
| **Python**        | 3.11.x   | AI engine & voice engine runtime       |
| **Ollama**        | Latest   | Local LLM inference server (11434)     |
| **Windows/Mac/Linux** | Modern OS  | Desktop app target (Electron 30+)      |

---

## Pre-Deployment Checklist

Before starting services, verify all prerequisites:

```bash
# Check Node.js
node --version    # Should be 20.12.0+
npm --version     # Should be 10+

# Check Python
python --version  # Should be 3.11.x
pip --version     # Should be 24.x+

# Verify Ollama installation & status
ollama --version
# Download a model (or check existing)
ollama list       # See installed models
ollama pull llama3  # or your preferred model
```

### Port Availability Check

Ensure these ports are free on your machine:

```powershell
# Windows (PowerShell)
netstat -ano | findstr :3001     # Backend
netstat -ano | findstr :8000     # AI Engine
netstat -ano | findstr :8001     # Voice Engine
netstat -ano | findstr :5173     # Vite dev (dev only)
netstat -ano | findstr :11434    # Ollama

# macOS/Linux
lsof -i :3001
lsof -i :8000
lsof -i :8001
lsof -i :5173
lsof -i :11434
```

If ports conflict, update [elixi.config.json](#production-configuration) or kill processes using those ports.

---

## Step-by-Step Deployment

### Option A: Full Automated Deployment (Recommended)

All services in one command:

```bash
# Root directory: E:\Projects\Elixi AI Electron

npm run dev
```

**What happens:**
1. ✓ Backend server starts (http://localhost:3001)
2. ✓ React UI dev server (http://localhost:5173)
3. ✓ Electron app launches (1200×800 window)
4. ✓ Desktop loads UI, ready to accept commands

**Next Steps:** Manually start AI Engine & Voice Engine in separate terminals (see below).

---

### Option B: Full Manual Deployment (Production-Grade)

Start each service independently in separate terminal windows. **Recommended for production.**

#### **Terminal 1: Ollama (LLM Server)**

```bash
# Ollama runs continuously; can be started once and left running
ollama serve

# Output should show:
# > Listening on 127.0.0.1:11434
```

**Verify:**
```bash
curl http://localhost:11434/api/tags
# Returns list of installed models
```

---

#### **Terminal 2: AI Engine (Python FastAPI)**

```bash
cd ai-engine

# If first time: install dependencies
pip install -r requirements.txt

# Start server with auto-reload
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Output should show:
# > Application startup complete
# > Uvicorn running on http://0.0.0.0:8000
# > Press CTRL+C to quit
```

**Verify:**
```bash
curl http://localhost:8000/health
# {"status":"ok","version":"1.0.0"}
```

**Health Endpoints:**
- `GET http://localhost:8000/health` – Service status
- `GET http://localhost:8000/docs` – Interactive API documentation (Swagger)

---

#### **Terminal 3: Voice Engine (Python FastAPI)**

```bash
cd voice-engine

# If first time: install dependencies
pip install -r requirements.txt

# Start server with auto-reload
uvicorn voice_server:app --host 0.0.0.0 --port 8001 --reload

# Output should show:
# > Application startup complete
# > Uvicorn running on http://0.0.0.0:8001
# > Press CTRL+C to quit
```

**Verify:**
```bash
curl http://localhost:8001/health
# {"status":"ok","service":"voice-engine","version":"0.2.0"}
```

**Health Endpoints:**
- `GET http://localhost:8001/health` – Service status
- `GET http://localhost:8001/voice/capabilities` – STT/TTS/VAD capabilities
- `GET http://localhost:8001/voice/status` – Active sessions & detector state

---

#### **Terminal 4: Backend Server (Node.js)**

```bash
cd backend

# If first time: install dependencies
npm install

# Development mode (with file watching)
npm run dev

# Output should show:
# > ELIXI Backend running on http://127.0.0.1:3001
```

Or for production:

```bash
npm run build
npm run start
```

**Verify:**
```bash
curl http://localhost:3001/health
# {"status":"ok","version":"1.0.0","timestamp":"2026-03-18T..."}
```

**Health Endpoints:**
- `GET http://localhost:3001/health` – Service status
- `POST http://localhost:3001/api/chat` – Chat inference (requires body)
- `GET http://localhost:3001/api/voice/capabilities` – Voice system state

---

#### **Terminal 5: React UI (Vite Dev Server)**

```bash
cd desktop/react-ui

# If first time: install dependencies
npm install

# Start dev server
npm run dev

# Output should show:
# > VITE v5.x.x ready in XXX ms
# > ➜  Local:   http://localhost:5173/
```

**Accessible at:**
- Browser: `http://localhost:5173/`
- Electron window (if main app started): auto-loads from `:5173`

---

#### **Terminal 6: Electron Desktop App**

```bash
cd desktop

# If first time: install dependencies
npm install

# Development mode (watches Electron code)
npm run dev

# Opens Electron window, loads React UI from :5173
```

Or directly:

```bash
electron .
```

**Expected:** 1200×800 frameless window with dark blue theme loads React UI.

---

### Startup Order Summary

| #  | Service              | Port  | Terminal | Command                                  |
|----|----------------------|-------|----------|------------------------------------------|
| 1  | **Ollama**           | 11434 | T1       | `ollama serve`                           |
| 2  | **AI Engine**        | 8000  | T2       | `cd ai-engine && uvicorn main:app --port 8000` |
| 3  | **Voice Engine**     | 8001  | T3       | `cd voice-engine && uvicorn voice_server:app --port 8001` |
| 4  | **Backend**          | 3001  | T4       | `cd backend && npm run dev`              |
| 5  | **React UI**         | 5173  | T5       | `cd desktop/react-ui && npm run dev`    |
| 6  | **Electron App**     | —     | T6       | `cd desktop && npm run dev`              |

**Total startup time:** ~30–60 seconds (depends on model warm-up and Python package load).

---

## Service Health & Monitoring

### Check All Services

```bash
# Create a monitoring script (monitor.sh / monitor.ps1)

# Health Check Endpoints
echo "Backend: $(curl -s http://localhost:3001/health | jq .status)"
echo "AI Engine: $(curl -s http://localhost:8000/health | jq .status)"
echo "Voice Engine: $(curl -s http://localhost:8001/health | jq .status)"
echo "Ollama: $(curl -s http://localhost:11434/api/tags | jq '.models | length')"
```

### Monitor Service Logs in Real-Time

**Backend Logs:**
```bash
cd backend
npm run dev 2>&1 | tee backend.log
# Logs file: backend.log (append mode)
```

**AI Engine Logs:**
```bash
cd ai-engine
uvicorn main:app --port 8000 --log-level debug 2>&1 | tee ai.log
```

**Voice Engine Logs:**
```bash
cd voice-engine
uvicorn voice_server:app --port 8001 --log-level debug 2>&1 | tee voice.log
```

### Verify Database & Memory

```bash
# SQLite memory database location
ls -lah memory/elixi.db    # Shows size & last modified
sqlite3 memory/elixi.db ".tables"  # Lists tables
```

---

## Troubleshooting

### Service Won't Start

**Backend on port 3001 fails:**
```bash
# Kill existing process using port 3001
netstat -ano | findstr :3001
taskkill /PID <PID> /F    # Windows
# or on macOS: kill -9 <PID>

# Try again
cd backend && npm run dev
```

**Ollama not responding:**
```bash
# Restart Ollama service
ollama serve
# Verify model is loaded
ollama list
# If model missing:
ollama pull llama3
```

**Python venv issues:**
```bash
# Recreate venv
cd ai-engine
deactivate          # exit venv if active
rm -rf venv         # delete old venv
python -m venv venv
venv\Scripts\Activate.ps1    # Windows
source venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
```

### Voice Features Not Working

**Check wake word status:**
```bash
curl http://localhost:8001/voice/status
# Look for "wakeWordActive": true/false
```

**Enable wake word detection:**
```bash
curl -X POST http://localhost:8001/voice/wake-word \
  -H "Content-Type: application/json" \
  -d '{"active": true}'
```

**List available TTS voices:**
```bash
curl http://localhost:8001/voice/voices
# Returns array of SAPI5 voices (Windows) or system voices
```

### Chat Not Responding

**Check AI Engine connectivity from Backend:**
```bash
curl http://localhost:8000/health
# Should return {"status":"ok"}

# Check if model is loaded in Ollama
ollama list
# Should show installed models

# Test chat endpoint directly
curl -X POST http://localhost:8000/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test",
    "message": "Hello",
    "emotionContext": {},
    "personalityMode": "professional"
  }'
```

### UI Not Loading (Blank Electron Window)

**Check React dev server:**
```bash
curl http://localhost:5173
# Should return HTML

# Restart React dev server
cd desktop/react-ui
npm run dev
```

**Check Electron console:**
```bash
# Set dev mode to open DevTools
ELIXI_OPEN_DEVTOOLS=1 npm run dev  # Backend terminal
```

---

## Production Configuration

### Main Config File

**Location:** `config/elixi.config.json`

**Default:**
```json
{
  "appName": "ELIXI",
  "backendPort": 3001,
  "aiEnginePort": 8000,
  "voiceEnginePort": 8001,
  "frontendPort": 5173,
  "ollama": {
    "url": "http://localhost:11434",
    "model": "llama3"
  },
  "personalityMode": "professional"
}
```

### Environment Variables for Production

Create a `.env` file in the root directory:

```env
# Backend (Node.js)
NODE_ENV=production
PORT=3001
LOG_LEVEL=info

# AI Engine (Python)
AI_ENGINE_PORT=8000
AI_ENGINE_HOST=0.0.0.0
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3

# Voice Engine (Python)
VOICE_ENGINE_PORT=8001
VOICE_ENGINE_HOST=0.0.0.0
VOICE_LOG_LEVEL=info

# Electron
ELIXI_OPEN_DEVTOOLS=0    # Set to 1 for dev
```

### Advanced Configuration

**Settings for Large Models (30B+ parameters):**

```json
{
  "ollama": {
    "url": "http://localhost:11434",
    "model": "llama3:70b",
    "contextWindow": 4096,
    "timeout": 60000
  },
  "voiceEngine": {
    "sttModel": "large",
    "wakeWordThreshold": 0.75
  }
}
```

**Settings for Limited Resources (16 GB RAM):**

```json
{
  "ollama": {
    "model": "mistral",
    "contextWindow": 2048,
    "timeout": 30000
  },
  "memoryEngine": {
    "maxShortTermSize": 50,
    "enableVectorMemory": false
  }
}
```

---

## Automated Startup Scripts

### Windows Batch Script (startup.bat)

Create `scripts/startup.bat`:

```batch
@echo off
REM ELIXI Production Startup Script

echo Starting ELIXI AI Desktop Assistant...
echo.

REM Check ports
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001') do (
  echo ERROR: Port 3001 already in use. Kill process %%a first.
  exit /b 1
)

REM Start each service in background
start "Ollama" cmd /k "ollama serve"
timeout /t 3
start "AI Engine" cmd /k "cd ai-engine && uvicorn main:app --port 8000"
timeout /t 3
start "Voice Engine" cmd /k "cd voice-engine && uvicorn voice_server:app --port 8001"
timeout /t 3
start "Backend" cmd /k "cd backend && npm run start"
timeout /t 3
start "Electron" cmd /k "cd desktop && npm run dev"

echo.
echo All services started! Check console windows for status.
echo ELIXI should launch in 30–60 seconds.
pause
```

**Run:** `.\scripts\startup.bat`

---

### Windows PowerShell Script (startup.ps1)

Create `scripts/startup.ps1`:

```powershell
# ELIXI Production Startup Script

Write-Host "Starting ELIXI AI Desktop Assistant..." -ForegroundColor Green
Write-Host ""

# Function to start service
function Start-Service {
    param([string]$Name, [string]$Command, [int]$Delay)
    Write-Host "Starting $Name..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $Command
    Start-Sleep -Seconds $Delay
}

# Check if ports are available
$ports = 3001, 8000, 8001, 11434
foreach ($port in $ports) {
    if ((Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue).Count -gt 0) {
        Write-Host "ERROR: Port $port already in use!" -ForegroundColor Red
        exit 1
    }
}

# Start services
Start-Service "Ollama" "ollama serve" 3
Start-Service "AI Engine" "cd ai-engine; uvicorn main:app --port 8000 --reload" 3
Start-Service "Voice Engine" "cd voice-engine; uvicorn voice_server:app --port 8001 --reload" 3
Start-Service "Backend" "cd backend; npm run dev" 3
Start-Service "Electron" "cd desktop; npm run dev" 5

Write-Host ""
Write-Host "All services started! ELIXI should launch in 30–60 seconds." -ForegroundColor Green
Write-Host "Check console windows for errors." -ForegroundColor Yellow
```

**Run:** `.\scripts\startup.ps1`

---

### Dockerfile (For Containerized Deployment)

```dockerfile
FROM node:20-alpine as builder

WORKDIR /app
COPY . .

# Install Node deps
RUN npm install --workspaces

# Build UI & backend
RUN npm run build

# Runtime stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/desktop/react-ui/dist ./desktop/react-ui/dist
COPY package.json backend/package.json ./

RUN npm install --production

EXPOSE 3001
CMD ["npm", "run", "start"]
```

**Build & Run:**
```bash
docker build -t elixi:latest .
docker run -p 3001:3001 -p 8000:8000 -p 8001:8001 elixi:latest
```

---

## Performance Tuning

### Backend Optimization

Set in `backend/src/server.ts`:

```typescript
// Increase payload limits for large chat histories
app.use(express.json({ limit: '5mb' }));

// Adjust rate limits
createRateLimiter({ windowMs: 60_000, max: 100 })  // Higher for production
```

### AI Engine Optimization

Set in `ai-engine/main.py`:

```python
import uvicorn

uvicorn.run(
    "main:app",
    host="0.0.0.0",
    port=8000,
    reload=False,  # False for production
    workers=2,      # Increase for multi-core
    log_level="info"
)
```

### Memory Database Tuning

```python
# In memory_engine/long_term_memory.py
PRAGMA synchronous = NORMAL;  # Faster writes
PRAGMA journal_mode = WAL;     # Write-ahead logging
PRAGMA cache_size = 10000;     # Increase cache
```

---

## Monitoring in Production

### Install PM2 (Process Manager)

```bash
npm install -g pm2
```

### Start All Services with PM2

**Create `ecosystem.config.js`:**

```javascript
module.exports = {
  apps: [
    {
      name: "elixi-backend",
      script: "npm",
      args: "start",
      cwd: "./backend",
      env: { NODE_ENV: "production" }
    },
    {
      name: "ellama-ai",
      script: "uvicorn",
      args: "main:app --host 0.0.0.0 --port 8000",
      cwd: "./ai-engine",
      interpreter: "python"
    },
    {
      name: "elixi-voice",
      script: "uvicorn",
      args: "voice_server:app --host 0.0.0.0 --port 8001",
      cwd: "./voice-engine",
      interpreter: "python"
    },
    {
      name: "elixi-electron",
      script: "npm",
      args: "start",
      cwd: "./desktop"
    }
  ]
};
```

**Start:**
```bash
pm2 start ecosystem.config.js
pm2 monit           # Real-time monitoring
pm2 logs            # View all logs
pm2 stop all        # Stop all
```

---

## Quick Reference

### Check System Status

```bash
# All-in-one health check
curl http://localhost:3001/health && echo "✓ Backend"
curl http://localhost:8000/health && echo "✓ AI Engine"
curl http://localhost:8001/health && echo "✓ Voice Engine"
curl http://localhost:11434/api/tags && echo "✓ Ollama"
```

### Restart Individual Services

```bash
# Kill and restart backend only
pkill -f "node.*backend"
cd backend && npm run dev

# Restart AI engine
pkill -f "uvicorn.*main:app"
cd ai-engine && uvicorn main:app --port 8000
```

### Enable Debug Logging

```bash
# Backend
NODE_ENV=development npm run dev

# AI Engine
uvicorn main:app --port 8000 --log-level debug

# Voice Engine
uvicorn voice_server:app --port 8001 --log-level debug
```

---

## Common Deployment Scenarios

### Scenario 1: First-Time Local Setup

1. Install Python 3.11 & Node.js 20
2. Download Ollama and `ollama pull llama3`
3. Clone repository
4. Run `npm install` (installs all workspaces)
5. Open 6 terminals and start services per [Step-by-Step Deployment](#step-by-step-deployment)

**Expected time:** 45 minutes (model download included).

---

### Scenario 2: Development with Hot Reload

All services support code changes without restart:

```bash
# Terminal 1–5: Start all as normal (all have --reload flags)
# Terminal 6: Change a file in desktop/react-ui/src/
# Browser auto-refreshes; Electron reloads UI
```

---

### Scenario 3: Production on Remote Server

1. Install on headless server (no Electron GUI needed for backend)
2. Run only: `Ollama`, `AI Engine`, `Voice Engine`, `Backend`
3. Access UI via browser at `http://server-ip:3001`

```bash
# Backend only (no Electron)
cd backend && npm run start

# Frontend served from backend's static dir
# Or use separate frontend server
cd desktop/react-ui && npm run build
# Copy dist/ to backend/public/
```

---

### Scenario 4: Docker Production Cluster

Run each service in separate containers:

```bash
# docker-compose.yml
version: '3.8'
services:
  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
  
  ai-engine:
    build: ./ai-engine
    ports:
      - "8000:8000"
    depends_on:
      - ollama
  
  voice-engine:
    build: ./voice-engine
    ports:
      - "8001:8001"
  
  backend:
    build: ./backend
    ports:
      - "3001:3001"
    depends_on:
      - ai-engine
      - voice-engine
```

---

## Maintenance & Updates

### Update Dependencies

```bash
# Backend
cd backend && npm update && npm audit fix

# AI Engine
cd ai-engine && pip install --upgrade -r requirements.txt

# Voice Engine
cd voice-engine && pip install --upgrade -r requirements.txt

# Electron
cd desktop && npm update
```

### Pull Latest LLM Model

```bash
ollama pull llama3:latest
# Or switch model in config/elixi.config.json
```

### Backup Database

```bash
# SQLite memory engine
cp memory/elixi.db memory/elixi.db.backup.$(date +%Y%m%d)

# Automate daily
crontab -e
# Add: 0 2 * * * cp ~/Projects/Elixi\ AI\ Electron/memory/elixi.db ~/backups/elixi.db.$(date +\%Y\%m\%d)
```

---

## Summary

**Full ELIXI deployment in 6 terminals:**

| Terminal | Service         | Command                                    |
|----------|-----------------|-------------------------------------------|
| 1        | Ollama          | `ollama serve`                             |
| 2        | AI Engine       | `cd ai-engine && uvicorn main:app --port 8000` |
| 3        | Voice Engine    | `cd voice-engine && uvicorn voice_server:app --port 8001` |
| 4        | Backend         | `cd backend && npm run dev`                |
| 5        | React UI        | `cd desktop/react-ui && npm run dev`      |
| 6        | Electron        | `cd desktop && npm run dev`                |

**Feature Matrix:**

| Feature              | Enabled? | Dependency              |
|----------------------|----------|-------------------------|
| Chat with LLM        | ✓        | Ollama + AI Engine      |
| Voice Input (STT)    | ✓        | Voice Engine            |
| Voice Output (TTS)   | ✓        | Voice Engine + pyttsx3  |
| Wake Word Detection  | ✓        | Voice Engine            |
| Emotion Detection    | ✓        | AI Engine               |
| Long-term Memory     | ✓        | Backend (SQLite)        |
| System Automation    | ✓        | Backend + Node.js       |
| UI Customization     | ✓        | Desktop/React           |

**Development complete. Ready for production.** 🚀

---

## Appendix: Default Ports & URLs

```
Ollama:           http://localhost:11434     (LLM inference)
AI Engine:        http://localhost:8000      (Intent, emotion, memory)
Voice Engine:     http://localhost:8001      (STT, TTS, wake word)
Backend API:      http://localhost:3001      (Chat, automation, system)
React UI (dev):   http://localhost:5173      (Vite dev server)
Electron App:     http://(auto-loaded)       (Desktop window)
```

---

## Support & Contact

For issues or feature requests:
- Check [ELIXI_PROJECT_DOCUMENTATION.md](../ELIXI_PROJECT_DOCUMENTATION.md)
- Review logs in each service console
- Verify all ports are accessible
- Ensure Python 3.11+ and Node.js 20+ installed
