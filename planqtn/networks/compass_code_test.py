from galois import GF2
import numpy as np
import pytest
from planqtn.networks.compass_code import CompassCodeConcatenateAndSparsifyTN, CompassCodeDualSurfaceCodeLayoutTN
from planqtn.legos import Legos
from planqtn.poly import UnivariatePoly
from planqtn.stabilizer_tensor_enumerator import StabilizerCodeTensorEnumerator

@pytest.mark.parametrize("TNClass", [CompassCodeDualSurfaceCodeLayoutTN, CompassCodeConcatenateAndSparsifyTN])
def test_compass_code(TNClass):
    tn = TNClass(
        [
            [1, 1],
            [2, 1],
        ]
    )

    tn_wep = tn.stabilizer_enumerator_polynomial(cotengra=False)
    expected_wep = StabilizerCodeTensorEnumerator(
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

    tn_shor = TNClass(
        [
            [2, 2],
            [2, 2],
        ]
    )

    tn_wep = tn_shor.stabilizer_enumerator_polynomial(cotengra=False)
    expected_wep = StabilizerCodeTensorEnumerator(
        GF2(
            [
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
                [1, 0, 0, 1, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
                [0, 1, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0]
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
    tn = CompassCodeDualSurfaceCodeLayoutTN(
        coloring,
        lego=lambda i: Legos.encoding_tensor_512_z,
        coset_error=GF2([0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0]),
    )
    wep = tn.stabilizer_enumerator_polynomial(cotengra=False)
    assert wep == UnivariatePoly({5: 9, 3: 4, 7: 2, 1: 1}), f"Not equal, got:\n{wep}"


def test_compass_code_z_coset_weight_enumerator_weight2():
    coloring = np.array(
        [
            [1, 2],
            [2, 1],
        ]
    )
    tn = CompassCodeDualSurfaceCodeLayoutTN(
        coloring,
        lego=lambda i: Legos.encoding_tensor_512_z,
        coset_error=GF2([0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1]),
    )
    wep = tn.stabilizer_enumerator_polynomial(cotengra=False)
    assert wep == UnivariatePoly({4: 10, 6: 5, 2: 1}), f"Not equal, got:\n{wep}"


def test_compass_d3_rsc_z_coset():
    coloring = np.array(
        [
            [1, 2],
            [2, 1],
        ]
    )
    tn = CompassCodeDualSurfaceCodeLayoutTN(
        coloring,
        lego=lambda i: Legos.encoding_tensor_512_z,
        coset_error=((), (0, 5)),
    )

    we = tn.stabilizer_enumerator_polynomial(cotengra=False)
    print(we)
    assert we == UnivariatePoly(
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
    tn = CompassCodeDualSurfaceCodeLayoutTN(
        coloring,
        lego=lambda i: Legos.encoding_tensor_512_z,
        coset_error=((), (0, 8)),
        truncate_length=2,
    )

    wep = tn.stabilizer_enumerator_polynomial(cotengra=False)

    tn.set_truncate_length(None)

    wep_full = tn.stabilizer_enumerator_polynomial(cotengra=False)
    assert (
        wep_full.dict[2] == wep.dict[2]
    ), f"Not equal, got: {wep} vs expected {wep_full}"

    # pytest.fail(f"Debug, got:\n{wep} vs {wep_full}")

    tn = CompassCodeDualSurfaceCodeLayoutTN(
        coloring,
        lego=lambda i: Legos.encoding_tensor_512_z,
        coset_error=((), (4,)),
        truncate_length=1,
    )
    wep = tn.stabilizer_enumerator_polynomial(verbose=True, cotengra=False)
    assert wep == UnivariatePoly({1: 1}), f"Not equal, got:\n{wep}"
