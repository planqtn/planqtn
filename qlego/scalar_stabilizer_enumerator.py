from collections import defaultdict
from concurrent.futures import Future, ProcessPoolExecutor
from typing import List, Union
from galois import GF2
import numpy as np
import sympy
from tqdm import tqdm
from qlego.simple_poly import SimplePoly
from qlego.symplectic import weight
from sympy.abc import w, z
from tqdm.contrib.concurrent import thread_map


class ScalarStabilizerCodeEnumerator:
    """Binary simplectic weight enumerator"""

    def __init__(self, h):
        self.h = h
        self.n = self.h.shape[1] // 2  # Number of qubits
        self.k = self.n - self.h.shape[0]
        self._stabilizer_enum: SimplePoly = None

    def _partial_wep(self, iterable):
        wep = SimplePoly()
        for i in tqdm(iterable, leave=False):
            picked_generators = GF2(
                list(np.binary_repr(i, width=(self.n - self.k))), dtype=int
            )
            wep.add_inplace(SimplePoly({weight(picked_generators @ self.h): 1}))
        return wep

    def stabilizer_enumerator_polynomial(self, num_workers=1):
        if self._stabilizer_enum is None:
            self._stabilizer_enum = SimplePoly()
            # assuming a full rank parity check
            if num_workers > 1:
                ranges = [
                    range(w, 2 ** (self.n - self.k), num_workers)
                    for w in range(num_workers)
                ]
                weps: List[Future] = []
                with ProcessPoolExecutor(max_workers=num_workers) as ex:
                    for r in ranges:
                        weps.append(ex.submit(self._partial_wep, r))
                self._stabilizer_enum = SimplePoly()
                for w in weps:
                    self._stabilizer_enum.add_inplace(w.result())
                self._stabilizer_enum *= 4**self.k

                return self._stabilizer_enum
            else:
                for i in tqdm(range(2 ** (self.n - self.k))):
                    picked_generators = GF2(
                        list(np.binary_repr(i, width=(self.n - self.k))), dtype=int
                    )
                    stab_weight = weight(picked_generators @ self.h)
                    self._stabilizer_enum.add_inplace(SimplePoly({stab_weight: 1}))
            self._stabilizer_enum *= 4**self.k

        return self._stabilizer_enum

    def stabilizer_enumerator(self, num_workers=1):
        unnormalized_poly = (
            self.stabilizer_enumerator_polynomial(num_workers=num_workers) / 4**self.k
        )
        return unnormalized_poly._dict

    def normalizer_enumerator_polynomial(self, num_workers=1):
        return (
            self.stabilizer_enumerator_polynomial(num_workers=num_workers)
            ._homogenize(self.n)
            ._to_sympy([z, w])
            .subs({w: (w + 3 * z) / 2, z: (w - z) / 2})
        )

    def normalizer_enumerator(self, num_workers=1):
        unnormalized_poly = (
            self.normalizer_enumerator_polynomial(num_workers=num_workers) / 2**self.k
        ).as_poly()
        coeffs = unnormalized_poly.coeffs()
        z_degrees = [m[0] for m in unnormalized_poly.monoms()]
        return {d: c for d, c in zip(z_degrees, coeffs)}
