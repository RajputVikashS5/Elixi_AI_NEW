# Database Connection Testing Guide

## Overview

The ELIXI project includes a comprehensive database connection test suite that validates all SQLite database operations, including:

- **Connection validation** - Ensures database file is accessible
- **Table verification** - Confirms all 6 required tables exist with proper schemas
- **CRUD operations** - Tests insert, read, update, and delete operations on each table
- **Index validation** - Verifies all performance indexes are in place
- **Constraint checks** - Validates foreign key constraints
- **File integrity** - Confirms database file exists and reports file size

## Test Coverage

The test suite includes 10 comprehensive tests:

1. **Database Connection** - Validates SQLite connection and pragmas
2. **Table Creation & Schemas** - Verifies all tables exist with correct column counts
3. **Message CRUD Operations** - Tests message storage and retrieval
4. **Memory CRUD Operations** - Tests memory/fact storage and retrieval
5. **Habit CRUD Operations** - Tests habit tracking functionality
6. **Audit Log CRUD Operations** - Tests audit trail logging
7. **Permission CRUD Operations** - Tests permission management
8. **Database Indexes** - Validates all performance indexes
9. **Foreign Key Constraints** - Verifies referential integrity
10. **Database File Validation** - Checks file existence and size

## Running the Tests

### Option 1: Using npm (Recommended)

From the project root:

```bash
npm run test:db
```

### Option 2: Direct TypeScript execution

From the backend directory:

```bash
cd backend
npx ts-node ../scripts/test-db-connections.ts
```

### Option 3: Using Node.js runner script

From the project root:

```bash
node scripts/run-db-tests.js
```

## Test Output

The test suite produces detailed output showing:

- ✅ Pass/fail status for each test
- ⏱️  Execution time for each test
- 📊 Summary statistics (total tests, passed, failed, total time)
- 🔍 Detailed information about database structure and content

Example output:
```
═══════════════════════════════════════════════════════════════
         🗄️  ELIXI DATABASE CONNECTION TEST SUITE
═══════════════════════════════════════════════════════════════

Database path: e:\Projects\Elixi AI Electron\memory\elixi.db
Database exists: Yes ✓

🧪 Testing: Database Connection...
   SQLite Version: 3.46.0
✅ Database Connection passed (45ms)

🧪 Testing: Table Creation & Schemas...
   Found 6 tables: sessions, messages, memories, habits, audit_log, permissions
   └─ sessions: 5 columns
   └─ messages: 8 columns
   └─ memories: 8 columns
   └─ habits: 9 columns
   └─ audit_log: 8 columns
   └─ permissions: 8 columns
✅ Table Creation & Schemas passed (12ms)

[... more test results ...]

═══════════════════════════════════════════════════════════════
                       TEST SUMMARY
═══════════════════════════════════════════════════════════════

Total Tests: 10
✅ Passed: 10
❌ Failed: 0
⏱️  Total Time: 243ms

🎉 All database connection tests passed!
```

## Tables Tested

### 1. Sessions
- **Purpose**: Track chat sessions
- **Columns**: id, started_at, ended_at, personality_mode, emotion_profile

### 2. Messages
- **Purpose**: Store conversation messages
- **Columns**: id, session_id, role, content, intent, emotion_state, timestamp
- **Index**: idx_messages_session

### 3. Memories
- **Purpose**: Store facts and memories
- **Columns**: id, category, key, value, confidence, source, created_at, updated_at
- **Indexes**: idx_memories_category, idx_memories_key

### 4. Habits
- **Purpose**: Track user habits
- **Columns**: id, description, trigger, trigger_value, action, occurrences, last_seen, auto_suggest

### 5. Audit Log
- **Purpose**: Track command execution and permissions
- **Columns**: id, timestamp, command, intent, action, permission_tier, status, session_id

### 6. Permissions
- **Purpose**: Manage command permissions
- **Columns**: id, command_pattern, tier, granted, granted_at, expires_at

## Troubleshooting

### Test Fails: "Database file does not exist"
**Solution**: Ensure the `memory/` directory exists in the project root. The tests will create it if needed.

### Test Fails: "Missing table: [table_name]"
**Solution**: The database schema may not be initialized. Ensure the backend server has been started at least once to initialize the database, or manually run the `initializeDatabase()` function from `backend/src/services/memory.service.ts`.

### Test Fails: "Foreign key constraints may not be enabled"
**Cause**: SQLite foreign keys are not enabled by default
**Solution**: The test suite automatically enables them with `db.pragma('foreign_keys = ON')`, but verify SQLite pragma support if issues persist.

### Test Fails: "ts-node: not found"
**Solution**: Install the required dev dependency:
```bash
cd backend
npm install --save-dev ts-node
```

## Database Location

The SQLite database is located at:
```
e:\Projects\Elixi AI Electron\memory\elixi.db
```

For portability, the path is constructed using `path.resolve(__dirname, '../memory/elixi.db')` which works across Windows, macOS, and Linux.

## Integration with CI/CD

The test suite can be integrated into CI/CD pipelines. The tests return:
- **Exit code 0**: All tests passed ✅
- **Exit code 1**: One or more tests failed ❌

Example GitHub Actions workflow:
```yaml
- name: Test Database Connections
  run: npm run test:db
  if: always()
```

## Performance Notes

- **Typical execution time**: 200-500ms depending on system
- **Database operations**: Each test performs insert, verify, and cleanup operations
- **No persistent changes**: All test data is automatically cleaned up after each test
- **Concurrent test safety**: Tests use timestamped IDs to avoid conflicts

## Development Notes

The test script is located at:
```
scripts/test-db-connections.ts
```

To modify or extend tests:
1. Edit the TypeScript file
2. Add new test function following the existing pattern
3. Call `await runTest('Test Name', testFunction)` in the main() function
4. Run tests to verify changes

Example of adding a new test:
```typescript
async function testMyNewFeature() {
  const db = new Database(DB_PATH);
  try {
    // Your test logic here
    // Use assertions and throw errors for failures
  } finally {
    db.close();
  }
}

// In main():
await runTest('My New Feature', testMyNewFeature);
```
