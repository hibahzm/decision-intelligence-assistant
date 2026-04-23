"""
Logger — appends one JSON line per query to logs/queries.jsonl.
Each line contains everything needed to debug and evaluate later.
"""

import json
import time
from pathlib import Path
from datetime import datetime, timezone

LOG_FILE = Path(__file__).parent.parent.parent / "logs" / "queries.jsonl"
LOG_FILE.parent.mkdir(parents=True, exist_ok=True)


def log_query(
    query: str,
    rag_answer: dict,
    non_rag_answer: dict,
    ml_prediction: dict,
    llm_prediction: dict,
    error: str | None = None,
) -> None:
    """Append one query record to the log file."""
    record = {
        "timestamp":      datetime.now(timezone.utc).isoformat(),
        "query":          query,
        "rag_answer":     rag_answer,
        "non_rag_answer": non_rag_answer,
        "ml_prediction":  ml_prediction,
        "llm_prediction": llm_prediction,
        "error":          error,
    }
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
    except Exception as e:
        # Never let logging crash the API
        print(f"[logger] Failed to write log: {e}")
