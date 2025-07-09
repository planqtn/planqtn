import logging
import time
from typing import Any, Dict, TextIO

from galois import GF2
from sympy import symbols
from planqtn_jobs.task import SupabaseCredentials, SupabaseTaskStore, Task, TaskDetails
from planqtn_types.api_types import (
    WeightEnumeratorCalculationArgs,
    WeightEnumeratorCalculationResult,
)
from planqtn.progress_reporter import ProgressReporter
from planqtn.stabilizer_tensor_enumerator import StabilizerCodeTensorEnumerator
from planqtn.symplectic import symp_to_str
from planqtn.tensor_network import TensorNetwork


logger = logging.getLogger(__name__)


class WeightEnumeratorTask(
    Task[WeightEnumeratorCalculationArgs, WeightEnumeratorCalculationResult]
):
    def __init__(
        self,
        task_details: TaskDetails,
        task_store: SupabaseTaskStore,
        local_progress_bar: bool = True,
        realtime_updates_enabled: bool = True,
        realtime_update_frequency: float = 5,
        debug: bool = False,
    ):
        super().__init__(
            task_details=task_details,
            task_store=task_store,
            local_progress_bar=local_progress_bar,
            realtime_update_frequency=realtime_update_frequency,
            realtime_updates_enabled=realtime_updates_enabled,
            debug=debug,
        )
        print("debug", debug, self.debug)

    def __load_args_from_json__(
        self, json_data: Dict[str, Any]
    ) -> WeightEnumeratorCalculationArgs:
        return WeightEnumeratorCalculationArgs(**json_data)

    def __execute__(
        self, args: WeightEnumeratorCalculationArgs, progress_reporter: ProgressReporter
    ) -> WeightEnumeratorCalculationResult:
        try:
            logger.info(f"Executing task with progress reporter: {progress_reporter}")
            nodes = {}

            for instance_id, lego in args.legos.items():
                # Convert the parity check matrix to numpy array
                h = GF2(lego.parity_check_matrix)
                nodes[instance_id] = StabilizerCodeTensorEnumerator(
                    h=h, idx=instance_id
                )

            # Create TensorNetwork instance
            tn = TensorNetwork(nodes, truncate_length=args.truncate_length)

            # Add traces for each connection
            for conn in args.connections:
                tn.self_trace(
                    conn["from"]["legoId"],
                    conn["to"]["legoId"],
                    [conn["from"]["leg_index"]],
                    [conn["to"]["leg_index"]],
                )

            open_legs = [(leg.instance_id, leg.leg_index) for leg in args.open_legs]

            start = time.time()
            print("debug", self.debug)
            print("progress_reporter", progress_reporter)
            # Conjoin all nodes to get the final tensor network
            polynomial = tn.stabilizer_enumerator_polynomial(
                verbose=self.debug,
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
            elif args.truncate_length is not None:
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
            res = WeightEnumeratorCalculationResult(
                stabilizer_polynomial=polynomial_str,
                normalizer_polynomial=normalizer_polynomial_str,
                time=end - start,
            )
            return res

        except Exception as e:
            logger.error(f"Error in weight_enumerator_task: {e}", exc_info=True)
            raise e
