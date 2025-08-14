# Multi-stage build for optimized image size
# Build stage
FROM python:3.12-slim AS builder

WORKDIR /app

# Install uv for faster dependency management
RUN pip install --upgrade pip uv

# Copy dependency files
COPY pyproject.toml /app/pyproject.toml
COPY app/planqtn_api/requirements.txt /app/planqtn_api/requirements.txt

# Install dependencies to a virtual environment
RUN uv pip install -r pyproject.toml -r /app/planqtn_api/requirements.txt --system

# Copy source code
COPY ./planqtn /app/planqtn
COPY ./app/planqtn_api /app/planqtn_api
COPY ./app/planqtn_types /app/planqtn_types

# Runtime stage using distroless Python
FROM gcr.io/distroless/python3-debian12:4eacfbbbf378a5416d7fd2bdab169737dbec4ee1e5f90c72fab5ce6907362fed

# Copy Python from builder stage
COPY --from=builder /usr/local/bin/python /usr/local/bin/python
COPY --from=builder /usr/local/lib/python3.12 /usr/local/lib/python3.12
COPY --from=builder /usr/local/lib/libpython3.12.so* /usr/local/lib/
COPY --from=builder /usr/lib/x86_64-linux-gnu/libpython3.12.so* /usr/lib/x86_64-linux-gnu/

# Copy installed packages and site-packages
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages

# Copy application code
COPY --from=builder /app/planqtn /app/planqtn
COPY --from=builder /app/planqtn_api /app/planqtn_api
COPY --from=builder /app/planqtn_types /app/planqtn_types

# Set working directory and environment
WORKDIR /app
ENV PYTHONPATH=/app
ENV TERM=xterm

# Use distroless entrypoint
ENTRYPOINT ["/usr/local/bin/python", "/app/planqtn_api/planqtn_server.py"]