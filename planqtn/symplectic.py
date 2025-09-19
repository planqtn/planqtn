"""Symplectic operations and utilities."""

from typing import TYPE_CHECKING, Any, List, Sequence, Tuple

from galois import GF2
import numpy as np
from numpy.typing import NDArray

from planqtn.linalg import rank
from planqtn.tensor import TensorLeg

if TYPE_CHECKING:
    from planqtn.stabilizer_tensor_enumerator import StabilizerCodeTensorEnumerator


def weight(op: GF2, skip_indices: Sequence[int] = ()) -> int:
    """Calculate the weight of a symplectic operator.

    Args:
        op: The symplectic operator.
        skip_indices: Indices to skip.

    Returns:
        The weight of the symplectic operator.
    """
    n = len(op) // 2
    x_inds = np.array([i for i in range(n) if i not in skip_indices])
    z_inds = x_inds + n
    if len(x_inds) == 0 and len(z_inds) == 0:
        return 0
    return np.count_nonzero(op[x_inds] | op[z_inds])


def symp_to_str(vec: GF2, swapxz: bool = False) -> str:
    """Convert a symplectic operator to a string.

    Args:
        vec: The symplectic operator.
        swapxz: Whether to swap X and Z.

    Returns:
        The string representation of the symplectic operator.
    """
    p = ["I", "X", "Z", "Y"]
    if swapxz:
        p = ["I", "Z", "X", "Y"]
    n = len(vec) // 2

    return "".join([p[2 * int(vec[i + n]) + int(vec[i])] for i in range(n)])


def omega(n: int) -> GF2:
    """Create a symplectic operator for the omega matrix over GF(2).

    For n the omega matrix is:
    [0 `I_n`]
    [`I_n` 0]

    where `I_n` is the n x n identity matrix.

    Args:
        n: The number of qubits.

    Returns:
        The symplectic operator for the omega matrix.
    """
    return GF2(
        np.block(
            [
                [GF2.Zeros((n, n)), GF2.Identity(n)],
                [GF2.Identity(n), GF2.Zeros((n, n))],
            ]
        )
    )


def sympl_to_pauli_repr(op: GF2) -> Tuple[int, ...]:
    """Convert a symplectic operator to a Pauli operator representation.

    Args:
        op: The symplectic operator.

    Returns:
        The Pauli operator representation of the symplectic operator.
    """
    n = len(op) // 2
    return tuple(2 * int(op[i + n]) + int(op[i]) for i in range(n))


def sslice(op: GF2, indices: List[int] | slice | np.ndarray) -> GF2:
    """Slice a symplectic operator.

    Args:
        op: The symplectic operator.
        indices: The indices to slice.

    Returns:
        The sliced symplectic operator.

    Raises:
        ValueError: If the indices are of invalid type (neither list, np.ndarray, or slice).
    """
    n = len(op) // 2

    if isinstance(indices, list | np.ndarray):
        if len(indices) == 0:
            return GF2([])
        indices = np.array(indices)
        return GF2(np.concatenate([op[indices], op[indices + n]]))

    if isinstance(indices, slice):
        x = slice(
            0 if indices.start is None else indices.start,
            n if indices.stop is None else indices.stop,
        )

        z = slice(x.start + n, x.stop + n)
        return GF2(np.concatenate([op[x], op[z]]))

    raise ValueError(f"Invalid indices: {indices}")


def replace_with_op_on_indices(indices: List[int], op: GF2, target: GF2) -> GF2:
    """Replace target symplectic operator's operations with op on the given indices.

    Args:
        indices: Indices to replace on.
        op: The operator to replace with.
        target: The target operator.

    Returns:
        The replaced operator.
    """
    m = len(indices)
    n = len(op) // 2

    res = target.copy()
    res[indices] = op[:m]
    res[np.array(indices) + n] = op[m:]
    return res


def sconcat(*ops: Tuple[int, ...]) -> Tuple[int, ...]:
    """Concatenate symplectic operators.

    Args:
        *ops: The symplectic operators to concatenate.

    Returns:
        The concatenated symplectic operator.
    """
    ns = [len(op) // 2 for op in ops]
    return tuple(
        np.hstack(
            [  # X part
                np.concatenate([op[:n] for n, op in zip(ns, ops)]).astype(np.int8),
                # Z part
                np.concatenate([op[n:] for n, op in zip(ns, ops)]).astype(np.int8),
            ],
        ).astype(np.int8)
    )


def sstr(h: GF2) -> str:
    """Convert a symplectic matrix to a string representation.

    Creates a human-readable string representation of a symplectic matrix
    where X and Z parts are separated by a '|' character. Uses '_' for 0
    and '1' for 1 to make the pattern more visible.

    Args:
        h: Parity check matrix in GF2.

    Returns:
        str: String representation of the matrix.
    """
    n = h.shape[1] // 2

    return "\n".join(
        "".join("_1"[int(b)] for b in row[:n])
        + "|"
        + "".join("_1"[int(b)] for b in row[n:])
        for row in h
    )


def sprint(h: GF2, end: str = "\n") -> None:
    """Print a symplectic matrix in string format.

    Prints the string representation of the symplectic matrix to stdout.

    Args:
        h: Parity check matrix in GF2.
        end: String to append at the end (default: newline).
    """
    print(sstr(h), end=end)


def to_symplectic(matrix: NDArray[Any]) -> NDArray[Any]:
    """Converts a matrix with interleaved X and Z columns to standard symplectic form."""
    # Split into X and Z columns
    X_bits = matrix[:, ::2]
    Z_bits = matrix[:, 1::2]

    # Combine into X|Z form
    return np.hstack([X_bits, Z_bits])


def count_matching_stabilizers_ratio_all_pairs(
    pte1: "StabilizerCodeTensorEnumerator",
    pte2: "StabilizerCodeTensorEnumerator",
    join_legs1: list[TensorLeg],
    join_legs2: list[TensorLeg],
) -> float:
    """
    Compute the ratio of stabilizers that match across all join-leg pairs
    between two PTEs.

    Args:
        pte1, pte2: StabilizerTensorEnumerator instances to calculate ratio for
        join_legs1, join_legs2: lists of legs to join

    Returns:
        float: ratio of matching stabilizer pairs
    """
    M1 = to_symplectic(
        np.hstack(
            [pte1.h[:, pte1.get_col_indices({leg})] for leg in join_legs1]
        ).astype(np.uint8)
        & 1
    )
    M2 = to_symplectic(
        np.hstack(
            [pte2.h[:, pte2.get_col_indices({leg})] for leg in join_legs2]
        ).astype(np.uint8)
        & 1
    )

    stacked = GF2(np.vstack([M1, M2]))
    return float(2 ** (-rank(stacked)))
