"""Long-term SQLite memory store for ELIXI AI Engine."""

import aiosqlite
import logging
from pathlib import Path
from typing import Optional
from datetime import datetime

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).resolve().parent.parent.parent / "memory" / "elixi.db"


async def init_database() -> None:
    """Create all required tables if they do not exist."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                title TEXT,
                metadata TEXT DEFAULT '{}'
            );

            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
                content TEXT NOT NULL,
                intent TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            );

            CREATE TABLE IF NOT EXISTS memories (
                id TEXT PRIMARY KEY,
                category TEXT NOT NULL,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                confidence REAL DEFAULT 1.0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(category, key)
            );

            CREATE TABLE IF NOT EXISTS habits (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                pattern TEXT NOT NULL,
                occurrence_count INTEGER DEFAULT 0,
                last_seen TEXT,
                metadata TEXT DEFAULT '{}'
            );

            CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
            CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);
            """
        )
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
    ) -> None:
        async with aiosqlite.connect(DB_PATH) as db:
            now = datetime.utcnow().isoformat()
            # Ensure session exists
            await db.execute(
                "INSERT OR IGNORE INTO sessions(id, created_at, updated_at) VALUES (?,?,?)",
                (session_id, now, now),
            )
            await db.execute(
                "INSERT OR IGNORE INTO messages(id, session_id, role, content, intent, created_at) "
                "VALUES (?,?,?,?,?,?)",
                (message_id, session_id, role, content, intent, now),
            )
            await db.execute(
                "UPDATE sessions SET updated_at=? WHERE id=?",
                (now, session_id),
            )
            await db.commit()

    async def get_messages(self, session_id: str, limit: int = 50) -> list[dict]:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT * FROM messages WHERE session_id=? ORDER BY created_at DESC LIMIT ?",
                (session_id, limit),
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
    ) -> None:
        async with aiosqlite.connect(DB_PATH) as db:
            now = datetime.utcnow().isoformat()
            await db.execute(
                """
                INSERT INTO memories(id, category, key, value, confidence, created_at, updated_at)
                VALUES (?,?,?,?,?,?,?)
                ON CONFLICT(category, key) DO UPDATE SET
                    value=excluded.value,
                    confidence=excluded.confidence,
                    updated_at=excluded.updated_at
                """,
                (fact_id, category, key, value, confidence, now, now),
            )
            await db.commit()

    async def get_facts(self, category: Optional[str] = None) -> list[dict]:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            if category:
                cursor = await db.execute(
                    "SELECT * FROM memories WHERE category=? ORDER BY updated_at DESC",
                    (category,),
                )
            else:
                cursor = await db.execute(
                    "SELECT * FROM memories ORDER BY updated_at DESC"
                )
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def search_facts(self, query: str) -> list[dict]:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            like = f"%{query}%"
            cursor = await db.execute(
                "SELECT * FROM memories WHERE key LIKE ? OR value LIKE ? ORDER BY confidence DESC LIMIT 20",
                (like, like),
            )
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def delete_fact(self, fact_id: str) -> bool:
        async with aiosqlite.connect(DB_PATH) as db:
            cursor = await db.execute("DELETE FROM memories WHERE id=?", (fact_id,))
            await db.commit()
            return cursor.rowcount > 0

    async def get_habits(self) -> list[dict]:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT * FROM habits ORDER BY occurrence_count DESC"
            )
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]
