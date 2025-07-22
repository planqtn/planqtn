from galois import GF2
import numpy as np
import scipy
from planqtn.networks.surface_code import SurfaceCodeTN
from planqtn.legos import Legos
from planqtn.tensor_network import (
    PAULI_X,
    PAULI_Y,
    PAULI_Z,
    StabilizerCodeTensorEnumerator,
)


def test_d3_unrotated_surface_code_coset_weight_enumerator():

    x_error_bits = [0, 2, 3, 7]
    z_error_bits = [1, 2, 7, 9]

    coset_error = GF2.Zeros(2 * 13)
    for b in x_error_bits:
        coset_error[b] = 1
    for b in z_error_bits:
        coset_error[b + 13] = 1

    tn = SurfaceCodeTN(
        d=3, lego=lambda i: Legos.enconding_tensor_512, coset_error=coset_error
    )
    we = tn.stabilizer_enumerator_polynomial(cotengra=False)

    hx_sparse = [
        [0, 1, 3],
        [1, 2, 4],
        [3, 5, 6, 8],
        [4, 6, 7, 9],
        [8, 10, 11],
        [9, 11, 12],
    ]

    hz_sparse = [
        [0, 3, 5],
        [1, 3, 4, 6],
        [2, 4, 7],
        [5, 8, 10],
        [6, 8, 9, 11],
        [7, 9, 12],
    ]

    hz = GF2.Zeros((6, 13))

    for r, g in enumerate(hz_sparse):
        hz[r][np.array(g)] = 1

    hx = GF2.Zeros((6, 13))
    for r, g in enumerate(hx_sparse):
        hx[r][np.array(g)] = 1

    h = GF2(scipy.linalg.block_diag(hx, hz))

    # x_errors = [
    #     (0, 0),
    #     (0, 4),
    #     (2, 4),
    #     (1, 1),
    # ]
    # z_errors = [
    #     (0, 2),
    #     (0, 4),
    #     (0, 4),
    #     (2, 4),
    #     (2, 4),
    #     (3, 3),
    # ]

    print("----")
    expected_we = StabilizerCodeTensorEnumerator(
        h,
        coset_flipped_legs=[
            ((0, q), PAULI_X) for q in x_error_bits if q not in z_error_bits
        ]
        + [((0, q), PAULI_Z) for q in z_error_bits if q not in x_error_bits]
        + [
            ((0, q), PAULI_Y) for q in set(x_error_bits).intersection(set(z_error_bits))
        ],
    ).stabilizer_enumerator_polynomial()
    assert we == expected_we, f"WEPs not equal\ngot:\n{we},\nexpected\n{expected_we}"


def test_d2_unrotated_surface_code():
    tn = SurfaceCodeTN(d=2, lego=lambda i: Legos.enconding_tensor_512)
    we = tn.stabilizer_enumerator_polynomial()

    h = GF2(
        [
            [1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 1, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 0, 1, 1, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 1],
        ]
    )

    expected_we = StabilizerCodeTensorEnumerator(h).stabilizer_enumerator_polynomial()

    assert we == expected_we, f"Not equal, got:\n{we}, expected\n{expected_we}"


def test_d3_unrotated_surface_code():
    tn = SurfaceCodeTN(d=3, lego=lambda i: Legos.enconding_tensor_512)
    we = tn.stabilizer_enumerator_polynomial()

    hx_sparse = [
        [0, 1, 3],
        [1, 2, 4],
        [3, 5, 6, 8],
        [4, 6, 7, 9],
        [8, 10, 11],
        [9, 11, 12],
    ]

    hz_sparse = [
        [0, 3, 5],
        [1, 3, 4, 6],
        [2, 4, 7],
        [5, 8, 10],
        [6, 8, 9, 11],
        [7, 9, 12],
    ]

    hz = GF2.Zeros((6, 13))
    for r, g in enumerate(hz_sparse):
        hz[r][np.array(g)] = 1

    hx = GF2.Zeros((6, 13))
    for r, g in enumerate(hx_sparse):
        hx[r][np.array(g)] = 1

    h = GF2(scipy.linalg.block_diag(hx, hz))

    expected_we = StabilizerCodeTensorEnumerator(h).stabilizer_enumerator_polynomial()

    assert we == expected_we, f"WEPs not equal\ngot:\n{we},\nexpected\n{expected_we}"
