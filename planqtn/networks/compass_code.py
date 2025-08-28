"""The `compass_code` module.

It contains the `CompassCodeDualSurfaceCodeLayoutTN` class, which implements a tensor network
representation of compass codes using dual surface code layout.
"""

from typing import Callable, Optional
from galois import GF2
import numpy as np
from planqtn.legos import Legos
from planqtn.networks.surface_code import SurfaceCodeTN
from planqtn.stabilizer_tensor_enumerator import StabilizerCodeTensorEnumerator
from planqtn.tensor_network import TensorId, TensorNetwork


class CompassCodeDualSurfaceCodeLayoutTN(SurfaceCodeTN):
    """A tensor network representation of compass codes using dual surface code layout.

    This class implements a compass code using the dual doubled surface code equivalence
    described by Cao & Lackey in the expansion pack paper. The compass code is constructed
    by applying gauge operations to a surface code based on a coloring pattern.

    Args:
        coloring: Array specifying the coloring pattern for the compass code.
        lego: Function that returns the lego tensor for each node.
        coset_error: Optional coset error for weight enumerator calculations.
        truncate_length: Optional maximum weight for truncating enumerators.
    """

    def __init__(
        self,
        coloring: np.ndarray,
        *,
        lego: Callable[[TensorId], GF2] = lambda node: Legos.encoding_tensor_512,
        coset_error: Optional[GF2] = None,
        truncate_length: Optional[int] = None,
    ):
        """Create a square compass code based on the coloring.

        Creates a compass code using the dual doubled surface code equivalence
        described by Cao & Lackey in the expansion pack paper.

        Args:
            coloring: Array specifying the coloring pattern for the compass code.
            lego: Function that returns the lego tensor for each node.
            coset_error: Optional coset error for weight enumerator calculations.
            truncate_length: Optional maximum weight for truncating enumerators.
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
                Legos.stopper_z if color == 2 else Legos.stopper_x, 4
            )

        self._q_to_node = [(2 * r, 2 * c) for c in range(d) for r in range(d)]
        self.n = d * d
        self.coloring = coloring

        self.set_coset(
            coset_error if coset_error is not None else GF2.Zeros(2 * self.n)
        )