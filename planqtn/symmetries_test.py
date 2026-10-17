"""Tests, many of which check claims of ChunJun Cao and Brad Lackey, "Quantum Lego Power-up:
Designing Transversal Gates with Tensor Networks", arXiv:2603.03542 (2026)."""

import itertools

import numpy as np
import pytest

from planqtn.gates import Gate, Gates, bitwise
from planqtn.legos import Legos
from planqtn.signed_stabilizer_tensor import SignedStabilizerTensor
from planqtn.stabilizer_tensor_enumerator import StabilizerCodeTensorEnumerator
from planqtn.symmetries import (
    compatible_deformations,
    edge_compatible,
    edge_deformation,
    is_symmetry,
    network_symmetry,
    push_through_traces,
)
from planqtn.tensor_network import TensorNetwork
from planqtn.transversal import logical_action

PHI_PLUS = np.array([1, 0, 0, 1]) / np.sqrt(2)


def legs(name, indices):
    return [(name, i) for i in indices]


def five_qubit(name):
    return SignedStabilizerTensor(Legos.perf513_encoding_tensor, name)


def qrm(name):
    return SignedStabilizerTensor(Legos.qrm15_encoding_tensor, name)


def dense_edge_check(u, u_prime, deformations):
    """(U ⊗ U') fixes the product of edge states, built as a state vector."""
    q = u.num_qubits
    edge_states = [np.kron(np.eye(2), c.matrix) @ PHI_PLUS for c in deformations]
    state = edge_states[0]
    for e in edge_states[1:]:
        state = np.kron(state, e)
    # qubit order (f1, s1, f2, s2, ...) -> (f1, ..., fq, s1, ..., sq)
    perm = [2 * i for i in range(q)] + [2 * i + 1 for i in range(q)]
    state = state.reshape([2] * (2 * q)).transpose(perm).reshape(-1)
    image = np.kron(u.matrix, u_prime.matrix) @ state
    return np.isclose(abs(np.vdot(state, image)), 1.0)


def test_single_qubit_cliffords():
    cliffords = Gates.single_qubit_cliffords()
    assert len(cliffords) == 24
    assert all(c.is_clifford for c in cliffords)
    for a, b in itertools.combinations(cliffords, 2):
        assert not np.isclose(abs(np.vdot(a.matrix, b.matrix)), 2)


def test_edge_identities_of_the_paper():
    """Lemma 3.7, Sec. 3.2.1, Fig. 6 and Fig. 7."""
    assert [c.name for c in compatible_deformations(Gates.T)] == ["X", "Y", "XS", "YS"]
    for phase in (Gates.phase(1, 16), Gates.phase(3, 8), Gates.S):
        assert edge_compatible(phase, deformations=[Gates.X])
        assert not edge_compatible(phase)
    assert Gates.Y.name in [c.name for c in compatible_deformations(Gates.SH)]
    assert not edge_compatible(Gates.SH)
    assert edge_compatible(Gates.K3, deformations=[Gates.Y] * 3)
    assert not edge_compatible(Gates.K3)
    assert "Y" in [c.name for c in compatible_deformations(Gates.K3)]
    assert edge_deformation(Gates.CZ).name == "Z"
    assert edge_deformation(Gates.CS).name == "S"
    assert edge_deformation(Gates.CZ, Gates.Z).name == "I"
    assert edge_deformation(Gates.CNOT) is None
    t_edge = edge_deformation(Gates.controlled_phase(2, 1, 8))
    assert np.allclose(t_edge.matrix, Gates.T.matrix)
    with pytest.raises(ValueError, match="two qubit"):
        edge_deformation(Gates.T)


def test_bell_matching_condition():
    """Lemma 3.2: U ⊗ U* fixes |Φ+⟩ for any U."""
    rng = np.random.default_rng(7)
    m = rng.normal(size=(4, 4)) + 1j * rng.normal(size=(4, 4))
    u = Gate("U", np.linalg.qr(m)[0])
    assert edge_compatible(u, u.conj())
    assert not edge_compatible(u, u)
    assert "I" in [c.name for c in compatible_deformations(Gates.T, Gates.T_DAG)]


@pytest.mark.parametrize(
    "u,u_prime",
    [
        (Gates.T, Gates.T),
        (Gates.T, Gates.T_DAG),
        (Gates.SH, Gates.SH),
        (Gates.H, Gates.H),
        (Gates.CZ, Gates.CZ),
        (Gates.CS, Gates.CS_DAG),
        (Gates.CNOT, Gates.CNOT),
    ],
)
def test_edge_compatibility_matches_dense_states(u, u_prime):
    cliffords = Gates.single_qubit_cliffords()
    for deformations in itertools.product(cliffords[:8], repeat=u.num_qubits):
        assert edge_compatible(u, u_prime, deformations) == dense_edge_check(
            u, u_prime, deformations
        ), [c.name for c in deformations]


def test_is_symmetry():
    five = five_qubit("f")
    sh = [(Gates.SH.conj(), (5,))] + bitwise(Gates.SH, range(5))
    assert is_symmetry(five, sh)
    assert not is_symmetry(five, bitwise(Gates.SH, range(6)))
    code_space = SignedStabilizerTensor(Legos.perf513)
    assert is_symmetry(code_space, bitwise(Gates.SH, range(5)))
    assert not is_symmetry(code_space, bitwise(Gates.H, range(5)))
    assert is_symmetry(qrm("q"), bitwise(Gates.T, range(16)))
    assert not is_symmetry(qrm("q"), bitwise(Gates.T, range(15)))
    with pytest.raises(ValueError, match="stabilizer states"):
        is_symmetry(code_space, bitwise(Gates.T, range(5)))
    with pytest.raises(ValueError, match="not diagonal"):
        is_symmetry(qrm("q"), [(Gates.T, (0,)), (Gates.H, (1,))])


def test_pushing_sh_through_y_deformed_edges():
    """Sec. 3.2.1 and Fig. 6b: two [[5,1,3]] codes keep SH^⊗n through a Φ_Y edge."""
    ops = []
    for name in "ab":
        ops += [(Gates.SH.conj(), ((name, 5),))] + bitwise(
            Gates.SH, legs(name, range(5))
        )
    for name in "ab":
        assert is_symmetry(five_qubit(name), [op for op in ops if op[1][0][0] == name])
    pushed = push_through_traces(ops, [(("a", 0), ("b", 0), Gates.Y)])
    assert len(pushed) == 10
    code = five_qubit("a").merge_with(five_qubit("b"), [0], [0], [Gates.Y])
    assert is_symmetry(code, pushed)
    logical = [("a", 5), ("b", 5)]
    physical_part = [op for op in pushed if op[1][0] not in logical]
    action = logical_action(code, logical, physical_part)
    assert action.equals(bitwise(Gates.SH, logical))
    with pytest.raises(ValueError, match="don't fix the edge state"):
        push_through_traces(ops, [(("a", 0), ("b", 0), None)])


def test_pushing_k3_through_three_y_deformed_edges():
    """Fig. 6a: K3 across three blocks is pushed through |Φ_Y⟩^⊗3."""
    sides = {}
    for side in "ab":
        blocks = [five_qubit(f"{side}{c}") for c in range(3)]
        sides[side] = blocks[0].tensor_with(blocks[1]).tensor_with(blocks[2])
    ops = []
    for side in "ab":
        logical = tuple((f"{side}{c}", 5) for c in range(3))
        ops.append((Gates.K3.conj(), logical))
        ops += bitwise(Gates.K3, *(legs(f"{side}{c}", range(5)) for c in range(3)))
        assert is_symmetry(sides[side], [op for op in ops if op[1][0][0][0] == side])
    traces = [((f"a{c}", 0), (f"b{c}", 0), Gates.Y) for c in range(3)]
    pushed = push_through_traces(ops, traces)
    code = sides["a"].tensor_with(sides["b"])
    for leg1, leg2, deformation in traces:
        code = code.self_trace(leg1, leg2, deformation)
    assert is_symmetry(code, pushed)
    with pytest.raises(ValueError, match="don't fix"):
        push_through_traces(ops, [(a, b, None) for a, b, _ in traces])
    with pytest.raises(ValueError, match="traced and untraced"):
        push_through_traces(ops, traces[:2])


def test_push_errors():
    ops = [(Gates.CZ, (("a", 0), ("a", 1))), (Gates.T, (("b", 0),))]
    with pytest.raises(ValueError, match="traced and untraced"):
        push_through_traces(ops, [(("a", 0), ("b", 0), None)])
    with pytest.raises(ValueError, match="both legs"):
        push_through_traces(ops, [(("a", 0), ("a", 1), None)])
    with pytest.raises(ValueError, match="overlaps"):
        push_through_traces(
            ops, [(("a", 0), ("b", 0), None), (("a", 0), ("c", 0), None)]
        )
    edge = [(("a", 0), ("b", 0), None)]
    z_z = [(Gates.Z, (("a", 0),)), (Gates.Z, (("b", 0),))]
    assert push_through_traces(z_z, edge) == []
    with pytest.raises(ValueError, match="I on"):
        push_through_traces([(Gates.Z, (("a", 0),))], edge)
    two_edges = [(("a", 0), ("b", 0), None), (("a", 1), ("b", 1), None)]
    split = [
        (Gates.CZ, (("a", 0), ("a", 1))),
        (Gates.Z, (("b", 0),)),
        (Gates.Z, (("b", 1),)),
    ]
    with pytest.raises(ValueError, match="not matched"):
        push_through_traces(split, two_edges)
    swapped = [(Gates.CNOT, (("a", 0), ("a", 1))), (Gates.CNOT, (("b", 1), ("b", 0)))]
    with pytest.raises(ValueError, match="fix"):
        push_through_traces(swapped, two_edges)
    aligned = [(Gates.CNOT, (("a", 0), ("a", 1))), (Gates.CNOT, (("b", 0), ("b", 1)))]
    assert push_through_traces(aligned, two_edges) == []


def test_network_symmetry_of_x_deformed_qrm_chain():
    """Cor. 3.8: X-deformed traces keep T^⊗n strongly transversal through a chain."""
    nodes = [
        StabilizerCodeTensorEnumerator(Legos.qrm15_encoding_tensor, f"q{i}")
        for i in range(3)
    ]
    tn = TensorNetwork(nodes)
    tn.self_trace("q0", "q1", [0], [1])
    tn.self_trace("q1", "q2", [0], [1])
    symmetries = {f"q{i}": bitwise(Gates.T, range(16)) for i in range(3)}
    deformations = {(("q0", 0), ("q1", 1)): Gates.X, (("q2", 1), ("q1", 0)): Gates.X}
    pushed = network_symmetry(tn, symmetries, deformations)
    code = SignedStabilizerTensor.from_tensor_network(tn, deformations)
    assert len(pushed) == code.n == 44
    assert is_symmetry(code, pushed)
    logical = [(f"q{i}", 15) for i in range(3)]
    physical = [op for op in pushed if op[1][0] not in logical]
    assert str(logical_action(code, logical, physical)) == (
        "T†(q0:15) · T†(q1:15) · T†(q2:15)"
    )
    with pytest.raises(ValueError, match="fix the edge state"):
        network_symmetry(tn, symmetries)
    with pytest.raises(ValueError, match="Unknown nodes"):
        network_symmetry(tn, {"x": []})
    with pytest.raises(ValueError, match="not traced"):
        network_symmetry(tn, symmetries, {(("q0", 3), ("q1", 3)): Gates.X})
