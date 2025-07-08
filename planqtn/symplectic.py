from typing import List
from galois import GF2
import numpy as np


def weight(op: GF2, skip_indices: List[int] = []) -> int:
    """Calculate the weight of a symplectic operator."""
    n = len(op) // 2
    x_inds = np.array([i for i in range(n) if i not in skip_indices])
    z_inds = x_inds + n
    if len(x_inds) == 0 and len(z_inds) == 0:
        return 0
    return np.count_nonzero(op[x_inds] | op[z_inds])


def symp_to_str(vec: GF2, swapxz: bool = False) -> str:
    p = ["I", "X", "Z", "Y"]
    if swapxz:
        p = ["I", "Z", "X", "Y"]
    n = len(vec) // 2

    return "".join([p[2 * int(vec[i + n]) + int(vec[i])] for i in range(n)])


def omega(n: int) -> GF2:
    return GF2(
        np.block(
            [
                [GF2.Zeros((n, n)), GF2.Identity(n)],
                [GF2.Identity(n), GF2.Zeros((n, n))],
            ]
        )
    )


def sslice(op: GF2, indices: List[int] | slice | np.ndarray) -> GF2:
    n = len(op) // 2

    if isinstance(indices, list | np.ndarray):
        if len(indices) == 0:
            return GF2([])
        indices = np.array(indices)
        return GF2(np.concatenate([op[indices], op[indices + n]]))
    elif isinstance(indices, slice):
        x = slice(
            0 if indices.start is None else indices.start,
            n if indices.stop is None else indices.stop,
        )

        z = slice(x.start + n, x.stop + n)
        return GF2(np.concatenate([op[x], op[z]]))


def replace_with_op_on_indices(indices: List[int], op: GF2, target: GF2) -> GF2:
    """replaces target's operations with op

    op should have self.m number of qubits, target should have self.n qubits.
    """
    m = len(indices)
    n = len(op) // 2

    res = target.copy()
    res[indices] = op[:m]
    res[np.array(indices) + n] = op[m:]
    return res


def sconcat(*ops: GF2) -> GF2:
    ns = [len(op) // 2 for op in ops]
    return GF2(
        np.hstack(
            [  # X part
                np.concatenate([op[:n] for n, op in zip(ns, ops)]).astype(np.int8),
                # Z part
                np.concatenate([op[n:] for n, op in zip(ns, ops)]).astype(np.int8),
            ],
        ).astype(np.int8)
    )
