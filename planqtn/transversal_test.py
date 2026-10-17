"""Tests, many of which check claims of ChunJun Cao and Brad Lackey, "Quantum Lego Power-up:
Designing Transversal Gates with Tensor Networks", arXiv:2603.03542 (2026)."""

import itertools

import numpy as np
import pytest

from planqtn.gates import Gates, bitwise
from planqtn.legos import Legos
from planqtn.signed_stabilizer_tensor import SignedStabilizerTensor
from planqtn.transversal import (
    CliffordLogicalAction,
    DiagonalLogicalAction,
    logical_action,
)


def qrm(name):
    return SignedStabilizerTensor(Legos.qrm15_encoding_tensor, name)


def steane(name):
    return SignedStabilizerTensor(Legos.steane_code_813_encoding_tensor, name)


def five_qubit(name):
    return SignedStabilizerTensor(Legos.perf513_encoding_tensor, name)


def legs(name, indices):
    return [(name, i) for i in indices]


def ghz_joined(blocks, joined_leg):
    """Trace `joined_leg` of each block with a leg of a GHZ state (a Z-spider)."""
    tensor = SignedStabilizerTensor(Legos.z_rep_code(len(blocks)), "g")
    for i, block in enumerate(blocks):
        tensor = tensor.merge_with(block, [("g", i)], [joined_leg])
    return tensor


def test_qrm_bitwise_t_is_logical_t_dagger():
    action = logical_action(qrm("q"), [15], bitwise(Gates.T, range(15)))
    assert isinstance(action, DiagonalLogicalAction)
    assert str(action) == "T†(q:15)"
    assert action.equals(Gates.T_DAG)
    assert action.phase_polynomial() == {(("q", 15),): 7}


def test_832_ccz_needs_t_and_t_dagger_on_the_cube_bipartition():
    code = SignedStabilizerTensor(Legos.code832_encoding_tensor, "c")
    logical = [8, 9, 10]
    even = [v for v in range(8) if bin(v).count("1") % 2 == 0]
    odd = [v for v in range(8) if bin(v).count("1") % 2 == 1]

    bitwise_t = logical_action(code, logical, bitwise(Gates.T, range(8)))
    assert str(bitwise_t) == (
        "Z(c:8) · Z(c:9) · Z(c:10) · CZ(c:8, c:9) · CZ(c:8, c:10) · CZ(c:9, c:10) · "
        "CCZ(c:8, c:9, c:10)"
    )
    bipartite = logical_action(
        code, logical, bitwise(Gates.T, even) + bitwise(Gates.T_DAG, odd)
    )
    assert bipartite.equals(Gates.CCZ)

    ccz_patterns = [
        pattern
        for pattern in itertools.product([Gates.T, Gates.T_DAG], repeat=8)
        if (
            action := logical_action(
                code, logical, [(g, (v,)) for v, g in enumerate(pattern)]
            )
        )
        is not None
        and action.equals(Gates.CCZ)
    ]
    assert len(ccz_patterns) == 2

    deformed = code.apply(bitwise(Gates.X, odd))
    assert logical_action(deformed, logical, bitwise(Gates.T, range(8))).equals(
        Gates.CCZ
    )


def test_matching_lemma_bell_vs_x_deformed_trace():
    a, b = qrm("a"), qrm("b")
    logical = [("a", 15), ("b", 15)]
    phys_a, phys_b = legs("a", range(1, 15)), legs("b", range(1, 15))
    all_t = bitwise(Gates.T, phys_a + phys_b)
    t_and_t_dagger = bitwise(Gates.T, phys_a) + bitwise(Gates.T_DAG, phys_b)

    bell = a.merge_with(b, [0], [0])
    assert logical_action(bell, logical, all_t) is None
    assert str(logical_action(bell, logical, t_and_t_dagger)) == "T†(a:15) · T(b:15)"

    x_edge = a.merge_with(b, [0], [0], deformations=[Gates.X])
    assert str(logical_action(x_edge, logical, all_t)) == "T†(a:15) · T†(b:15)"
    assert logical_action(x_edge, logical, t_and_t_dagger) is None


def test_addressable_s_from_bitwise_t():
    """Proposition 2.7 and Corollary 2.8: S† on the support of a logical X is a logical S."""
    x_edge = qrm("a").merge_with(qrm("b"), [0], [0], deformations=[Gates.X])
    x_bar = legs("a", [2, 4, 5, 8, 9, 11, 14])
    logical = [("a", 15), ("b", 15)]
    action = logical_action(x_edge, logical, bitwise(Gates.S_DAG, x_bar))
    assert action.conjugation_table() == {
        "XI": "+YI",
        "ZI": "+ZI",
        "IX": "+IX",
        "IZ": "+IZ",
    }
    assert action.equals([(Gates.S, (("a", 15),))])
    diagonal = logical_action(x_edge, logical, bitwise(Gates.S_DAG, x_bar), "diagonal")
    assert str(diagonal) == "S(a:15)"


@pytest.mark.parametrize("method", ["clifford", "diagonal"])
def test_steane_with_a_second_logical_leg_has_intrablock_cz(method):
    """Fig. 2d and App. C: any Steane leg can be made logical, CZ^⊗3 on Fano lines is CZ."""
    s = steane("s")
    fano_lines_through = {0: [(1, 2), (3, 4), (5, 6)], 3: [(0, 4), (1, 5), (2, 6)]}
    for extra, pairs in fano_lines_through.items():
        ops = [(Gates.CZ, (a, b)) for a, b in pairs]
        action = logical_action(s, [7, extra], ops, method=method)
        assert action.equals(Gates.CZ), (extra, str(action))
    assert (
        logical_action(
            s,
            [7, 0],
            [(Gates.CZ, (1, 3)), (Gates.CZ, (2, 4)), (Gates.CZ, (5, 6))],
            method=method,
        )
        is None
    )


@pytest.mark.parametrize("method", ["clifford", "diagonal"])
def test_ghz_hyperedge_of_steane_codes_has_intrablock_cz(method):
    """Proposition 3.9 and Fig. 9: CZ between any two logical qubits of 3 Steanes on a GHZ."""
    code = ghz_joined([steane(f"s{i}") for i in range(3)], 0)
    logical = [(f"s{i}", 7) for i in range(3)]
    for a, b in itertools.combinations(range(3), 2):
        other = ({0, 1, 2} - {a, b}).pop()
        cz = bitwise(Gates.CZ, legs(f"s{a}", range(1, 7)), legs(f"s{b}", range(1, 7)))
        cleaning = bitwise(Gates.Z, legs(f"s{other}", [2, 4, 6]))
        action = logical_action(code, logical, cz + cleaning, method=method)
        assert action.equals([(Gates.CZ, (logical[a], logical[b]))])
        assert logical_action(code, logical, cz, method=method) is None

    s_and_s_dagger = bitwise(Gates.S, legs("s0", range(1, 7))) + bitwise(
        Gates.S_DAG, legs("s1", range(1, 7))
    )
    action = logical_action(code, logical, s_and_s_dagger, method=method)
    assert action.equals([(Gates.S_DAG, (logical[0],)), (Gates.S, (logical[1],))])


def test_five_qubit_code_sh_and_y_deformed_edges():
    """Sec. 3.2.1 and 4.1.1: SH^⊗n stays strongly transversal through Φ_Y edges only."""
    single = logical_action(five_qubit("f"), [5], bitwise(Gates.SH, range(5)))
    assert isinstance(single, CliffordLogicalAction)
    assert single.equals(Gates.SH)
    assert single.conjugation_table() == {"X": "+Z", "Z": "+Y"}

    logical = [("a", 5), ("b", 5)]
    expected = bitwise(Gates.SH, logical)
    for deformation, strongly_transversal in ((None, False), (Gates.Y, True)):
        code = five_qubit("a").merge_with(five_qubit("b"), [0], [0], [deformation])
        phys_a, phys_b = legs("a", range(1, 5)), legs("b", range(1, 5))
        action = logical_action(code, logical, bitwise(Gates.SH, phys_a + phys_b))
        assert (action is not None and action.equals(expected)) == strongly_transversal
    bell = five_qubit("a").merge_with(five_qubit("b"), [0], [0])
    weak = bitwise(Gates.SH, phys_a) + bitwise(Gates.SH.conj(), phys_b)
    assert logical_action(bell, logical, weak) is not None


def test_k3_across_three_blocks():
    """Gottesman's K3 across three [[5,1,3]] blocks survives Φ_Y traces but not Bell traces."""
    blocks = (
        five_qubit("f0").tensor_with(five_qubit("f1")).tensor_with(five_qubit("f2"))
    )
    logical = [(f"f{c}", 5) for c in range(3)]
    k3 = bitwise(Gates.K3, *(legs(f"f{c}", range(5)) for c in range(3)))
    assert logical_action(blocks, logical, k3).equals(Gates.K3)

    for deformation, survives in ((None, False), (Gates.Y, True)):
        code = None
        for c in range(3):
            pair = five_qubit(f"a{c}").merge_with(
                five_qubit(f"b{c}"), [0], [0], [deformation]
            )
            code = pair if code is None else code.tensor_with(pair)
        logical_a = [(f"a{c}", 5) for c in range(3)]
        logical_b = [(f"b{c}", 5) for c in range(3)]
        k3 = bitwise(
            Gates.K3, *(legs(f"a{c}", range(1, 5)) for c in range(3))
        ) + bitwise(Gates.K3, *(legs(f"b{c}", range(1, 5)) for c in range(3)))
        action = logical_action(code, logical_a + logical_b, k3)
        expected = [(Gates.K3, tuple(logical_a)), (Gates.K3, tuple(logical_b))]
        assert (action is not None and action.equals(expected)) == survives


def test_qrm_localized_cz_and_cz_symmetries():
    """Fig. 2c and App. C: CZ^⊗7 on a face is a logical CZ, CZ^⊗8 on a 3-subcube is trivial."""
    pair = qrm("a").tensor_with(qrm("b"))
    logical = [("a", 15), ("b", 15)]
    face = range(7)
    action = logical_action(
        pair, logical, bitwise(Gates.CZ, legs("a", face), legs("b", face))
    )
    assert action.equals(Gates.CZ)

    subcube = [0, 2, 4, 6, 8, 10, 12, 14]
    action = logical_action(
        pair, logical, bitwise(Gates.CZ, legs("a", subcube), legs("b", subcube))
    )
    assert action.equals(np.eye(4))


def test_ghz_joined_qrm_codes_have_addressable_cz_but_not_t():
    """Lemma 3.16 and Sec. 3.3: 3 QRMs on a GHZ, where CZ is addressable but T is not."""
    code = ghz_joined([qrm(f"q{i}") for i in range(3)], 0)
    logical = [(f"q{i}", 15) for i in range(3)]
    face = [1, 3, 5, 7, 9, 11, 13]
    cz = logical_action(
        code, logical, bitwise(Gates.CZ, legs("q0", face), legs("q1", face))
    )
    assert cz.equals([(Gates.CZ, (logical[0], logical[1]))])

    block_0 = legs("q0", range(1, 15))
    block_1 = legs("q1", range(1, 15))
    assert logical_action(code, logical, bitwise(Gates.T, block_0)) is None
    two_blocks = logical_action(
        code, logical, bitwise(Gates.T, block_0) + bitwise(Gates.T_DAG, block_1)
    )
    assert str(two_blocks) == "T†(q0:15) · T(q1:15)"


def test_clifford_and_diagonal_methods_agree():
    code = qrm("a").merge_with(steane("b"), [0], [0])
    logical = [("a", 15), ("b", 7)]
    for ops in (
        bitwise(Gates.S, legs("a", [2, 4, 5, 8, 9, 11, 14])),
        bitwise(Gates.Z, legs("b", [1, 2, 3])),
        bitwise(Gates.CZ, legs("a", [1, 2, 3]), legs("b", [1, 2, 3])),
    ):
        clifford = logical_action(code, logical, ops, method="clifford")
        diagonal = logical_action(code, logical, ops, method="diagonal")
        assert (clifford is None) == (diagonal is None)
        if clifford is not None:
            assert clifford.equals(diagonal.matrix())


def test_identity_and_empty_assignment():
    action = logical_action(steane("s"), [7], [])
    assert action.equals(np.eye(2))
    assert str(logical_action(steane("s"), [7], [], method="diagonal")) == "I"


def test_errors():
    s = steane("s")
    with pytest.raises(ValueError, match="logical legs"):
        logical_action(s, [7], [(Gates.T, (7,))])
    with pytest.raises(ValueError, match="not a stabilizer state"):
        logical_action(SignedStabilizerTensor(Legos.perf513), [0], [])
    with pytest.raises(ValueError, match="not diagonal"):
        logical_action(s, [7], [(Gates.T, (0,)), (Gates.H, (1,))])
    with pytest.raises(ValueError, match="not Clifford"):
        logical_action(s, [7], [(Gates.T, (0,))], method="clifford")
    with pytest.raises(ValueError, match="Unknown method"):
        logical_action(s, [7], [], method="magic")
    with pytest.raises(ValueError, match="Repeated"):
        logical_action(s, [7, 7], [])
    ghz = SignedStabilizerTensor(Legos.z_rep_code(3))
    for method in ("clifford", "diagonal"):
        with pytest.raises(ValueError, match="isometry"):
            logical_action(ghz, [0, 1], [], method=method)
