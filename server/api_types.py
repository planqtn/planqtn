from pydantic import BaseModel
from typing import List, Dict, Any, Tuple
import sys
import os

# Add the parent directory to the Python path to import qlego
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from qlego.linalg import gauss
from qlego.codes.stabilizer_tanner_code import StabilizerTannerCodeTN
from qlego.legos import Legos
from qlego.tensor_network import (
    TensorNetwork,
    StabilizerCodeTensorEnumerator,
)
from qlego.codes.css_tanner_code import CssTannerCodeTN
from qlego.codes.stabilizer_measurement_state_prep import (
    StabilizerMeasurementStatePrepTN,
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


class PentaflakeRequest(BaseModel):
    level: int = 0
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
