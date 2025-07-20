from galois import GF2
import numpy as np
from planqtn.legos import Legos
from planqtn.codes.surface_code import SurfaceCodeTN
from planqtn.tensor_network import PAULI_X, PAULI_Z
from typing import Callable, Optional
from planqtn.tensor_network import TensorId


class CompassCodeTN(SurfaceCodeTN):
    def __init__(
        self,
        coloring: np.ndarray,
        *,
        lego: Callable[[TensorId], GF2] = lambda node: Legos.enconding_tensor_512,
        coset_error: Optional[GF2] = None,
        truncate_length: Optional[int] = None,
    ):
        """Creates a square compass code based on the coloring.

        Uses the dual doubled surface code equivalence described by Cao & Lackey in the expansion pack paper.
        """
        # See d3_compass_code_numbering.png for numbering - for an (r,c) qubit in the compass code,
        # the (2r, 2c) is the coordinate of the lego in the dual surface code.
        d = len(coloring) + 1
        super().__init__(d=d, lego=lego, truncate_length=truncate_length)
        gauge_idxs = [
            (r, c) for r in range(1, 2 * d - 1, 2) for c in range(1, 2 * d - 1, 2)
        ]
        for tensor_id, color in zip(gauge_idxs, np.reshape(coloring, (d - 1) ** 2)):
            self.nodes[tensor_id] = self.nodes[tensor_id].trace_with_stopper(
                PAULI_Z if color == 2 else PAULI_X, 4
            )

        self._q_to_node = [(2 * r, 2 * c) for c in range(d) for r in range(d)]
        self.n = d * d
        self.coloring = coloring

        self.set_coset(
            coset_error if coset_error is not None else GF2.Zeros(2 * self.n)
        )
