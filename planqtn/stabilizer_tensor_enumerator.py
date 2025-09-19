"""Stabilizer tensor enumerator module.

The unit of the tensor network is a stabilizer code encoding tensor (quantum lego), represented by
the `StabilizerCodeTensorEnumerator` defined by a parity check matrix.

The main methods are:
- `stabilizer_enumerator_polynomial`: Brute force calculation of the stabilizer enumerator
    polynomial for the stabilizer code.
- `trace_with_stopper`: Traces the lego leg with a stopper.
- `conjoin`: Conjoins two lego pieces into a new lego piece.
- `with_coset_flipped_legs`: Adds coset flipped legs to the lego piece.
- `tensor_with`: Tensor product of two lego pieces.
"""

from collections import defaultdict
from typing import Any, Iterable, List, Optional, Sequence, Tuple, Union, Dict

import numpy as np
import sympy

from galois import GF2
from planqtn.legos import LegoAnnotation
from planqtn.linalg import gauss, rank
from planqtn.parity_check import conjoin, self_trace, tensor_product
from planqtn.progress_reporter import DummyProgressReporter, ProgressReporter
from planqtn.poly import UnivariatePoly
from planqtn.symplectic import omega, sslice, weight, sympl_to_pauli_repr


TensorId = str | int | Tuple[int, int] | Tuple[str, int, int]
"""The tensor id can be a string, an integer, or a tuple of two integers."""

TensorLeg = Tuple[TensorId, int]
"""The tensor leg is a tuple of a tensor id and a leg index."""

TensorEnumeratorKey = Tuple[int, ...]
"""The tensor enumerator key is a tuple of integers."""

TensorEnumerator = Dict[TensorEnumeratorKey, UnivariatePoly]
"""The tensor enumerator is a dictionary of tuples of integers and univariate polynomials."""


def _index_leg(tensor_id: TensorId, leg: int | TensorLeg) -> TensorLeg:
    return (tensor_id, leg) if isinstance(leg, int) else leg


def _index_legs(
    tensor_id: TensorId, legs: Iterable[int | TensorLeg]
) -> List[TensorLeg]:

    return [_index_leg(tensor_id, leg) for leg in legs]


class _SimpleStabilizerCollector:
    def __init__(
        self,
        coset: GF2,
        open_cols: List[int],
        verbose: bool = False,
        truncate_length: Optional[int] = None,
    ):
        self.coset = coset
        self.tensor_wep = UnivariatePoly()
        self.open_cols = open_cols
        self.verbose = verbose
        self.truncate_length = truncate_length

    # pylint: disable=missing-function-docstring
    def collect(self, stabilizer: GF2) -> None:
        stab_weight = weight(stabilizer + self.coset, skip_indices=self.open_cols)
        if self.truncate_length is not None and stab_weight > self.truncate_length:
            return
        # print(f"simple {stabilizer + self.coset} => {stab_weight}")
        self.tensor_wep.add_inplace(UnivariatePoly({stab_weight: 1}))

    # pylint: disable=missing-function-docstring
    def finalize(self) -> None:
        self.tensor_wep = self.tensor_wep.normalize(verbose=self.verbose)


class _TensorElementCollector:
    def __init__(
        self,
        coset: GF2,
        open_cols: List[int],
        verbose: bool = False,
        progress_reporter: ProgressReporter = DummyProgressReporter(),
        truncate_length: Optional[int] = None,
    ):
        self.coset = coset
        self.simple = len(open_cols) == 0
        self.open_cols = open_cols
        self.verbose = verbose
        self.progress_reporter = progress_reporter
        self.matching_stabilizers: List[GF2] = []
        self.tensor_wep: TensorEnumerator = defaultdict(UnivariatePoly)
        self.truncate_length = truncate_length

    # pylint: disable=missing-function-docstring
    def collect(self, stabilizer: GF2) -> None:
        if (
            self.truncate_length is not None
            and weight(stabilizer + self.coset, skip_indices=self.open_cols)
            > self.truncate_length
        ):
            return
        self.matching_stabilizers.append(stabilizer)

    # pylint: disable=missing-function-docstring
    def finalize(self) -> None:

        for s in self.progress_reporter.iterate(
            iterable=self.matching_stabilizers,
            desc="Collecting stabilizers",
            total_size=len(self.matching_stabilizers),
        ):
            stab_weight = weight(s + self.coset, skip_indices=self.open_cols)
            # print(f"tensor {s + self.coset} => {stab_weight}")
            key = sympl_to_pauli_repr(sslice(s, self.open_cols))
            self.tensor_wep[key].add_inplace(UnivariatePoly({stab_weight: 1}))


class StabilizerCodeTensorEnumerator(Tracable):
    """Tensor enumerator for a stabilizer code."""

    def __init__(
        self,
        h: GF2,
        tensor_id: TensorId = 0,
        legs: Optional[List[TensorLeg]] = None,
        coset_flipped_legs: Optional[List[Tuple[Tuple[Any, int], GF2]]] = None,
        annotation: Optional[LegoAnnotation] = None,
        open_legs: Optional[Tuple[TensorLeg]] = None,
        node_ids: Optional[List[TensorId]] = None,
    ):
        """Construct a stabilizer code tensor enumerator.

        A `StabilizerCodeTensorEnumerator` is basically an object oriented wrapper around
        a parity check matrix. It supports self-tracing, as well as tensor product, and conjoining
        of with other `StabilizerCodeTensorEnumerator` instances. As such, it is the building block
        of tensor networks in the [TensorNetwork][planqtn.tensor_network.TensorNetwork] class.

        The class also supports the enumeration of the scalar stabilizer weight enumerator of the
        code via brute force. There can be legs left open, in which case the weight enumerator
        becomes a tensor weight enumerator. Weight truncation is supported for approximate
        enumeration. Coset support is represented by `coset_flipped_legs`.

        Args:
            h: The parity check matrix.
            tensor_id: The ID of the tensor.
            legs: The legs of the tensor.
            coset_flipped_legs: The coset flipped legs of the tensor.
            annotation: The annotation of the tensor for hints for visualization in PlanqTN Studio.

        Raises:
            AssertionError: If the legs are not valid.
        """
        if open_legs is None:
            open_legs = ()
        self.h = h
        self.annotation = annotation
        if node_ids is None:
            node_ids = [tensor_id]
        self._node_ids = node_ids
        self.tensor_id = tensor_id
        if len(self.h.shape) == 1:
            self.n = self.h.shape[0] // 2
            self.k = self.n - 1
        else:
            self.n = self.h.shape[1] // 2
            self.k = self.n - self.h.shape[0]

        self.legs = (
            [(self.tensor_id, leg) for leg in range(self.n)] if legs is None else legs
        )
        self._open_legs = open_legs
        # print(f"Legs: {self.legs} because n = {self.n}, {self.h.shape}")
        assert (
            len(self.legs) == self.n
        ), f"Number of legs {len(self.legs)} != qubit count {self.n} for h: {self.h}"
        # a dict is a wonky tensor - TODO: rephrase this to proper tensor
        self._stabilizer_enums: Dict[sympy.Tuple, UnivariatePoly] = {}

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

    def copy(self) -> "StabilizerCodeTensorEnumerator":
        return StabilizerCodeTensorEnumerator(
            self.h,
            self.tensor_id,
            self.legs,
            self.coset_flipped_legs,
            self.annotation,
            self.open_legs,
        )

    def __str__(self) -> str:
        return f"TensorEnum({self.tensor_id})"

    def __repr__(self) -> str:
        return f"TensorEnum({self.tensor_id})"

    def set_tensor_id(self, tensor_id: TensorId) -> None:
        """Set the tensor ID and update all legs to use the new ID.

        Updates the tensor_id attribute and modifies all legs that reference
        the old tensor_id to use the new one.

        Args:
            tensor_id: New tensor ID to assign to this tensor.
        """
        for l, leg in enumerate(self.legs):
            if leg[0] == self.tensor_id:
                self.legs[l] = (tensor_id, leg[1])
        self.tensor_id = tensor_id

    def _key(self, e: GF2) -> Tuple[int, ...]:
        return tuple(e.astype(np.uint8).tolist())

    def is_stabilizer(self, op: GF2) -> bool:
        """Check if an operator is a stabilizer of this code.

        Determines whether the given operator commutes with all stabilizers
        of the code by checking if op * omega * h^T = 0.

        Args:
            op: Operator to check (as GF2 vector).

        Returns:
            bool: True if op is a stabilizer, False otherwise.
        """
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

    def _validate_legs(self, legs: List[TensorLeg]) -> List[TensorLeg]:
        return [leg for leg in legs if leg not in self.legs]

    def with_coset_flipped_legs(
        self, coset_flipped_legs: List[Tuple[TensorLeg, GF2]]
    ) -> "StabilizerCodeTensorEnumerator":
        """Create a new tensor enumerator with coset-flipped legs.

        Creates a copy of this tensor enumerator with the specified coset-flipped
        legs. This is used for coset weight enumerator calculations.

        Args:
            coset_flipped_legs: List of (leg, coset_error) pairs specifying
                which legs have coset errors applied.

        Returns:
            StabilizerCodeTensorEnumerator: New tensor enumerator with coset-flipped legs.
        """
        return StabilizerCodeTensorEnumerator(
            self.h,
            self.tensor_id,
            self.legs,
            coset_flipped_legs,
            annotation=self.annotation,
            open_legs=self.open_legs,
        )

    def tensor_with(
        self,
        other: "StabilizerCodeTensorEnumerator",
        progress_reporter: ProgressReporter = DummyProgressReporter(),
        verbose: bool = False,
    ) -> "StabilizerCodeTensorEnumerator":
        """Create the tensor product with another tensor enumerator.

        Computes the tensor product of this tensor with another tensor enumerator.
        The resulting tensor has the combined parity check matrix and all legs
        from both tensors.

        Args:
            other: The other tensor enumerator to tensor with.

        Returns:
            StabilizerCodeTensorEnumerator: The tensor product of the two tensors.
        """
        new_h = tensor_product(self.h, other.h)
        if np.array_equal(new_h, GF2([[0]])):
            return StabilizerCodeTensorEnumerator(
                new_h, tensor_id=self.tensor_id, legs=[]
            )
        return StabilizerCodeTensorEnumerator(
            new_h,
            tensor_id=self.tensor_id,
            legs=self.legs + other.legs,
            open_legs=self.open_legs + other.open_legs,
            node_ids=self.node_ids + other.node_ids,
        )

    @property
    def open_legs(self) -> Tuple[TensorLeg]:
        return self._open_legs

    @open_legs.setter
    def open_legs(self, value: Tuple[TensorLeg]) -> None:
        self._open_legs = value

    @property
    def node_ids(self) -> List[TensorId]:
        return self._node_ids

    def merge_with(
        self,
        other: "StabilizerCodeTensorEnumerator",
        legs1: Sequence[int | TensorLeg],
        legs2: Sequence[int | TensorLeg],
        progress_reporter: ProgressReporter = DummyProgressReporter(),
        verbose: bool = False,
    ) -> "StabilizerCodeTensorEnumerator":
        """Creates a new tensor enumerator by conjoining two of them.

        Creates a new tensor enumerator by contracting the specified legs between
        this tensor and another tensor. The legs of the other tensor will become
        the legs of the new tensor.

        Args:
            other: The other tensor enumerator to conjoin with.
            legs1: Legs from this tensor to contract.
            legs2: Legs from the other tensor to contract.

        Returns:
            StabilizerCodeTensorEnumerator: The conjoined tensor enumerator.
        """
        assert len(legs1) == len(legs2)
        legs1_indexed: List[TensorLeg] = _index_legs(self.tensor_id, legs1)
        legs2_indexed: List[TensorLeg] = _index_legs(other.tensor_id, legs2)

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

        new_open_legs = tuple(
            leg for leg in self.open_legs if leg not in legs1_indexed
        ) + tuple(leg for leg in other.open_legs if leg not in legs2_indexed)

        return StabilizerCodeTensorEnumerator(
            new_h,
            tensor_id=self.tensor_id,
            legs=new_legs,
            open_legs=new_open_legs,
            node_ids=self.node_ids + other.node_ids,
        )

    def _brute_force_stabilizer_enumerator_from_parity(
        self,
        open_legs: Sequence[TensorLeg] = (),
        verbose: bool = False,
        progress_reporter: ProgressReporter = DummyProgressReporter(),
        truncate_length: Optional[int] = None,
    ) -> Union[TensorEnumerator, UnivariatePoly]:

        open_legs = _index_legs(self.tensor_id, open_legs)
        invalid_legs = self._validate_legs(open_legs)
        if len(invalid_legs) > 0:
            raise ValueError(
                f"Can't leave legs open for tensor: {invalid_legs}, they don't exist on node "
                f"{self.tensor_id} with legs:\n{self.legs}"
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

        collector = (
            _SimpleStabilizerCollector(
                coset,
                open_cols,
                verbose,
                truncate_length=truncate_length,
            )
            if open_cols == []
            else _TensorElementCollector(
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
            desc=(
                f"Brute force WEP calc for [[{self.n}, {self.k}]] tensor "
                f"{self.tensor_id} - {r} generators"
            ),
            total_size=2**r,
        ):
            picked_generators = GF2(list(np.binary_repr(i, width=r)), dtype=int)
            if r == 0:
                if i > 0:
                    continue
                stabilizer = GF2.Zeros(self.n * 2)
            else:
                stabilizer = picked_generators @ h_reduced

            collector.collect(stabilizer)
        collector.finalize()
        return collector.tensor_wep

    def stabilizer_enumerator_polynomial(
        self,
        open_legs: Sequence[TensorLeg] = (),
        verbose: bool = False,
        progress_reporter: ProgressReporter = DummyProgressReporter(),
        truncate_length: Optional[int] = None,
    ) -> Union[TensorEnumerator, UnivariatePoly]:
        """Compute the stabilizer enumerator polynomial.

        Note that this is a brute force method, and is not efficient for large codes, use it with
        the [planqtn.progress_reporter.TqdmProgressReporter][] to get time estimates.
        If open_legs is empty, returns the scalar stabilizer enumerator polynomial.
        If open_legs is not empty, returns a sparse tensor with non-zero values on
        the open legs.

        Args:
            open_legs: List of legs to leave open.
            verbose: Whether to print verbose output.
            progress_reporter: Progress reporter to use.
            truncate_length: Maximum weight to truncate the enumerator at.

        Returns:
            wep: The stabilizer weight enumerator polynomial.
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
        """Trace this tensor with a stopper tensor on the specified leg.

        Contracts this tensor with a stopper tensor (representing a measurement
        or boundary condition) on the specified leg.

        Args:
            stopper: The stopper tensor to contract with (as a 1x2 GF2 matrix).
            traced_leg: The leg to contract with the stopper.

        Returns:
            StabilizerCodeTensorEnumerator: New tensor with the stopper contraction applied.
        """
        res = self.merge_with(
            StabilizerCodeTensorEnumerator(stopper, tensor_id="stopper"),
            [traced_leg],
            [0],
        )
        res.annotation = self.annotation
        return res

    def rank(self) -> int:
        """Finds the columns of the parity check matrix corresponding to the open legs.
        Returns the rank of the submatrix formed by those columns.

        Returns:
            int: Rank of the submatrix formed by the columns corresponding to the open legs.
        """
        open_leg_indices = self.get_col_indices(set(self.open_legs))
        open_leg_submatrix = self.h[:, open_leg_indices]
        return rank(open_leg_submatrix)

    def get_col_indices(self, legs: set[TensorLeg]) -> List[int]:
        """Helper method to find the column indices in the parity check matrix
        corresponding to the given legs.

        Args:
            legs (List[str]): List of legs to find indices for.

        Returns:
            List[int]: List of column indices that correspond to the given legs.
        """
        idxs = [i for i, leg in enumerate(self.legs) if leg in legs]
        idxs += [
            i + (self.h.shape[1] // 2) for i, leg in enumerate(self.legs) if leg in legs
        ]
        return idxs
