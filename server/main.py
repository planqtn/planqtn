from server.web_endpoints import app
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import argparse


# Configure CORS
def configure_cors(ui_port: int = 5173):
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            f"http://localhost:{ui_port}",
            f"http://localhost:{ui_port + 1000}",  # Vite dev server sometimes uses port + 1000
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
    args = parser.parse_args()

    configure_cors(args.ui_port)

    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=args.port)
