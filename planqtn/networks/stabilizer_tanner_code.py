"""The `stabilizer_tanner_code` module.

It contains the `StabilizerTannerCodeTN` class, which implements a tensor network representation
of arbitrary stabilizer codes using Tanner graph structure.

The construction is based on the following work:

Cao, ChunJun, Michael J. Gullans, Brad Lackey, and Zitao Wang. 2024.
“Quantum Lego Expansion Pack: Enumerators from Tensor Networks.”
PRX Quantum 5 (3): 030313. https://doi.org/10.1103/PRXQuantum.5.030313.
"""

from typing import List, Tuple
import numpy as np
from planqtn.tensor_network import TensorNetwork, TensorId, TensorLeg
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
    """

    def __init__(self, h: np.ndarray):
        """Construct a stabilizer Tanner code tensor network.

        Args:
            h: Parity check matrix in symplectic form (must have even number of columns).

        Raises:
            ValueError: If the parity check matrix is not symplectic.
        """
        self.parity_check_matrix = h
        if h.shape[1] % 2 == 1:
            raise ValueError(f"Not a symplectic matrix: {h}")

        r = h.shape[0]
        n = h.shape[1] // 2

        checks = []
        for i in range(r):
            weight = int(np.count_nonzero(h[i]))
            check = StabilizerCodeTensorEnumerator(
                h=Legos.z_rep_code(weight + 2), tensor_id=f"check{i}"
            )
            check = check.trace_with_stopper(Legos.stopper_x, (f"check{i}", 0))
            check = check.trace_with_stopper(Legos.stopper_x, (f"check{i}", 1))
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
                if op == (0, 0):
                    continue

                if op == (1, 0):
                    q_tensor = q_tensor.merge_with(
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
                    q_tensor = q_tensor.merge_with(
                        StabilizerCodeTensorEnumerator(
                            h=Legos.z_rep_code(3), tensor_id=f"q{q}.z{i}"
                        ),
                        [physical_leg],
                        [0],
                    )
                    q_tensor = q_tensor.merge_with(
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

        Returns the tensor and leg for the given qubit index.

        Args:
            q: Global qubit index.

        Returns:
            Node ID: node id for the tensor in the network
            Leg: leg that represent the qubit.
        """
        return self.q_to_leg_and_node[q]
