import logging
import os
import pathlib
import sys
from dotenv import load_dotenv
from planqtn_api.web_endpoints import router
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import argparse


app = FastAPI(
    title="PlanqTN API",
    description="API for the PlanqTN application",
    version="0.1.0",
)

# Add CORS middleware
allowed_origins_env = os.getenv("PLANQTN_API_ALLOWED_ORIGINS", "*")
allow_credentials = os.getenv("PLANQTN_API_ALLOW_CREDENTIALS", "false").lower() == "true"

if allowed_origins_env == "*" and allow_credentials:
    # If credentials are enabled, '*' is invalid and insecure; force no credentials
    allow_credentials = False

allow_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Include the API router
app.include_router(router)


if __name__ == "__main__":

    basedir = pathlib.Path(__file__).parents[0]
    load_dotenv(basedir / ".env", verbose=True)

    parser = argparse.ArgumentParser(description="Run the TNQEC planqtn_api")
    parser.add_argument(
        "--port",
        type=int,
        default=os.getenv("PORT", 5005),
        help="Port to run the planqtn_api on (default: 5005 if $PORT is not set)",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Run the planqtn_api in debug mode",
    )
    parser.add_argument(
        "--reload",
        action="store_true",
        help="Run the planqtn_api in reload mode",
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

    print(f"Running planqtn_api with frontend host port {args.port}")

    if args.reload:
        app.reload = True
    uvicorn.run(app, host="0.0.0.0", port=args.port)
