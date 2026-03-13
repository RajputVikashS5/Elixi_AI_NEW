# ELIXI – Advanced Personal AI System Assistant
## Complete Project Documentation

> **Tagline:** Intelligence with Empathy
> **Version:** 1.0.0
> **Last Updated:** March 13, 2026
> **Status:** Phase 1 Implemented (Core Foundation Complete)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Objectives](#2-objectives)
3. [Core Features](#3-core-features)
4. [System Architecture](#4-system-architecture)
5. [Technology Stack](#5-technology-stack)
6. [Module Breakdown](#6-module-breakdown)
7. [Folder Structure](#7-folder-structure)
8. [API Architecture](#8-api-architecture)
9. [Security Architecture](#9-security-architecture)
10. [Memory System Design](#10-memory-system-design)
11. [Emotion Detection Design](#11-emotion-detection-design)
12. [Voice Pipeline](#12-voice-pipeline)
13. [System Automation Design](#13-system-automation-design)
14. [Integration Architecture](#14-integration-architecture)
15. [UI/UX Design](#15-uiux-design)
16. [Data Flow Diagrams](#16-data-flow-diagrams)
17. [Phase-Wise Development Roadmap](#17-phase-wise-development-roadmap)
18. [Testing Strategy](#18-testing-strategy)
19. [Deployment Strategy](#19-deployment-strategy)
20. [Future Scalability Plan](#20-future-scalability-plan)

---

## 1. Project Overview

**ELIXI** is a fully local, privacy-first, AI-powered desktop assistant designed to operate at the system level of a personal computer. Inspired by science-fiction AI assistants like Jarvis, ELIXI is engineered to be a practical, real-world personal AI companion — one that understands context, learns user behavior, detects emotional signals, and automates complex multi-step tasks through natural language interaction.

ELIXI is built on the premise that a truly intelligent assistant must:

- **Understand** the user through natural language, voice, and behavioral signals.
- **Remember** the user's habits, preferences, and history across sessions.
- **Act** on the user's behalf by automating system-level tasks and workflows.
- **Adapt** its personality and tone based on user context and emotional state.
- **Protect** user privacy by keeping all data and AI processing entirely local.

Unlike cloud-based assistants (Google Assistant, Siri, Cortana), ELIXI runs fully offline using local Large Language Models (LLMs) served by Ollama. No user data is ever transmitted to external servers.

ELIXI targets power users, developers, researchers, and productivity-conscious individuals who want a deeply personalized AI system that grows smarter over time.

---

## 2. Objectives

### Primary Objectives

| # | Objective | Description |
|---|-----------|-------------|
| O-01 | Local-First AI | All AI inference runs locally via Ollama. No cloud dependency. |
| O-02 | System-Level Automation | ELIXI can open apps, manage files, run scripts, and orchestrate multi-step workflows. |
| O-03 | Natural Voice Interaction | Full voice pipeline including wake-word detection, STT, TTS, and intent resolution. |
| O-04 | Persistent Memory | ELIXI remembers conversations, preferences, and repeating patterns across sessions. |
| O-05 | Emotional Intelligence | Detects stress, fatigue, and emotional state; responds with empathy. |
| O-06 | Adaptive Learning | Identifies repeated task patterns and suggests or automates them proactively. |
| O-07 | Developer-Friendly Integrations | Deep integration with VS Code, GitHub, web browsers, email, and calendars. |
| O-08 | Personality System | Multiple personality modes (Professional, Friendly, Calm, Focus, Silent). |
| O-09 | Security & Safety | All system commands require permission validation before execution. |
| O-10 | Modular & Scalable | Clean modular architecture that allows new capabilities to be added with minimal friction. |

### Non-Goals (Out of Scope)

- Cloud AI services or API calls to OpenAI, Google, or similar providers.
- Mobile or web deployments (Desktop-only, Phase 1–8).
- Real-time internet browsing as a core feature (available only as a Phase 7 browser integration).
- Multi-user support in initial phases.

---

## 3. Core Features

### 3.1 Intelligent Chat Interface
- Real-time conversational AI using local LLMs (Llama 3 / Mistral) via Ollama.
- Supports multi-turn conversation with context window management.
- Markdown rendering for rich AI responses.
- Code block highlighting for developer tasks.
- Command palette with quick-access shortcuts.

### 3.2 System Automation Engine
- Open/close applications by name.
- File and folder management (create, search, move, delete).
- Execute terminal commands with permission prompting.
- Multi-step workflow execution (e.g., "Prepare my coding workspace").
- Scheduled and event-triggered automation.

### 3.3 Voice Interaction Pipeline
- Always-on wake-word detection ("Hey ELIXI").
- Offline Speech-to-Text (Whisper / Vosk).
- Natural language command intent recognition.
- Expressive Text-to-Speech responses (Coqui TTS).
- Voice activity detection (VAD) for natural conversation flow.

### 3.4 Persistent Memory Engine
- Session memory (current conversation context).
- Long-term memory (facts, preferences, past tasks).
- Habit and pattern tracking.
- Vector semantic search via ChromaDB.
- SQLite for structured relational memory storage.

### 3.5 Emotion Detection System
- Typing speed and rhythm analysis.
- Voice tone and pitch analysis.
- Time-of-day behavioral patterns.
- Optional webcam-based facial expression analysis (opt-in).
- Empathetic response modulation based on detected emotional state.

### 3.6 Adaptive Learning Engine
- Detects repeated multi-step task patterns.
- Proactively suggests automating frequent workflows.
- Learns user vocabulary, preferences, and communication style.
- Adjusts response verbosity based on context.

### 3.7 Integration Ecosystem
- VS Code: open projects, run tasks, view extensions.
- GitHub: status checks, commit summaries, PR notifications.
- Browser: open tabs, search the web, bookmark management.
- Email: read/compose email summaries (local client only).
- Calendar: view upcoming events, set reminders.

### 3.8 Personality System
| Mode | Description |
|------|-------------|
| Professional | Concise, formal, business-like responses. |
| Friendly | Warm, conversational, uses casual language. |
| Calm | Slow-paced, soothing, minimal information density. |
| Focus | Ultra-minimal responses; avoids distractions. |
| Silent | No voice output; text-only; minimal notifications. |

---

## 4. System Architecture

### 4.1 High-Level Architecture

ELIXI follows a **layered, event-driven microservices architecture** split across two runtimes:

```
┌─────────────────────────────────────────────────────────────────┐
│                        ELIXI SYSTEM                             │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              PRESENTATION LAYER                        │    │
│  │         Electron Shell + React UI (TypeScript)         │    │
│  └────────────────────┬───────────────────────────────────┘    │
│                       │  IPC / WebSocket                       │
│  ┌────────────────────▼───────────────────────────────────┐    │
│  │              BACKEND LAYER (Node.js / Express)         │    │
│  │    REST API · Socket.io · Session Management           │    │
│  │    System Automation · Permission Validation           │    │
│  └──────────┬──────────────────────────┬──────────────────┘    │
│             │  HTTP / WebSocket        │  child_process        │
│  ┌──────────▼──────────┐    ┌──────────▼──────────────────┐   │
│  │   AI ENGINE LAYER   │    │   AUTOMATION LAYER          │   │
│  │   (Python/FastAPI)  │    │   (Node child_process +     │   │
│  │                     │    │    Python OS libraries)      │   │
│  │ · Intent Engine     │    │ · App Control               │   │
│  │ · Memory Engine     │    │ · File Manager              │   │
│  │ · Emotion Engine    │    │ · Workflow Runner           │   │
│  │ · Task Planner      │    └─────────────────────────────┘   │
│  │ · LLM via Ollama    │                                       │
│  └──────────┬──────────┘                                       │
│             │                                                   │
│  ┌──────────▼──────────┐    ┌────────────────────────────┐    │
│  │   MEMORY LAYER      │    │   VOICE LAYER              │    │
│  │ · SQLite            │    │ · Whisper / Vosk (STT)     │    │
│  │ · ChromaDB          │    │ · Coqui TTS                │    │
│  └─────────────────────┘    │ · Wake Word Detection      │    │
│                              └────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Communication Architecture

| Communication Path | Protocol | Description |
|--------------------|----------|-------------|
| UI ↔ Electron Main | Electron IPC | File system access, OS dialogs, tray |
| UI ↔ Backend | Socket.io + REST | Real-time chat, events, commands |
| Backend ↔ AI Engine | HTTP (FastAPI) | AI inference, emotion, memory queries |
| Backend ↔ Automation | Node child_process | System command execution |
| AI Engine ↔ Ollama | HTTP | Local LLM inference |
| AI Engine ↔ Memory | SQLite / ChromaDB | Read/write memory stores |
| Voice Engine ↔ Backend | WebSocket | Real-time audio stream, transcripts |

### 4.3 Process Model

ELIXI runs as multiple cooperating processes:

```
Process 1: Electron Main Process
  └── Manages: Window lifecycle, OS integration, IPC bridge

Process 2: React Renderer Process
  └── Manages: UI rendering, user interaction, Socket.io client

Process 3: Node.js Backend (Express + Socket.io)
  └── Manages: API routing, session, automation, permission gating

Process 4: Python FastAPI AI Engine
  └── Manages: LLM inference, intent parsing, memory, emotion

Process 5: Python Voice Engine
  └── Manages: Wake word, STT, TTS, audio I/O
```

---

## 5. Technology Stack

### 5.1 Desktop Runtime

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Desktop Shell | Electron | 30.x | Cross-platform desktop app wrapper |
| IPC Bridge | Electron IPC | Built-in | Main ↔ Renderer communication |
| Auto-updater | electron-updater | 6.x | Application update mechanism |
| System Tray | Electron Tray | Built-in | Background operation with tray icon |

### 5.2 Frontend

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| UI Framework | React | 18.x | Component-based UI rendering |
| Language | TypeScript | 5.x | Type-safe frontend code |
| Styling | TailwindCSS | 3.x | Utility-first CSS framework |
| State Management | Zustand | 4.x | Lightweight global state |
| Routing | React Router | 6.x | In-app navigation |
| Animation | Framer Motion | 11.x | Smooth UI animations |
| Icons | Lucide React | Latest | Icon library |
| Markdown | react-markdown | 9.x | Render AI markdown responses |
| Code Highlight | PrismJS | 1.x | Syntax highlighting for code blocks |
| Charts | Recharts | 2.x | Analytics and usage visualization |

### 5.3 Backend Runtime

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Runtime | Node.js | 20.x LTS | JavaScript server runtime |
| Framework | Express.js | 4.x | HTTP server and REST API |
| WebSocket | Socket.io | 4.x | Real-time bidirectional communication |
| Process Manager | PM2 | 5.x | Process lifecycle management (dev) |
| Logging | Winston | 3.x | Structured application logging |
| Validation | Zod | 3.x | Runtime schema validation |
| Scheduler | node-cron | 3.x | Task scheduling |

### 5.4 AI Services

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| AI Runtime | Python | 3.11.x | ML/AI computation |
| API Framework | FastAPI | 0.111.x | High-performance AI API server |
| ASGI Server | Uvicorn | 0.29.x | FastAPI production server |
| LLM Runtime | Ollama | Latest | Local LLM model server |
| LLM Models | Llama 3 / Mistral | 8B params | Primary AI language models |
| ML Framework | PyTorch | 2.x | Emotion/signal processing models |
| NLP | spaCy | 3.x | Intent parsing, entity extraction |
| Transformers | HuggingFace | 4.x | Embedding models for memory |

### 5.5 Voice Processing

| Component | Technology | Purpose |
|-----------|-----------|---------|
| STT (primary) | OpenAI Whisper (local) | Offline speech-to-text |
| STT (fallback) | Vosk | Lightweight offline STT |
| TTS | Coqui TTS | Natural text-to-speech |
| Wake Word | Porcupine / Snowboy (local) | "Hey ELIXI" trigger |
| Audio I/O | PyAudio | Microphone capture, audio playback |
| VAD | Silero VAD | Voice activity detection |

### 5.6 Memory System

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Relational DB | SQLite (via better-sqlite3) | Structured memory, preferences, logs |
| Vector DB | ChromaDB | Semantic memory search |
| ORM | SQLAlchemy (Python) | Database abstraction for AI engine |
| Embeddings | sentence-transformers | Convert text to vector embeddings |

### 5.7 Security

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Encryption | Node.js crypto (AES-256-GCM) | Encrypt sensitive local data |
| Key Derivation | PBKDF2 / Argon2 | Derive encryption keys from passphrase |
| Permission Store | SQLite | Track granted command permissions |
| Content Security Policy | Electron CSP | Prevent XSS in renderer process |
| Context Isolation | Electron contextBridge | Secure IPC communication |

---

## 6. Module Breakdown

### 6.1 Desktop Module (`desktop/`)

**Electron Main Process (`desktop/electron/`)**
- `main.ts` — App entry, window creation, IPC setup, tray icon.
- `preload.ts` — Secure context bridge exposing whitelisted APIs to renderer.
- `ipc-handlers.ts` — Handles IPC messages from renderer (file dialogs, system info).
- `window-manager.ts` — Window state persistence, multi-window support (future).
- `tray-manager.ts` — System tray icon, context menu, notifications.
- `updater.ts` — Auto-update checking and applying.

**React UI (`desktop/react-ui/`)**
- `App.tsx` — Root component, router setup, theme provider.
- `pages/` — Page-level components (Chat, Dashboard, Settings, Memory, Automation).
- `components/` — Reusable UI components (MessageBubble, CommandCard, VoiceWave).
- `store/` — Zustand state stores (chat, settings, emotion, voice).
- `hooks/` — Custom React hooks (useSocket, useVoice, useEmotion).
- `services/` — API client wrappers for backend calls.
- `styles/` — TailwindCSS configuration and global styles.

### 6.2 Backend Module (`backend/`)

- `server.ts` — Express + Socket.io server initialization.
- `routes/` — Route definitions organized by domain.
  - `chat.routes.ts` — Chat message endpoints.
  - `automation.routes.ts` — System automation command endpoints.
  - `memory.routes.ts` — Memory read/write endpoints.
  - `voice.routes.ts` — Voice session management endpoints.
  - `system.routes.ts` — System information endpoints.
- `controllers/` — Request handlers implementing business logic.
- `services/` — Core service layer.
  - `ai.service.ts` — Communicates with Python AI Engine.
  - `automation.service.ts` — Executes system commands safely.
  - `memory.service.ts` — Memory read/write coordination.
  - `permission.service.ts` — Validates and stores command permissions.
  - `socket.service.ts` — Real-time event emission.
- `middleware/` — Express middleware (auth, logging, error handling, rate limiting).

### 6.3 AI Engine Module (`ai-engine/`)

**Intent Engine (`ai-engine/intent_engine/`)**
- `intent_classifier.py` — Classifies user input into intent categories.
- `entity_extractor.py` — Extracts entities (app names, file paths, times) from input.
- `prompt_builder.py` — Constructs context-aware prompts for the LLM.
- `ollama_client.py` — Interface to Ollama for LLM inference.
- `response_parser.py` — Parses and structures LLM raw responses.

**Memory Engine (`ai-engine/memory_engine/`)**
- `short_term_memory.py` — In-session conversation context buffer.
- `long_term_memory.py` — Persistent fact and preference storage via SQLite.
- `vector_memory.py` — Semantic memory search and storage via ChromaDB.
- `habit_tracker.py` — Detects and stores recurring user patterns.
- `memory_router.py` — Decides which memory system to query/write.

**Emotion Engine (`ai-engine/emotion_engine/`)**
- `typing_analyzer.py` — Analyzes typing speed, rhythm, and error frequency.
- `voice_tone_analyzer.py` — Pitch, energy, and speech rate analysis.
- `time_behavior_analyzer.py` — Time-of-day baseline deviation detection.
- `webcam_analyzer.py` — Optional facial expression analysis (opt-in).
- `emotion_aggregator.py` — Fuses multi-signal inputs into an emotion state.
- `response_modulator.py` — Adjusts LLM response tone based on emotion.

**Task Planner (`ai-engine/task_planner/`)**
- `task_decomposer.py` — Breaks complex user commands into sub-tasks.
- `task_executor.py` — Orchestrates sub-task execution with the backend.
- `workflow_builder.py` — Converts task sequences into storable workflows.
- `scheduler.py` — Time-based and event-triggered task scheduling.

### 6.4 Voice Engine Module (`voice-engine/`)
- `wake_word_detector.py` — Listens for "Hey ELIXI" trigger.
- `audio_capture.py` — Manages microphone input stream.
- `stt_engine.py` — Performs speech-to-text using Whisper or Vosk.
- `tts_engine.py` — Synthesizes speech using Coqui TTS.
- `voice_activity_detector.py` — Detects when user starts/stops speaking.
- `voice_server.py` — FastAPI WebSocket server for voice streaming.

### 6.5 Automation Module (`automation/`)
- `app_controller.py` / `app_controller.js` — Open, close, focus applications.
- `file_manager.py` / `file_manager.js` — File search, create, move, delete.
- `command_executor.js` — Safe child_process wrapper with permission validation.
- `system_info.js` — CPU, RAM, disk, battery, running processes.
- `workflows/` — Pre-defined and user-saved workflow JSON definitions.
  - `coding_workspace.json` — Opens VS Code, terminal, browser.
  - `meeting_prep.json` — Opens calendar, Slack, mutes notifications.

---

## 7. Folder Structure

```
ELIXI/
│
├── ELIXI_PROJECT_DOCUMENTATION.md     ← This file
├── README.md                           ← Quick start guide
├── .gitignore
├── package.json                        ← Root package (Electron + Node workspace)
│
├── desktop/
│   ├── electron/
│   │   ├── main.ts                     ← Electron main process entry
│   │   ├── preload.ts                  ← Secure context bridge
│   │   ├── ipc-handlers.ts             ← IPC message handlers
│   │   ├── window-manager.ts           ← Window state management
│   │   ├── tray-manager.ts             ← System tray management
│   │   └── updater.ts                  ← Auto-update logic
│   │
│   └── react-ui/
│       ├── public/
│       │   ├── index.html
│       │   └── assets/                 ← Static assets (icons, fonts)
│       ├── src/
│       │   ├── App.tsx
│       │   ├── main.tsx                ← React entry point
│       │   ├── pages/
│       │   │   ├── ChatPage.tsx        ← Primary chat interface
│       │   │   ├── DashboardPage.tsx   ← Overview & quick actions
│       │   │   ├── AutomationPage.tsx  ← Workflow management
│       │   │   ├── MemoryPage.tsx      ← Memory browser
│       │   │   └── SettingsPage.tsx    ← App configuration
│       │   ├── components/
│       │   │   ├── chat/
│       │   │   │   ├── MessageBubble.tsx
│       │   │   │   ├── ChatInput.tsx
│       │   │   │   ├── TypingIndicator.tsx
│       │   │   │   └── CommandSuggestions.tsx
│       │   │   ├── voice/
│       │   │   │   ├── VoiceWaveform.tsx
│       │   │   │   └── VoiceStatusBadge.tsx
│       │   │   ├── automation/
│       │   │   │   ├── WorkflowCard.tsx
│       │   │   │   └── PermissionDialog.tsx
│       │   │   ├── emotion/
│       │   │   │   └── EmotionIndicator.tsx
│       │   │   └── ui/
│       │   │       ├── Sidebar.tsx
│       │   │       ├── TopBar.tsx
│       │   │       ├── Button.tsx
│       │   │       └── Modal.tsx
│       │   ├── store/
│       │   │   ├── chatStore.ts
│       │   │   ├── settingsStore.ts
│       │   │   ├── voiceStore.ts
│       │   │   └── emotionStore.ts
│       │   ├── hooks/
│       │   │   ├── useSocket.ts
│       │   │   ├── useVoice.ts
│       │   │   ├── useEmotion.ts
│       │   │   └── useAutomation.ts
│       │   ├── services/
│       │   │   ├── api.ts              ← Axios/fetch base client
│       │   │   ├── chatService.ts
│       │   │   ├── automationService.ts
│       │   │   └── memoryService.ts
│       │   └── styles/
│       │       ├── globals.css
│       │       └── tailwind.config.js
│       ├── tsconfig.json
│       ├── vite.config.ts
│       └── package.json
│
├── backend/
│   ├── src/
│   │   ├── server.ts                   ← Express + Socket.io entry
│   │   ├── routes/
│   │   │   ├── chat.routes.ts
│   │   │   ├── automation.routes.ts
│   │   │   ├── memory.routes.ts
│   │   │   ├── voice.routes.ts
│   │   │   └── system.routes.ts
│   │   ├── controllers/
│   │   │   ├── chat.controller.ts
│   │   │   ├── automation.controller.ts
│   │   │   ├── memory.controller.ts
│   │   │   └── system.controller.ts
│   │   ├── services/
│   │   │   ├── ai.service.ts
│   │   │   ├── automation.service.ts
│   │   │   ├── memory.service.ts
│   │   │   ├── permission.service.ts
│   │   │   └── socket.service.ts
│   │   ├── middleware/
│   │   │   ├── errorHandler.ts
│   │   │   ├── requestLogger.ts
│   │   │   └── rateLimiter.ts
│   │   └── utils/
│   │       ├── sanitizer.ts            ← Input sanitization
│   │       └── commandValidator.ts     ← Command whitelist validation
│   ├── tsconfig.json
│   └── package.json
│
├── ai-engine/
│   ├── main.py                         ← FastAPI entry point
│   ├── intent_engine/
│   │   ├── __init__.py
│   │   ├── intent_classifier.py
│   │   ├── entity_extractor.py
│   │   ├── prompt_builder.py
│   │   ├── ollama_client.py
│   │   └── response_parser.py
│   ├── memory_engine/
│   │   ├── __init__.py
│   │   ├── short_term_memory.py
│   │   ├── long_term_memory.py
│   │   ├── vector_memory.py
│   │   ├── habit_tracker.py
│   │   └── memory_router.py
│   ├── emotion_engine/
│   │   ├── __init__.py
│   │   ├── typing_analyzer.py
│   │   ├── voice_tone_analyzer.py
│   │   ├── time_behavior_analyzer.py
│   │   ├── webcam_analyzer.py
│   │   ├── emotion_aggregator.py
│   │   └── response_modulator.py
│   ├── task_planner/
│   │   ├── __init__.py
│   │   ├── task_decomposer.py
│   │   ├── task_executor.py
│   │   ├── workflow_builder.py
│   │   └── scheduler.py
│   ├── routers/
│   │   ├── chat_router.py
│   │   ├── memory_router.py
│   │   ├── emotion_router.py
│   │   └── task_router.py
│   ├── models/
│   │   ├── schemas.py                  ← Pydantic request/response models
│   │   └── enums.py
│   ├── requirements.txt
│   └── pyproject.toml
│
├── voice-engine/
│   ├── voice_server.py                 ← FastAPI WebSocket voice server
│   ├── wake_word_detector.py
│   ├── audio_capture.py
│   ├── stt_engine.py
│   ├── tts_engine.py
│   ├── voice_activity_detector.py
│   └── requirements.txt
│
├── automation/
│   ├── app_controller.js               ← Node.js app control
│   ├── file_manager.js                 ← Node.js file operations
│   ├── command_executor.js             ← Safe child_process wrapper
│   ├── system_info.js                  ← System metrics
│   ├── app_controller.py               ← Python automation (cross-platform)
│   ├── file_manager.py
│   └── workflows/
│       ├── coding_workspace.json
│       ├── meeting_prep.json
│       └── shutdown_routine.json
│
├── models/
│   └── (Ollama model cache references, embedding model configs)
│
├── memory/
│   ├── elixi.db                        ← SQLite database (created at runtime)
│   └── chroma_store/                   ← ChromaDB vector store (created at runtime)
│
└── config/
    ├── elixi.config.json               ← Main configuration file
    ├── permissions.json                ← Granted permission definitions
    ├── workflows.json                  ← User-saved workflow definitions
    └── personality.json                ← Personality mode settings
```

---

## 8. API Architecture

### 8.1 Node.js Backend REST API (Port 3001)

#### Chat Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat/message` | Send a message; returns AI response |
| `GET` | `/api/chat/history` | Get conversation history |
| `DELETE` | `/api/chat/history` | Clear conversation history |
| `POST` | `/api/chat/command` | Execute a parsed command |

**POST /api/chat/message Request:**
```json
{
  "sessionId": "uuid-v4",
  "message": "Open VS Code and start the dev server",
  "emotionContext": { "state": "focused", "confidence": 0.82 },
  "personalityMode": "professional"
}
```

**POST /api/chat/message Response:**
```json
{
  "success": true,
  "messageId": "uuid-v4",
  "response": "Opening VS Code and starting the development server...",
  "intent": "automation.workflow.coding",
  "actions": [
    { "type": "open_app", "target": "vscode", "status": "executed" }
  ],
  "emotion": { "state": "focused" },
  "timestamp": "2026-03-13T21:00:00Z"
}
```

#### Automation Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/automation/execute` | Execute a system automation command |
| `GET` | `/api/automation/workflows` | List all saved workflows |
| `POST` | `/api/automation/workflows` | Save a new workflow |
| `DELETE` | `/api/automation/workflows/:id` | Delete a workflow |
| `GET` | `/api/automation/permissions` | Get granted permissions |
| `POST` | `/api/automation/permissions/request` | Request a new permission |

#### Memory Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/memory/facts` | Get stored user facts |
| `POST` | `/api/memory/facts` | Store a new fact |
| `GET` | `/api/memory/search?q=query` | Semantic memory search |
| `GET` | `/api/memory/habits` | Get detected habits |
| `DELETE` | `/api/memory/facts/:id` | Delete a specific memory |

#### System Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/system/info` | CPU, RAM, disk, uptime |
| `GET` | `/api/system/processes` | Running processes list |
| `GET` | `/api/system/health` | Backend health check |

### 8.2 Socket.io Events (Port 3001)

| Event (Client → Server) | Payload | Description |
|--------------------------|---------|-------------|
| `chat:send` | `{ message, sessionId }` | Stream a chat message |
| `voice:start` | `{ sessionId }` | Begin voice session |
| `voice:stop` | `{ sessionId }` | End voice session |
| `automation:run` | `{ workflowId }` | Run a workflow |
| `emotion:signal` | `{ typing_wpm, errors }` | Send typing signal |

| Event (Server → Client) | Payload | Description |
|--------------------------|---------|-------------|
| `chat:token` | `{ token }` | Streaming LLM token |
| `chat:complete` | `{ response, actions }` | Full response ready |
| `automation:progress` | `{ step, status }` | Workflow step update |
| `emotion:update` | `{ state, confidence }` | Emotion state change |
| `voice:transcript` | `{ text, final }` | STT transcript update |
| `elixi:notification` | `{ title, body, type }` | System notification |

### 8.3 Python AI Engine API (Port 8000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/ai/chat` | LLM inference with context |
| `POST` | `/ai/intent` | Intent classification |
| `POST` | `/ai/emotion` | Emotion state detection |
| `POST` | `/memory/store` | Store a memory entry |
| `POST` | `/memory/search` | Semantic vector search |
| `POST` | `/memory/facts` | Store structured facts |
| `GET` | `/memory/habits` | Get detected habits |
| `POST` | `/tasks/plan` | Decompose task into steps |
| `GET` | `/health` | Health check |

### 8.4 Voice Engine API (Port 8001)

| Endpoint | Protocol | Description |
|----------|----------|-------------|
| `WS /voice/stream` | WebSocket | Audio stream for STT |
| `POST /voice/tts` | HTTP | Text-to-speech synthesis |
| `GET /voice/status` | HTTP | Wake word / recording status |

---

## 9. Security Architecture

### 9.1 Security Principles

ELIXI's security model follows the principle of **least privilege** — every action requiring system access must be explicitly permitted, sandboxed, and logged.

### 9.2 Permission System

All system automation commands are categorized into permission tiers:

| Tier | Category | Examples | Prompt Required |
|------|----------|---------|-----------------|
| T1 - Safe | Read-only system info | CPU stats, clock, weather | Never |
| T2 - Standard | Application control | Open app, play music | First time only |
| T3 - Elevated | File management | Create folder, search files | Always warn |
| T4 - Restricted | Command execution | Run terminal command | Explicit approval + preview |
| T5 - Prohibited | Destructive ops | Delete system files, format | Blocked entirely |

**Permission Request Flow:**
```
User Request
    ↓
Command Validator (whitelist check)
    ↓
Permission Tier Classification
    ↓
[T1] → Execute immediately
[T2] → Check permission store → If not granted → Show UI prompt
[T3] → Always show UI prompt with command preview
[T4] → Show full command preview + require explicit "Run" button click
[T5] → Block and inform user
    ↓
Log execution to audit trail
```

### 9.3 Encryption

- All user memory data stored in SQLite is encrypted using **AES-256-GCM**.
- Encryption keys are derived from the user's local passphrase using **Argon2id** KDF.
- Keys are never stored on disk — derived at session start, held in memory.
- ChromaDB vector store files are stored in an encrypted directory.

### 9.4 Electron Security Hardening

```typescript
// Required Electron security settings
webPreferences: {
  nodeIntegration: false,        // Renderer cannot access Node.js APIs directly
  contextIsolation: true,        // contextBridge enforced
  sandbox: true,                 // Renderer process sandboxed
  webSecurity: true,             // Same-origin policy enforced
  allowRunningInsecureContent: false
}

// Content Security Policy
"Content-Security-Policy": 
  "default-src 'self'; " +
  "script-src 'self'; " +
  "style-src 'self' 'unsafe-inline'; " +  // TailwindCSS requires inline
  "connect-src 'self' ws://localhost:3001 http://localhost:8000 http://localhost:8001; " +
  "img-src 'self' data:; " +
  "font-src 'self'"
```

### 9.5 Input Sanitization & Injection Prevention

- All user inputs are sanitized before being passed to the command executor.
- Command arguments are passed as arrays (never interpolated into shell strings).
- SQL queries use parameterized statements exclusively — no string concatenation.
- LLM outputs are treated as untrusted content — actions are extracted via structured JSON parsing, not raw text execution.
- A command whitelist validates every automation command against a predefined safe pattern list.

### 9.6 Audit Logging

Every executed command is logged to an append-only audit log including:
- Timestamp
- User-initiated command
- Parsed intent
- Executed system action
- Permission tier used
- Approved/Denied status

---

## 10. Memory System Design

### 10.1 Memory Layers

ELIXI implements a **three-layer memory architecture** modeled after human memory:

```
┌──────────────────────────────────────────────────────┐
│         WORKING MEMORY (Session Buffer)              │
│  · Current conversation context (last N messages)   │
│  · Held in Python process memory (list)              │
│  · Max 20 turns, sliding window                      │
│  · Lost on session end                               │
└───────────────────────┬───────────────────────────────┘
                        │ Consolidation at session end
┌───────────────────────▼──────────────────────────────┐
│         LONG-TERM MEMORY (SQLite)                    │
│  · User facts (name, preferences, location)          │
│  · Task history and outcomes                         │
│  · Habit patterns and schedules                      │
│  · Saved workflows and customizations                │
│  · Persistent across all sessions                    │
└───────────────────────┬───────────────────────────────┘
                        │ Embedding
┌───────────────────────▼──────────────────────────────┐
│         SEMANTIC MEMORY (ChromaDB)                   │
│  · Vector embeddings of all stored memories          │
│  · Enables "fuzzy" semantic search                   │
│  · "What did we discuss about my project last week?" │
│  · Powers contextual memory injection into prompts   │
└──────────────────────────────────────────────────────┘
```

### 10.2 SQLite Schema

```sql
-- Users / sessions
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    started_at DATETIME,
    ended_at DATETIME,
    personality_mode TEXT,
    emotion_profile TEXT  -- JSON
);

-- Messages
CREATE TABLE messages (
    id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES sessions(id),
    role TEXT,  -- 'user' | 'assistant'
    content TEXT,
    intent TEXT,
    emotion_state TEXT,
    timestamp DATETIME,
    embedding_id TEXT  -- Reference to ChromaDB
);

-- Memories / Facts
CREATE TABLE memories (
    id TEXT PRIMARY KEY,
    category TEXT,  -- 'preference' | 'fact' | 'habit' | 'task'
    key TEXT,
    value TEXT,
    confidence REAL,
    source TEXT,
    created_at DATETIME,
    updated_at DATETIME,
    embedding_id TEXT
);

-- Habits
CREATE TABLE habits (
    id TEXT PRIMARY KEY,
    description TEXT,
    trigger TEXT,   -- 'time' | 'event' | 'pattern'
    trigger_value TEXT,
    action TEXT,    -- JSON workflow definition
    occurrences INTEGER DEFAULT 0,
    last_seen DATETIME,
    auto_suggest BOOLEAN DEFAULT TRUE
);

-- Audit Log
CREATE TABLE audit_log (
    id TEXT PRIMARY KEY,
    timestamp DATETIME,
    command TEXT,
    intent TEXT,
    action TEXT,
    permission_tier INTEGER,
    status TEXT,  -- 'approved' | 'denied' | 'blocked'
    session_id TEXT
);

-- Permissions
CREATE TABLE permissions (
    id TEXT PRIMARY KEY,
    command_pattern TEXT,
    tier INTEGER,
    granted BOOLEAN,
    granted_at DATETIME,
    expires_at DATETIME
);
```

### 10.3 Memory Injection Strategy

When building prompts for the LLM, ELIXI injects relevant memories:

```
System Prompt:
  + Personality mode context
  + Current emotion state
  + [INJECTED] Top 3 relevant long-term memories (semantic search)
  + [INJECTED] Current user facts (name, preferences)
  + [INJECTED] Any relevant habits

Conversation History:
  + Last 10 conversation turns (working memory window)

User Message:
  + Current user input
```

### 10.4 Habit Detection Algorithm

```
1. Log every user-initiated task with: { action, time, day_of_week, context }
2. Group tasks by (action, time_window) pairs
3. If same (action, time_window) occurs 3+ times → candidate habit
4. Calculate confidence score based on frequency and recency
5. If confidence > 0.75 → store as confirmed habit
6. Trigger proactive suggestion when conditions match
```

---

## 11. Emotion Detection Design

### 11.1 Emotion Signal Sources

| Signal | Data Collected | Sensitivity | Privacy |
|--------|---------------|-------------|---------|
| Typing dynamics | WPM, rhythm, error rate, pause duration | High | Local only |
| Voice tone | Pitch, energy, speech rate, jitter | High | Local only |
| Time-of-day behavior | Task type vs. clock time baseline | Medium | Local only |
| Webcam (optional) | Facial expression via MediaPipe | High | Opt-in, never stored |

### 11.2 Emotion State Model

ELIXI recognizes the following primary emotional states:

| State | Indicators | ELIXI Response |
|-------|-----------|----------------|
| Focused | Normal WPM, low errors, direct commands | Minimal interruptions, concise answers |
| Stressed | High WPM, high errors, short commands | Calming tone, break suggestions |
| Fatigued | Low WPM, long pauses, late-night usage | Gentle tone, suggest rest |
| Frustrated | Repeated commands, uppercase, "!!" | Empathetic acknowledgment, slow down |
| Motivated | High WPM, complex tasks, morning time | Energetic, proactive suggestions |
| Neutral | Baseline metrics | Standard responses |

### 11.3 Emotion Processing Pipeline

```
Raw Signals
    ↓
Signal Normalizers (per-user baseline calibration)
    ↓
Feature Extractors (WPM, pitch variance, error rate)
    ↓
Individual Signal Classifiers (per-source emotion score)
    ↓
Emotion Aggregator (weighted fusion of signals)
    ↓
Confidence Threshold Check (min 0.6 confidence)
    ↓
Emotion State Update (broadcast to frontend + inject into LLM prompt)
    ↓
Response Modulator (adjust LLM system prompt tone)
```

### 11.4 Privacy Guarantees

- Webcam analysis is **opt-in only** and requires explicit permission.
- Webcam frames are processed locally, never stored, never recorded.
- Typing dynamics data is aggregated — raw keystrokes are never logged.
- All emotion data remains on-device.
- Users can view, export, or delete their emotion history at any time.

---

## 12. Voice Pipeline

### 12.1 Full Voice Flow

```
                    ELIXI VOICE PIPELINE
                    
[Microphone Input]
        ↓
[VAD - Voice Activity Detection]
    ↙          ↘
Silence      Speech Detected
(ignore)         ↓
         [Wake Word Detector]
              ↙        ↘
         No match    "Hey ELIXI"
         (ignore)         ↓
                  [Audio Capture: record until silence]
                          ↓
                  [STT Engine: Whisper / Vosk]
                          ↓
                  [Transcript → Backend]
                          ↓
                  [Intent Engine: classify + extract]
                          ↓
                  [LLM: generate response]
                          ↓
                  [Action Executor: run commands]
                          ↓
                  [TTS Engine: Coqui TTS synthesize]
                          ↓
                  [Audio Output: speaker]
```

### 12.2 STT Configuration

**Primary: OpenAI Whisper (local)**
- Model: `whisper-base` (74M params, fast) or `whisper-small` (244M, accurate)
- Language: Auto-detect (configurable to English for speed)
- Processing: Runs on GPU if available, CPU fallback
- Latency: ~0.5–2 seconds depending on hardware

**Fallback: Vosk**
- Ultra-lightweight (50MB model)
- Streaming-capable for real-time partial transcripts
- Lower accuracy but faster on low-end hardware

### 12.3 TTS Configuration

**Coqui TTS**
- Model: `tts_models/en/ljspeech/tacotron2-DDC` (high quality)
- Voice cloning support for custom voice (future Phase 8)
- Emotion-modulated speech rate and pitch
- Output: WAV audio streamed to frontend

### 12.4 Wake Word

- Primary: Porcupine (offline, low CPU)
- Custom phrase: "Hey ELIXI"
- Sensitivity: Configurable (0.0–1.0)
- Always-on mode (runs in separate thread)
- Can be disabled by hotkey or in Settings

---

## 13. System Automation Design

### 13.1 Automation Safety Model

```
User Command (natural language)
        ↓
Intent Parser → Automation Intent detected
        ↓
Command Builder → Constructs structured command object
        ↓
Command Validator → Checks against whitelist
        ↓
Permission Check → Verified tier
        ↓
Preview Generation → Human-readable "I will: ..."
        ↓
User Confirmation (if T3/T4)
        ↓
Execution → child_process.execFile() (NOT exec/shell)
        ↓
Result Capture → stdout/stderr → response to user
        ↓
Audit Log → Written
```

### 13.2 Supported Automation Categories

**Application Control**
```
Commands: "open [app]", "close [app]", "switch to [app]", "minimize all"
Implementation: 
  Windows: PowerShell Start-Process / Stop-Process
  macOS: AppleScript / open command
  Linux: xdg-open / wmctrl
```

**File Management**
```
Commands: "search for [file]", "create folder [name]", "move [file] to [path]"
Implementation: Node.js fs module + Python pathlib
Safety: Restricted to user home directory by default
Elevated permission needed to access system directories
```

**Workflow Execution**
```
Command: "Prepare my coding workspace"
Workflow Definition (JSON):
{
  "id": "coding_workspace",
  "name": "Coding Workspace",
  "steps": [
    { "action": "open_app", "target": "vscode", "delay": 0 },
    { "action": "open_terminal", "delay": 2000 },
    { "action": "run_command", "cmd": "npm run dev", "delay": 1000 },
    { "action": "open_browser", "url": "http://localhost:3000", "delay": 3000 }
  ]
}
```

**System Information**
```
Commands: "what's my CPU usage?", "how much RAM is free?", "show battery"
Implementation: systeminformation npm package + Python psutil
Permission: T1 (always safe, no prompt)
```

---

## 14. Integration Architecture

### 14.1 Integration Overview

| Phase | Integration | Method |
|-------|------------|--------|
| 7 | VS Code | VS Code Extension API / CLI |
| 7 | GitHub | GitHub CLI + REST API (personal token) |
| 7 | Browser | Browser Extensions / CDP (Chrome DevTools Protocol) |
| 7 | Email | IMAP/SMTP via local client (Thunderbird, Outlook) |
| 7 | Calendar | CalDAV / ICS file parsing |
| 7 | Slack | Slack desktop app control + REST API |

### 14.2 VS Code Integration

- **Open Project:** `code /path/to/project`
- **Run Task:** `code --task taskName`
- **Install Extension:** `code --install-extension ext.name`
- **View Git Status:** `git status` via integrated terminal
- **ELIXI VS Code Extension (Phase 8):** Sidebar panel inside VS Code.

### 14.3 GitHub Integration

```
Authentication: Personal Access Token (stored encrypted, never in plaintext)
Capabilities:
  - List recent commits: gh api repos/{owner}/{repo}/commits
  - PR status: gh pr list
  - Issue tracking: gh issue list
  - Repo clone: gh repo clone
```

---

## 15. UI/UX Design

### 15.1 Design Language

| Property | Value |
|----------|-------|
| Theme | Dark-first, with light mode option |
| Primary Color | `#6366f1` (Indigo-500) |
| Accent Color | `#8b5cf6` (Violet-500) |
| Background | `#0f0f1a` (near-black with blue tint) |
| Surface | `#1a1a2e` (deep navy) |
| Text Primary | `#e2e8f0` |
| Text Secondary | `#94a3b8` |
| Font | Inter / JetBrains Mono (code) |
| Border Radius | 12px (cards), 24px (chat bubbles) |
| Animation | Smooth 200–400ms easing |

### 15.2 Key Screens

**Chat Interface (Primary)**
```
┌─────────────────────────────────────────────────────────┐
│  [ELIXI Logo]    Intelligence with Empathy    [⚙] [🎤]  │
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│ Sidebar  │          Chat Area                          │
│          │  ┌──────────────────────────┐              │
│ [Chat]   │  │ ELIXI                    │              │
│ [Tasks]  │  │ Hello! How can I help    │              │
│ [Memory] │  │ you today?               │              │
│ [Auto.]  │  └──────────────────────────┘              │
│ [Settings│                                              │
│          │  ┌──────────────────────────┐              │
│          │  │ You                      │              │
│ Emotion: │  │ Open VS Code             │              │
│ 🟢 Focus │  └──────────────────────────┘              │
│          │                                              │
│ Persona: │  [Voice Wave Animation]                     │
│ Prof.    │                                              │
│          ├──────────────────────────────────────────────│
│          │  [🎤] [Type a message...              ] [→] │
└──────────┴──────────────────────────────────────────────┘
```

**Features:**
- Markdown-rendered AI responses with code highlighting.
- Streaming token display (typewriter effect).
- Voice waveform animation when speaking.
- Emotion indicator in sidebar.
- Quick command chips above input bar.
- Message timestamps on hover.

### 15.3 Personality Mode Visual Indicators

| Mode | Accent Color | Font Weight | Animation Speed |
|------|-------------|-------------|-----------------|
| Professional | Indigo | Medium | Normal |
| Friendly | Amber | Light | Bouncy |
| Calm | Teal | Thin | Slow |
| Focus | Gray | Bold | Minimal |
| Silent | Dark Gray | Medium | None |

### 15.4 Accessibility
- WCAG 2.1 AA color contrast compliance.
- Full keyboard navigation.
- Screen reader ARIA labels.
- Configurable font sizes (small / medium / large).
- Reduced motion setting for users with motion sensitivity.

---

## 16. Data Flow Diagrams

### 16.1 Chat Message Flow

```
User Types Message
      │
      ▼
[React ChatInput Component]
      │ Socket.io emit('chat:send')
      ▼
[Node.js Backend - chat.controller.ts]
      │ POST /ai/chat (with context + emotion + persona)
      ▼
[Python FastAPI - AI Engine]
      │ Semantic memory search (ChromaDB)
      │ Fact injection (SQLite)
      │ Prompt construction
      │ Ollama inference (streaming)
      ▼
[Token Stream → Backend → Socket.io emit('chat:token')]
      │
      ▼
[React UI - streaming token display]
      │
      ▼
[Response complete → intent extraction]
      │ [if automation intent detected]
      ▼
[automation.service.ts → permission check → execute]
      │
      ▼
[Result injected into final response]
      │
      ▼
[Memory consolidation: store message + update embeddings]
```

### 16.2 Voice Command Flow

```
[Microphone] → [Wake Word Detector]
                       │ "Hey ELIXI" detected
                       ▼
               [Audio Capture starts]
                       │
                       ▼
              [VAD: silence detected = end of utterance]
                       │
                       ▼
              [Whisper STT: audio → transcript text]
                       │ WebSocket → Backend
                       ▼
              [Same as Chat Message Flow above ↑]
                       │
                       ▼
              [AI Response text → Coqui TTS → audio]
                       │
                       ▼
              [Play audio through speakers]
```

### 16.3 Emotion Detection Flow

```
[Typing events] ──────────────────────┐
[Voice audio tone] ───────────────────┤
[Time of day] ────────────────────────┤──→ [Emotion Aggregator]
[Face video frames (opt-in)] ─────────┘          │
                                          Emotion State + Confidence
                                                  │
                              ┌───────────────────┼───────────────────────┐
                              ▼                   ▼                       ▼
                    [Update UI Indicator]  [Inject into LLM prompt] [Log to SQLite]
```

---

## 17. Phase-Wise Development Roadmap

### Phase 1 – Core AI Assistant
**Goal:** Working desktop AI assistant with chat UI.

| Task | Description | Priority |
|------|-------------|----------|
| P1-01 | Electron shell + BrowserWindow setup | Critical |
| P1-02 | React UI with TailwindCSS | Critical |
| P1-03 | Chat interface components | Critical |
| P1-04 | Node.js backend + Express + Socket.io | Critical |
| P1-05 | Python FastAPI AI engine basic setup | Critical |
| P1-06 | Ollama integration (Llama3 / Mistral) | Critical |
| P1-07 | Streaming token response to UI | High |
| P1-08 | Basic system commands (open app, system info) | High |
| P1-09 | SQLite basic setup | Medium |
| P1-10 | Settings page (personality mode, model select) | Medium |

**Deliverable:** Working desktop app with real-time AI chat and basic commands.

### Phase 2 – System Automation
**Goal:** Deep OS-level automation and workflow execution.

| Task | Description |
|------|-------------|
| P2-01 | Application controller (open/close/switch) |
| P2-02 | File manager automation |
| P2-03 | Permission system and UI dialog |
| P2-04 | Workflow definition format (JSON) |
| P2-05 | Workflow executor engine |
| P2-06 | Workflow builder UI |
| P2-07 | Audit log implementation |
| P2-08 | Pre-built workflows (coding, meeting) |

**Deliverable:** Automation engine with permission-gated multi-step workflows.

### Phase 3 – Voice Interaction
**Goal:** Full hands-free voice interaction.

| Task | Description |
|------|-------------|
| P3-01 | Microphone capture (PyAudio) |
| P3-02 | Voice Activity Detection (Silero VAD) |
| P3-03 | Wake word detection ("Hey ELIXI") |
| P3-04 | Whisper STT integration |
| P3-05 | Vosk fallback STT |
| P3-06 | Coqui TTS integration |
| P3-07 | Voice session management |
| P3-08 | Voice waveform UI animation |
| P3-09 | Voice settings (speed, volume, voice) |

**Deliverable:** Complete hands-free voice assistant mode.

### Phase 4 – Personal Memory Engine
**Goal:** Cross-session memory, preferences, and habit tracking.

| Task | Description |
|------|-------------|
| P4-01 | Short-term memory (session context) |
| P4-02 | Long-term memory (SQLite structured) |
| P4-03 | ChromaDB vector integration |
| P4-04 | Sentence-transformer embedding model |
| P4-05 | Memory injection into prompts |
| P4-06 | Habit detection algorithm |
| P4-07 | Proactive habit suggestions |
| P4-08 | Memory browser UI |

**Deliverable:** ELIXI remembers users across sessions and detects habits.

### Phase 5 – Emotional Intelligence
**Goal:** Emotion-aware, empathetic assistant.

| Task | Description |
|------|-------------|
| P5-01 | Typing dynamics analyzer |
| P5-02 | Voice tone analyzer |
| P5-03 | Time-of-day behavior tracker |
| P5-04 | Emotion aggregator + state model |
| P5-05 | Response tone modulator |
| P5-06 | Emotion indicator UI |
| P5-07 | Optional webcam analyzer (opt-in) |
| P5-08 | Empathetic response templates |

**Deliverable:** ELIXI detects and responds to user emotional state.

### Phase 6 – Adaptive Learning
**Goal:** ELIXI learns, predicts, and proactively automates.

| Task | Description |
|------|-------------|
| P6-01 | Pattern detection across task history |
| P6-02 | Predictive task suggestions UI |
| P6-03 | User vocabulary adaptation |
| P6-04 | Smart workflow suggestions |
| P6-05 | Response verbosity adaptation |
| P6-06 | Learning dashboard UI |

**Deliverable:** ELIXI proactively suggests and automates learned behaviors.

### Phase 7 – Integration Ecosystem
**Goal:** Connect ELIXI to developer and productivity tools.

| Task | Description |
|------|-------------|
| P7-01 | VS Code integration |
| P7-02 | GitHub CLI integration |
| P7-03 | Browser control (Chrome DevTools Protocol) |
| P7-04 | Email integration (IMAP summary) |
| P7-05 | Calendar integration (CalDAV) |
| P7-06 | Integration management UI |
| P7-07 | OAuth + local token storage (encrypted) |

**Deliverable:** ELIXI controls and reads from VS Code, GitHub, browser, and calendar.

### Phase 8 – Advanced Personality System
**Goal:** Distinct, responsive personality modes.

| Task | Description |
|------|-------------|
| P8-01 | Personality mode engine |
| P8-02 | Per-mode system prompt templates |
| P8-03 | Per-mode UI theme variants |
| P8-04 | Per-mode TTS voice settings |
| P8-05 | Automatic mode switching based on time/context |
| P8-06 | Personality customization UI |
| P8-07 | VS Code extension sidebar (ELIXI panel) |
| P8-08 | Voice cloning / custom voice (optional) |

**Deliverable:** Full-featured ELIXI with distinct, context-adaptive personalities.

---

## 18. Testing Strategy

### 18.1 Testing Pyramid

```
         ┌───────────┐
         │  E2E Tests │  ← Playwright / Spectron (Electron E2E)
         ├───────────┤
         │Integration │  ← Supertest (API), Socket.io test client
         ├───────────┤
         │Unit Tests  │  ← Jest (Node/React), pytest (Python)
         └───────────┘
```

### 18.2 Unit Testing

**Node.js Backend (Jest + ts-jest)**
- Service layer logic (ai.service, automation.service)
- Permission tier classification
- Input sanitization functions
- Command whitelist validation

**Python AI Engine (pytest)**
- Intent classification accuracy
- Entity extraction correctness
- Memory storage and retrieval
- Emotion signal processing

**React UI (Jest + React Testing Library)**
- Component rendering
- State management
- Socket.io event handling
- Input handling and validation

### 18.3 Integration Testing

- Full chat message flow (React → Backend → AI Engine → Response)
- Automation command execution (with mocked child_process)
- Memory read/write round-trips
- WebSocket event ordering

### 18.4 Security Testing

- Input fuzzing for automation commands (verify sanitization)
- Permission bypass attempts (verify tier enforcement)
- IPC message spoofing attempts (verify contextBridge isolation)
- SQL injection testing (verify parameterized queries)
- Command injection testing (verify execFile argument arrays)

### 18.5 Performance Benchmarks

| Metric | Target |
|--------|--------|
| Chat response first token | < 500ms |
| Full response (100 tokens) | < 3 seconds |
| Voice STT latency | < 1.5 seconds |
| App startup time | < 3 seconds |
| Memory search (1000 entries) | < 100ms |
| Automation command execution | < 2 seconds |

---

## 19. Deployment Strategy

### 19.1 Development Environment Setup

**Required Software:**
```
Node.js 20.x LTS
Python 3.11.x
Ollama (latest)
Git

npm packages: electron-builder, concurrently, ts-node
Python packages: fastapi, uvicorn, ollama, chromadb, torch, whisper, TTS

LLM Models (via Ollama):
  ollama pull llama3
  ollama pull mistral
```

**Development Start Command:**
```bash
# Terminal 1: Start all services
npm run dev:all

# Which runs concurrently:
# - Electron + React dev server (Vite, port 5173)
# - Node.js backend (ts-node, port 3001)
# - Python AI Engine (uvicorn, port 8000)
# - Python Voice Engine (uvicorn, port 8001)
```

### 19.2 Production Build

**Electron Packaging (electron-builder):**
```json
{
  "build": {
    "appId": "com.elixi.assistant",
    "productName": "ELIXI",
    "win": { "target": "nsis" },
    "mac": { "target": "dmg" },
    "linux": { "target": "AppImage" }
  }
}
```

**Python Bundling:**
- Python AI Engine and Voice Engine are packaged using **PyInstaller**.
- Bundled as standalone executables included in the Electron app resources.
- Ollama is installed separately by the user (documented in README).

### 19.3 Auto-Update Strategy
- Electron app checks GitHub Releases for new versions.
- Python engine updates handled by the Electron app's update mechanism.
- User is notified of updates and can apply them with one click.

### 19.4 Cross-Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| Windows 10/11 | Full support | Primary development platform |
| macOS 12+ | Full support | Requires codesigning |
| Ubuntu 22.04+ | Full support | AppImage distribution |

---

## 20. Future Scalability Plan

### 20.1 Planned Post-Phase-8 Features

| Feature | Description | Estimated Phase |
|---------|-------------|-----------------|
| Multi-model routing | Automatically select best LLM per task type | Post-8 |
| Plugin system | Third-party ELIXI plugins via npm-style registry | Post-8 |
| Multi-user profiles | Separate memory/settings per OS user | Post-8 |
| Mobile companion app | iOS/Android app for remote interaction | Post-8 |
| ELIXI Cloud Sync (opt-in) | Encrypted sync of preferences across devices | Post-8 |
| Custom wake word | User-trained personal wake phrase | Post-8 |
| Real-time screen reading | ELIXI can "see" and describe screen content | Post-8 |
| Agent mode | Multi-step autonomous task completion | Post-8 |
| Fine-tuned personal model | Train a local model on user interaction data | Post-8 |

### 20.2 Architecture Scalability

**Horizontal AI Scaling**
- AI Engine can be scaled to multiple Ollama instances.
- Task Planner distributes inference tasks across models.

**Memory Scalability**
- ChromaDB supports millions of vectors with persistence.
- SQLite scales to gigabytes of structured data for personal use.
- For team use: PostgreSQL + pgvector drop-in replacements.

**Plugin Architecture (Post-Phase 8)**
```
plugin.manifest.json
  └── name: "ELIXI GitHub Pro"
  └── version: "1.0.0"
  └── intents: ["github.*"]
  └── entry: "index.js"
  └── permissions: ["network", "file_read"]
```

### 20.3 Model Upgrade Path

| Current | Upgrade Path |
|---------|-------------|
| Llama 3 8B | Llama 3 70B (better hardware) |
| Whisper Base | Whisper Medium/Large (better accuracy) |
| Coqui standard voice | Custom cloned voice |
| sentence-transformers | Custom fine-tuned embedding model |

---

## Appendix A: Environment Variables

```env
# Backend
NODE_ENV=development
BACKEND_PORT=3001
AI_ENGINE_URL=http://localhost:8000
VOICE_ENGINE_URL=http://localhost:8001
ENCRYPTION_KEY_SALT=<random-16-bytes-hex>

# AI Engine
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3
CHROMA_DB_PATH=../memory/chroma_store
SQLITE_DB_PATH=../memory/elixi.db
EMBEDDING_MODEL=all-MiniLM-L6-v2

# Voice Engine
VOICE_SAMPLE_RATE=16000
WHISPER_MODEL_SIZE=base
TTS_MODEL=tts_models/en/ljspeech/tacotron2-DDC
WAKE_WORD_SENSITIVITY=0.5
```

## Appendix B: Command Whitelist Examples

```json
{
  "allowed_commands": [
    { "pattern": "open_app", "tier": 2, "description": "Open an application" },
    { "pattern": "search_file", "tier": 1, "description": "Search for files" },
    { "pattern": "create_folder", "tier": 3, "description": "Create a new folder" },
    { "pattern": "run_npm", "tier": 4, "description": "Run npm commands" },
    { "pattern": "run_git", "tier": 4, "description": "Run git commands" }
  ],
  "blocked_commands": [
    "rm -rf", "format", "del /f /s", "shutdown", "regedit",
    "net user", "passwd", "sudo rm", "mkfs", "fdisk"
  ]
}
```

---

*This document defines the complete specification for ELIXI. It represents the contract between design intent and implementation.*

*© 2026 ELIXI Project — All rights reserved.*

---

> **STATUS: PHASE 1 IMPLEMENTED**
>
> Type `START PHASE 2` to begin implementing the next roadmap phase.
