# Multi-stage build for optimized image size
# Build stage
FROM cgr.dev/chainguard/python:latest-dev as builder
ENV LANG=C.UTF-8
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PATH="/app/venv/bin:$PATH"

WORKDIR /app

RUN mkdir -p /app
RUN python -m venv /app/venv

RUN pip install --upgrade pip uv

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Use the virtual environment automatically
ENV VIRTUAL_ENV=/app/venv
# Place entry points in the environment at the front of the path

# Copy dependency files
COPY pyproject.toml /app/pyproject.toml
COPY app/planqtn_api/requirements.txt /app/planqtn_api/requirements.txt

# Install dependencies to a virtual environment
RUN uv pip install -r pyproject.toml -r /app/planqtn_api/requirements.txt 


# Copy source code
COPY ./planqtn /app/planqtn
COPY ./app/planqtn_api /app/planqtn_api
COPY ./app/planqtn_types /app/planqtn_types

# Runtime stage using distroless Python
FROM cgr.dev/chainguard/python:latest

COPY --from=builder /app/venv /app/venv

# Copy application code
COPY --from=builder /app/planqtn /app/planqtn
COPY --from=builder /app/planqtn_api /app/planqtn_api
COPY --from=builder /app/planqtn_types /app/planqtn_types

# Set working directory and environment
WORKDIR /app
ENV PYTHONPATH=/app
ENV TERM=xterm
ENV PYTHONUNBUFFERED=1
ENV PATH="/app/venv/bin:$PATH"


# Use distroless entrypoint
ENTRYPOINT ["python", "/app/planqtn_api/planqtn_server.py"]