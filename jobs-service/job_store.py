"""Chroma-backed store of job listings with JobTech synchronisation."""

import logging
import threading
import time
from typing import Any, Dict, List, Optional, Sequence

import chromadb
from chromadb.config import Settings as ChromaSettings

from config import Settings
from embeddings import Embedder
from jobtech import JobRecord, JobTechClient, normalize_job
from query_normalizer import clean_text, normalize_query

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("JobStore")


class JobStore:
    """Encapsulates the Chroma collection, embeddings, and JobTech sync logic.

    Embeddings are computed here (not by Chroma) so the collection carries no
    embedding-function config and the service needs no PyTorch install.
    """

    def __init__(self, settings: Settings):
        self._settings = settings
        self._sync_lock = threading.Lock()
        self._seeding = threading.Event()
        self._syncing = threading.Event()

        settings.chroma_path.mkdir(parents=True, exist_ok=True)
        logger.info("Connecting to ChromaDB at %s", settings.chroma_path.resolve())
        self._client = chromadb.PersistentClient(
            path=str(settings.chroma_path),
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        self.collection = self._client.get_or_create_collection(
            name=settings.collection_name,
            embedding_function=None,
            metadata={"hnsw:space": "cosine"},
        )

        self.embedder = Embedder(
            model_name=settings.embedding_model,
            model_dir=settings.model_dir,
            threads=settings.embedding_threads,
            batch_size=settings.embedding_batch_size,
            max_tokens=settings.embedding_max_tokens,
        )
        self.jobtech = JobTechClient(settings.jobtech_api_url, settings.jobtech_timeout_seconds)

        logger.info(
            "ChromaDB ready. Collection '%s' holds %d job listings.",
            settings.collection_name,
            self.collection.count(),
        )

    # ------------------------------------------------------------------ status

    @property
    def model_name(self) -> str:
        return self.embedder.model_name

    @property
    def is_seeding(self) -> bool:
        return self._seeding.is_set()

    @property
    def is_syncing(self) -> bool:
        return self._syncing.is_set()

    def count(self) -> int:
        return self.collection.count()

    # -------------------------------------------------------------------- sync

    def _upsert(self, records: Sequence[JobRecord]) -> int:
        """Embed only listings that are new; for known ones just refresh metadata."""
        if not records:
            return 0

        # The same ad can appear under several queries — keep the first occurrence.
        unique = list({record.id: record for record in reversed(records)}.values())
        ids = [record.id for record in unique]

        existing_ids = set(self.collection.get(ids=ids, include=[])["ids"])
        new_records = [record for record in unique if record.id not in existing_ids]
        known_records = [record for record in unique if record.id in existing_ids]

        if new_records:
            self.collection.add(
                ids=[record.id for record in new_records],
                documents=[record.document for record in new_records],
                metadatas=[record.metadata for record in new_records],
                embeddings=self.embedder.embed_documents([record.embed_text for record in new_records]),
            )

        if known_records:
            self.collection.update(
                ids=[record.id for record in known_records],
                metadatas=[record.metadata for record in known_records],
            )

        logger.info("Indexed %d new and refreshed %d known listings.", len(new_records), len(known_records))
        return len(unique)

    def sync_jobs(self, query_term: str, limit: int = 50) -> int:
        """Fetch -> normalise -> index pipeline for one query term."""
        records = [
            record
            for raw in self.jobtech.fetch(query_term, limit)
            if (record := normalize_job(raw, query_term)) is not None
        ]
        if not records:
            logger.warning("No usable jobs returned for '%s'", query_term)
            return 0

        with self._sync_lock:
            return self._upsert(records)

    def sync_many(self, queries: Sequence[str], limit: int) -> int:
        total = 0
        self._syncing.set()
        try:
            for query in queries:
                try:
                    total += self.sync_jobs(query, limit=limit)
                except Exception:  # one bad query must not stop the rest
                    logger.exception("Error syncing query '%s'", query)
            self.prune_expired()
        finally:
            self._syncing.clear()
        return total

    def prune_expired(self) -> None:
        if self._settings.job_ttl_days <= 0:
            return
        cutoff = int(time.time()) - self._settings.job_ttl_days * 86_400
        with self._sync_lock:
            self.collection.delete(where={"fetched_at_ts": {"$lt": cutoff}})

    def seed_if_empty(self) -> None:
        """Bootstrap default IT listings. Safe to call concurrently — only one seed runs."""
        if self.count() > 0 or self._seeding.is_set():
            return

        self._seeding.set()
        try:
            logger.info("Index is empty. Bootstrapping listings from Arbetsförmedlingen...")
            self.sync_many(self._settings.seed_queries, self._settings.seed_limit_per_query)
            logger.info("Initial seed complete. %d listings indexed.", self.count())
        finally:
            self._seeding.clear()

    def start_background_seed(self) -> None:
        if self.count() == 0 and not self._seeding.is_set():
            threading.Thread(target=self.seed_if_empty, name="seed", daemon=True).start()

    # ------------------------------------------------------------------ search

    def _chunk_text(self, text: str) -> List[str]:
        """Overlapping word windows, so a long CV is searched by every part, not just its start.

        The embedding model only reads ~128 tokens per input; embedding a whole CV as one
        string would silently ignore everything after the first paragraph.
        """
        words = text.split()
        size, step = self._settings.chunk_words, self._settings.chunk_step
        chunks = [" ".join(words[start : start + size]) for start in range(0, len(words), step)]
        meaningful = [chunk for chunk in chunks if len(chunk.split()) >= self._settings.min_chunk_words]
        return (meaningful or chunks[:1])[: self._settings.max_chunks]

    def search_jobs(
        self,
        query_text: str,
        n_results: int = 10,
        *,
        location: Optional[str] = None,
        max_age_days: Optional[int] = None,
        long_text: bool = False,
    ) -> List[Dict[str, Any]]:
        """Semantic search.

        long_text: treat the query as a document (a CV) — it is split into chunks, each chunk
        is searched, and a job's score blends its best and its average chunk similarity, so
        jobs that fit the whole profile beat jobs that match a single line.
        """
        limit = self._settings.max_long_text_chars if long_text else self._settings.max_query_chars
        # A typed term gets Swedish spelling/equivalents added; a CV only gets whitespace clean-up.
        clean_query = clean_text(query_text)[:limit] if long_text else normalize_query(query_text[:limit])
        total = self.count()
        if not clean_query or total == 0:
            return []

        wanted = max(1, n_results)
        where = None
        if max_age_days:
            where = {"published_ts": {"$gte": int(time.time()) - max_age_days * 86_400}}

        # Over-fetch: a location filter or multi-chunk fusion discards candidates afterwards.
        fetch = min(total, 500 if location else max(wanted * 3, 30))

        queries = self._chunk_text(clean_query) if long_text else [clean_query]
        vectors = self.embedder.embed_queries(queries)

        result = self.collection.query(
            query_embeddings=vectors,
            n_results=fetch,
            where=where,
            include=["documents", "metadatas", "distances"],
        )

        # Collect each job's similarity per chunk; a chunk that did not return the job
        # counts as that chunk's weakest returned similarity.
        candidates: Dict[str, Dict[str, Any]] = {}
        floors: List[float] = []
        for index in range(len(vectors)):
            similarities = [1.0 - distance for distance in result["distances"][index]]
            floors.append(min(similarities) if similarities else 0.0)
            for job_id, document, metadata, similarity in zip(
                result["ids"][index], result["documents"][index], result["metadatas"][index], similarities
            ):
                entry = candidates.setdefault(job_id, {"document": document, "metadata": metadata, "sims": {}})
                entry["sims"][index] = similarity

        needle = location.strip().casefold() if location else ""
        ranked = []
        for entry in candidates.values():
            if needle and needle not in str(entry["metadata"].get("location", "")).casefold():
                continue
            per_chunk = [entry["sims"].get(index, floors[index]) for index in range(len(vectors))]
            best, mean = max(per_chunk), sum(per_chunk) / len(per_chunk)
            score = best if len(per_chunk) == 1 else 0.5 * best + 0.5 * mean
            ranked.append((score, entry))

        ranked.sort(key=lambda item: item[0], reverse=True)

        return [
            {
                "similarity_distance": round(1.0 - score, 4),
                "similarity_score": max(0.0, min(100.0, round(score * 100, 1))),
                "metadata": entry["metadata"],
                "document": entry["document"],
            }
            for score, entry in ranked[:wanted]
        ]
