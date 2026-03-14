import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

const DB_PATH = path.resolve(__dirname, '../../../memory/elixi.db');

let db: ReturnType<typeof Database>;

export async function initializeDatabase(): Promise<void> {
  // Ensure memory directory exists
  const memDir = path.dirname(DB_PATH);
  if (!fs.existsSync(memDir)) {
    fs.mkdirSync(memDir, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      personality_mode TEXT,
      emotion_profile TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      intent TEXT,
      emotion_state TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      confidence REAL DEFAULT 1.0,
      source TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS habits (
      id TEXT PRIMARY KEY,
      description TEXT,
      trigger TEXT,
      trigger_value TEXT,
      action TEXT,
      occurrences INTEGER DEFAULT 0,
      last_seen DATETIME,
      auto_suggest INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      command TEXT,
      intent TEXT,
      action TEXT,
      permission_tier INTEGER,
      status TEXT,
      session_id TEXT
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id TEXT PRIMARY KEY,
      command_pattern TEXT UNIQUE NOT NULL,
      tier INTEGER NOT NULL,
      granted INTEGER DEFAULT 0,
      granted_at DATETIME,
      expires_at DATETIME
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);
    CREATE INDEX IF NOT EXISTS idx_memories_key ON memories(key);
  `);

  logger.info('Database initialized at ' + DB_PATH);
}

function getDb(): ReturnType<typeof Database> {
  if (!db) throw new Error('Database not initialized');
  return db;
}

export const memoryService = {
  // Messages
  async storeMessage(msg: {
    id: string;
    sessionId: string;
    role: string;
    content: string;
    intent?: string;
    emotionState?: string;
  }): Promise<void> {
    const d = getDb();
    // Ensure session exists
    const sessionExists = d.prepare('SELECT id FROM sessions WHERE id = ?').get(msg.sessionId);
    if (!sessionExists) {
      d.prepare('INSERT INTO sessions (id) VALUES (?)').run(msg.sessionId);
    }
    d.prepare(
      'INSERT INTO messages (id, session_id, role, content, intent, emotion_state) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(msg.id, msg.sessionId, msg.role, msg.content, msg.intent ?? null, msg.emotionState ?? null);
  },

  async getMessages(sessionId: string) {
    return getDb()
      .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC')
      .all(sessionId);
  },

  async clearMessages(sessionId: string): Promise<void> {
    getDb().prepare('DELETE FROM messages WHERE session_id = ?').run(sessionId);
  },

  // Facts / Memories
  async getFacts() {
    return getDb()
      .prepare('SELECT * FROM memories ORDER BY created_at DESC LIMIT 200')
      .all();
  },

  async storeFact(fact: { category: string; key: string; value: string; confidence: number }) {
    const d = getDb();
    const id = uuidv4();
    // Upsert: update if key already exists in category
    const existing = d
      .prepare('SELECT id FROM memories WHERE category = ? AND key = ?')
      .get(fact.category, fact.key) as { id: string } | undefined;

    if (existing) {
      d.prepare(
        'UPDATE memories SET value = ?, confidence = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(fact.value, fact.confidence, existing.id);
      return { id: existing.id, ...fact };
    }

    d.prepare(
      'INSERT INTO memories (id, category, key, value, confidence, source) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, fact.category, fact.key, fact.value, fact.confidence, 'user');
    return { id, ...fact };
  },

  async searchFacts(query: string) {
    // Simple LIKE search in Phase 1; ChromaDB semantic search added in Phase 4
    return getDb()
      .prepare(
        'SELECT * FROM memories WHERE key LIKE ? OR value LIKE ? LIMIT 20'
      )
      .all(`%${query}%`, `%${query}%`);
  },

  async deleteFact(id: string): Promise<void> {
    getDb().prepare('DELETE FROM memories WHERE id = ?').run(id);
  },

  async getHabits() {
    return getDb().prepare('SELECT * FROM habits ORDER BY occurrences DESC').all();
  },

  // Audit log
  async logAudit(entry: {
    command: string;
    intent?: string;
    action: string;
    permissionTier: number;
    status: 'approved' | 'denied' | 'blocked';
    sessionId?: string;
  }): Promise<void> {
    getDb().prepare(
      'INSERT INTO audit_log (id, command, intent, action, permission_tier, status, session_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      uuidv4(),
      entry.command,
      entry.intent ?? null,
      entry.action,
      entry.permissionTier,
      entry.status,
      entry.sessionId ?? null
    );
  },

  async getAuditLogs(limit = 100) {
    return getDb()
      .prepare('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?')
      .all(limit);
  },
};
