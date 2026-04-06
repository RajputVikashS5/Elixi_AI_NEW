# PHASE 5 QUICK REFERENCE - WHAT TO TEST

## 🚀 START HERE: 5-MINUTE OVERVIEW

**What's new in Phase 5:**
- ✨ AI streaming now correctly returns SSE format on first-turn greeting
- ✨ Multi-provider support (Ollama, OpenRouter, Gemini)
- ✨ Hybrid LLM routing with auto-fallback
- ✨ Camera integration for emotion detection
- ✨ Vector memory with ChromaDB
- ✨ Personality-driven responses
- ✨ Voice integration (STT/TTS/VAD)
- ✨ Global camera preview window (draggable)

---

## 📋 QUICK TEST CHECKLIST

### Core AI Engine (5 min)
Essential tests - **RUN THESE FIRST**

```bash
# Terminal 1
cd ai-engine
..\.venv\Scripts\python.exe -m uvicorn main:app --port 8000 --reload
```

Then test in another terminal or Postman:
- [ ] `POST http://127.0.0.1:8000/ai/intent` with message "hello"
- [ ] `POST http://127.0.0.1:8000/ai/chat` with stream=true (check SSE format)
- [ ] `POST http://127.0.0.1:8000/ai/chat` with stream=false (check JSON)
- [ ] Send follow-up message, verify memory working

**Expected:** All return within 2 seconds, proper JSON/SSE format

---

### Backend & Socket Integration (5 min)

```bash
# Terminal 2
npm run dev
```

Test endpoints:
- [ ] `GET http://127.0.0.1:3001/api/system/info` - returns CPU/RAM/OS
- [ ] Socket.io connect and send chat message
- [ ] Verify tokens stream via socket (not batched)

**Expected:** Backend responds, system info visible

---

### Desktop UI (10 min)

```bash
# Terminal 3 (from root directory)
npm run dev
```

Then verify:
- [ ] App opens to Voice page (not Chat)
- [ ] Provider badge shows "Local" or "Cloud"
- [ ] Send message → see tokens appear one by one
- [ ] Switch provider in settings → badge changes  
- [ ] Record voice → transcribed to text → response heard
- [ ] Camera preview window visible & draggable (if enabled)

**Expected:** Smooth streaming, proper routing

---

### Voice Engine (5 min, Optional)

```bash
# Terminal 4
cd voice-engine
..\.venv\Scripts\python.exe -m uvicorn voice_server:app --port 8001
```

Test:
- [ ] Mic button captures audio
- [ ] STT transcribes correctly
- [ ] TTS responds with proper voice tone

**Expected:** Speech-to-text and back working

---

## 🧪 TEST SCENARIOS (Pick 3-5 Critical Ones)

### Scenario A: First Greeting (2 min) ✅ CRITICAL
```
Start fresh session -> "Hi ELIXI, my name is Test User"
Expected: Warm greeting, personality evident
```

### Scenario B: Memory Persistence (3 min) ✅ CRITICAL
```
Message 1: "I'm a developer"
Message 2: "What do I do for work?"
Expected: Response references developer role
```

### Scenario C: Provider Switching (2 min) ✅ IMPORTANT
```
Message with Ollama
Switch to OpenRouter
Same message again
Expected: Different responses (different models)
```

### Scenario D: Error Recovery (2 min)
```
Kill AI engine mid-message
Try to send new message
Expected: Graceful error, reconnect option
```

### Scenario E: Long Session (5 min)
```
Send 20 messages in conversation
Monitor: No slowdown, memory stable
Expected: Consistent response time
```

---

## 🔧 TROUBLESHOOTING QUICK FIXES

### AI Engine won't start
```powershell
# Fix 1: Verify venv
.\.venv\Scripts\Activate.ps1
python --version  # Should be 3.11+

# Fix 2: Reinstall requirements
pip install -r ai-engine\requirements.txt

# Fix 3: Check ports
netstat -ano | findstr :8000
```

### Backend errors
```bash
npm run dev --workspace=backend  # Full path
# or
cd backend && npm run dev
```

### UI not streaming
- Check backend WebSocket at `http://127.0.0.1:3001`
- Verify SSE parsing in `/backend/src/services/socket.service.ts`
- Check browser console for CORS errors

### Voice not working
- Check microphone permissions in Windows
- Verify audio input device in system settings
- Check if voice-engine port 8001 is free

---

## 📊 EXPECTED PERFORMANCE TARGETS

| Metric | Target | Acceptable | Issue |
|--------|--------|-----------|-------|
| AI startup | <5s | <10s | Check Python/dependencies |
| First token latency | <500ms | <2000ms | Normal for cloud |
| Token rate | 10-20/sec | 5-30/sec | Smooth delivery |
| Memory after 50msgs | +50MB max | +100MB | Check for leaks |
| UI response | <100ms | <500ms | Check socket lag |

---

## ✅ SIGN-OFF REQUIREMENTS

Before marking Phase 5 complete, ensure:

1. **AI Engine**
   - [ ] Streaming greeting returns SSE with `done:true`
   - [ ] Non-stream chat returns JSON
   - [ ] Intent classification works
   - [ ] Memory persists across messages

2. **Provider System**
   - [ ] Ollama responds (local test)
   - [ ] OpenRouter responds (if API key set)
   - [ ] Fallback works (bad key → Ollama)
   - [ ] No API key leakage in logs

3. **Camera (if enabled)**
   - [ ] Can enable/disable
   - [ ] Emotion detected when smiling
   - [ ] Auto-enable works on startup
   - [ ] Preview window draggable

4. **Voice (optional)**
   - [ ] Microphone captures
   - [ ] STT transcribes
   - [ ] TTS responds with tone

5. **UI**
   - [ ] Default route is Voice page
   - [ ] Provider badge accurate
   - [ ] Streaming tokens appear incrementally
   - [ ] No console errors

6. **Integration**
   - [ ] Socket.io receives tokens correctly
   - [ ] First-turn greeting appears
   - [ ] Multi-turn memory working
   - [ ] Error recovery functional

---

## 🎯 IDEAL TEST EXECUTION

**Time Budget: 45 minutes total**

| Phase | Time | What to Do |
|-------|------|-----------|
| Setup | 2 min | Start 4 terminals, all services online |
| Quick Check | 1 min | Run `test-phase5.ps1`, verify all ONLINE |
| Critical Scenarios | 15 min | A, B, C scenarios (greeting, memory, switching) |
| Optional Tests | 12 min | Voice, camera, error recovery |
| Performance | 10 min | Test 20-message stability |
| Document | 5 min | Fill out results table |

**Total: 45 minutes → Full Phase 5 validation**

---

## 📝 RESULTS TABLE TEMPLATE

```
PHASE 5 TEST RESULTS
Date: [TODAY]
Environment: Windows 10/11
Services Started: [ ] All [ ] Some [ ] None

AI ENGINE:
  - Startup:         [ ] PASS [ ] FAIL [ ] TIME: ___
  - Intent:          [ ] PASS [ ] FAIL
  - Stream greeting: [ ] PASS [ ] FAIL
  - Memory:          [ ] PASS [ ] FAIL

BACKEND:
  - Startup:         [ ] PASS [ ] FAIL
  - System info:     [ ] PASS [ ] FAIL
  - Socket stream:   [ ] PASS [ ] FAIL

UI:
  - Route to Voice:  [ ] PASS [ ] FAIL
  - Provider badge:  [ ] PASS [ ] FAIL
  - Token streaming: [ ] PASS [ ] FAIL

SCENARIO RESULTS:
  - Greeting:        [ ] PASS [ ] FAIL
  - Memory:          [ ] PASS [ ] FAIL
  - Switching:       [ ] PASS [ ] FAIL

OVERALL: [__]% TESTS PASSED
PHASE 5 READY: [ ] YES [ ] NO - See issues below

Issues found:
- 
-
- 

Sign-off: _________________  Date: _____
```

---

## 🎓 KEY IMPROVEMENTS IN PHASE 5

**From Earlier Phases:**
- ✓ Fixed: Stream greeting now returns SSE (not JSON) ← **CRITICAL FIX**
- ✓ Added: Multi-provider with fallback
- ✓ Added: Vector memory for semantic search
- ✓ Added: Camera emotion detection
- ✓ Added: Global voice/camera UI
- ✓ Added: Personality-driven responses

**These should all show evidence in testing**

---

## 🚨 COMMON FAILURE MODES (Watch Out)

1. **"No response from AI engine"**
   - Cause: Streaming greeting was returning JSON (FIXED in latest)
   - Check: Verify SSE format in response
   - Solution: Restart AI engine with latest code

2. **"Provider stays as Local even when switched"**
   - Cause: UI reading wrong state
   - Check: TopBar/Sidebar showing hardcoded "Local"
   - Solution: Verified fixed in latest branch

3. **"Camera crashes app"**
   - Cause: Permission issues or Ollama reader conflict
   - Check: Enable camera endpoint
   - Solution: Run camera diagnostics endpoint

4. **"Socket tokens batched not streaming"**
   - Cause: SSE framing issue in backend
   - Check: Socket.service.ts stream parsing
   - Solution: Verify `\n\n` delimiters

5. **"Memory not persisting"**
   - Cause: Vector DB not initialized
   - Check: ChromaDB warning in logs
   - Solution: Ensure sentence-transformers installed

---

## 📞 SUPPORT RESOURCES

**Documentation:**
- [Full Test Suite](PHASE5_TEST_SUITE.md) - Detailed test scenarios
- [Executive Report](PHASE5_TEST_EXECUTION_REPORT.md) - Complete results template
- [Implementation Complete](IMPLEMENTATION_COMPLETE.md) - What was built
- [Deployment Guide](DEPLOYMENT_GUIDE.md) - Production setup

**Live Testing Tools:**
- Postman: Import endpoints for quick testing
- Browser DevTools: Monitor socket.io messages
- Terminal: Watch logs in real-time

---

**Last Updated:** April 6, 2026  
**Phase 5 Status:** READY FOR TESTING  
**Estimated Testing Time:** 30-60 minutes

**Next Action:** Start with "QUICK TEST CHECKLIST" the section above!
