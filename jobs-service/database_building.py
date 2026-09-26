import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import chromadb
from chromadb.utils import embedding_functions
import requests
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("JobVectorDatabase")

DEFAULT_SEED_QUERIES = [
    "utvecklare",
    "frontend",
    "backend",
    "fullstack",
    "data engineer",
    "devops",
    "systemutvecklare",
    "projektledare it"
]

class JobVectorDatabase:
    """Encapsulates ChromaDB connection and Arbetsförmedlingen JobTech API sync logic."""

    def __init__(
        self,
        db_path: Optional[str] = None,
        collection_name: str = "swedish_job_listings",
        embedding_model: Optional[str] = None,
    ):
        self.db_path = Path(db_path or os.getenv("CHROMA_PATH", "./chroma_jobs"))
        self.db_path.mkdir(parents=True, exist_ok=True)
        self.jobtech_api_url = os.getenv(
            "JOBTECH_API_URL", "https://jobsearch.api.jobtechdev.se/search"
        )
        self.model_name = embedding_model or os.getenv(
            "EMBEDDING_MODEL", "paraphrase-multilingual-MiniLM-L12-v2"
        )

        logger.info(f"Connecting to ChromaDB at: {self.db_path.resolve()}")
        self.chroma_client = chromadb.PersistentClient(path=str(self.db_path))

        logger.info(f"Loading embedding model: {self.model_name}")
        self.embedding_function = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name=self.model_name
        )

        self.collection = self.chroma_client.get_or_create_collection(
            name=collection_name,
            embedding_function=self.embedding_function,
            metadata={"hnsw:space": "cosine"},
        )
        logger.info(
            f"ChromaDB ready. Collection '{collection_name}' currently holds {self.collection.count()} job listings."
        )

    def fetch_jobtech_jobs(self, query: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Fetch job listings from Arbetsförmedlingen JobSearch API."""
        headers = {"accept": "application/json"}
        params = {"q": query, "limit": min(limit, 100)}

        try:
            response = requests.get(
                self.jobtech_api_url, headers=headers, params=params, timeout=12
            )
            response.raise_for_status()
            data = response.json()
            hits = data.get("hits", [])
            logger.info(f"Fetched {len(hits)} raw listings from JobTech API for '{query}'")
            return hits
        except requests.RequestException as e:
            logger.error(f"Error fetching jobs from JobTech for query '{query}': {e}")
            return []

    def _normalize_job(self, job: Dict[str, Any], query_term: str) -> Tuple[str, str, Dict[str, Any]]:
        """Normalize raw JobTech ad JSON into Chroma-compatible structure."""
        job_id = str(job.get("id", ""))
        prefixed_id = f"af_{job_id}"

        headline = (job.get("headline") or "").strip()
        employer_info = job.get("employer") or {}
        company = (employer_info.get("name") or "Unknown Employer").strip()

        address = job.get("workplace_address") or {}
        location = (
            address.get("municipality")
            or address.get("city")
            or address.get("region")
            or "Sverige"
        ).strip()

        description_obj = job.get("description") or {}
        description = (
            description_obj.get("text")
            or description_obj.get("text_formatted")
            or ""
        ).strip()

        job_url = (
            job.get("webpage_url")
            or f"https://arbetsformedlingen.se/platsbanken/annonser/{job_id}"
        )

        summary_desc = description[:2000] if len(description) > 2000 else description

        document = "\n".join(
            filter(
                None,
                [
                    f"Title: {headline}",
                    f"Company: {company}",
                    f"Location: {location}",
                    f"Description: {summary_desc}",
                ],
            )
        )

        metadata = {
            "id": prefixed_id,
            "title": headline,
            "company": company,
            "location": location,
            "url": job_url,
            "source": "arbetsformedlingen",
            "query": query_term,
            "description_snippet": description[:300] + ("..." if len(description) > 300 else ""),
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }
        return prefixed_id, document, metadata

    def sync_jobs(self, query_term: str, limit: int = 50) -> int:
        """Runs the fetch -> upsert pipeline for a query term."""
        raw_jobs = self.fetch_jobtech_jobs(query_term, limit=limit)
        if not raw_jobs:
            logger.warning(f"No jobs returned for query '{query_term}'")
            return 0

        records = [self._normalize_job(job, query_term) for job in raw_jobs]
        valid_records = [r for r in records if r[0] and r[1]]

        if not valid_records:
            return 0

        fetched_ids = [r[0] for r in valid_records]
        documents = [r[1] for r in valid_records]
        metadatas = [r[2] for r in valid_records]

        self.collection.upsert(ids=fetched_ids, documents=documents, metadatas=metadatas)
        logger.info(f"Upserted {len(fetched_ids)} listings for '{query_term}'. Total count: {self.collection.count()}")
        return len(fetched_ids)

    def seed_if_empty(self) -> int:
        """Seed default IT and engineering listings if the collection is empty."""
        current_count = self.collection.count()
        if current_count > 0:
            logger.info(f"Collection already contains {current_count} items. Skipping initial seed.")
            return current_count

        logger.info("Database is empty. Bootstrapping initial tech listings from Arbetsförmedlingen...")
        total_seeded = 0
        for term in DEFAULT_SEED_QUERIES:
            try:
                count = self.sync_jobs(term, limit=25)
                total_seeded += count
            except Exception as e:
                logger.error(f"Failed to seed term '{term}': {e}")

        logger.info(f"Initial seed complete. Total listings in vector database: {self.collection.count()}")
        return self.collection.count()

    def search_jobs(self, query_text: str, n_results: int = 10) -> List[Dict[str, Any]]:
        """Perform semantic search on the vector database."""
        collection_size = self.collection.count()
        if collection_size == 0:
            logger.warning("Database is empty. Triggering emergency seed...")
            self.seed_if_empty()
            collection_size = self.collection.count()
            if collection_size == 0:
                return []

        clean_query = query_text.strip()
        if not clean_query:
            return []

        limit = min(max(1, n_results), collection_size)
        result = self.collection.query(
            query_texts=[clean_query],
            n_results=limit,
            include=["documents", "metadatas", "distances"],
        )

        matches = []
        if result and result.get("documents") and len(result["documents"]) > 0:
            docs = result["documents"][0]
            metas = result["metadatas"][0]
            distances = result["distances"][0]

            for doc, meta, dist in zip(docs, metas, distances):
                similarity_score = max(0.0, min(100.0, round((1.0 - dist) * 100, 1)))
                matches.append({
                    "similarity_distance": round(dist, 4),
                    "similarity_score": similarity_score,
                    "metadata": meta,
                    "document": doc,
                })

        return matches
