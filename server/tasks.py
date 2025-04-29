import json
import time
import traceback
from typing import Any, Dict
from celery import Celery, Task
from celery.utils.log import get_task_logger
import os

from galois import GF2
import kombu
from sympy import symbols

from qlego.progress_reporter import (
    DummyProgressReporter,
    IterationState,
    IterationStateEncoder,
    ProgressReporter,
    TqdmProgressReporter,
)
from qlego.stabilizer_tensor_enumerator import StabilizerCodeTensorEnumerator
from qlego.tensor_network import TensorNetwork
from server.api_types import TensorNetworkRequest, WeightEnumeratorResponse
from server.task_store import TaskStore

# Get Redis URL from environment variable or use default
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "mytasks",
    broker=REDIS_URL,
    backend=REDIS_URL,
    broker_connection_retry_on_startup=True,
    loglevel="INFO",
)

# Configure Celery
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Enable events
    worker_send_task_events=True,
    task_send_sent_event=True,
    # Enable monitoring
    event_queue_expires=60,
    event_queue_ttl=60,
    event_serializer="json",
)

kombu.utils.json.register_type(
    IterationState, "IterationState", IterationStateEncoder()
)

logger = get_task_logger(__name__)


class CeleryProgressReporter(ProgressReporter):
    def __init__(
        self,
        task: Task,
        task_store: TaskStore,
        sub_reporter: ProgressReporter = None,
    ):
        self.task = task
        self.history = []
        self.start_time = time.time()
        self.task_store = task_store

        super().__init__(sub_reporter)

    def __enter__(self):
        self.task_store.add_task(
            self.task.request.id, {"status": "PROGRESS", "result": None}
        )
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        if exc_type is not None:
            self.task_store.update_task(
                self.task.request.id, {"status": "FAILED", "result": str(exc_value)}
            )
        else:
            self.task_store.update_task(
                self.task.request.id, {"status": "SUCCESS", "result": self.history}
            )

    def handle_result(self, result: Dict[str, Any]):
        self.history.append(result)
        self.task_store.update_task(
            self.task.request.id,
            {"status": "PROGRESS", "iteration_status": self.iterator_stack},
        )
        self.task.update_state(
            state="PROGRESS",
            meta={
                "start_time": self.start_time,
                "last_update_time": time.time(),
                "runtime_at_last_update": time.time() - self.start_time,
                # "iteration_status": self.iterator_stack,
                # "history": self.history,
            },
        )


@celery_app.task(bind=True)
def weight_enumerator_task(self, network_dict: dict):
    try:
        # Convert dictionary back to TensorNetworkRequest
        network = TensorNetworkRequest(**network_dict)
        with CeleryProgressReporter(
            self,
            task_store=TaskStore(REDIS_URL),
            sub_reporter=TqdmProgressReporter(),
        ) as progress_reporter:
            # Create TensorStabilizerCodeEnumerator instances for each lego
            nodes = {}

            for instance_id, lego in network.legos.items():
                # Convert the parity check matrix to numpy array
                h = GF2(lego.parity_check_matrix)
                nodes[instance_id] = StabilizerCodeTensorEnumerator(
                    h=h, idx=instance_id
                )

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

            start = time.time()

            # Conjoin all nodes to get the final tensor network
            polynomial = tn.stabilizer_enumerator_polynomial(
                verbose=False,
                progress_reporter=progress_reporter,
                cotengra=len(nodes) > 5,
            )
            end = time.time()

            print("WEP calculation time", end - start)
            print("polynomial", polynomial)

            if polynomial.is_scalar():
                poly_b = polynomial
            else:
                h = tn.conjoin_nodes().h
                r = h.shape[0]
                n = h.shape[1] // 2
                k = n - r

                z, w = symbols("z w")
                poly_b = polynomial.macwilliams_dual(n=n, k=k, to_normalizer=True)

                print("poly_b", poly_b)

            # Convert the polynomial to a string representation
            polynomial_str = str(polynomial)
            normalizer_polynomial_str = str(poly_b)

            return {
                "polynomial": polynomial_str,
                "normalizer_polynomial": normalizer_polynomial_str,
                # "history": progress_reporter.history,
                "time": end - start,
            }
    except Exception as e:
        print("error", e)
        traceback.print_exc()
        return {"status": "failed", "message": str(e)}
