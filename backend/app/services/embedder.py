"""
Embedder — wraps SentenceTransformer.
Loaded once at startup and reused for every request.
"""

import numpy as np
from sentence_transformers import SentenceTransformer
import torch


class Embedder:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"[embedder] Loading model '{model_name}' on {device}")
        self._model = SentenceTransformer(model_name, device=device)
        self.dim = self._model.get_sentence_embedding_dimension()
        print(f"[embedder] Ready. Embedding dimension: {self.dim}")

    def embed(self, text: str) -> list[float]:
        """Embed a single text string. Returns a normalized list of floats."""
        vec = self._model.encode(
            text,
            convert_to_numpy=True,
            normalize_embeddings=True,   # L2 normalize → cosine = dot product
        )
        return vec.tolist()

    def embed_batch(self, texts: list[str]) -> np.ndarray:
        """Embed multiple texts. Returns (N, dim) numpy array."""
        return self._model.encode(
            texts,
            convert_to_numpy=True,
            normalize_embeddings=True,
            batch_size=64,
            show_progress_bar=False,
        )


# Singleton — created once in main.py and injected via app.state
_embedder: Embedder | None = None


def get_embedder() -> Embedder:
    global _embedder
    if _embedder is None:
        _embedder = Embedder()
    return _embedder
