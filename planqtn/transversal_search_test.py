"""Tests, many of which check claims of ChunJun Cao and Brad Lackey, "Quantum Lego Power-up:
Designing Transversal Gates with Tensor Networks", arXiv:2603.03542 (2026)."""

import itertools

import numpy as np
import pytest

from planqtn.gates import Gates, bitwise
from planqtn.legos import Legos
from planqtn.signed_stabilizer_tensor import SignedStabilizerTensor
from planqtn.symmetries import is_symmetry
from planqtn.transversal import logical_action
from planqtn.transversal_search import (
    addressable_phase_gates,
    logical_pauli_representative,
    search_patterns,
)


def legs(name, indices):
    return [(name, i) for i in indices]


def qrm(name):
    return SignedStabilizerTensor(Legos.qrm15_encoding_tensor, name)


def ghz_joined(blocks, joined_leg):
    tensor = SignedStabilizerTensor(Legos.z_rep_code(len(blocks)), "g")
    for i, block in enumerate(blocks):
        tensor = tensor.merge_with(block, [("g", i)], [joined_leg])
    return tensor


def test_832_has_exactly_two_ccz_patterns():
    """Sec. 4.2.2: 2 of the 256 T/T† patterns are the logical CCZ, as found by brute force."""
    code = SignedStabilizerTensor(Legos.code832_encoding_tensor, "c")
    logical = [8, 9, 10]
    sites = [(v,) for v in range(8)]
    found = search_patterns(code, logical, sites, [Gates.T, Gates.T_DAG], Gates.CCZ)
    brute_force = [
        pattern
        for pattern in itertools.product([Gates.T, Gates.T_DAG], repeat=8)
        if (action := logical_action(code, logical, list(zip(pattern, sites))))
        is not None
        and action.equals(Gates.CCZ)
    ]
    assert [tuple(g for g, _ in m.ops) for m in found] == brute_force
    assert len(found) == 2
    every_logical = search_patterns(code, logical, sites, [Gates.T, Gates.T_DAG])
    brute_force_logical = [
        pattern
        for pattern in itertools.product([Gates.T, Gates.T_DAG], repeat=8)
        if logical_action(code, logical, list(zip(pattern, sites))) is not None
    ]
    assert [tuple(g for g, _ in m.ops) for m in every_logical] == brute_force_logical
    assert len(every_logical) == 16


def test_qrm_pairs_have_fifteen_localized_cz_faces():
    """Fig. 2c and App. C: 15 seven-leg sets of QRM leg pairs carry a logical CZ."""
    pair = qrm("a").tensor_with(qrm("b"))
    logical = [("a", 15), ("b", 15)]
    sites = [(("a", i), ("b", i)) for i in range(15)]
    faces = search_patterns(pair, logical, sites, [None, Gates.CZ], Gates.CZ, weight=7)
    assert len(faces) == 15
    supports = {frozenset(leg[1] for leg, _ in (s for _, s in m.ops)) for m in faces}
    assert frozenset(range(7)) in supports
    for match in faces:
        assert logical_action(pair, logical, match.ops, method="clifford").equals(
            Gates.CZ
        )
    rng = np.random.default_rng(3)
    for _ in range(40):
        support = frozenset(rng.choice(15, size=7, replace=False).tolist())
        ops = bitwise(Gates.CZ, legs("a", sorted(support)), legs("b", sorted(support)))
        action = logical_action(pair, logical, ops, method="clifford")
        assert (action is not None and action.equals(Gates.CZ)) == (support in supports)
    assert len(search_patterns(pair, logical, sites, [None, Gates.CZ], weight=7)) == 15


def test_qrm_pairs_have_thirty_cz_symmetries_on_subcubes():
    """Fig. 2c and App. C: CZ^⊗8 on the 3-subcubes of the 16-leg hypercube are symmetries."""
    pair = qrm("a").tensor_with(qrm("b"))
    sites = [(("a", i), ("b", i)) for i in range(16)]
    symmetries = search_patterns(pair, [], sites, [None, Gates.CZ], weight=8)
    assert len(symmetries) == 30
    for match in symmetries:
        assert is_symmetry(pair, match.ops)
    with_logical = [m for m in symmetries if any(s[0][1] == 15 for _, s in m.ops)]
    assert len(with_logical) == 15


def test_qrm_t_and_t_dagger_patterns():
    code = qrm("q")
    sites = [(i,) for i in range(15)]
    matches = search_patterns(code, [15], sites, [Gates.T, Gates.T_DAG])
    assert len(matches) == 32
    assert sorted({str(m.action) for m in matches}) == ["T(q:15)", "T†(q:15)"]
    for match in matches[:8]:
        assert logical_action(code, [15], match.ops, method="enumerate").equals(
            match.action.matrix()
        )


def test_clifford_pattern_search():
    five = SignedStabilizerTensor(Legos.perf513_encoding_tensor, "f")
    sites = [(i,) for i in range(5)]
    matches = search_patterns(five, [5], sites, [Gates.SH, Gates.SH.conj()])
    assert [[g.name for g, _ in m.ops] for m in matches] == [
        ["SH"] * 5,
        ["SH*"] * 5,
    ]
    assert matches[0].action.equals(Gates.SH)


def test_addressable_s_from_bitwise_t():
    """Prop. 2.7 and Cor. 2.8: bitwise T gives S on the support of each logical X."""
    x_edge = qrm("a").merge_with(qrm("b"), [0], [0], [Gates.X])
    logical = [("a", 15), ("b", 15)]
    physical = [leg for leg in x_edge.legs if leg not in logical]
    found = addressable_phase_gates(x_edge, logical, bitwise(Gates.T, physical))
    assert {leg: str(m.action) for leg, m in found.items()} == {
        ("a", 15): "S(a:15)",
        ("b", 15): "S(b:15)",
    }
    assert [g.name for g, _ in found[("a", 15)].ops] == ["S†"] * 7
    assert {leg[0] for _, (leg,) in found[("b", 15)].ops} == {"b"}

    code = ghz_joined([qrm(f"q{i}") for i in range(3)], 0)
    logical = [(f"q{i}", 15) for i in range(3)]
    ops = bitwise(Gates.T, legs("q0", range(1, 15))) + bitwise(
        Gates.T_DAG, legs("q1", range(1, 15))
    )
    found = addressable_phase_gates(code, logical, ops)
    assert [str(m.action) for m in found.values()] == ["S(q0:15)", "S†(q1:15)", "I"]


def test_logical_pauli_representatives():
    code = qrm("q")
    x_bar = logical_pauli_representative(code, [15], 15, "X")
    z_bar = logical_pauli_representative(code, [15], 15, "Z")
    assert len(x_bar) == 7 and set(x_bar.values()) == {"X"}
    assert len(z_bar) == 3 and set(z_bar.values()) == {"Z"}
    for letter, physical in (("X", x_bar), ("Z", z_bar)):
        assert code.stabilizer_sign({15: letter, **physical}) in (1, -1)
    y_bar = logical_pauli_representative(code, [15], 15, "Y")
    assert code.stabilizer_sign({15: "Y", **y_bar}) in (1, -1)
    with pytest.raises(ValueError, match="Can't find"):
        logical_pauli_representative(code, [15], 3)
    ghz = SignedStabilizerTensor(Legos.z_rep_code(3))
    with pytest.raises(ValueError, match="isometry"):
        logical_pauli_representative(ghz, [0, 1], 0)


def test_errors():
    code = qrm("q")
    sites = [(i,) for i in range(15)]
    with pytest.raises(ValueError, match="placements"):
        search_patterns(code, [15], sites, [Gates.T, Gates.T_DAG], max_patterns=100)
    with pytest.raises(ValueError, match="None"):
        search_patterns(code, [15], sites, [Gates.T], weight=3)
    with pytest.raises(ValueError, match="does not fit"):
        search_patterns(code, [15], sites, [None, Gates.CZ], weight=1)
    with pytest.raises(ValueError, match="all diagonal or all Clifford"):
        search_patterns(code, [15], sites[:2], [Gates.T, Gates.H])
    with pytest.raises(ValueError, match="single qubit diagonal"):
        addressable_phase_gates(code, [15], [(Gates.H, (0,))])
    with pytest.raises(ValueError, match="does not implement"):
        addressable_phase_gates(code, [15], [(Gates.T, (0,))])
