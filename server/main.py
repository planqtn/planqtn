from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
import sys
import os

# Add the parent directory to the Python path to import qlego
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from qlego.legos import Legos

app = FastAPI(
    title="TNQEC API",
    description="API for the TNQEC application",
    version="0.1.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite's default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class HealthResponse(BaseModel):
    message: str
    status: str = "healthy"

class LegoPiece(BaseModel):
    id: str
    name: str
    shortName: str
    type: str
    description: str
    is_dynamic: bool = False
    parameters: Dict[str, Any] = {}
    parity_check_matrix: List[List[int]]

@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        message="Server is running",
        status="healthy"
    )

@app.get("/legos", response_model=List[LegoPiece])
async def list_legos():
    return Legos.list_available_legos()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000) 