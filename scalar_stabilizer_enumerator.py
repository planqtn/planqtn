from collections import defaultdict
from typing import Union
from galois import GF2
import numpy as np
import sympy
from symplectic import weight
from sympy.abc import w, z


class ScalarStabilizerCodeEnumerator:
    """Binary simplectic weight enumerator"""

    def __init__(self, h):
        self.h = h
        self.n = self.h.shape[1] // 2  # Number of qubits
        self.k = self.n - self.h.shape[0]
        self._stabilizer_enum: sympy.Poly = None

    @property
    def stabilizer_enumerator_polynomial(self):
        if self._stabilizer_enum is None:
            self._stabilizer_enum = sympy.Poly(0, gens=[w, z], domain="ZZ")
            # assuming a full rank parity check
            for i in range(2 ** (self.n - self.k)):
                picked_generators = GF2(
                    list(np.binary_repr(i, width=(self.n - self.k))), dtype=int
                )
                stab_weight = weight(picked_generators @ self.h)
                self._stabilizer_enum += sympy.Poly(
                    z**stab_weight * w ** (self.n - stab_weight)
                )
            self._stabilizer_enum *= 4**self.k
            self._stabilizer_enum = self._stabilizer_enum.simplify()

        return self._stabilizer_enum

    @property
    def stabilizer_enumerator(self):
        unnormalized_poly = (
            self.stabilizer_enumerator_polynomial / 4**self.k
        ).as_poly()
        coeffs = unnormalized_poly.coeffs()
        z_degrees = [m[0] for m in unnormalized_poly.monoms()]
        return {d: c for d, c in zip(z_degrees, coeffs)}

    @property
    def normalizer_enumerator_polynomial(self):
        return self.stabilizer_enumerator_polynomial.subs(
            {w: (w + 3 * z) / 2, z: (w - z) / 2}
        ).simplify()

    @property
    def normalizer_enumerator(self):
        unnormalized_poly = (
            self.normalizer_enumerator_polynomial / 2**self.k
        ).as_poly()
        coeffs = unnormalized_poly.coeffs()
        z_degrees = [m[0] for m in unnormalized_poly.monoms()]
        return {d: c for d, c in zip(z_degrees, coeffs)}
