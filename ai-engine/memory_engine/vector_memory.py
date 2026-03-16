"""Semantic retrieval over persisted local memory using TF-IDF ranking."""

import json
import logging
import sqlite3
from typing import Optional

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from memory_engine.long_term_memory import DB_PATH

logger = logging.getLogger(__name__)


class VectorMemory:
    """Local semantic retrieval backed by SQLite content and lightweight TF-IDF search."""

    def store(self, doc_id: str, text: str, metadata: Optional[dict] = None) -> None:
        if not text.strip():
            return

        with sqlite3.connect(DB_PATH) as db:
            db.execute(
                """
                INSERT INTO vector_documents(id, text, metadata, created_at, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT(id) DO UPDATE SET
                    text=excluded.text,
                    metadata=excluded.metadata,
                    updated_at=CURRENT_TIMESTAMP
                """,
                (doc_id, text.strip(), json.dumps(metadata or {})),
            )
            db.commit()

    def _fetch_documents(self, session_id: Optional[str] = None) -> list[dict]:
        documents: list[dict] = []

        with sqlite3.connect(DB_PATH) as db:
            db.row_factory = sqlite3.Row

            fact_rows = db.execute(
                """
                SELECT id, category, key, value, confidence, source
                FROM memories
                ORDER BY updated_at DESC
                LIMIT 300
                """
            ).fetchall()
            for row in fact_rows:
                content = f"{row['category']} {row['key']} {row['value']}"
                documents.append(
                    {
                        "id": row["id"],
                        "content": content.strip(),
                        "metadata": {
                            "source": "memory",
                            "category": row["category"],
                            "key": row["key"],
                            "confidence": row["confidence"],
                            "origin": row["source"],
                        },
                        "boost": 1.0 + float(row["confidence"] or 0.0) * 0.25,
                    }
                )

            if session_id:
                message_rows = db.execute(
                    """
                    SELECT id, role, content, intent, COALESCE(timestamp, created_at) AS created_at
                    FROM messages
                    WHERE session_id = ?
                    ORDER BY COALESCE(timestamp, created_at) DESC
                    LIMIT 120
                    """,
                    (session_id,),
                ).fetchall()
                for row in message_rows:
                    documents.append(
                        {
                            "id": row["id"],
                            "content": row["content"].strip(),
                            "metadata": {
                                "source": "message",
                                "role": row["role"],
                                "intent": row["intent"],
                                "createdAt": row["created_at"],
                            },
                            "boost": 0.9,
                        }
                    )

            habit_rows = db.execute(
                """
                SELECT id,
                       COALESCE(description, name, pattern, trigger_value, trigger) AS description,
                       action,
                       trigger,
                       trigger_value,
                       COALESCE(occurrences, occurrence_count, 0) AS occurrences
                FROM habits
                WHERE COALESCE(occurrences, occurrence_count, 0) >= 2
                ORDER BY COALESCE(occurrences, occurrence_count, 0) DESC
                LIMIT 100
                """
            ).fetchall()
            for row in habit_rows:
                documents.append(
                    {
                        "id": row["id"],
                        "content": str(row["description"] or "").strip(),
                        "metadata": {
                            "source": "habit",
                            "trigger": row["trigger"],
                            "triggerValue": row["trigger_value"],
                            "action": row["action"],
                            "occurrences": row["occurrences"],
                        },
                        "boost": 1.0 + min(int(row["occurrences"] or 0), 10) * 0.05,
                    }
                )

            vector_rows = db.execute(
                "SELECT id, text, metadata FROM vector_documents ORDER BY updated_at DESC LIMIT 200"
            ).fetchall()
            for row in vector_rows:
                metadata = {}
                if row["metadata"]:
                    try:
                        metadata = json.loads(row["metadata"])
                    except json.JSONDecodeError:
                        metadata = {"raw": row["metadata"]}
                documents.append(
                    {
                        "id": row["id"],
                        "content": row["text"].strip(),
                        "metadata": {"source": "vector", **metadata},
                        "boost": 1.0,
                    }
                )

        unique_documents: list[dict] = []
        seen: set[tuple[str, str]] = set()
        for doc in documents:
            key = (doc["id"], doc["content"])
            if doc["content"] and key not in seen:
                unique_documents.append(doc)
                seen.add(key)
        return unique_documents

    def search(self, query: str, top_k: int = 5, session_id: Optional[str] = None) -> list[dict]:
        query = query.strip()
        if not query:
            return []

        documents = self._fetch_documents(session_id=session_id)
        if not documents:
            logger.debug("VectorMemory.search found no documents for query: %s", query)
            return []

        corpus = [doc["content"] for doc in documents]
        try:
            vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words="english", max_features=6000)
            matrix = vectorizer.fit_transform(corpus + [query])
        except ValueError:
            return []

        doc_vectors = matrix[:-1]
        query_vector = matrix[-1]
        similarities = cosine_similarity(query_vector, doc_vectors).ravel()
        query_terms = {term for term in query.lower().split() if len(term) > 2}

        ranked: list[dict] = []
        for index, similarity in enumerate(similarities):
            doc = documents[index]
            doc_terms = {term for term in doc["content"].lower().split() if len(term) > 2}
            overlap_bonus = 0.1 * len(query_terms & doc_terms)
            score = float(similarity) * doc.get("boost", 1.0) + overlap_bonus
            if score < 0.08:
                continue
            ranked.append(
                {
                    "id": doc["id"],
                    "content": doc["content"],
                    "score": round(score, 4),
                    "metadata": doc["metadata"],
                }
            )

        ranked.sort(key=lambda item: item["score"], reverse=True)
        return ranked[:top_k]
