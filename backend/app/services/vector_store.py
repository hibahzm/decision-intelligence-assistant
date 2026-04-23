import os
from qdrant_client import QdrantClient
from dotenv import load_dotenv

load_dotenv()

COLLECTION_NAME = "support_tickets"
SIMILARITY_WARNING_THRESHOLD = 0.50



class VectorStore:
    def __init__(self):
        timeout = int(os.environ.get("QDRANT_TIMEOUT", "60"))
        mode = os.environ.get("QDRANT_MODE", "cloud")  # default to cloud for deployment

        if mode == "cloud":
            url = os.environ.get("QDRANT_CLOUD_URL")
            api_key = os.environ.get("QDRANT_API_KEY")
            if not url or not api_key:
                raise RuntimeError(
                    "QDRANT_MODE=cloud requires QDRANT_CLOUD_URL and QDRANT_API_KEY"
                )
            print(f"[vectorstore] Connecting to Qdrant Cloud at {url}")
            self._client = QdrantClient(url=url, api_key=api_key, timeout=timeout)
        else:
            # Local mode: either file path or host/port
            path = os.environ.get("QDRANT_PATH")
            if path:
                print(f"[vectorstore] Using local file mode at {path}")
                self._client = QdrantClient(path=path, timeout=timeout)
            else:
                host = os.environ.get("QDRANT_HOST", "localhost")
                port = int(os.environ.get("QDRANT_PORT", "6333"))
                print(f"[vectorstore] Connecting to Qdrant server at {host}:{port}")
                self._client = QdrantClient(host=host, port=port, timeout=timeout)

        # Verify the collection exists
        collections = [c.name for c in self._client.get_collections().collections]
        if COLLECTION_NAME not in collections:
            raise RuntimeError(
                f"Collection '{COLLECTION_NAME}' not found in Qdrant. "
                "Run the migration script first."
            )

        info = self._client.get_collection(COLLECTION_NAME)
        print(f"[vectorstore] Connected. Vectors: {info.points_count:,}")

    def search(self, query_vector: list[float], top_k: int = 5) -> list[dict]:
        response = self._client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            limit=top_k,
            with_payload=True,
        )
        hits = []
        for r in response.points:
            payload = r.payload or {}
            hits.append({
                "customer_text":   payload.get("customer_text", ""),
                "company_reply":   payload.get("company_reply"),
                "priority_label":  payload.get("priority_label", "unknown"),
                "similarity_score": round(float(r.score), 4),
            })
        return hits


_store = None


def get_vector_store() -> VectorStore:
    global _store
    if _store is None:
        _store = VectorStore()
    return _store