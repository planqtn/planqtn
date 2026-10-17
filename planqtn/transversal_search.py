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
operator (Proposition 2.7 and Corollary 2.8 of the paper), and
[`addressable_controlled_phase_gates`][\
planqtn.transversal_search.addressable_controlled_phase_gates]
derives addressable phase and interblock controlled phase gates from an interblock controlled
phase gate, e.g. addressable S and CZ gates from a bitwise CS gate (Proposition 2.9 and
Corollary 2.10). Both use the low weight logical operators of
[`logical_pauli_representative`][planqtn.transversal_search.logical_pauli_representative].

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
_NAMED_CONTROLLED_PHASE_GATES = [Gates.CZ, Gates.CS, Gates.CS_DAG]


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


def addressable_controlled_phase_gates(
    tensor: SignedStabilizerTensor,
    logical_pairs: Sequence[Tuple[LegLike, LegLike]],
    ops: GateAssignment,
) -> Dict[Tuple[TensorLeg, TensorLeg], Tuple[PatternMatch, PatternMatch]]:
    """Derive addressable phase and controlled phase gates from an interblock controlled phase.

    The tensor holds two code blocks, e.g. `a.tensor_with(b)`, and `ops` are controlled phase
    gates `CP(φ_j)` between matching physical legs of the blocks that implement a logical gate. If
    `X̄_i` is a Pauli logical X operator of the `i`-th logical qubit of the first block, then
    `(X̄_i ⊗ I) P (X̄_i ⊗ I) P^dagger` and the same with `X̄_i` on the second block combine into
    (Proposition 2.9 of the paper):

    - an addressable phase gate on the `i`-th logical qubit of the first block, made of `P(φ_j)` on
      the legs of the first block where `X̄_i` has an X or Y,
    - an addressable interblock controlled phase gate between the `i`-th logical qubits of the two
      blocks, made of `CP(2 φ_j)` between those legs and their partners in the second block.

    For example, a bitwise CS gate gives addressable S and CZ gates (Corollary 2.10).

    Args:
        tensor: The tensor of the two code blocks.
        logical_pairs: Matching logical legs `(a_i, b_i)` of the first and the second block.
        ops: Two qubit controlled phase gates on pairs `(u, v)` of a physical leg `u` of the first
            block and its partner `v` in the second block, implementing a logical gate.

    Returns:
        For each logical pair, the addressable phase gate on its first leg and the addressable
        controlled phase gate on the pair, with their logical gates verified with
        [`logical_action`][planqtn.transversal.logical_action].

    Raises:
        ValueError: If the gates are not two qubit controlled phase gates, they don't implement a
            logical gate, or a logical X operator of the first block touches the second block.

    Example:
        The bitwise CS gate between two [[15,1,3]] codes gives an addressable S on the support of
        a logical X operator, and CZs between those legs and their partners, which are one of the
        15 localized CZs of the pair:

        ```python
        >>> from planqtn.gates import bitwise
        >>> from planqtn.legos import Legos
        >>> a = SignedStabilizerTensor(Legos.qrm15_encoding_tensor, tensor_id="a")
        >>> b = SignedStabilizerTensor(Legos.qrm15_encoding_tensor, tensor_id="b")
        >>> pair = a.tensor_with(b)
        >>> cs = bitwise(Gates.CS, [("a", i) for i in range(15)], [("b", i) for i in range(15)])
        >>> print(logical_action(pair, [("a", 15), ("b", 15)], cs))
        CS†(a:15, b:15)
        >>> found = addressable_controlled_phase_gates(pair, [(("a", 15), ("b", 15))], cs)
        >>> phase, controlled = found[(("a", 15), ("b", 15))]
        >>> [gate.name for gate, _ in phase.ops], phase.action.phase_polynomial()
        (['S', 'S', 'S', 'S', 'S', 'S', 'S'], {(('a', 15),): 3})
        >>> print(controlled.action)
        CZ(a:15, b:15)

        ```
    """
    exponents = []
    for gate, legs in ops:
        if gate.num_qubits != 2 or not gate.is_diagonal:
            raise ValueError(
                f"Gate {gate.name} on {legs} is not a controlled phase gate."
            )
        phases, order = gate.diagonal_phases()
        if phases[1] or phases[2]:
            raise ValueError(
                f"Gate {gate.name} on {legs} is not a controlled phase gate."
            )
        exponents.append((int(phases[3]), order))
    logical = [leg for pair in logical_pairs for leg in pair]
    if logical_action(tensor, logical, ops, method="diagonal") is None:
        raise ValueError("The operator does not implement a logical gate.")
    partner = {
        tensor.leg(legs[0]): (tensor.leg(legs[1]), exponent)
        for (_, legs), exponent in zip(ops, exponents)
    }
    second_block = {leg for leg, _ in partner.values()}
    result = {}
    for first, second in logical_pairs:
        representative = logical_pauli_representative(tensor, logical, first, "X")
        if second_block & set(representative):
            raise ValueError(
                f"The logical X operator of {first} touches the legs of the second block."
            )
        phase_ops: GateAssignment = []
        controlled_ops: GateAssignment = []
        for leg, letter in representative.items():
            if letter == "Z" or leg not in partner:
                continue
            other, (numerator, order) = partner[leg]
            phase = Gates.phase(numerator, order)
            controlled = Gates.controlled_phase(2, 2 * numerator, order)
            if not equal_up_to_phase(phase.matrix, Gates.I.matrix):
                phase_ops.append((_named(phase, _NAMED_PHASE_GATES), (leg,)))
            if not equal_up_to_phase(controlled.matrix, np.eye(4, dtype=complex)):
                named = _named(controlled, _NAMED_CONTROLLED_PHASE_GATES)
                controlled_ops.append((named, (leg, other)))
        phase_action = logical_action(tensor, logical, phase_ops, method="diagonal")
        controlled_action = logical_action(
            tensor, logical, controlled_ops, method="diagonal"
        )
        assert phase_action is not None, "Proposition 2.9 gives a logical gate"
        assert controlled_action is not None, "Proposition 2.9 gives a logical gate"
        result[(tensor.leg(first), tensor.leg(second))] = (
            PatternMatch(phase_ops, phase_action),
            PatternMatch(controlled_ops, controlled_action),
        )
    return result


def _named(gate: Gate, candidates: Sequence[Gate]) -> Gate:
    """The candidate equal to the gate up to a phase, or the gate itself."""
    return next(
        (c for c in candidates if equal_up_to_phase(gate.matrix, c.matrix)), gate
    )
