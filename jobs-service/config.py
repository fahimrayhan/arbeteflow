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


SEED_QUERIES_BY_SECTOR = {
    "it_tech": [
        "utvecklare",
        "frontend",
        "backend",
        "fullstack",
        "systemutvecklare",
        "mjukvaruutvecklare",
        "data engineer",
        "data scientist",
        "devops",
        "cloud engineer",
        "it-tekniker",
        "it-support",
        "nätverkstekniker",
        "systemadministratör",
        "it-säkerhet",
        "testare",
        "ux designer",
        "projektledare it",
        "scrum master",
        "it-arkitekt",
        "ml engineer"
    ],
    "healthcare": [
        "sjuksköterska",
        "specialistsjuksköterska",
        "undersköterska",
        "läkare",
        "specialistläkare",
        "tandläkare",
        "tandsköterska",
        "fysioterapeut",
        "arbetsterapeut",
        "psykolog",
        "barnmorska",
        "apotekare",
        "receptarie",
        "biomedicinsk analytiker",
        "dietist",
    ],
    "care_social": [
        "vårdbiträde",
        "personlig assistent",
        "stödassistent",
        "boendestödjare",
        "skötare",
        "socialsekreterare",
        "kurator",
        "biståndshandläggare",
        "behandlingsassistent",
        "hemtjänst",
    ],
    "education": [
        "förskollärare",
        "barnskötare",
        "grundskollärare",
        "gymnasielärare",
        "speciallärare",
        "specialpedagog",
        "fritidspedagog",
        "elevassistent",
        "studie- och yrkesvägledare",
        "rektor",
        "lärare sfi",
    ],
    "engineering": [
        "ingenjör",
        "civilingenjör",
        "konstruktör",
        "elkonstruktör",
        "mekanikkonstruktör",
        "processingenjör",
        "kvalitetsingenjör",
        "produktionstekniker",
        "automationsingenjör",
        "projektingenjör",
        "miljöingenjör",
        "inköpare",
    ],
    "construction": [
        "snickare",
        "elektriker",
        "rörmokare",
        "vvs-montör",
        "betongarbetare",
        "målare",
        "plattsättare",
        "byggarbetare",
        "anläggningsarbetare",
        "maskinförare",
        "platschef",
        "arbetsledare bygg",
        "byggprojektledare",
        "arkitekt",
        "fastighetsskötare",
    ],
    "manufacturing": [
        "operatör",
        "maskinoperatör",
        "montör",
        "svetsare",
        "cnc-operatör",
        "industrimekaniker",
        "underhållstekniker",
        "processoperatör",
        "produktionsledare",
        "livsmedelsarbetare",
    ],
    "logistics_transport": [
        "lagerarbetare",
        "truckförare",
        "lastbilschaufför",
        "buschaufför",
        "taxiförare",
        "budbilsförare",
        "logistiker",
        "transportledare",
        "speditör",
        "lokförare",
    ],
    "retail_sales": [
        "butikssäljare",
        "säljare",
        "butikschef",
        "kassapersonal",
        "account manager",
        "key account manager",
        "innesäljare",
        "kundtjänst",
        "kundservice",
        "e-handel",
    ],
    "hospitality": [
        "kock",
        "kökschef",
        "restaurangbiträde",
        "servitör",
        "bartender",
        "diskare",
        "barista",
        "receptionist",
        "hotell",
        "städare",
        "lokalvårdare",
    ],
    "finance_admin": [
        "ekonom",
        "redovisningsekonom",
        "controller",
        "revisor",
        "lönekonsult",
        "ekonomiassistent",
        "finansanalytiker",
        "bankrådgivare",
        "administratör",
        "assistent",
        "handläggare",
        "registrator",
        "jurist",
        "advokat",
    ],
    "hr_management": [
        "hr-specialist",
        "hr-partner",
        "rekryterare",
        "verksamhetschef",
        "enhetschef",
        "avdelningschef",
        "projektledare",
        "affärsutvecklare",
        "konsult",
        "utredare",
    ],
    "marketing_media": [
        "marknadsförare",
        "marknadskoordinator",
        "kommunikatör",
        "digital marknadsföring",
        "copywriter",
        "grafisk formgivare",
        "journalist",
        "fotograf",
        "content creator",
    ],
    "security_public": [
        "väktare",
        "ordningsvakt",
        "polis",
        "brandman",
        "kriminalvårdare",
        "tulltjänsteman",
        "räddningstjänst",
    ],
    "agriculture_environment": [
        "lantbruksarbetare",
        "djurskötare",
        "trädgårdsarbetare",
        "skogsarbetare",
        "veterinär",
        "djursjukskötare",
        "miljöinspektör",
    ],
    "beauty_service": [
        "frisör",
        "hudterapeut",
        "nagelterapeut",
        "massör",
        "personlig tränare",
        "fordonsmekaniker",
        "bilmekaniker",
    ],
}

# Flat, de-duplicated list across all sectors (order preserved).
DEFAULT_SEED_QUERIES = list(dict.fromkeys(
    q for queries in SEED_QUERIES_BY_SECTOR.values() for q in queries
))


@dataclass(frozen=True)
class Settings:
    chroma_path: Path = Path(os.getenv("CHROMA_PATH", "./chroma_jobs"))
    # One collection per embedding model: vectors from different models are not comparable.
    # v2 = paraphrase-multilingual-MiniLM; v3 = multilingual-e5-small with title-led documents.
    collection_name: str = os.getenv("CHROMA_COLLECTION", "swedish_job_listings_v3")

    # Display name; the files themselves come from download_model.py.
    embedding_model: str = "multilingual-e5-small (int8 ONNX)"
    model_dir: str = os.getenv("MODEL_DIR", "./models/e5-small")
    embedding_threads: int = _int_env("EMBEDDING_THREADS", 2)
    embedding_batch_size: int = _int_env("EMBEDDING_BATCH_SIZE", 16)
    # Tokens read per text. E5 handles 512; 256 covers the title + start of the ad at a fraction of the cost.
    embedding_max_tokens: int = _int_env("EMBEDDING_MAX_TOKENS", 256)

    jobtech_api_url: str = os.getenv("JOBTECH_API_URL", "https://jobsearch.api.jobtechdev.se/search")
    jobtech_timeout_seconds: int = _int_env("JOBTECH_TIMEOUT_SECONDS", 12)


    seed_queries: List[str] = field(default_factory=lambda: list(DEFAULT_SEED_QUERIES))
    seed_limit_per_query: int = _int_env("SEED_LIMIT_PER_QUERY", 25)

    # Ads older than this are removed after each sync to keep the index small and fresh.
    job_ttl_days: int = _int_env("JOB_TTL_DAYS", 30)

    max_query_chars: int = 1000
    # Long-text queries (CVs) are split into overlapping word windows (~200 tokens each).
    max_long_text_chars: int = 8000
    chunk_words: int = 140
    chunk_step: int = 100
    min_chunk_words: int = 12
    max_chunks: int = 8


settings = Settings()
