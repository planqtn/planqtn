"""Signed stabilizer tensors and Clifford-deformed traces.

A [`StabilizerCodeTensorEnumerator`][planqtn.StabilizerCodeTensorEnumerator] represents a LEGO by
its parity check matrix over GF(2), which is all that weight enumerators need. Gates beyond Paulis
are sensitive to the signs of the stabilizers though. For example, tracing two legs with the Bell
state `|Φ+⟩` or with the X-deformed edge `|Φ_X⟩ = (I ⊗ X)|Φ+⟩` gives the same parity check matrix,
but only one of the two results keeps `T^{(x) n}` transversal.

[`SignedStabilizerTensor`][planqtn.signed_stabilizer_tensor.SignedStabilizerTensor] keeps track of
the signs. It supports the generalized traces of ChunJun Cao and Brad Lackey, "Quantum Lego
Power-up: Designing Transversal Gates with Tensor Networks", arXiv:2603.03542 (2026):

- traces with the Bell state and with Clifford-deformed edge states `|Φ_C⟩ = (I ⊗ C)|Φ+⟩`
  (Definition 3.6), see
  [`self_trace`][planqtn.signed_stabilizer_tensor.SignedStabilizerTensor.self_trace],
- hyperedge traces with GHZ states (Definition 3.10), by tracing legs with a
  [`Legos.z_rep_code`][planqtn.Legos.z_rep_code] tensor,
- applying Clifford gates to legs, e.g. to deform a LEGO before tracing.

Stabilizers are stored as rows `(x|z)` with a phase exponent `p` in the XZ form `i^p X^x Z^z`. The
public API uses signs instead: a row with sign `s` is the Hermitian Pauli `s P`, where `P` has
`Y` on the legs with `x = z = 1`, matching the parity check matrix convention of PlanqTN.

Example:
    Tracing the second qubit of `|00⟩` with `|1⟩` through the Bell state gives zero, while the
    X-deformed edge state `|Φ_X⟩ = |01⟩ + |10⟩` leaves the first qubit in `|0⟩`:

    ```python
    >>> from planqtn.gates import Gates
    >>> zeros = SignedStabilizerTensor.from_pauli_strings(["ZI", "IZ"], tensor_id="a")
    >>> one = SignedStabilizerTensor.from_pauli_strings(["-Z"], tensor_id="b")
    >>> zeros.merge_with(one, [1], [0])  # doctest: +IGNORE_EXCEPTION_DETAIL
    Traceback (most recent call last):
    ...
    planqtn.signed_stabilizer_tensor.ContractionVanishesError: ...
    >>> zeros.merge_with(one, [1], [0], deformations=[Gates.X]).pauli_strings()
    ['+Z']

    ```
"""

from typing import (
    TYPE_CHECKING,
    Dict,
    List,
    Mapping,
    Optional,
    Sequence,
    Tuple,
    Union,
)

from galois import GF2
import numpy as np
from numpy.typing import ArrayLike, NDArray

from planqtn.gates import Gate, GateAssignment, LegLike
from planqtn.tensor import TensorId, TensorLeg

if TYPE_CHECKING:
    from planqtn.tensor_network import TensorNetwork

PauliArrays = Tuple[NDArray[np.uint8], NDArray[np.int64]]
"""Rows of XZ form Pauli operators: the `(x|z)` bits and the phase exponents of `i`."""

_PAULI_LABELS = "IXZY"


def _as_leg(tensor_id: TensorId, leg: LegLike) -> TensorLeg:
    return (tensor_id, leg) if isinstance(leg, int) else leg


def _symplectic_products(
    xz: NDArray[np.uint8], v: NDArray[np.uint8]
) -> NDArray[np.int64]:
    n = xz.shape[1] // 2
    a = xz.astype(np.int64)
    b = v.astype(np.int64)
    return (a[:, :n] @ b[n:] + a[:, n:] @ b[:n]) & 1


def _multiply_rows(
    xz: NDArray[np.uint8],
    ph: NDArray[np.int64],
    rows: NDArray[np.int64],
    g_xz: NDArray[np.uint8],
    g_ph: int,
) -> None:
    """In place, replace each of the given rows `r` by the product `r g`."""
    if len(rows) == 0:
        return
    n = xz.shape[1] // 2
    flips = (xz[rows, n:].astype(np.int64) @ g_xz[:n].astype(np.int64)) & 1
    ph[rows] = (ph[rows] + g_ph + 2 * flips) % 4
    xz[rows] ^= g_xz


def multiply_paulis(
    a_xz: NDArray[np.uint8], a_ph: int, b_xz: NDArray[np.uint8], b_ph: int
) -> Tuple[NDArray[np.uint8], int]:
    """Multiply two XZ form Pauli operators, `a b`.

    Args:
        a_xz: The `(x|z)` bits of `a`.
        a_ph: The phase exponent of `a`.
        b_xz: The `(x|z)` bits of `b`.
        b_ph: The phase exponent of `b`.

    Returns:
        The bits and phase exponent of the product.
    """
    n = len(a_xz) // 2
    flip = int(np.count_nonzero(a_xz[n:] & b_xz[:n])) & 1
    return a_xz ^ b_xz, (a_ph + b_ph + 2 * flip) % 4


def signed_rref(
    xz: NDArray[np.uint8], ph: NDArray[np.int64], cols: Optional[Sequence[int]] = None
) -> Tuple[NDArray[np.uint8], NDArray[np.int64], List[Tuple[int, int]]]:
    """Row reduce XZ form Pauli rows while keeping track of the phases.

    The rows of the result generate the same group as the input. Each pivot column has a single
    nonzero entry, and rows below the pivot rows are zero on all the given columns.

    Args:
        xz: The `(x|z)` bits of the rows.
        ph: The phase exponents of the rows.
        cols: The columns to eliminate, in order. Defaults to all columns.

    Returns:
        The reduced rows, their phases and the `(row, column)` pivots.
    """
    xz, ph = xz.copy(), ph.copy()
    pivots: List[Tuple[int, int]] = []
    row = 0
    order = range(xz.shape[1]) if cols is None else cols
    for col in order:
        if row == len(xz):
            break
        nonzero = np.flatnonzero(xz[row:, col])
        if len(nonzero) == 0:
            continue
        k = row + int(nonzero[0])
        if k != row:
            xz[[row, k]] = xz[[k, row]]
            ph[[row, k]] = ph[[k, row]]
        others = np.flatnonzero(xz[:, col])
        _multiply_rows(xz, ph, others[others != row], xz[row].copy(), int(ph[row]))
        pivots.append((row, col))
        row += 1
    return xz, ph, pivots


def element_with_bits(
    rref: Tuple[NDArray[np.uint8], NDArray[np.int64], List[Tuple[int, int]]],
    cols: Sequence[int],
    target: NDArray[np.uint8],
) -> Optional[Tuple[NDArray[np.uint8], int]]:
    """Find a group element that has the given bits on the given columns.

    Args:
        rref: The output of [`signed_rref`][planqtn.signed_stabilizer_tensor.signed_rref] called
            with the same `cols`.
        cols: The columns to match.
        target: The required bits, one for each column in `cols`.

    Returns:
        The bits and phase exponent of a matching group element, or None if there is none.
    """
    xz, ph, pivots = rref
    position = {c: i for i, c in enumerate(cols)}
    element = np.zeros(xz.shape[1], dtype=np.uint8)
    phase = 0
    for row, col in pivots:
        if element[col] != target[position[col]]:
            element, phase = multiply_paulis(element, phase, xz[row], int(ph[row]))
    if not np.array_equal(element[list(cols)], target):
        return None
    return element, phase


def conjugate_paulis(
    xz: NDArray[np.uint8],
    ph: NDArray[np.int64],
    ops: Sequence[Tuple[Gate, Sequence[int]]],
) -> PauliArrays:
    """Conjugate Pauli rows by a product of Clifford gates on disjoint qubits, `U P U^dagger`.

    Args:
        xz: The `(x|z)` bits of the rows (a single row is allowed too).
        ph: The phase exponents of the rows.
        ops: Pairs of a Clifford gate and the qubit (column) indices it acts on.

    Returns:
        The conjugated rows and their phase exponents.
    """
    xz = np.array(xz, dtype=np.uint8).reshape(-1, np.shape(xz)[-1])
    ph = np.array(ph, dtype=np.int64).reshape(-1)
    n = xz.shape[1] // 2
    for gate, qubits in ops:
        images, phase_shifts = gate.pauli_conjugation_table()
        q = gate.num_qubits
        cols = list(qubits) + [n + i for i in qubits]
        keys = xz[:, cols].astype(np.int64) @ (1 << np.arange(2 * q - 1, -1, -1))
        xz[:, cols] = images[keys]
        ph = (ph + phase_shifts[keys]) % 4
    return xz, ph


def _row_combination(
    xz: NDArray[np.uint8], target: NDArray[np.uint8]
) -> Optional[NDArray[np.uint8]]:
    """Find `c` with `c xz = target` over GF(2), or None if there is no solution."""
    r, cols = xz.shape
    aug = np.concatenate([xz, np.eye(r, dtype=np.uint8)], axis=1)
    pivots = []
    row = 0
    for col in range(cols):
        if row == r:
            break
        nonzero = np.flatnonzero(aug[row:, col])
        if len(nonzero) == 0:
            continue
        k = row + int(nonzero[0])
        if k != row:
            aug[[row, k]] = aug[[k, row]]
        others = np.flatnonzero(aug[:, col])
        aug[others[others != row]] ^= aug[row]
        pivots.append(col)
        row += 1
    rest = np.concatenate([target, np.zeros(r, dtype=np.uint8)])
    for i, col in enumerate(pivots):
        if rest[col]:
            rest ^= aug[i]
    if rest[:cols].any():
        return None
    return rest[cols:]


def independent_subset(rows: NDArray[np.uint8]) -> List[int]:
    """Return the indices of the rows that are independent of the earlier rows over GF(2).

    Args:
        rows: A 2D array of bits.

    Returns:
        The indices of a maximal independent subset of the rows, chosen greedily in order.
    """
    basis: List[Tuple[int, NDArray[np.uint8]]] = []
    keep = []
    for i, row in enumerate(rows):
        v = row.copy()
        for col, b in basis:
            if v[col]:
                v ^= b
        if v.any():
            basis.append((int(np.flatnonzero(v)[0]), v))
            keep.append(i)
    return keep


def _independent_rows(xz: NDArray[np.uint8], ph: NDArray[np.int64]) -> PauliArrays:
    """Drop the rows that are products of earlier rows, keeping the others as they are."""
    n = xz.shape[1] // 2
    basis: List[Tuple[int, NDArray[np.uint8], int]] = []
    keep = []
    for i, (row_xz, row_ph) in enumerate(zip(xz, ph)):
        v, p = row_xz.copy(), int(row_ph)
        for col, b_xz, b_ph in basis:
            if v[col]:
                v, p = multiply_paulis(v, p, b_xz, b_ph)
        if v.any():
            basis.append((int(np.flatnonzero(v)[0]), v, p))
            keep.append(i)
        elif p != 0:
            raise ValueError(
                f"The signs of the stabilizers are inconsistent: row {i} is "
                f"{'-' if p == 2 else '±i'} times a product of other rows (on {n} legs)."
            )
    return xz[keep], ph[keep]


def _postselect(
    xz: NDArray[np.uint8],
    ph: NDArray[np.int64],
    m_xz: NDArray[np.uint8],
    m_ph: int,
    keep_row: Optional[int] = None,
) -> Tuple[NDArray[np.uint8], NDArray[np.int64], int]:
    """Project onto the +1 eigenspace of the Hermitian Pauli `m`.

    Returns the new rows and the index of the row that equals `m`. The row `keep_row` is left
    untouched, which requires it to commute with `m`.
    """
    anticommuting = np.flatnonzero(_symplectic_products(xz, m_xz))
    if len(anticommuting) > 0:
        k = int(anticommuting[0])
        _multiply_rows(xz, ph, anticommuting[1:], xz[k].copy(), int(ph[k]))
        xz[k], ph[k] = m_xz, m_ph
        return xz, ph, k
    combination = _row_combination(xz, m_xz)
    if combination is None:
        return np.vstack([xz, m_xz]), np.append(ph, m_ph), len(xz)
    rows = [int(r) for r in np.flatnonzero(combination)]
    product, phase = np.zeros_like(m_xz), 0
    for r in rows:
        product, phase = multiply_paulis(product, phase, xz[r], int(ph[r]))
    if (phase - m_ph) % 4 != 0:
        raise ContractionVanishesError("-m is a stabilizer")
    k = next(r for r in rows if r != keep_row)
    xz[k], ph[k] = m_xz, m_ph
    return xz, ph, k


class ContractionVanishesError(ValueError):
    """Raised when a trace annihilates a tensor, i.e. the contraction is the zero tensor."""


class SignedStabilizerTensor:
    """A stabilizer tensor that keeps track of the signs of its stabilizers.

    The tensor is the (unnormalized) stabilizer state, or for fewer stabilizers than legs the
    projector onto the stabilized subspace, of its stabilizer group. Instances are immutable:
    tracing, tensoring and applying gates return new tensors. Legs are labelled with
    [`TensorLeg`][planqtn.tensor.TensorLeg] tuples, like in the rest of PlanqTN, and leg indices
    passed as integers refer to the legs of the tensor with the tensor's own `tensor_id`.

    Example:
        Two Bell pairs contracted into a single one, once through a Bell state and once
        through the Y-deformed edge state `|Φ_Y⟩`, which is the singlet:

        ```python
        >>> from planqtn.gates import Gates
        >>> from planqtn.legos import Legos
        >>> a = SignedStabilizerTensor(Legos.identity, tensor_id="a")
        >>> b = SignedStabilizerTensor(Legos.identity, tensor_id="b")
        >>> a.merge_with(b, [1], [0]).pauli_strings()
        ['+XX', '+ZZ']
        >>> a.merge_with(b, [1], [0], deformations=[Gates.Y]).pauli_strings()
        ['-XX', '-ZZ']

        ```
    """

    def __init__(
        self,
        h: ArrayLike,
        tensor_id: TensorId = 0,
        legs: Optional[Sequence[TensorLeg]] = None,
        signs: Optional[Sequence[int]] = None,
        *,
        phases: Optional[ArrayLike] = None,
        validate: bool = True,
    ):
        """Construct a signed stabilizer tensor.

        Args:
            h: The parity check matrix in symplectic `(x|z)` form, one row per stabilizer.
            tensor_id: The id of the tensor, used to label the legs.
            legs: The legs of the tensor, by default `(tensor_id, i)` for each qubit `i`.
            signs: The sign (+1 or -1) of each stabilizer, by default all +1.
            phases: Alternatively to `signs`, the phase exponents of the rows in the XZ form
                `i^p X^x Z^z`.
            validate: Whether to check that the stabilizers commute and have consistent signs,
                and to drop redundant rows. Only skip this for rows that are known to be
                independent generators of a stabilizer group.

        Raises:
            ValueError: If the inputs have inconsistent sizes, or the rows do not commute or have
                inconsistent signs.
        """
        xz = np.array(h, dtype=np.uint8) % 2
        if xz.ndim == 1:
            xz = xz.reshape(1, -1)
        if xz.ndim != 2 or xz.shape[1] % 2:
            raise ValueError(f"Invalid parity check matrix shape {xz.shape}.")
        n = xz.shape[1] // 2
        legs = [(tensor_id, i) for i in range(n)] if legs is None else list(legs)
        if len(legs) != n or len(set(legs)) != n:
            raise ValueError(f"Need {n} distinct legs, got {legs}.")
        if phases is not None:
            ph = np.array(phases, dtype=np.int64).reshape(-1) % 4
        else:
            signs = [1] * len(xz) if signs is None else list(signs)
            if any(s not in (1, -1) for s in signs):
                raise ValueError(f"Signs must be +1 or -1, got {signs}.")
            ph = (
                np.count_nonzero(xz[:, :n] & xz[:, n:], axis=1)
                + np.where(np.array(signs, dtype=np.int64) == 1, 0, 2)
            ) % 4
        if len(ph) != len(xz):
            raise ValueError(f"Got {len(ph)} signs or phases for {len(xz)} rows.")
        if validate:
            gram = (
                xz[:, :n].astype(np.int64) @ xz[:, n:].T.astype(np.int64)
                + xz[:, n:].astype(np.int64) @ xz[:, :n].T.astype(np.int64)
            ) & 1
            if gram.any():
                raise ValueError("The stabilizers do not commute.")
            if np.any((ph - np.count_nonzero(xz[:, :n] & xz[:, n:], axis=1)) % 2):
                raise ValueError("The stabilizers have to be Hermitian.")
            xz, ph = _independent_rows(xz, ph)
        xz.setflags(write=False)
        ph.setflags(write=False)
        self.tensor_id = tensor_id
        self.legs: List[TensorLeg] = legs
        self._xz = xz
        self._ph = ph
        self._rref: Optional[
            Tuple[NDArray[np.uint8], NDArray[np.int64], List[Tuple[int, int]]]
        ] = None

    @classmethod
    def from_pauli_strings(
        cls,
        paulis: Sequence[str],
        tensor_id: TensorId = 0,
        legs: Optional[Sequence[TensorLeg]] = None,
    ) -> "SignedStabilizerTensor":
        """Construct a tensor from signed Pauli strings like `"-XZZXI"`.

        Args:
            paulis: The stabilizers, each an optional sign followed by one of `IXYZ` per leg.
            tensor_id: The id of the tensor.
            legs: The legs of the tensor, by default `(tensor_id, i)` for each qubit `i`.

        Returns:
            The tensor.

        Raises:
            ValueError: If the strings are invalid or have different lengths.
        """
        rows, signs = [], []
        for pauli in paulis:
            sign = -1 if pauli.startswith("-") else 1
            letters = pauli.lstrip("+-")
            if any(c not in _PAULI_LABELS for c in letters):
                raise ValueError(f"Invalid Pauli string {pauli}.")
            rows.append(
                [int(c in "XY") for c in letters] + [int(c in "ZY") for c in letters]
            )
            signs.append(sign)
        if len({len(row) for row in rows}) > 1:
            raise ValueError(f"Pauli strings have different lengths: {paulis}.")
        return cls(np.array(rows, dtype=np.uint8), tensor_id, legs, signs)

    @classmethod
    def from_tensor_network(
        cls,
        tn: "TensorNetwork",
        deformations: Optional[Mapping[Tuple[TensorLeg, TensorLeg], Gate]] = None,
    ) -> "SignedStabilizerTensor":
        """Contract a tensor network into a signed stabilizer tensor.

        Every node starts with all of its stabilizer signs +1, and every trace of the network is
        a Bell trace unless a deformation is given for it.

        Args:
            tn: The tensor network.
            deformations: Maps traced leg pairs `(a, b)` to a single qubit Clifford `C`, tracing
                them with `(I_a ⊗ C_b)|Φ+⟩` instead of the Bell state. Either order of the pair
                is accepted.

        Returns:
            The contracted tensor.

        Raises:
            ValueError: If the network has no nodes, or a deformation is given for a leg pair that
                is not traced in the network.
        """
        remaining: Dict[Tuple[TensorLeg, TensorLeg], Gate] = dict(deformations or {})
        nodes = list(tn.nodes.values())
        if not nodes:
            raise ValueError("The tensor network has no nodes.")
        tensor = cls(nodes[0].h, nodes[0].tensor_id, nodes[0].legs)
        for node in nodes[1:]:
            tensor = tensor.tensor_with(cls(node.h, node.tensor_id, node.legs))
        for _, _, join_legs1, join_legs2 in tn.traces:
            for leg1, leg2 in zip(join_legs1, join_legs2):
                deformation = remaining.pop((leg1, leg2), None)
                if deformation is None and (leg2, leg1) in remaining:
                    deformation = remaining.pop((leg2, leg1)).transpose()
                tensor = tensor.self_trace(leg1, leg2, deformation)
        if remaining:
            raise ValueError(
                f"Deformations given for leg pairs that are not traced: {list(remaining)}."
            )
        return tensor

    @property
    def n(self) -> int:
        """The number of legs."""
        return len(self.legs)

    @property
    def rank(self) -> int:
        """The number of independent stabilizers, equal to `n` for stabilizer states."""
        return len(self._xz)

    @property
    def h(self) -> GF2:
        """The (unsigned) parity check matrix."""
        return GF2(self._xz.astype(int))

    @property
    def xz(self) -> NDArray[np.uint8]:
        """The read-only `(x|z)` bits of the stabilizers."""
        return self._xz

    @property
    def phases(self) -> NDArray[np.int64]:
        """The read-only phase exponents of the stabilizers in the XZ form `i^p X^x Z^z`."""
        return self._ph

    @property
    def signs(self) -> Tuple[int, ...]:
        """The sign of each stabilizer with respect to its Hermitian Pauli operator."""
        n = self.n
        y_counts = np.count_nonzero(self._xz[:, :n] & self._xz[:, n:], axis=1)
        return tuple(1 if p == 0 else -1 for p in (self._ph - y_counts) % 4)

    def pauli_strings(self) -> List[str]:
        """Return the stabilizers as signed Pauli strings, one letter per leg.

        Returns:
            The list of strings like `"+XZZXI"`.
        """
        n = self.n
        return [
            ("+" if sign == 1 else "-")
            + "".join(
                _PAULI_LABELS[int(row[i]) + 2 * int(row[n + i])] for i in range(n)
            )
            for row, sign in zip(self._xz, self.signs)
        ]

    def __repr__(self) -> str:
        return f"SignedStabilizerTensor({self.tensor_id}, n={self.n}, rank={self.rank})"

    def leg(self, leg: LegLike) -> TensorLeg:
        """Resolve a leg index of this tensor's own `tensor_id` to its leg.

        Args:
            leg: A leg, or a leg index.

        Returns:
            The leg.

        Raises:
            ValueError: If the tensor does not have the leg.
        """
        resolved = _as_leg(self.tensor_id, leg)
        if resolved not in self.legs:
            raise ValueError(f"Leg {resolved} is not a leg of {self}.")
        return resolved

    def resolve_ops(self, ops: GateAssignment) -> List[Tuple[Gate, Tuple[int, ...]]]:
        """Resolve the legs of a gate assignment to leg positions of this tensor.

        Args:
            ops: The gate assignment.

        Returns:
            Pairs of gates and the positions of the legs they act on.

        Raises:
            ValueError: If a gate has the wrong number of legs, or the legs are not disjoint.
        """
        resolved = []
        used: set[int] = set()
        for gate, legs in ops:
            if len(legs) != gate.num_qubits:
                raise ValueError(
                    f"Gate {gate.name} acts on {gate.num_qubits} qubits, got legs {legs}."
                )
            idx = tuple(self.legs.index(self.leg(leg)) for leg in legs)
            if used.intersection(idx) or len(set(idx)) != len(idx):
                raise ValueError(f"Gates act on overlapping legs: {legs}.")
            used.update(idx)
            resolved.append((gate, idx))
        return resolved

    def _parse_pauli(
        self, pauli: Union[str, Mapping[LegLike, str]]
    ) -> Tuple[NDArray[np.uint8], int]:
        n = self.n
        if isinstance(pauli, str):
            if len(pauli) != n:
                raise ValueError(f"Pauli string {pauli} should have {n} letters.")
            letters = dict(enumerate(pauli))
        else:
            letters = {
                self.legs.index(self.leg(leg)): letter for leg, letter in pauli.items()
            }
        v = np.zeros(2 * n, dtype=np.uint8)
        phase = 0
        for i, letter in letters.items():
            if letter not in _PAULI_LABELS:
                raise ValueError(f"Invalid Pauli letter {letter}.")
            v[i] = letter in "XY"
            v[n + i] = letter in "ZY"
            phase += letter == "Y"
        return v, phase % 4

    def _reduced(
        self,
    ) -> Tuple[NDArray[np.uint8], NDArray[np.int64], List[Tuple[int, int]]]:
        if self._rref is None:
            self._rref = signed_rref(self._xz, self._ph)
        return self._rref

    def stabilizer_sign(self, pauli: Union[str, Mapping[LegLike, str]]) -> int:
        """Return whether a Hermitian Pauli operator or its negative is a stabilizer.

        Args:
            pauli: A Pauli string with one letter of `IXYZ` per leg, or a mapping from legs to
                letters, with identity on the other legs.

        Returns:
            +1 if the operator is a stabilizer, -1 if its negative is, and 0 otherwise.
        """
        v, phase = self._parse_pauli(pauli)
        if np.any(_symplectic_products(self._xz, v)):
            return 0
        xz, ph, pivots = self._reduced()
        for row, col in pivots:
            if v[col]:
                v, phase = multiply_paulis(v, phase, xz[row], int(ph[row]))
        if v.any():
            return 0
        return 1 if phase == 0 else -1

    def tensor_with(self, other: "SignedStabilizerTensor") -> "SignedStabilizerTensor":
        """Return the tensor product with another tensor.

        Args:
            other: The other tensor, with legs disjoint from the legs of this one.

        Returns:
            The tensor product, with the legs of this tensor followed by the legs of the other.

        Raises:
            ValueError: If the tensors share legs.
        """
        shared = set(self.legs).intersection(other.legs)
        if shared:
            raise ValueError(f"Tensors share legs {sorted(shared, key=str)}.")
        n1, n2, r1 = self.n, other.n, self.rank
        n = n1 + n2
        z2 = n + n1
        xz = np.zeros((r1 + other.rank, 2 * n), dtype=np.uint8)
        xz[:r1, :n1] = self._xz[:, :n1]
        xz[:r1, n:z2] = self._xz[:, n1:]
        xz[r1:, n1:n] = other.xz[:, :n2]
        xz[r1:, z2:] = other.xz[:, n2:]
        return SignedStabilizerTensor(
            xz,
            self.tensor_id,
            self.legs + other.legs,
            phases=np.concatenate([self._ph, other.phases]),
            validate=False,
        )

    def self_trace(
        self, leg1: LegLike, leg2: LegLike, deformation: Optional[Gate] = None
    ) -> "SignedStabilizerTensor":
        """Trace two legs of the tensor, optionally with a Clifford-deformed edge state.

        The legs are projected onto `(I_leg1 ⊗ C_leg2)|Φ+⟩` and removed. Without a deformation
        this is the usual Bell trace (conjoining) of the quantum LEGO framework.

        Args:
            leg1: The first leg.
            leg2: The second leg, the one that the deformation acts on.
            deformation: A single qubit Clifford gate `C`, e.g. `Gates.X` for `|Φ_X⟩`.

        Returns:
            The traced tensor.

        Raises:
            ValueError: If the legs are equal or the deformation is not a single qubit Clifford.
            ContractionVanishesError: If the trace is the zero tensor.
        """
        l1, l2 = self.leg(leg1), self.leg(leg2)
        if l1 == l2:
            raise ValueError(f"Can't trace leg {l1} with itself.")
        n = self.n
        j, m = self.legs.index(l1), self.legs.index(l2)
        xx = np.zeros(2 * n, dtype=np.uint8)
        xx[[j, m]] = 1
        zz = np.zeros(2 * n, dtype=np.uint8)
        zz[[n + j, n + m]] = 1
        edge, edge_ph = np.vstack([xx, zz]), np.zeros(2, dtype=np.int64)
        if deformation is not None:
            if deformation.num_qubits != 1 or not deformation.is_clifford:
                raise ValueError(
                    f"Deformation {deformation.name} is not a single qubit Clifford gate."
                )
            edge, edge_ph = conjugate_paulis(edge, edge_ph, [(deformation, (m,))])
        xz, ph = self._xz.copy(), self._ph.copy()
        try:
            xz, ph, ka = _postselect(xz, ph, edge[0], int(edge_ph[0]))
            xz, ph, kb = _postselect(xz, ph, edge[1], int(edge_ph[1]), keep_row=ka)
        except ContractionVanishesError as e:
            raise ContractionVanishesError(
                f"The trace of legs {l1} and {l2} is the zero tensor."
            ) from e

        cols = np.array([j, m, n + j, n + m])
        rest = np.array(
            [i for i in range(len(xz)) if i not in (ka, kb)], dtype=np.int64
        )
        local = xz[rest][:, cols]
        a_local, b_local = edge[0][cols], edge[1][cols]
        is_a = np.all(local == a_local, axis=1)
        is_b = np.all(local == b_local, axis=1)
        is_ab = np.all(local == a_local ^ b_local, axis=1)
        _multiply_rows(xz, ph, rest[is_a | is_ab], edge[0], int(edge_ph[0]))
        _multiply_rows(xz, ph, rest[is_b | is_ab], edge[1], int(edge_ph[1]))
        assert not xz[rest][
            :, cols
        ].any(), "stabilizers must commute with the edge state"

        keep_cols = [c for c in range(2 * n) if c not in cols]
        return SignedStabilizerTensor(
            xz[rest][:, keep_cols],
            self.tensor_id,
            [leg for leg in self.legs if leg not in (l1, l2)],
            phases=ph[rest],
            validate=False,
        )

    def merge_with(
        self,
        other: "SignedStabilizerTensor",
        join_legs1: Sequence[LegLike],
        join_legs2: Sequence[LegLike],
        deformations: Optional[Sequence[Optional[Gate]]] = None,
    ) -> "SignedStabilizerTensor":
        """Trace legs of this tensor with legs of another tensor.

        Args:
            other: The other tensor.
            join_legs1: Legs of this tensor.
            join_legs2: The matching legs of the other tensor.
            deformations: Optional single qubit Cliffords for each leg pair, acting on the leg of
                the other tensor, see
                [`self_trace`][planqtn.signed_stabilizer_tensor.SignedStabilizerTensor.self_trace].

        Returns:
            The traced tensor.

        Raises:
            ValueError: If the number of legs or deformations don't match.
        """
        legs1 = [self.leg(leg) for leg in join_legs1]
        legs2 = [other.leg(leg) for leg in join_legs2]
        if len(legs1) != len(legs2):
            raise ValueError(f"Can't join {len(legs1)} legs with {len(legs2)} legs.")
        edges: List[Optional[Gate]] = (
            [None] * len(legs1) if deformations is None else list(deformations)
        )
        if len(edges) != len(legs1):
            raise ValueError(
                f"Got {len(edges)} deformations for {len(legs1)} leg pairs."
            )
        tensor = self.tensor_with(other)
        for leg1, leg2, deformation in zip(legs1, legs2, edges):
            tensor = tensor.self_trace(leg1, leg2, deformation)
        return tensor

    def apply(self, ops: GateAssignment) -> "SignedStabilizerTensor":
        """Apply Clifford gates to the legs, mapping the state `|V⟩` to `U|V⟩`.

        Args:
            ops: Clifford gates on disjoint legs.

        Returns:
            The transformed tensor.

        Raises:
            ValueError: If a gate is not Clifford.
        """
        resolved = self.resolve_ops(ops)
        for gate, _ in resolved:
            if not gate.is_clifford:
                raise ValueError(f"Gate {gate.name} is not a Clifford gate.")
        xz, ph = conjugate_paulis(self._xz, self._ph, resolved)
        return SignedStabilizerTensor(
            xz, self.tensor_id, self.legs, phases=ph, validate=False
        )

    def support_basis(self) -> Tuple[NDArray[np.uint8], NDArray[np.uint8]]:
        """Return the computational basis support of a stabilizer state as an affine subspace.

        The support is the set of bit strings `offset + y directions` for all `y` over GF(2).
        The directions are the X parts of a subset of the stabilizers of the tensor, so they are
        as sparse as the stabilizers are.

        Returns:
            The offset, with one bit per leg, and the directions, one row per dimension of the
            support.

        Raises:
            ValueError: If the tensor is not a stabilizer state.
        """
        if self.rank != self.n:
            raise ValueError(
                f"{self} is not a stabilizer state: it has {self.rank} stabilizers on "
                f"{self.n} legs."
            )
        n = self.n
        xz, ph, pivots = signed_rref(self._xz, self._ph, list(range(n)))
        rank_x = len(pivots)
        z_rows = xz[rank_x:, n:]
        offset = _row_combination(
            z_rows.T.copy(), ((ph[rank_x:] // 2) % 2).astype(np.uint8)
        )
        assert offset is not None, "a stabilizer state has a nonempty support"
        directions = self._xz[independent_subset(self._xz[:, :n]), :n]
        assert len(directions) == rank_x, "the X parts span the support directions"
        return offset, directions

    def support(self, max_dimension: int = 20) -> NDArray[np.uint8]:
        """Return the computational basis states on which a stabilizer state is supported.

        The support is an affine subspace, enumerated here. Its dimension is the rank of the X
        part of the stabilizers.

        Args:
            max_dimension: The largest support dimension to enumerate.

        Returns:
            An array with one row of bits (one per leg) for each basis state of the support.

        Raises:
            ValueError: If the tensor is not a stabilizer state, or the support is too large.
        """
        offset, directions = self.support_basis()
        if len(directions) > max_dimension:
            raise ValueError(
                f"The support of {self} has dimension {len(directions)} > {max_dimension}."
            )
        points = offset.reshape(1, -1)
        for direction in directions:
            points = np.vstack([points, points ^ direction])
        return points

    def to_statevector(self) -> NDArray[np.complex128]:
        """Return the normalized state vector of a stabilizer state, up to a global phase.

        The first leg is the most significant qubit. The global phase is fixed by making the first
        nonzero amplitude positive.

        Returns:
            The state vector of length `2^n`.

        Raises:
            ValueError: If the tensor has more than 16 legs.
        """
        n = self.n
        if n > 16:
            raise ValueError(f"Refusing to build a state vector for {n} legs.")
        offset, _ = self.support_basis()
        weights = 1 << np.arange(n - 1, -1, -1)
        indices = np.arange(2**n)
        state = np.zeros(2**n, dtype=complex)
        state[int(offset.astype(np.int64) @ weights)] = 1
        for row, phase in zip(self._xz, self._ph):
            x_mask = int(row[:n].astype(np.int64) @ weights)
            z_mask = int(row[n:].astype(np.int64) @ weights)
            signs = 1 - 2 * _parity(indices & z_mask)
            image = np.empty_like(state)
            image[indices ^ x_mask] = complex(1j**phase) * signs * state
            state = (state + image) / 2
        state /= np.linalg.norm(state)
        first = state[np.flatnonzero(np.abs(state) > 1e-12)[0]]
        return np.asarray(state * (abs(first) / first), dtype=complex)


def _parity(values: NDArray[np.int64]) -> NDArray[np.int64]:
    values = values.copy()
    for shift in (16, 8, 4, 2, 1):
        values ^= values >> shift
    return values & 1
