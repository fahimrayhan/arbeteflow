import asyncio
import logging
from contextlib import asynccontextmanager
from functools import partial
from typing import Annotated, Any, Dict, List, Optional, Union

from fastapi import BackgroundTasks, FastAPI, HTTPException
from pydantic import BaseModel, Field

from config import DEFAULT_SEED_QUERIES, settings
from job_store import JobStore

logger = logging.getLogger("JobsAPI")

# Process-wide store; populated during startup. Run with a single worker:
# several processes must not share one Chroma persistent directory.
store: Optional[JobStore] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global store
    logger.info("Initializing vector store...")
    # Loading the model and opening Chroma is blocking work — keep it off the event loop.
    store = await asyncio.to_thread(JobStore, settings)
    store.start_background_seed()
    yield
    store = None
    logger.info("Vector store closed.")


# This service is only called server-to-server by the Node API, so no CORS middleware is installed.
app = FastAPI(
    title="ArbetaFlow Jobs Vector Service",
    description="Semantic job search, CV matching, and Arbetsförmedlingen synchronization.",
    version="3.0.0",
    lifespan=lifespan,
)


# --- Request / Response Models ---
QueryTerm = Annotated[str, Field(min_length=1, max_length=100)]


class Filters(BaseModel):
    location: Optional[str] = Field(None, max_length=100, description="Only ads whose location contains this text.")
    max_age_days: Optional[int] = Field(None, ge=1, le=365, description="Only ads published within this many days.")


class SearchRequest(Filters):
    query: str = Field(..., min_length=1, max_length=1000, description="Job title, skills, or search terms.")
    limit: int = Field(10, ge=1, le=50)


class RecommendRequest(Filters):
    cv: Union[str, Dict[str, Any]] = Field(..., description="CV text or structured JSON profile.")
    limit: int = Field(10, ge=1, le=50)


class SyncRequest(BaseModel):
    queries: Optional[List[QueryTerm]] = Field(
        None, max_length=20, description="Keywords to fetch from JobTech dev API."
    )
    limit: int = Field(30, ge=5, le=100)


class JobMatch(BaseModel):
    similarity_distance: float
    similarity_score: float
    metadata: Dict[str, Any]
    document: str


class SearchResponse(BaseModel):
    query: str
    count: int
    jobs: List[JobMatch]


# --- Helpers ---
def _flatten_cv_to_text(value: Any) -> str:
    """Recursively convert structured CV JSON or string into clean embedding text."""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, dict):
        return "\n".join(
            f"{key}: {text}" for key, item in value.items() if (text := _flatten_cv_to_text(item))
        )
    if isinstance(value, list):
        return "\n".join(text for item in value if (text := _flatten_cv_to_text(item)))
    return str(value) if value is not None else ""


def _ready_store() -> JobStore:
    """Return the store, or raise 503 while it is starting or the index is still empty."""
    if store is None:
        raise HTTPException(status_code=503, detail="The job search service is starting up.")
    if store.count() == 0:
        store.start_background_seed()
        raise HTTPException(
            status_code=503,
            detail="The job index is still being built. Please try again in a minute.",
        )
    return store


async def _search(
    query_text: str, request: Union[SearchRequest, RecommendRequest], label: str, long_text: bool = False
) -> Dict[str, Any]:
    ready = _ready_store()
    try:
        matches = await asyncio.to_thread(
            partial(
                ready.search_jobs,
                query_text,
                request.limit,
                location=request.location,
                max_age_days=request.max_age_days,
                long_text=long_text,
            )
        )
    except Exception as error:
        logger.exception("Search failed")
        raise HTTPException(status_code=500, detail="Job search query failed.") from error
    return {"query": label, "count": len(matches), "jobs": matches}


# --- Endpoints ---
@app.get("/health")
def health() -> Dict[str, Any]:
    if store is None:
        return {"status": "starting", "database": "initializing"}
    return {
        "status": "ok",
        "database": "connected",
        "total_jobs_indexed": store.count(),
        "seeding": store.is_seeding,
        "model": store.model_name,
    }


@app.post("/jobs/search", response_model=SearchResponse)
async def search(request: SearchRequest) -> Any:
    """Perform semantic search against indexed Swedish job listings."""
    return await _search(request.query, request, request.query)


@app.post("/jobs/recommend", response_model=SearchResponse)
async def recommend(request: RecommendRequest) -> Any:
    """Recommend jobs that best match a user's resume or qualifications."""
    qualifications_text = _flatten_cv_to_text(request.cv)
    if not qualifications_text:
        raise HTTPException(status_code=422, detail="CV content cannot be empty.")
    return await _search(qualifications_text, request, "CV Semantic Match", long_text=True)


@app.post("/jobs/sync")
async def trigger_sync(request: SyncRequest, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    """Trigger background syncing of job listings for given keywords."""
    if store is None:
        raise HTTPException(status_code=503, detail="The job search service is starting up.")

    queries = request.queries or DEFAULT_SEED_QUERIES[:5]
    background_tasks.add_task(store.sync_many, queries, request.limit)
    return {
        "status": "sync_started",
        "queries": queries,
        "message": f"Sync queued for {len(queries)} search terms.",
    }
