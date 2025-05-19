import json
import pathlib
import sys
import time
import traceback
from typing import Any, Dict
from celery import Celery, Task
from celery.utils.log import get_task_logger
import os

from dotenv import load_dotenv
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
from qlego.symplectic import symp_to_str
from qlego.tensor_network import TensorNetwork
from server.api_types import (
    TensorNetworkRequest,
    WeightEnumeratorRequest,
    WeightEnumeratorResponse,
)
from server.task_store import SupabaseTaskStore, TaskStore

# Do not move this - it is needed to load the environment variables
# before importing any other modules

basedir = pathlib.Path(__file__).parents[0]
load_dotenv(basedir / ".env", verbose=True)


from server.config import get_settings

settings = get_settings()

logger = get_task_logger(__name__)


class TaskStoreProgressReporter(ProgressReporter):
    def __init__(
        self,
        task: Task,
        task_store: TaskStore,
        sub_reporter: ProgressReporter = None,
        iteration_report_frequency: float = 1.0,
        user_id: str | None = None,
    ):
        self.task = task
        self.start_time = time.time()
        self.task_store = task_store
        self.user_id = user_id

        super().__init__(sub_reporter, iteration_report_frequency)

    def __enter__(self):
        self.sub_reporter.__enter__()

        logger.info(
            f"adding task to task store {self.task.request.id} {self.user_id} - {type(self.task_store)}"
        )
        self.task_store.add_task(self.task, user_id=self.user_id)
        logger.info(f"task added to task store {self.task.request.id} {self.user_id}")
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.sub_reporter.__exit__(exc_type, exc_value, traceback)

        if exc_type is not None:
            self.task_store.update_task(
                self.task.request.id,
                {"status": "FAILED", "result": str(exc_value)},
                user_id=self.user_id,
            )
        else:
            self.task_store.update_task(
                self.task.request.id,
                {
                    "status": "SUCCESS",
                },
                user_id=self.user_id,
            )

    def handle_result(self, result: Dict[str, Any]):
        self.task_store.update_task(
            self.task.request.id,
            {"status": "PROGRESS", "iteration_status": self.iterator_stack},
            user_id=self.user_id,
        )


def weight_enumerator_task(self, request_dict: dict):
    try:
        # Convert dictionary back to TensorNetworkRequest
        request = WeightEnumeratorRequest(**request_dict)
        task_store = SupabaseTaskStore(settings.supabase_url, settings.supabase_key)
        with TaskStoreProgressReporter(
            self,
            task_store=task_store,
            user_id=request_dict["user_id"],
            sub_reporter=TqdmProgressReporter(file=sys.stdout),
        ) as progress_reporter:
            # Create TensorStabilizerCodeEnumerator instances for each lego
            nodes = {}

            for instance_id, lego in request.legos.items():
                # Convert the parity check matrix to numpy array
                h = GF2(lego.parity_check_matrix)
                nodes[instance_id] = StabilizerCodeTensorEnumerator(
                    h=h, idx=instance_id
                )

            # Create TensorNetwork instance
            tn = TensorNetwork(nodes, truncate_length=request.truncate_length)

            # Add traces for each connection
            for conn in request.connections:
                tn.self_trace(
                    conn["from"]["legoId"],
                    conn["to"]["legoId"],
                    [conn["from"]["legIndex"]],
                    [conn["to"]["legIndex"]],
                )

            open_legs = [(leg.instanceId, leg.legIndex) for leg in request.open_legs]

            start = time.time()

            # Conjoin all nodes to get the final tensor network
            polynomial = tn.stabilizer_enumerator_polynomial(
                verbose=False,
                progress_reporter=progress_reporter,
                cotengra=len(nodes) > 5,
                open_legs=open_legs,
            )
            end = time.time()

            print("WEP calculation time", end - start)
            print("polynomial", polynomial)

            if open_legs:
                poly_b = "not supported for open legs yet"
            elif polynomial.is_scalar():
                poly_b = polynomial
            elif request.truncate_length is not None:
                poly_b = "not defined for truncated enumerator"
            else:
                h = tn.conjoin_nodes().h
                r = h.shape[0]
                n = h.shape[1] // 2
                k = n - r

                z, w = symbols("z w")
                poly_b = polynomial.macwilliams_dual(n=n, k=k, to_normalizer=True)

                print("poly_b", poly_b)

            # Convert the polynomial to a string representation
            if open_legs:

                def format_pauli(pauli):
                    return symp_to_str(pauli)

                polynomial_str = "\n".join(
                    [
                        f"{format_pauli(pauli)}: {str(wep)}"
                        for pauli, wep in polynomial.items()
                    ]
                )
                normalizer_polynomial_str = "not supported for open legs yet"
            else:
                polynomial_str = str(polynomial)
                normalizer_polynomial_str = str(poly_b)
            res = {
                "polynomial": polynomial_str,
                "normalizer_polynomial": normalizer_polynomial_str,
                # "history": progress_reporter.history,
                "time": end - start,
                "truncate_length": str(request.truncate_length),
            }
            task_store.store_task_result(self.request.id, res)
            return "SUCCESS"

    except Exception as e:
        logger.error(f"Error in weight_enumerator_task: {e}", exc_info=True)
        raise e
