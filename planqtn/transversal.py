"""Logical gates implemented by physical gates on stabilizer code tensors.

The encoding tensor of a stabilizer code, with its logical legs, is the Choi state `|V⟩` of the
encoding map. A physical operator `O` implements the logical gate `L` exactly when `L^* ⊗ O` is a
symmetry of `|V⟩` (Proposition 2.3 of ChunJun Cao and Brad Lackey, "Quantum Lego Power-up:
Designing Transversal Gates with Tensor Networks", arXiv:2603.03542 (2026)), which
[`logical_action`][planqtn.transversal.logical_action] checks for a physical operator given as a
[`GateAssignment`][planqtn.gates.GateAssignment]:

- for Clifford gates, by conjugating the stabilizers of `|V⟩`, which gives the full Clifford
  logical action ([`CliffordLogicalAction`][planqtn.transversal.CliffordLogicalAction]),
- for diagonal gates, Clifford or not (T, CS, CCZ, ...), by checking that the phase of `O` only
  depends on the logical bits on the computational basis support of `|V⟩`, which gives a logical
  phase polynomial ([`DiagonalLogicalAction`][planqtn.transversal.DiagonalLogicalAction]). This
  takes polynomial time, see [`planqtn.phase_polynomial`][planqtn.phase_polynomial].

Assignments can mix legs of several blocks, so the same function covers strongly and weakly
transversal, interblock, intrablock and localized gates. Cleaning operators (Definition 2.5 of the
paper), e.g. a few Z gates next to the CZs of an intrablock CZ, can be part of the assignment or
searched for with [`find_cleaning`][planqtn.transversal.find_cleaning].

Example:
    The bitwise T gate of the [[15,1,3]] quantum Reed-Muller code is the logical T†:

    ```python
    >>> from planqtn.gates import Gates, bitwise
    >>> from planqtn.legos import Legos
    >>> from planqtn.signed_stabilizer_tensor import SignedStabilizerTensor
    >>> qrm = SignedStabilizerTensor(Legos.qrm15_encoding_tensor, tensor_id="q")
    >>> action = logical_action(qrm, [15], bitwise(Gates.T, range(15)))
    >>> print(action)
    T†(q:15)
    >>> action.equals(Gates.T_DAG)
    True

    ```
"""

import abc
from fractions import Fraction
import math
from typing import (
    Callable,
    Dict,
    List,
    Mapping,
    NamedTuple,
    Optional,
    Sequence,
    Tuple,
    Union,
)

import numpy as np
from numpy.typing import ArrayLike, NDArray

from planqtn.gates import (
    Gate,
    GateAssignment,
    Gates,
    LegLike,
    merge_gates,
    operator_matrix,
    pauli_from_matrix,
    pauli_matrix,
)
from planqtn.phase_polynomial import SupportCoordinates
from planqtn.signed_stabilizer_tensor import (
    SignedStabilizerTensor,
    conjugate_paulis,
    element_with_bits,
    multiply_paulis,
    signed_rref,
    solve_gf2,
)
from planqtn.tensor import TensorLeg

_PAULI_LABELS = "IXZY"
_PHASE_GATE_NAMES = {
    Fraction(1, 2): "Z",
    Fraction(1, 4): "S",
    Fraction(3, 4): "S†",
    Fraction(1, 8): "T",
    Fraction(7, 8): "T†",
}
_MAX_MATRIX_QUBITS = 12
_MAX_PHASE_TABLE_QUBITS = 24


def _leg_label(leg: TensorLeg) -> str:
    return f"{leg[0]}:{leg[1]}"


ExpectedGate = Union[Gate, NDArray[np.complex128], GateAssignment]
"""A logical gate: a gate on all logical legs, its matrix, or a gate assignment on the logical
legs."""


def _expected_matrix(
    expected: ExpectedGate, logical_legs: Sequence[TensorLeg]
) -> NDArray[np.complex128]:
    if isinstance(expected, Gate):
        return expected.matrix
    if isinstance(expected, np.ndarray):
        return expected
    return operator_matrix(expected, logical_legs)


class LogicalAction(abc.ABC):
    """The logical gate implemented by a physical operator on a code tensor.

    Logical legs are ordered as given to [`logical_action`][planqtn.transversal.logical_action];
    the first one is the most significant qubit of
    [`matrix`][planqtn.transversal.LogicalAction.matrix].
    """

    def __init__(self, logical_legs: Sequence[TensorLeg]):
        """Construct the logical action.

        Args:
            logical_legs: The logical legs, in order.
        """
        self.logical_legs: Tuple[TensorLeg, ...] = tuple(logical_legs)

    @abc.abstractmethod
    def matrix(self) -> NDArray[np.complex128]:
        """Return the matrix of the logical gate, up to a global phase.

        Returns:
            The `2^k x 2^k` unitary for `k` logical legs.
        """

    def equals(self, expected: ExpectedGate) -> bool:
        """Check whether the logical gate equals the expected one up to a global phase.

        Args:
            expected: A gate on all logical legs, a matrix, or a gate assignment on the logical
                legs, given in the same form as the logical legs of this action.

        Returns:
            Whether the two gates are equal up to a global phase.
        """
        target = _expected_matrix(expected, self.logical_legs)
        mine = self.matrix()
        if target.shape != mine.shape:
            return False
        return bool(np.isclose(abs(np.vdot(target, mine)), len(mine)))


class CliffordLogicalAction(LogicalAction):
    """A logical Clifford gate, given by how it conjugates the logical Pauli operators."""

    def __init__(
        self,
        logical_legs: Sequence[TensorLeg],
        images: NDArray[np.uint8],
        phases: NDArray[np.int64],
    ):
        """Construct the logical action.

        Args:
            logical_legs: The `k` logical legs, in order.
            images: A `2k x 2k` array, row `i < k` is the XZ form image of `X_i`, row `k + i`
                the image of `Z_i`.
            phases: The phase exponents of the images in the XZ form `i^p X^x Z^z`.
        """
        super().__init__(logical_legs)
        self.images = images
        self.phases = phases

    def conjugation_table(self) -> Dict[str, str]:
        """Return the images of the logical X and Z operators as signed Pauli strings.

        Returns:
            A mapping like `{"XI": "+ZI", "ZI": "+YI", ...}` with one letter per logical leg.
        """
        k = len(self.logical_legs)
        table = {}
        for i in sorted(range(2 * k), key=lambda row: (row % k, row)):
            source = ["I"] * k
            source[i % k] = "X" if i < k else "Z"
            image, phase = self.images[i], int(self.phases[i])
            y_count = int(np.count_nonzero(image[:k] & image[k:]))
            sign = "+" if (phase - y_count) % 4 == 0 else "-"
            letters = "".join(
                _PAULI_LABELS[int(image[j]) + 2 * int(image[k + j])] for j in range(k)
            )
            table["".join(source)] = sign + letters
        return table

    def __str__(self) -> str:
        legs = ", ".join(_leg_label(leg) for leg in self.logical_legs)
        mapping = ", ".join(f"{p} -> {q}" for p, q in self.conjugation_table().items())
        return f"Clifford on ({legs}): {mapping}"

    def matrix(self) -> NDArray[np.complex128]:
        """Return the matrix of the logical gate, up to a global phase.

        Returns:
            The `2^k x 2^k` unitary for `k` logical legs.

        Raises:
            ValueError: If there are too many logical legs for a dense matrix.
        """
        k = len(self.logical_legs)
        if k > _MAX_MATRIX_QUBITS:
            raise ValueError(f"Refusing to build a matrix on {k} logical legs.")
        images = [
            pauli_matrix(self.images[i], int(self.phases[i])) for i in range(2 * k)
        ]
        identity = np.eye(2**k, dtype=complex)
        projector = identity
        for z_image in images[k:]:
            projector = projector @ (identity + z_image) / 2
        column = projector[:, int(np.argmax(np.linalg.norm(projector, axis=0)))]
        zero_image = np.asarray(column / np.linalg.norm(column), dtype=np.complex128)
        u = np.zeros((2**k, 2**k), dtype=complex)
        for x in range(2**k):
            col = zero_image
            for i in range(k):
                if (x >> (k - 1 - i)) & 1:
                    col = np.asarray(images[i] @ col, dtype=np.complex128)
            u[:, x] = col
        return u


class DiagonalLogicalAction(LogicalAction):
    """A logical diagonal gate `diag(exp(2 pi i phases[u] / order))`.

    The basis state index `u` has the bit of the first logical leg as its most significant bit.
    The gate is stored as its phase polynomial, so it can have many logical legs.
    """

    def __init__(
        self,
        logical_legs: Sequence[TensorLeg],
        phases: Optional[ArrayLike],
        order: int,
        polynomial: Optional[Mapping[Tuple[TensorLeg, ...], int]] = None,
    ):
        """Construct the logical action, from its phases or from its phase polynomial.

        Args:
            logical_legs: The `k` logical legs, in order.
            phases: The phase exponent of each of the `2^k` logical basis states, or None to use
                `polynomial` instead.
            order: The order of the root of unity the exponents refer to.
            polynomial: The coefficients of the phase polynomial (see
                [`phase_polynomial`][planqtn.transversal.DiagonalLogicalAction.phase_polynomial]),
                used when `phases` is None.

        Raises:
            ValueError: If neither or both of `phases` and `polynomial` are given, or the
                polynomial refers to other legs.
        """
        super().__init__(logical_legs)
        self.order = order
        k = len(self.logical_legs)
        if (phases is None) == (polynomial is None):
            raise ValueError("Give exactly one of phases and polynomial.")
        self._terms: Dict[int, int] = {}
        if phases is not None:
            coefficients = np.array(phases, dtype=np.int64) % order
            for bit in range(k):
                mask = 1 << bit
                for u in range(2**k):
                    if u & mask:
                        coefficients[u] -= coefficients[u ^ mask]
            coefficients %= order
            self._terms = {u: int(c) for u, c in enumerate(coefficients) if u and c}
        if polynomial is not None:
            position = {leg: i for i, leg in enumerate(self.logical_legs)}
            for legs, coefficient in polynomial.items():
                if any(leg not in position for leg in legs):
                    raise ValueError(
                        f"Polynomial term {legs} is not on the logical legs."
                    )
                u = sum(1 << (k - 1 - position[leg]) for leg in set(legs))
                if u:
                    self._terms[u] = (self._terms.get(u, 0) + coefficient) % order
            self._terms = {u: c for u, c in self._terms.items() if c}

    @property
    def phases(self) -> NDArray[np.int64]:
        """The phase exponent of each of the `2^k` logical basis states, with `phases[0] = 0`.

        Raises:
            ValueError: If there are too many logical legs to list all basis states.
        """
        k = len(self.logical_legs)
        if k > _MAX_PHASE_TABLE_QUBITS:
            raise ValueError(f"Refusing to list the phases of {k} logical legs.")
        phases = np.zeros(2**k, dtype=np.int64)
        for u, coefficient in self._terms.items():
            phases[u] = coefficient
        for bit in range(k):
            mask = 1 << bit
            for u in range(2**k):
                if u & mask:
                    phases[u] += phases[u ^ mask]
        return phases % self.order

    def phase_polynomial(self) -> Dict[Tuple[TensorLeg, ...], int]:
        """Return the gate as a multilinear phase polynomial in the logical bits.

        The gate is `exp(2 pi i/order * sum_S c_S prod_{j in S} u_j)`, i.e. the product of
        multi-controlled phase gates `C^(|S|-1) P(2 pi c_S / order)` on the leg subsets `S`.

        Returns:
            The nonzero coefficients `c_S` (modulo `order`) for each subset of logical legs.
        """
        k = len(self.logical_legs)
        return {
            tuple(
                leg for i, leg in enumerate(self.logical_legs) if (u >> (k - 1 - i)) & 1
            ): coefficient
            for u, coefficient in sorted(
                self._terms.items(), key=lambda t: (t[0].bit_count(), -t[0])
            )
        }

    def __str__(self) -> str:
        terms = []
        for legs, coefficient in self.phase_polynomial().items():
            angle = Fraction(coefficient, self.order)
            name = _PHASE_GATE_NAMES.get(angle, f"P(2π·{angle})")
            gate = "C" * (len(legs) - 1) + name
            terms.append(f"{gate}({', '.join(_leg_label(leg) for leg in legs)})")
        return " · ".join(terms) if terms else "I"

    def matrix(self) -> NDArray[np.complex128]:
        """Return the diagonal matrix of the logical gate.

        Returns:
            The `2^k x 2^k` unitary for `k` logical legs.

        Raises:
            ValueError: If there are too many logical legs for a dense matrix.
        """
        if len(self.logical_legs) > _MAX_MATRIX_QUBITS:
            raise ValueError(
                f"Refusing to build a matrix on {len(self.logical_legs)} legs."
            )
        return np.diag(np.exp(2j * np.pi * self.phases / self.order))


def _clifford_action(
    tensor: SignedStabilizerTensor,
    logical: List[int],
    ops: List[Tuple[Gate, Tuple[int, ...]]],
) -> Optional[CliffordLogicalAction]:
    n, k = tensor.n, len(logical)
    logical_cols = logical + [n + i for i in logical]
    physical_cols = [c for c in range(2 * n) if c not in set(logical_cols)]

    by_logical = signed_rref(tensor.xz, tensor.phases, logical_cols)
    xz, ph, pivots = by_logical
    if len(pivots) != 2 * k:
        raise ValueError(
            "The logical legs are not maximally entangled with the rest of the tensor, "
            "so they do not define an encoding isometry."
        )
    full = signed_rref(tensor.xz, tensor.phases)
    num_logical_rows = 2 * k
    code_xz, code_ph = conjugate_paulis(
        xz[num_logical_rows:], ph[num_logical_rows:], ops
    )
    for v, p in zip(code_xz, code_ph):
        for row, col in full[2]:
            if v[col]:
                v, p = multiply_paulis(v, p, full[0][row], int(full[1][row]))
        if v.any() or p != 0:
            return None

    by_physical = signed_rref(tensor.xz, tensor.phases, physical_cols)
    images = np.zeros((2 * k, 2 * k), dtype=np.uint8)
    phases = np.zeros(2 * k, dtype=np.int64)
    for i in range(2 * k):
        target = np.zeros(2 * k, dtype=np.uint8)
        target[i] = 1
        start = element_with_bits(by_logical, logical_cols, target)
        assert start is not None, "every logical Pauli has a matching stabilizer"
        pushed_xz, pushed_ph = conjugate_paulis(start[0], np.array([start[1]]), ops)
        pushed = pushed_xz[0]
        match = element_with_bits(by_physical, physical_cols, pushed[physical_cols])
        if match is None:
            return None
        images[i] = match[0][logical_cols]
        phases[i] = (int(pushed_ph[0]) - match[1]) % 4
    return CliffordLogicalAction([tensor.legs[i] for i in logical], images, phases)


def _diagonal_action(
    tensor: SignedStabilizerTensor,
    logical: List[int],
    ops: List[Tuple[Gate, Tuple[int, ...]]],
    max_support_dimension: int,
) -> Optional[DiagonalLogicalAction]:
    points = tensor.support(max_dimension=max_support_dimension).astype(np.int64)
    gate_phases = [gate.diagonal_phases() for gate, _ in ops]
    order = math.lcm(*(gate_order for _, gate_order in gate_phases))
    theta = np.zeros(len(points), dtype=np.int64)
    for (_, qubits), (exponents, gate_order) in zip(ops, gate_phases):
        q = len(qubits)
        keys = points[:, list(qubits)] @ (1 << np.arange(q - 1, -1, -1))
        theta = (theta + exponents[keys] * (order // gate_order)) % order

    k = len(logical)
    slices = points[:, logical] @ (1 << np.arange(k - 1, -1, -1))
    if len(np.unique(slices)) != 2**k:
        raise ValueError(
            "The logical legs are not maximally entangled with the rest of the tensor, "
            "so they do not define an encoding isometry."
        )
    reference = np.zeros(2**k, dtype=np.int64)
    reference[slices[::-1]] = theta[::-1]
    if not np.array_equal(theta, reference[slices]):
        return None
    return DiagonalLogicalAction(
        [tensor.legs[i] for i in logical], (reference - reference[0]) % order, order
    )


def _polynomial_action(
    tensor: SignedStabilizerTensor,
    logical_legs: Sequence[TensorLeg],
    ops: GateAssignment,
) -> Optional[DiagonalLogicalAction]:
    polynomial = SupportCoordinates(tensor, logical_legs).polynomial(ops)
    if not polynomial.is_logical:
        return None
    return DiagonalLogicalAction(
        logical_legs, None, polynomial.order, polynomial.logical_terms()
    )


def logical_action(
    tensor: SignedStabilizerTensor,
    logical_legs: Sequence[LegLike],
    ops: GateAssignment,
    method: str = "auto",
    max_support_dimension: int = 20,
) -> Optional[LogicalAction]:
    """Find the logical gate that a physical operator implements on a code tensor.

    The tensor must be a stabilizer state whose logical legs define an encoding isometry, e.g. an
    encoding tensor LEGO or a network of them with some dangling logical legs.

    Args:
        tensor: The code tensor.
        logical_legs: The logical legs; all other legs are physical.
        ops: The physical operator, as gates on disjoint physical legs.
        method: `"clifford"` for Clifford gates, `"diagonal"` for diagonal gates, or `"auto"` to
            pick `"clifford"` when all gates are Clifford and `"diagonal"` otherwise. The diagonal
            method computes the phase polynomial of the operator on the support of the tensor
            (see [`planqtn.phase_polynomial`][planqtn.phase_polynomial]), and only finds logical
            gates that are diagonal in the logical computational basis. The `"enumerate"` method
            finds the same diagonal logical gates by enumerating the support instead, which is
            exponential in the dimension of the support and meant for cross-checks.
        max_support_dimension: For the enumeration method, the largest dimension of the support
            of the tensor that is enumerated.

    Returns:
        The logical action, or None if the operator does not implement a logical gate (of the
        kind the method can find).

    Raises:
        ValueError: If the tensor is not a stabilizer state, the logical legs do not define an
            isometry, the gates act on logical legs, or the gates do not suit the method.
    """
    logical, resolved, method = _prepare(
        tensor, logical_legs, ops, method, ("clifford", "diagonal", "enumerate")
    )
    if method == "clifford":
        return _clifford_action(tensor, logical, resolved)
    if method == "enumerate":
        return _diagonal_action(tensor, logical, resolved, max_support_dimension)
    return _polynomial_action(tensor, [tensor.legs[i] for i in logical], ops)


def _prepare(
    tensor: SignedStabilizerTensor,
    logical_legs: Sequence[LegLike],
    ops: GateAssignment,
    method: str,
    methods: Sequence[str],
) -> Tuple[List[int], List[Tuple[Gate, Tuple[int, ...]]], str]:
    """Validate the inputs and resolve the method, returning leg positions and the method."""
    if tensor.rank != tensor.n:
        raise ValueError(
            f"{tensor} is not a stabilizer state: it has {tensor.rank} stabilizers on "
            f"{tensor.n} legs."
        )
    logical = [tensor.legs.index(tensor.leg(leg)) for leg in logical_legs]
    if len(set(logical)) != len(logical):
        raise ValueError(f"Repeated logical legs: {logical_legs}.")
    resolved = tensor.resolve_ops(ops)
    touched = {i for _, qubits in resolved for i in qubits}.intersection(logical)
    if touched:
        raise ValueError(
            f"Gates act on logical legs {[tensor.legs[i] for i in sorted(touched)]}."
        )
    gates = [gate for gate, _ in resolved]
    if method == "auto":
        method = "clifford" if all(g.is_clifford for g in gates) else "diagonal"
    if method not in methods:
        raise ValueError(
            f"Unknown method {method}, use 'auto', "
            + ", ".join(f"'{m}'" for m in methods[:-1])
            + f" or '{methods[-1]}'."
        )
    if method == "clifford":
        non_clifford = [g.name for g in gates if not g.is_clifford]
        if non_clifford:
            raise ValueError(f"Gates {non_clifford} are not Clifford gates.")
    else:
        non_diagonal = [g.name for g in gates if not g.is_diagonal]
        if non_diagonal:
            raise ValueError(
                f"Gates {non_diagonal} are not diagonal, and only Clifford gates can be "
                "mixed with non-diagonal ones."
            )
    return logical, resolved, method


class Cleaning(NamedTuple):
    """A Pauli correction that turns a physical operator into a logical gate."""

    correction: GateAssignment
    """The Pauli gates of the correction, on physical legs."""
    ops: GateAssignment
    """The corrected operator, the correction applied after the operator, on disjoint legs."""
    action: LogicalAction
    """The logical gate that the corrected operator implements."""


def find_cleaning(
    tensor: SignedStabilizerTensor,
    logical_legs: Sequence[LegLike],
    ops: GateAssignment,
    target: Optional[ExpectedGate] = None,
    legs: Optional[Sequence[LegLike]] = None,
    method: str = "auto",
) -> Optional[Cleaning]:
    """Find a Pauli correction `P` that makes a physical operator `O` a logical gate `P O`.

    Some operators only implement a logical gate together with a cleaning operator (Definition 2.5
    of the paper), e.g. Z gates on a third block for the intrablock CZ of Steane codes joined by a
    GHZ hyperedge. For Clifford operators, conjugating a stabilizer by `P O` instead of `O` flips
    its sign exactly when it anticommutes with `P`, so `P` is found by linear algebra over GF(2)
    from the sign mismatches. For diagonal operators, a Z-type correction adds `N/2` to the
    degree-1 monomials of the phase polynomial (see
    [`planqtn.phase_polynomial`][planqtn.phase_polynomial]) and nothing else, so it can only fix
    obstructions of degree 1 with coefficient `N/2`; X-type corrections are not searched for
    diagonal operators.

    Corrections are unique up to stabilizers and logical Pauli operators, so without a target the
    logical gate is only determined up to a logical Pauli operator; pass the expected gate as the
    target to get it exactly. The weight of the correction is reduced greedily, which does not
    guarantee a minimum weight correction.

    Args:
        tensor: The code tensor.
        logical_legs: The logical legs; all other legs are physical.
        ops: The physical operator, as gates on disjoint physical legs.
        target: Optionally, the logical gate that `P O` should implement exactly (up to a global
            phase), given like in [`equals`][planqtn.transversal.LogicalAction.equals].
        legs: The physical legs that the correction may act on, by default all of them.
        method: `"clifford"` for Clifford operators (Pauli corrections), `"diagonal"` for
            diagonal operators (Z-type corrections), or `"auto"` to pick `"clifford"` when all
            gates are Clifford and `"diagonal"` otherwise.

    Returns:
        The correction, the corrected operator and its logical action, or None if there is no
        such correction.

    Raises:
        ValueError: If the inputs are invalid like in
            [`logical_action`][planqtn.transversal.logical_action], the correction legs are
            logical legs, or the target is not a Clifford (diagonal) gate for the Clifford
            (diagonal) method.

    Example:
        Two Steane codes traced through the Bell state have an intrablock CZ made of CZs between
        the dangling legs of the two blocks, but only together with three Z gates (Figure 7 of the
        paper):

        ```python
        >>> from planqtn.gates import Gates, bitwise
        >>> from planqtn.legos import Legos
        >>> a = SignedStabilizerTensor(Legos.steane_code_813_encoding_tensor, tensor_id="a")
        >>> b = SignedStabilizerTensor(Legos.steane_code_813_encoding_tensor, tensor_id="b")
        >>> code = a.merge_with(b, [0], [0])
        >>> logical = [("a", 7), ("b", 7)]
        >>> cz = bitwise(Gates.CZ, [("a", i) for i in range(1, 7)], [("b", i) for i in range(1, 7)])
        >>> print(logical_action(code, logical, cz))
        None
        >>> cleaning = find_cleaning(code, logical, cz, target=Gates.CZ)
        >>> cleaning.correction
        [(Gate('Z'), (('a', 2),)), (Gate('Z'), (('a', 3),)), (Gate('Z'), (('a', 5),))]
        >>> cleaning.action.equals(Gates.CZ)
        True

        ```
    """
    logical, resolved, method = _prepare(
        tensor, logical_legs, ops, method, ("clifford", "diagonal")
    )
    if legs is None:
        allowed = [i for i in range(tensor.n) if i not in set(logical)]
    else:
        allowed = [tensor.legs.index(tensor.leg(leg)) for leg in legs]
        if set(allowed) & set(logical):
            raise ValueError("The correction can't act on logical legs.")
    logical_tensor_legs = [tensor.legs[i] for i in logical]
    target_matrix = None
    if target is not None:
        target_matrix = _expected_matrix(target, logical_tensor_legs)
        if target_matrix.shape != (2 ** len(logical), 2 ** len(logical)):
            raise ValueError(
                f"The target acts on {target_matrix.shape[0].bit_length() - 1} qubits, but "
                f"there are {len(logical)} logical legs."
            )
    if method == "clifford":
        bits = _pauli_correction(tensor, logical, resolved, allowed, target_matrix)
        if bits is None:
            return None
        u = len(allowed)
        paulis = {1: Gates.X, 2: Gates.Z, 3: Gates.Y}
        correction: GateAssignment = [
            (paulis[int(x) + 2 * int(z)], (tensor.legs[leg],))
            for leg, x, z in zip(allowed, bits[:u], bits[u:])
            if x or z
        ]
    else:
        z_bits = _z_correction(tensor, logical_tensor_legs, ops, allowed, target_matrix)
        if z_bits is None:
            return None
        correction = [
            (Gates.Z, (tensor.legs[leg],)) for leg, z in zip(allowed, z_bits) if z
        ]
    corrected = merge_gates(
        [(gate, tuple(tensor.legs[i] for i in qubits)) for gate, qubits in resolved],
        correction,
    )
    action = logical_action(tensor, logical_tensor_legs, corrected, method=method)
    assert action is not None, "the correction makes the operator logical"
    return Cleaning(correction, corrected, action)


def _pauli_correction(
    tensor: SignedStabilizerTensor,
    logical: List[int],
    ops: List[Tuple[Gate, Tuple[int, ...]]],
    allowed: List[int],
    target: Optional[NDArray[np.complex128]],
) -> Optional[NDArray[np.uint8]]:
    """The `(x|z)` bits on the allowed legs of a Pauli correction of a Clifford operator."""
    n, k = tensor.n, len(logical)
    logical_cols = logical + [n + i for i in logical]
    physical_cols = [c for c in range(2 * n) if c not in set(logical_cols)]
    by_logical = signed_rref(tensor.xz, tensor.phases, logical_cols)
    xz, ph, pivots = by_logical
    if len(pivots) != 2 * k:
        raise ValueError(
            "The logical legs are not maximally entangled with the rest of the tensor, "
            "so they do not define an encoding isometry."
        )
    target_images = None if target is None else _clifford_images(target)
    columns = [n + i for i in allowed] + allowed
    rows: List[NDArray[np.uint8]] = []
    rhs: List[int] = []

    full = signed_rref(tensor.xz, tensor.phases)
    num_logical_rows = 2 * k
    code_xz, code_ph = conjugate_paulis(
        xz[num_logical_rows:], ph[num_logical_rows:], ops
    )
    for v, p in zip(code_xz, code_ph):
        w, q = v.copy(), int(p)
        for row, col in full[2]:
            if w[col]:
                w, q = multiply_paulis(w, q, full[0][row], int(full[1][row]))
        if w.any():
            return None
        rows.append(v[columns])
        rhs.append(q // 2)

    by_physical = signed_rref(tensor.xz, tensor.phases, physical_cols)
    for i in range(2 * k):
        unit = np.zeros(2 * k, dtype=np.uint8)
        unit[i] = 1
        start = element_with_bits(by_logical, logical_cols, unit)
        assert start is not None, "every logical Pauli has a matching stabilizer"
        pushed_xz, pushed_ph = conjugate_paulis(start[0], np.array([start[1]]), ops)
        pushed = pushed_xz[0]
        match = element_with_bits(by_physical, physical_cols, pushed[physical_cols])
        if match is None:
            return None
        flip = 0
        if target_images is not None:
            image = match[0][logical_cols]
            difference = (int(target_images[1][i]) - int(pushed_ph[0]) + match[1]) % 4
            if not np.array_equal(image, target_images[0][i]) or difference % 2:
                return None
            flip = difference // 2
        rows.append(pushed[columns])
        rhs.append(flip)

    a = np.array(rows, dtype=np.uint8).reshape(-1, len(columns))
    solution = solve_gf2(a, np.array(rhs, dtype=np.uint8))
    if solution is None:
        return None
    u = len(allowed)
    return _reduce_weight(*solution, lambda b: int(np.count_nonzero(b[:u] | b[u:])))


def _z_correction(
    tensor: SignedStabilizerTensor,
    logical_legs: List[TensorLeg],
    ops: GateAssignment,
    allowed: List[int],
    target: Optional[NDArray[np.complex128]],
) -> Optional[NDArray[np.uint8]]:
    """The bits on the allowed legs of a Z-type correction of a diagonal operator."""
    coordinates = SupportCoordinates(tensor, logical_legs)
    k = coordinates.num_logical
    wanted: Dict[Tuple[int, ...], int] = {}
    target_order = 2
    if target is not None:
        try:
            target_phases, target_order = Gate("target", target).diagonal_phases()
        except ValueError as e:
            raise ValueError(
                "The target of a Z-type correction must be diagonal."
            ) from e
        target_action = DiagonalLogicalAction(logical_legs, target_phases, target_order)
        position = {leg: i for i, leg in enumerate(logical_legs)}
        wanted = {
            tuple(position[leg] for leg in term): c
            for term, c in target_action.phase_polynomial().items()
        }
    polynomial = coordinates.polynomial(ops, order=math.lcm(2, target_order))
    order = polynomial.order
    terms = polynomial.terms()
    if target is None:
        wanted = {m: c for m, c in terms.items() if m and max(m) < k}
    else:
        wanted = {m: c * (order // target_order) for m, c in wanted.items()}
    flips = np.zeros(coordinates.dimension, dtype=np.uint8)
    for monomial in set(terms) | set(wanted):
        if not monomial:
            continue
        difference = (wanted.get(monomial, 0) - terms.get(monomial, 0)) % order
        if difference == 0:
            continue
        if len(monomial) > 1 or difference != order // 2:
            return None
        flips[monomial[0]] = 1
    solution = solve_gf2(coordinates.basis[:, allowed].copy(), flips)
    if solution is None:
        return None
    return _reduce_weight(*solution, lambda b: int(np.count_nonzero(b)))


def _clifford_images(
    matrix: NDArray[np.complex128],
) -> Tuple[NDArray[np.uint8], NDArray[np.int64]]:
    """The XZ form images `U P U^dagger` of `X_1, ..., X_k, Z_1, ..., Z_k`."""
    k = len(matrix).bit_length() - 1
    images = np.zeros((2 * k, 2 * k), dtype=np.uint8)
    phases = np.zeros(2 * k, dtype=np.int64)
    for i in range(2 * k):
        unit = np.zeros(2 * k, dtype=np.uint8)
        unit[i] = 1
        image = pauli_from_matrix(matrix @ pauli_matrix(unit) @ matrix.conj().T)
        if image is None:
            raise ValueError(
                "The target of a Pauli correction must be a Clifford gate."
            )
        images[i], phases[i] = image
    return images, phases


def _reduce_weight(
    solution: NDArray[np.uint8],
    null: NDArray[np.uint8],
    weight: Callable[[NDArray[np.uint8]], int],
) -> NDArray[np.uint8]:
    """Greedily add null space vectors to the solution while that lowers its weight."""
    best = weight(solution)
    improved = True
    while improved:
        improved = False
        for v in null:
            candidate = solution ^ v
            candidate_weight = weight(candidate)
            if candidate_weight < best:
                solution, best, improved = candidate, candidate_weight, True
    return solution
