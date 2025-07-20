from collections import defaultdict
from typing import Any, Iterable, List, Optional, Tuple, Union, Dict

import numpy as np
import sympy

from galois import GF2
from tqdm import tqdm
from planqtn.legos import LegoAnnotation
from planqtn.linalg import gauss
from planqtn.parity_check import conjoin, self_trace, tensor_product
from planqtn.progress_reporter import DummyProgressReporter, ProgressReporter
from planqtn.simple_poly import SimplePoly
from planqtn.symplectic import omega, sslice, weight


TensorLeg = Tuple[str, int]
TensorEnumerator = Dict[Tuple[GF2, ...], SimplePoly]


def is_tensor_leg(leg: int | TensorLeg) -> bool:
    return (
        isinstance(leg, tuple)
        and len(leg) == 2
        and isinstance(leg[0], str)
        and isinstance(leg[1], int)
    )


def _index_leg(idx: str, leg: int | TensorLeg) -> TensorLeg:
    return (idx, leg) if isinstance(leg, int) else leg


def _index_legs(idx: str, legs: Iterable[int | TensorLeg]) -> List[TensorLeg]:

    return [_index_leg(idx, leg) for leg in legs]


class SimpleStabilizerCollector:
    def __init__(
        self,
        k: int,
        n: int,
        coset: GF2,
        open_cols: List[int],
        verbose: bool = False,
        truncate_length: Optional[int] = None,
    ):
        self.k = k
        self.n = n
        self.coset = coset
        self.tensor_wep = SimplePoly()
        self.skip_indices = open_cols
        self.verbose = verbose
        self.truncate_length = truncate_length

    def collect(self, stabilizer: GF2) -> None:
        stab_weight = weight(stabilizer + self.coset, skip_indices=self.skip_indices)
        if self.truncate_length is not None and stab_weight > self.truncate_length:
            return
        # print(f"simple {stabilizer + self.coset} => {stab_weight}")
        self.tensor_wep.add_inplace(SimplePoly({stab_weight: 1}))

    def finalize(self) -> None:
        self.tensor_wep = self.tensor_wep.normalize(verbose=self.verbose)


class TensorElementCollector:
    def __init__(
        self,
        k: int,
        n: int,
        coset: GF2,
        open_cols: List[int],
        verbose: bool = False,
        progress_reporter: ProgressReporter = DummyProgressReporter(),
        truncate_length: Optional[int] = None,
    ):
        self.k = k
        self.n = n
        self.coset = coset
        self.simple = len(open_cols) == 0
        self.skip_indices = open_cols
        self.verbose = verbose
        self.progress_reporter = progress_reporter
        self.matching_stabilizers: List[GF2] = []
        self.tensor_wep: TensorEnumerator = defaultdict(lambda: SimplePoly())
        self.truncate_length = truncate_length

    def collect(self, stabilizer: GF2) -> None:
        if (
            self.truncate_length is not None
            and weight(stabilizer + self.coset, skip_indices=self.skip_indices)
            > self.truncate_length
        ):
            return
        self.matching_stabilizers.append(stabilizer)

    def finalize(self) -> None:

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
        h: GF2,
        idx: str = "0",
        legs: Optional[List[TensorLeg]] = None,
        coset_flipped_legs: Optional[List[Tuple[Tuple[Any, int], GF2]]] = None,
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
        ), f"Number of legs {len(self.legs)} != qubit count {self.n} for h: {self.h}"
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

    def __str__(self) -> str:
        return f"TensorEnum({self.idx})"

    def __repr__(self) -> str:
        return f"TensorEnum({self.idx})"

    def set_idx(self, idx: str) -> None:
        for l in range(len(self.legs)):
            if self.legs[l][0] == self.idx:
                self.legs[l] = (idx, self.legs[l][1])
        self.idx = idx

    def _key(self, e: GF2) -> Tuple[int, ...]:
        return tuple(e.astype(np.uint8).tolist())

    def is_stabilizer(self, op: GF2) -> bool:
        return 0 == np.count_nonzero(op @ omega(self.n) @ self.h.T)

    def _remove_leg(self, legs: Dict[TensorLeg, int], leg: TensorLeg) -> None:
        pos = legs[leg]
        del legs[leg]
        for k in legs.keys():
            if legs[k] > pos:
                legs[k] -= 1

    def _remove_legs(
        self, legs: Dict[TensorLeg, int], legs_to_remove: List[TensorLeg]
    ) -> None:
        for leg in legs_to_remove:
            self._remove_leg(legs, leg)

    def validate_legs(self, legs: List[TensorLeg]) -> List[TensorLeg]:
        return [leg for leg in legs if not leg in self.legs]

    def with_coset_flipped_legs(
        self, coset_flipped_legs: List[Tuple[TensorLeg, GF2]]
    ) -> "StabilizerCodeTensorEnumerator":

        return StabilizerCodeTensorEnumerator(
            self.h, self.idx, self.legs, coset_flipped_legs
        )

    def tensor_with(
        self, other: "StabilizerCodeTensorEnumerator"
    ) -> "StabilizerCodeTensorEnumerator":
        new_h = tensor_product(self.h, other.h)
        if np.array_equal(new_h, GF2([[0]])):
            return StabilizerCodeTensorEnumerator(new_h, idx=self.idx, legs=[])
        return StabilizerCodeTensorEnumerator(
            new_h, idx=self.idx, legs=self.legs + other.legs
        )

    def self_trace(
        self, legs1: List[int | TensorLeg], legs2: List[int | TensorLeg]
    ) -> "StabilizerCodeTensorEnumerator":
        assert len(legs1) == len(legs2)
        legs1_indexed: List[TensorLeg] = _index_legs(self.idx, legs1)
        legs2_indexed: List[TensorLeg] = _index_legs(self.idx, legs2)
        leg2col = {leg: i for i, leg in enumerate(self.legs)}

        new_h = self.h
        for leg1, leg2 in zip(legs1_indexed, legs2_indexed):
            new_h = self_trace(new_h, leg2col[leg1], leg2col[leg2])
            self._remove_legs(leg2col, [leg1, leg2])

        new_legs = [
            leg
            for leg in self.legs
            if leg not in legs1_indexed and leg not in legs2_indexed
        ]
        return StabilizerCodeTensorEnumerator(new_h, idx=self.idx, legs=new_legs)

    def conjoin(
        self,
        other: "StabilizerCodeTensorEnumerator",
        legs1: List[int | TensorLeg],
        legs2: List[int | TensorLeg],
    ) -> "StabilizerCodeTensorEnumerator":
        """Creates a new brute force tensor enumerator by conjoining two of them.

        The legs of the other will become the legs of the new one.
        """
        if self.idx == other.idx:
            return self.self_trace(legs1, legs2)
        assert len(legs1) == len(legs2)
        legs1_indexed: List[TensorLeg] = _index_legs(self.idx, legs1)
        legs2_indexed: List[TensorLeg] = _index_legs(other.idx, legs2)

        n2 = other.n

        leg2col = {leg: i for i, leg in enumerate(self.legs)}
        # for example 2 3 4 | 2 4 8 will become
        # as legs2_offset = 5
        # {2: 0, 3: 1, 4: 2, 7: 3, 11: 4, 13: 5}
        leg2col.update({leg: len(self.legs) + i for i, leg in enumerate(other.legs)})

        new_h = conjoin(
            self.h,
            other.h,
            self.legs.index(legs1_indexed[0]),
            other.legs.index(legs2_indexed[0]),
        )
        self._remove_legs(leg2col, [legs1_indexed[0], legs2_indexed[0]])

        for leg1, leg2 in zip(legs1_indexed[1:], legs2_indexed[1:]):
            new_h = self_trace(new_h, leg2col[leg1], leg2col[leg2])
            self._remove_legs(leg2col, [leg1, leg2])

        new_legs = [leg for leg in self.legs if leg not in legs1_indexed]
        new_legs += [leg for leg in other.legs if leg not in legs2_indexed]

        return StabilizerCodeTensorEnumerator(new_h, idx=self.idx, legs=new_legs)

    def _brute_force_stabilizer_enumerator_from_parity(
        self,
        open_legs: List[TensorLeg] = [],
        verbose: bool = False,
        progress_reporter: ProgressReporter = DummyProgressReporter(),
        truncate_length: Optional[int] = None,
    ) -> Union[TensorEnumerator, SimplePoly]:

        open_legs = _index_legs(self.idx, open_legs)
        invalid_legs = self.validate_legs(open_legs)
        if len(invalid_legs) > 0:
            raise ValueError(
                f"Can't leave legs open for tensor: {invalid_legs}, they don't exist on node {self.idx} with legs:\n{self.legs}"
            )

        open_cols = [self.legs.index(leg) for leg in open_legs]

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
            SimpleStabilizerCollector(
                self.k,
                self.n,
                coset,
                open_cols,
                verbose,
                truncate_length=truncate_length,
            )
            if open_cols == []
            else TensorElementCollector(
                self.k,
                self.n,
                coset,
                open_cols,
                verbose,
                progress_reporter,
                truncate_length=truncate_length,
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
        open_legs: List[TensorLeg] = [],
        verbose: bool = False,
        progress_reporter: ProgressReporter = DummyProgressReporter(),
        truncate_length: Optional[int] = None,
    ) -> Union[TensorEnumerator, SimplePoly]:
        """Stabilizer enumerator polynomial.

        If open_legs left empty, it gives the scalar stabilizer enumerator polynomial.
        If open_legs is not empty, then the result is a sparse tensor, with non-zero values on the open_legs.
        """
        wep = self._brute_force_stabilizer_enumerator_from_parity(
            open_legs=open_legs,
            verbose=verbose,
            progress_reporter=progress_reporter,
            truncate_length=truncate_length,
        )
        return wep

    def trace_with_stopper(
        self, stopper: GF2, traced_leg: int | TensorLeg
    ) -> "StabilizerCodeTensorEnumerator":
        res = self.conjoin(
            StabilizerCodeTensorEnumerator(GF2([stopper]), idx="stopper"),
            [traced_leg],
            [0],
        )
        res.annotation = self.annotation
        return res
