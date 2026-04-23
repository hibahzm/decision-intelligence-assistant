"""
FastAPI entrypoint.
All services are loaded once at startup and stored in app.state
so they are reused across requests (no re-loading models per request).
"""

import asyncio
from contextlib import asynccontextmanager
from app.routers import generation, prediction
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.services.embedder    import get_embedder
from app.services.vector_store import get_vector_store
from app.services.llm_client  import get_llm_client
from app.services.ml_model    import get_ml_model
from app.routers              import generation


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup: load everything once ────────────────────────────────────
    print("Starting up — loading models and connecting to services...")

    # These are singletons — each call returns the same instance after first load
    app.state.embedder     = get_embedder()     # sentence-transformers model
    app.state.vector_store = get_vector_store() # Pinecone connection
    app.state.llm_client   = get_llm_client()   # OpenAI client
    app.state.ml_model     = get_ml_model()     # trained sklearn pipeline

    print("All services ready. API is live.")
    yield

    # ── Shutdown ──────────────────────────────────────────────────────────
    print("Shutting down.")


app = FastAPI(
    title="Decision Intelligence Assistant",
    description="RAG + ML + LLM comparison for customer support tickets",
    version="0.1.0",
    lifespan=lifespan,
)

# Allow the React frontend to call the API
# In production, replace "*" with your actual frontend domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers — each handles a separate concern
app.include_router(generation.router,        prefix="/api", tags=["RAG"])
app.include_router(generation.router, prefix="/api", tags=["Generation"])
app.include_router(prediction.router, prefix="/api", tags=["Prediction"])


@app.get("/health")
async def health():
    """Health check — used by Docker and load balancers."""
    return {"status": "ok"}


# Main query endpoint — calls all 4 systems and returns combined response
from fastapi import Request
from app.schemas.models import QueryRequest, QueryResponse, RagAnswer, NonRagAnswer, MlPrediction, LlmPrediction, RetrievedSource
from app.utils.logger import log_query
from app.services.vector_store import SIMILARITY_WARNING_THRESHOLD

@app.post("/api/query", response_model=QueryResponse)
async def query(request: Request, body: QueryRequest):
    """
    The main endpoint. Given a support query:
    1. Embeds the query
    2. Retrieves similar past tickets from Pinecone
    3. Generates RAG answer (LLM + context)
    4. Generates non-RAG answer (LLM alone)
    5. Predicts priority with ML model
    6. Predicts priority with LLM zero-shot
    All 4 happen in parallel using asyncio.gather.
    """
    query_text     = body.query
    embedder       = request.app.state.embedder
    vector_store   = request.app.state.vector_store
    llm            = request.app.state.llm_client
    ml             = request.app.state.ml_model

    # Step 1: Embed query (needed for retrieval)
    query_vector = await asyncio.get_event_loop().run_in_executor(
        None, embedder.embed, query_text
    )

    # Step 2: Retrieve similar tickets
    sources = await asyncio.get_event_loop().run_in_executor(
        None, vector_store.search, query_vector, 5
    )

    top_similarity = sources[0]["similarity_score"] if sources else 0.0
    low_similarity_warning = top_similarity < SIMILARITY_WARNING_THRESHOLD

    # Step 3-6: Run all LLM + ML calls in parallel
    (
        (rag_text, rag_lat, rag_cost),
        (non_rag_text, non_rag_lat, non_rag_cost),
        ml_result,
        (llm_label, llm_conf, llm_lat, llm_cost),
    ) = await asyncio.gather(
        asyncio.get_event_loop().run_in_executor(None, llm.generate_with_rag, query_text, sources),
        asyncio.get_event_loop().run_in_executor(None, llm.generate_without_rag, query_text),
        asyncio.get_event_loop().run_in_executor(None, ml.predict, query_text),
        asyncio.get_event_loop().run_in_executor(None, llm.predict_priority, query_text),
    )

    # Build response
    response = QueryResponse(
        query=query_text,
        rag_answer=RagAnswer(
            text=rag_text,
            sources=[RetrievedSource(**s) for s in sources],
            latency_ms=rag_lat,
            top_similarity=top_similarity,
            low_similarity_warning=low_similarity_warning,
        ),
        non_rag_answer=NonRagAnswer(
            text=non_rag_text,
            latency_ms=non_rag_lat,
            cost_usd=non_rag_cost,
        ),
        ml_prediction=MlPrediction(**ml_result),
        llm_prediction=LlmPrediction(
            label=llm_label,
            confidence=llm_conf,
            latency_ms=llm_lat,
            cost_usd=llm_cost,
        ),
    )

    # Log everything
    log_query(
        query=query_text,
        rag_answer={"text": rag_text[:200], "top_similarity": top_similarity,
                    "latency_ms": rag_lat, "sources_count": len(sources)},
        non_rag_answer={"text": non_rag_text[:200], "latency_ms": non_rag_lat, "cost_usd": non_rag_cost},
        ml_prediction=ml_result,
        llm_prediction={"label": llm_label, "confidence": llm_conf,
                        "latency_ms": llm_lat, "cost_usd": llm_cost},
    )

    return response
