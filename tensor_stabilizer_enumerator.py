from collections import defaultdict
from typing import List, Dict, Tuple, Union
from galois import GF2
import numpy as np
import sympy

from parity_check import conjoin, self_trace, sprint
from scalar_stabilizer_enumerator import ScalarStabilizerCodeEnumerator
from symplectic import omega, weight

from sympy.abc import w, z

from tensor_legs import TensorLegs

PAULI_X = GF2([1, 0])
PAULI_Z = GF2([0, 1])
PAULI_Y = GF2([1, 1])


def _paulis(n):
    """Yields the length 2*n GF2 symplectic Pauli operators on n qubits."""
    for i in range(2 ** (2 * n)):
        yield GF2(list(np.binary_repr(i, width=2 * n)))


def sslice(op, indices):
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


def _suboperator_matches_on_support(support, op, subop):
    m = len(support)
    n = len(op) // 2
    support = np.array(support)
    return (
        # Xs equal
        np.array_equal(op[support], subop[:m])
        and
        # Zs equal
        np.array_equal(op[support + n], subop[m:])
    )


def _equal_on_support(support, op1, op2):
    n1 = len(op1) // 2
    n2 = len(op2) // 2
    support = np.array(support)
    return (
        # Xs equal
        np.array_equal(op1[support], op2[support])
        and
        # Zs equal
        np.array_equal(op1[support + n1], op2[support + n2])
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

    def self_trace(self, node_idx1, node_idx2, join_legs1, join_legs2):
        self.traces.append((node_idx1, node_idx2, join_legs1, join_legs2))

    def stabilizer_enumerator_polynomial(
        self, legs: List[Tuple[int, int]], e: GF2 = None, eprime: GF2 = None
    ) -> sympy.Poly:
        m = len(legs)
        node_legs = {node: [] for node in range(len(self.nodes))}
        for idx, (node, leg) in enumerate(legs):
            node_legs[node].append((leg, idx))

        # default to the identity
        if e is None:
            e = GF2.Zeros(2 * m)
        if eprime is None:
            eprime = GF2.Zeros(2 * m)
        assert len(e) == m * 2
        assert len(eprime) == m * 2

        wep = sympy.Poly(0, gens=[w, z], domain="ZZ")

        for node_idx1, node_idx2, legs1, legs2 in self.traces:
            traced_legs_with_op_indices1 = node_legs[node_idx1]
            traced_legs1 = [l for l, idx in traced_legs_with_op_indices1]
            e1_indices = [idx for l, idx in traced_legs_with_op_indices1]
            e1 = sslice(e, e1_indices)
            eprime1 = sslice(eprime, e1_indices)

            assert len(e1) == len(eprime1)

            traced_legs_with_op_indices2 = node_legs[node_idx2]
            traced_legs2 = [l for l, idx in traced_legs_with_op_indices2]
            e2_indices = [idx for l, idx in traced_legs_with_op_indices2]
            e2 = sslice(e, e2_indices)
            eprime2 = sslice(eprime, e2_indices)

            assert len(e2) == len(eprime2)

            # print(
            #     f"we have {node_idx1}, {node_idx2} merged on {legs1} and {legs2} and traced node legs: {traced_legs_with_op_indices1}, {traced_legs_with_op_indices2}"
            # )
            # print(
            #     f"For node[{node_idx1}] \n {traced_legs1} \n {e1_indices} \n {e1} \n {eprime1}"
            # )
            # print(
            #     f"For node[{node_idx2}] \n {traced_legs2} \n {e2_indices} \n {e2} \n {eprime2}"
            # )
            t1 = self.nodes[node_idx1]
            t2 = self.nodes[node_idx2]

            for f in _paulis(len(legs1)):
                f_ext1 = sconcat(e1, f)
                f_ext2 = sconcat(e2, f)
                # print(f_ext1, f_ext2)
                fprime_ext1 = f_ext1
                fprime_ext2 = f_ext2
                # for fprime in _paulis(len(legs2)):
                #     fprime_ext1 = sconcat(eprime1, fprime)
                #     fprime_ext2 = sconcat(eprime2, fprime)
                #     # print(fprime, "->", fprime_ext1, fprime_ext2)
                wep1 = t1.stabilizer_enumerator_polynomial(
                    traced_legs1 + legs1, f_ext1, fprime_ext1
                )
                wep2 = t2.stabilizer_enumerator_polynomial(
                    traced_legs2 + legs2, f_ext2, fprime_ext2
                )
                wep += wep1 * wep2
        return wep

    def stabilizer_enumerator(
        self, k, legs: List[Tuple[int, List[int]]], e: GF2 = None, eprime: GF2 = None
    ):
        unnormalized_poly = (
            self.stabilizer_enumerator_polynomial(legs, e, eprime) / 4**k
        ).as_poly()
        coeffs = unnormalized_poly.coeffs()
        z_degrees = [m[0] for m in unnormalized_poly.monoms()]
        return {d: c for d, c in zip(z_degrees, coeffs)}


class PartiallyTracedEnumerator:
    def __init__(
        self, nodes: List[int], tracable_legs: List[Tuple[int, int]], tensor: np.ndarray
    ):
        self.nodes = nodes
        self.tracable_legs = tracable_legs
        self.tensor = tensor

    def stabilizer_enumerator(self, legs: List[Tuple[int, int]], e, eprime):
        filtered_axes = [self.tracable_legs.index(leg) for leg in legs]
        indices = [slice(None) for _ in range(self.tracable_legs)]
        for idx, axis in enumerate(filtered_axes[: len(e)]):
            indices[axis] = int(e[idx])

        for idx, axis in enumerate(filtered_axes[len(e) :]):
            indices[axis] = int(eprime[idx])

        return self.tensor[indices]

    def trace_with(
        self,
        other: "TensorStabilizerCodeEnumerator",
        join_legs1,
        join_legs2,
        traced_legs,
        e: GF2,
        eprime: GF2,
        open_legs1,
        open_legs2,
    ):

        assert len(join_legs1) == len(join_legs2)
        join_length = len(join_legs1)

        t2 = other.stabilizer_enumerator_polynomial(
            traced_legs, e, eprime, join_legs2 + open_legs2
        )

        open_length = len(join_legs1 + open_legs1) + len(join_legs2 + open_legs2)

        wep = defaultdict(lambda: sympy.Poly(0, gens=[w, z], domain="ZZ"))

        join_indices1 = [self.tracable_legs.index(leg) for leg in join_legs1]
        join_indices2 = join_legs2

        kept_indices1 = [
            i for i in range(len(self.tracable_legs)) if i not in join_indices1
        ]
        kept_indices2 = list(range(len(join_legs2), len(join_legs2 + open_legs2)))

        for k1 in self.tensor.keys():
            for k2 in t2.keys():
                if not np.array_equal(
                    sslice(GF2(k1[0]), join_indices1),
                    sslice(GF2(k2[0]), join_indices2),
                ) or not np.array_equal(
                    sslice(GF2(k1[1]), join_indices1),
                    sslice(GF2(k2[1]), join_indices2),
                ):
                    continue

                wep1 = self.tensor[k1]
                wep2 = t2[k2]
                k1 = GF2(k1[0]), GF2(k1[1])
                k2 = GF2(k2[0]), GF2(k2[1])

                # we have to cut off the join legs from both keys and concatenate them

                key = (
                    # e
                    tuple(
                        sconcat(
                            sslice(k1[0], kept_indices1),
                            sslice(k2[0], kept_indices2),
                        ).tolist()
                    ),
                    # eprime
                    tuple(
                        sconcat(
                            sslice(k1[1], kept_indices1),
                            sslice(k2[1], kept_indices2),
                        ).tolist()
                    ),
                )

                wep[key] += wep1 * wep2

        tracable_legs = [(idx, leg) for idx, leg in open_legs1]
        tracable_legs += [(other.idx, leg) for leg in open_legs2]

        return PartiallyTracedEnumerator(
            self.nodes + [other.idx], tracable_legs=tracable_legs, tensor=wep
        )


class TensorStabilizerCodeEnumerator:
    """The tensor enumerator from Cao & Lackey"""

    def __init__(self, h, idx=0):
        self.h = h
        self.idx = idx
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

    def trace_with(
        self,
        other: "TensorStabilizerCodeEnumerator",
        join_legs1,
        join_legs2,
        traced_legs1,
        traced_legs2,
        e1: GF2,
        eprime1: GF2,
        e2: GF2,
        eprime2: GF2,
        open_legs1,
        open_legs2,
    ):

        assert len(join_legs1) == len(join_legs2)
        join_length = len(join_legs1)

        t1 = self.stabilizer_enumerator_polynomial(
            traced_legs1, e1, eprime1, join_legs1 + open_legs1
        )
        t2 = other.stabilizer_enumerator_polynomial(
            traced_legs2, e2, eprime2, join_legs2 + open_legs2
        )

        open_length = len(join_legs1 + open_legs1) + len(join_legs2 + open_legs2)

        wep = defaultdict(lambda: sympy.Poly(0, gens=[w, z], domain="ZZ"))

        for k1 in t1.keys():
            for k2 in t2.keys():
                if not _equal_on_support(
                    list(range(join_length)),
                    GF2(k1[0]),
                    GF2(k2[0]),
                ) or not _equal_on_support(
                    list(range(join_length)),
                    GF2(k1[1]),
                    GF2(k2[1]),
                ):
                    continue

                wep1 = t1[k1]
                wep2 = t2[k2]
                k1 = GF2(k1[0]), GF2(k1[1])
                k2 = GF2(k2[0]), GF2(k2[1])

                # we have to cut off the join legs from both keys and concatenate them

                key = (
                    # e
                    tuple(
                        sconcat(
                            sslice(k1[0], slice(join_length, None)),
                            sslice(k2[0], slice(join_length, None)),
                        ).tolist()
                    ),
                    # eprime
                    tuple(
                        sconcat(
                            sslice(k1[1], slice(join_length, None)),
                            sslice(k2[1], slice(join_length, None)),
                        ).tolist()
                    ),
                )

                wep[key] += wep1 * wep2

        tracable_legs = [(self.idx, leg) for leg in open_legs1]
        tracable_legs += [(other.idx, leg) for leg in open_legs2]

        return PartiallyTracedEnumerator(
            [self.idx, other.idx], tracable_legs=tracable_legs, tensor=wep
        )

    def conjoin(
        self, other, new_indices, legs1, legs2
    ) -> "TensorStabilizerCodeEnumerator":
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
        self, traced_legs: List[int], e=None, eprime=None, open_legs=[]
    ):
        if open_legs is None:
            open_legs = []

        is_diagonal_element = np.array_equal(e, eprime)
        if not is_diagonal_element:
            # check if EE' \prod_J I^(n-m) is a stabilizer

            if not self.is_stabilizer(
                replace_with_op_on_indices(
                    traced_legs, e + eprime, GF2.Zeros(self.n * 2)
                )
            ):
                return 0

        class SimpleStabilizerCollector:
            def __init__(self, k, n):
                self.k = k
                self.n = n
                self.wep = sympy.Poly(0, gens=[w, z], domain="ZZ")
                self.skip_indices = np.concatenate([traced_legs, open_legs])

            def collect(self, stabilizer):
                stab_weight = weight(stabilizer, skip_indices=self.skip_indices)
                self.wep += sympy.Poly(z**stab_weight * w ** (self.n - stab_weight))

            def finalize(self):
                self.wep = (4**self.k * self.wep).simplify()

        class DoubleStabilizerCollector:
            def __init__(self, k, n):
                self.k = k
                self.n = n
                self.simple = len(open_legs) == 0
                self.skip_indices = np.concatenate([traced_legs, open_legs])

                self.matching_stabilizers = []
                self.wep = defaultdict(lambda: sympy.Poly(0, gens=[w, z], domain="ZZ"))

            def collect(self, stabilizer):
                self.matching_stabilizers.append(stabilizer)

            def _scale_one(self, wep):
                return (4**self.k * wep).simplify()

            def finalize(self):
                # complement indices
                tlc = [leg for leg in range(self.n) if leg not in traced_legs]
                olc = [leg for leg in range(self.n) if leg not in open_legs]

                for s1 in self.matching_stabilizers:
                    w1 = weight(s1, tlc)
                    stab_weight = weight(s1, skip_indices=self.skip_indices)
                    for s2 in self.matching_stabilizers:
                        w2 = weight(s1, tlc)
                        if w2 != w1:
                            continue
                        if not _suboperator_matches_on_support(
                            olc, s1, sslice(s2, olc)
                        ):
                            continue
                        self.wep[
                            (
                                tuple(sslice(s1, open_legs).tolist()),
                                tuple(sslice(s2, open_legs).tolist()),
                            )
                        ] += sympy.Poly(z**stab_weight * w ** (self.n - stab_weight))

                for key in self.wep.keys():
                    self.wep[key] = self._scale_one(self.wep[key])

        collector = (
            SimpleStabilizerCollector(self.k, self.n)
            if open_legs == []
            else DoubleStabilizerCollector(self.k, self.n)
        )
        # assuming a full rank parity check
        for i in range(2 ** (self.n - self.k)):
            picked_generators = GF2(
                list(np.binary_repr(i, width=(self.n - self.k))), dtype=int
            )
            stabilizer = picked_generators @ self.h

            if is_diagonal_element and not _suboperator_matches_on_support(
                traced_legs, stabilizer, e
            ):
                # we are only interested in stabilizers that have the diagonal element on indices
                continue
            elif not is_diagonal_element:
                # we want to count stabilizers that one of the off-diagonal components
                # a non-zero count would mean that there is a stabilizer for both
                matching_off_diagonals = (
                    _suboperator_matches_on_support(traced_legs, stabilizer, e)
                    and self.is_stabilizer(
                        replace_with_op_on_indices(traced_legs, eprime, stabilizer)
                    )
                ) or (
                    _suboperator_matches_on_support(traced_legs, stabilizer, eprime)
                    and self.is_stabilizer(
                        replace_with_op_on_indices(traced_legs, e, stabilizer)
                    )
                )
                if not matching_off_diagonals:
                    continue
            collector.collect(stabilizer)
        collector.finalize()
        return collector.wep

    def stabilizer_enumerator_polynomial(
        self, traced_legs: List[int], e: GF2 = None, eprime: GF2 = None, open_legs=[]
    ):
        """Stabilizer enumerator polynomial."""
        m = len(traced_legs)
        if e is None:
            e = GF2.Zeros(2 * m)
        if eprime is None:
            eprime = e.copy()
        assert len(e) == m * 2, f"{len(e)} != {m*2}"
        assert len(eprime) == m * 2, f"{len(eprime)} != {m*2}"

        wep = self._brute_force_stabilizer_enumerator_from_parity(
            traced_legs, e, eprime, open_legs=open_legs
        )
        return wep

    def stabilizer_enumerator(
        self, legs: List[int], e: GF2 = None, eprime: GF2 = None, open_legs=[]
    ):
        if open_legs is not None and len(open_legs) > 0:
            raise ValueError("only polynomials are allowed with open legs.")
        unnormalized_poly = (
            self.stabilizer_enumerator_polynomial(
                legs,
                e,
                eprime,
                open_legs=open_legs,
            )
            / 4**self.k
        ).as_poly()
        coeffs = unnormalized_poly.coeffs()
        z_degrees = [m[0] for m in unnormalized_poly.monoms()]
        return {d: c for d, c in zip(z_degrees, coeffs)}

    def trace_with_stopper(self, stopper: GF2, leg: int):
        kept_cols = list(range(2 * self.n))
        kept_cols.remove(leg)
        kept_cols.remove(leg + self.n)
        kept_cols = np.array(kept_cols)
        h_new = GF2(
            [
                row[kept_cols]
                for row in self.h
                if _suboperator_matches_on_support([leg], row, stopper)
            ]
        )
        return TensorStabilizerCodeEnumerator(h_new)
