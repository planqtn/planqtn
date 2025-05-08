# TNQEC Server

This is the backend server for the TNQEC application, built with FastAPI.

## Setup

1. Create a virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

## Running the Server

To run the server in development mode:
```bash
uvicorn main:app --reload --port 5000
```

Or simply run:
```bash
python planqtn_server.py
```

The server will start on `http://localhost:5000`

## API Documentation

Once the server is running, you can access:
- Interactive API docs (Swagger UI): `http://localhost:5000/docs`
- Alternative API docs (ReDoc): `http://localhost:5000/redoc`

## Available Endpoints

- `GET /health`: Health check endpoint that returns the server status 