from galois import GF2
from qlego.tensor_stabilizer_enumerator import TensorNetwork
from qlego.legos import Legos
from qlego.tensor_stabilizer_enumerator import (
    PAULI_X,
    PAULI_Z,
    TensorStabilizerCodeEnumerator,
)


class RotatedSurfaceCode(TensorNetwork):
    def __init__(
        self,
        d: int,
        lego=lambda i: Legos.econding_tensor_512,
        coset_error=None,
    ):

        nodes = [TensorStabilizerCodeEnumerator(lego(i), idx=i) for i in range(d**2)]

        # row major ordering
        idx = lambda r, c: r * d + c

        for c in range(d):
            # top Z boundary
            nodes[idx(0, c)] = nodes[idx(0, c)].trace_with_stopper(
                PAULI_Z, 3 if c % 2 == 0 else 0
            )
            # bottom Z boundary
            nodes[idx(d - 1, c)] = nodes[idx(d - 1, c)].trace_with_stopper(
                PAULI_Z, 1 if c % 2 == 0 else 2
            )

        for r in range(d):
            # left X boundary
            nodes[idx(r, 0)] = nodes[idx(r, 0)].trace_with_stopper(
                PAULI_X, 0 if r % 2 == 0 else 1
            )
            # right X boundary
            nodes[idx(r, d - 1)] = nodes[idx(r, d - 1)].trace_with_stopper(
                PAULI_X, 2 if r % 2 == 0 else 3
            )

        # for r in range(1,4):
        #     # bulk
        #     for c in range(1,4):

        super().__init__(nodes)

        for radius in range(1, d):
            for i in range(radius + 1):
                # extending the right boundary
                self.self_trace(
                    idx(i, radius - 1),
                    idx(i, radius),
                    [3 if idx(i, radius) % 2 == 0 else 2],
                    [0 if idx(i, radius) % 2 == 0 else 1],
                )
                if i > 0 and i < radius:
                    self.self_trace(
                        idx(i - 1, radius),
                        idx(i, radius),
                        [2 if idx(i, radius) % 2 == 0 else 1],
                        [3 if idx(i, radius) % 2 == 0 else 0],
                    )
                # extending the bottom boundary
                self.self_trace(
                    idx(radius - 1, i),
                    idx(radius, i),
                    [2 if idx(i, radius) % 2 == 0 else 1],
                    [3 if idx(i, radius) % 2 == 0 else 0],
                )
                if i > 0 and i < radius:
                    self.self_trace(
                        idx(radius, i - 1),
                        idx(radius, i),
                        [3 if idx(i, radius) % 2 == 0 else 2],
                        [0 if idx(i, radius) % 2 == 0 else 1],
                    )
        self.n = d * d
        if coset_error is None:
            coset_error = GF2.Zeros(2 * self.n)
        self.set_coset(coset_error)

    def qubit_to_node(self, q):
        return q

    def n_qubits(self):
        return self.n
