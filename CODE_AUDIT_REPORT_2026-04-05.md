# ELIXI Code Audit Report

Date: 2026-04-05
Scope: Full workspace static diagnostics, build validation, startup-path validation, and integration consistency review.

## Summary

The codebase currently compiles cleanly for frontend, electron, and backend TypeScript targets.
No editor diagnostics were reported at workspace level.

High-impact issues found were integration-level (runtime/config consistency) rather than syntax/type errors. These were fixed in this pass.

## Checks Performed

1. Workspace diagnostics scan (all files)
2. Full build run from root
3. Backend-only build run after fixes
4. Cross-file search for auth/env/endpoint consistency
5. Startup script review and documentation consistency review

## Issues Found And Fixed

### 1) AI engine host inconsistency in backend services

Problem:
- Different defaults were used for AI engine URL in backend services.
- One service used localhost while other services used 127.0.0.1.
- This can cause intermittent connectivity differences depending on IPv4/IPv6 resolution.

Fix:
- Standardized backend AI engine default to http://127.0.0.1:8000 in backend service layer.

Updated file:
- backend/src/services/ai.service.ts

### 2) Brittle AI auth credential defaults

Problem:
- Backend token client used a hardcoded fallback password that did not match the AI engine example defaults.
- This can fail token exchange when users rely on standard env samples.

Fix:
- Added explicit env priority chain:
  - AI_ENGINE_AUTH_USERNAME or AUTH_USERNAME or elixi_admin
  - AI_ENGINE_AUTH_PASSWORD or AUTH_PASSWORD or change_me_to_a_strong_password
- This improves compatibility and allows backend-only overrides without changing global auth variables.

Updated file:
- backend/src/services/aiAuth.service.ts

### 3) Startup documentation drift

Problem:
- README still described voice engine as optional in default browser startup flow.
- Current startup scripts now include voice engine in default dev flow.

Fix:
- Updated README startup section to reflect that npm run dev starts AI engine, voice engine, backend, and UI.

Updated file:
- README.md

## Existing Previously-Fixed Stability Improvements Confirmed

These changes were already present and were re-validated in this audit context:

1. Voice capabilities endpoint degrades gracefully (no backend 500 when voice engine is offline)
2. Default voice engine host set to 127.0.0.1 for reliability on Windows loopback
3. Default dev flow includes voice engine startup
4. predev:web cleanup script exists to reduce stale port collisions

## Validation Results

- Root build: PASS
  - desktop UI build passed
  - electron TypeScript build passed
  - backend TypeScript build passed
- Post-fix backend build: PASS
- File-level diagnostics in edited files: PASS (no errors)

## Residual Risks / Recommended Follow-Ups

1. Runtime smoke tests still depend on local port state and already-running processes
- Recommendation: always run npm run dev (or npm run dev:web) from a clean terminal and verify /health endpoints for ports 3001, 8000, and 8001.

2. Python runtime checks are not fully captured by TypeScript build
- Recommendation: run AI and voice service startup smoke tests and endpoint probes after environment changes.

3. Credential management hardening
- Recommendation: define AI_ENGINE_AUTH_USERNAME and AI_ENGINE_AUTH_PASSWORD explicitly in backend environment config for production-like runs.

## Files Changed In This Audit Pass

1. backend/src/services/ai.service.ts
2. backend/src/services/aiAuth.service.ts
3. README.md
4. CODE_AUDIT_REPORT_2026-04-05.md

---

## Second Pass: Runtime-Only Validation

Date: 2026-04-05 (second pass)
Scope: Live runtime smoke tests for ports 3001/8000/8001 and end-to-end chat/voice flows.

### Runtime Test Method

1. Start services in development mode
2. Probe direct health endpoints:
  - backend: 127.0.0.1:3001/health
  - ai-engine: 127.0.0.1:8000/health
  - voice-engine: 127.0.0.1:8001/health
3. Exercise backend chat flow:
  - POST /api/chat/message
  - GET /api/chat/history
4. Exercise backend voice flow:
  - GET /api/voice/status
  - GET /api/voice/capabilities
  - POST /api/voice/tts
5. Exercise provider diagnostics:
  - GET /ai/providers/status

### Additional Runtime Fixes Applied During Second Pass

1. backend voice proxy reliability improvement
- Added one retry with extended timeout for TTS proxy calls.
- File: backend/src/services/voice.service.ts

2. voice-engine async responsiveness hardening
- Moved synchronous STT/TTS/VAD execution to worker threads via asyncio.to_thread in request/websocket paths.
- File: voice-engine/voice_server.py

3. voice startup stability tuning
- Disabled uvicorn reload mode for default voice startup command to reduce reload-related instability on Windows.
- File: package.json

4. reusable runtime smoke script
- Added deterministic smoke script for repeatable runtime validation.
- File: scripts/runtime-smoke.ps1

### Final Runtime Results (authoritative second-pass run)

1. health_backend_3001: PASS (200)
2. health_ai_8000: PASS (200)
3. health_voice_8001: FAIL (timeout)
4. chat_e2e_backend_api: PASS (200)
5. chat_history_backend_api: PASS (200)
6. voice_status_backend_api: PASS (200, degraded engineHealthy=false)
7. voice_capabilities_backend_api: PASS (200, degraded available=false)
8. voice_tts_backend_api: FAIL (500 after upstream timeout)
9. ai_provider_status_backend_api: PASS (200)

### Runtime Conclusions

1. Chat runtime path is healthy end-to-end through backend and AI engine.
2. Voice integration now fails gracefully for status/capabilities (no hard backend crash).
3. The remaining blocker is voice-engine runtime availability on 8001 (timeouts/hung responses), which causes TTS failure.

### Remaining High-Priority Runtime Blocker

Observed behavior:
- Port 8001 can be bound but /health may not respond (connection accepted then no response).
- Backend then reports degraded voice state and TTS proxy eventually times out.

Impact:
- Voice feature set is not reliable at runtime despite successful startup logs.

Recommended next focused remediation:
1. Isolate voice engine as a standalone process without dev orchestrator and verify health + tts repeatedly.
2. Add internal watchdog endpoint timing in voice engine (request latency logging around /health and /voice/tts).
3. Add backend circuit-breaker for /api/voice/tts to return explicit 503 with actionable message when voice engine is unavailable.
4. If Windows audio stack is unstable in current environment, fallback to non-blocking mock TTS mode for development.
