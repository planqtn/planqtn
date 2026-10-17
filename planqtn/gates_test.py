import numpy as np
import pytest

from planqtn.gates import Gate, Gates, bitwise, operator_matrix, pauli_matrix


def conjugate(gate, pauli):
    """Conjugate a Hermitian Pauli string like "XZ" with the gate's table."""
    q = gate.num_qubits
    bits = [int(c in "XY") for c in pauli] + [int(c in "ZY") for c in pauli]
    phase = sum(c == "Y" for c in pauli)
    key = int("".join(map(str, bits)), 2)
    images, phases = gate.pauli_conjugation_table()
    image, phase = images[key], (phase + phases[key]) % 4
    y_count = sum(int(image[i] & image[q + i]) for i in range(q))
    sign = "+" if (phase - y_count) % 4 == 0 else "-"
    return sign + "".join("IXZY"[image[i] + 2 * image[q + i]] for i in range(q))


@pytest.mark.parametrize(
    "gate,pauli,expected",
    [
        (Gates.H, "X", "+Z"),
        (Gates.H, "Z", "+X"),
        (Gates.H, "Y", "-Y"),
        (Gates.S, "X", "+Y"),
        (Gates.S, "Y", "-X"),
        (Gates.S, "Z", "+Z"),
        (Gates.SH, "X", "+Z"),
        (Gates.SH, "Z", "+Y"),
        (Gates.SH, "Y", "+X"),
        (Gates.Y, "X", "-X"),
        (Gates.CNOT, "XI", "+XX"),
        (Gates.CNOT, "IX", "+IX"),
        (Gates.CNOT, "ZI", "+ZI"),
        (Gates.CNOT, "IZ", "+ZZ"),
        (Gates.CZ, "XI", "+XZ"),
        (Gates.CZ, "YY", "+XX"),
    ],
)
def test_pauli_conjugation(gate, pauli, expected):
    assert conjugate(gate, pauli) == expected


@pytest.mark.parametrize("gate", [Gates.H, Gates.S, Gates.SH, Gates.CNOT, Gates.K3])
def test_pauli_conjugation_table_matches_matrices(gate):
    q = gate.num_qubits
    images, phases = gate.pauli_conjugation_table()
    for key in range(4**q):
        bits = [(key >> (2 * q - 1 - i)) & 1 for i in range(2 * q)]
        conjugated = gate.matrix @ pauli_matrix(bits) @ gate.matrix.conj().T
        np.testing.assert_allclose(
            conjugated, pauli_matrix(images[key], phases[key]), atol=1e-12
        )


def test_pauli_matrix_xz_form():
    np.testing.assert_allclose(pauli_matrix([1, 1], 1), Gates.Y.matrix)
    np.testing.assert_allclose(
        pauli_matrix([1, 0, 0, 1]), np.kron(Gates.X.matrix, Gates.Z.matrix)
    )


@pytest.mark.parametrize(
    "gate,clifford,diagonal",
    [
        (Gates.T, False, True),
        (Gates.S, True, True),
        (Gates.CS, False, True),
        (Gates.CCZ, False, True),
        (Gates.CZ, True, True),
        (Gates.SH, True, False),
        (Gates.K3, True, False),
        (Gates.H, True, False),
    ],
)
def test_is_clifford_and_is_diagonal(gate, clifford, diagonal):
    assert gate.is_clifford == clifford
    assert gate.is_diagonal == diagonal


@pytest.mark.parametrize(
    "gate,exponents,order",
    [
        (Gates.Z, [0, 1], 2),
        (Gates.S, [0, 1], 4),
        (Gates.T, [0, 1], 8),
        (Gates.T_DAG, [0, 7], 8),
        (Gates.CZ, [0, 0, 0, 1], 2),
        (Gates.CS, [0, 0, 0, 1], 4),
        (Gates.CCZ, [0, 0, 0, 0, 0, 0, 0, 1], 2),
        (Gates.phase(3, 16), [0, 3], 16),
        (Gate("e^{0.3i} T", np.exp(0.3j) * Gates.T.matrix), [0, 1], 8),
        (Gates.I, [0, 0], 1),
    ],
)
def test_diagonal_phases(gate, exponents, order):
    got_exponents, got_order = gate.diagonal_phases()
    assert got_order == order
    assert got_exponents.tolist() == exponents


def test_diagonal_phases_errors():
    with pytest.raises(ValueError, match="not diagonal"):
        Gates.H.diagonal_phases()
    with pytest.raises(ValueError, match="root of unity"):
        Gate("R", np.diag([1, np.exp(1j)])).diagonal_phases()


def test_gate_validation():
    with pytest.raises(ValueError, match="not unitary"):
        Gate("A", [[1, 1], [0, 1]])
    with pytest.raises(ValueError, match="2\\^q x 2\\^q"):
        Gate("B", np.eye(3))


def test_dagger_conj_transpose():
    assert Gates.S.dagger().name == "S†"
    assert Gates.S_DAG.dagger().name == "S"
    np.testing.assert_allclose(Gates.S.dagger().matrix, np.diag([1, -1j]))
    assert Gates.SH.conj().name == "SH*"
    np.testing.assert_allclose(Gates.SH.conj().matrix, Gates.SH.matrix.conj())
    np.testing.assert_allclose(Gates.SH.transpose().matrix, Gates.SH.matrix.T)


def test_controlled_phase():
    gate = Gates.controlled_phase(3, 1, 8)
    assert gate.name == "CCP(2π·1/8)"
    np.testing.assert_allclose(
        np.diag(gate.matrix), [1] * 7 + [np.exp(2j * np.pi / 8)], atol=1e-12
    )


def test_bitwise():
    assert bitwise(Gates.T, [0, 1]) == [(Gates.T, (0,)), (Gates.T, (1,))]
    assert bitwise(Gates.CZ, [("a", 0), ("a", 1)], [("b", 0), ("b", 1)]) == [
        (Gates.CZ, (("a", 0), ("b", 0))),
        (Gates.CZ, (("a", 1), ("b", 1))),
    ]
    with pytest.raises(ValueError, match="acts on 2 qubits"):
        bitwise(Gates.CZ, [0, 1])
    with pytest.raises(ValueError, match="different lengths"):
        bitwise(Gates.CZ, [0, 1], [2])


def test_operator_matrix():
    np.testing.assert_allclose(
        operator_matrix([(Gates.X, ("a",))], ["a", "b"]),
        np.kron(Gates.X.matrix, np.eye(2)),
    )
    swap = np.eye(4)[[0, 2, 1, 3]]
    np.testing.assert_allclose(
        operator_matrix([(Gates.CNOT, ("b", "a"))], ["a", "b"]),
        swap @ Gates.CNOT.matrix @ swap,
    )
    np.testing.assert_allclose(
        operator_matrix([(Gates.H, ("a",)), (Gates.S, ("a",))], ["a"]),
        Gates.SH.matrix,
    )
    with pytest.raises(ValueError, match="outside of"):
        operator_matrix([(Gates.X, ("c",))], ["a", "b"])
