"""Unitary symmetries of signed tensors and how they flow through (deformed) traces.

A unitary `U` is a symmetry of a tensor `|V⟩` if `U|V⟩ ∝ |V⟩`. Logical gates of a code are
symmetries of its encoding tensor (Proposition 2.3 of ChunJun Cao and Brad Lackey, "Quantum Lego
Power-up: Designing Transversal Gates with Tensor Networks", arXiv:2603.03542 (2026)), and the
matching lemma (Lemma 3.2) tells how symmetries of LEGOs combine into symmetries of a network: if
the gates on two traced legs fix the edge state, the gates on the other legs are a symmetry of the
contracted network. This module provides:

- [`is_symmetry`][planqtn.symmetries.is_symmetry], which checks a symmetry of a signed tensor,
- [`edge_compatible`][planqtn.symmetries.edge_compatible] and
  [`compatible_deformations`][planqtn.symmetries.compatible_deformations], which tell which
  Clifford-deformed edge states `|Φ_C⟩ = (I ⊗ C)|Φ+⟩` (Definition 3.6) are fixed by `U ⊗ U'`,
  e.g. `T ⊗ T` fixes `|Φ_X⟩` (Lemma 3.7), `SH ⊗ SH` fixes `|Φ_Y⟩` and `K3 ⊗ K3` fixes
  `|Φ_Y⟩^{⊗3}` (Section 3.2.1),
- [`edge_deformation`][planqtn.symmetries.edge_deformation], which tells how a two qubit gate on
  both legs of an edge deforms it, e.g. `CZ|Φ+⟩ = |Φ_Z⟩` (Figure 7),
- [`push_through_traces`][planqtn.symmetries.push_through_traces] and
  [`network_symmetry`][planqtn.symmetries.network_symmetry], which push symmetries of LEGOs
  through the traces of a network.

Example:
    `T^{⊗16}` is a symmetry of the [[15,1,3]] encoding tensor (its bitwise T is the logical T†).
    Tracing two of them with a Bell state breaks the symmetry, but tracing them with `|Φ_X⟩`
    keeps it, because `T ⊗ T` fixes `|Φ_X⟩` but not `|Φ+⟩`:

    ```python
    >>> from planqtn.gates import Gates, bitwise
    >>> from planqtn.legos import Legos
    >>> [c.name for c in compatible_deformations(Gates.T)]
    ['X', 'Y', 'XS', 'YS']
    >>> a = SignedStabilizerTensor(Legos.qrm15_encoding_tensor, tensor_id="a")
    >>> b = SignedStabilizerTensor(Legos.qrm15_encoding_tensor, tensor_id="b")
    >>> is_symmetry(a, bitwise(Gates.T, range(16)))
    True
    >>> ops = bitwise(Gates.T, a.legs + b.legs)
    >>> pushed = push_through_traces(ops, [(("a", 0), ("b", 0), Gates.X)])
    >>> len(pushed), is_symmetry(a.merge_with(b, [0], [0], [Gates.X]), pushed)
    (30, True)
    >>> push_through_traces(ops, [(("a", 0), ("b", 0), None)])  # doctest: +ELLIPSIS
    Traceback (most recent call last):
    ...
    ValueError: Gate T on (('a', 0),) and T on [('b', 0)] don't fix the edge state...

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

import numpy as np
from numpy.typing import NDArray

from planqtn.gates import (
    Gate,
    GateAssignment,
    Gates,
    LegLike,
    equal_up_to_phase,
    operator_matrix,
)
from planqtn.signed_stabilizer_tensor import (
    SignedStabilizerTensor,
    conjugate_paulis,
    multiply_paulis,
    network_traces,
    signed_rref,
)
from planqtn.tensor import TensorId, TensorLeg
from planqtn.transversal import logical_action

if TYPE_CHECKING:
    from planqtn.tensor_network import TensorNetwork

GateLike = Union[Gate, NDArray[np.complex128]]
"""A gate, or its unitary matrix."""

Trace = Tuple[LegLike, LegLike, Optional[Gate]]
"""A traced leg pair `(leg1, leg2, C)`, projected onto `(I_leg1 ⊗ C_leg2)|Φ+⟩` (C=None for the
Bell state), like in
[`self_trace`][planqtn.signed_stabilizer_tensor.SignedStabilizerTensor.self_trace]."""

_PHI_PLUS = np.array([1, 0, 0, 1], dtype=complex) / np.sqrt(2)


def _matrix(gate: GateLike) -> NDArray[np.complex128]:
    return gate.matrix if isinstance(gate, Gate) else np.asarray(gate, dtype=complex)


def is_symmetry(tensor: SignedStabilizerTensor, ops: GateAssignment) -> bool:
    """Check whether an operator is a symmetry of a signed tensor, up to a global phase.

    Clifford operators are checked by conjugating the stabilizers, which works for any tensor,
    including the projector onto a code space. Diagonal operators, Clifford or not, are checked on
    stabilizer states with the phase polynomial of
    [`planqtn.phase_polynomial`][planqtn.phase_polynomial].

    Args:
        tensor: The tensor.
        ops: The operator, as gates on disjoint legs of the tensor.

    Returns:
        Whether `U|V⟩ ∝ |V⟩` for the tensor `|V⟩`, or `U Π U^dagger = Π` for the projector `Π`
        onto the stabilized subspace if the tensor is not a stabilizer state.

    Raises:
        ValueError: If the operator mixes non-Clifford and non-diagonal gates, or is a
            non-Clifford operator on a tensor that is not a stabilizer state.
    """
    resolved = tensor.resolve_ops(ops)
    if all(gate.is_clifford for gate, _ in resolved):
        conjugated, phases = conjugate_paulis(tensor.xz, tensor.phases, resolved)
        xz, ph, pivots = signed_rref(tensor.xz, tensor.phases)
        for v, p in zip(conjugated, phases):
            v, p = v.copy(), int(p)
            for row, col in pivots:
                if v[col]:
                    v, p = multiply_paulis(v, p, xz[row], int(ph[row]))
            if v.any() or p:
                return False
        return True
    if tensor.rank != tensor.n:
        raise ValueError(
            f"Non-Clifford symmetries are only supported for stabilizer states, and {tensor} "
            f"has {tensor.rank} stabilizers on {tensor.n} legs."
        )
    return logical_action(tensor, [], ops, method="diagonal") is not None


def edge_compatible(
    u: GateLike,
    u_prime: Optional[GateLike] = None,
    deformations: Optional[Sequence[Optional[Gate]]] = None,
) -> bool:
    """Check whether `U ⊗ U'` fixes a product of (Clifford-deformed) edge states.

    The `q` qubit gate `U` acts on the first legs of `q` edges and `U'` on their second legs. Edge
    `i` is the state `(I ⊗ C_i)|Φ+⟩`. This holds exactly when `U' ∝ D U^* D^dagger` for
    `D = C_1 ⊗ ... ⊗ C_q`, which for Bell states is the matching condition `U' ∝ U^*` of
    Lemma 3.2 of the paper.

    Args:
        u: The gate on the first legs.
        u_prime: The gate on the second legs, by default `U` itself (None also stands for the
            identity when `u` is the identity).
        deformations: The single qubit Cliffords `C_i` on the second legs, by default the Bell
            state on every edge.

    Returns:
        Whether `(U ⊗ U') ⊗_i |Φ_{C_i}⟩ ∝ ⊗_i |Φ_{C_i}⟩`.

    Raises:
        ValueError: If the gates or deformations have mismatched sizes.

    Example:
        ```python
        >>> edge_compatible(Gates.SH, deformations=[Gates.Y])
        True
        >>> edge_compatible(Gates.SH), edge_compatible(Gates.SH, Gates.SH.conj())
        (False, True)
        >>> edge_compatible(Gates.K3, deformations=[Gates.Y] * 3)
        True

        ```
    """
    a = _matrix(u)
    b = a if u_prime is None else _matrix(u_prime)
    q = len(a).bit_length() - 1
    edges: List[Optional[Gate]] = (
        [None] * q if deformations is None else list(deformations)
    )
    if a.shape != b.shape or len(edges) != q:
        raise ValueError(
            f"Got gates of shapes {a.shape} and {b.shape} for {len(edges)} edges."
        )
    d = np.ones((1, 1), dtype=complex)
    for c in edges:
        d = np.kron(d, np.eye(2) if c is None else c.matrix)
    return equal_up_to_phase(b, d @ a.conj() @ d.conj().T)


def compatible_deformations(
    u: GateLike, u_prime: Optional[GateLike] = None
) -> List[Gate]:
    """Find the deformations `C` such that `U ⊗ U'` fixes `|Φ_C⟩^{⊗q}`.

    Use one of them for every traced leg pair that `U` and `U'` act on to keep their symmetries
    when gluing LEGOs.

    Args:
        u: The gate on the first legs of the edges.
        u_prime: The gate on the second legs, by default `U` itself.

    Returns:
        The single qubit Cliffords `C` (up to global phase, see
        [`Gates.single_qubit_cliffords`][planqtn.gates.Gates.single_qubit_cliffords]) that work
        when used on every edge.
    """
    q = len(_matrix(u)).bit_length() - 1
    return [
        c
        for c in Gates.single_qubit_cliffords()
        if edge_compatible(u, u_prime, [c] * q)
    ]


def edge_deformation(
    gate: GateLike, deformation: Optional[Gate] = None
) -> Optional[Gate]:
    """Find how a two qubit gate on both legs of an edge deforms it.

    For a gate `W` on the two legs of the edge `|Φ_C⟩`, find `C'` with `W|Φ_C⟩ ∝ |Φ_C'⟩`. For
    example `CZ|Φ+⟩ = |Φ_Z⟩` and `CP(φ)|Φ+⟩ = |Φ_P(φ)⟩`; the deformation can then often be
    cleaned with a stabilizer of an adjacent LEGO (Section 3.2.2 of the paper).

    Args:
        gate: The two qubit gate, its first qubit on the first leg of the edge.
        deformation: The deformation `C` of the edge before the gate, by default the Bell state.

    Returns:
        The new deformation `C'`, named after a single qubit Clifford when it is one (up to a
        global phase), or None if `W|Φ_C⟩` is not maximally entangled.

    Raises:
        ValueError: If the gate is not a two qubit gate.

    Example:
        ```python
        >>> edge_deformation(Gates.CZ), edge_deformation(Gates.CS)
        (Gate('Z'), Gate('S'))
        >>> print(edge_deformation(Gates.CNOT))
        None

        ```
    """
    w = _matrix(gate)
    if w.shape != (4, 4):
        raise ValueError(f"Expected a two qubit gate, got shape {w.shape}.")
    c = np.eye(2) if deformation is None else deformation.matrix
    state = w @ np.kron(np.eye(2), c) @ _PHI_PLUS
    new = np.sqrt(2) * state.reshape(2, 2).T
    if not np.allclose(new @ new.conj().T, np.eye(2), atol=1e-9):
        return None
    for clifford in Gates.single_qubit_cliffords():
        if equal_up_to_phase(new, clifford.matrix):
            return clifford
    name = gate.name if isinstance(gate, Gate) else "W"
    return Gate(f"{name}|Φ⟩", new)


def push_through_traces(ops: GateAssignment, traces: Sequence[Trace]) -> GateAssignment:
    """Push an operator on the legs of a tensor (network) through some of its traces.

    If `ops` is a symmetry of the tensor before tracing, and the gates on each group of traced
    legs fix the edge states (see [`edge_compatible`][planqtn.symmetries.edge_compatible]), then
    the gates on the other legs are a symmetry of the traced tensor (Lemma 3.2 of the paper,
    generalized to deformed edges). Every gate on traced legs must be matched by a single gate on
    the partner legs, or by no gate at all, which stands for the identity. Legs have to be given
    in the same form in `ops` and `traces`.

    Args:
        ops: The operator on the legs before tracing, as gates on disjoint legs.
        traces: The traced leg pairs and their deformations.

    Returns:
        The gates on the untraced legs.

    Raises:
        ValueError: If a gate acts on both traced and untraced legs, or on both legs of a trace
            (see [`edge_deformation`][planqtn.symmetries.edge_deformation] for that), if the gates
            on traced legs are not matched one to one, or if they don't fix the edge states.
    """
    partner: Dict[LegLike, Tuple[LegLike, Gate]] = {}
    for leg1, leg2, deformation in traces:
        if leg1 in partner or leg2 in partner or leg1 == leg2:
            raise ValueError(f"Leg pair {(leg1, leg2)} overlaps with another trace.")
        c = Gates.I if deformation is None else deformation
        partner[leg1] = (leg2, c)
        partner[leg2] = (leg1, c.transpose())
    owner = {leg: i for i, (_, legs) in enumerate(ops) for leg in legs}
    matched = set()
    remaining: GateAssignment = []
    for i, (gate, legs) in enumerate(ops):
        if i in matched:
            continue
        traced = [leg in partner for leg in legs]
        if not any(traced):
            remaining.append((gate, legs))
            continue
        if not all(traced):
            raise ValueError(
                f"Gate {gate.name} on {legs} acts on traced and untraced legs."
            )
        partners = [partner[leg][0] for leg in legs]
        owners = {owner.get(leg) for leg in partners}
        if i in owners:
            raise ValueError(
                f"Gate {gate.name} on {legs} acts on both legs of a trace, use "
                "edge_deformation to find the deformed edge instead."
            )
        j = next(iter(owners)) if len(owners) == 1 else None
        if owners == {None}:
            other_name, other = "I", np.eye(2 ** len(legs), dtype=complex)
        elif j is not None and set(ops[j][1]) == set(partners):
            other_name, other = ops[j][0].name, operator_matrix([ops[j]], partners)
            matched.add(j)
        else:
            raise ValueError(
                f"Gate {gate.name} on {legs} is not matched by a single gate on the partner "
                f"legs {partners}."
            )
        if not edge_compatible(gate, other, [partner[leg][1] for leg in legs]):
            raise ValueError(
                f"Gate {gate.name} on {legs} and {other_name} on {partners} don't fix the edge "
                "state, see compatible_deformations."
            )
    return remaining


def network_symmetry(
    tn: "TensorNetwork",
    lego_symmetries: Mapping[TensorId, GateAssignment],
    deformations: Optional[Mapping[Tuple[TensorLeg, TensorLeg], Gate]] = None,
) -> GateAssignment:
    """Push symmetries of the LEGOs of a tensor network through all of its traces.

    The traces and deformations are interpreted like in
    [`network_traces`][planqtn.signed_stabilizer_tensor.network_traces], so if each operator is a
    symmetry of its LEGO (with all signs +1), the result is a symmetry of
    `SignedStabilizerTensor.from_tensor_network(tn, deformations)`.

    Args:
        tn: The tensor network.
        lego_symmetries: Maps node ids to symmetries of the nodes, on their legs; integer legs
            refer to the legs of that node. Nodes without a symmetry get the identity.
        deformations: Maps traced leg pairs `(a, b)` to a single qubit Clifford acting on `b`.

    Returns:
        The symmetry of the contracted network, on its dangling legs.

    Raises:
        ValueError: If a node id is unknown, or the symmetries can't be pushed through a trace.
    """
    unknown = set(lego_symmetries) - set(tn.nodes)
    if unknown:
        raise ValueError(f"Unknown nodes {sorted(unknown, key=str)}.")
    ops: GateAssignment = []
    for node_id, node_ops in lego_symmetries.items():
        ops.extend(
            (
                gate,
                tuple((node_id, leg) if isinstance(leg, int) else leg for leg in legs),
            )
            for gate, legs in node_ops
        )
    return push_through_traces(ops, list(network_traces(tn, deformations)))
