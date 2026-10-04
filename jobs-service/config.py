"""Service configuration, read once from environment variables."""

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import List

from dotenv import load_dotenv

load_dotenv()


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


DEFAULT_SEED_QUERIES = [
    "utvecklare",
    "frontend",
    "backend",
    "fullstack",
    "data engineer",
    "devops",
    "systemutvecklare",
    "projektledare it",
]


@dataclass(frozen=True)
class Settings:
    chroma_path: Path = Path(os.getenv("CHROMA_PATH", "./chroma_jobs"))
    # Bumped from "swedish_job_listings": the old collection persisted a PyTorch
    # embedding-function config that this (torch-free) image cannot load.
    collection_name: str = os.getenv("CHROMA_COLLECTION", "swedish_job_listings_v2")

    # Display name; the files themselves come from download_model.py.
    embedding_model: str = "paraphrase-multilingual-MiniLM-L12-v2 (int8 ONNX)"
    model_dir: str = os.getenv("MODEL_DIR", "./models/minilm")
    embedding_threads: int = _int_env("EMBEDDING_THREADS", 2)
    embedding_batch_size: int = _int_env("EMBEDDING_BATCH_SIZE", 16)

    jobtech_api_url: str = os.getenv("JOBTECH_API_URL", "https://jobsearch.api.jobtechdev.se/search")
    jobtech_timeout_seconds: int = _int_env("JOBTECH_TIMEOUT_SECONDS", 12)

    seed_queries: List[str] = field(default_factory=lambda: list(DEFAULT_SEED_QUERIES))
    seed_limit_per_query: int = _int_env("SEED_LIMIT_PER_QUERY", 25)

    # Ads older than this are removed after each sync to keep the index small and fresh.
    job_ttl_days: int = _int_env("JOB_TTL_DAYS", 30)

    max_query_chars: int = 1000
    # Long-text queries (CVs) are split into overlapping word windows (~130 tokens each).
    max_long_text_chars: int = 8000
    chunk_words: int = 90
    chunk_step: int = 70
    min_chunk_words: int = 12
    max_chunks: int = 8


settings = Settings()
