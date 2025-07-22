"""The `stabilizer_tanner_code` module contains the `StabilizerTannerCodeTN` class,
which implements a tensor network representation of stabilizer codes using Tanner graph structure.
"""

from typing import List, Tuple
import numpy as np
from planqtn.tensor_network import PAULI_X, TensorNetwork, TensorId, TensorLeg
from planqtn.legos import Legos
from planqtn.tensor_network import (
    StabilizerCodeTensorEnumerator,
)


class StabilizerTannerCodeTN(TensorNetwork):
    """A tensor network representation of stabilizer codes using Tanner graph structure.

    This class constructs a tensor network from a parity check matrix H, where each
    row of H represents a stabilizer generator and each column represents a qubit.
    The tensor network is built by connecting check tensors to qubit tensors according
    to the non-zero entries in the parity check matrix.

    Args:
        h: Parity check matrix in symplectic form (must have even number of columns).
    """

    def __init__(self, h: np.ndarray):
        self.parity_check_matrix = h
        if h.shape[1] % 2 == 1:
            raise ValueError(f"Not a symplectic matrix: {h}")

        r = h.shape[0]
        n = h.shape[1] // 2

        checks = []
        for i in range(r):
            weight = np.count_nonzero(h[i])
            check = StabilizerCodeTensorEnumerator(
                h=Legos.z_rep_code(weight + 2), tensor_id=f"check{i}"
            )
            check = check.trace_with_stopper(PAULI_X, (f"check{i}", 0))
            check = check.trace_with_stopper(PAULI_X, (f"check{i}", 1))
            checks.append(check)

        traces = []
        next_check_legs = [2] * r
        q_tensors = []
        self.q_to_leg_and_node: List[Tuple[TensorId, TensorLeg]] = []

        # for each qubit we create merged tensors across all checks
        for q in range(n):
            q_tensor = StabilizerCodeTensorEnumerator(
                h=Legos.stopper_i, tensor_id=f"q{q}"
            )
            physical_leg = (f"q{q}", 0)
            for i in range(r):
                op = tuple(h[i, (q, q + n)])
                print(q_tensor.tensor_id, q, i, op, q_tensor.legs, physical_leg)
                if op == (0, 0):
                    continue

                if op == (1, 0):
                    q_tensor = q_tensor.conjoin(
                        StabilizerCodeTensorEnumerator(
                            h=Legos.x_rep_code(3), tensor_id=f"q{q}.c{i}"
                        ),
                        [physical_leg],
                        [0],
                    )
                    traces.append(
                        (
                            q_tensor.tensor_id,
                            checks[i].tensor_id,
                            [(f"q{q}.c{i}", 1)],
                            [next_check_legs[i]],
                        )
                    )
                    next_check_legs[i] += 1
                    physical_leg = (f"q{q}.c{i}", 2)

                elif op == (0, 1):
                    q_tensor = q_tensor.conjoin(
                        StabilizerCodeTensorEnumerator(
                            h=Legos.z_rep_code(3), tensor_id=f"q{q}.z{i}"
                        ),
                        [physical_leg],
                        [0],
                    )
                    q_tensor = q_tensor.conjoin(
                        StabilizerCodeTensorEnumerator(
                            h=Legos.h, tensor_id=f"q{q}.c{i}"
                        ),
                        [(f"q{q}.z{i}", 1)],
                        [0],
                    )
                    traces.append(
                        (
                            q_tensor.tensor_id,
                            checks[i].tensor_id,
                            [(f"q{q}.c{i}", 1)],
                            [next_check_legs[i]],
                        )
                    )
                    next_check_legs[i] += 1
                    physical_leg = (f"q{q}.z{i}", 2)

                else:
                    raise ValueError("Y stabilizer is not implemented yet...")
            q_tensors.append(q_tensor)
            self.q_to_leg_and_node.append((physical_leg[0], physical_leg))

        super().__init__(nodes={n.tensor_id: n for n in q_tensors + checks})

        for t in traces:
            self.self_trace(*t)

    def n_qubits(self) -> int:
        """Get the total number of qubits in the tensor network.

        Returns:
            int: Total number of qubits represented by this tensor network.
        """
        return int(self.parity_check_matrix.shape[1] // 2)

    def qubit_to_node_and_leg(self, q: int) -> Tuple[TensorId, TensorLeg]:
        """Map a qubit index to its corresponding node and leg.

        Args:
            q: Global qubit index.

        Returns:
            Tuple[TensorId, TensorLeg]: Node ID and leg that represent the qubit.
        """

        return self.q_to_leg_and_node[q]
