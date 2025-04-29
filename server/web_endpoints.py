import time
import traceback
from celery import Celery
from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
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
import asyncio
from contextlib import asynccontextmanager
import requests

from qlego.progress_reporter import DummyProgressReporter, TqdmProgressReporter
from server.api_types import *
from server.task_store import TaskStore
from server.tasks import weight_enumerator_task, celery_app
from server.websocket import websocket_manager


task_store: TaskStore = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global task_store
    task_store = TaskStore()
    asyncio.create_task(websocket_manager.start_celery_event_monitor())
    yield


app = FastAPI(
    title="TNQEC API",
    description="API for the TNQEC application",
    version="0.1.0",
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Set up the Celery app in the WebSocket manager
websocket_manager.set_celery_app(celery_app)


@app.websocket("/ws/tasks")
async def websocket_endpoint(websocket: WebSocket):
    await websocket_manager.connect(websocket, "tasks")
    try:
        while True:
            # Keep the connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        await websocket_manager.disconnect(websocket, "tasks")


@app.websocket("/ws/task/{task_id}")
async def websocket_endpoint(websocket: WebSocket, task_id: str):
    await websocket_manager.connect(websocket, "task_" + task_id)
    try:
        while True:
            # Keep the connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        await websocket_manager.disconnect(websocket, "task_" + task_id)


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


@app.post("/weightenumerator", response_model=TaskStatusResponse)
async def calculate_weight_enumerator(network: TensorNetworkRequest):
    try:
        # Convert Pydantic model to dictionary
        network_dict = network.model_dump()
        # Start the task
        print("kicking off task...")
        task = weight_enumerator_task.apply_async(
            args=[network_dict],
        )
        print("task", task.id)

        return TaskStatusResponse(task_id=task.id, status="started", result=None)
    except Exception as e:
        print("error", e)
        traceback.print_exc()
        return TaskStatusResponse(task_id="", status="error", error=str(e))


@app.get(
    "/list_tasks",
    response_model=List[Dict[str, Any]],
)
async def list_tasks():
    try:

        task_dict = task_store.get_all_tasks()
        all_tasks = []
        for task_id, task_info in task_dict.items():
            # Handle different task states
            state = task_info.get("status", "PENDING")
            status = (
                "active" if state in ["STARTED", "SUCCESS", "FAILURE"] else "reserved"
            )

            # Get worker info safely
            worker = task_info.get("worker")
            if isinstance(worker, dict):
                worker_hostname = worker.get("hostname")
            else:
                worker_hostname = worker  # In case it's just a string

            task = {
                "id": task_id,
                "name": task_info.get("name", ""),
                "state": state,
                "start_time": task_info.get("started"),
                "worker": worker_hostname,
                "args": task_info.get("args", []),
                "kwargs": task_info.get("kwargs", {}),
                "info": task_info.get("info", {}),
                "status": status,
            }
            all_tasks.append(task)

        return all_tasks
    except Exception as e:
        print("error", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
