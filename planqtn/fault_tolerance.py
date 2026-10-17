"""Fault tolerance related properties of transversal gates.

A transversal gate is fault-tolerant when a single fault can only cause errors that the code
corrects. For a depth one circuit of gates, a fault on a qubit, or in the gate acting on it, can
spread to all the qubits of that gate.
[`analyze_transversality`][planqtn.fault_tolerance.analyze_transversality] reports, for a
partition of the physical legs into blocks:

- whether the operator is strongly transversal (the same gate on every column of legs across the
  blocks, covering all of them) or weakly transversal (every gate acts on at most one leg of each
  block), and whether it is localized (leaves some legs untouched), following Definition 2.4 of
  ChunJun Cao and Brad Lackey, "Quantum Lego Power-up: Designing Transversal Gates with Tensor
  Networks", arXiv:2603.03542 (2026),
- the support of the operator on each block and the largest number of qubits of a block that a
  single gate touches, which bounds how far a single fault spreads within a block,
- given the distances of the blocks, whether every single fault leads to at most `(d - 1) / 2`
  errors in each block, so that each block can correct them independently.

Blocks can be code blocks, e.g. two copies of a code for an interblock gate, or the branches of a
code, e.g. the blocks joined by a GHZ hyperedge. For intrablock gates of codes joined by a GHZ
hyperedge, Lemma 3.16 of the paper uses the branches as blocks, with the distance of the shortened
code in which the traced leg is an extra logical leg;
[`code_distance`][planqtn.fault_tolerance.code_distance] computes such distances for small codes.

Out of scope: this is a check of the error spread of a single fault through the gate layer, not a
full fault tolerance proof. It does not model faulty syndrome extraction, state preparation or
decoding, and it does not cover the arguments of the paper that rely on located (heralded) errors,
like the intrablock gates of the holographic black hole codes in Section 5.1, where errors that a
layer only detects are corrected by an inner layer.

Example:
    The interblock CZ between two Steane codes is fault-tolerant, while the CZs of the intrablock
    CZ of two Steane codes traced together touch both blocks of the code at once:

    ```python
    >>> from planqtn.gates import Gates, bitwise
    >>> from planqtn.legos import Legos
    >>> steane = SignedStabilizerTensor(Legos.steane_code_813_encoding_tensor, tensor_id="s")
    >>> code_distance(steane, [7])
    3
    >>> a, b = [("a", i) for i in range(7)], [("b", i) for i in range(7)]
    >>> report = analyze_transversality(bitwise(Gates.CZ, a, b), {"a": a, "b": b}, {"a": 3, "b": 3})
    >>> report.strongly_transversal, report.max_spread, report.fault_tolerant
    (True, 1, True)
    >>> intrablock = bitwise(Gates.CZ, a[1:], b[1:])
    >>> report = analyze_transversality(intrablock, {"code": a[1:] + b[1:]}, {"code": 3})
    >>> report.weakly_transversal, report.max_spread, report.fault_tolerant
    (False, 2, False)

    ```
"""

from collections.abc import Hashable
from itertools import combinations, product
import math
from typing import Dict, List, Mapping, NamedTuple, Optional, Sequence

import numpy as np

from planqtn.gates import GateAssignment, LegLike, equal_up_to_phase
from planqtn.signed_stabilizer_tensor import SignedStabilizerTensor, signed_rref
from planqtn.tensor import TensorId, TensorLeg

_CHUNK = 1 << 16


def code_distance(
    tensor: SignedStabilizerTensor,
    logical_legs: Sequence[LegLike],
    max_weight: int = 3,
    max_candidates: int = 1 << 22,
) -> Optional[int]:
    """Compute the distance of the code of an encoding tensor by brute force.

    A Pauli operator on the physical legs is a nontrivial logical operator exactly when it is the
    physical part of a stabilizer of the tensor with a nontrivial logical part. This tries all
    Pauli operators by increasing weight.

    Args:
        tensor: The encoding tensor, a stabilizer state.
        logical_legs: The logical legs, which have to define an encoding isometry.
        max_weight: The largest weight to try.
        max_candidates: The largest number of Pauli operators to try for a single weight.

    Returns:
        The distance, or None if it is larger than `max_weight`.

    Raises:
        ValueError: If the tensor is not a stabilizer state, or there are too many candidates.
    """
    if tensor.rank != tensor.n:
        raise ValueError(f"{tensor} is not a stabilizer state.")
    n = tensor.n
    logical = [tensor.legs.index(tensor.leg(leg)) for leg in logical_legs]
    physical = [i for i in range(n) if i not in set(logical)]
    logical_cols = logical + [n + i for i in logical]
    physical_cols = physical + [n + i for i in physical]
    xz, _, pivots = signed_rref(tensor.xz, tensor.phases, physical_cols)
    x_cols, z_cols = np.array(physical), np.array([n + i for i in physical])
    for weight in range(1, min(max_weight, len(physical)) + 1):
        count = math.comb(len(physical), weight) * 3**weight
        if count > max_candidates:
            raise ValueError(
                f"There are {count} Pauli operators of weight {weight}, more than "
                f"{max_candidates}."
            )
        letters = np.array(list(product((1, 2, 3), repeat=weight)), dtype=np.int64)
        supports = combinations(range(len(physical)), weight)
        while True:
            chunk = np.array(
                [s for _, s in zip(range(max(1, _CHUNK // len(letters))), supports)],
                dtype=np.int64,
            )
            if len(chunk) == 0:
                break
            candidates = np.zeros((len(chunk), len(letters), 2 * n), dtype=np.uint8)
            rows = np.arange(len(chunk))[:, None]
            columns = np.arange(len(letters))[None, :]
            for j in range(weight):
                candidates[rows, columns, x_cols[chunk[:, j]][:, None]] = (
                    letters[:, j] & 1
                ).astype(np.uint8)[None, :]
                candidates[rows, columns, z_cols[chunk[:, j]][:, None]] = (
                    letters[:, j] >> 1
                ).astype(np.uint8)[None, :]
            flat = candidates.reshape(-1, 2 * n)
            for row, col in pivots:
                flat[flat[:, col] == 1] ^= xz[row]
            in_group = ~flat[:, physical_cols].any(axis=1)
            if (in_group & flat[:, logical_cols].any(axis=1)).any():
                return weight
    return None


class TransversalityReport(NamedTuple):
    """Transversality and error spread of a physical operator with respect to blocks of legs."""

    strongly_transversal: bool
    """The same gate (up to a phase) on every column of legs, one leg from each of the blocks the
    gates act on, covering all legs of those blocks."""
    weakly_transversal: bool
    """Every gate acts on at most one leg of each block."""
    localized: bool
    """Some legs of the blocks are not touched by the operator."""
    support: Dict[Hashable, int]
    """The number of legs of each block that the operator touches."""
    spread: Dict[Hashable, int]
    """For each block, the largest number of its legs that a single gate touches, i.e. how many
    errors a single fault can cause in the block (0 for untouched blocks)."""
    max_spread: int
    """The largest spread over all blocks."""
    fault_tolerant: Optional[bool]
    """Whether a single fault causes at most `(d - 1) // 2` errors in every block of distance `d`,
    or None if the distances were not given."""


def analyze_transversality(
    ops: GateAssignment,
    blocks: Mapping[Hashable, Sequence[LegLike]],
    distances: Optional[Mapping[Hashable, int]] = None,
) -> TransversalityReport:
    """Analyze the transversality and the error spread of a physical operator.

    Args:
        ops: The physical operator, as gates on disjoint legs.
        blocks: Disjoint blocks of physical legs, keyed by a block name. Every leg of the operator
            has to be in a block.
        distances: The distance of each block, to decide fault tolerance.

    Returns:
        The report.

    Raises:
        ValueError: If the blocks overlap, a gate acts on a leg outside the blocks, or a distance
            is missing.
    """
    block_of: Dict[LegLike, Hashable] = {}
    for name, block_legs in blocks.items():
        for leg in block_legs:
            if leg in block_of:
                raise ValueError(f"Leg {leg} is in blocks {block_of[leg]} and {name}.")
            block_of[leg] = name
    support = {name: 0 for name in blocks}
    spread = {name: 0 for name in blocks}
    weakly = True
    columns: List[List[Hashable]] = []
    for gate, legs in ops:
        outside = [leg for leg in legs if leg not in block_of]
        if outside:
            raise ValueError(
                f"Gate {gate.name} acts on legs {outside} outside the blocks."
            )
        names = [block_of[leg] for leg in legs]
        columns.append(names)
        for name in set(names):
            spread[name] = max(spread[name], names.count(name))
        for name in names:
            support[name] += 1
        weakly = weakly and len(set(names)) == len(names)
    touched = {name for names in columns for name in names}
    strongly = (
        bool(ops)
        and weakly
        and all(equal_up_to_phase(g.matrix, ops[0][0].matrix) for g, _ in ops)
        and all(set(names) == touched for names in columns)
        and all(support[name] == len(blocks[name]) for name in touched)
    )
    fault_tolerant = None
    if distances is not None:
        missing = [name for name in blocks if name not in distances]
        if missing:
            raise ValueError(f"Missing distances for blocks {missing}.")
        fault_tolerant = all(
            spread[name] <= (distances[name] - 1) // 2 for name in blocks
        )
    return TransversalityReport(
        strongly_transversal=strongly,
        weakly_transversal=weakly,
        localized=any(support[name] < len(blocks[name]) for name in blocks),
        support=support,
        spread=spread,
        max_spread=max(spread.values(), default=0),
        fault_tolerant=fault_tolerant,
    )


def blocks_by_tensor_id(legs: Sequence[TensorLeg]) -> Dict[TensorId, List[TensorLeg]]:
    """Group legs by the id of the tensor (LEGO) they belong to.

    For a tensor network these groups are the branches of the code, e.g. the blocks joined by a
    GHZ hyperedge.

    Args:
        legs: The legs, e.g. the physical legs of a contracted tensor network.

    Returns:
        The legs of each tensor id, in order of first appearance.
    """
    groups: Dict[TensorId, List[TensorLeg]] = {}
    for leg in legs:
        groups.setdefault(leg[0], []).append(leg)
    return groups
