# PlanqTN API

FastAPI service for PlanqTN Studio. It handles relatively fast, non-JS logic
such as returning tensor networks and LEGOs.

## Setup

From the repository root:

```bash
uv venv
uv sync --group api
source .venv/bin/activate
```

## Running the server

From `app/`:

```bash
python planqtn_api/planqtn_server.py --reload
```

The server listens on `http://localhost:5005` by default (`PORT` or `--port`
overrides this).

## API documentation

Once the server is running:

- Interactive API docs (Swagger UI): `http://localhost:5005/docs`
- Alternative API docs (ReDoc): `http://localhost:5005/redoc`

## Checks

From the repository root:

```
check/api
```
