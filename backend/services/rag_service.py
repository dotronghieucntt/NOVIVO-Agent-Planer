"""
RAG Service -- ChromaDB knowledge base.
Falls back to SQLite keyword search when ChromaDB native DLLs are unavailable.

SQLite fallback improvements:
- Bigram phrase matching (e.g. "ISO 9001" as a unit)
- Title/category boosting (title match worth 4x body)
- Accent-insensitive matching for Vietnamese
- TF-IDF-like length normalization
- Content preview truncation (max 1,200 chars per chunk)
- In-process source ID cache (avoids repeated DB hits)
- Multi-query expansion in build_rag_context
"""
import re
import math
import logging
import unicodedata
import chromadb
from config import settings

logger = logging.getLogger(__name__)

_client = None
_collection = None
_chroma_ok = None

# ─── Vietnamese-aware text helpers ────────────────────────────────────────────

_STOP_WORDS = {
    'va', 'cua', 'co', 'la', 'de', 'trong', 'voi', 'cho', 'cac', 'mot',
    'duoc', 'nay', 'do', 'theo', 'tu', 'khi', 've', 'nhu', 'len', 'tai',
    'the', 'and', 'for', 'with', 'that', 'this', 'are', 'was', 'not', 'but',
    'has', 'its', 'can', 'will', 'also',
}


def _normalize(text: str) -> str:
    """Strip diacritics + lowercase so 'ISO', 'Iso', 'tiêu chuẩn', 'tieu chuan' all match."""
    nfkd = unicodedata.normalize('NFKD', text)
    stripped = ''.join(c for c in nfkd if not unicodedata.combining(c))
    return stripped.lower()


def _tokenize(text: str) -> list:
    """Return unigrams + bigrams, filtered of stop words (length >= 2)."""
    words = re.findall(r'[a-z0-9]+', _normalize(text))
    words = [w for w in words if len(w) >= 2 and w not in _STOP_WORDS]
    bigrams = [f"{words[i]}_{words[i+1]}" for i in range(len(words) - 1)]
    return words + bigrams


def _truncate_content(content: str, max_chars: int = 1200) -> str:
    """Return at most max_chars, cutting at last sentence boundary."""
    if len(content) <= max_chars:
        return content
    cut = content[:max_chars]
    for sep in ('. ', '.\n', '! ', '? ', '\n\n'):
        idx = cut.rfind(sep)
        if idx > max_chars // 2:
            return cut[:idx + 1] + ' […]'
    return cut + ' […]'


def _score_doc(doc_tokens, title_tokens, cat_tokens, query_tokens, doc_len: int) -> float:
    """
    Weighted TF-style score:
      title match  → weight 4
      category     → weight 2
      body         → weight 1
    Divided by log(doc_length) so long rambling docs don't dominate.
    """
    score = 0.0
    for qt in query_tokens:
        score += title_tokens.count(qt) * 4
        score += cat_tokens.count(qt) * 2
        score += doc_tokens.count(qt)
    if score == 0:
        return 0.0
    return score / (math.log(max(doc_len, 10) / 80 + 1) + 0.5)


# ─── ChromaDB ─────────────────────────────────────────────────────────────────

def _get_collection():
    global _client, _collection, _chroma_ok
    if _chroma_ok is False:
        return None
    if _collection is None:
        try:
            _client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)
            _collection = _client.get_or_create_collection(
                name=settings.CHROMA_COLLECTION_NAME,
                metadata={"hnsw:space": "cosine"},
            )
            _chroma_ok = True
        except Exception as e:
            logger.warning("ChromaDB unavailable (%s) -- using SQLite fallback", e)
            _chroma_ok = False
            return None
    return _collection


def add_document(doc_id: str, content: str, metadata: dict) -> None:
    col = _get_collection()
    if col is None:
        raise RuntimeError("ChromaDB not available")
    col.upsert(ids=[doc_id], documents=[content], metadatas=[metadata])


def delete_document(doc_id: str) -> None:
    col = _get_collection()
    if col is None:
        return
    col.delete(ids=[doc_id])


# ─── Query ────────────────────────────────────────────────────────────────────

def query_knowledge(query: str, n_results: int = 5, active_source_ids: list | None = None) -> list:
    """
    Query the knowledge base.
    - If active_source_ids provided → always SQLite (ChromaDB has no source filter).
    - Otherwise tries ChromaDB, falls back to SQLite.
    """
    if active_source_ids is not None:
        return _sqlite_fallback(query, n_results, active_source_ids)
    col = _get_collection()
    if col is not None:
        try:
            count = col.count()
            if count > 0:
                results = col.query(query_texts=[query], n_results=min(n_results, count))
                return [
                    {
                        "content": _truncate_content(doc),
                        "metadata": results["metadatas"][0][i],
                        "distance": results["distances"][0][i],
                    }
                    for i, doc in enumerate(results["documents"][0])
                ]
        except Exception as e:
            logger.warning("ChromaDB query failed (%s) -- fallback", e)
    return _sqlite_fallback(query, n_results)


def _sqlite_fallback(query: str, n_results: int = 5, active_source_ids: list | None = None) -> list:
    """
    Enhanced SQLite keyword search with bigrams, title boost, and length normalization.
    """
    if active_source_ids is not None and len(active_source_ids) == 0:
        return []
    try:
        from database import SessionLocal
        from models.content import KnowledgeDocument
        db = SessionLocal()
        try:
            query_tokens = _tokenize(query)
            if not query_tokens:
                return []

            q = db.query(KnowledgeDocument)
            if active_source_ids:
                q = q.filter(KnowledgeDocument.source_id.in_(active_source_ids))
            all_docs = q.all()

            scored = []
            for doc in all_docs:
                score = _score_doc(
                    _tokenize(doc.content),
                    _tokenize(doc.title),
                    _tokenize(doc.category or ''),
                    query_tokens,
                    len(doc.content),
                )
                if score > 0:
                    scored.append((score, doc))

            scored.sort(key=lambda x: x[0], reverse=True)
            return [
                {
                    "content": _truncate_content(d.content),
                    "metadata": {"title": d.title, "category": d.category or "Chung"},
                    "distance": 1.0 / (s + 1),
                    "score": round(s, 2),
                }
                for s, d in scored[:n_results]
            ]
        finally:
            db.close()
    except Exception as e:
        logger.warning("SQLite fallback failed: %s", e)
        return []


# ─── Source ID cache ──────────────────────────────────────────────────────────

_source_cache: dict = {"ids": None, "loaded": False}


def _get_active_source_ids() -> list | None:
    """
    Return active source IDs. Result is cached in-process to avoid repeated DB
    hits within the same request cycle. Call invalidate_source_cache() after any
    source create/update/delete.
    """
    if _source_cache["loaded"]:
        return _source_cache["ids"]
    try:
        from database import SessionLocal
        from models.content import KnowledgeSource
        db = SessionLocal()
        try:
            sources = db.query(KnowledgeSource).all()
            if not sources:
                _source_cache.update({"ids": None, "loaded": True})
                return None
            active = [s.id for s in sources if s.is_active]
            _source_cache.update({"ids": active, "loaded": True})
            return active
        finally:
            db.close()
    except Exception as e:
        logger.warning("Could not load active sources: %s", e)
        _source_cache.update({"ids": None, "loaded": True})
        return None


def invalidate_source_cache() -> None:
    """Call after adding/updating/deleting knowledge sources."""
    _source_cache["loaded"] = False


# ─── Context builder ──────────────────────────────────────────────────────────

def build_rag_context(query: str) -> str:
    """
    Build a knowledge context block for the AI prompt.
    Runs two query variants (original + accent-stripped) and deduplicates results.
    """
    active_ids = _get_active_source_ids()
    if active_ids is not None and len(active_ids) == 0:
        return ""

    # Multi-query: original + accent-normalized variant
    queries = [query]
    norm = _normalize(query)
    if norm != query:
        queries.append(norm)

    seen: set = set()
    chunks: list = []
    for q in queries:
        for chunk in query_knowledge(q, n_results=5, active_source_ids=active_ids):
            key = chunk["content"][:60]
            if key not in seen:
                seen.add(key)
                chunks.append(chunk)

    if not chunks:
        return ""

    lines = ["=== THÔNG TIN THƯ VIỆN DỰ ÁN (ưu tiên tin cậy) ==="]
    for chunk in chunks:
        meta = chunk["metadata"]
        lines.append(f"\n[{meta.get('category', 'Chung')} | {meta.get('title', '')}]")
        lines.append(chunk["content"])
    lines.append("====================================================")
    return "\n".join(lines)
