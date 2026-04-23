# syntax=docker/dockerfile:1.7
FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.5.11 /uv /uvx /bin/

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

# Increase uv's HTTP timeout to avoid network timeouts
ENV UV_HTTP_TIMEOUT=300

COPY pyproject.toml uv.lock ./
# Try to install with frozen lockfile; if that fails, fall back to resolving (network issues)
RUN --mount=type=cache,target=/root/.cache/uv \
    (uv sync --no-dev --no-install-project --frozen || uv sync --no-dev --no-install-project)

COPY app ./app
COPY ml ./ml
RUN mkdir -p /app/logs

ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]