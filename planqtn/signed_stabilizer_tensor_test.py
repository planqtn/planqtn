import numpy as np
import pytest
from galois import GF2

from planqtn.gates import Gates, bitwise
from planqtn.legos import Legos
from planqtn.linalg import rank
from planqtn.parity_check import conjoin
from planqtn.signed_stabilizer_tensor import (
    ContractionVanishesError,
    SignedStabilizerTensor,
)
from planqtn.stabilizer_tensor_enumerator import StabilizerCodeTensorEnumerator
from planqtn.tensor_network import TensorNetwork


def same_row_space(h1, h2):
    return rank(h1) == rank(h2) == rank(GF2(np.vstack([h1, h2])))


def same_group(t1, t2):
    return (
        t1.legs == t2.legs
        and t1.rank == t2.rank
        and all(
            t2.stabilizer_sign(p[1:]) == (1 if p[0] == "+" else -1)
            for p in t1.pauli_strings()
        )
    )


def same_state(psi1, psi2):
    return np.isclose(abs(np.vdot(psi1, psi2)), 1.0)


def dense_merge(psi_a, n_a, leg_a, psi_b, n_b, leg_b, c):
    """<Φ_C| on leg_a of psi_a and leg_b of psi_b, with C acting on leg_b."""
    a = np.moveaxis(psi_a.reshape([2] * n_a), leg_a, -1)
    b = np.moveaxis(psi_b.reshape([2] * n_b), leg_b, 0).reshape(2, -1)
    psi = np.tensordot(a, c.conj().T @ b, axes=([n_a - 1], [0])).reshape(-1)
    return psi / np.linalg.norm(psi)


def dense_self_trace(psi, n, j, m, c):
    t = np.moveaxis(psi.reshape([2] * n), [j, m], [0, 1])
    t = np.einsum("ki,ji...->jk...", c.conj().T, t)
    out = np.einsum("ii...->...", t).reshape(-1)
    return out / np.linalg.norm(out)


def test_default_signs_and_pauli_strings():
    t = SignedStabilizerTensor(Legos.perf513)
    assert t.signs == (1, 1, 1, 1)
    assert t.pauli_strings() == ["+XZZXI", "+IXZZX", "+XIXZZ", "+ZXIXZ"]
    assert t.legs == [(0, i) for i in range(5)]
    assert t.rank == 4 and t.n == 5


def test_from_pauli_strings_round_trip():
    paulis = ["-XX", "+ZZ"]
    t = SignedStabilizerTensor.from_pauli_strings(paulis, tensor_id="b")
    assert t.pauli_strings() == paulis
    assert t.signs == (-1, 1)
    assert np.array_equal(t.h, GF2([[1, 1, 0, 0], [0, 0, 1, 1]]))


def test_validation():
    with pytest.raises(ValueError, match="do not commute"):
        SignedStabilizerTensor.from_pauli_strings(["X", "Z"])
    with pytest.raises(ValueError, match="inconsistent"):
        SignedStabilizerTensor.from_pauli_strings(["XX", "ZZ", "YY"])
    with pytest.raises(ValueError, match="inconsistent"):
        SignedStabilizerTensor.from_pauli_strings(["-I"])
    with pytest.raises(ValueError, match="distinct legs"):
        SignedStabilizerTensor(Legos.identity, legs=[(0, 0)])
    with pytest.raises(ValueError, match="Signs must be"):
        SignedStabilizerTensor(Legos.identity, signs=[1, 2])
    with pytest.raises(ValueError, match="Invalid Pauli string"):
        SignedStabilizerTensor.from_pauli_strings(["XA"])


def test_redundant_rows_are_dropped_and_others_kept():
    t = SignedStabilizerTensor.from_pauli_strings(["XX", "ZZ", "-YY", "II"])
    assert t.pauli_strings() == ["+XX", "+ZZ"]
    assert SignedStabilizerTensor(Legos.stopper_i).rank == 0


def test_stabilizer_sign():
    bell = SignedStabilizerTensor(Legos.identity, tensor_id="a")
    assert bell.stabilizer_sign("XX") == 1
    assert bell.stabilizer_sign("YY") == -1
    assert bell.stabilizer_sign("ZI") == 0
    assert bell.stabilizer_sign({("a", 0): "Z", 1: "Z"}) == 1
    with pytest.raises(ValueError, match="2 letters"):
        bell.stabilizer_sign("X")


@pytest.mark.parametrize(
    "h1,h2,leg1,leg2",
    [
        (Legos.qrm15_encoding_tensor, Legos.qrm15_encoding_tensor, 0, 0),
        (Legos.steane_code_813_encoding_tensor, Legos.perf513_encoding_tensor, 3, 2),
        (Legos.code832_encoding_tensor, Legos.steane_code_813_encoding_tensor, 8, 7),
        (Legos.perf513, Legos.enconding_tensor_603, 4, 5),
        (Legos.h, Legos.z_rep_code(4), 1, 3),
    ],
)
def test_bell_trace_matches_gf2_conjoin(h1, h2, leg1, leg2):
    t1 = SignedStabilizerTensor(h1, tensor_id="a")
    t2 = SignedStabilizerTensor(h2, tensor_id="b")
    traced = t1.merge_with(t2, [leg1], [leg2])
    assert same_row_space(traced.h, conjoin(h1, h2, leg1, leg2))


def test_multi_leg_merge_matches_enumerator_merge():
    h = Legos.qrm15_encoding_tensor
    signed = SignedStabilizerTensor(h, "a").merge_with(
        SignedStabilizerTensor(h, "b"), [0, 1, 2], [0, 1, 2]
    )
    unsigned = StabilizerCodeTensorEnumerator(h, "a").merge_with(
        StabilizerCodeTensorEnumerator(h, "b"), [0, 1, 2], [0, 1, 2]
    )
    assert signed.legs == unsigned.legs
    assert same_row_space(signed.h, unsigned.h)


def test_pauli_deformations_only_change_signs():
    a = SignedStabilizerTensor(Legos.qrm15_encoding_tensor, "a")
    b = SignedStabilizerTensor(Legos.qrm15_encoding_tensor, "b")
    bell = a.merge_with(b, [0], [0])
    x_edge = a.merge_with(b, [0], [0], deformations=[Gates.X])
    assert same_row_space(bell.h, x_edge.h)
    assert not same_group(bell, x_edge)


@pytest.mark.parametrize(
    "deformation", [None, Gates.X, Gates.Y, Gates.Z, Gates.H, Gates.S, Gates.SH]
)
def test_traces_match_dense_contraction(deformation):
    a = SignedStabilizerTensor(Legos.perf513_encoding_tensor, "a")
    b = SignedStabilizerTensor(Legos.perf513_encoding_tensor, "b")
    c = np.eye(2) if deformation is None else deformation.matrix

    merged = a.merge_with(b, [0], [2], deformations=[deformation])
    expected = dense_merge(a.to_statevector(), 6, 0, b.to_statevector(), 6, 2, c)
    assert same_state(merged.to_statevector(), expected)

    looped = merged.self_trace(("a", 1), ("b", 3), deformation)
    j, m = merged.legs.index(("a", 1)), merged.legs.index(("b", 3))
    expected = dense_self_trace(merged.to_statevector(), merged.n, j, m, c)
    assert same_state(looped.to_statevector(), expected)


def test_vanishing_traces():
    zeros = SignedStabilizerTensor.from_pauli_strings(["ZI", "IZ"], tensor_id="a")
    one = SignedStabilizerTensor.from_pauli_strings(["-Z"], tensor_id="b")
    with pytest.raises(ContractionVanishesError, match="zero tensor"):
        zeros.merge_with(one, [1], [0])
    assert zeros.merge_with(one, [1], [0], deformations=[Gates.X]).pauli_strings() == [
        "+Z"
    ]
    with pytest.raises(ContractionVanishesError):
        SignedStabilizerTensor.from_pauli_strings(["-XX", "ZZ"]).self_trace(0, 1)


def test_trace_of_mixed_tensors():
    free = SignedStabilizerTensor(Legos.stopper_i, tensor_id="f")
    zero = SignedStabilizerTensor(Legos.stopper_z, tensor_id="z")
    assert free.merge_with(zero, [0], [0]).n == 0
    code = SignedStabilizerTensor(Legos.perf513, tensor_id="c")
    stopped = code.merge_with(zero, [4], [0])
    assert stopped.n == 4 and stopped.rank == 3
    assert same_row_space(stopped.h, conjoin(Legos.perf513, Legos.stopper_z, 4, 0))


def test_self_trace_errors():
    t = SignedStabilizerTensor(Legos.z_rep_code(3), "g")
    with pytest.raises(ValueError, match="with itself"):
        t.self_trace(0, 0)
    with pytest.raises(ValueError, match="single qubit Clifford"):
        t.self_trace(0, 1, Gates.T)
    with pytest.raises(ValueError, match="is not a leg"):
        t.self_trace(0, 7)


def test_ghz_hyperedge_trace():
    pairs = [SignedStabilizerTensor(Legos.identity, f"p{i}") for i in range(3)]
    t = SignedStabilizerTensor(Legos.z_rep_code(3), "g")
    for i, pair in enumerate(pairs):
        t = t.merge_with(pair, [("g", i)], [0])
    assert t.legs == [("p0", 1), ("p1", 1), ("p2", 1)]
    assert t.stabilizer_sign("ZZI") == 1
    assert t.stabilizer_sign("IZZ") == 1
    assert t.stabilizer_sign("XXX") == 1


def test_tensor_with():
    a = SignedStabilizerTensor.from_pauli_strings(["-Z"], tensor_id="a")
    b = SignedStabilizerTensor.from_pauli_strings(["XX", "-ZZ"], tensor_id="b")
    t = a.tensor_with(b)
    assert t.legs == [("a", 0), ("b", 0), ("b", 1)]
    assert t.pauli_strings() == ["-ZII", "+IXX", "-IZZ"]
    with pytest.raises(ValueError, match="share legs"):
        a.tensor_with(a)


def test_apply():
    zeros = SignedStabilizerTensor.from_pauli_strings(["ZI", "IZ"])
    assert zeros.apply([(Gates.X, (0,))]).pauli_strings() == ["-ZI", "+IZ"]
    assert zeros.apply([(Gates.H, (1,))]).pauli_strings() == ["+ZI", "+IX"]
    bell = SignedStabilizerTensor(Legos.identity).apply(
        [(Gates.S, (0,)), (Gates.S, (1,))]
    )
    assert bell.stabilizer_sign("YY") == 1
    assert bell.stabilizer_sign("ZZ") == 1
    with pytest.raises(ValueError, match="not a Clifford"):
        zeros.apply(bitwise(Gates.T, [0, 1]))
    with pytest.raises(ValueError, match="overlapping"):
        zeros.apply([(Gates.X, (0,)), (Gates.Z, (0,))])
    with pytest.raises(ValueError, match="acts on 2 qubits"):
        zeros.apply([(Gates.CZ, (0,))])


def test_support():
    ghz = SignedStabilizerTensor(Legos.z_rep_code(3))
    assert sorted(map(tuple, ghz.support().tolist())) == [(0, 0, 0), (1, 1, 1)]
    one_plus = SignedStabilizerTensor.from_pauli_strings(["-ZI", "IX"])
    assert sorted(map(tuple, one_plus.support().tolist())) == [(1, 0), (1, 1)]
    with pytest.raises(ValueError, match="not a stabilizer state"):
        SignedStabilizerTensor(Legos.perf513).support()
    with pytest.raises(ValueError, match="dimension"):
        SignedStabilizerTensor(Legos.x_rep_code(5)).support(max_dimension=3)


def test_to_statevector():
    bell = SignedStabilizerTensor(Legos.identity, "a")
    np.testing.assert_allclose(
        bell.to_statevector(), np.array([1, 0, 0, 1]) / np.sqrt(2)
    )
    singlet = bell.merge_with(
        SignedStabilizerTensor(Legos.identity, "b"), [1], [0], [Gates.Y]
    )
    assert same_state(singlet.to_statevector(), np.array([0, 1, -1, 0]) / np.sqrt(2))
    plus_i = SignedStabilizerTensor(Legos.stopper_y)
    assert same_state(plus_i.to_statevector(), np.array([1, 1j]) / np.sqrt(2))


def test_from_tensor_network():
    nodes = [
        StabilizerCodeTensorEnumerator(Legos.perf513_encoding_tensor, "a"),
        StabilizerCodeTensorEnumerator(Legos.perf513_encoding_tensor, "b"),
        StabilizerCodeTensorEnumerator(Legos.steane_code_813_encoding_tensor, "c"),
    ]
    tn = TensorNetwork(nodes)
    tn.self_trace("a", "b", [0], [0])
    tn.self_trace("b", "c", [1, 2], [0, 1])
    assert tn.traces == [
        ("a", "b", [("a", 0)], [("b", 0)]),
        ("b", "c", [("b", 1), ("b", 2)], [("c", 0), ("c", 1)]),
    ]

    a, b, c = (SignedStabilizerTensor(n.h, n.tensor_id) for n in nodes)
    plain = a.merge_with(b, [0], [0]).merge_with(c, [("b", 1), ("b", 2)], [0, 1])
    assert same_group(SignedStabilizerTensor.from_tensor_network(tn), plain)

    deformed = a.merge_with(b, [0], [0], [Gates.Y]).merge_with(
        c, [("b", 1), ("b", 2)], [0, 1], [None, Gates.SH.transpose()]
    )
    from_tn = SignedStabilizerTensor.from_tensor_network(
        tn, {(("a", 0), ("b", 0)): Gates.Y, (("c", 1), ("b", 2)): Gates.SH}
    )
    assert same_group(from_tn, deformed)
    assert not same_group(from_tn, plain)

    with pytest.raises(ValueError, match="not traced"):
        SignedStabilizerTensor.from_tensor_network(tn, {(("a", 1), ("b", 3)): Gates.X})
