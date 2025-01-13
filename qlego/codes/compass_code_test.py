from galois import GF2
import numpy as np
from qlego.codes.compass_code import CompassCodeTN
from qlego.legos import Legos
from qlego.scalar_stabilizer_enumerator import ScalarStabilizerCodeEnumerator
from qlego.simple_poly import SimplePoly


def test_compass_code():
    tn = CompassCodeTN(
        [
            [1, 1],
            [2, 1],
        ]
    )

    tn_wep = tn.stabilizer_enumerator_polynomial(cotengra=False)
    expected_wep = (
        ScalarStabilizerCodeEnumerator(
            GF2(
                [
                    [1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    [0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0],
                    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1],
                ]
            )
        ).stabilizer_enumerator_polynomial()
        / 4
    )

    assert tn_wep == expected_wep


def test_compass_code_z_coset_weight_enumerator_weight1():
    coloring = np.array(
        [
            [1, 2],
            [2, 1],
        ]
    )
    tn = CompassCodeTN(
        coloring,
        lego=lambda i: Legos.enconding_tensor_512_z,
        coset_error=GF2([0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0]),
    )
    wep = tn.stabilizer_enumerator_polynomial(cotengra=False)
    assert wep == SimplePoly({5: 9, 3: 4, 7: 2, 1: 1}), f"Not equal, got:\n{wep}"


def test_compass_code_z_coset_weight_enumerator_weight2():
    coloring = np.array(
        [
            [1, 2],
            [2, 1],
        ]
    )
    tn = CompassCodeTN(
        coloring,
        lego=lambda i: Legos.enconding_tensor_512_z,
        coset_error=GF2([0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1]),
    )
    wep = tn.stabilizer_enumerator_polynomial(cotengra=False)
    assert wep == SimplePoly({4: 10, 6: 5, 2: 1}), f"Not equal, got:\n{wep}"
