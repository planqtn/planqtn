# Multi-stage build for optimized image size
# Build stage
FROM python:3.12-slim AS builder

RUN python3 -m venv /opt/venv
   

WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Use the virtual environment automatically
ENV VIRTUAL_ENV=/opt/venv
# Place entry points in the environment at the front of the path
ENV PATH="/opt/venv/bin:$PATH"

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
FROM python:3.12-slim 

COPY --from=builder /opt/venv /opt/venv

# Copy application code
COPY --from=builder /app/planqtn /app/planqtn
COPY --from=builder /app/planqtn_api /app/planqtn_api
COPY --from=builder /app/planqtn_types /app/planqtn_types

# Set working directory and environment
WORKDIR /app
ENV PYTHONPATH=/app
ENV TERM=xterm


# Use distroless entrypoint
ENTRYPOINT ["/opt/venv/bin/python3", "/app/planqtn_api/planqtn_server.py"]