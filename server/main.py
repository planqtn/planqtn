from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from galois import GF2
from pydantic import BaseModel
from typing import List, Dict, Any, Tuple
import sys
import os
import numpy as np

# Add the parent directory to the Python path to import qlego
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from qlego.legos import Legos
from qlego.tensor_stabilizer_enumerator import (
    TensorNetwork,
    TensorStabilizerCodeEnumerator,
)

app = FastAPI(
    title="TNQEC API", description="API for the TNQEC application", version="0.1.0"
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
    logical_legs: List[int] = []
    gauge_legs: List[int] = []


class TensorNetworkParityCheckRequest(BaseModel):
    legos: Dict[str, LegoPiece]
    connections: List[Dict[str, Any]]


class TensorNetworkLeg(BaseModel):
    instanceId: str
    legIndex: int


class ParityCheckResponse(BaseModel):
    matrix: List[List[int]]
    legs: List[TensorNetworkLeg]
    message: str = "Successfully calculated parity check matrix"


class WeightEnumeratorResponse(BaseModel):
    polynomial: str
    message: str = "Successfully calculated weight enumerator polynomial"


class ConstructionCodeResponse(BaseModel):
    code: str
    message: str = "Successfully generated construction code"


class DynamicLegoRequest(BaseModel):
    lego_id: str
    parameters: Dict[str, Any]


@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(message="Server is running", status="healthy")


@app.get("/legos", response_model=List[LegoPiece])
async def list_legos():
    return Legos.list_available_legos()


@app.post("/paritycheck", response_model=ParityCheckResponse)
async def calculate_parity_check_matrix(network: TensorNetworkParityCheckRequest):
    # Create TensorStabilizerCodeEnumerator instances for each lego
    nodes = {}
    for instance_id, lego in network.legos.items():
        # Convert the parity check matrix to numpy array
        h = GF2(lego.parity_check_matrix)
        nodes[instance_id] = TensorStabilizerCodeEnumerator(h=h, idx=instance_id)

    # Create TensorNetwork instance
    tn = TensorNetwork(nodes)

    # Add traces for each connection
    for conn in network.connections:
        print(conn)
        tn.self_trace(
            conn["from"]["legoId"],
            conn["to"]["legoId"],
            [conn["from"]["legIndex"]],
            [conn["to"]["legIndex"]],
        )

    print(tn.construction_code())

    # Conjoin all nodes to get the final parity check matrix
    result = tn.conjoin_nodes(verbose=True)

    # Convert the resulting parity check matrix to a list for JSON serialization
    matrix = result.h.tolist()
    legs = [TensorNetworkLeg(instanceId=leg[0], legIndex=leg[1]) for leg in result.legs]

    return ParityCheckResponse(matrix=matrix, legs=legs)


@app.post("/weightenumerator", response_model=WeightEnumeratorResponse)
async def calculate_weight_enumerator(network: TensorNetworkParityCheckRequest):
    # Create TensorStabilizerCodeEnumerator instances for each lego
    nodes = {}
    print("network.legos", network.legos)
    print("network.connections", network.connections)
    for instance_id, lego in network.legos.items():
        print("instance id", instance_id)
        # Convert the parity check matrix to numpy array
        h = GF2(lego.parity_check_matrix)
        nodes[instance_id] = TensorStabilizerCodeEnumerator(h=h, idx=instance_id)

    # Create TensorNetwork instance
    tn = TensorNetwork(nodes)

    # Add traces for each connection
    for conn in network.connections:

        tn.self_trace(
            conn["from"]["legoId"],
            conn["to"]["legoId"],
            [conn["from"]["legIndex"]],
            [conn["to"]["legIndex"]],
        )

    # Conjoin all nodes to get the final tensor network
    polynomial = tn.stabilizer_enumerator_polynomial(
        verbose=True, progress_bar=True, cotengra=len(nodes) > 4
    )

    # Convert the polynomial to a string representation
    polynomial_str = str(polynomial)

    return WeightEnumeratorResponse(polynomial=polynomial_str)


@app.post("/constructioncode", response_model=ConstructionCodeResponse)
async def generate_construction_code(network: TensorNetworkParityCheckRequest):
    # Create TensorStabilizerCodeEnumerator instances for each lego
    nodes = {}
    for instance_id, lego in network.legos.items():
        # Convert the parity check matrix to numpy array
        h = GF2(lego.parity_check_matrix)
        nodes[instance_id] = TensorStabilizerCodeEnumerator(h=h, idx=instance_id)

    # Create TensorNetwork instance
    tn = TensorNetwork(nodes)

    # Add traces for each connection
    for conn in network.connections:
        tn.self_trace(
            conn["from"]["legoId"],
            conn["to"]["legoId"],
            [conn["from"]["legIndex"]],
            [conn["to"]["legIndex"]],
        )

    # Get the construction code
    code = tn.construction_code()

    return ConstructionCodeResponse(code=code)


@app.post("/dynamiclego", response_model=LegoPiece)
async def get_dynamic_lego(request: DynamicLegoRequest):
    # Get the lego definition from Legos class
    legos = Legos.list_available_legos()
    lego_def = next((l for l in legos if l["id"] == request.lego_id), None)

    if not lego_def or not lego_def.get("is_dynamic"):
        raise HTTPException(status_code=400, detail="Invalid or non-dynamic lego ID")

    # Get the method from Legos class
    method = getattr(Legos, request.lego_id)
    if not method:
        raise HTTPException(status_code=400, detail="Lego method not found")

    # Call the method with the provided parameters
    try:
        matrix = method(**request.parameters)
        # Update the lego definition with the new matrix
        lego_def["parity_check_matrix"] = matrix.tolist()
        return lego_def
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=5000)
