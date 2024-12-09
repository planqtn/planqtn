from collections import defaultdict
from galois import GF2
import numpy as np
from symplectic import weight


class BruteForceStabilizerCodeEnumerator:
    """Binary simplectic weight enumerator"""

    def __init__(self, h):
        self.h = h
        self.n = self.h.shape[1] // 2  # Number of qubits
        self.k = self.n - self.h.shape[0]

    def get_stabilizer_enumerator(self):
        if self._stabilizer_enum is None:
            stabilizer_enumerator = defaultdict(int)
            # assuming a full rank parity check
            for i in range(2 ** (self.n - self.k)):
                pick = GF2(list(np.binary_repr(i, width=(self.n - self.k))), dtype=int)
                stabilizer = pick @ self.h
                stabilizer_enumerator[weight(stabilizer)] += 1
                self._stabilizer_enum = stabilizer_enumerator

        return self._stabilizer_enum

    def get_normalizer_enumerator(self):
        raise NotImplementedError("Not yet implemented.")
