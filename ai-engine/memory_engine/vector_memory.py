"""Semantic retrieval with ChromaDB + sentence-transformers, with TF-IDF fallback."""

import json
import logging
import sqlite3
from pathlib import Path
from typing import Any, Optional

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from memory_engine.long_term_memory import DB_PATH

logger = logging.getLogger(__name__)


class VectorMemory:
    """Hybrid vector memory with local persistence and graceful fallback search."""

    def __init__(self) -> None:
        self._chroma_collection = None
        self._chroma_ready = False
        self._chroma_error: Optional[str] = None
        self._chroma_path = Path(DB_PATH).parent / "chroma"
        self._chroma_collection_name = "elixi_memory"
        self._ensure_chroma()

    def _ensure_chroma(self) -> None:
        if self._chroma_collection is not None or self._chroma_error:
            return

        try:
            import chromadb
            from chromadb.config import Settings
            from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

            self._chroma_path.mkdir(parents=True, exist_ok=True)
            client = chromadb.PersistentClient(
                path=str(self._chroma_path),
                settings=Settings(anonymized_telemetry=False),
            )
            embedding = SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")
            self._chroma_collection = client.get_or_create_collection(
                name=self._chroma_collection_name,
                embedding_function=embedding,
                metadata={"hnsw:space": "cosine"},
            )
            self._chroma_ready = True
            logger.info("VectorMemory ChromaDB ready at %s", self._chroma_path)
        except Exception as exc:
            self._chroma_error = str(exc)
            self._chroma_ready = False
            logger.warning("VectorMemory falling back to TF-IDF (Chroma unavailable): %s", exc)

    def _to_metadata(self, metadata: Optional[dict[str, Any]]) -> dict[str, Any]:
        safe: dict[str, Any] = {}
        for key, value in (metadata or {}).items():
            if isinstance(value, (str, int, float, bool)) or value is None:
                safe[key] = value
            else:
                safe[key] = json.dumps(value)
        return safe

    def store(self, doc_id: str, text: str, metadata: Optional[dict] = None) -> None:
        cleaned = text.strip()
        if not cleaned:
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
                (doc_id, cleaned, json.dumps(metadata or {})),
            )
            db.commit()

        self._ensure_chroma()
        if self._chroma_ready and self._chroma_collection is not None:
            try:
                self._chroma_collection.upsert(
                    ids=[doc_id],
                    documents=[cleaned],
                    metadatas=[self._to_metadata(metadata)],
                )
            except Exception as exc:
                logger.debug("VectorMemory Chroma upsert failed for %s: %s", doc_id, exc)

    def delete(self, doc_id: str) -> None:
        with sqlite3.connect(DB_PATH) as db:
            db.execute("DELETE FROM vector_documents WHERE id=?", (doc_id,))
            db.commit()

        self._ensure_chroma()
        if self._chroma_ready and self._chroma_collection is not None:
            try:
                self._chroma_collection.delete(ids=[doc_id])
            except Exception as exc:
                logger.debug("VectorMemory Chroma delete failed for %s: %s", doc_id, exc)

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
                        "id": f"memory:{row['id']}",
                        "raw_id": row["id"],
                        "content": content.strip(),
                        "metadata": {
                            "source": "memory",
                            "category": row["category"],
                            "key": row["key"],
                            "confidence": float(row["confidence"] or 0.0),
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
                            "id": f"message:{row['id']}",
                            "raw_id": row["id"],
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
                        "id": f"habit:{row['id']}",
                        "raw_id": row["id"],
                        "content": str(row["description"] or "").strip(),
                        "metadata": {
                            "source": "habit",
                            "trigger": row["trigger"],
                            "triggerValue": row["trigger_value"],
                            "action": row["action"],
                            "occurrences": int(row["occurrences"] or 0),
                        },
                        "boost": 1.0 + min(int(row["occurrences"] or 0), 10) * 0.05,
                    }
                )

            vector_rows = db.execute(
                "SELECT id, text, metadata FROM vector_documents ORDER BY updated_at DESC LIMIT 300"
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
                        "raw_id": row["id"],
                        "content": row["text"].strip(),
                        "metadata": {"source": "vector", **metadata},
                        "boost": 1.0,
                    }
                )

        unique_documents: list[dict] = []
        seen: set[str] = set()
        for doc in documents:
            if not doc["content"] or doc["id"] in seen:
                continue
            unique_documents.append(doc)
            seen.add(doc["id"])
        return unique_documents

    def _sync_chroma_documents(self, documents: list[dict]) -> None:
        if not self._chroma_ready or self._chroma_collection is None or not documents:
            return

        ids = [doc["id"] for doc in documents]
        texts = [doc["content"] for doc in documents]
        metadatas = [self._to_metadata(doc.get("metadata", {})) for doc in documents]

        try:
            self._chroma_collection.upsert(ids=ids, documents=texts, metadatas=metadatas)
        except Exception as exc:
            logger.debug("VectorMemory Chroma sync failed: %s", exc)

    def _search_tfidf(self, query: str, top_k: int, documents: list[dict]) -> list[dict]:
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
                    "id": doc["raw_id"],
                    "content": doc["content"],
                    "score": round(score, 4),
                    "metadata": doc["metadata"],
                }
            )

        ranked.sort(key=lambda item: item["score"], reverse=True)
        return ranked[:top_k]

    def search(self, query: str, top_k: int = 5, session_id: Optional[str] = None) -> list[dict]:
        query = query.strip()
        if not query:
            return []

        documents = self._fetch_documents(session_id=session_id)
        if not documents:
            logger.debug("VectorMemory.search found no documents for query: %s", query)
            return []

        self._ensure_chroma()
        if self._chroma_ready and self._chroma_collection is not None:
            self._sync_chroma_documents(documents)
            try:
                query_result = self._chroma_collection.query(
                    query_texts=[query],
                    n_results=max(top_k, 5),
                )
                ids = (query_result.get("ids") or [[]])[0]
                contents = (query_result.get("documents") or [[]])[0]
                metadatas = (query_result.get("metadatas") or [[]])[0]
                distances = (query_result.get("distances") or [[]])[0]

                ranked: list[dict] = []
                for idx, result_id in enumerate(ids):
                    metadata = metadatas[idx] if idx < len(metadatas) else {}
                    distance = float(distances[idx]) if idx < len(distances) else 0.0
                    score = max(0.0, 1.0 - distance)
                    content = contents[idx] if idx < len(contents) else ""
                    raw_id = result_id.split(":", 1)[1] if ":" in result_id else result_id
                    ranked.append(
                        {
                            "id": raw_id,
                            "content": content,
                            "score": round(score, 4),
                            "metadata": metadata,
                        }
                    )

                ranked.sort(key=lambda item: item["score"], reverse=True)
                if ranked:
                    return ranked[:top_k]
            except Exception as exc:
                logger.debug("VectorMemory Chroma query failed, using TF-IDF fallback: %s", exc)

        return self._search_tfidf(query=query, top_k=top_k, documents=documents)
