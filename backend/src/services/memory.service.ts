import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

const DB_PATH = path.resolve(__dirname, '../../../memory/elixi.db');

const STOP_WORDS = new Set([
  'the', 'and', 'that', 'this', 'with', 'from', 'have', 'will', 'would', 'could', 'should',
  'about', 'there', 'their', 'they', 'them', 'your', 'you', 'are', 'for', 'what', 'when',
  'where', 'how', 'can', 'please', 'just', 'into', 'then', 'than', 'also', 'want', 'need',
  'open', 'start', 'run', 'make', 'show', 'tell', 'give', 'some', 'more', 'less', 'today',
]);

let db: ReturnType<typeof Database>;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function semanticScore(query: string, content: string, confidence = 1): number {
  const queryTerms = new Set(tokenize(query));
  const contentTerms = new Set(tokenize(content));
  if (queryTerms.size === 0 || contentTerms.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const term of queryTerms) {
    if (contentTerms.has(term)) {
      overlap += 1;
    }
  }

  const lexical = overlap / queryTerms.size;
  return Number((lexical + confidence * 0.15).toFixed(4));
}

export interface LearningPattern {
  intent: string;
  occurrences: number;
  lastSeen: string;
}

export interface PredictiveSuggestion {
  id: string;
  title: string;
  description: string;
  confidence: number;
  source: 'habit' | 'intent_pattern';
  action: {
    type: string;
    value: string;
  };
}

export interface VocabularyTerm {
  term: string;
  count: number;
}

export interface VerbosityAdaptation {
  level: 'concise' | 'balanced' | 'detailed';
  targetResponseWords: number;
  reason: string;
}

export interface LearningInsights {
  generatedAt: string;
  summary: {
    totalUserMessages: number;
    totalAssistantMessages: number;
    detectedPatterns: number;
    avgUserMessageChars: number;
    vocabularyDiversity: number;
    verbosityRecommendation: VerbosityAdaptation['level'];
  };
  patterns: LearningPattern[];
  predictiveSuggestions: PredictiveSuggestion[];
  vocabularyAdaptation: {
    topTerms: VocabularyTerm[];
  };
  verbosityAdaptation: VerbosityAdaptation;
}

export interface LearningSnapshotRecord {
  id: string;
  createdAt: string;
  payload: LearningInsights;
}

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

    CREATE TABLE IF NOT EXISTS learning_snapshots (
      id TEXT PRIMARY KEY,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      payload TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);
    CREATE INDEX IF NOT EXISTS idx_memories_key ON memories(key);
    CREATE INDEX IF NOT EXISTS idx_learning_snapshots_created_at ON learning_snapshots(created_at DESC);
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
    const rows = getDb()
      .prepare('SELECT * FROM memories ORDER BY updated_at DESC LIMIT 200')
      .all() as Array<{
        id: string;
        category: string;
        key: string;
        value: string;
        confidence: number;
        source?: string;
      }>;

    return rows
      .map((row) => {
        const content = `${row.key}: ${row.value}`;
        return {
          id: row.id,
          content,
          score: semanticScore(query, `${row.category} ${content}`, row.confidence ?? 1),
          metadata: {
            source: 'memory',
            category: row.category,
            key: row.key,
            confidence: row.confidence,
            origin: row.source ?? 'user',
          },
        };
      })
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 20);
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

  async getLearningInsights(options?: {
    limit?: number;
    minOccurrences?: number;
  }): Promise<LearningInsights> {
    const limit = Math.max(1, Math.min(options?.limit ?? 10, 25));
    const minOccurrences = Math.max(2, Math.min(options?.minOccurrences ?? 2, 20));
    const d = getDb();

    const totalUserMessages = Number(
      (d.prepare('SELECT COUNT(*) as count FROM messages WHERE role = ?').get('user') as { count: number }).count
    );
    const totalAssistantMessages = Number(
      (d.prepare('SELECT COUNT(*) as count FROM messages WHERE role = ?').get('assistant') as { count: number }).count
    );

    const avgUserMessageCharsRaw = Number(
      (
        d.prepare('SELECT AVG(LENGTH(content)) as avgLength FROM messages WHERE role = ?').get('user') as {
          avgLength: number | null;
        }
      ).avgLength ?? 0
    );

    const patternRows = d.prepare(
      `SELECT intent, COUNT(*) as occurrences, MAX(timestamp) as last_seen
       FROM messages
       WHERE role = 'assistant' AND intent IS NOT NULL AND intent != ''
       GROUP BY intent
       HAVING COUNT(*) >= ?
       ORDER BY occurrences DESC, last_seen DESC
       LIMIT ?`
    ).all(minOccurrences, limit) as Array<{
      intent: string;
      occurrences: number;
      last_seen: string;
    }>;

    const patterns: LearningPattern[] = patternRows.map((row) => ({
      intent: row.intent,
      occurrences: Number(row.occurrences),
      lastSeen: row.last_seen,
    }));

    const habitRows = d.prepare(
      `SELECT id, description, trigger, trigger_value, action, occurrences
       FROM habits
       WHERE auto_suggest = 1 AND occurrences >= ?
       ORDER BY occurrences DESC, last_seen DESC
       LIMIT ?`
    ).all(minOccurrences, limit) as Array<{
      id: string;
      description: string | null;
      trigger: string | null;
      trigger_value: string | null;
      action: string | null;
      occurrences: number;
    }>;

    const intentSuggestions: PredictiveSuggestion[] = patterns.map((pattern, index) => ({
      id: `intent-${index + 1}`,
      title: `Repeat intent: ${pattern.intent}`,
      description: `ELIXI has seen ${pattern.occurrences} similar outcomes. Consider pinning this as a workflow shortcut.`,
      confidence: Number(Math.min(0.99, 0.5 + pattern.occurrences * 0.08).toFixed(2)),
      source: 'intent_pattern',
      action: {
        type: 'open_route',
        value: '/automation',
      },
    }));

    const habitSuggestions: PredictiveSuggestion[] = habitRows.map((habit) => ({
      id: `habit-${habit.id}`,
      title: habit.description || 'Recurring workflow detected',
      description: `Observed ${habit.occurrences} times. Trigger: ${habit.trigger || 'pattern'}${habit.trigger_value ? `=${habit.trigger_value}` : ''}.`,
      confidence: Number(Math.min(0.99, 0.55 + Number(habit.occurrences) * 0.06).toFixed(2)),
      source: 'habit',
      action: {
        type: 'workflow',
        value: habit.action || '/automation',
      },
    }));

    const predictiveSuggestions = [...habitSuggestions, ...intentSuggestions]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);

    const recentUserRows = d.prepare(
      `SELECT content
       FROM messages
       WHERE role = 'user'
       ORDER BY timestamp DESC
       LIMIT 300`
    ).all() as Array<{ content: string }>;

    const termCounts = new Map<string, number>();
    let totalTerms = 0;
    for (const row of recentUserRows) {
      for (const token of tokenize(row.content)) {
        if (STOP_WORDS.has(token)) {
          continue;
        }
        totalTerms += 1;
        termCounts.set(token, (termCounts.get(token) || 0) + 1);
      }
    }

    const topTerms: VocabularyTerm[] = [...termCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([term, count]) => ({ term, count }));

    const vocabularyDiversity = totalTerms > 0
      ? Number((termCounts.size / totalTerms).toFixed(4))
      : 0;

    let verbosity: VerbosityAdaptation;
    if (avgUserMessageCharsRaw < 55) {
      verbosity = {
        level: 'concise',
        targetResponseWords: 45,
        reason: 'Recent user messages are short and command-focused.',
      };
    } else if (avgUserMessageCharsRaw > 180) {
      verbosity = {
        level: 'detailed',
        targetResponseWords: 140,
        reason: 'Recent user messages are long and context-heavy.',
      };
    } else {
      verbosity = {
        level: 'balanced',
        targetResponseWords: 90,
        reason: 'Recent user messages are medium length and mixed intent.',
      };
    }

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        totalUserMessages,
        totalAssistantMessages,
        detectedPatterns: patterns.length,
        avgUserMessageChars: Number(avgUserMessageCharsRaw.toFixed(2)),
        vocabularyDiversity,
        verbosityRecommendation: verbosity.level,
      },
      patterns,
      predictiveSuggestions,
      vocabularyAdaptation: {
        topTerms,
      },
      verbosityAdaptation: verbosity,
    };
  },

  async saveLearningSnapshot(payload: LearningInsights): Promise<LearningSnapshotRecord> {
    const d = getDb();
    const id = uuidv4();
    const serialized = JSON.stringify(payload);
    d.prepare('INSERT INTO learning_snapshots (id, payload) VALUES (?, ?)').run(id, serialized);

    const row = d.prepare(
      'SELECT id, created_at as createdAt, payload FROM learning_snapshots WHERE id = ?'
    ).get(id) as { id: string; createdAt: string; payload: string };

    return {
      id: row.id,
      createdAt: row.createdAt,
      payload: JSON.parse(row.payload) as LearningInsights,
    };
  },

  async getLearningSnapshots(limit = 20): Promise<LearningSnapshotRecord[]> {
    const safeLimit = Math.max(1, Math.min(limit, 200));
    const rows = getDb().prepare(
      'SELECT id, created_at as createdAt, payload FROM learning_snapshots ORDER BY created_at DESC LIMIT ?'
    ).all(safeLimit) as Array<{ id: string; createdAt: string; payload: string }>;

    return rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      payload: JSON.parse(row.payload) as LearningInsights,
    }));
  },
};
