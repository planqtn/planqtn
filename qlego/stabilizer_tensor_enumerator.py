from collections import defaultdict
from typing import Any, Iterable, List, Optional, Tuple, Union, Dict

import numpy as np
import sympy

from galois import GF2
from tqdm import tqdm
from qlego.legos import LegoAnnotation
from qlego.linalg import gauss
from qlego.parity_check import conjoin, self_trace, tensor_product
from qlego.progress_reporter import DummyProgressReporter, ProgressReporter
from qlego.simple_poly import SimplePoly
from qlego.symplectic import omega, sslice, weight


def _index_leg(idx, leg):
    return (idx, leg) if isinstance(leg, int) else leg


def _index_legs(idx, legs):
    if legs is not None and isinstance(legs, Iterable):
        return [_index_leg(idx, leg) for leg in legs]
    return legs


TensorEnumerator = Dict[Tuple[GF2, ...], SimplePoly]


class SimpleStabilizerCollector:
    def __init__(
        self,
        k,
        n,
        coset,
        open_cols,
        verbose=False,
    ):
        self.k = k
        self.n = n
        self.coset = coset
        self.tensor_wep = SimplePoly()
        self.skip_indices = open_cols
        self.verbose = verbose

    def collect(self, stabilizer):
        stab_weight = weight(stabilizer + self.coset, skip_indices=self.skip_indices)
        # print(f"simple {stabilizer + self.coset} => {stab_weight}")
        self.tensor_wep.add_inplace(SimplePoly({stab_weight: 1}))

    def finalize(self):
        self.tensor_wep = self.tensor_wep.normalize(verbose=self.verbose)


class TensorElementCollector:
    def __init__(
        self,
        k,
        n,
        coset,
        open_cols,
        verbose=False,
        progress_reporter: ProgressReporter = DummyProgressReporter(),
    ):
        self.k = k
        self.n = n
        self.coset = coset
        self.simple = len(open_cols) == 0
        self.skip_indices = open_cols
        self.verbose = verbose
        self.progress_reporter = progress_reporter
        self.matching_stabilizers = []
        self.tensor_wep: TensorEnumerator = defaultdict(lambda: SimplePoly())

    def collect(self, stabilizer):
        self.matching_stabilizers.append(stabilizer)

    def finalize(self):

        for s in self.progress_reporter.iterate(
            iterable=self.matching_stabilizers,
            desc="Collecting stabilizers",
            total_size=len(self.matching_stabilizers),
        ):
            stab_weight = weight(s + self.coset, skip_indices=self.skip_indices)
            # print(f"tensor {s + self.coset} => {stab_weight}")
            key = tuple(sslice(s, self.skip_indices).tolist())
            self.tensor_wep[key].add_inplace(SimplePoly({stab_weight: 1}))


class StabilizerCodeTensorEnumerator:
    """Tensor enumerator for a stabilizer code.

    Instances of StabilizerCodeTensorEnumerator always have a parity check matrix. It supports self-tracing, as well as
    tensor product, and conjoining of with other StabilizerCodeTensorEnumerators.

    The class also supports the enumeration of the scalar stabilizer weight enumerator of the code via brute force.
    There can be legs left open, in which case the weight enumerator becomes a tensor weight enumerator.
    Weight truncation is supported for approximate enumeration.
    Coset support is represented by coset_flipped_legs.
    """

    def __init__(
        self,
        h,
        idx=0,
        legs=None,
        coset_flipped_legs: List[Tuple[Tuple[Any, int], GF2]] = None,
        truncate_length=None,
        annotation: Optional[LegoAnnotation] = None,
    ):

        self.h = h
        self.annotation = annotation

        self.idx = idx
        if len(self.h.shape) == 1:
            self.n = self.h.shape[0] // 2
            self.k = self.n - 1
        else:
            self.n = self.h.shape[1] // 2
            self.k = self.n - self.h.shape[0]

        self.legs = [(self.idx, leg) for leg in range(self.n)] if legs is None else legs
        # print(f"Legs: {self.legs} because n = {self.n}, {self.h.shape}")
        assert (
            len(self.legs) == self.n
        ), f"Leg number {len(self.legs)} does not match parity check matrix columns (qubit count) {self.n}"
        # a dict is a wonky tensor - TODO: rephrase this to proper tensor
        self._stabilizer_enums: Dict[sympy.Tuple, SimplePoly] = {}

        self.coset_flipped_legs = []
        if coset_flipped_legs is not None:
            self.coset_flipped_legs = coset_flipped_legs
            for leg, pauli in self.coset_flipped_legs:
                assert (
                    leg in self.legs
                ), f"Leg in coset not found: {leg} - legs: {self.legs}"
                assert len(pauli) == 2 and isinstance(
                    pauli, GF2
                ), f"Invalid pauli in coset: {pauli} on leg {leg}"
            # print(f"Coset flipped legs validated. Setting to {self.coset_flipped_legs}")
        self.truncate_length = truncate_length

    def __str__(self):
        return f"TensorEnum({self.idx})"

    def __repr__(self):
        return f"TensorEnum({self.idx})"

    def set_idx(self, idx):
        for l in range(len(self.legs)):
            if self.legs[l][0] == self.idx:
                self.legs[l] = (idx, self.legs[l][1])
        self.idx = idx

    def _key(self, e):
        return tuple(e.astype(np.uint8).tolist())

    def is_stabilizer(self, op):
        return 0 == np.count_nonzero(op @ omega(self.n) @ self.h.T)

    def _remove_leg(self, legs, leg):
        pos = legs[leg]
        del legs[leg]
        for k in legs.keys():
            if legs[k] > pos:
                legs[k] -= 1

    def _remove_legs(self, legs, legs_to_remove):
        for leg in legs_to_remove:
            self._remove_leg(legs, leg)

    def validate_legs(self, legs):
        return [leg for leg in legs if not leg in self.legs]

    def with_coset_flipped_legs(self, coset_flipped_legs):

        return StabilizerCodeTensorEnumerator(
            self.h, self.idx, self.legs, coset_flipped_legs, self.truncate_length
        )

    def tensor_with(self, other):
        new_h = tensor_product(self.h, other.h)
        return StabilizerCodeTensorEnumerator(
            new_h, idx=self.idx, legs=self.legs + other.legs
        )

    def self_trace(self, legs1, legs2) -> "StabilizerCodeTensorEnumerator":
        assert len(legs1) == len(legs2)
        legs1 = _index_legs(self.idx, legs1)
        legs2 = _index_legs(self.idx, legs2)
        leg2col = {leg: i for i, leg in enumerate(self.legs)}

        new_h = self.h
        for leg1, leg2 in zip(legs1, legs2):
            new_h = self_trace(new_h, leg2col[leg1], leg2col[leg2])
            self._remove_legs(leg2col, [leg1, leg2])

        new_legs = [leg for leg in self.legs if leg not in legs1 and leg not in legs2]
        return StabilizerCodeTensorEnumerator(new_h, idx=self.idx, legs=new_legs)

    def conjoin(self, other, legs1, legs2) -> "StabilizerCodeTensorEnumerator":
        """Creates a new brute force tensor enumerator by conjoining two of them.

        The legs of the other will become the legs of the new one.
        """
        if self.idx == other.idx:
            return self.self_trace(legs1, legs2)
        assert len(legs1) == len(legs2)
        legs1 = _index_legs(self.idx, legs1)
        legs2 = _index_legs(other.idx, legs2)

        n2 = other.n

        leg2col = {leg: i for i, leg in enumerate(self.legs)}
        # for example 2 3 4 | 2 4 8 will become
        # as legs2_offset = 5
        # {2: 0, 3: 1, 4: 2, 7: 3, 11: 4, 13: 5}
        leg2col.update({leg: len(self.legs) + i for i, leg in enumerate(other.legs)})

        new_h = conjoin(
            self.h, other.h, self.legs.index(legs1[0]), other.legs.index(legs2[0])
        )
        self._remove_legs(leg2col, [legs1[0], legs2[0]])

        for leg1, leg2 in zip(legs1[1:], legs2[1:]):
            new_h = self_trace(new_h, leg2col[leg1], leg2col[leg2])
            self._remove_legs(leg2col, [leg1, leg2])

        new_legs = [leg for leg in self.legs if leg not in legs1]
        new_legs += [leg for leg in other.legs if leg not in legs2]

        return StabilizerCodeTensorEnumerator(
            new_h, idx=self.idx, legs=new_legs, truncate_length=self.truncate_length
        )

    def _brute_force_stabilizer_enumerator_from_parity(
        self,
        open_legs=[],
        verbose=False,
        progress_reporter: ProgressReporter = DummyProgressReporter(),
    ) -> Union[TensorEnumerator, SimplePoly]:

        open_legs = _index_legs(self.idx, open_legs)
        invalid_legs = self.validate_legs(open_legs)
        if len(invalid_legs) > 0:
            raise ValueError(
                f"Can't leave legs open for tensor: {invalid_legs}, they don't exist on node {self.idx} with legs:\n{self.legs}"
            )

        open_cols = [self.legs.index(leg) for leg in open_legs]

        if open_cols is None:
            open_cols = []

        coset = GF2.Zeros(2 * self.n)
        if self.coset_flipped_legs is not None:
            for leg, pauli in self.coset_flipped_legs:
                assert leg in self.legs, f"Leg in coset not found: {leg}"
                assert len(pauli) == 2 and isinstance(
                    pauli, GF2
                ), f"Invalid pauli in coset: {pauli} on leg {leg}"
                coset[self.legs.index(leg)] = pauli[0]
                coset[self.legs.index(leg) + self.n] = pauli[1]
                # print(
                #     f"brute force - node {self.idx} leg: {leg} index: {self.legs.index(leg)} - {pauli}"
                # )
        collector = (
            SimpleStabilizerCollector(self.k, self.n, coset, open_cols, verbose)
            if open_cols == []
            else TensorElementCollector(
                self.k, self.n, coset, open_cols, verbose, progress_reporter
            )
        )

        h_reduced = gauss(self.h)
        h_reduced = h_reduced[~np.all(h_reduced == 0, axis=1)]
        r = len(h_reduced)

        for i in progress_reporter.iterate(
            iterable=range(2**r),
            desc=f"Brute force WEP calc for [[{self.n}, {self.k}]] tensor {self.idx} - {r} generators",
            total_size=2**r,
        ):
            picked_generators = GF2(list(np.binary_repr(i, width=r)), dtype=int)
            if r == 0:
                if i > 0:
                    continue
                else:
                    stabilizer = GF2.Zeros(self.n * 2)
            else:
                stabilizer = picked_generators @ h_reduced

            collector.collect(stabilizer)
        collector.finalize()
        return collector.tensor_wep

    def stabilizer_enumerator_polynomial(
        self,
        open_legs=[],
        verbose=False,
        progress_reporter: ProgressReporter = DummyProgressReporter(),
    ) -> Union[TensorEnumerator, SimplePoly]:
        """Stabilizer enumerator polynomial.

        If open_legs left empty, it gives the scalar stabilizer enumerator polynomial.
        If open_legs is not empty, then the result is a sparse tensor, with non-zero values on the open_legs.
        """
        wep = self._brute_force_stabilizer_enumerator_from_parity(
            open_legs=open_legs,
            verbose=verbose,
            progress_reporter=progress_reporter,
        )
        return wep

    def scalar_stabilizer_enumerator(self):
        unnormalized_poly = self.stabilizer_enumerator_polynomial(
            open_legs=[],
        )

        return unnormalized_poly._dict

    def trace_with_stopper(self, stopper: GF2, traced_leg: Union[int, Tuple[int, int]]):
        res = self.conjoin(
            StabilizerCodeTensorEnumerator(GF2([stopper]), idx="stopper"),
            [traced_leg],
            [0],
        )
        res.annotation = self.annotation
        return res
