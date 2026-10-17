"""Phase polynomials of diagonal operators on the support of stabilizer states.

A diagonal operator `D = sum_x exp(2 pi i θ(x) / N) |x⟩⟨x|`, e.g. a product of T, CS, CCZ or
other multi-controlled phase gates, is a symmetry of a stabilizer state `|V⟩` exactly when its
phase `θ` is constant on the computational basis support of `|V⟩`. With some legs of `|V⟩`
chosen as logical legs, `D` implements a logical gate exactly when `θ` only depends on the logical
bits on the support (Proposition 2.3 of ChunJun Cao and Brad Lackey, "Quantum Lego Power-up:
Designing Transversal Gates with Tensor Networks", arXiv:2603.03542 (2026)).

The support is an affine subspace `x = a + y G` over GF(2), which
[`SupportCoordinates`][planqtn.phase_polynomial.SupportCoordinates] parametrizes so that the first
`k` coordinates `y_1, ..., y_k` are the logical bits. Every function from bit strings `y` to the
integers modulo `N` is a unique multilinear polynomial `sum_S c_S prod_{i in S} y_i` with
coefficients `c_S` modulo `N`, so `D` is a logical gate exactly when all the monomials that contain
a non-logical coordinate vanish, and the remaining monomials are the logical phase polynomial.
[`PhasePolynomial`][planqtn.phase_polynomial.PhasePolynomial] computes this polynomial without
enumerating the support: each physical bit is a parity of coordinates, which is lifted to the
integers with `y_1 ⊕ ... ⊕ y_t = sum_{S ≠ ∅} (-2)^(|S| - 1) prod_{i in S} y_i`. For `N = 2^m`
the terms with `|S| > m` vanish modulo `N`, so a gate whose multilinear phase has degree `t` and a
coefficient with 2-adic valuation `v` only contributes monomials of degree at most
`t + m - 1 - v`, e.g. at most 3 for T, CS and CCZ. This is the generalized triorthogonality
condition: for the bitwise T gate on a CSS code it reduces to the triorthogonality of the X
stabilizers and logical X operators. The cost is polynomial in the number of legs for a fixed gate
degree and order, and is exponential only in the number of support directions that touch a leg,
which stays small for the sparse stabilizers of tensor networks.

Example:
    The bitwise T gate of the [[15,1,3]] quantum Reed-Muller code is the logical T† (`7/8`
    turns), and all of its other monomials vanish:

    ```python
    >>> from planqtn.gates import Gates, bitwise
    >>> from planqtn.legos import Legos
    >>> from planqtn.signed_stabilizer_tensor import SignedStabilizerTensor
    >>> qrm = SignedStabilizerTensor(Legos.qrm15_encoding_tensor, tensor_id="q")
    >>> coordinates = SupportCoordinates(qrm, [15])
    >>> coordinates.dimension
    5
    >>> polynomial = coordinates.polynomial(bitwise(Gates.T, range(15)))
    >>> polynomial.order, polynomial.obstructions(), polynomial.logical_terms()
    (8, {}, {(('q', 15),): 7})
    >>> # T on a single leg is not a symmetry: it has non-logical monomials
    >>> len(coordinates.polynomial([(Gates.T, (0,))]).obstructions()) > 0
    True

    ```
"""

from itertools import combinations
import math
from typing import Dict, List, Sequence, Tuple

import numpy as np
from numpy.typing import NDArray

from planqtn.gates import GateAssignment, LegLike
from planqtn.signed_stabilizer_tensor import (
    SignedStabilizerTensor,
    independent_subset,
)
from planqtn.tensor import TensorLeg

_MAX_TERMS = 5_000_000


def _bits(mask: int) -> Tuple[int, ...]:
    return tuple(i for i in range(mask.bit_length()) if (mask >> i) & 1)


class SupportCoordinates:
    """Coordinates on the computational basis support of a stabilizer state.

    The support is the set of bit strings `x = offset + y basis` for all `y` over GF(2). The first
    `k` coordinates are the logical bits: row `i < k` of the basis has a single 1 among the logical
    legs, on the `i`-th logical leg, the other rows and the offset are zero on the logical legs.
    The rows are sparse when the stabilizers of the tensor are.
    """

    def __init__(
        self, tensor: SignedStabilizerTensor, logical_legs: Sequence[LegLike] = ()
    ):
        """Parametrize the support of a stabilizer state.

        Args:
            tensor: The stabilizer state.
            logical_legs: The logical legs, which have to define an encoding isometry.

        Raises:
            ValueError: If the tensor is not a stabilizer state, the logical legs are repeated or
                they do not define an encoding isometry.
        """
        logical = [tensor.legs.index(tensor.leg(leg)) for leg in logical_legs]
        if len(set(logical)) != len(logical):
            raise ValueError(f"Repeated logical legs: {logical_legs}.")
        offset, basis = tensor.support_basis()
        offset, basis = offset.copy(), basis.copy()
        for j, col in enumerate(logical):
            candidates = np.flatnonzero(basis[j:, col])
            if len(candidates) == 0:
                raise ValueError(
                    "The logical legs are not maximally entangled with the rest of the tensor, "
                    "so they do not define an encoding isometry."
                )
            row = j + int(candidates[0])
            basis[[j, row]] = basis[[row, j]]
            others = np.flatnonzero(basis[:, col])
            basis[others[others != j]] ^= basis[j]
        for j, col in enumerate(logical):
            if offset[col]:
                offset ^= basis[j]
        logical_cols = logical + [tensor.n + i for i in logical]
        if len(independent_subset(tensor.xz[:, logical_cols])) != 2 * len(logical):
            raise ValueError(
                "The logical legs are not maximally entangled with the rest of the tensor, "
                "so they do not define an encoding isometry."
            )
        offset.setflags(write=False)
        basis.setflags(write=False)
        self.tensor = tensor
        self.logical = logical
        self.offset: NDArray[np.uint8] = offset
        self.basis: NDArray[np.uint8] = basis
        self._variables = [
            [1 << int(i) for i in np.flatnonzero(basis[:, q])] for q in range(tensor.n)
        ]

    @property
    def dimension(self) -> int:
        """The dimension of the support, i.e. the number of coordinates."""
        return len(self.basis)

    @property
    def num_logical(self) -> int:
        """The number of logical coordinates, which come first."""
        return len(self.logical)

    @property
    def logical_legs(self) -> List[TensorLeg]:
        """The logical legs, in the order of their coordinates."""
        return [self.tensor.legs[i] for i in self.logical]

    def polynomial(self, ops: GateAssignment, order: int = 1) -> "PhasePolynomial":
        """Return the phase polynomial of a diagonal operator on the support.

        Args:
            ops: Diagonal gates on disjoint legs, with phases that are roots of unity.
            order: A multiple of the order of the roots of unity to use, e.g. 2 to allow adding
                Z gates later. The actual order is the least common multiple of this and the
                orders of the gates.

        Returns:
            The phase polynomial.

        Raises:
            ValueError: If a gate is not diagonal, or the polynomial has too many terms.
        """
        resolved = self.tensor.resolve_ops(ops)
        non_diagonal = [gate.name for gate, _ in resolved if not gate.is_diagonal]
        if non_diagonal:
            raise ValueError(f"Gates {non_diagonal} are not diagonal.")
        gate_phases = [gate.diagonal_phases() for gate, _ in resolved]
        modulus = math.lcm(order, *(gate_order for _, gate_order in gate_phases))
        coefficients: Dict[int, int] = {}
        budget = [_MAX_TERMS]
        for (_, qubits), (exponents, gate_order) in zip(resolved, gate_phases):
            for subset, coefficient in _multilinear(
                exponents * (modulus // gate_order), modulus
            ):
                factors = [
                    (int(self.offset[qubits[j]]), self._variables[qubits[j]])
                    for j in subset
                ]
                _expand(coefficients, factors, coefficient, modulus, budget)
        return PhasePolynomial(
            self, {m: c for m, c in coefficients.items() if c % modulus}, modulus
        )


class PhasePolynomial:
    """The phase `θ(offset + y basis) = sum_S c_S prod_{i in S} y_i (mod order)` of a diagonal
    operator on the support of a stabilizer state, in the coordinates `y` of
    [`SupportCoordinates`][planqtn.phase_polynomial.SupportCoordinates].

    Monomials are given as tuples of coordinate indices, the empty tuple being the constant term,
    i.e. the global phase.
    """

    def __init__(
        self, coordinates: SupportCoordinates, coefficients: Dict[int, int], order: int
    ):
        """Construct the polynomial.

        Args:
            coordinates: The coordinates the polynomial refers to.
            coefficients: The nonzero coefficients modulo `order`, keyed by the bit masks of the
                coordinates of the monomials.
            order: The order of the root of unity that the phase refers to.
        """
        self.coordinates = coordinates
        self.order = order
        self._coefficients = dict(coefficients)

    def terms(self) -> Dict[Tuple[int, ...], int]:
        """Return all nonzero coefficients.

        Returns:
            The coefficients keyed by the coordinates of the monomials.
        """
        return {_bits(m): c for m, c in sorted(self._coefficients.items())}

    def obstructions(self) -> Dict[Tuple[int, ...], int]:
        """Return the nonzero monomials that contain a non-logical coordinate.

        The operator is a logical gate exactly when there are none.

        Returns:
            The coefficients keyed by the coordinates of the monomials.
        """
        k = self.coordinates.num_logical
        return {_bits(m): c for m, c in sorted(self._coefficients.items()) if m >> k}

    @property
    def is_logical(self) -> bool:
        """Whether the operator is a logical gate, i.e. there are no obstructions."""
        k = self.coordinates.num_logical
        return not any(m >> k for m in self._coefficients)

    @property
    def degree(self) -> int:
        """The largest degree of a nonzero monomial, 0 for the zero polynomial."""
        return max((m.bit_count() for m in self._coefficients), default=0)

    def logical_terms(self) -> Dict[Tuple[TensorLeg, ...], int]:
        """Return the non-constant monomials on the logical coordinates.

        For a logical gate these are the coefficients of its logical phase polynomial, see
        [`phase_polynomial`][planqtn.transversal.DiagonalLogicalAction.phase_polynomial].

        Returns:
            The coefficients keyed by tuples of logical legs.
        """
        k = self.coordinates.num_logical
        legs = self.coordinates.logical_legs
        return {
            tuple(legs[i] for i in _bits(m)): c
            for m, c in sorted(
                self._coefficients.items(), key=lambda t: (t[0].bit_count(), t[0])
            )
            if m and not m >> k
        }


def _multilinear(
    exponents: NDArray[np.int64], modulus: int
) -> List[Tuple[Tuple[int, ...], int]]:
    """Write `exponents[b]` as `sum_T d_T prod_{j in T} b_j`, with the first qubit as the most
    significant bit of `b`."""
    q = len(exponents).bit_length() - 1
    d = np.array(exponents, dtype=np.int64) % modulus
    for bit in range(q):
        mask = 1 << bit
        for u in range(2**q):
            if u & mask:
                d[u] -= d[u ^ mask]
    d %= modulus
    return [
        (tuple(j for j in range(q) if (u >> (q - 1 - j)) & 1), int(d[u]))
        for u in range(1, len(d))
        if d[u]
    ]


def _expand(
    coefficients: Dict[int, int],
    factors: List[Tuple[int, List[int]]],
    coefficient: int,
    modulus: int,
    budget: List[int],
) -> None:
    """Add `coefficient * prod_j (a_j ⊕ y_{W_j})`, lifted to the integers, to the polynomial.

    Each factor is a pair of the offset bit `a_j` and the coordinate bit masks `W_j`.
    """

    def add(j: int, c: int, mask: int) -> None:
        if c % modulus == 0:
            return
        if j == len(factors):
            budget[0] -= 1
            if budget[0] < 0:
                raise ValueError(
                    f"The phase polynomial has more than {_MAX_TERMS} terms, use the "
                    "enumeration method instead."
                )
            coefficients[mask] = (coefficients.get(mask, 0) + c) % modulus
            return
        offset, variables = factors[j]
        if offset:
            add(j + 1, c, mask)
        scale = -c if offset else c
        for size in range(1, len(variables) + 1):
            if scale % modulus == 0:
                break
            for combo in combinations(variables, size):
                add(j + 1, scale, mask | sum(combo))
            scale *= -2

    add(0, coefficient, 0)
