import asyncio
import logging
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

class QueryBody(BaseModel):
    query: str
    top_k: int = 5

# ------------------------------------------------------------
# /retrieve
# ------------------------------------------------------------
@router.post("/retrieve")
async def retrieve(request: Request, body: QueryBody):
    try:
        embedder = request.app.state.embedder
        vector_store = request.app.state.vector_store
    except AttributeError as e:
        logger.error(f"Missing dependency: {e}")
        raise HTTPException(500, "Server misconfiguration: missing embedder or vector_store")

    try:
        loop = asyncio.get_event_loop()
        qv = await loop.run_in_executor(None, embedder.embed, body.query)
        sources = await loop.run_in_executor(None, vector_store.search, qv, body.top_k)
    except Exception as e:
        logger.exception(f"Retrieval failed for query '{body.query}': {e}")
        raise HTTPException(500, "Retrieval failed")

    if not sources:
        sources = []
        top_sim = 0.0
    else:
        top_sim = sources[0].get("similarity_score", 0.0) if isinstance(sources[0], dict) else 0.0

    return {"query": body.query, "sources": sources, "top_similarity": top_sim}


# ------------------------------------------------------------
# /rag-answer
# ------------------------------------------------------------
@router.post("/rag-answer")
async def rag_answer(request: Request, body: QueryBody):
    try:
        embedder = request.app.state.embedder
        vector_store = request.app.state.vector_store
        llm = request.app.state.llm_client
    except AttributeError as e:
        logger.error(f"Missing dependency: {e}")
        raise HTTPException(500, "Server misconfiguration")

    try:
        loop = asyncio.get_event_loop()
        qv = await loop.run_in_executor(None, embedder.embed, body.query)
        sources = await loop.run_in_executor(None, vector_store.search, qv, body.top_k)
        sources = sources or []
        text, lat, cost = await loop.run_in_executor(
            None, llm.generate_with_rag, body.query, sources
        )
    except Exception as e:
        logger.exception(f"RAG answer failed for '{body.query}': {e}")
        raise HTTPException(500, "RAG generation failed")

    top_sim = sources[0].get("similarity_score", 0.0) if sources else 0.0
    return {
        "query": body.query,
        "text": text,
        "sources": sources,
        "latency_ms": lat,
        "cost_usd": cost,
        "top_similarity": top_sim,
        "low_similarity_warning": top_sim < 0.5,
    }


# ------------------------------------------------------------
# /non-rag-answer
# ------------------------------------------------------------
@router.post("/non-rag-answer")
async def non_rag_answer(request: Request, body: QueryBody):
    try:
        llm = request.app.state.llm_client
    except AttributeError as e:
        logger.error(f"Missing LLM client: {e}")
        raise HTTPException(500, "Server misconfiguration")

    try:
        loop = asyncio.get_event_loop()
        text, lat, cost = await loop.run_in_executor(None, llm.generate_without_rag, body.query)
    except Exception as e:
        logger.exception(f"Non‑RAG answer failed for '{body.query}': {e}")
        raise HTTPException(500, "Non‑RAG generation failed")

    return {"query": body.query, "text": text, "latency_ms": lat, "cost_usd": cost}