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


class CompassCodeConcatenateAndSparsifyTN(TensorNetwork):
    """A tensor network representation of compass codes using concatenate and sparsify method.

    This class implements a compass code using a concatenate and sparsify method described by
    Cao & Lackey in the following paper. The compass code is constructed by applying
    non-isometric tensors to "carve out" the desired stabilizers starting from a
    Bacon-Shor code.

    Cao, C., & Lackey, B. (2025). Growing sparse quantum codes from a seed.
    arXiv. https://arxiv.org/abs/2507.13496
    """

    def __init__(
        self, coloring, *, coset_error: GF2 = None, truncate_length: int = None
    ):
        """Create a square compass code based on the coloring using the concatenate
        and sparsity method.

        Args:
            coloring: Array specifying the coloring pattern for the compass code.
            coset_error: Optional coset error for weight enumerator calculations.
            truncate_length: Optional maximum weight for truncating enumerators.
        """
        d = len(coloring) + 1
        nodes = {}
        attachments = {}

        # Start with the base layer of Z and X repetition codes which forms the Bacon-Shor code
        nodes[(0, 0)] = StabilizerCodeTensorEnumerator(
            Legos.x_rep_code(d + 1), tensor_id=(0, 0)
        )

        for c in range(d):
            nodes[(1, c)] = StabilizerCodeTensorEnumerator(
                Legos.z_rep_code(d + 1), tensor_id=(1, c)
            )
            for leg in range(d):
                attachments[(leg, c)] = ((1, c), leg)

        nodes[(0, 0)] = nodes[(0, 0)].trace_with_stopper(Legos.stopper_i, d)

        connections_to_trace = set()
        trace_with_stopper = set()

        # Iterate over each column to apply non-isometries based on the coloring
        for col in range(len(coloring[0])):
            # Skip this column if there are no stabilizers to carve out
            if not any(coloring[row][col] == 1 for row in range(len(coloring))):
                continue

            row = 0
            while row < len(coloring):
                if coloring[row][col] == 2:
                    start_row = row
                    while row + 1 < len(coloring) and coloring[row + 1][col] == 2:
                        row += 1
                    end_row = row + 1
                    block_size = end_row - start_row + 1
                    last_zero_row = start_row - 1
                    next_one = next(
                        (
                            r
                            for r in range(end_row + 1, len(coloring))
                            if coloring[r][col] == 1
                        ),
                        len(coloring) + 1,
                    )

                    gap_above = max(0, start_row - (last_zero_row + 1))
                    gap_below = max(0, next_one - end_row - 1)
                    if gap_above <= gap_below:
                        # Merge upward (use rows from start_row to end_row)
                        z_merge_key = ("z_merge", start_row, col)
                        nodes[z_merge_key] = StabilizerCodeTensorEnumerator(
                            Legos.z_rep_code(block_size), tensor_id=z_merge_key
                        )

                        for offset, j in enumerate(range(start_row, end_row + 1)):
                            self._make_non_isometric_tensor(nodes, j, col)
                            self._connect_non_isometric_tensor(
                                j,
                                col,
                                z_merge_key,
                                offset,
                                attachments,
                                connections_to_trace,
                            )

                    else:
                        extra_rows = next_one - (end_row + 1)
                        z_merge_key = ("z_merge", end_row + 1, col)
                        nodes[z_merge_key] = StabilizerCodeTensorEnumerator(
                            Legos.z_rep_code(extra_rows), tensor_id=z_merge_key
                        )

                        for offset, j in enumerate(range(end_row + 1, col)):
                            self._make_non_isometric_tensor(nodes, j, col)
                            self._connect_non_isometric_tensor(
                                j,
                                col,
                                z_merge_key,
                                offset,
                                attachments,
                                connections_to_trace,
                            )

                row += 1

            top_rows, bottom_rows = [], []

            # Find contiguous top block of 1s
            row = 0
            while row < len(coloring) and coloring[row][col] == 1:
                top_rows.append(row)
                row += 1

            # Find contiguous bottom block of 1s
            row = len(coloring) - 1
            while row >= 0 and coloring[row][col] == 1:
                bottom_rows.append(row + 1)
                row -= 1

            bottom_rows = list(reversed(bottom_rows))  # ensure increasing order

            # Avoid duplication if full column is 1s
            full_column_ones = len(top_rows) + len(bottom_rows) > len(coloring)
            if full_column_ones:
                # Only apply from the top to avoid duplication
                bottom_rows = []
                if len(top_rows) > 1:
                    top_rows.append(top_rows[-1] + 1)

            # Apply non-isometry at top rows
            for label, rows in [("top", top_rows), ("bottom", bottom_rows)]:
                for r in rows:
                    print(f"adding non-isometry at col {col}, row {r} {label}")
                    self._make_non_isometric_tensor(nodes, r, col)
                    self._connect_non_isometric_tensor(
                        r, col, None, None, attachments, connections_to_trace
                    )
                    trace_with_stopper.add(("z", r, col))

        super().__init__(nodes, truncate_length=truncate_length)

        for leg in range(d):
            self.self_trace((0, 0), (1, leg), [leg], [d])

        for connection in connections_to_trace:
            self.self_trace(
                connection[0], connection[1], [connection[2]], [connection[3]]
            )

        for node in trace_with_stopper:
            self.nodes[node] = self.nodes[node].trace_with_stopper(Legos.stopper_x, 2)

        self.n = d * d
        self.d = d

        self.attachments = attachments
        self.set_coset(
            coset_error if coset_error is not None else GF2.Zeros(2 * self.n)
        )

    def _connect_non_isometric_tensor(
        self, row, col, z_merge_key, offset, attachments, connections_to_trace
    ):
        connections_to_trace.add((("x1", row, col), ("z", row, col), 0, 1))
        connections_to_trace.add((("z", row, col), ("x2", row, col), 0, 1))

        qubit1, leg1 = attachments[(row, col)]
        qubit2, leg2 = attachments[(row, col + 1)]

        connections_to_trace.add((qubit1, ("x1", row, col), leg1, 2))
        connections_to_trace.add((qubit2, ("x2", row, col), leg2, 2))

        attachments[(row, col)] = (("x1", row, col), 1)
        attachments[(row, col + 1)] = (("x2", row, col), 0)

        if z_merge_key is not None:
            connections_to_trace.add((("z", row, col), z_merge_key, 2, offset))

    def _make_non_isometric_tensor(self, nodes, row, col):
        nodes[("x1", row, col)] = StabilizerCodeTensorEnumerator(
            Legos.x_rep_code(3), tensor_id=("x1", row, col)
        )
        nodes[("z", row, col)] = StabilizerCodeTensorEnumerator(
            Legos.z_rep_code(3), tensor_id=("z", row, col)
        )
        nodes[("x2", row, col)] = StabilizerCodeTensorEnumerator(
            Legos.x_rep_code(3), tensor_id=("x2", row, col)
        )

    def qubit_to_node_and_leg(self, q):
        idx_leg = q % self.d
        idx_node = q // self.d
        node, leg = self.attachments[(idx_leg, idx_node)]
        return node, (node, leg)

    def n_qubits(self):
        return self.n
