# PHASE 7 – Integration Ecosystem Implementation Plan

**Date Started:** April 6, 2026  
**Phase:** Integration Ecosystem  
**Goal:** Connect ELIXI to developer and productivity tools (VS Code, GitHub, Browser, Email, Calendar)

---

## 📋 Phase 7 Scope

| Task | Status | Priority | Est. Files |
|------|--------|----------|-----------|
| P7-01 | OAuth + Token Management | 🟦 TODO | integ-auth.service.ts |
| P7-02 | VS Code Integration | 🟦 TODO | vscode.service.ts |
| P7-03 | GitHub Integration | 🟦 TODO | github.service.ts |
| P7-04 | Browser Control (CDP) | 🟦 TODO | browser.service.ts |
| P7-05 | Email Integration (IMAP) | 🟦 TODO | email.service.ts |
| P7-06 | Calendar Integration (CalDAV) | 🟦 TODO | calendar.service.ts |
| P7-07 | Integration Routes | 🟦 TODO | integrations.routes.ts |
| P7-08 | Integration Management UI | 🟦 TODO | IntegrationManager.tsx |
| P7-09 | Integration Tests | 🟦 TODO | test/integrations.test.ts |

---

## 🏗️ Architecture Overview

### Integration Service Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend                            │
├─────────────────────────────────────────────────────────────┤
│              Integration Management UI                       │
├─────────────────────────────────────────────────────────────┤
│                   Backend Routes                             │
│  POST /api/integrations/connect                             │
│  GET  /api/integrations/list                                │
│  POST /api/integrations/{id}/disconnect                     │
│  GET  /api/integrations/{id}/sync                           │
├─────────────────────────────────────────────────────────────┤
│                Integration Base Service                      │
│  ├─ OAuth Provider (Google, GitHub, etc)                   │
│  ├─ Token Manager (encrypted storage)                      │
│  └─ Integration Registry                                    │
├─────────────────────────────────────────────────────────────┤
│              Specialized Integration Services                │
│  ├─ VS Code Service      (REST API)                         │
│  ├─ GitHub Service       (GraphQL API)                      │
│  ├─ Browser Service      (Chrome DevTools Protocol)         │
│  ├─ Email Service        (IMAP)                             │
│  └─ Calendar Service     (CalDAV)                           │
├─────────────────────────────────────────────────────────────┤
│                   Secure Token Storage                       │
│  SQLite encrypted vault for OAuth tokens & secrets          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 Security Approach

### Token Management
- **Storage:** Encrypted columns in SQLite (AES-256)
- **Retrieval:** Decrypted at runtime via async service
- **Refresh:** Automatic refresh for OAuth providers
- **Auditing:** All token access logged

### OAuth Flow
```
1. User clicks "Connect [Service]"
2. Backend spawns auth URL (state token stored)
3. System browser opens OAuth provider
4. Provider redirects to://localhost:3001/api/integrations/callback?code=...
5. Backend exchanges code for token
6. Token encrypted and stored in DB
7. Integration marked as "connected"
```

### API Rate Limiting
- Per-integration rate limits (e.g., GitHub 60 req/hr)
- Automatic queueing and backoff
- User notification on limits reached

---

## 📦 Implementation Order

### Week 1: Foundation
1. ✅ Create integration.service.ts base
2. ✅ Implement OAuth provider framework
3. ✅ Create token encryption/storage
4. ✅ Create integration routes

### Week 2: Core Services
1. ✅ VS Code integration (Extension API + REST)
2. ✅ GitHub integration (GraphQL API)
3. ✅ Browser service (Chrome DevTools Protocol)

### Week 3: Productivity Integrations
1. ✅ Email service (IMAP RFC 3501)
2. ✅ Calendar service (CalDAV RFC 7230)
3. ✅ Sync scheduler (periodic updates)

### Week 4: UI + Tests
1. ✅ Integration Manager UI component
2. ✅ OAuth flow UI
3. ✅ Integration tests
4. ✅ E2E tests

---

## 🎯 Integration Details

### P7-01: VS Code Integration

**Features:**
- Read current file path & content
- Get list of open files
- Execute VS Code commands (open file, go to line)
- Read workspace configuration
- Get file tree structure

**Implementation:**
- VS Code Extension API (via local HTTP server on port 3002)
- REST endpoints: `GET /files`, `POST /commands`

**Routes:**
```
GET  /api/integrations/vscode/files
GET  /api/integrations/vscode/file/:path
POST /api/integrations/vscode/command
```

---

### P7-02: GitHub Integration

**Features:**
- List repositories
- Create issues & PRs
- Get issue status
- List commits
- Retrieve PR reviews

**Implementation:**
- GitHub GraphQL API + REST API
- OAuth: `https://github.com/login/oauth/authorize`

**Routes:**
```
GET  /api/integrations/github/repos
POST /api/integrations/github/issues
GET  /api/integrations/github/pr/:number
```

---

### P7-03: Browser Control

**Features:**
- List open tabs
- Navigate to URL
- Take screenshots
- Execute JavaScript in page
- Get page DOM structure

**Implementation:**
- Chrome DevTools Protocol (local Chrome/Edge instance)
- Connect via `http://localhost:9222/json`

**Routes:**
```
GET  /api/integrations/browser/tabs
POST /api/integrations/browser/navigate
POST /api/integrations/browser/screenshot
POST /api/integrations/browser/eval
```

---

### P7-04: Email Integration

**Features:**
- List emails (recent)
- Search inbox
- Read email content
- Summarize emails
- Get unread count

**Implementation:**
- IMAP protocol (RFC 3501)
- OAuth for Gmail or manual IMAP creds

**Routes:**
```
GET  /api/integrations/email/inbox
GET  /api/integrations/email/search?q=...
GET  /api/integrations/email/:id/summary
```

---

### P7-05: Calendar Integration

**Features:**
- List upcoming events
- Create calendar events
- Get meeting details
- Check availability
- Set reminders

**Implementation:**
- CalDAV protocol (RFC 7230)
- OAuth for Google Calendar or CalDAV server

**Routes:**
```
GET  /api/integrations/calendar/events
POST /api/integrations/calendar/events
GET  /api/integrations/calendar/availability
```

---

### P7-06: Integration Management UI

**Components:**
- IntegrationList.tsx (list connected integrations)
- IntegrationConnectModal.tsx (OAuth flow UI)
- IntegrationSettings.tsx (per-integration config)
- OAuthCallback.tsx (handle redirect)

**Features:**
- Visual status (connected/disconnected)
- Last sync timestamp
- Quick disconnect button
- Manual sync trigger
- Error notifications

---

### P7-07: Integration Routes

**Base Routes:**
```
GET  /api/integrations
GET  /api/integrations/:id
POST /api/integrations/connect/:type
POST /api/integrations/:id/disconnect
GET  /api/integrations/:id/sync
POST /api/integrations/callback
POST /api/integrations/:id/settings
```

---

## 🧪 Testing Strategy

### Unit Tests
- Token encryption/decryption
- OAuth URL generation
- Rate limit calculation
- Integration status checks

### Integration Tests
- Full OAuth flow (with mock provider)
- Token refresh flow
- Service discovery flow
- Error handling

### E2E Tests
- User connects GitHub in UI
- User sees repos list
- User can create issue from ELIXI

---

## 📝 Implementation Files Structure

```
backend/src/
├── services/
│   ├── integration.service.ts          # Base service
│   ├── oauth.service.ts                # OAuth provider
│   ├── tokenManager.service.ts         # Encryption & storage
│   ├── vscode.service.ts               # VS Code
│   ├── github.service.ts               # GitHub  
│   ├── browser.service.ts              # Browser CDP
│   ├── email.service.ts                # Email IMAP
│   └── calendar.service.ts             # Calendar CalDAV
│
├── routes/
│   └── integrations.routes.ts          # All integration routes
│
├── utils/
│   ├── oauthProviders.ts               # OAuth config
│   ├── encryption.ts                   # Token encryption
│   └── integrationTypes.ts             # TypeScript types
│
└── middleware/
    └── integrationAuth.ts              # Integration auth middleware

desktop/react-ui/src/
├── pages/
│   └── IntegrationManager.tsx          # Integration UI page
│
├── components/
│   ├── IntegrationList.tsx
│   ├── IntegrationConnectModal.tsx
│   ├── IntegrationSettings.tsx
│   └── OAuthCallback.tsx
│
└── services/
    └── integrations.api.ts             # Frontend API calls
```

---

## 🚀 Success Criteria

✅ PR7-01: All OAuth flows work (GitHub, Google tested)  
✅ PR7-02: VS Code integration reads/writes files  
✅ PR7-03: GitHub integration lists repos & creates issues  
✅ PR7-04: Browser can take screenshots & navigate tabs  
✅ PR7-05: Email integration lists inbox  
✅ PR7-06: Calendar shows upcoming events  
✅ PR7-07: Integration Manager UI is functional  
✅ PR7-08: All integration tests pass (80%+ coverage)  

---

## 🎬 Phase 7 Start

**Implementation Status:** Starting now  
**Target Completion:** TBD based on implementation pace
