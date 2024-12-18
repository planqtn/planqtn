from typing import List, Dict, Tuple
from galois import GF2
import numpy as np
import sympy

from parity_check import conjoin, self_trace, sprint
from scalar_stabilizer_enumerator import ScalarStabilizerCodeEnumerator
from symplectic import omega, weight

from sympy.abc import w, z

from tensor_legs import TensorLegs


def _paulis(n):
    for i in range(4 * 2**n):
        yield GF2(list(np.binary_repr(i, width=2 * n)))


def _equal_on_indices(indices, op, e):
    # print(f"Equality check: {op} vs {e} on {self.indices}")
    # print(f"op[J]_X = {op[self.indices]}")
    # print(f"E[J]_X = {e[:self.m]}")

    # print(f"op[J]_Z = {op[self.indices + self.n]}")
    # print(f"E[J]_Z= {e[self.m:]}")
    m = len(indices)
    n = len(op) // 2
    return (
        # Xs equal
        np.array_equal(op[indices], e[:m])
        and
        # Zs equal
        np.array_equal(op[indices + n], e[m:])
    )


def replace_with_op_on_indices(indices, op, target):
    """replaces target's operations with op

    op should have self.m number of qubits, target should have self.n qubits.
    """
    m = len(indices)
    n = len(op) // 2

    res = target.copy()
    res[indices] = op[:m]
    res[np.array(indices) + n] = op[m:]
    return res


def sconcat(op1, op2):
    n1 = len(op1) // 2
    n2 = len(op2) // 2

    return np.concatenate(
        [  # X part
            np.concatenate([op1[:n1], op2[:n2]]),
            # Z part
            np.concatenate([op1[n1:], op2[n2:]]),
        ]
    )


class TensorNetwork:
    def __init__(self, nodes):
        self.nodes = nodes
        self.traces = []

    def self_trace(self, node_idx1, node_idx2, legs1, legs2):
        self.traces.append((node_idx1, node_idx2, legs1, legs2))

    def stabilizer_enumerator_polynomial(self, legs: List[int], e: GF2, eprime: GF2):
        m = len(legs)
        assert len(e) == m * 2
        assert len(eprime) == m * 2

        wep = sympy.Poly(0, gens=[w, z], domain="ZZ")

        for node_idx1, node_idx2, legs1, legs2 in self.traces:
            print(f"we have {node_idx1}, {node_idx2} merged on {legs1} and {legs2}")
            t1 = self.nodes[node_idx1]
            t2 = self.nodes[node_idx2]

            for f in _paulis(len(legs1)):
                f_ext = sconcat(e, f)

                for fprime in _paulis(len(legs2)):
                    fprime_ext = sconcat(eprime, fprime)

                    wep += t1.stabilizer_enumerator_polynomial(
                        legs + legs1, f_ext, fprime_ext
                    ) * t2.stabilizer_enumerator_polynomial(legs2, f, fprime)
        return wep

    def stabilizer_enumerator(self, k, legs: List[int], e: GF2, eprime: GF2):
        unnormalized_poly = (
            self.stabilizer_enumerator_polynomial(legs, e, eprime) / 4**k
        ).as_poly()
        coeffs = unnormalized_poly.coeffs()
        z_degrees = [m[0] for m in unnormalized_poly.monoms()]
        return {d: c for d, c in zip(z_degrees, coeffs)}


class TensorStabilizerCodeEnumerator:
    """The tensor enumerator from Cao & Lackey"""

    def __init__(self, h):
        self.h = h

        self.n = self.h.shape[1] // 2  # Number of qubits
        self.k = self.n - self.h.shape[0]
        # a dict is a wonky tensor - TODO: rephrase this to proper tensor
        self._stabilizer_enums: Dict[sympy.Tuple, sympy.Poly] = {}

    def _key(self, e, eprime):

        return (
            tuple(e.astype(np.uint8).tolist()),
            tuple(eprime.astype(np.uint8).tolist()),
        )

    def is_stabilizer(self, op):
        return 0 == np.count_nonzero(op @ omega(self.n) @ self.h.T)

    def _remove_leg(self, legs, leg):
        print(f"remove leg, {leg} from {legs}")
        del legs[leg]
        for k in legs.keys():
            if k > leg:
                legs[k] -= 1

    def _remove_legs(self, legs, legs_to_remove):
        for leg in legs_to_remove:
            self._remove_leg(legs, leg)

    def conjoin(self, other, new_indices, legs1, legs2):
        assert len(legs1) == len(legs2)
        n1 = self.h.shape[1] // 2
        n2 = other.h.shape[1] // 2
        legs = {i: i for i in range(n1)}
        legs.update({i + n1: i + n1 for i in range(n2)})
        new_h = conjoin(self.h, other.h, legs1[0], legs2[0])
        self._remove_legs(legs, [legs1[0], n1 + legs2[0]])

        for idx1, idx2 in zip(legs1[1:], legs2[1:]):
            new_h = self_trace(new_h, legs[idx1], legs[idx2 + n1])
            self._remove_legs(legs, [idx1, idx2 + n1])

        return TensorStabilizerCodeEnumerator(new_h)

    def _brute_force_stabilizer_enumerator_from_parity(
        self, legs: List[int], e, eprime
    ):

        is_diagonal_element = np.array_equal(e, eprime)
        if not is_diagonal_element:
            # check if EE' \prod_J I^(n-m) is a stabilizer

            if not self.is_stabilizer(
                replace_with_op_on_indices(legs, e + eprime, GF2.Zeros(self.n * 2))
            ):
                return 0

        wep = sympy.Poly(0, gens=[w, z], domain="ZZ")
        # assuming a full rank parity check
        for i in range(2 ** (self.n - self.k)):
            picked_generators = GF2(
                list(np.binary_repr(i, width=(self.n - self.k))), dtype=int
            )
            stabilizer = picked_generators @ self.h

            if is_diagonal_element and not _equal_on_indices(legs, stabilizer, e):
                # we are only interested in stabilizers that have the diagonal element on indices
                continue
            elif not is_diagonal_element:
                # we want to count stabilizers that one of the off-diagonal components
                # a non-zero count would mean that there is a stabilizer for both
                matching_off_diagonals = (
                    _equal_on_indices(legs, stabilizer, e)
                    and self.is_stabilizer(
                        replace_with_op_on_indices(legs, eprime, stabilizer)
                    )
                ) or (
                    _equal_on_indices(legs, stabilizer, eprime)
                    and self.is_stabilizer(
                        replace_with_op_on_indices(legs, e, stabilizer)
                    )
                )
                if not matching_off_diagonals:
                    continue

            stab_weight = weight(stabilizer, skip_indices=legs)
            # print(stabilizer, stab_weight)
            wep += sympy.Poly(z**stab_weight * w ** (self.n - stab_weight))

        wep *= 4**self.k
        wep = wep.simplify()
        return wep

    def stabilizer_enumerator_polynomial(self, legs: List[int], e: GF2, eprime: GF2):
        """Stabilizer enumerator polynomial."""
        m = len(legs)
        assert len(e) == m * 2
        assert len(eprime) == m * 2

        wep = self._brute_force_stabilizer_enumerator_from_parity(
            np.array(legs), e, eprime
        )
        return wep

    def stabilizer_enumerator(self, legs: List[int], e: GF2, eprime: GF2):
        unnormalized_poly = (
            self.stabilizer_enumerator_polynomial(legs, e, eprime) / 4**self.k
        ).as_poly()
        coeffs = unnormalized_poly.coeffs()
        z_degrees = [m[0] for m in unnormalized_poly.monoms()]
        return {d: c for d, c in zip(z_degrees, coeffs)}
