import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional, Union

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from database_building import JobVectorDatabase

logger = logging.getLogger("JobsAPI")

# Global singleton database instance
db_instance: Optional[JobVectorDatabase] = None

def _seed_worker():
    """Background worker to seed jobs without blocking server startup."""
    try:
        if db_instance:
            db_instance.seed_if_empty()
    except Exception as e:
        logger.error(f"Error in background initial seed: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_instance
    logger.info("Initializing vector database in lifespan...")
    db_instance = JobVectorDatabase()

    # Trigger background seed if collection is completely fresh
    if db_instance.collection.count() == 0:
        asyncio.create_task(asyncio.to_thread(_seed_worker))

    yield
    db_instance = None
    logger.info("Vector database disconnected.")

app = FastAPI(
    title="ArbetaFlow Jobs Vector Service",
    description="Semantic job search, CV matching, and Arbetsförmedlingen synchronization.",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Request / Response Models ---
class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000, description="Job title, skills, or search terms.")
    limit: int = Field(10, ge=1, le=50)

class RecommendRequest(BaseModel):
    cv: Union[str, Dict[str, Any]] = Field(..., description="CV text or structured JSON profile.")
    limit: int = Field(10, ge=1, le=50)

class SyncRequest(BaseModel):
    queries: Optional[List[str]] = Field(None, description="Keywords to fetch from JobTech dev API.")
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

# --- Helper Functions ---
def _flatten_cv_to_text(value: Any) -> str:
    """Recursively convert structured CV JSON or string into clean embedding text."""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, dict):
        return "\n".join(
            f"{key}: {_flatten_cv_to_text(v)}"
            for key, v in value.items()
            if _flatten_cv_to_text(v)
        )
    if isinstance(value, list):
        return "\n".join(text for item in value if (text := _flatten_cv_to_text(item)))
    return str(value) if value is not None else ""

# --- Endpoints ---
@app.get("/health")
def health() -> Dict[str, Any]:
    if not db_instance:
        return {"status": "starting", "database": "initializing"}
    return {
        "status": "ok",
        "database": "connected",
        "total_jobs_indexed": db_instance.collection.count(),
        "model": db_instance.model_name,
    }

@app.post("/jobs/search", response_model=SearchResponse)
async def search(request: SearchRequest) -> Any:
    """Perform semantic search against indexed Swedish job listings."""
    if not db_instance:
        raise HTTPException(status_code=503, detail="Database is not ready yet.")

    try:
        matches = await asyncio.to_thread(
            db_instance.search_jobs, request.query, request.limit
        )
        return {"query": request.query, "count": len(matches), "jobs": matches}
    except Exception as error:
        logger.error(f"Search failed: {error}")
        raise HTTPException(status_code=500, detail="Job search query failed.") from error

@app.post("/jobs/recommend", response_model=SearchResponse)
async def recommend(request: RecommendRequest) -> Any:
    """Recommend jobs that best match a user's resume or qualifications."""
    if not db_instance:
        raise HTTPException(status_code=503, detail="Database is not ready yet.")

    qualifications_text = _flatten_cv_to_text(request.cv)
    if not qualifications_text:
        raise HTTPException(status_code=422, detail="CV content cannot be empty.")

    try:
        trimmed_cv = qualifications_text[:3000]
        matches = await asyncio.to_thread(
            db_instance.search_jobs, trimmed_cv, request.limit
        )
        return {"query": "CV Semantic Match", "count": len(matches), "jobs": matches}
    except Exception as error:
        logger.error(f"Recommendation failed: {error}")
        raise HTTPException(status_code=500, detail="Recommendation engine failed.") from error

@app.post("/jobs/sync")
async def trigger_sync(request: SyncRequest, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    """Trigger background syncing of job listings for given keywords."""
    if not db_instance:
        raise HTTPException(status_code=503, detail="Database is not ready yet.")

    queries = request.queries or ["utvecklare", "frontend", "backend", "fullstack", "data engineer"]

    def _sync_task():
        for q in queries:
            try:
                db_instance.sync_jobs(q, limit=request.limit)
            except Exception as e:
                logger.error(f"Error syncing query '{q}': {e}")

    background_tasks.add_task(_sync_task)
    return {
        "status": "sync_started",
        "queries": queries,
        "message": f"Sync queued for {len(queries)} search terms.",
    }