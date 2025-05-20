import sys
import pytest
import pytest_asyncio
import asyncio
import json
from galois import GF2
from qlego.legos import Legos
from qlego.stabilizer_tensor_enumerator import StabilizerCodeTensorEnumerator
import socketio
import uuid
import subprocess
import time
import signal
import os
import socket
from typing import Generator, AsyncGenerator
import logging
import traceback

# Configure logging
# logging.basicConfig(level=logging.DEBUG, stream=sys.stdout)
logger = logging.getLogger(__name__)


root = logging.getLogger()
root.setLevel(logging.DEBUG)  # Set the minimum logging level

# Create a StreamHandler to output to stdout
handler = logging.StreamHandler(sys.stdout)
handler.setLevel(logging.DEBUG)

# Create a formatter to customize the log message format
formatter = logging.Formatter("%(asctime)s [%(levelname)s] {%(name)s} \t %(message)s")
handler.setFormatter(formatter)

# Add the handler to the root logger
root.addHandler(handler)


# Configure pytest-asyncio
def pytest_configure(config):
    config.addinivalue_line("asyncio_mode", "auto")


def wait_for_port(port: int, host: str = "localhost", timeout: int = 5) -> bool:
    """Wait for a port to be available."""
    start_time = time.time()
    while True:
        try:
            with socket.create_connection((host, port), timeout=1):
                logger.info(f"Port {port} is now available")
                return True
        except OSError:
            if time.time() - start_time >= timeout:
                logger.error(f"Timeout waiting for port {port}")
                return False
            time.sleep(0.1)


@pytest.fixture(scope="session")
def server_process(
    redis_server: subprocess.Popen,
    celery_worker: subprocess.Popen,
    flower_worker: subprocess.Popen,
) -> Generator[subprocess.Popen, None, None]:
    """Start the server process and yield it for the test session."""
    # Start the server process
    process = subprocess.Popen(
        ["python", "-m", "planqtn_api.planqtn_server", "--debug"],
        stdout=sys.stdout,
        stderr=sys.stderr,
        preexec_fn=os.setsid,
        text=True,
        bufsize=1,
    )

    logger.info("Started server process")

    # Wait for the server to be ready
    if not wait_for_port(5005):
        logger.error("Server failed to start within timeout")
        process.terminate()
        process.wait()
        raise RuntimeError("Server failed to start within timeout")

    yield process

    # Cleanup: kill the process group
    logger.info("Cleaning up server process")
    os.killpg(os.getpgid(process.pid), signal.SIGTERM)
    process.wait()


@pytest.mark.asyncio
async def test_websocket_hello(
    server_process: subprocess.Popen,
    celery_worker: subprocess.Popen,
    flower_worker: subprocess.Popen,
    redis_server: subprocess.Popen,
):

    sio = socketio.AsyncClient(logger=logging.getLogger("socketio-client"))

    hello_future = asyncio.Future()

    @sio.event
    async def connect():
        logger.debug("[pre-client] connection established")

    @sio.event
    async def disconnect():
        logger.debug("[pre-client] disconnected from server")

    @sio.event
    async def hello(data):
        logger.debug(f"[pre-client] message received with {data}")
        hello_future.set_result(data)

    # Create event futures
    hello_future = asyncio.Future()

    await sio.connect("http://localhost:5005", namespaces=["/"])

    try:
        # Join the tasks room in the / namespace
        await sio.emit("join_room", {"room_id": "hello"}, namespace="/")
        logger.debug(
            f"[client] Joined hello room in / namespace, now waiting for the hello event..."
        )
    except Exception as e:
        logger.debug(f"[pre-client] Error joining rooms: {e}")
        traceback.logger.debug_exc()

    logger.debug("[client] Waiting for hello message")

    await asyncio.wait_for(hello_future, timeout=30)

    await sio.disconnect()


@pytest.mark.asyncio
async def test_websocket_task_lifecycle(
    server_process: subprocess.Popen,
    celery_worker: subprocess.Popen,
    flower_worker: subprocess.Popen,
    redis_server: subprocess.Popen,
):

    sio = socketio.AsyncClient(logger=True, engineio_logger=True)

    # Connect to all namespaces
    await sio.connect("http://localhost:5005", namespaces=["/ws/tasks", "/ws/task"])

    # Wait a bit for connections to be fully established
    await asyncio.sleep(0.5)

    # Join rooms after connection is established
    try:
        # Join the tasks room in the /ws/tasks namespace
        await sio.emit("join_room", {"room_id": "tasks"}, namespace="/ws/tasks")
        logger.debug("Joined tasks room in /ws/tasks namespace")
    except Exception as e:
        logger.debug(f"Error joining rooms: {e}")
        traceback.logger.debug_exc()

    # Create event futures
    task_sent_future = asyncio.Future()
    task_received_future = asyncio.Future()
    task_started_future = asyncio.Future()
    task_succeeded_future = asyncio.Future()
    task_updates = []

    logger.debug(f"sio_client {sio.sid} {sio.transport()}")

    # Set up event handlers for the tasks namespace
    @sio.on("celery_event", namespace="/ws/tasks")
    def handle_celery_event_tasks(data):
        event_type = data.get("type")
        logger.debug(f"Received celery_event in /ws/tasks namespace: {event_type}")
        if event_type == "task-sent":
            logger.debug("Setting task_sent_future result")
            if not task_sent_future.done():
                task_sent_future.set_result(data)
        elif event_type == "task-received":
            logger.debug("Setting task_received_future result")
            if not task_received_future.done():
                task_received_future.set_result(data)
        elif event_type == "task-started":
            logger.debug("Setting task_started_future result")
            if not task_started_future.done():
                task_started_future.set_result(data)
        elif event_type == "task-succeeded":
            logger.debug("Setting task_succeeded_future result")
            if not task_succeeded_future.done():
                task_succeeded_future.set_result(data)
        elif event_type == "task-failed":
            logger.error(data["exception"])
            logger.error(data["traceback"])
            pytest.fail(f"Task failed: {data}")
        else:
            pytest.fail(f"Unknown event type: {event_type}")

    @sio.on("connect", namespace="/ws/tasks")
    def handle_connect_tasks():
        logger.debug("Connected to /ws/tasks namespace")

    @sio.on("disconnect", namespace="/ws/tasks")
    def handle_disconnect_tasks():
        logger.debug("Disconnected from /ws/tasks namespace")

    @sio.on("connect_error", namespace="/ws/tasks")
    def handle_connect_error_tasks(data):
        logger.debug(f"Connection error in /ws/tasks namespace: {data}")

    @sio.on("task_updated", namespace="/ws/task")
    def handle_task_update(data):
        task_updates.append(data)
        logger.debug(f"Received task update: {data}")

    # Wait for connection to be established
    await asyncio.sleep(1)

    # Start a small weight enumerator evaluation for Steane code
    steane_tensor = Legos.steane_code_813_encoding_tensor
    task_id = str(uuid.uuid4())

    # Create a WeightEnumeratorRequest for the Steane code
    request = {
        "legos": {
            "steane": {
                "id": "steane_code",
                "instanceId": "steane",
                "name": "Steane Code",
                "shortName": "steane",
                "description": "Steane [[7,1,3]] code",
                "is_dynamic": False,
                "parameters": {},
                "parity_check_matrix": steane_tensor.tolist(),
                "logical_legs": [],
                "gauge_legs": [],
            }
        },
        "connections": [],
        "truncate_length": 10,
    }

    # Create a task that will evaluate the weight enumerator
    task = celery_app.send_task(
        "server.tasks.weight_enumerator_task",
        args=[request],
        task_id=task_id,
    )

    # Wait for task events
    try:
        task_sent_event = await asyncio.wait_for(task_sent_future, timeout=5)
        logger.debug(f"Received task-sent event: {task_sent_event}")
        assert task_sent_event["uuid"] == task_id

        logger.debug("Waiting for task-received event...")
        task_received_event = await asyncio.wait_for(task_received_future, timeout=5)
        logger.debug(f"Received task-received event: {task_received_event}")
        assert task_received_event["uuid"] == task_id

        logger.debug("Waiting for task-started event...")
        task_started_event = await asyncio.wait_for(task_started_future, timeout=5)
        logger.debug(f"Received task-started event: {task_started_event}")
        assert task_started_event["uuid"] == task_id
    except asyncio.TimeoutError:
        logger.debug("Timeout waiting for task events")
        raise

    # Connect to task-specific namespace and join the task room
    await sio.emit("join_room", {"room_id": f"task_{task_id}"}, namespace="/ws/task")

    # Wait for task completion
    task_succeeded_event = await asyncio.wait_for(task_succeeded_future, timeout=10)
    assert task_succeeded_event["uuid"] == task_id

    await asyncio.sleep(5)
    # Wait for task updates
    logger.debug(f"Received {len(task_updates)} task updates for {task_id}")
    assert len(task_updates) > 0, "Didn't receive any task updates"
    for update in task_updates:
        logger.debug(f"Received task update: {update}")
        assert update["type"] == "task_updated"
        assert update["id"] == task_id
        assert "updates" in update["message"]
        assert (
            update["message"]["updates"]["status"] == "PROGRESS"
            and "iteration_status" in update["message"]["updates"]
        ) or (update["message"]["updates"]["status"] == "SUCCESS")

    # Verify the result
    res = task_succeeded_event["result"]
    logger.debug(f"Task succeeded event result: {res}")

    assert isinstance(res, str), "Result is not a string"

    try:
        res = json.loads(res)
    except json.JSONDecodeError:
        logger.error(f"Failed to parse result: {res}")
        pytest.fail(f"Failed to parse result: {res}")

    assert res["polynomial"] == "{0:1, 4:42, 6:168, 8:45}"
    assert res["normalizer_polynomial"] == "not defined for truncated enumerator"
    assert res["time"] > 0
    assert res["truncate_length"] == "10"
