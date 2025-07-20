from galois import GF2
import numpy as np
from planqtn.symplectic import omega, symp_to_str, weight, sympl_to_pauli_repr


def test_weight():
    assert weight(GF2([1, 0, 0, 0, 0, 0])) == 1
    assert weight(GF2([1, 0, 0, 1, 0, 0])) == 1
    assert weight(GF2([0, 0, 0, 1, 0, 0])) == 1
    assert weight(GF2([0, 1, 0, 1, 0, 0])) == 2
    assert weight(GF2([0, 1, 1, 1, 1, 0])) == 3


def test_symp_to_str():
    assert symp_to_str(GF2([1, 0, 0, 1])) == "XZ"
    assert symp_to_str(GF2([0, 0, 0, 1])) == "IZ"
    assert symp_to_str(GF2([0, 1, 0, 1])) == "IY"


def test_omega():
    np.testing.assert_array_equal(
        omega(1),
        GF2(
            [
                [0, 1],
                [1, 0],
            ]
        ),
    )

    np.testing.assert_array_equal(
        omega(2),
        GF2(
            [
                [0, 0, 1, 0],
                [0, 0, 0, 1],
                [1, 0, 0, 0],
                [0, 1, 0, 0],
            ]
        ),
    )


def test_to_pauli_repr():
    # I
    assert sympl_to_pauli_repr((0, 0)) == (0,)
    # X
    assert sympl_to_pauli_repr((1, 0)) == (1,)
    # Z
    assert sympl_to_pauli_repr((0, 1)) == (2,)
    # Y
    assert sympl_to_pauli_repr((1, 1)) == (3,)

    assert sympl_to_pauli_repr((0, 0, 0, 0)) == (0, 0)
    assert sympl_to_pauli_repr((1, 0, 0, 0)) == (1, 0)
    assert sympl_to_pauli_repr((0, 1, 0, 0)) == (0, 1)
    assert sympl_to_pauli_repr((0, 1, 0, 1)) == (0, 3)
