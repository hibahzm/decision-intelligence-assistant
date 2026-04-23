"""
ML model service — downloads the trained Pipeline from Hugging Face if needed,
loads model.pkl, and exposes a single predict(text) method.
"""

import pickle
import time
import requests
from pathlib import Path
import pandas as pd

from app.utils.features import engineer_features, FEATURE_COLS


# ─────────────────────────────────────────────────────────────
# Paths & Hugging Face config
# ─────────────────────────────────────────────────────────────

MODEL_PATH = Path(__file__).parent.parent.parent / "ml" / "model.pkl"

MODEL_URL = "https://huggingface.co/Hibhzm/decision-intel-model/resolve/main/model.pkl"


# ─────────────────────────────────────────────────────────────
# Download helper
# ─────────────────────────────────────────────────────────────

def download_model_if_needed():
    """
    Downloads model from Hugging Face if not present locally.
    Runs only once on cold start.
    """
    if MODEL_PATH.exists():
        return

    print("[ml_model] Model not found locally. Downloading from Hugging Face...")

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)

    try:
        response = requests.get(MODEL_URL, timeout=300)
        response.raise_for_status()

        with open(MODEL_PATH, "wb") as f:
            f.write(response.content)

        print("[ml_model] Model downloaded successfully.")

    except Exception as e:
        raise RuntimeError(f"Failed to download model from Hugging Face: {e}")


# ─────────────────────────────────────────────────────────────
# ML Model class
# ─────────────────────────────────────────────────────────────

class MLModel:
    def __init__(self):
        download_model_if_needed()

        with open(MODEL_PATH, "rb") as f:
            saved = pickle.load(f)

        self._pipeline = saved["pipeline"]
        self._model_name = saved.get("model_name", "Unknown")

        # Use consistent feature engineering
        self._feature_cols = FEATURE_COLS

        self._test_f1 = saved.get("test_f1", None)
        self._test_auc = saved.get("test_auc", None)

        print(f"[ml_model] Loaded: {self._model_name}")
        print(f"[ml_model] Expected features: {self._feature_cols}")

        if self._test_f1 is not None:
            print(f"[ml_model] Test F1: {self._test_f1:.4f} | AUC: {self._test_auc:.4f}")

    def predict(self, text: str) -> dict:
        """
        Extract features and predict priority.
        Returns label + confidence + latency.
        """
        start = time.perf_counter()

        # Feature engineering
        features = engineer_features(text)

        # Build model input
        X = pd.DataFrame(
            [[features[col] for col in self._feature_cols]],
            columns=self._feature_cols
        )

        # Prediction
        label_int = int(self._pipeline.predict(X)[0])
        proba = self._pipeline.predict_proba(X)[0]

        latency_ms = (time.perf_counter() - start) * 1000

        return {
            "label": "urgent" if label_int == 1 else "normal",
            "confidence": round(float(proba.max()), 4),
            "p_urgent": round(float(proba[1]), 4),
            "latency_ms": round(latency_ms, 2),
            "cost_usd": 0.0,
        }

    # ── Metadata helpers ─────────────────────────────────────

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def test_f1(self) -> float | None:
        return self._test_f1


# ─────────────────────────────────────────────────────────────
# Singleton (FastAPI safe)
# ─────────────────────────────────────────────────────────────

_model: MLModel | None = None


def get_ml_model() -> MLModel:
    global _model
    if _model is None:
        _model = MLModel()
    return _model