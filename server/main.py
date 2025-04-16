import traceback
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from galois import GF2
from pydantic import BaseModel
from typing import List, Dict, Any, Tuple
import sys
import os
import numpy as np
from sympy import symbols

# Add the parent directory to the Python path to import qlego
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from qlego.linalg import gauss
from qlego.codes.stabilizer_tanner_code import StabilizerTannerCodeTN
from qlego.legos import Legos
from qlego.tensor_stabilizer_enumerator import (
    TensorNetwork,
    TensorStabilizerCodeEnumerator,
)
from qlego.codes.css_tanner_code import CssTannerCodeTN
from qlego.codes.stabilizer_measurement_state_prep import (
    StabilizerMeasurementStatePrepTN,
)

app = FastAPI(
    title="TNQEC API", description="API for the TNQEC application", version="0.1.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://192.168.86.24:5173",
        "http://172.18.132.212:5173",
    ],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)


class HealthResponse(BaseModel):
    message: str
    status: str = "healthy"


class LegoPiece(BaseModel):
    id: str
    instanceId: str = ""
    name: str = ""
    shortName: str
    description: str = ""
    is_dynamic: bool = False
    parameters: Dict[str, Any] = {}
    parity_check_matrix: List[List[int]]
    logical_legs: List[int] = []
    gauge_legs: List[int] = []


class TensorNetworkRequest(BaseModel):
    legos: Dict[str, LegoPiece]
    connections: List[Dict[str, Any]]


class TensorNetworkLeg(BaseModel):
    instanceId: str
    legIndex: int


class ParityCheckResponse(BaseModel):
    matrix: List[List[int]]
    legs: List[TensorNetworkLeg]
    recognized_type: str | None = None
    message: str = "Successfully calculated parity check matrix"


class WeightEnumeratorResponse(BaseModel):
    polynomial: str
    normalizer_polynomial: str
    message: str = "Successfully calculated weight enumerator polynomial"


class ConstructionCodeResponse(BaseModel):
    code: str
    message: str = "Successfully generated construction code"


class DynamicLegoRequest(BaseModel):
    lego_id: str
    parameters: Dict[str, Any]


class TannerRequest(BaseModel):
    matrix: List[List[int]]
    start_node_index: int = 0


class TensorNetworkResponse(BaseModel):
    legos: List[Dict[str, Any]]
    connections: List[Dict[str, Any]]
    message: str = "Successfully created Tanner network"

    @classmethod
    def from_tensor_network(cls, tn: TensorNetwork, start_node_index: int = 0):
        # Convert to JSON-serializable format
        legos = []
        connections = []

        instance_id_to_idx = {}

        # Add legos and track their instance IDs
        for i, (instance_id, piece) in enumerate(tn.nodes.items()):
            if piece.annotation is not None:
                lego_type = piece.annotation.type
            elif instance_id.startswith("x"):
                lego_type = "x_rep_code"
            elif instance_id.startswith("z") or instance_id.startswith("check"):
                lego_type = "z_rep_code"
            else:
                lego_type = "generic"
            lego = {
                "instanceId": str(i + start_node_index),
                "id": lego_type,
                "shortName": instance_id,
                "description": instance_id,
                "x": (
                    piece.annotation.x
                    if piece.annotation is not None and piece.annotation.x is not None
                    else 0
                ),
                "y": (
                    piece.annotation.y
                    if piece.annotation is not None and piece.annotation.y is not None
                    else 0
                ),
                "parity_check_matrix": piece.h.tolist(),
                "logical_legs": [],
                "gauge_legs": [],
            }
            print("lego", lego["shortName"], "x", lego["x"], "y", lego["y"])
            legos.append(lego)
            instance_id_to_idx[instance_id] = i + start_node_index
        # Add connections from the tensor network's traces
        for node1, node2, legs1, legs2 in tn.traces:
            for leg1, leg2 in zip(legs1, legs2):
                connections.append(
                    {
                        "from": {
                            "legoId": str(instance_id_to_idx[node1]),
                            "legIndex": tn.nodes[node1].legs.index(leg1),
                        },
                        "to": {
                            "legoId": str(instance_id_to_idx[node2]),
                            "legIndex": tn.nodes[node2].legs.index(leg2),
                        },
                    }
                )

        return TensorNetworkResponse(legos=legos, connections=connections)


def is_gauss_equivalent(h1: GF2, h2: GF2) -> bool:
    """Check if two parity check matrices are Gauss equivalent."""
    if h1.shape != h2.shape:
        return False
    h1_gauss = gauss(h1)
    h2_gauss = gauss(h2)

    return np.array_equal(h1_gauss, h2_gauss)


def recognize_parity_check_matrix(h: GF2) -> str | None:
    """Recognize if a parity check matrix is equivalent to a known type."""
    # Get all available legos
    legos = Legos.list_available_legos()

    # First check static legos
    for lego in legos:
        if not lego.get("is_dynamic"):
            lego_matrix = GF2(lego["parity_check_matrix"])
            if is_gauss_equivalent(h, lego_matrix):
                return lego["id"]

    # Then check for repetition codes
    num_qubits = h.shape[1] // 2
    if num_qubits > 0:
        # Z repetition code
        z_rep = Legos.z_rep_code(num_qubits)
        if is_gauss_equivalent(h, z_rep):
            return "z_rep_code"

        # X repetition code
        x_rep = Legos.x_rep_code(num_qubits)
        if is_gauss_equivalent(h, x_rep):
            return "x_rep_code"

    return None


@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(message="Server is running", status="healthy")


@app.get("/legos", response_model=List[LegoPiece])
async def list_legos():
    return Legos.list_available_legos()


@app.post("/paritycheck", response_model=ParityCheckResponse)
async def calculate_parity_check_matrix(network: TensorNetworkRequest):
    # Create TensorStabilizerCodeEnumerator instances for each lego
    print("network", repr(network))
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

    # Conjoin all nodes to get the final parity check matrix
    result = tn.conjoin_nodes(verbose=True)

    # Convert the resulting parity check matrix to a list for JSON serialization
    matrix = result.h.tolist()
    legs = [TensorNetworkLeg(instanceId=leg[0], legIndex=leg[1]) for leg in result.legs]

    # Check if the matrix matches any known type
    recognized_type = recognize_parity_check_matrix(result.h)

    return ParityCheckResponse(
        matrix=matrix, legs=legs, recognized_type=recognized_type
    )


@app.post("/weightenumerator", response_model=WeightEnumeratorResponse)
async def calculate_weight_enumerator(network: TensorNetworkRequest):
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
        verbose=False, progress_bar=True, cotengra=len(nodes) > 4
    )

    h = tn.conjoin_nodes().h
    r = h.shape[0]
    n = h.shape[1] // 2
    k = n - r

    z, w = symbols("z w")
    poly_b = polynomial.macwilliams_dual(n=n, k=k, to_normalizer=True)

    print("polynomial", polynomial)
    print("poly_b", poly_b)

    # Convert the polynomial to a string representation
    polynomial_str = str(polynomial)
    normalizer_polynomial_str = str(poly_b)

    return WeightEnumeratorResponse(
        polynomial=polynomial_str, normalizer_polynomial=normalizer_polynomial_str
    )


@app.post("/constructioncode", response_model=ConstructionCodeResponse)
async def generate_construction_code(network: TensorNetworkRequest):
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
        print("Retrieved lego definition", lego_def, "for id", request.lego_id)
        raise HTTPException(
            status_code=400, detail=f"Invalid or non-dynamic lego ID: {request.lego_id}"
        )

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
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/tannernetwork", response_model=TensorNetworkResponse)
async def create_tanner_network(request: TannerRequest):
    try:
        matrix = GF2(request.matrix)
        tn = StabilizerTannerCodeTN(matrix)
        return TensorNetworkResponse.from_tensor_network(tn, request.start_node_index)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/csstannernetwork", response_model=TensorNetworkResponse)
async def create_css_tanner_network(request: TannerRequest):
    try:
        matrix = np.array(request.matrix)

        # Sort rows and separate into hx and hz
        sorted_rows = np.lexsort([matrix[:, i] for i in range(matrix.shape[1])])
        sorted_matrix = matrix[sorted_rows]
        print("sorted_matrix\n", sorted_matrix)
        # Find the split point between X and Z stabilizers
        n = matrix.shape[1] // 2
        split_point = 0
        for i in range(sorted_matrix.shape[0]):
            if np.any(sorted_matrix[i, n:]):  # If any Z part is non-zero
                split_point = i
                break

        print("split_point", split_point)

        hz = sorted_matrix[split_point:, n:]  # Z stabilizer part
        hx = sorted_matrix[:split_point, :n]  # X  stabilizer part

        print("hx\n", hx)
        print("hz\n", hz)

        # Create the tensor network
        tn = CssTannerCodeTN(hx=hx, hz=hz)

        return TensorNetworkResponse.from_tensor_network(tn, request.start_node_index)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/mspnetwork", response_model=TensorNetworkResponse)
def create_msp_network(request: TannerRequest):
    try:
        matrix = GF2(request.matrix)
        tn = StabilizerMeasurementStatePrepTN(matrix)
        return TensorNetworkResponse.from_tensor_network(tn, request.start_node_index)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=5000)
