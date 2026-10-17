"""Searches for transversal and addressable logical gates on code tensors.

[`search_patterns`][planqtn.transversal_search.search_patterns] tries all ways of placing gates
from a short list on groups of legs ("sites") and reports which placements implement logical
gates, e.g. which T/T† patterns of the [[8,3,2]] code give the logical CCZ, or which sets of 7
leg pairs of two [[15,1,3]] codes carry a localized logical CZ (Figure 2c of ChunJun Cao and
Brad Lackey, "Quantum Lego Power-up: Designing Transversal Gates with Tensor Networks",
arXiv:2603.03542 (2026)). For diagonal gates, the phase polynomial of a placement (see
[`planqtn.phase_polynomial`][planqtn.phase_polynomial]) is the sum of the phase polynomials of its
gates, so the search is a vectorized sum over precomputed polynomials and handles millions of
placements. Other Clifford gates are checked one placement at a time.

[`addressable_phase_gates`][planqtn.transversal_search.addressable_phase_gates] turns a global
transversal phase gate into phase gates addressing single logical qubits, supported on a logical X
operator (Proposition 2.7 and Corollary 2.8 of the paper), using the low weight logical operators
of [`logical_pauli_representative`][planqtn.transversal_search.logical_pauli_representative].

Searches are exhaustive within their bounds, so their cost is the number of placements, which is
checked against a limit before starting.

Example:
    Exactly 2 of the 256 T/T† patterns on the [[8,3,2]] code are the logical CCZ:

    ```python
    >>> from planqtn.gates import Gates
    >>> from planqtn.legos import Legos
    >>> cube = SignedStabilizerTensor(Legos.code832_encoding_tensor, tensor_id="c")
    >>> sites = [(v,) for v in range(8)]
    >>> matches = search_patterns(cube, [8, 9, 10], sites, [Gates.T, Gates.T_DAG], Gates.CCZ)
    >>> [" ".join(g.name for g, _ in match.ops) for match in matches]
    ['T T† T† T T† T T T†', 'T† T T T† T T† T† T']

    ```
"""

from itertools import combinations, islice, product
import math
from typing import Dict, Iterator, List, NamedTuple, Optional, Sequence, Tuple

import numpy as np
from numpy.typing import NDArray

from planqtn.gates import Gate, GateAssignment, Gates, LegLike, equal_up_to_phase
from planqtn.phase_polynomial import SupportCoordinates
from planqtn.signed_stabilizer_tensor import (
    SignedStabilizerTensor,
    element_with_bits,
    multiply_paulis,
    signed_rref,
)
from planqtn.tensor import TensorLeg
from planqtn.transversal import (
    DiagonalLogicalAction,
    ExpectedGate,
    LogicalAction,
    logical_action,
)

_CHUNK_ENTRIES = 1 << 22
_NAMED_PHASE_GATES = [Gates.Z, Gates.S, Gates.S_DAG, Gates.T, Gates.T_DAG]


class PatternMatch(NamedTuple):
    """A physical operator that implements a logical gate."""

    ops: GateAssignment
    """The physical operator."""
    action: LogicalAction
    """The logical gate it implements."""


def _patterns(
    num_sites: int, choices: Sequence[Optional[Gate]], weight: Optional[int]
) -> Tuple[int, Iterator[Tuple[int, ...]]]:
    """The number of placements and an iterator over them, as choice indices per site."""
    if weight is None:
        count = len(choices) ** num_sites
        return count, product(range(len(choices)), repeat=num_sites)
    if None not in choices:
        raise ValueError("A weight needs None among the choices, for the identity.")
    identity = choices.index(None)
    active = [i for i, choice in enumerate(choices) if choice is not None]
    count = math.comb(num_sites, weight) * len(active) ** weight

    def generate() -> Iterator[Tuple[int, ...]]:
        for positions in combinations(range(num_sites), weight):
            for picks in product(active, repeat=weight):
                row = [identity] * num_sites
                for position, pick in zip(positions, picks):
                    row[position] = pick
                yield tuple(row)

    return count, generate()


def search_patterns(
    tensor: SignedStabilizerTensor,
    logical_legs: Sequence[LegLike],
    sites: Sequence[Sequence[LegLike]],
    choices: Sequence[Optional[Gate]],
    target: Optional[ExpectedGate] = None,
    weight: Optional[int] = None,
    max_patterns: int = 1 << 20,
) -> List[PatternMatch]:
    """Find the placements of gates on sites that implement logical gates.

    Every site, a group of physical legs, gets one of the choices, a gate on as many qubits as the
    site has legs, or None for the identity.

    Args:
        tensor: The code tensor, a stabilizer state.
        logical_legs: The logical legs.
        sites: Disjoint groups of physical legs.
        choices: The gates to place on each site, None standing for the identity.
        target: Only report placements that implement this logical gate, given like in
            [`equals`][planqtn.transversal.LogicalAction.equals]. By default report all logical
            gates.
        weight: Only try placements with exactly this many non-identity sites.
        max_patterns: The largest number of placements to try.

    Returns:
        The matching placements and their logical gates, in the order they were generated (sites
        in order, choices in order, the first site varying slowest).

    Raises:
        ValueError: If there are too many placements, a choice does not fit a site, or the
            choices are neither all diagonal nor all Clifford.
    """
    count, patterns = _patterns(len(sites), choices, weight)
    if count > max_patterns:
        raise ValueError(f"There are {count} placements, more than {max_patterns}.")
    gates = [choice for choice in choices if choice is not None]
    for site in sites:
        for gate in gates:
            if gate.num_qubits != len(site):
                raise ValueError(f"Gate {gate.name} does not fit the site {site}.")
    if all(gate.is_diagonal for gate in gates):
        matches = _diagonal_search(tensor, logical_legs, sites, choices, patterns)
    elif all(gate.is_clifford for gate in gates):
        matches = []
        for row in patterns:
            ops = _placement(sites, choices, row)
            action = logical_action(tensor, logical_legs, ops, method="clifford")
            if action is not None:
                matches.append(PatternMatch(ops, action))
    else:
        raise ValueError("The choices have to be all diagonal or all Clifford gates.")
    if target is None:
        return matches
    return [match for match in matches if match.action.equals(target)]


def _placement(
    sites: Sequence[Sequence[LegLike]],
    choices: Sequence[Optional[Gate]],
    row: Sequence[int],
) -> GateAssignment:
    ops: GateAssignment = []
    for site, index in zip(sites, row):
        choice = choices[index]
        if choice is not None:
            ops.append((choice, tuple(site)))
    return ops


def _diagonal_search(
    tensor: SignedStabilizerTensor,
    logical_legs: Sequence[LegLike],
    sites: Sequence[Sequence[LegLike]],
    choices: Sequence[Optional[Gate]],
    patterns: Iterator[Tuple[int, ...]],
) -> List[PatternMatch]:
    coordinates = SupportCoordinates(tensor, logical_legs)
    gates = [choice for choice in choices if choice is not None]
    order = math.lcm(*(gate.diagonal_phases()[1] for gate in gates))
    polynomials = [
        [
            (
                {}
                if choice is None
                else coordinates.polynomial([(choice, tuple(site))], order).terms()
            )
            for choice in choices
        ]
        for site in sites
    ]
    monomials = sorted(
        {m for per_site in polynomials for poly in per_site for m in poly if m},
        key=lambda m: (len(m), m),
    )
    column = {m: i for i, m in enumerate(monomials)}
    k = coordinates.num_logical
    obstruction = np.array([max(m) >= k for m in monomials], dtype=bool)
    table = np.zeros((len(sites), len(choices), len(monomials)), dtype=np.int64)
    for s, per_site in enumerate(polynomials):
        for c, poly in enumerate(per_site):
            for m, coefficient in poly.items():
                if m:
                    table[s, c, column[m]] = coefficient
    legs = coordinates.logical_legs
    chunk = max(1, _CHUNK_ENTRIES // max(1, len(monomials)))
    matches = []
    while True:
        rows = np.array(list(islice(patterns, chunk)), dtype=np.int64)
        if len(rows) == 0:
            break
        totals = np.zeros((len(rows), len(monomials)), dtype=np.int64)
        for s in range(len(sites)):
            totals += table[s, rows[:, s]]
        totals %= order
        logical = ~totals[:, obstruction].any(axis=1)
        for row, coefficients in zip(rows[logical], totals[logical]):
            polynomial = {
                tuple(legs[i] for i in m): int(c)
                for m, c in zip(monomials, coefficients)
                if c
            }
            action = DiagonalLogicalAction(legs, None, order, polynomial)
            matches.append(PatternMatch(_placement(sites, choices, row), action))
    return matches


def logical_pauli_representative(
    tensor: SignedStabilizerTensor,
    logical_legs: Sequence[LegLike],
    logical_leg: LegLike,
    pauli: str = "X",
) -> Dict[TensorLeg, str]:
    """Find a low weight physical representative of a logical Pauli operator.

    The representative is the physical part of a stabilizer of the code tensor that is `pauli` on
    `logical_leg` and the identity on the other logical legs. Its weight is reduced greedily with
    the stabilizers of the code, which does not guarantee a minimum weight.

    Args:
        tensor: The code tensor.
        logical_legs: The logical legs.
        logical_leg: The logical leg of the logical operator.
        pauli: One of `X`, `Y` and `Z`.

    Returns:
        The Pauli letters on the physical legs of the representative, skipping identities.

    Raises:
        ValueError: If the logical legs do not define an encoding isometry, or the leg is not
            one of them.
    """
    n = tensor.n
    logical = [tensor.legs.index(tensor.leg(leg)) for leg in logical_legs]
    target_leg = tensor.legs.index(tensor.leg(logical_leg))
    if target_leg not in logical or pauli not in ("X", "Y", "Z"):
        raise ValueError(f"Can't find logical {pauli} on {logical_leg}.")
    logical_cols = logical + [n + i for i in logical]
    by_logical = signed_rref(tensor.xz, tensor.phases, logical_cols)
    k = len(logical)
    if len(by_logical[2]) != 2 * k:
        raise ValueError(
            "The logical legs are not maximally entangled with the rest of the tensor, "
            "so they do not define an encoding isometry."
        )
    position = logical.index(target_leg)
    target = np.zeros(2 * k, dtype=np.uint8)
    target[position] = pauli in "XY"
    target[k + position] = pauli in "ZY"
    element = element_with_bits(by_logical, logical_cols, target)
    assert element is not None, "every logical Pauli has a matching stabilizer"
    physical = [i for i in range(n) if i not in set(logical)]
    bits = element[0]

    def weight(v: NDArray[np.uint8]) -> int:
        return int(np.count_nonzero(v[physical] | v[[n + i for i in physical]]))

    num_logical_rows = 2 * k
    stabilizers = by_logical[0][num_logical_rows:]
    improved = True
    while improved:
        improved = False
        for s in stabilizers:
            candidate, _ = multiply_paulis(bits, 0, s, 0)
            if weight(candidate) < weight(bits):
                bits, improved = candidate, True
    labels = "IXZY"
    return {
        tensor.legs[i]: labels[int(bits[i]) + 2 * int(bits[n + i])]
        for i in physical
        if bits[i] or bits[n + i]
    }


def addressable_phase_gates(
    tensor: SignedStabilizerTensor,
    logical_legs: Sequence[LegLike],
    ops: GateAssignment,
) -> Dict[TensorLeg, PatternMatch]:
    """Derive phase gates addressing single logical qubits from a transversal phase gate.

    If single qubit phase gates `G_j` on the physical legs implement a logical gate, and `X̄_i` is
    a logical X operator of the `i`-th logical qubit, then `X̄_i O X̄_i O^dagger` is a logical
    gate that only acts on the `i`-th logical qubit. It is `(G_j^dagger)^2` (up to a phase) on
    the legs where `X̄_i` has an X or Y, and the identity elsewhere (Proposition 2.7 of the paper).
    For example, a bitwise T gate gives addressable S gates (Corollary 2.8).

    Args:
        tensor: The code tensor.
        logical_legs: The logical legs.
        ops: Single qubit diagonal gates on physical legs that implement a logical gate.

    Returns:
        For each logical leg, the addressable operator and its logical gate, verified with
        [`logical_action`][planqtn.transversal.logical_action].

    Raises:
        ValueError: If the gates are not single qubit diagonal gates, or they don't implement a
            logical gate.
    """
    if any(gate.num_qubits != 1 or not gate.is_diagonal for gate, _ in ops):
        raise ValueError("The operator has to consist of single qubit diagonal gates.")
    if logical_action(tensor, logical_legs, ops, method="diagonal") is None:
        raise ValueError("The operator does not implement a logical gate.")
    gate_on = {tensor.leg(legs[0]): gate for gate, legs in ops}
    result = {}
    for leg in logical_legs:
        representative = logical_pauli_representative(tensor, logical_legs, leg, "X")
        addressable: GateAssignment = []
        for physical_leg, letter in representative.items():
            gate = gate_on.get(physical_leg)
            if gate is None or letter == "Z":
                continue
            squared = gate.dagger().matrix @ gate.dagger().matrix
            name = next(
                (
                    g.name
                    for g in _NAMED_PHASE_GATES
                    if equal_up_to_phase(squared, g.matrix)
                ),
                f"({gate.dagger().name})²",
            )
            if not equal_up_to_phase(squared, Gates.I.matrix):
                addressable.append((Gate(name, squared), (physical_leg,)))
        action = logical_action(tensor, logical_legs, addressable, method="diagonal")
        assert action is not None, "Proposition 2.7 gives a logical gate"
        result[tensor.leg(leg)] = PatternMatch(addressable, action)
    return result
