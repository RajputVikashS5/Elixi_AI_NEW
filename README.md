# ELIXI – Advanced Personal AI System Assistant

> **Intelligence with Empathy**

ELIXI is a fully local, privacy-first AI-powered desktop assistant built with Electron, React, Node.js, and Python (FastAPI + Ollama). It runs entirely offline — no cloud, no data leaks.

---

## Quick Start

### Prerequisites

- **Node.js** 20.x LTS
- **Python** 3.11.x
- **Ollama** – [Install from ollama.ai](https://ollama.ai)
- Pull a model: `ollama pull llama3` or `ollama pull mistral`

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

### 5. Start all services

**Terminal 1 – AI Engine:**
```bash
npm run start:ai
```

**Terminal 2 – Voice Engine (optional):**
```bash
npm run start:voice
```

**Terminal 3 – Desktop App (backend + UI + Electron):**
```bash
npm run dev
```

---

## Architecture

```
Electron Shell (desktop/electron/)
    └── React UI (desktop/react-ui/)
            ↕ Socket.io + REST
    Node.js Backend (backend/)
            ↕ HTTP
    Python AI Engine (ai-engine/) → Ollama (local LLM)
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
