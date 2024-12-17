from typing import List
from galois import GF2
import numpy as np


def weight(op: GF2, skip_indices: List[int] = []):
    """Calculate the weight of a symplectic operator."""
    n = len(op) // 2
    x_inds = np.array([i for i in range(n) if i not in skip_indices])
    z_inds = x_inds + n
    return np.count_nonzero(op[x_inds] | op[z_inds])


def symp_to_str(vec, swapxz=False):
    p = ["I", "X", "Z", "Y"]
    if swapxz:
        p = ["I", "Z", "X", "Y"]
    n = len(vec) // 2

    return "".join([p[2 * int(vec[i + n]) + int(vec[i])] for i in range(n)])


def omega(n):
    return GF2(
        np.block(
            [
                [GF2.Zeros((n, n)), GF2.Identity(n)],
                [GF2.Identity(n), GF2.Zeros((n, n))],
            ]
        )
    )
