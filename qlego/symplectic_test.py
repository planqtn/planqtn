from galois import GF2
import numpy as np
from qlego.symplectic import omega, symp_to_str, weight


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
