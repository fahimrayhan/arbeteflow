"""Client and normalisation for the Arbetsförmedlingen JobTech JobSearch API."""

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import requests

logger = logging.getLogger("JobTech")

MAX_DOCUMENT_DESCRIPTION_CHARS = 2000
MAX_SNIPPET_CHARS = 300


@dataclass(frozen=True)
class JobRecord:
    id: str
    document: str
    metadata: Dict[str, Any]


def _parse_timestamp(value: Optional[str], fallback: datetime) -> datetime:
    """Parse an ISO timestamp from JobTech (e.g. '2024-05-02T10:21:14'); UTC when no zone is given."""
    if not value:
        return fallback
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return fallback
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _safe_url(value: Optional[str], fallback: str) -> str:
    """Only http(s) links are passed on to the browser."""
    if value and urlparse(value).scheme in ("http", "https"):
        return value
    return fallback


class JobTechClient:
    def __init__(self, api_url: str, timeout_seconds: int):
        self._api_url = api_url
        self._timeout = timeout_seconds
        self._session = requests.Session()
        self._session.headers.update({"accept": "application/json"})

    def fetch(self, query: str, limit: int) -> List[Dict[str, Any]]:
        try:
            response = self._session.get(
                self._api_url,
                params={"q": query, "limit": min(max(limit, 1), 100)},
                timeout=self._timeout,
            )
            response.raise_for_status()
            hits = response.json().get("hits", [])
            logger.info("Fetched %d raw listings from JobTech for '%s'", len(hits), query)
            return hits
        except (requests.RequestException, ValueError) as error:
            logger.error("Error fetching jobs from JobTech for '%s': %s", query, error)
            return []


def normalize_job(job: Dict[str, Any], query_term: str) -> Optional[JobRecord]:
    """Convert a raw JobTech ad into a Chroma record. Returns None for unusable ads."""
    raw_id = str(job.get("id") or "").strip()
    headline = (job.get("headline") or "").strip()
    if not raw_id or not headline:
        return None

    employer = job.get("employer") or {}
    company = (employer.get("name") or "Unknown Employer").strip()

    address = job.get("workplace_address") or {}
    location = (
        address.get("municipality") or address.get("city") or address.get("region") or "Sverige"
    ).strip()

    description_obj = job.get("description") or {}
    description = (description_obj.get("text") or description_obj.get("text_formatted") or "").strip()

    url = _safe_url(
        job.get("webpage_url"),
        f"https://arbetsformedlingen.se/platsbanken/annonser/{raw_id}",
    )

    document = "\n".join(
        [
            f"Title: {headline}",
            f"Company: {company}",
            f"Location: {location}",
            f"Description: {description[:MAX_DOCUMENT_DESCRIPTION_CHARS]}",
        ]
    )

    now = datetime.now(timezone.utc)
    published = _parse_timestamp(job.get("publication_date"), now)
    record_id = f"af_{raw_id}"

    metadata = {
        "id": record_id,
        "title": headline,
        "company": company,
        "location": location,
        "url": url,
        "source": "arbetsformedlingen",
        "query": query_term,
        "description_snippet": description[:MAX_SNIPPET_CHARS]
        + ("..." if len(description) > MAX_SNIPPET_CHARS else ""),
        "fetched_at": now.isoformat(),
        # Numeric copies for range filters (Chroma `where` only compares numbers).
        "fetched_at_ts": int(now.timestamp()),
        "published_at": published.isoformat(),
        "published_ts": int(published.timestamp()),
    }

    return JobRecord(id=record_id, document=document, metadata=metadata)
