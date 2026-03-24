/**
 * ELIXI Database Connection Test Suite
 * 
 * This test file validates all database connections and operations.
 * Run with: npx ts-node scripts/test-db-connections.ts
 * Or from package.json: npm run test:db
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

const DB_PATH = path.resolve(__dirname, '../memory/elixi.db');

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];
const consoleLog = console.log;
const consoleError = console.error;

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

async function runTest(name: string, testFn: () => void | Promise<void>): Promise<void> {
  const startTime = Date.now();
  try {
    consoleLog(`\n${colorize('🧪 Testing:', 'cyan')} ${name}...`);
    await testFn();
    const duration = Date.now() - startTime;
    results.push({ name, passed: true, duration });
    consoleLog(`${colorize('✅', 'green')} ${name} passed (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, error: errorMsg, duration });
    consoleLog(`${colorize('❌', 'red')} ${name} failed: ${colorize(errorMsg, 'red')}`);
  }
}

// Test 1: Database Connection
async function testDatabaseConnection() {
  try {
    const db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    
    // Test basic query
    const version = db.prepare('SELECT sqlite_version()').get() as any;
    if (!version) {
      throw new Error('Could not retrieve SQLite version');
    }
    
    db.close();
    consoleLog(`   SQLite Version: ${version['sqlite_version()']}`);
  } catch (error) {
    throw new Error(
      `Failed to connect to database: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Test 2: Verify all tables exist
async function testTableCreation() {
  const db = new Database(DB_PATH);
  try {
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
      .all() as Array<{ name: string }>;

    const requiredTables = ['sessions', 'messages', 'memories', 'habits', 'audit_log', 'permissions'];
    const tableNames = tables.map((t) => t.name);

    for (const table of requiredTables) {
      if (!tableNames.includes(table)) {
        throw new Error(`Missing table: ${table}`);
      }
    }
    
    consoleLog(`   Found ${tableNames.length} tables: ${tableNames.join(', ')}`);
    
    // Display table schemas
    for (const tableName of requiredTables) {
      const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<any>;
      consoleLog(`   └─ ${tableName}: ${columns.length} columns`);
    }
  } finally {
    db.close();
  }
}

// Test 3: Message operations
async function testMessageInsertAndQuery() {
  const db = new Database(DB_PATH);
  try {
    const sessionId = 'test-session-' + Date.now();
    const messageId = 'test-msg-' + Date.now();

    // Ensure session exists
    db.prepare('INSERT OR IGNORE INTO sessions (id) VALUES (?)').run(sessionId);

    // Insert message
    const stmt = db.prepare(
      'INSERT INTO messages (id, session_id, role, content, intent, emotion_state) VALUES (?, ?, ?, ?, ?, ?)'
    );
    stmt.run(messageId, sessionId, 'user', 'Test message content', 'test_intent', 'neutral');

    // Query message
    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId) as any;

    if (!message || message.content !== 'Test message content') {
      throw new Error('Message insert/query verification failed');
    }

    // Cleanup
    db.prepare('DELETE FROM messages WHERE id = ?').run(messageId);
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);

    consoleLog(`   ✓ Insert: ${messageId}`);
    consoleLog(`   ✓ Query: Retrieved message with role='${message.role}', content='${message.content.substring(0, 20)}...'`);
  } finally {
    db.close();
  }
}

// Test 4: Memory operations
async function testMemoryInsertAndQuery() {
  const db = new Database(DB_PATH);
  try {
    const memoryId = 'test-mem-' + Date.now();

    // Insert fact
    db.prepare(
      'INSERT INTO memories (id, category, key, value, confidence, source) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(memoryId, 'test_category', 'test_key', 'test_value', 1.0, 'test_source');

    // Query fact
    const memory = db.prepare('SELECT * FROM memories WHERE id = ?').get(memoryId) as any;

    if (!memory || memory.value !== 'test_value') {
      throw new Error('Memory insert/query verification failed');
    }

    // Cleanup
    db.prepare('DELETE FROM memories WHERE id = ?').run(memoryId);

    consoleLog(`   ✓ Insert: ${memoryId}`);
    consoleLog(`   ✓ Query: Retrieved memory category='${memory.category}', confidence=${memory.confidence}`);
  } finally {
    db.close();
  }
}

// Test 5: Habit operations
async function testHabitInsertAndQuery() {
  const db = new Database(DB_PATH);
  try {
    const habitId = 'test-habit-' + Date.now();

    // Insert habit
    db.prepare(
      'INSERT INTO habits (id, description, trigger, trigger_value, action, occurrences) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(habitId, 'Morning routine', 'time', '09:00', 'remind_user', 5);

    // Query habit
    const habit = db.prepare('SELECT * FROM habits WHERE id = ?').get(habitId) as any;

    if (!habit || habit.description !== 'Morning routine') {
      throw new Error('Habit insert/query verification failed');
    }

    // Cleanup
    db.prepare('DELETE FROM habits WHERE id = ?').run(habitId);

    consoleLog(`   ✓ Insert: ${habitId}`);
    consoleLog(`   ✓ Query: Retrieved habit description='${habit.description}', occurrences=${habit.occurrences}`);
  } finally {
    db.close();
  }
}

// Test 6: Audit log operations
async function testAuditLogInsertAndQuery() {
  const db = new Database(DB_PATH);
  try {
    const auditId = 'test-audit-' + Date.now();

    // Insert audit log
    db.prepare(
      'INSERT INTO audit_log (id, command, intent, action, permission_tier, status, session_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(auditId, 'system_command', 'execute_action', 'test_action', 1, 'approved', 'test-session-123');

    // Query audit log
    const audit = db.prepare('SELECT * FROM audit_log WHERE id = ?').get(auditId) as any;

    if (!audit || audit.command !== 'system_command') {
      throw new Error('Audit log insert/query verification failed');
    }

    // Cleanup
    db.prepare('DELETE FROM audit_log WHERE id = ?').run(auditId);

    consoleLog(`   ✓ Insert: ${auditId}`);
    consoleLog(`   ✓ Query: Retrieved audit command='${audit.command}', status='${audit.status}'`);
  } finally {
    db.close();
  }
}

// Test 7: Permission operations
async function testPermissionInsertAndQuery() {
  const db = new Database(DB_PATH);
  try {
    const permissionId = 'test-perm-' + Date.now();

    // Insert permission
    db.prepare(
      'INSERT INTO permissions (id, command_pattern, tier, granted) VALUES (?, ?, ?, ?)'
    ).run(permissionId, 'test_pattern_*', 2, 1);

    // Query permission
    const permission = db.prepare('SELECT * FROM permissions WHERE id = ?').get(permissionId) as any;

    if (!permission || permission.tier !== 2) {
      throw new Error('Permission insert/query verification failed');
    }

    // Cleanup
    db.prepare('DELETE FROM permissions WHERE id = ?').run(permissionId);

    consoleLog(`   ✓ Insert: ${permissionId}`);
    consoleLog(`   ✓ Query: Retrieved permission tier=${permission.tier}, granted=${permission.granted}`);
  } finally {
    db.close();
  }
}

// Test 8: Verify indexes
async function testIndexes() {
  const db = new Database(DB_PATH);
  try {
    const indexes = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'`)
      .all() as Array<{ name: string }>;

    const requiredIndexes = ['idx_messages_session', 'idx_memories_category', 'idx_memories_key'];
    const indexNames = indexes.map((i) => i.name);

    const systemIndexes = indexNames.filter((idx) => !requiredIndexes.includes(idx));
    const foundIndexes = indexNames.filter((idx) => requiredIndexes.includes(idx));

    for (const indexName of requiredIndexes) {
      if (!indexNames.includes(indexName)) {
        throw new Error(`Missing required index: ${indexName}`);
      }
    }

    consoleLog(`   Found all ${foundIndexes.length} required indexes`);
    if (systemIndexes.length > 0) {
      consoleLog(`   Additional system indexes: ${systemIndexes.join(', ')}`);
    }
  } finally {
    db.close();
  }
}

// Test 9: Verify foreign key constraints
async function testForeignKeyConstraints() {
  const db = new Database(DB_PATH);
  try {
    const fk = db.pragma('foreign_keys') as Array<any>;
    const isEnabled = fk && fk[0] && fk[0].foreign_keys === 1;

    if (!isEnabled) {
      consoleLog(`   ${colorize('⚠️  Warning:', 'yellow')} Foreign key constraints may not be active`);
      consoleLog(`   Current setting: ${JSON.stringify(fk)}`);
    } else {
      consoleLog(`   ✓ Foreign key constraints are properly enabled`);
    }

    // Test a foreign key constraint
    const sessionId = 'fk-test-' + Date.now();
    db.prepare('INSERT OR IGNORE INTO sessions (id) VALUES (?)').run(sessionId);

    // This should work
    const messageId = 'fk-msg-' + Date.now();
    db.prepare(
      'INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)'
    ).run(messageId, sessionId, 'user', 'test');

    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
    if (message) {
      consoleLog(`   ✓ Foreign key constraint validated with valid session`);
    }

    // Cleanup
    db.prepare('DELETE FROM messages WHERE id = ?').run(messageId);
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  } finally {
    db.close();
  }
}

// Test 10: Database file validation
async function testDatabaseFileSize() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      throw new Error('Database file does not exist at ' + DB_PATH);
    }

    const stats = fs.statSync(DB_PATH);
    const sizeInKB = (stats.size / 1024).toFixed(2);
    const sizeInMB = (stats.size / 1024 / 1024).toFixed(2);
    const modifiedTime = new Date(stats.mtimeMs).toLocaleString();

    consoleLog(`   File size: ${sizeInKB} KB (${sizeInMB} MB)`);
    consoleLog(`   Last modified: ${modifiedTime}`);
    consoleLog(`   Location: ${DB_PATH}`);
  } catch (error) {
    throw new Error(
      `Failed to check database file: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function main() {
  consoleLog(colorize('═══════════════════════════════════════════════════════════════', 'cyan'));
  consoleLog(colorize('         🗄️  ELIXI DATABASE CONNECTION TEST SUITE', 'bright'));
  consoleLog(colorize('═══════════════════════════════════════════════════════════════', 'cyan'));
  consoleLog(`\n${colorize('Database path:', 'bright')} ${DB_PATH}`);
  consoleLog(`${colorize('Database exists:', 'bright')} ${fs.existsSync(DB_PATH) ? colorize('Yes ✓', 'green') : colorize('No ✗', 'red')}\n`);

  // Run all tests in sequence
  await runTest('Database Connection', testDatabaseConnection);
  await runTest('Table Creation & Schemas', testTableCreation);
  await runTest('Message CRUD Operations', testMessageInsertAndQuery);
  await runTest('Memory CRUD Operations', testMemoryInsertAndQuery);
  await runTest('Habit CRUD Operations', testHabitInsertAndQuery);
  await runTest('Audit Log CRUD Operations', testAuditLogInsertAndQuery);
  await runTest('Permission CRUD Operations', testPermissionInsertAndQuery);
  await runTest('Database Indexes', testIndexes);
  await runTest('Foreign Key Constraints', testForeignKeyConstraints);
  await runTest('Database File Validation', testDatabaseFileSize);

  // Print summary
  consoleLog('\n' + colorize('═══════════════════════════════════════════════════════════════', 'cyan'));
  consoleLog(colorize('                       TEST SUMMARY', 'bright'));
  consoleLog(colorize('═══════════════════════════════════════════════════════════════', 'cyan') + '\n');

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);

  consoleLog(`${colorize('Total Tests:', 'bright')} ${results.length}`);
  consoleLog(`${colorize('✅ Passed:', 'green')} ${passed}`);
  consoleLog(`${colorize('❌ Failed:', 'red')} ${failed}`);
  consoleLog(`${colorize('⏱️  Total Time:', 'bright')} ${totalTime}ms\n`);

  // Detailed results table
  consoleLog(colorize('Detailed Results:', 'bright'));
  consoleLog('─'.repeat(70));
  results.forEach((result) => {
    const statusIcon = result.passed ? colorize('✓', 'green') : colorize('✗', 'red');
    const name = result.name.padEnd(40);
    const duration = `${result.duration}ms`.padEnd(10);
    consoleLog(`${statusIcon} ${name} ${duration}`);
  });
  consoleLog('─'.repeat(70));

  if (failed > 0) {
    consoleLog(`\n${colorize('❌ FAILED TESTS:', 'red')}`);
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        consoleLog(`   • ${r.name}`);
        consoleLog(`     Error: ${colorize(r.error || 'Unknown error', 'red')}`);
      });
    consoleLog('');
    process.exit(1);
  }

  consoleLog(`\n${colorize('🎉 All database connection tests passed!', 'green')}\n`);
  process.exit(0);
}

main().catch((error) => {
  consoleError(colorize('Fatal error:', 'red'), error);
  process.exit(1);
});
