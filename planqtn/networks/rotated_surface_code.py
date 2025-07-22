"""The `rotated_surface_code` module.

It contains the `RotatedSurfaceCodeTN` class,which implements a tensor network
representation of rotated surface codes using a configurable lego per qubit,
meaning the [[6,0,3]] or [[5,1,2]], or the [[4,2,2]] lego or their X/Z-only counterparts.
This layout was first published in:

Cao, ChunJun, Michael J. Gullans, Brad Lackey, and Zitao Wang. 2024.
“Quantum Lego Expansion Pack: Enumerators from Tensor Networks.”
PRX Quantum 5 (3): 030313. https://doi.org/10.1103/PRXQuantum.5.030313.
"""

from typing import Callable, Dict, Optional, Tuple
from galois import GF2
from planqtn.tensor_network import TensorNetwork, TensorId, TensorLeg
from planqtn.legos import Legos
from planqtn.tensor_network import StabilizerCodeTensorEnumerator


class RotatedSurfaceCodeTN(TensorNetwork):
    """A tensor network representation of rotated surface codes.

    This class constructs a tensor network for a rotated surface code of distance d.
    The rotated surface code has a checkerboard pattern of X and Z stabilizers,
    with appropriate boundary conditions for the rotated geometry.
    """

    def __init__(
        self,
        d: int,
        lego: Callable[[TensorId], GF2] = lambda i: Legos.encoding_tensor_512,
        coset_error: Optional[GF2] = None,
        truncate_length: Optional[int] = None,
    ):
        """Construct a rotated surface code tensor network.

        Args:
            d: Distance of the surface code.
            lego: Function that returns the lego tensor for each node.
            coset_error: Optional coset error for weight enumerator calculations.
            truncate_length: Optional maximum weight for truncating enumerators.
        """
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
                Legos.stopper_x, 3 if c % 2 == 0 else 0
            )
            # bottom Z boundary (X type checks, Z type logical)
            nodes[(d - 1, c)] = nodes[(d - 1, c)].trace_with_stopper(
                Legos.stopper_x, 1 if c % 2 == 0 else 2
            )

        for r in range(d):
            # left X boundary (Z type checks, X type logical)
            nodes[r, 0] = nodes[(r, 0)].trace_with_stopper(
                Legos.stopper_z, 0 if r % 2 == 0 else 1
            )
            # right X boundary (Z type checks, X type logical)
            nodes[(r, d - 1)] = nodes[(r, d - 1)].trace_with_stopper(
                Legos.stopper_z, 2 if r % 2 == 0 else 3
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
                if 0 < i < radius:
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
                if 0 < i < radius:
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
        """Map a qubit index to its corresponding node and leg.

        The rotated surface code uses column major ordering.

        Args:
            q: Global qubit index.

        Returns:
            Tuple[TensorId, TensorLeg]: Node ID and leg that represent the qubit.
        """
        # col major ordering
        node = (q % self.d, q // self.d)
        return node, (node, 4)

    def n_qubits(self) -> int:
        """Get the total number of qubits in the tensor network.

        Returns:
            int: Total number of qubits represented by this tensor network.
        """
        return self.n
