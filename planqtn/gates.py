"""Unitary gates for Clifford-deformed traces and transversal gate analysis.

The [`Gate`][planqtn.gates.Gate] class wraps the matrix of a unitary on one or more qubits and
derives what the stabilizer machinery needs from it: the Pauli conjugation table of a Clifford
gate and the phase exponents of a diagonal gate. [`Gates`][planqtn.gates.Gates] collects the gates
that appear in the quantum LEGO literature. A [`GateAssignment`][planqtn.gates.GateAssignment]
describes a physical operator as a product of gates on disjoint groups of tensor legs, and
[`bitwise`][planqtn.gates.bitwise] builds the common bitwise (strongly transversal) assignments.

Matrices use the usual tensor product ordering: the first qubit of a gate is the most significant
bit of the basis state index.

Example:
    ```python
    >>> from planqtn.gates import Gates, bitwise
    >>> Gates.T.is_clifford, Gates.T.is_diagonal
    (False, True)
    >>> Gates.K3.is_clifford
    True
    >>> Gates.CCZ.diagonal_phases()
    (array([0, 0, 0, 0, 0, 0, 0, 1]), 2)
    >>> # CZ between the matching legs of two blocks
    >>> bitwise(Gates.CZ, [("a", 0), ("a", 1)], [("b", 0), ("b", 1)])
    [(Gate('CZ'), (('a', 0), ('b', 0))), (Gate('CZ'), (('a', 1), ('b', 1)))]

    ```
"""

from fractions import Fraction
import math
from typing import Any, List, Optional, Sequence, Tuple, Union

import numpy as np
from numpy.typing import ArrayLike, NDArray

from planqtn.tensor import TensorLeg

LegLike = Union[int, TensorLeg]
"""A tensor leg, or a leg index that is resolved against the tensor's own `tensor_id`."""

_PAULI_X = np.array([[0, 1], [1, 0]], dtype=complex)
_PAULI_Z = np.array([[1, 0], [0, -1]], dtype=complex)


def pauli_matrix(xz: ArrayLike, phase: int = 0) -> NDArray[np.complex128]:
    """Return the matrix of the Pauli operator `i^phase X^x Z^z` in the XZ form.

    Args:
        xz: The symplectic bits `(x_1, ..., x_q, z_1, ..., z_q)`.
        phase: The exponent of `i` in front of `X^x Z^z`.

    Returns:
        The `2^q x 2^q` matrix.
    """
    bits = np.asarray(xz).reshape(-1)
    q = len(bits) // 2
    m = np.ones((1, 1), dtype=complex)
    for i in range(q):
        factor = np.eye(2, dtype=complex)
        if bits[i]:
            factor = factor @ _PAULI_X
        if bits[q + i]:
            factor = factor @ _PAULI_Z
        m = np.kron(m, factor)
    return complex(1j**phase) * m


def pauli_from_matrix(
    m: NDArray[np.complex128],
) -> Optional[Tuple[NDArray[np.uint8], int]]:
    """Write a matrix as a Pauli operator `i^p X^x Z^z` in the XZ form.

    Args:
        m: A `2^q x 2^q` matrix.

    Returns:
        The symplectic bits `(x|z)` and the phase exponent `p`, or None if the matrix is not a
        Pauli operator with a phase that is a power of `i`.
    """
    dim = len(m)
    q = dim.bit_length() - 1
    row = int(np.argmax(np.abs(m[:, 0])))
    coefficient = complex(m[row, 0])
    if not np.isclose(abs(coefficient), 1.0):
        return None
    phase = int(round(np.angle(coefficient) / (np.pi / 2))) % 4
    x = [(row >> (q - 1 - i)) & 1 for i in range(q)]
    z = []
    for i in range(q):
        basis = 1 << (q - 1 - i)
        z.append(0 if np.isclose(m[basis ^ row, basis], coefficient) else 1)
    bits = np.array(x + z, dtype=np.uint8)
    if not np.allclose(m, pauli_matrix(bits, phase), atol=1e-9):
        return None
    return bits, phase


class Gate:
    """A unitary gate on one or more qubits.

    A gate is identified by its matrix; the name is only used for display. Clifford gates can be
    used to deform traces and to conjugate stabilizers
    ([`pauli_conjugation_table`][planqtn.gates.Gate.pauli_conjugation_table]), while diagonal
    gates (Clifford or not, e.g. T, CS or CCZ) are handled through their phase exponents
    ([`diagonal_phases`][planqtn.gates.Gate.diagonal_phases]).
    """

    def __init__(self, name: str, matrix: ArrayLike):
        """Construct a gate.

        Args:
            name: Display name of the gate.
            matrix: The unitary matrix of the gate, of size `2^q x 2^q` for `q >= 1` qubits.

        Raises:
            ValueError: If the matrix is not a unitary on one or more qubits.
        """
        u = np.array(matrix, dtype=complex)
        if (
            u.ndim != 2
            or u.shape[0] != u.shape[1]
            or u.shape[0] < 2
            or u.shape[0] & (u.shape[0] - 1)
        ):
            raise ValueError(
                f"Gate {name} needs a 2^q x 2^q matrix, got shape {u.shape}."
            )
        if not np.allclose(u @ u.conj().T, np.eye(len(u)), atol=1e-9):
            raise ValueError(f"Gate {name} is not unitary.")
        u.setflags(write=False)
        self.name = name
        self.num_qubits = len(u).bit_length() - 1
        self._matrix = u
        self._pauli_table: Optional[Tuple[NDArray[np.uint8], NDArray[np.int64]]] = None
        self._is_clifford: Optional[bool] = None

    @property
    def matrix(self) -> NDArray[np.complex128]:
        """The (read-only) unitary matrix of the gate."""
        return self._matrix

    def __repr__(self) -> str:
        return f"Gate({self.name!r})"

    def __str__(self) -> str:
        return self.name

    @property
    def is_diagonal(self) -> bool:
        """Whether the gate is diagonal in the computational basis."""
        return bool(np.allclose(self._matrix, np.diag(np.diag(self._matrix))))

    @property
    def is_clifford(self) -> bool:
        """Whether the gate maps Pauli operators to Pauli operators under conjugation."""
        if self._is_clifford is None:
            try:
                self.pauli_conjugation_table()
                self._is_clifford = True
            except ValueError:
                self._is_clifford = False
        return self._is_clifford

    def dagger(self) -> "Gate":
        """Return the inverse (conjugate transpose) of the gate."""
        name = self.name[:-1] if self.name.endswith("†") else self.name + "†"
        return Gate(name, self._matrix.conj().T)

    def conj(self) -> "Gate":
        """Return the entrywise complex conjugate of the gate."""
        name = self.name[:-1] if self.name.endswith("*") else self.name + "*"
        return Gate(name, self._matrix.conj())

    def transpose(self) -> "Gate":
        """Return the transpose of the gate."""
        name = self.name[:-1] if self.name.endswith("ᵀ") else self.name + "ᵀ"
        return Gate(name, self._matrix.T)

    def pauli_conjugation_table(
        self,
    ) -> Tuple[NDArray[np.uint8], NDArray[np.int64]]:
        """Return how the gate conjugates each Pauli operator in the XZ form.

        Row `key` of the table describes `U X^x Z^z U^dagger = i^phase X^x' Z^z'`, where
        `key` is the integer with the big endian bits `(x_1, ..., x_q, z_1, ..., z_q)`.

        Returns:
            The images `(x', z')` as a `4^q x 2q` array and the phases as an array of length `4^q`.

        Raises:
            ValueError: If the gate is not a Clifford gate.
        """
        if self._pauli_table is None:
            q = self.num_qubits
            images = np.zeros((4**q, 2 * q), dtype=np.uint8)
            phases = np.zeros(4**q, dtype=np.int64)
            for key in range(4**q):
                bits = [(key >> (2 * q - 1 - i)) & 1 for i in range(2 * q)]
                image = pauli_from_matrix(
                    self._matrix @ pauli_matrix(bits) @ self._matrix.conj().T
                )
                if image is None:
                    raise ValueError(f"Gate {self.name} is not a Clifford gate.")
                images[key], phases[key] = image
            images.setflags(write=False)
            phases.setflags(write=False)
            self._pauli_table = (images, phases)
        return self._pauli_table

    def diagonal_phases(self, max_order: int = 4096) -> Tuple[NDArray[np.int64], int]:
        """Return the phases of a diagonal gate as exponents of a root of unity.

        The gate equals `diag(exp(2 pi i e_b / order))` up to a global phase, normalized so that
        `e_0 = 0`.

        Args:
            max_order: The largest root of unity order to consider.

        Returns:
            The exponents `e_b` for each basis state `b` and the order.

        Raises:
            ValueError: If the gate is not diagonal or its phases are not roots of unity of order
                at most `max_order`.
        """
        if not self.is_diagonal:
            raise ValueError(f"Gate {self.name} is not diagonal.")
        diagonal = np.diag(self._matrix)
        turns = (np.angle(diagonal / diagonal[0]) / (2 * np.pi)) % 1.0
        fractions = [Fraction(float(t)).limit_denominator(max_order) for t in turns]
        for t, f in zip(turns, fractions):
            if abs((t - float(f) + 0.5) % 1.0 - 0.5) > 1e-9:
                raise ValueError(
                    f"Gate {self.name} has a phase that is not a root of unity of order "
                    f"at most {max_order}."
                )
        order = math.lcm(*(f.denominator for f in fractions))
        exponents = np.array(
            [(f.numerator * (order // f.denominator)) % order for f in fractions],
            dtype=np.int64,
        )
        return exponents, order


GateAssignment = List[Tuple[Gate, Tuple[LegLike, ...]]]
"""A physical operator: a list of gates, each acting on a tuple of legs.

For transversal gate analysis the leg tuples must be disjoint, so the order of the list does not
matter. The i-th leg of a tuple is the i-th qubit of the gate.
"""


def bitwise(gate: Gate, *blocks: Sequence[LegLike]) -> GateAssignment:
    """Apply a gate bitwise: once on the i-th legs of all blocks, for every i.

    With a single block of legs this is the bitwise (strongly transversal) single qubit gate
    `gate^{(x) n}`. With multiple blocks it is the bitwise interblock gate, e.g.
    `bitwise(Gates.CZ, legs_a, legs_b)` applies CZ between the matching legs of two blocks.

    Args:
        gate: A gate acting on `len(blocks)` qubits.
        *blocks: Equally long sequences of legs.

    Returns:
        The gate assignment.

    Raises:
        ValueError: If the number of blocks does not match the number of qubits of the gate, or
            the blocks have different lengths.
    """
    if len(blocks) != gate.num_qubits:
        raise ValueError(
            f"Gate {gate.name} acts on {gate.num_qubits} qubits, got {len(blocks)} blocks."
        )
    lengths = {len(block) for block in blocks}
    if len(lengths) > 1:
        raise ValueError(f"Blocks have different lengths: {sorted(lengths)}.")
    return [(gate, tuple(legs)) for legs in zip(*blocks)]


def operator_matrix(
    ops: GateAssignment, legs: Sequence[LegLike]
) -> NDArray[np.complex128]:
    """Return the dense matrix of a gate assignment on an ordered list of legs.

    Gates are applied in list order, so overlapping gates are allowed here.

    Args:
        ops: The gate assignment. Its legs have to be given in the same form as in `legs`.
        legs: The legs, the first one being the most significant qubit of the matrix.

    Returns:
        The `2^k x 2^k` matrix for `k = len(legs)`.

    Raises:
        ValueError: If a gate acts on a leg that is not in `legs`.
    """
    k = len(legs)
    position = {leg: i for i, leg in enumerate(legs)}
    op: Any = np.eye(2**k, dtype=complex).reshape([2] * (2 * k))
    for gate, gate_legs in ops:
        missing = [leg for leg in gate_legs if leg not in position]
        if missing:
            raise ValueError(
                f"Gate {gate.name} acts on legs {missing} outside of {legs}."
            )
        q = gate.num_qubits
        axes = [position[leg] for leg in gate_legs]
        g = gate.matrix.reshape([2] * (2 * q))
        op = np.tensordot(g, op, axes=(list(range(q, 2 * q)), axes))
        op = np.moveaxis(op, list(range(q)), axes)
    return np.asarray(op, dtype=complex).reshape(2**k, 2**k)


def merge_gates(first: GateAssignment, then: GateAssignment) -> GateAssignment:
    """Return the operator that applies `first` and then `then`, on disjoint legs.

    Each gate of `then` has to act on legs of a single gate of `first`, which absorbs it, or on
    legs that `first` does not touch. For example, a Z gate after a CZ becomes the gate `(IZ)·CZ`.
    Legs have to be given in the same form in both assignments.

    Args:
        first: The gates applied first, on disjoint legs.
        then: The gates applied afterwards, on disjoint legs.

    Returns:
        The product as a gate assignment on disjoint legs.

    Raises:
        ValueError: If a gate of `then` overlaps with a gate of `first` without being contained
            in its legs.

    Example:
        ```python
        >>> merged = merge_gates([(Gates.CZ, (0, 1))], [(Gates.Z, (1,)), (Gates.X, (2,))])
        >>> merged
        [(Gate('(IZ)·CZ'), (0, 1)), (Gate('X'), (2,))]
        >>> bool(np.allclose(merged[0][0].matrix, np.diag([1, -1, 1, 1])))
        True

        ```
    """
    absorbed: List[GateAssignment] = [[] for _ in first]
    rest: GateAssignment = []
    for gate, legs in then:
        owners = [i for i, (_, f_legs) in enumerate(first) if set(f_legs) & set(legs)]
        if not owners:
            rest.append((gate, legs))
        elif len(owners) == 1 and set(legs) <= set(first[owners[0]][1]):
            absorbed[owners[0]].append((gate, legs))
        else:
            raise ValueError(
                f"Gate {gate.name} on {legs} straddles gates of the operator."
            )
    merged: GateAssignment = []
    for (gate, legs), extra in zip(first, absorbed):
        if not extra:
            merged.append((gate, legs))
            continue
        if all(e.num_qubits == 1 for e, _ in extra):
            labels = {e_legs[0]: e.name for e, e_legs in extra}
            prefix = "(" + "".join(labels.get(leg, "I") for leg in legs) + ")"
        else:
            prefix = "·".join(e.name for e, _ in reversed(extra))
        matrix = operator_matrix(extra, legs) @ gate.matrix
        merged.append((Gate(f"{prefix}·{gate.name}", matrix), legs))
    return merged + rest


def equal_up_to_phase(a: NDArray[np.complex128], b: NDArray[np.complex128]) -> bool:
    """Check whether two unitary matrices are equal up to a global phase.

    Args:
        a: A unitary matrix.
        b: Another unitary matrix.

    Returns:
        Whether `a = e^(i phi) b` for some phase `phi`.
    """
    return a.shape == b.shape and bool(np.isclose(abs(np.vdot(a, b)), len(a)))


_SQRT2 = np.sqrt(2)
_S = np.diag([1, 1j])
_H = np.array([[1, 1], [1, -1]]) / _SQRT2


class Gates:
    """A collection of predefined gates.

    Besides the Paulis and the usual Clifford hierarchy gates, it contains `SH` (transversal on
    the [[5,1,3]] code) and Gottesman's three qubit Clifford gate `K3`, transversal across three
    blocks of the [[5,1,3]] code, using the matrix from Eq. (6) of ChunJun Cao and Brad Lackey,
    "Quantum Lego Power-up: Designing Transversal Gates with Tensor Networks", arXiv:2603.03542
    (2026).

    Example:
        ```python
        >>> Gates.S.dagger()
        Gate('S†')
        >>> Gates.controlled_phase(2, 1, 4).diagonal_phases()
        (array([0, 0, 0, 1]), 4)

        ```
    """

    I = Gate("I", np.eye(2))
    X = Gate("X", _PAULI_X)
    Y = Gate("Y", [[0, -1j], [1j, 0]])
    Z = Gate("Z", _PAULI_Z)
    H = Gate("H", _H)
    S = Gate("S", _S)
    S_DAG = S.dagger()
    T = Gate("T", np.diag([1, np.exp(1j * np.pi / 4)]))
    T_DAG = T.dagger()
    SH = Gate("SH", _S @ _H)
    CNOT = Gate("CNOT", [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0, 1], [0, 0, 1, 0]])
    CZ = Gate("CZ", np.diag([1, 1, 1, -1]))
    CS = Gate("CS", np.diag([1, 1, 1, 1j]))
    CS_DAG = CS.dagger()
    CCZ = Gate("CCZ", np.diag([1, 1, 1, 1, 1, 1, 1, -1]))
    K3 = Gate(
        "K3",
        np.array(
            [
                [1, 0, 1j, 0, 1j, 0, 1, 0],
                [0, -1, 0, 1j, 0, 1j, 0, -1],
                [0, 1j, 0, 1, 0, -1, 0, -1j],
                [1j, 0, -1, 0, 1, 0, -1j, 0],
                [0, 1j, 0, -1, 0, 1, 0, -1j],
                [1j, 0, 1, 0, -1, 0, -1j, 0],
                [-1, 0, 1j, 0, 1j, 0, -1, 0],
                [0, 1, 0, 1j, 0, 1j, 0, 1],
            ]
        )
        / 2,
    )

    @staticmethod
    def single_qubit_cliffords() -> List[Gate]:
        """Return the 24 single qubit Clifford gates, up to global phases.

        Gates with a name in this collection (I, X, Y, Z, H, S, S†, SH) keep it, the others are
        named as a Pauli times one of `H`, `S`, `SH`, `HS` and `HSH`, in matrix order, e.g. `XS`
        is `X @ S`.

        Returns:
            The gates, starting with the Paulis.
        """
        found = [Gates.I, Gates.X, Gates.Y, Gates.Z, Gates.H, Gates.S, Gates.S_DAG]
        found.append(Gates.SH)
        h, s = Gates.H.matrix, Gates.S.matrix
        cosets = [("H", h), ("S", s), ("SH", s @ h), ("HS", h @ s), ("HSH", h @ s @ h)]
        for pauli in (Gates.I, Gates.X, Gates.Y, Gates.Z):
            for coset_name, coset in cosets:
                matrix = pauli.matrix @ coset
                if not any(equal_up_to_phase(matrix, g.matrix) for g in found):
                    name = coset_name if pauli is Gates.I else pauli.name + coset_name
                    found.append(Gate(name, matrix))
        return found

    @staticmethod
    def phase(numerator: int, order: int) -> Gate:
        """Return the single qubit phase gate `P(2 pi numerator / order) = diag(1, e^(i phi))`.

        Args:
            numerator: The numerator of the angle in units of `2 pi / order`.
            order: The denominator of the angle in units of `2 pi`.

        Returns:
            The phase gate.
        """
        return Gates.controlled_phase(1, numerator, order)

    @staticmethod
    def controlled_phase(num_qubits: int, numerator: int, order: int) -> Gate:
        """Return the multi-controlled phase gate `C^(num_qubits - 1) P(2 pi numerator / order)`.

        Args:
            num_qubits: The number of qubits, including the target.
            numerator: The numerator of the angle in units of `2 pi / order`.
            order: The denominator of the angle in units of `2 pi`.

        Returns:
            The diagonal gate with phase `exp(2 pi i numerator / order)` on `|1...1>`.
        """
        diagonal = np.ones(2**num_qubits, dtype=complex)
        diagonal[-1] = np.exp(2j * np.pi * numerator / order)
        name = "C" * (num_qubits - 1) + f"P(2π·{Fraction(numerator, order)})"
        return Gate(name, np.diag(diagonal))
