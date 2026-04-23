from pydantic import BaseModel, Field, field_validator
from typing import Literal, Optional

# ── Request ───────────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    query: str

    model_config = {"json_schema_extra": {"example": {"query": "my package never arrived and no one is responding"}}}


# ── Sub-models for each of the 4 outputs ─────────────────────────────────

class RetrievedSource(BaseModel):
    customer_text: str
    company_reply: Optional[str] = None
    priority_label: str   
    similarity_score: float = Field(ge=0.0, le=1.0)

    # Optional: Add validator for priority_label if needed
    @field_validator("priority_label")
    @classmethod
    def validate_priority(cls, v: str) -> str:
        allowed = {"urgent", "normal"}
        if v not in allowed:
            raise ValueError(f"priority_label must be one of {allowed}")
        return v


class RagAnswer(BaseModel):
    text: str
    sources: list[RetrievedSource]
    latency_ms: float = Field(ge=0.0)
    top_similarity: float = Field(ge=0.0, le=1.0)
    low_similarity_warning: bool   # True if best match < 0.50


class NonRagAnswer(BaseModel):
    text: str
    latency_ms: float = Field(ge=0.0)
    cost_usd: float = Field(ge=0.0)


class MlPrediction(BaseModel):
    label: Literal["urgent", "normal"]   # strict string union
    confidence: float = Field(ge=0.0, le=1.0)
    p_urgent: float = Field(ge=0.0, le=1.0)
    latency_ms: float = Field(ge=0.0)
    cost_usd: float = Field(ge=0.0, default=0.0)   # always 0

    # Explicit validator to ensure label is exactly "urgent" or "normal"
    @field_validator("label", mode="after")
    @classmethod
    def check_label(cls, v: str) -> str:
        # This is redundant with Literal but shows how to add custom messages
        if v not in ("urgent", "normal"):
            raise ValueError("label must be either 'urgent' or 'normal'")
        return v


class LlmPrediction(BaseModel):
    label: Literal["urgent", "normal"]
    confidence: float = Field(ge=0.0, le=1.0)
    latency_ms: float = Field(ge=0.0)
    cost_usd: float = Field(ge=0.0)

    @field_validator("label", mode="after")
    @classmethod
    def check_label(cls, v: str) -> str:
        if v not in ("urgent", "normal"):
            raise ValueError("label must be either 'urgent' or 'normal'")
        return v


# ── Full response ─────────────────────────────────────────────────────────

class QueryResponse(BaseModel):
    query: str
    rag_answer: RagAnswer
    non_rag_answer: NonRagAnswer
    ml_prediction: MlPrediction
    llm_prediction: LlmPrediction

    model_config = {"extra": "forbid"}   # reject any unexpected fields