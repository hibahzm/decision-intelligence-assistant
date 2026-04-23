import asyncio
import logging
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

class QueryBody(BaseModel):
    query: str

# ------------------------------------------------------------
# /predict/ml
# ------------------------------------------------------------
@router.post("/predict/ml")
async def predict_ml(request: Request, body: QueryBody):
    try:
        ml = request.app.state.ml_model
    except AttributeError as e:
        logger.error(f"Missing ML model: {e}")
        raise HTTPException(500, "ML model not available")

    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, ml.predict, body.query)
    except Exception as e:
        logger.exception(f"ML prediction failed for '{body.query}': {e}")
        raise HTTPException(500, "ML prediction failed")

    return {"query": body.query, **result}


# ------------------------------------------------------------
# /predict/llm
# ------------------------------------------------------------
@router.post("/predict/llm")
async def predict_llm(request: Request, body: QueryBody):
    try:
        llm = request.app.state.llm_client
    except AttributeError as e:
        logger.error(f"Missing LLM client: {e}")
        raise HTTPException(500, "LLM client not available")

    try:
        loop = asyncio.get_event_loop()
        label, conf, lat, cost = await loop.run_in_executor(None, llm.predict_priority, body.query)
    except Exception as e:
        logger.exception(f"LLM priority prediction failed for '{body.query}': {e}")
        raise HTTPException(500, "LLM prediction failed")

    return {
        "query": body.query,
        "label": label,
        "confidence": conf,
        "latency_ms": lat,
        "cost_usd": cost,
    }


# ------------------------------------------------------------
# /predict (both)
# ------------------------------------------------------------
@router.post("/predict")
async def predict_both(request: Request, body: QueryBody):
    try:
        ml = request.app.state.ml_model
        llm = request.app.state.llm_client
    except AttributeError as e:
        logger.error(f"Missing dependency: {e}")
        raise HTTPException(500, "Server misconfiguration")

    try:
        loop = asyncio.get_event_loop()
        ml_res, llm_res = await asyncio.gather(
            loop.run_in_executor(None, ml.predict, body.query),
            loop.run_in_executor(None, llm.predict_priority, body.query),
        )
        label, conf, lat, cost = llm_res
    except Exception as e:
        logger.exception(f"Both predictions failed for '{body.query}': {e}")
        raise HTTPException(500, "Prediction failed")

    return {
        "query": body.query,
        "ml_prediction": ml_res,
        "llm_prediction": {
            "label": label,
            "confidence": conf,
            "latency_ms": lat,
            "cost_usd": cost,
        },
    }