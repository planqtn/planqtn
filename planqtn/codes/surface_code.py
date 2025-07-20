from galois import GF2
from planqtn.tensor_network import TensorNetwork
from planqtn.legos import Legos
from planqtn.tensor_network import (
    PAULI_X,
    PAULI_Z,
    StabilizerCodeTensorEnumerator,
    TensorId,
    TensorLeg,
)
from typing import Callable, Optional, Tuple


class SurfaceCodeTN(TensorNetwork):
    def __init__(
        self,
        d: int,
        lego: Callable[[TensorId], GF2] = lambda i: Legos.enconding_tensor_512,
        coset_error: Optional[GF2] = None,
        truncate_length: Optional[int] = None,
    ):

        if d < 2:
            raise ValueError("Only d=2+ is supported.")

        # numbering convention:

        # (0,0)  (0,2)  (0,4)
        #    (1,1)   (1,3)
        # (2,0)  (2,2)  (2,4)
        #    (3,1)   (3,3)
        # (4,0)  (4,2)  (4,4)

        last_row = 2 * d - 2
        last_col = 2 * d - 2

        super().__init__(
            [
                StabilizerCodeTensorEnumerator(lego((r, c)), tensor_id=(r, c))
                for r in range(last_row + 1)
                for c in range(r % 2, last_col + 1, 2)
            ],
            truncate_length=truncate_length,
        )
        self._q_to_node = [
            (r, c) for r in range(last_row + 1) for c in range(r % 2, last_col + 1, 2)
        ]

        nodes = self.nodes

        # we take care of corners first

        nodes[(0, 0)] = (
            nodes[(0, 0)]
            .trace_with_stopper(PAULI_Z, 0)
            .trace_with_stopper(PAULI_Z, 1)
            .trace_with_stopper(PAULI_X, 3)
        )
        nodes[(0, last_col)] = (
            nodes[(0, last_col)]
            .trace_with_stopper(PAULI_Z, 2)
            .trace_with_stopper(PAULI_Z, 3)
            .trace_with_stopper(PAULI_X, 0)
        )
        nodes[(last_row, 0)] = (
            nodes[(last_row, 0)]
            .trace_with_stopper(PAULI_Z, 0)
            .trace_with_stopper(PAULI_Z, 1)
            .trace_with_stopper(PAULI_X, 2)
        )
        nodes[(last_row, last_col)] = (
            nodes[(last_row, last_col)]
            .trace_with_stopper(PAULI_Z, 2)
            .trace_with_stopper(PAULI_Z, 3)
            .trace_with_stopper(PAULI_X, 1)
        )

        for k in range(2, last_col, 2):
            # X boundaries on the top and bottom
            nodes[(0, k)] = (
                nodes[(0, k)]
                .trace_with_stopper(PAULI_X, 0)
                .trace_with_stopper(PAULI_X, 3)
            )
            nodes[(last_row, k)] = (
                nodes[(last_row, k)]
                .trace_with_stopper(PAULI_X, 1)
                .trace_with_stopper(PAULI_X, 2)
            )

            # Z boundaries on left and right
            nodes[(k, 0)] = (
                nodes[(k, 0)]
                .trace_with_stopper(PAULI_Z, 0)
                .trace_with_stopper(PAULI_Z, 1)
            )
            nodes[(k, last_col)] = (
                nodes[(k, last_col)]
                .trace_with_stopper(PAULI_Z, 2)
                .trace_with_stopper(PAULI_Z, 3)
            )

        # we'll trace diagonally
        for diag in range(1, last_row + 1):
            # connecting the middle to the previous diagonal's middle
            self.self_trace(
                (diag - 1, diag - 1),
                (diag, diag),
                [2 if diag % 2 == 1 else 1],
                [3 if diag % 2 == 1 else 0],
            )
            # go left until hitting the left column or the bottom row
            # and at the same time go right until hitting the right col or the top row (symmetric)
            row, col = diag + 1, diag - 1
            while row <= last_row and col >= 0:
                # going left
                self.self_trace(
                    (row - 1, col + 1),
                    (row, col),
                    [0 if row % 2 == 0 else 1],
                    [3 if row % 2 == 0 else 2],
                )

                # going right
                self.self_trace(
                    (col + 1, row - 1),
                    (col, row),
                    [3 if row % 2 == 1 else 2],
                    [0 if row % 2 == 1 else 1],
                )

                if row - 1 >= 0 and col - 1 >= 0:
                    # connect to previous diagonal
                    # on the left
                    self.self_trace(
                        (row - 1, col - 1),
                        (row, col),
                        [2 if row % 2 == 1 else 1],
                        [3 if row % 2 == 1 else 0],
                    )
                    # on the right
                    self.self_trace(
                        (col - 1, row - 1),
                        (col, row),
                        [2 if row % 2 == 1 else 1],
                        [3 if row % 2 == 1 else 0],
                    )

                row += 1
                col -= 1
            # go right until hitting the right column
        self.n = len(self.nodes)
        if coset_error is None:
            coset_error = GF2.Zeros(2 * self.n)
        self.set_coset(coset_error)

    def qubit_to_node_and_leg(self, q: int) -> Tuple[TensorId, TensorLeg]:
        return self._q_to_node[q], (self._q_to_node[q], 4)

    def n_qubits(self) -> int:
        return self.n
