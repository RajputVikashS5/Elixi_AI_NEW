# PHASE 5 COMPREHENSIVE TEST SUITE

## Executive Summary
This document outlines comprehensive testing for all functionality implemented through Phase 5 of the ELIXI project.

**Test Date:** April 6, 2026  
**Scope:** AI Engine, Backend, Voice, Desktop UI, Camera, Memory, and Integration Tests

---

## Infrastructure Status

### Prerequisites
- [ ] Python 3.11+ with venv activated (.venv)
- [ ] Node.js 18+ installed
- [ ] Ollama running (for local LLM tests)
- [ ] Backend database initialized
- [ ] Environment files configured (.env, .env.local)

### Ports Required
- 8000: AI Engine (FastAPI)
- 8001: Voice Engine (FastAPI)
- 3001: Backend (Express/Node)
- 5173: Desktop UI (Vite dev server)
- 11434: Ollama (if local testing)

---

## TEST SUITE 1: AI ENGINE CORE FUNCTIONALITY

### Test 1.1 - AI Engine Startup
**Objective:** Verify AI engine starts without errors
```bash
cd ai-engine
..\.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
**Expected Result:**
- Server starts on port 8000
- No critical errors in startup log
- Health check endpoint responds

**Status:** [ ] Pass [ ] Fail

---

### Test 1.2 - Intent Classification
**Endpoint:** `POST /ai/intent`
**Payload:**
```json
{
  "message": "what's the weather today"
}
```
**Expected Result:**
- Returns IntentResponse with intent category
- Confidence score included
- Entities extracted

**Status:** [ ] Pass [ ] Fail

---

### Test 1.3 - Session Greeting (Stream)
**Endpoint:** `POST /ai/chat`
**Payload:**
```json
{
  "sessionId": "test-session-new",
  "message": "hi",
  "stream": true,
  "llmProvider": "ollama"
}
```
**Expected Result:**
- Returns SSE stream (Content-Type: text/event-stream)
- First payload contains greeting with `done: true`
- Includes ELIXI personality fields: intent, emotion_detected, response_text, voice_tone, action, confidence
- Payload format: `data: {...}\n\n`

**Status:** [ ] Pass [ ] Fail

---

### Test 1.4 - Session Greeting (Non-Stream)
**Endpoint:** `POST /ai/chat`
**Payload:**
```json
{
  "sessionId": "test-session-new2",
  "message": "hello",
  "stream": false,
  "llmProvider": "ollama"
}
```
**Expected Result:**
- Returns JSON ChatResponse (not streaming)
- Contains greeting message
- All ELIXI personality fields present

**Status:** [ ] Pass [ ] Fail

---

### Test 1.5 - Chat Message Streaming
**Endpoint:** `POST /ai/chat`
**Payload:**
```json
{
  "sessionId": "test-session-new",
  "message": "tell me about AI",
  "stream": true,
  "llmProvider": "ollama"
}
```
**Expected Result:**
- Stream of tokens returned as SSE
- Each token as `{"token": "...", "done": false}`
- Final payload with `done: true` and full response metadata
- Response includes intent, emotion, voice_tone, actions

**Status:** [ ] Pass [ ] Fail

---

### Test 1.6 - Emotion Detection
**Objective:** Verify emotion detection is integrated
**Test:** Send emotionally-coded message
**Payload:**
```json
{
  "sessionId": "emotion-test",
  "message": "I'm so happy and excited!",
  "stream": false,
  "llmProvider": "ollama",
  "emotionContext": {
    "state": "happy",
    "source": "text",
    "confidence": 0.9
  }
}
```
**Expected Result:**
- Response includes voice_tone mapped from emotion
- Emotion field in response matches context

**Status:** [ ] Pass [ ] Fail

---

### Test 1.7 - System Info Intent
**Objective:** Test automation/system info endpoint
**Payload:**
```json
{
  "sessionId": "system-test",
  "message": "what's my system status",
  "stream": false,
  "llmProvider": "ollama"
}
```
**Expected Result:**
- Intent classified as automation.system_info
- Response includes CPU, RAM, OS, Uptime information
- Formatted text response

**Status:** [ ] Pass [ ] Fail

---

## TEST SUITE 2: PROVIDER & LLM ROUTING

### Test 2.1 - Ollama Provider (Local)
**Objective:** Verify local Ollama integration
**Payload:**
```json
{
  "sessionId": "ollama-test",
  "message": "hello",
  "stream": true,
  "llmProvider": "ollama",
  "ollamaModel": "llama3"
}
```
**Expected Result:**
- Response received from Ollama
- Streaming works without errors
- Fallback available if Ollama disconnects

**Status:** [ ] Pass [ ] Fail

---

### Test 2.2 - OpenRouter Provider (Online)
**Objective:** Verify online provider integration
**Prerequisites:** OpenRouter API key configured in .env
**Payload:**
```json
{
  "sessionId": "openrouter-test",
  "message": "hello",
  "stream": true,
  "llmProvider": "online",
  "onlineModel": "meta-llama/llama-3-8b-instruct"
}
```
**Expected Result:**
- Response received from OpenRouter
- Streaming works
- Proper error handling if API key missing

**Status:** [ ] Pass [ ] Fail

---

### Test 2.3 - Provider Fallback
**Objective:** Test fallback from online to local
**Setup:** Configure bad OpenRouter key or network error
**Payload:**
```json
{
  "sessionId": "fallback-test",
  "message": "this should fallback",
  "stream": true,
  "llmProvider": "online"
}
```
**Expected Result:**
- Detects online provider failure
- Falls back to Ollama automatically
- Warning logged in ai-engine logs

**Status:** [ ] Pass [ ] Fail

---

## TEST SUITE 3: MEMORY & CONTEXT SYSTEM

### Test 3.1 - Memory Recording
**Objective:** Verify chat history is recorded
**Steps:**
1. Send message in session-memory-test: "My favorite color is blue"
2. Send new message: "What's my favorite color?"
**Expected Result:**
- Second message receives correct context
- Short-term memory contains previous message
- Response references blue

**Status:** [ ] Pass [ ] Fail

---

### Test 3.2 - Long-term Facts
**Objective:** Verify fact storage and retrieval
**Payload:**
```json
{
  "sessionId": "facts-test",
  "message": "Remember that I'm a software engineer",
  "stream": false,
  "llmProvider": "ollama"
}
```
**Follow-up:** Ask later session or new session if fact persists
**Expected Result:**
- Fact stored in long-term memory
- Retrieved in subsequent requests

**Status:** [ ] Pass [ ] Fail

---

### Test 3.3 - Vector Memory (Semantic Search)
**Objective:** Verify embeddings and semantic search
**Prerequisite:** ChromaDB and sentence-transformers initialized
**Test:** Send context-dependent question after similar topics
**Expected Result:**
- Relevant vector matches returned
- Semantic similarity working

**Status:** [ ] Pass [ ] Fail

---

## TEST SUITE 4: CAMERA FUNCTIONALITY

### Test 4.1 - Camera Status Check
**Endpoint:** `GET /ai/emotion/camera-enabled`
**Expected Result:**
- Returns `{"enabled": true|false}`

**Status:** [ ] Pass [ ] Fail

---

### Test 4.2 - Enable Camera
**Endpoint:** `POST /ai/emotion/camera-enabled`
**Payload:** `{"enabled": true}`
**Expected Result:**
- Webcam access initialized
- No permission errors
- Camera frame capture thread started

**Status:** [ ] Pass [ ] Fail

---

### Test 4.3 - Disable Camera
**Endpoint:** `POST /ai/emotion/camera-enabled`
**Payload:** `{"enabled": false}`
**Expected Result:**
- Camera thread cleanly stops
- No hanging processes
- Ready for re-enable

**Status:** [ ] Pass [ ] Fail

---

### Test 4.4 - Camera Auto-Enable on Startup
**Setup:** Configure environment
```
ELIXI_CAMERA_AUTO_ENABLE=true
```
**Action:** Restart AI engine
**Expected Result:**
- Camera automatically enabled on startup
- No manual enable needed

**Status:** [ ] Pass [ ] Fail

---

## TEST SUITE 5: VOICE FUNCTIONALITY

### Test 5.1 - Voice Engine Startup
```bash
cd voice-engine
..\.venv\Scripts\python.exe -m uvicorn voice_server:app --port 8001
```
**Expected Result:**
- Server starts on port 8001
- No initialization errors

**Status:** [ ] Pass [ ] Fail

---

### Test 5.2 - Voice Activity Detection
**Objective:** Verify VAD is working
**Test:** Record audio with varying silence periods
**Expected Result:**
- Voice activity correctly detected
- Low latency response

**Status:** [ ] Pass [ ] Fail

---

### Test 5.3 - Speech-to-Text (STT)
**Test:** Send audio file to STT endpoint
**Expected Result:**
- Transcription accurate
- Supports streaming input

**Status:** [ ] Pass [ ] Fail

---

### Test 5.4 - Text-to-Speech (TTS)
**Test:** Send text to TTS endpoint
**Expected Result:**
- Audio output generated
- Proper voice tone applied (neutral, happy, etc.)

**Status:** [ ] Pass [ ] Fail

---

## TEST SUITE 6: BACKEND INTEGRATION

### Test 6.1 - Backend Startup
```bash
npm run dev
```
**Expected Result:**
- Backend server starts on port 3001
- No database errors
- All routes initialized

**Status:** [ ] Pass [ ] Fail

---

### Test 6.2 - Chat Socket Integration
**Objective:** Verify socket.io streaming
**Test:** Connect to socket and send chat message with stream
**Expected Result:**
- SSE payload correctly parsed
- Socket emits individual tokens
- Final `chat:complete` event with full response

**Status:** [ ] Pass [ ] Fail

---

### Test 6.3 - System Info Endpoint
**Endpoint:** `GET /api/system/info`
**Expected Result:**
- Returns CPU, RAM, OS, uptime data
- Proper formatting

**Status:** [ ] Pass [ ] Fail

---

### Test 6.4 - Automation Routes
**Objective:** Verify automation/workflow support
**Test:** Send workflow request to backend
**Expected Result:**
- Workflow commands executed
- Audit logged
- Response contains action results

**Status:** [ ] Pass [ ] Fail

---

## TEST SUITE 7: DESKTOP UI INTEGRATION

### Test 7.1 - App Startup
```bash
npm run dev
```
**Expected Result:**
- React dev server starts (5173)
- Electron window opens
- UI loads without errors
- WebGL/3D rendering functional

**Status:** [ ] Pass [ ] Fail

---

### Test 7.2 - Default Route to Voice Page
**Objective:** Verify startup route
**Test:** Start app
**Expected Result:**
- App opens to Voice page (not Chat)
- Microphone button visible
- Voice controls ready

**Status:** [ ] Pass [ ] Fail

---

### Test 7.3 - Camera Preview Widget
**Objective:** Verify global camera display
**Test:** Navigate around app, ensure camera visible
**Expected Result:**
- Camera preview visible in bottom-right (if enabled)
- Draggable window functionality works
- Camera feed updates in real-time

**Status:** [ ] Pass [ ] Fail

---

### Test 7.4 - Provider Status Display
**Objective:** Verify provider status in UI
**Test:** Check TopBar/Sidebar
**Expected Result:**
- Local/Cloud badge shows based on selected provider
- Changes when provider switched
- Status endpoint called correctly

**Status:** [ ] Pass [ ] Fail

---

### Test 7.5 - Chat Streaming Display
**Objective:** Verify tokens appear as they arrive
**Test:** Send message with streaming enabled
**Expected Result:**
- Tokens appear incrementally (not all at once)
- User sees typing effect
- Final response complete

**Status:** [ ] Pass [ ] Fail

---

### Test 7.6 - Voice Input & Output
**Objective:** Verify voice page functionality
**Test:** Click microphone, speak, get TTS response
**Expected Result:**
- Voice input captured
- Transcribed to text
- Assistant responds with voice
- TTS output audible

**Status:** [ ] Pass [ ] Fail

---

## TEST SUITE 8: END-TO-END SCENARIOS

### Test 8.1 - Multi-Turn Conversation
**Scenario:**
1. Start app (new session)
2. Greet ELIXI: "Hi ELIXI, my name is Alex and I like programming"
3. Second turn: "What's my name?"
4. Third turn: "What do I like?"

**Expected Result:**
- First turn: Greeting response
- Second turn: Correctly identifies as Alex
- Third turn: Correctly identifies programming interest
- Memory persistence across turns

**Status:** [ ] Pass [ ] Fail

---

### Test 8.2 - Emotion-Aware Response
**Scenario:**
1. Start with sad emotion state detected (if camera enabled)
2. Ask emotionally-coded question
3. Observe response tone

**Expected Result:**
- Response tone matches/acknowledges emotion
- Voice tone is empathetic (if TTS enabled)
- System shows emotion context in logs

**Status:** [ ] Pass [ ] Fail

---

### Test 8.3 - Provider Switching
**Scenario:**
1. Set provider to Local (Ollama)
2. Ask: "Who are you?"
3. Change provider to Online
4. Ask same question

**Expected Result:**
- Both responses received correctly
- Different responses (different models)
- No crashes during switch
- UI badge updates

**Status:** [ ] Pass [ ] Fail

---

### Test 8.4 - Camera Integration
**Scenario:**
1. Enable camera
2. Have conversation while camera is active
3. Observe emotion detection feedback
4. Disable camera

**Expected Result:**
- Camera captures facial expressions
- Emotion detected and used in context
- No performance degradation
- Clean disable without hanging

**Status:** [ ] Pass [ ] Fail

---

### Test 8.5 - Long Session Stability
**Scenario:**
1. Have extended 20-message conversation
2. Monitor for memory leaks
3. Check system resources (CPU, RAM)
4. Note any degradation

**Expected Result:**
- All 20 messages handled correctly
- No exponential resource increase
- Memory properly managed
- System stable throughout

**Status:** [ ] Pass [ ] Fail

---

## TEST SUITE 9: ERROR HANDLING & RECOVERY

### Test 9.1 - Network Failure Handling
**Scenario:** Kill AI engine mid-request
**Expected Result:**
- Graceful error in UI
- Reconnection attempted
- User informed of issue

**Status:** [ ] Pass [ ] Fail

---

### Test 9.2 - Invalid Input Handling
**Test:** Send malformed requests
```json
{"sessionId": "test", "stream": "invalid"}
```
**Expected Result:**
- 400/422 error returned
- Clear error message
- No server crash

**Status:** [ ] Pass [ ] Fail

---

### Test 9.3 - Missing Configuration Recovery
**Setup:** Remove optional config value
**Test:** Attempt operation using that config
**Expected Result:**
- Sensible default used
- Operation completes
- Warning logged

**Status:** [ ] Pass [ ] Fail

---

## TEST SUITE 10: PERFORMANCE & LOAD

### Test 10.1 - First Response Time
**Test:** Measure time from request send to first token received
**Expected Result:**
- < 2 seconds for local Ollama
- < 5 seconds for online provider

**Status:** [ ] Pass [ ] Fail

---

### Test 10.2 - Streaming Token Rate
**Test:** Count tokens per second in stream
**Expected Result:**
- Smooth streaming without stuttering
- Consistent rate (not huge bursts then pauses)

**Status:** [ ] Pass [ ] Fail

---

### Test 10.3 - Concurrent Request Handling
**Test:** Send 5+ requests in parallel from different sessions
**Expected Result:**
- All responses arrive correctly
- No data corruption/mixing
- Queue/rate-limit working

**Status:** [ ] Pass [ ] Fail

---

## SUMMARY TEMPLATE

```
PHASE 5 TEST EXECUTION SUMMARY
Date: [DATE]
Test Environment: [WINDOWS/MAC/LINUX]

AI Engine:       [X/Y TESTS PASSED]
Providers:       [X/Y TESTS PASSED]
Memory:          [X/Y TESTS PASSED]
Camera:          [X/Y TESTS PASSED]
Voice:           [X/Y TESTS PASSED]
Backend:         [X/Y TESTS PASSED]
Desktop UI:      [X/Y TESTS PASSED]
End-to-End:      [X/Y TESTS PASSED]
Error Handling:  [X/Y TESTS PASSED]
Performance:     [X/Y TESTS PASSED]

TOTAL: [XX/XX] TESTS PASSED ([XX]% SUCCESS RATE)

Critical Failures: [ANY?]
Known Issues: [LIST ANY]
Recommended Actions: [NEXT STEPS]
```

---

## EXECUTION SCRIPTS

### Full Automated Test (Partial)
See `PHASE5_TEST_RUNNER.ps1` for automated testing script.

### Manual Testing Checklist
All tests above should be manually verified by interacting with the app UI or using curl/Postman for API endpoints.

