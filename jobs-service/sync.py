"""CLI: refresh the vector database with the latest JobTech listings.

Usage (from jobs-service/):
    python sync.py                          # sync the default seed queries
    python sync.py servitör "data engineer" # sync specific query terms
    python sync.py --limit 100              # override listings fetched per query

Run it only while the API is stopped (or use POST /jobs/sync instead): a running API keeps its
own in-memory vector index and will not see listings written by another process until restarted.
"""

import argparse
import sys

from config import settings
from job_store import JobStore, logger


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("queries", nargs="*", help="query terms (default: all seed queries)")
    parser.add_argument("--limit", type=int, default=settings.seed_limit_per_query, help="listings per query")
    args = parser.parse_args()

    queries = args.queries or list(settings.seed_queries)
    store = JobStore(settings)

    before = store.count()
    processed = store.sync_many(queries, args.limit)
    after = store.count()

    logger.info(
        "Sync finished: %d listings processed across %d queries. Index size %d -> %d.",
        processed,
        len(queries),
        before,
        after,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
