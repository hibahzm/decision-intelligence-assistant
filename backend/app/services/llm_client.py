"""
LLM client — wraps OpenAI API.
Measures latency and calculates cost per call.
Every other service calls this; nothing else imports openai directly.
"""

import os
import time
import json
from openai import OpenAI

# gpt-4o-mini pricing (as of mid-2024, USD per 1M tokens)
# Update these if you switch models
_COST_PER_1M_INPUT  = 0.150
_COST_PER_1M_OUTPUT = 0.600

_MODEL = "gpt-4o-mini"

from dotenv import load_dotenv
load_dotenv()

class LLMClient:
    def __init__(self):
        self._client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
        print(f"[llm] OpenAI client ready. Model: {_MODEL}")

    def _call(self, messages: list[dict], max_tokens: int = 512) -> tuple[str, float, float]:
        """
        Make an API call.
        Returns (text, latency_ms, cost_usd).
        """
        start = time.perf_counter()
        response = self._client.chat.completions.create(
            model=_MODEL,
            messages=messages,
            max_tokens=max_tokens,
            temperature=0.3,
        )
        latency_ms = (time.perf_counter() - start) * 1000

        text = response.choices[0].message.content or ""

        # Calculate cost
        usage = response.usage
        cost_usd = (
            usage.prompt_tokens     / 1_000_000 * _COST_PER_1M_INPUT +
            usage.completion_tokens / 1_000_000 * _COST_PER_1M_OUTPUT
        )

        return text, round(latency_ms, 1), round(cost_usd, 6)

        # ---------------------- RAG answer (concise) ----------------------
    def generate_with_rag(self, query: str, context_tickets: list[dict]) -> tuple[str, float, float]:
        """
        Generate a short, actionable answer using retrieved tickets as context.
        Refuses off-topic questions.
        """
        # Format retrieved tickets into readable context
        context_parts = []
        for i, ticket in enumerate(context_tickets, 1):
            part = f"[Case {i}]\nCustomer: {ticket['customer_text']}"
            if ticket.get("company_reply"):
                part += f"\nSupport resolved it with: {ticket['company_reply']}"
            context_parts.append(part)

        context_str = "\n\n".join(context_parts)

        messages = [
            {
                "role": "system",
                "content": (
                    "You are an expert customer support advisor helping a support agent. "
                    "You ONLY answer questions related to customer support, ticket handling, "
                    "customer complaints, and support procedures.\n\n"
                    "If the user asks about anything else (programming, general knowledge, "
                    "personal opinions, or unrelated topics), respond EXACTLY with:\n"
                    "\"I can only help with customer support questions. Please ask about "
                    "handling tickets, customer complaints, or support procedures.\"\n\n"
                    "Do not explain, apologize, or add extra text. Just that single sentence.\n\n"
                    "If the question IS about customer support:\n"
                    "- Keep your answer VERY SHORT (max 3-5 bullets or sentences).\n"
                    "- Use plain text only – no markdown, no bold.\n"
                    "- Use bullet points (starting with '- ') when listing steps.\n"
                    "- Be practical and actionable.\n"
                    "- Never include phrases like 'As an AI' or 'Here is a response'."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Support agent query: {query}\n\n"
                    f"Similar past cases for reference:\n{context_str}\n\n"
                    f"Give the agent a short, actionable answer."
                ),
            },
        ]
        return self._call(messages, max_tokens=150)  # lowered from 200

    def generate_without_rag(self, query: str) -> tuple[str, float, float]:
        """
        Generate a short, LLM-only answer with no retrieved context.
        Refuses off-topic questions.
        """
        messages = [
            {
                "role": "system",
                "content": (
                    "You are an expert customer support advisor helping a support agent. "
                    "You ONLY answer questions related to customer support, ticket handling, "
                    "customer complaints, and support procedures.\n\n"
                    "If the user asks about anything else (programming, general knowledge, "
                    "personal opinions, or unrelated topics), respond EXACTLY with:\n"
                    "\"I can only help with customer support questions. Please ask about "
                    "handling tickets, customer complaints, or support procedures.\"\n\n"
                    "Do not explain, apologize, or add extra text. Just that single sentence.\n\n"
                    "If the question IS about customer support:\n"
                    "- Keep your answer VERY SHORT (max 3-5 bullets or sentences).\n"
                    "- Use plain text only – no markdown, no bold.\n"
                    "- Use bullet points (starting with '- ') when listing steps.\n"
                    "- Be practical and actionable.\n"
                    "- Never include phrases like 'As an AI' or 'Here is a response'."
                ),
            },
            {
                "role": "user",
                "content": query,
            },
        ]
        return self._call(messages, max_tokens=150)

    # ---------------------- Priority (unchanged) ----------------------
    def predict_priority(self, query: str) -> tuple[str, float, float, float]:
        """
        Zero-shot priority classification.
        Returns (label, confidence, latency_ms, cost_usd).
        Label is 'urgent' or 'normal'.
        """
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a customer support triage system. "
                    "Classify support tickets as urgent or normal. "
                    "Respond ONLY with valid JSON, no extra text."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Classify this support ticket:\n\n\"{query}\"\n\n"
                    f'Respond with exactly: {{"label": "urgent" or "normal", "confidence": 0.0-1.0, "reason": "one short sentence"}}'
                ),
            },
        ]

        text, latency_ms, cost_usd = self._call(messages, max_tokens=100)

        # Parse JSON response
        try:
            clean = text.strip().replace("```json", "").replace("```", "").strip()
            parsed = json.loads(clean)
            label      = parsed.get("label", "normal").lower()
            confidence = float(parsed.get("confidence", 0.5))
            if label not in ("urgent", "normal"):
                label = "normal"
        except (json.JSONDecodeError, ValueError):
            label      = "urgent" if "urgent" in text.lower() else "normal"
            confidence = 0.5

        return label, confidence, latency_ms, cost_usd


# ── Singleton ──────────────────────────────────────────────────────────────

_client: LLMClient | None = None


def get_llm_client() -> LLMClient:
    global _client
    if _client is None:
        _client = LLMClient()
    return _client