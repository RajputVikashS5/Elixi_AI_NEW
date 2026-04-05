# ELIXI – Advanced Personal AI System Assistant

> **Intelligence with Empathy**

ELIXI is a local-first, privacy-focused AI desktop assistant built with Electron, React, Node.js, and Python (FastAPI + Ollama), with optional online model support.

---

## Quick Start

### Prerequisites

- **Node.js** 20.x LTS
- **Python** 3.11.x
- **Ollama** – [Install from ollama.ai](https://ollama.ai)
- Pull a model: `ollama pull llama3` or `ollama pull mistral`
- Optional for cloud mode: an online AI provider API key (OpenAI-compatible endpoint)

### 1. Install Node.js dependencies

```bash
npm install
```

### 2. Install Python dependencies (AI Engine)

```bash
cd ai-engine
pip install -r requirements.txt
```

### 3. Install Python dependencies (Voice Engine)

```bash
cd voice-engine
pip install -r requirements.txt
```

### 4. Configure ELIXI

Edit `config/elixi.config.json` to set your preferred model and settings.

For cloud model mode, create `ai-engine/.env`:

```bash
GEMINI_API_KEY=your_gemini_key_here
GEMINI_MODEL=gemini-2.0-flash

OPENROUTER_API_KEY=your_openrouter_key_here
OPENROUTER_MODEL=meta-llama/llama-3-8b-instruct
OPENROUTER_SITE_URL=http://localhost
OPENROUTER_APP_NAME=Elixi AI Engine

# Camera startup behavior (optional)
ELIXI_CAMERA_AUTO_ENABLE=false
# Alias supported by startup parser:
ELIXI_CAMERA_ENABLED=false
```

Then select **OpenRouter (cloud)** or **Google Gemini (cloud)** in the app settings page under **AI Model → LLM Provider**.

### 5. Start in the browser

**Terminal 1 – Browser stack (AI engine + backend + UI):**
```bash
npm run dev
```

Then open `http://127.0.0.1:5173` in your browser.

**Optional: Voice Engine**
```bash
npm run start:voice
```

**Optional: Electron desktop app**
```bash
npm run dev:desktop
```

---

## Architecture

```
Electron Shell (desktop/electron/)
    └── React UI (desktop/react-ui/)
            ↕ Socket.io + REST
    Node.js Backend (backend/)
            ↕ HTTP
        Python AI Engine (ai-engine/) → Ollama (local) or online API model
    Python Voice Engine (voice-engine/)
```

---

## Phase 1 Deliverables

- [x] Electron desktop shell
- [x] React UI with TailwindCSS
- [x] Real-time chat interface
- [x] Node.js backend (Express + Socket.io)
- [x] Python FastAPI AI engine
- [x] Ollama LLM integration (streaming)
- [x] Basic system automation commands
- [x] SQLite memory database
- [x] Settings page (model, personality)

---

## Project Structure

See `ELIXI_PROJECT_DOCUMENTATION.md` for full documentation.

---

## License

Private – All rights reserved.
