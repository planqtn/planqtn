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
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# from server.socketio_manager import socketio_manager
from contextlib import asynccontextmanager
import argparse
import asyncio
from server.config import get_settings


app = FastAPI(
    title="PlanqTN API",
    description="API for the PlanqTN application",
    version="0.1.0",
)
settings = get_settings()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the Socket.IO app
# app.mount("/socket.io", socketio_manager.get_app())

# Include the API router
app.include_router(router)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the TNQEC server")
    parser.add_argument(
        "--port",
        type=int,
        default=settings.port,
        help="Port to run the server on (default: 5005)",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Run the server in debug mode",
    )
    parser.add_argument(
        "--reload",
        action="store_true",
        help="Run the server in reload mode",
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

    print(f"Running server with frontend host port {args.port}")

    if args.reload:
        app.reload = True
    uvicorn.run(app, host="0.0.0.0", port=args.port)
