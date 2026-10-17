"""Tests, many of which check claims of ChunJun Cao and Brad Lackey, "Quantum Lego Power-up:
Designing Transversal Gates with Tensor Networks", arXiv:2603.03542 (2026)."""

import itertools

import numpy as np
import pytest

from planqtn.fault_tolerance import (
    analyze_transversality,
    blocks_by_tensor_id,
    code_distance,
)
from planqtn.gates import Gates, bitwise
from planqtn.legos import Legos
from planqtn.signed_stabilizer_tensor import SignedStabilizerTensor, signed_rref
from planqtn.transversal import find_cleaning, logical_action
from planqtn.transversal_search import search_patterns


def legs(name, indices):
    return [(name, i) for i in indices]


def steane(name):
    return SignedStabilizerTensor(Legos.steane_code_813_encoding_tensor, name)


def qrm(name):
    return SignedStabilizerTensor(Legos.qrm15_encoding_tensor, name)


def ghz_joined(blocks, joined_leg, name="g"):
    tensor = SignedStabilizerTensor(Legos.z_rep_code(len(blocks)), name)
    for i, block in enumerate(blocks):
        tensor = tensor.merge_with(block, [(name, i)], [joined_leg])
    return tensor


def naive_distance(tensor, logical, max_weight):
    """Smallest weight Pauli that commutes with the code stabilizers but is not one of them."""
    n = tensor.n
    logical_cols = logical + [n + i for i in logical]
    xz, _, pivots = signed_rref(tensor.xz, tensor.phases, logical_cols)
    physical = [i for i in range(n) if i not in logical]
    cols = physical + [n + i for i in physical]
    num_logical_rows = len(pivots)
    stabilizers = xz[num_logical_rows:][:, cols].astype(int)
    m = len(physical)
    for weight in range(1, max_weight + 1):
        for support in itertools.combinations(range(m), weight):
            for letters in itertools.product("XYZ", repeat=weight):
                v = np.zeros(2 * m, dtype=int)
                for q, letter in zip(support, letters):
                    v[q] = letter in "XY"
                    v[m + q] = letter in "ZY"
                products = (stabilizers[:, :m] @ v[m:] + stabilizers[:, m:] @ v[:m]) % 2
                if products.any():
                    continue
                stacked = np.vstack([stabilizers, v])
                if gf2_rank(stacked) > gf2_rank(stabilizers):
                    return weight
    return None


def gf2_rank(matrix):
    m = matrix.copy() % 2
    r = 0
    for c in range(m.shape[1]):
        rows = [i for i in range(r, len(m)) if m[i, c]]
        if not rows:
            continue
        m[[r, rows[0]]] = m[[rows[0], r]]
        for i in range(len(m)):
            if i != r and m[i, c]:
                m[i] ^= m[r]
        r += 1
    return r


@pytest.mark.parametrize(
    "h,logical,expected",
    [
        (Legos.steane_code_813_encoding_tensor, [7], 3),
        (Legos.steane_code_813_encoding_tensor, [7, 0], 2),
        (Legos.perf513_encoding_tensor, [5], 3),
        (Legos.code832_encoding_tensor, [8, 9, 10], 2),
        (Legos.qrm15_encoding_tensor, [15], 3),
        (Legos.qrm15_encoding_tensor, [15, 0], 2),
    ],
)
def test_code_distance_matches_naive_search(h, logical, expected):
    tensor = SignedStabilizerTensor(h)
    assert code_distance(tensor, logical) == expected
    assert naive_distance(tensor, logical, 3) == expected


def test_distances_of_glued_codes():
    """Lemma A.3 and Prop. 3.9: [[28,2,3]] from two QRMs and [[18,3,3]] from three Steanes."""
    x_edge = qrm("a").merge_with(qrm("b"), [0], [0], [Gates.X])
    assert code_distance(x_edge, [("a", 15), ("b", 15)]) == 3
    code = ghz_joined([steane(f"s{i}") for i in range(3)], 0)
    assert code_distance(code, [(f"s{i}", 7) for i in range(3)]) == 3
    assert code_distance(code, [(f"s{i}", 7) for i in range(3)], max_weight=2) is None
    with pytest.raises(ValueError, match="more than"):
        code_distance(code, [(f"s{i}", 7) for i in range(3)], max_candidates=10)
    with pytest.raises(ValueError, match="not a stabilizer state"):
        code_distance(SignedStabilizerTensor(Legos.perf513), [])


def test_strong_weak_and_localized():
    q = legs("q", range(15))
    blocks = {"q": q}
    strong = analyze_transversality(bitwise(Gates.T, q), blocks)
    assert strong.strongly_transversal and strong.weakly_transversal
    assert not strong.localized and strong.fault_tolerant is None
    mixed = bitwise(Gates.T, q[:14]) + [(Gates.T_DAG, (q[14],))]
    weak = analyze_transversality(mixed, blocks)
    assert weak.weakly_transversal and not weak.strongly_transversal
    localized = analyze_transversality(bitwise(Gates.T, q[:14]), blocks)
    assert localized.localized and not localized.strongly_transversal
    assert localized.support == {"q": 14} and localized.spread == {"q": 1}
    phase = analyze_transversality([(Gates.T, (q[0],)), (Gates.T, (q[1],))], blocks)
    assert phase.fault_tolerant is None and phase.max_spread == 1

    k3 = bitwise(Gates.K3, *(legs(f"f{c}", range(5)) for c in range(3)))
    three = {f"f{c}": legs(f"f{c}", range(5)) for c in range(3)}
    report = analyze_transversality(k3, three, {name: 3 for name in three})
    assert report.strongly_transversal and report.fault_tolerant


def test_interblock_and_intrablock_cz_on_ghz_joined_steanes():
    """Sec. 3.2.2 and Lemma 3.16: the interblock CZ ⊗ CZ ⊗ I is fault-tolerant, the intrablock CZ
    would need shortened codes of distance 3."""
    copies = {}
    for copy in "AB":
        copies[copy] = ghz_joined(
            [steane(f"{copy}{i}") for i in range(3)], 0, name=f"g{copy}"
        )
    two_copies = copies["A"].tensor_with(copies["B"])
    logical = [(f"{copy}{i}", 7) for copy in "AB" for i in range(3)]
    sites = [(("A1", i), ("B1", i)) for i in range(1, 7)]
    for weight in range(1, 7):
        assert not search_patterns(
            two_copies, logical, sites, [None, Gates.CZ], weight=weight
        )
    interblock = bitwise(
        Gates.CZ, legs("A0", range(1, 7)), legs("B0", range(1, 7))
    ) + bitwise(Gates.CZ, legs("A1", range(1, 7)), legs("B1", range(1, 7)))
    action = logical_action(two_copies, logical, interblock)
    assert action.equals(
        [(Gates.CZ, (("A0", 7), ("B0", 7))), (Gates.CZ, (("A1", 7), ("B1", 7)))]
    )
    physical = {
        copy: [leg for leg in copies[copy].legs if leg[1] != 7] for copy in "AB"
    }
    distance = code_distance(copies["A"], [(f"A{i}", 7) for i in range(3)])
    report = analyze_transversality(
        interblock, physical, {"A": distance, "B": distance}
    )
    assert report.weakly_transversal and report.localized
    assert report.max_spread == 1 and report.fault_tolerant

    code = copies["A"]
    code_logical = [(f"A{i}", 7) for i in range(3)]
    cz = bitwise(Gates.CZ, legs("A0", range(1, 7)), legs("A1", range(1, 7)))
    cleaning = find_cleaning(
        code, code_logical, cz, target=[(Gates.CZ, (("A0", 7), ("A1", 7)))]
    )
    code_physical = [leg for leg in code.legs if leg not in code_logical]
    as_one_block = analyze_transversality(
        cleaning.ops, {"code": code_physical}, {"code": distance}
    )
    assert as_one_block.max_spread == 2 and not as_one_block.fault_tolerant
    branches = blocks_by_tensor_id(code_physical)
    assert sorted(branches) == ["A0", "A1", "A2"]
    shortened = code_distance(steane("s"), [7, 0])
    by_branch = analyze_transversality(
        cleaning.ops, branches, {name: shortened for name in branches}
    )
    assert by_branch.weakly_transversal and by_branch.max_spread == 1
    assert shortened == 2 and not by_branch.fault_tolerant


def test_errors():
    with pytest.raises(ValueError, match="blocks"):
        analyze_transversality([], {"a": [0, 1], "b": [1]})
    with pytest.raises(ValueError, match="outside"):
        analyze_transversality([(Gates.T, (2,))], {"a": [0, 1]})
    with pytest.raises(ValueError, match="Missing"):
        analyze_transversality([], {"a": [0], "b": [1]}, {"a": 3})
    empty = analyze_transversality([], {"a": [0]})
    assert not empty.strongly_transversal and empty.localized and empty.max_spread == 0
