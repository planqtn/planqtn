from galois import GF2
from planqtn.tensor_network import TensorNetwork, TensorId, TensorLeg
from planqtn.legos import Legos
from planqtn.tensor_network import (
    PAULI_X,
    PAULI_Z,
    StabilizerCodeTensorEnumerator,
)
from typing import Callable, Dict, Optional, Tuple


class RotatedSurfaceCodeTN(TensorNetwork):
    def __init__(
        self,
        d: int,
        lego: Callable[[TensorId], GF2] = lambda i: Legos.enconding_tensor_512,
        coset_error: Optional[GF2] = None,
        truncate_length: Optional[int] = None,
    ):

        nodes: Dict[TensorId, StabilizerCodeTensorEnumerator] = {
            (r, c): StabilizerCodeTensorEnumerator(
                lego((r, c)),
                tensor_id=(r, c),
            )
            # col major ordering
            for r in range(d)
            for c in range(d)
        }

        for c in range(d):
            # top Z boundary (X type checks, Z type logical)
            nodes[(0, c)] = nodes[(0, c)].trace_with_stopper(
                PAULI_X, 3 if c % 2 == 0 else 0
            )
            # bottom Z boundary (X type checks, Z type logical)
            nodes[(d - 1, c)] = nodes[(d - 1, c)].trace_with_stopper(
                PAULI_X, 1 if c % 2 == 0 else 2
            )

        for r in range(d):
            # left X boundary (Z type checks, X type logical)
            nodes[r, 0] = nodes[(r, 0)].trace_with_stopper(
                PAULI_Z, 0 if r % 2 == 0 else 1
            )
            # right X boundary (Z type checks, X type logical)
            nodes[(r, d - 1)] = nodes[(r, d - 1)].trace_with_stopper(
                PAULI_Z, 2 if r % 2 == 0 else 3
            )

        # for r in range(1,4):
        #     # bulk
        #     for c in range(1,4):

        super().__init__(nodes, truncate_length=truncate_length)

        for radius in range(1, d):
            for i in range(radius + 1):
                # extending the right boundary
                self.self_trace(
                    (i, radius - 1),
                    (i, radius),
                    [3 if (i + radius) % 2 == 0 else 2],
                    [0 if (i + radius) % 2 == 0 else 1],
                )
                if i > 0 and i < radius:
                    self.self_trace(
                        (i - 1, radius),
                        (i, radius),
                        [2 if (i + radius) % 2 == 0 else 1],
                        [3 if (i + radius) % 2 == 0 else 0],
                    )
                # extending the bottom boundary
                self.self_trace(
                    (radius - 1, i),
                    (radius, i),
                    [2 if (i + radius) % 2 == 0 else 1],
                    [3 if (i + radius) % 2 == 0 else 0],
                )
                if i > 0 and i < radius:
                    self.self_trace(
                        (radius, i - 1),
                        (radius, i),
                        [3 if (i + radius) % 2 == 0 else 2],
                        [0 if (i + radius) % 2 == 0 else 1],
                    )
        self.n = d * d
        self.d = d

        if coset_error is not None:
            self.set_coset(coset_error=coset_error)

    def qubit_to_node_and_leg(self, q: int) -> Tuple[TensorId, TensorLeg]:
        # col major ordering
        node = (q % self.d, q // self.d)
        return node, (node, 4)

    def n_qubits(self) -> int:
        return self.n
