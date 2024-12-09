import galois
import numpy as np


def weight(op: galois.GF2):
    """Calculate the weight of a symplectic operator."""
    n = len(op) // 2
    return np.count_nonzero(op[:n] | op[n:])
