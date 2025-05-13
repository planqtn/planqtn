import logging
import os
import pathlib
import sys
from dotenv import load_dotenv

# Do not move this - it is needed to load the environment variables
# before importing any other modules

basedir = pathlib.Path(__file__).parents[0]
load_dotenv(basedir / ".env", verbose=True)


from server.task_store import RedisTaskStore, SupabaseTaskStore
from server.web_endpoints import router
from server.tasks import celery_app
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from server.socketio_manager import socketio_manager
from contextlib import asynccontextmanager
import argparse
import asyncio
from server.config import get_settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Set up the Celery app in the Socket.IO manager
    socketio_manager.set_celery_app(celery_app)
    # Start the Celery event monitor
    asyncio.create_task(socketio_manager.start_celery_event_monitor())
    yield


app = FastAPI(
    title="PlanqTN API",
    description="API for the PlanqTN application",
    version="0.1.0",
    lifespan=lifespan,
)
settings = get_settings()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the Socket.IO app
app.mount("/socket.io", socketio_manager.get_app())

# Include the API router
app.include_router(router)


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
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Run the server in debug mode",
    )

    args = parser.parse_args()

    if args.debug:
        root = logging.getLogger()
        root.setLevel(logging.DEBUG)  # Set the minimum logging level

        # Create a StreamHandler to output to stdout
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(logging.DEBUG)

        # Create a formatter to customize the log message format
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )
        handler.setFormatter(formatter)

        # Add the handler to the root logger
        root.addHandler(handler)

    import uvicorn

    print(
        f"Running server with frontend host {args.ui_host} and port {args.ui_port}, backend port {args.port}"
    )

    if settings.storage_type == "redis":
        RedisTaskStore(settings.redis_url).clear_all_task_details()

    uvicorn.run(app, host="0.0.0.0", port=args.port)
