from galois import GF2
import numpy as np
from qlego.legos import Legos
from qlego.codes.surface_code import SurfaceCodeTN
from qlego.tensor_stabilizer_enumerator import PAULI_X, PAULI_Z


class CompassCodeTN(SurfaceCodeTN):
    def __init__(
        self,
        coloring,
        *,
        lego=lambda node: Legos.econding_tensor_512,
        coset_error: GF2 = None,
    ):
        """Creates a square compass code based on the coloring.

        Uses the dual doubled surface code equivalence described by Cao & Lackey in the expansion pack paper.
        """
        # See d3_compass_code_numbering.png for numbering - for an (r,c) qubit in the compass code,
        # the (2r, 2c) is the coordinate of the lego in the dual surface code.
        d = len(coloring) + 1
        super().__init__(d, lego)
        gauge_idxs = [
            (r, c) for r in range(1, 2 * d - 1, 2) for c in range(1, 2 * d - 1, 2)
        ]
        for n, color in zip(gauge_idxs, np.reshape(coloring, (d - 1) ** 2)):
            self.nodes[n] = self.nodes[n].trace_with_stopper(
                PAULI_Z if color == 2 else PAULI_X, 4
            )

        self._q_to_node = [(2 * r, 2 * c) for r in range(d) for c in range(d)]
        self.n = d * d
        self.coloring = coloring
        if coset_error is None:
            coset_error = GF2.Zeros(2 * self.n)
        self.set_coset(coset_error if coset_error is not None else [])
