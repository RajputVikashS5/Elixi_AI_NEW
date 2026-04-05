"""Long-term SQLite memory store for ELIXI AI Engine."""

import json
import uuid
import aiosqlite
import logging
import os
from pathlib import Path
from typing import Optional, Any
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).resolve().parent.parent.parent / "memory" / "elixi.db"
DEFAULT_OWNER_ID = "system"


async def _ensure_column(db: aiosqlite.Connection, table: str, column: str, definition: str) -> None:
    cursor = await db.execute(f"PRAGMA table_info({table})")
    rows = await cursor.fetchall()
    existing = {row[1] for row in rows}
    if column not in existing:
        await db.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


async def init_database() -> None:
    """Create all required tables if they do not exist and reconcile shared-schema drift."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                owner_id TEXT NOT NULL DEFAULT 'system',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                started_at TEXT DEFAULT CURRENT_TIMESTAMP,
                ended_at TEXT,
                title TEXT,
                metadata TEXT DEFAULT '{}',
                personality_mode TEXT,
                emotion_profile TEXT
            );

            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                owner_id TEXT NOT NULL DEFAULT 'system',
                role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
                content TEXT NOT NULL,
                intent TEXT,
                emotion_state TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            );

            CREATE TABLE IF NOT EXISTS memories (
                id TEXT PRIMARY KEY,
                owner_id TEXT NOT NULL DEFAULT 'system',
                category TEXT NOT NULL,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                confidence REAL DEFAULT 1.0,
                source TEXT,
                expires_at TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(owner_id, category, key)
            );

            CREATE TABLE IF NOT EXISTS habits (
                id TEXT PRIMARY KEY,
                description TEXT,
                trigger TEXT,
                trigger_value TEXT,
                action TEXT,
                occurrences INTEGER DEFAULT 0,
                last_seen TEXT,
                auto_suggest INTEGER DEFAULT 1,
                name TEXT,
                pattern TEXT,
                occurrence_count INTEGER DEFAULT 0,
                metadata TEXT DEFAULT '{}'
            );

            CREATE TABLE IF NOT EXISTS vector_documents (
                id TEXT PRIMARY KEY,
                text TEXT NOT NULL,
                metadata TEXT DEFAULT '{}',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS habit_summaries (
                id TEXT PRIMARY KEY,
                summarized_at TEXT NOT NULL,
                payload TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
            CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);
            CREATE INDEX IF NOT EXISTS idx_memories_key ON memories(key);
            CREATE INDEX IF NOT EXISTS idx_habits_trigger ON habits(trigger, trigger_value);
            CREATE INDEX IF NOT EXISTS idx_habit_summaries_time ON habit_summaries(summarized_at DESC);
            """
        )

        await _ensure_column(db, "sessions", "owner_id", "TEXT NOT NULL DEFAULT 'system'")
        await _ensure_column(db, "sessions", "created_at", "TEXT")
        await _ensure_column(db, "sessions", "updated_at", "TEXT")
        await _ensure_column(db, "sessions", "started_at", "TEXT")
        await _ensure_column(db, "sessions", "ended_at", "TEXT")
        await _ensure_column(db, "sessions", "title", "TEXT")
        await _ensure_column(db, "sessions", "metadata", "TEXT DEFAULT '{}' ")
        await _ensure_column(db, "sessions", "personality_mode", "TEXT")
        await _ensure_column(db, "sessions", "emotion_profile", "TEXT")

        await _ensure_column(db, "messages", "owner_id", "TEXT NOT NULL DEFAULT 'system'")
        await _ensure_column(db, "messages", "intent", "TEXT")
        await _ensure_column(db, "messages", "emotion_state", "TEXT")
        await _ensure_column(db, "messages", "created_at", "TEXT")
        await _ensure_column(db, "messages", "timestamp", "TEXT")

        await _ensure_column(db, "memories", "owner_id", "TEXT NOT NULL DEFAULT 'system'")
        await _ensure_column(db, "memories", "source", "TEXT")
        await _ensure_column(db, "memories", "expires_at", "TEXT")
        await _ensure_column(db, "memories", "created_at", "TEXT")
        await _ensure_column(db, "memories", "updated_at", "TEXT")

        await _ensure_column(db, "habits", "description", "TEXT")
        await _ensure_column(db, "habits", "trigger", "TEXT")
        await _ensure_column(db, "habits", "trigger_value", "TEXT")
        await _ensure_column(db, "habits", "action", "TEXT")
        await _ensure_column(db, "habits", "occurrences", "INTEGER DEFAULT 0")
        await _ensure_column(db, "habits", "last_seen", "TEXT")
        await _ensure_column(db, "habits", "auto_suggest", "INTEGER DEFAULT 1")
        await _ensure_column(db, "habits", "name", "TEXT")
        await _ensure_column(db, "habits", "pattern", "TEXT")
        await _ensure_column(db, "habits", "occurrence_count", "INTEGER DEFAULT 0")
        await _ensure_column(db, "habits", "metadata", "TEXT DEFAULT '{}' ")

        await db.execute("CREATE INDEX IF NOT EXISTS idx_messages_owner ON messages(owner_id)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_memories_owner ON memories(owner_id)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_memories_expires_at ON memories(expires_at)")

        await db.commit()
    logger.info("Database initialised at %s", DB_PATH)


class LongTermMemory:
    async def store_message(
        self,
        session_id: str,
        message_id: str,
        role: str,
        content: str,
        intent: Optional[str] = None,
        owner_id: Optional[str] = None,
    ) -> None:
        resolved_owner = (owner_id or DEFAULT_OWNER_ID).strip() or DEFAULT_OWNER_ID
        async with aiosqlite.connect(DB_PATH) as db:
            now = datetime.utcnow().isoformat()
            await db.execute(
                """
                INSERT OR IGNORE INTO sessions(id, owner_id, created_at, updated_at, started_at, metadata)
                VALUES (?,?,?,?,?,?)
                """,
                (session_id, resolved_owner, now, now, now, "{}"),
            )
            await db.execute(
                """
                INSERT OR IGNORE INTO messages(
                    id, session_id, owner_id, role, content, intent, emotion_state, created_at, timestamp
                ) VALUES (?,?,?,?,?,?,?,?,?)
                """,
                (message_id, session_id, resolved_owner, role, content, intent, None, now, now),
            )
            await db.execute(
                "UPDATE sessions SET updated_at=? WHERE id=?",
                (now, session_id),
            )
            await db.commit()

    async def get_messages(self, session_id: str, limit: int = 50, owner_id: Optional[str] = None) -> list[dict]:
        resolved_owner = (owner_id or DEFAULT_OWNER_ID).strip() or DEFAULT_OWNER_ID
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                """
                SELECT
                    id,
                    session_id,
                    owner_id,
                    role,
                    content,
                    intent,
                    emotion_state,
                    COALESCE(timestamp, created_at) AS created_at
                FROM messages
                WHERE session_id=? AND owner_id=?
                ORDER BY COALESCE(timestamp, created_at) DESC
                LIMIT ?
                """,
                (session_id, resolved_owner, limit),
            )
            rows = await cursor.fetchall()
            return [dict(r) for r in reversed(rows)]

    async def store_fact(
        self,
        fact_id: str,
        category: str,
        key: str,
        value: str,
        confidence: float = 1.0,
        source: Optional[str] = None,
        owner_id: Optional[str] = None,
        ttl_days: Optional[int] = None,
    ) -> None:
        resolved_owner = (owner_id or DEFAULT_OWNER_ID).strip() or DEFAULT_OWNER_ID
        ttl_config = ttl_days if ttl_days is not None else int(os.getenv("MEMORY_TTL_DAYS", "30"))
        expires_at = (datetime.utcnow() + timedelta(days=max(1, ttl_config))).isoformat()
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            now = datetime.utcnow().isoformat()
            cursor = await db.execute(
                "SELECT id FROM memories WHERE owner_id=? AND category=? AND key=? LIMIT 1",
                (resolved_owner, category, key),
            )
            existing = await cursor.fetchone()

            if existing:
                await db.execute(
                    """
                    UPDATE memories
                    SET value=?, confidence=?, source=COALESCE(?, source), expires_at=?, updated_at=?
                    WHERE id=?
                    """,
                    (value, confidence, source, expires_at, now, existing["id"]),
                )
            else:
                await db.execute(
                    """
                    INSERT INTO memories(id, owner_id, category, key, value, confidence, source, expires_at, created_at, updated_at)
                    VALUES (?,?,?,?,?,?,?,?,?,?)
                    """,
                    (fact_id, resolved_owner, category, key, value, confidence, source, expires_at, now, now),
                )
            await db.commit()

    async def get_facts(self, category: Optional[str] = None, owner_id: Optional[str] = None) -> list[dict]:
        resolved_owner = (owner_id or DEFAULT_OWNER_ID).strip() or DEFAULT_OWNER_ID
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            if category:
                cursor = await db.execute(
                    "SELECT * FROM memories WHERE owner_id=? AND category=? ORDER BY updated_at DESC",
                    (resolved_owner, category),
                )
            else:
                cursor = await db.execute(
                    "SELECT * FROM memories WHERE owner_id=? ORDER BY updated_at DESC",
                    (resolved_owner,),
                )
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def search_facts(self, query: str, owner_id: Optional[str] = None) -> list[dict]:
        resolved_owner = (owner_id or DEFAULT_OWNER_ID).strip() or DEFAULT_OWNER_ID
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            like = f"%{query}%"
            cursor = await db.execute(
                "SELECT * FROM memories WHERE owner_id=? AND (key LIKE ? OR value LIKE ?) ORDER BY confidence DESC, updated_at DESC LIMIT 20",
                (resolved_owner, like, like),
            )
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def delete_fact(self, fact_id: str, owner_id: Optional[str] = None) -> bool:
        resolved_owner = (owner_id or DEFAULT_OWNER_ID).strip() or DEFAULT_OWNER_ID
        async with aiosqlite.connect(DB_PATH) as db:
            cursor = await db.execute("DELETE FROM memories WHERE id=? AND owner_id=?", (fact_id, resolved_owner))
            await db.commit()
            return cursor.rowcount > 0

    async def purge_expired_memories(self, owner_id: Optional[str] = None) -> int:
        now = datetime.utcnow().isoformat()
        async with aiosqlite.connect(DB_PATH) as db:
            if owner_id:
                cursor = await db.execute(
                    "DELETE FROM memories WHERE owner_id=? AND expires_at IS NOT NULL AND expires_at < ?",
                    (owner_id, now),
                )
            else:
                cursor = await db.execute(
                    "DELETE FROM memories WHERE expires_at IS NOT NULL AND expires_at < ?",
                    (now,),
                )
            await db.commit()
            return int(cursor.rowcount or 0)

    async def enforce_memory_limit(self, owner_id: str, max_items: int) -> int:
        if max_items <= 0:
            return 0

        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT id FROM memories WHERE owner_id=? ORDER BY updated_at DESC",
                (owner_id,),
            )
            rows = await cursor.fetchall()
            if len(rows) <= max_items:
                return 0

            to_delete = [row["id"] for row in rows[max_items:]]
            await db.executemany("DELETE FROM memories WHERE id=?", [(fact_id,) for fact_id in to_delete])
            await db.commit()
            return len(to_delete)

    async def get_habits(self) -> list[dict[str, Any]]:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                """
                SELECT
                    id,
                    COALESCE(description, name, pattern, trigger_value, trigger) AS description,
                    trigger,
                    trigger_value,
                    action,
                    COALESCE(occurrences, occurrence_count, 0) AS occurrences,
                    COALESCE(occurrence_count, occurrences, 0) AS occurrence_count,
                    last_seen,
                    COALESCE(auto_suggest, 1) AS auto_suggest,
                    metadata
                FROM habits
                ORDER BY COALESCE(occurrences, occurrence_count, 0) DESC, last_seen DESC
                """
            )
            rows = await cursor.fetchall()
            habits: list[dict[str, Any]] = []
            for row in rows:
                item = dict(row)
                for json_field in ("action", "metadata"):
                    if isinstance(item.get(json_field), str) and item[json_field]:
                        try:
                            item[json_field] = json.loads(item[json_field])
                        except json.JSONDecodeError:
                            pass
                habits.append(item)
            return habits

    async def upsert_habit(
        self,
        *,
        description: str,
        trigger: str,
        trigger_value: str,
        action: Optional[dict[str, Any]] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            now = datetime.utcnow().isoformat()
            action_json = json.dumps(action or {})
            metadata_json = json.dumps(metadata or {})
            cursor = await db.execute(
                """
                SELECT id, COALESCE(occurrences, occurrence_count, 0) AS total
                FROM habits
                WHERE trigger=? AND trigger_value=? AND action=?
                LIMIT 1
                """,
                (trigger, trigger_value, action_json),
            )
            existing = await cursor.fetchone()

            if existing:
                await db.execute(
                    """
                    UPDATE habits
                    SET description=?,
                        name=?,
                        pattern=?,
                        metadata=?,
                        occurrences=COALESCE(occurrences, 0) + 1,
                        occurrence_count=COALESCE(occurrence_count, 0) + 1,
                        last_seen=?,
                        auto_suggest=1
                    WHERE id=?
                    """,
                    (description, description, trigger_value, metadata_json, now, existing["id"]),
                )
                await db.commit()
                return {
                    "id": existing["id"],
                    "description": description,
                    "occurrences": int(existing["total"]) + 1,
                    "action": action or {},
                }

            habit_id = str(uuid.uuid4())
            await db.execute(
                """
                INSERT INTO habits(
                    id, description, trigger, trigger_value, action, occurrences, last_seen,
                    auto_suggest, name, pattern, occurrence_count, metadata
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    habit_id,
                    description,
                    trigger,
                    trigger_value,
                    action_json,
                    1,
                    now,
                    1,
                    description,
                    trigger_value,
                    1,
                    metadata_json,
                ),
            )
            await db.commit()
            return {
                "id": habit_id,
                "description": description,
                "occurrences": 1,
                "action": action or {},
            }
