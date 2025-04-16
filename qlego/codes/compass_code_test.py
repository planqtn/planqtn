from galois import GF2
import numpy as np
import pytest
from qlego.codes.compass_code import CompassCodeTN
from qlego.codes.rotated_surface_code import RotatedSurfaceCodeTN
from qlego.legos import Legos
from qlego.simple_poly import SimplePoly
from qlego.tensor_stabilizer_enumerator import TensorStabilizerCodeEnumerator


def test_compass_code():
    tn = CompassCodeTN(
        [
            [1, 1],
            [2, 1],
        ]
    )

    tn_wep = tn.stabilizer_enumerator_polynomial(cotengra=False)
    expected_wep = TensorStabilizerCodeEnumerator(
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


def test_compass_d3_rsc_z_coset():
    coloring = np.array(
        [
            [1, 2],
            [2, 1],
        ]
    )
    tn = CompassCodeTN(
        coloring,
        lego=lambda i: Legos.enconding_tensor_512_z,
        coset_error=((), (0, 5)),
    )

    we = tn.stabilizer_enumerator_polynomial(cotengra=False)
    print(we)
    assert we == SimplePoly(
        {
            2: 1,
            4: 10,
            6: 5,
        }
    )


def test_compass_truncated_coset_wep():
    coloring = np.array(
        [
            [1, 2],
            [2, 1],
        ]
    )
    tn = CompassCodeTN(
        coloring,
        lego=lambda i: Legos.enconding_tensor_512_z,
        coset_error=((), (0, 8)),
        truncate_length=2,
    )

    wep = tn.stabilizer_enumerator_polynomial(cotengra=False)

    tn.set_truncate_length(None)

    wep_full = tn.stabilizer_enumerator_polynomial(cotengra=False)
    assert (
        wep_full._dict[2] == wep._dict[2]
    ), f"Not equal, got: {wep} vs expected {wep_full}"

    # pytest.fail(f"Debug, got:\n{wep} vs {wep_full}")

    tn = CompassCodeTN(
        coloring,
        lego=lambda i: Legos.enconding_tensor_512_z,
        coset_error=((), (4,)),
        truncate_length=1,
    )
    wep = tn.stabilizer_enumerator_polynomial(cotengra=False)
    assert wep == SimplePoly({1: 1}), f"Not equal, got:\n{wep}"
