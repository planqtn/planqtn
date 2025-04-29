from server.task_store import TaskStore
from server.tasks import REDIS_URL
from server.web_endpoints import app
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import argparse


# Configure CORS
def configure_cors(ui_port: int = 5173, ui_host: str = "localhost"):
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            f"http://{ui_host}:{ui_port}",
            f"https://{ui_host}:{ui_port}",
        ],
        allow_credentials=True,
        allow_methods=["*"],  # Allows all methods
        allow_headers=["*"],  # Allows all headers
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the TNQEC server")
    parser.add_argument(
        "--port",
        type=int,
        default=5005,
        help="Port to run the server on (default: 5005)",
    )
    parser.add_argument(
        "--ui-port",
        type=int,
        default=5173,
        help="Port the UI is running on (default: 5173)",
    )
    parser.add_argument(
        "--ui-host",
        type=str,
        default="localhost",
        help="Host the UI is running on (default: localhost)",
    )
    args = parser.parse_args()

    configure_cors(args.ui_port, args.ui_host)

    import uvicorn

    TaskStore(REDIS_URL).clear_all()

    uvicorn.run(app, host="localhost", port=args.port)
