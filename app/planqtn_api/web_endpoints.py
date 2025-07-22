import os
import traceback
from fastapi import APIRouter, HTTPException
from galois import GF2
import numpy as np

from planqtn_types.api_types import *
from planqtn.networks.css_tanner_code import CssTannerCodeTN
from planqtn.networks.stabilizer_measurement_state_prep import (
    StabilizerMeasurementStatePrepTN,
)
from planqtn.networks.stabilizer_tanner_code import StabilizerTannerCodeTN

router = APIRouter()


@router.post("/tannernetwork", response_model=TensorNetworkResponse)
async def create_tanner_network(request: TannerRequest):
    try:
        matrix = GF2(request.matrix)
        tn = StabilizerTannerCodeTN(matrix)
        return TensorNetworkResponse.from_tensor_network(tn, request.start_node_index)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/csstannernetwork", response_model=TensorNetworkResponse)
async def create_css_tanner_network(request: TannerRequest):
    try:
        matrix = np.array(request.matrix)

        # Sort rows and separate into hx and hz
        sorted_rows = np.lexsort([matrix[:, i] for i in range(matrix.shape[1])])
        sorted_matrix = matrix[sorted_rows]
        # Find the split point between X and Z stabilizers
        n = matrix.shape[1] // 2
        split_point = 0
        for i in range(sorted_matrix.shape[0]):
            if np.any(sorted_matrix[i, n:]):  # If any Z part is non-zero
                split_point = i
                break

        hz = sorted_matrix[split_point:, n:]  # Z stabilizer part
        hx = sorted_matrix[:split_point, :n]  # X  stabilizer part

        # Create the tensor network
        tn = CssTannerCodeTN(hx=hx, hz=hz)

        return TensorNetworkResponse.from_tensor_network(tn, request.start_node_index)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/mspnetwork", response_model=TensorNetworkResponse)
def create_msp_network(request: TannerRequest):
    try:
        matrix = GF2(request.matrix)
        tn = StabilizerMeasurementStatePrepTN(matrix)
        return TensorNetworkResponse.from_tensor_network(tn, request.start_node_index)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/version")
async def get_version():
    return {
        "api_image": os.getenv("API_IMAGE"),
    }
