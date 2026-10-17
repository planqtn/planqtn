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
paper) have to be part of the assignment, e.g. a few Z gates next to the CZs of an intrablock CZ.

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
from typing import Dict, List, Mapping, Optional, Sequence, Tuple, Union

import numpy as np
from numpy.typing import NDArray

from planqtn.gates import Gate, GateAssignment, LegLike, operator_matrix, pauli_matrix
from planqtn.phase_polynomial import SupportCoordinates
from planqtn.signed_stabilizer_tensor import (
    SignedStabilizerTensor,
    conjugate_paulis,
    element_with_bits,
    multiply_paulis,
    signed_rref,
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

    def equals(
        self, expected: Union[Gate, NDArray[np.complex128], GateAssignment]
    ) -> bool:
        """Check whether the logical gate equals the expected one up to a global phase.

        Args:
            expected: A gate on all logical legs, a matrix, or a gate assignment on the logical
                legs, given in the same form as the logical legs of this action.

        Returns:
            Whether the two gates are equal up to a global phase.
        """
        if isinstance(expected, Gate):
            target = expected.matrix
        elif isinstance(expected, np.ndarray):
            target = expected
        else:
            target = operator_matrix(expected, self.logical_legs)
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
        phases: Optional[Sequence[int]],
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
    if method == "clifford":
        non_clifford = [g.name for g in gates if not g.is_clifford]
        if non_clifford:
            raise ValueError(f"Gates {non_clifford} are not Clifford gates.")
        return _clifford_action(tensor, logical, resolved)
    if method in ("diagonal", "enumerate"):
        non_diagonal = [g.name for g in gates if not g.is_diagonal]
        if non_diagonal:
            raise ValueError(
                f"Gates {non_diagonal} are not diagonal, and only Clifford gates can be "
                "mixed with non-diagonal ones."
            )
        if method == "enumerate":
            return _diagonal_action(tensor, logical, resolved, max_support_dimension)
        return _polynomial_action(tensor, [tensor.legs[i] for i in logical], ops)
    raise ValueError(
        f"Unknown method {method}, use 'auto', 'clifford', 'diagonal' or 'enumerate'."
    )
