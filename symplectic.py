from galois import GF2
import numpy as np


def weight(op: GF2):
    """Calculate the weight of a symplectic operator."""
    n = len(op) // 2
    return np.count_nonzero(op[:n] | op[n:])


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
