# Phase 8: Advanced Personality System
**Starting:** April 6, 2026  
**Status:** Planning & Initialization  
**Goal:** Implement distinct, responsive personality modes with context-adaptive switching

---

## Executive Summary

Phase 8 transforms ELIXI into a genuinely adaptive AI assistant with multiple distinct personalities that respond to user context, time of day, task type, and emotional state. Each personality has:
- Unique system prompts and conversation style
- Custom UI themes
- Personalized TTS voice settings
- Context-aware automatic switching

**Target Completion:** 2 weeks

---

## Phase 8 Objectives

| # | Objective | Priority | Description |
|---|-----------|----------|-------------|
| P8-01 | Personality Mode Engine | CRITICAL | Core infrastructure to manage personality state, switching, and context |
| P8-02 | Per-Mode System Prompts | CRITICAL | Distinct prompt templates for each personality |
| P8-03 | Per-Mode UI Themes | HIGH | Visual differentiation: colors, icons, ambient effects |
| P8-04 | Per-Mode Voice Settings | HIGH | Different TTS voices/settings per personality |
| P8-05 | Context-Aware Switching | HIGH | Automatic mode switching based on time/task/emotion |
| P8-06 | Personality Customization UI | MEDIUM | UI for users to select and customize personalities |
| P8-07 | VS Code Extension | MEDIUM | Sidebar panel for ELIXI inside VS Code |
| P8-08 | Voice Cloning (Optional) | LOW | Custom voice synthesis (post-MVP) |

---

## Phase 8 Tasks Breakdown

### A. Personality Mode System (Backend)

#### A1. Define Personality Specifications
**Status:** NOT STARTED  
**Files:** `ai-engine/personality_specs.py` (new)

Define 5 core personalities:
```python
PERSONALITIES = {
    "professional": {
        "name": "Professional",
        "description": "Formal, efficient, business-focused",
        "tone": "formal",
        "emoji": "💼",
        "color": "#1E40AF",  # Blue
        "active_hours": (6, 22),  # 6 AM - 10 PM
        "context_triggers": ["work", "code", "email", "meeting"],
    },
    "friendly": {
        "name": "Friendly",
        "description": "Casual, warm, conversational",
        "tone": "casual",
        "emoji": "😊",
        "color": "#DC2626",  # Red
        "active_hours": None,
        "context_triggers": ["personal", "chat", "help", "casual"],
    },
    "focus": {
        "name": "Focus",
        "description": "Minimal, efficient, distraction-free",
        "tone": "minimal",
        "emoji": "🎯",
        "color": "#7C3AED",  # Purple
        "active_hours": None,
        "context_triggers": ["deadline", "coding", "focus", "quiet"],
    },
    "calm": {
        "name": "Calm",
        "description": "Peaceful, supportive, meditative",
        "tone": "supportive",
        "emoji": "🧘",
        "color": "#10B981",  # Green
        "active_hours": (20, 6),  # 8 PM - 6 AM
        "context_triggers": ["stress", "tired", "relax", "wind-down"],
    },
    "silent": {
        "name": "Silent",
        "description": "Minimal chat, icon-based responses",
        "tone": "silent",
        "emoji": "🤫",
        "color": "#6B7280",  # Gray
        "active_hours": None,
        "context_triggers": ["silent", "quiet", "focus", "dnd"],
    },
}
```

#### A2. Personality Manager Class
**Status:** NOT STARTED  
**Files:** `ai-engine/core/personality_manager.py` (new)

```python
class PersonalityManager:
    def __init__(self):
        self.current_personality = "professional"
        self.manual_override = None
        self.context_history = deque(maxlen=50)
    
    def get_current_personality(self):
        """Returns current active personality"""
    
    def set_personality(self, name: str):
        """Manually override to a specific personality"""
    
    def detect_personality_context(self, user_input: str) -> str:
        """Analyze input and detect appropriate personality"""
    
    def get_system_prompt(self) -> str:
        """Return system prompt for current personality"""
    
    def get_personality_spec(self, name: str = None) -> dict:
        """Get specs for current or named personality"""
```

#### A3. System Prompts Per Personality
**Status:** NOT STARTED  
**Files:** `ai-engine/prompts/personality_prompts.py` (new)

Each personality gets a unique system prompt:
```
PROFESSIONAL: "You are ELIXI Professional, a formal, efficient AI assistant..."
FRIENDLY: "You are ELIXI Friendly, a warm, conversational AI companion..."
FOCUS: "You are ELIXI Focus, a minimal-output assistant maximizing productivity..."
CALM: "You are ELIXI Calm, a supportive, meditative wisdom-sharing companion..."
SILENT: "Output only JSON responses with minimal text. No explanations unless critical..."
```

---

### B. Personality Integration (Backend Routes)

#### B1. Personality Endpoints
**Status:** NOT STARTED  
**Files:** `ai-engine/routers/personality_router.py` (new)

```
GET  /personality/current      → Current personality info
GET  /personality/list         → All available personalities
POST /personality/set/{name}   → Switch personality
GET  /personality/suggest      → AI-suggested personality for context
POST /personality/customize    → Update personality settings (future)
```

#### B2. ChatRouter Integration
**Status:** NOT STARTED  
**Files:** `ai-engine/routers/chat_router.py` (modify)

- Inject current personality system prompt into chat requests
- Include personality metadata in responses

---

### C. Frontend UI (React)

#### C1. Personality Selector Component
**Status:** NOT STARTED  
**Files:** `desktop/react-ui/src/components/ui/PersonalitySelector.tsx` (new)

- 5 emoji buttons representing each personality
- Current selection highlighted
- Hover shows personality name
- Click to switch
- Settings icon for customization

#### C2. Theme System
**Status:** NOT STARTED  
**Files:**
- `desktop/react-ui/src/styles/personalities.css` (new)
- `desktop/react-ui/src/store/personalityStore.ts` (new)

CSS variables per personality:
```css
:root[data-personality="professional"] {
  --primary-color: #1E40AF;
  --accent-color: #3B82F6;
  --bg-gradient: linear-gradient(135deg, #1E3C72 0%, #2A5298 100%);
  --orb-color: rgba(30, 64, 175, 0.3);
}

:root[data-personality="friendly"] {
  --primary-color: #DC2626;
  --accent-color: #F87171;
  --bg-gradient: linear-gradient(135deg, #DC2626 0%, #BE123C 100%);
  --orb-color: rgba(220, 38, 38, 0.3);
}
/* ... etc for all 5 */
```

#### C3. Personality Store (Zustand)
**Status:** NOT STARTED  
**Files:** `desktop/react-ui/src/store/personalityStore.ts` (new)

```typescript
interface PersonalityState {
  current: PersonalityType;
  spec: PersonalitySpec;
  isLoading: boolean;
  setPersonality: (name: PersonalityType) => Promise<void>;
  loadPersonality: () => Promise<void>;
}
```

#### C4. Ambient Effects Per Personality
**Status:** NOT STARTED  
**Files:** `desktop/react-ui/src/components/ui/AmbientOrb.tsx` (modify)

- Professional: Sharp, geometric animations
- Friendly: Warm, flowing animations  
- Focus: Minimal, single pulse
- Calm: Slow, meditative breathing
- Silent: Barely visible, nearly static

---

### D. Voice Settings Per Personality

#### D1. TTS Configuration
**Status:** NOT STARTED  
**Files:** `voice-engine/tts_engine.py` (modify)

```python
PERSONALITY_VOICE_SETTINGS = {
    "professional": {"voice": "en-US-AriaNeural", "rate": 0.9, "pitch": 0},
    "friendly": {"voice": "en-US-JennyNeural", "rate": 1.0, "pitch": 1},
    "focus": {"voice": "en-US-GuyNeural", "rate": 1.1, "pitch": 0},
    "calm": {"voice": "en-US-AmberNeural", "rate": 0.8, "pitch": -1},
    "silent": {"voice": None, "rate": None, "pitch": None},  # No TTS
}
```

#### D2. Dynamic TTS Selection
**Status:** NOT STARTED  
**Files:** `voice-engine/tts_engine.py` (modify)

- Read current personality from AI engine
- Apply personality-specific voice settings before synthesizing
- Fall back gracefully if personality unavailable

---

### E. Context-Aware Switching

#### E1. Context Detection Engine
**Status:** NOT STARTED  
**Files:** `ai-engine/core/context_detector.py` (new)

```python
class ContextDetector:
    def detect_context(self, user_input: str, metadata: dict) -> ContextSignal:
        """Analyze multiple signals to recommend personality"""
        signals = {
            "time_of_day": self._time_signal(),
            "task_type": self._extract_task_type(user_input),
            "emotional_state": metadata.get("emotion", "neutral"),
            "explicit_keywords": self._extract_keywords(user_input),
        }
        return self._combine_signals(signals)
```

#### E2. Automatic Switching Logic
**Status:** NOT STARTED  
**Files:** `ai-engine/core/personality_manager.py` (extend)

```python
def should_switch_personality(self) -> Optional[str]:
    """Decide if personality should auto-switch based on context"""
    if manual_override:
        return None  # User override takes precedence
    
    context_signal = self.context_detector.detect_context()
    if context_signal.confidence > 0.7:
        return context_signal.recommended_personality
    
    # Time-based switching
    current_hour = datetime.now().hour
    if morning (6-10): return "professional"
    if evening (20-22): return "calm"
    # etc
```

---

### F. Personality Customization UI (Future)

#### F1. Settings Panel
**Status:** DEFERRED (Phase 8.2)  
**Files:** `desktop/react-ui/src/pages/PersonalitySettings.tsx` (future)

- Customize system prompt per personality
- Adjust voice settings
- Set preferred time-based transitions
- Save custom personality profiles

---

### G. VS Code Extension Sidebar

#### G1. Extension Configuration
**Status:** NOT STARTED  
**Files:** `vscode-extension/src/extension.ts` (new/modify)

#### G2. Sidebar Panel
**Status:** NOT STARTED  
**Files:** `vscode-extension/src/views/elixi-panel.tsx` (new)

Features:
- Current personality display
- Recent commands
- Quick command input
- Suggestion panel
- Settings quick-access

#### G3. Command Palette Integration
**Status:** NOT STARTED  
**Files:** `vscode-extension/src/commands.ts` (extend)

- "ELIXI: Switch Personality"
- "ELIXI: Get Command Suggestion"
- "ELIXI: Help with Selection"

---

## Implementation Roadmap

### Week 1: Backend Foundation

| Day | Task | Owner | Status |
|-----|------|-------|--------|
| Mon | A1-A2: Personality specs & manager | Backend | ⏱️ |
| Tue | A3: System prompts | Backend | ⏱️ |
| Wed | B1-B2: Routes & integration | Backend | ⏱️ |
| Thu | E1-E2: Context detection | Backend | ⏱️ |
| Fri | Integration testing | QA | ⏱️ |

### Week 2: Frontend & Polish

| Day | Task | Owner | Status |
|-----|------|-------|--------|
| Mon | C1-C3: UI components + store | Frontend | ⏱️ |
| Tue | C4-D: Theme + voice settings | Frontend | ⏱️ |
| Wed | G1-G2: VS Code extension | Frontend | ⏱️ |
| Thu | E2E testing + polishing | QA | ⏱️ |
| Fri | Phase 8 regression testing | QA | ⏱️ |

---

## Testing Strategy

### Unit Tests

**Backend (Python - pytest)**
- Personality manager state transitions
- Context detection signal combinations
- Prompt template rendering per personality
- Time-based switching logic

**Backend (TypeScript - Jest)**
- Personality route handlers
- Chat integration with personality injection
- Voice settings mapping

**Frontend (React - Vitest)**
- PersonalitySelector component
- Theme CSS injection
- Store dispatch/selectors
- Auto-switch logic UI feedback

### Integration Tests

- End-to-end personality switch via frontend
- Backend personality state persistence
- AI response changes per personality
- Voice output changes per personality
- VS Code extension command execution

### Regression Tests

- Phase 7 tests must still pass
- All core features work with each personality
- No performance degradation
- Memory usage stable across mode switches

---

## Definition of Done

✅ All 8 personality mode objectives complete  
✅ Unit test coverage > 80%  
✅ Integration tests passing  
✅ Phase 7 regression tests passing  
✅ Phase 8 regression test suite created  
✅ Documentation updated  
✅ No console errors or warnings  
✅ Performance baseline: < 50ms for personality switch  
✅ All 5 personalities fully functional and visually distinct  

---

## Success Metrics

| Metric | Target | Current | Notes |
|--------|--------|---------|-------|
| Personality response time | < 50ms | TBD | Switch + prompt change |
| Context detection accuracy | > 75% | TBD | Recommend correct personality |
| Theme switch smoothness | 60 FPS | TBD | No jank on theme switch |
| VS Code extension launch | < 1s | TBD | Sidebar appears quickly |
| Memory per personality switch | < 2MB | TBD | Garbage collection verified |

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Theme CSS conflicts | MEDIUM | Test all personalities thoroughly, use CSS scoping |
| Voice synthesis delays | MEDIUM | Cache voice configs, pre-load TTS engine |
| Context detection false positives | MEDIUM | Implement confidence thresholds, manual override |
| Performance regression | MEDIUM | Profile each personality switch, monitor memory |
| VS Code extension compatibility | MEDIUM | Test on multiple VS Code versions |

---

## Dependencies & Prerequisites

### Already Complete
- ✅ Core personality mode structure in config 
- ✅ Basic system prompt templates
- ✅ Chat router infrastructure
- ✅ Voice engine TTS support
- ✅ Frontend component library

### To Install
- None (use existing packages: axios, zustand, etc)

### External Services
- None (all local)

---

## Notes & Considerations

1. **Personality Persistence:** Save user's last selected personality to localStorage
2. **Gradual Transitions:** Smooth CSS transitions when switching themes (200-300ms)
3. **Accessibility:** Ensure personality colors meet WCAG AA contrast ratios
4. **VS Code Extension:** Start with read-only sidebar; write features in Phase 9
5. **Voice Cloning (P8-08):** Defer if time-constrained; non-critical for MVP

---

## Phase 8 Completion Checklist

- [ ] Personality specifications document
- [ ] Personality manager class (backend)
- [ ] 5 distinct system prompts written
- [ ] PersonalitySelector React component
- [ ] Theme system with 5 variants
- [ ] PersonalityStore (Zustand)
- [ ] Ambient orb personality effects
- [ ] TTS voice settings mapping
- [ ] Context detection engine
- [ ] Auto-switch logic implemented
- [ ] Personality routes fully integrated
- [ ] VS Code extension sidebar (basic)
- [ ] Unit tests (all modules)
- [ ] Integration tests
- [ ] Phase 8 regression test suite
- [ ] E2E testing with all 5 personalities
- [ ] Documentation updates
- [ ] Performance profiling complete
- [ ] All PRs reviewed and merged

---

**Next Update:** After Monday's backend tasks completion  
**Phase Lead:** [Your name here]  
**Last Modified:** April 6, 2026 14:30 UTC
