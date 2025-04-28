import time
import traceback
from celery import Celery
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from galois import GF2
from pydantic import BaseModel
from typing import List, Dict, Any, Tuple
import sys
import os
import numpy as np
from sympy import symbols
import argparse
from celery.result import AsyncResult
from datetime import datetime


from qlego.progress_reporter import DummyProgressReporter, TqdmProgressReporter
from server.api_types import *
from server.tasks import long_running_task, weight_enumerator_task, celery_app

app = FastAPI(
    title="TNQEC API", description="API for the TNQEC application", version="0.1.0"
)


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
    # print("network", repr(network))
    nodes = {}
    for instance_id, lego in network.legos.items():
        # Convert the parity check matrix to numpy array
        h = GF2(lego.parity_check_matrix)
        nodes[instance_id] = StabilizerCodeTensorEnumerator(h=h, idx=instance_id)

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
    result = tn.conjoin_nodes(progress_reporter=TqdmProgressReporter(), verbose=False)

    # Convert the resulting parity check matrix to a list for JSON serialization
    matrix = result.h.tolist()
    legs = [TensorNetworkLeg(instanceId=leg[0], legIndex=leg[1]) for leg in result.legs]

    # Check if the matrix matches any known type
    recognized_type = recognize_parity_check_matrix(result.h)

    return ParityCheckResponse(
        matrix=matrix, legs=legs, recognized_type=recognized_type
    )


@app.post("/constructioncode", response_model=ConstructionCodeResponse)
async def generate_construction_code(network: TensorNetworkRequest):
    # Create TensorStabilizerCodeEnumerator instances for each lego
    nodes = {}
    for instance_id, lego in network.legos.items():
        # Convert the parity check matrix to numpy array
        h = GF2(lego.parity_check_matrix)
        nodes[instance_id] = StabilizerCodeTensorEnumerator(h=h, idx=instance_id)

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


class TaskRequest(BaseModel):
    user_id: int
    params: dict


class TaskStatusResponse(BaseModel):
    task_id: str
    status: str
    result: dict | None = None
    error: str | None = None


@app.post("/start_task", response_model=TaskStatusResponse)
async def start_task(request: TaskRequest):
    try:
        # Start the task
        print("kicking off task: ", request.user_id, request.params)
        task = long_running_task.apply_async(args=[request.user_id, request.params])
        print("task", task.id)

        return TaskStatusResponse(task_id=task.id, status="started", result=None)
    except Exception as e:
        print("error", e)
        traceback.print_exc()
        return TaskStatusResponse(task_id="", status="error", error=str(e))


@app.post("/weightenumerator", response_model=TaskStatusResponse)
async def calculate_weight_enumerator(network: TensorNetworkRequest):
    try:
        # Convert Pydantic model to dictionary
        network_dict = network.model_dump()
        # Start the task
        print("kicking off task...")
        task = weight_enumerator_task.apply_async(args=[network_dict])
        print("task", task.id)

        return TaskStatusResponse(task_id=task.id, status="started", result=None)
    except Exception as e:
        print("error", e)
        traceback.print_exc()
        return TaskStatusResponse(task_id="", status="error", error=str(e))


@app.get("/task_status/{task_id}", response_model=TaskStatusResponse)
async def task_status(task_id: str):
    try:
        task = weight_enumerator_task.AsyncResult(task_id)
        if task.state == "PENDING":
            return TaskStatusResponse(task_id=task_id, status="pending", result=None)
        elif task.state == "PROGRESS":
            return TaskStatusResponse(
                task_id=task_id, status="progress", result=task.info
            )
        elif task.state == "SUCCESS":
            return TaskStatusResponse(
                task_id=task_id, status="completed", result=task.result
            )
        elif task.state == "FAILURE":
            return TaskStatusResponse(
                task_id=task_id, status="failed", error=str(task.result)
            )
        else:
            return TaskStatusResponse(
                task_id=task_id, status=task.state, result=task.info
            )
    except Exception as e:
        print("error", e)
        traceback.print_exc()

        return TaskStatusResponse(task_id=task_id, status="error", error=str(e))


@app.get("/list_tasks", response_model=List[Dict[str, Any]])
async def list_tasks():
    try:
        # Get all tasks from Celery
        inspector = celery_app.control.inspect()
        active_tasks = inspector.active() or {}
        reserved_tasks = inspector.reserved() or {}
        scheduled_tasks = inspector.scheduled() or {}

        # Combine all tasks
        all_tasks = []

        # Process active tasks
        for worker, tasks in active_tasks.items():
            for task in tasks:
                task_result = AsyncResult(task["id"], app=celery_app)
                all_tasks.append(
                    {
                        "id": task["id"],
                        "name": task["name"],
                        "state": task_result.state,
                        "start_time": (
                            datetime.fromtimestamp(task["time_start"]).isoformat()
                            if "time_start" in task
                            else None
                        ),
                        "worker": worker,
                        "args": task.get("args", []),
                        "kwargs": task.get("kwargs", {}),
                        "info": task_result.info if task_result.info else {},
                        "status": "active",
                    }
                )

        # Process reserved tasks
        for worker, tasks in reserved_tasks.items():
            for task in tasks:
                task_result = AsyncResult(task["id"], app=celery_app)
                all_tasks.append(
                    {
                        "id": task["id"],
                        "name": task["name"],
                        "state": task_result.state,
                        "start_time": None,  # Not started yet
                        "worker": worker,
                        "args": task.get("args", []),
                        "kwargs": task.get("kwargs", {}),
                        "info": task_result.info if task_result.info else {},
                        "status": "reserved",
                    }
                )

        # Process scheduled tasks
        for worker, tasks in scheduled_tasks.items():
            for task in tasks:
                task_result = AsyncResult(task["request"]["id"], app=celery_app)
                all_tasks.append(
                    {
                        "id": task["request"]["id"],
                        "name": task["request"]["name"],
                        "state": task_result.state,
                        "start_time": (
                            datetime.fromtimestamp(task["eta"]).isoformat()
                            if "eta" in task
                            else None
                        ),
                        "worker": worker,
                        "args": task["request"].get("args", []),
                        "kwargs": task["request"].get("kwargs", {}),
                        "info": task_result.info if task_result.info else {},
                        "status": "scheduled",
                    }
                )

        # Sort tasks by start time (None values last)
        all_tasks.sort(
            key=lambda x: (x["start_time"] is None, x["start_time"]), reverse=True
        )

        return all_tasks
    except Exception as e:
        print("error", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
