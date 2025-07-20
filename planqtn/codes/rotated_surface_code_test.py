from galois import GF2
import numpy as np

from planqtn.codes.rotated_surface_code import RotatedSurfaceCodeTN
from planqtn.legos import Legos
from planqtn.simple_poly import SimplePoly
from planqtn.tensor_network import (
    PAULI_X,
    PAULI_Y,
    PAULI_Z,
    StabilizerCodeTensorEnumerator,
)


def test_d3_rsc_with_merged_ptes():
    # this test forces the merging of PTEs branch of the tracing logic

    tn = RotatedSurfaceCodeTN(d=3)
    tn_single_pte = RotatedSurfaceCodeTN(d=3)

    print(tn.traces)
    tn.traces = [
        # starting a PTE island with the bottom right corner
        ((2, 1), (2, 2), [((2, 1), 3)], [((2, 2), 0)]),
        ((1, 2), (2, 2), [((1, 2), 2)], [((2, 2), 3)]),
        # and then starting another PTE island in the top left corner
        ((0, 0), (0, 1), [((0, 0), 2)], [((0, 1), 1)]),
        ((0, 0), (1, 0), [((0, 0), 1)], [((1, 0), 0)]),
        ((1, 0), (1, 1), [((1, 0), 3)], [((1, 1), 0)]),
        ((0, 1), (1, 1), [((0, 1), 2)], [((1, 1), 3)]),
        ((0, 1), (0, 2), [((0, 1), 3)], [((0, 2), 0)]),
        ((1, 0), (2, 0), [((1, 0), 2)], [((2, 0), 3)]),
        # and here they start to connect
        ((1, 1), (1, 2), [((1, 1), 2)], [((1, 2), 1)]),
        ((0, 2), (1, 2), [((0, 2), 1)], [((1, 2), 0)]),
        ((1, 1), (2, 1), [((1, 1), 1)], [((2, 1), 0)]),
        ((2, 0), (2, 1), [((2, 0), 2)], [((2, 1), 1)]),
    ]

    wep = tn.stabilizer_enumerator_polynomial(cotengra=False, verbose=True)

    wep2 = tn_single_pte.stabilizer_enumerator_polynomial(
        cotengra=False,
    )
    print(tn_single_pte.traces)
    assert wep == wep2, f"Not eq: {wep} vs {wep2}"


def test_rsc3_x_and_z_coset_wep():
    rsc = GF2(
        [
            [1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1],
        ]
    )

    x_error_bits = [0, 2]
    z_error_bits = [1, 2]

    scalar = StabilizerCodeTensorEnumerator(
        rsc,
        coset_flipped_legs=[
            ((0, q), PAULI_X) for q in x_error_bits if q not in z_error_bits
        ]
        + [((0, q), PAULI_Z) for q in z_error_bits if q not in x_error_bits]
        + [
            ((0, q), PAULI_Y) for q in set(x_error_bits).intersection(set(z_error_bits))
        ],
    )

    tn = RotatedSurfaceCodeTN(
        d=3,
        coset_error=(tuple(x_error_bits), tuple(z_error_bits)),
    )

    we = tn.stabilizer_enumerator_polynomial(cotengra=False)
    expected_we = scalar.stabilizer_enumerator_polynomial()
    print("----")
    assert we == expected_we, f"Not equal: {we} != {expected_we}"


def test_d3_rotated_surface_code():
    # pytest.skip()
    rsc = GF2(
        [
            [1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1],
        ]
    )

    scalar = StabilizerCodeTensorEnumerator(rsc)

    tn = RotatedSurfaceCodeTN(d=3)

    we = tn.stabilizer_enumerator_polynomial()
    assert we.dict == {8: 129, 6: 100, 4: 22, 2: 4, 0: 1}


def test_d3_creation():
    tn = RotatedSurfaceCodeTN(3)

    nodes = [
        StabilizerCodeTensorEnumerator(Legos.enconding_tensor_512, tensor_id=i)
        for i in range(9)
    ]

    # top Z boundary
    nodes[0] = nodes[0].trace_with_stopper(PAULI_X, 3)
    nodes[1] = nodes[1].trace_with_stopper(PAULI_X, 0)
    nodes[2] = nodes[2].trace_with_stopper(PAULI_X, 3)

    # bottom Z boundary
    nodes[6] = nodes[6].trace_with_stopper(PAULI_X, 1)
    nodes[7] = nodes[7].trace_with_stopper(PAULI_X, 2)
    nodes[8] = nodes[8].trace_with_stopper(PAULI_X, 1)

    # left X boundary
    nodes[0] = nodes[0].trace_with_stopper(PAULI_Z, 0)
    nodes[3] = nodes[3].trace_with_stopper(PAULI_Z, 1)
    nodes[6] = nodes[6].trace_with_stopper(PAULI_Z, 0)

    # right X boundary
    nodes[2] = nodes[2].trace_with_stopper(PAULI_Z, 2)
    nodes[5] = nodes[5].trace_with_stopper(PAULI_Z, 3)
    nodes[8] = nodes[8].trace_with_stopper(PAULI_Z, 2)

    for idx, node in tn.nodes.items():
        assert node.tensor_id == idx
        node_seq = idx[0] * 3 + idx[1]
        print(node.h)
        print(nodes[node_seq].h)
        assert np.array_equal(node.h, nodes[node_seq].h), (
            "Parities don't match at node "
            + str(idx)
            + ",\n"
            + str(node.h)
            + "\n"
            + str(nodes[node_seq].h)
        )

    assert tn.traces == [
        ((0, 0), (0, 1), [((0, 0), 2)], [((0, 1), 1)]),
        ((0, 0), (1, 0), [((0, 0), 1)], [((1, 0), 0)]),
        ((1, 0), (1, 1), [((1, 0), 3)], [((1, 1), 0)]),
        ((0, 1), (1, 1), [((0, 1), 2)], [((1, 1), 3)]),
        ((0, 1), (0, 2), [((0, 1), 3)], [((0, 2), 0)]),
        ((1, 0), (2, 0), [((1, 0), 2)], [((2, 0), 3)]),
        ((1, 1), (1, 2), [((1, 1), 2)], [((1, 2), 1)]),
        ((0, 2), (1, 2), [((0, 2), 1)], [((1, 2), 0)]),
        ((1, 1), (2, 1), [((1, 1), 1)], [((2, 1), 0)]),
        ((2, 0), (2, 1), [((2, 0), 2)], [((2, 1), 1)]),
        ((2, 1), (2, 2), [((2, 1), 3)], [((2, 2), 0)]),
        ((1, 2), (2, 2), [((1, 2), 2)], [((2, 2), 3)]),
    ], "Traces are not equal, got:\n" + "\n".join(str(tr) for tr in tn.traces)

    print(tn.legs_left_to_join)
    assert tn.legs_left_to_join == {
        (0, 0): [((0, 0), 2), ((0, 0), 1)],
        (1, 0): [((1, 0), 0), ((1, 0), 3), ((1, 0), 2)],
        (2, 0): [((2, 0), 3), ((2, 0), 2)],
        (0, 1): [((0, 1), 1), ((0, 1), 2), ((0, 1), 3)],
        (1, 1): [((1, 1), 0), ((1, 1), 3), ((1, 1), 2), ((1, 1), 1)],
        (2, 1): [((2, 1), 0), ((2, 1), 1), ((2, 1), 3)],
        (0, 2): [((0, 2), 0), ((0, 2), 1)],
        (1, 2): [((1, 2), 1), ((1, 2), 0), ((1, 2), 2)],
        (2, 2): [((2, 2), 0), ((2, 2), 3)],
    }, "Legs to trace are not equal, got:\n" + str(tn.legs_left_to_join)


def test_d5_rotated_surface_code():
    # pytest.skip()
    rsc5_enum = (
        SimplePoly(
            {
                0: 4,
                4: 288,
                8: 14860,
                6: 2136,
                10: 103264,
                2: 32,
                12: 633792,
                14: 3130128,
                16: 10904188,
                18: 20461504,
                20: 20546528,
                22: 9748824,
                24: 1563316,
            }
        )
        / 4
    )
    print(rsc5_enum)
    tn = RotatedSurfaceCodeTN(d=5)

    we = tn.stabilizer_enumerator_polynomial(cotengra=False)
    assert we == rsc5_enum


def test_d5_rotated_surface_code_x_only():
    tn = RotatedSurfaceCodeTN(d=5, lego=lambda i: Legos.enconding_tensor_512_x)
    we = tn.stabilizer_enumerator_polynomial(cotengra=False)
    assert we == SimplePoly(
        {
            12: 1154,
            14: 937,
            10: 869,
            16: 525,
            8: 262,
            18: 191,
            6: 79,
            20: 52,
            4: 22,
            2: 4,
            0: 1,
        }
    )


def test_d5_rsc_z_coset():
    tn = RotatedSurfaceCodeTN(
        d=5, lego=lambda i: Legos.enconding_tensor_512_z, coset_error=((), (11, 21, 22))
    )
    we = tn.stabilizer_enumerator_polynomial(cotengra=False)

    assert we == SimplePoly(
        {
            3: 6,
            5: 30,
            7: 181,
            9: 576,
            11: 971,
            13: 1106,
            15: 771,
            17: 356,
            19: 87,
            21: 12,
        }
    )


def test_d5_rsc_z_coset_group26():

    tn = RotatedSurfaceCodeTN(
        d=5,
        lego=lambda i: Legos.enconding_tensor_512_z,
        coset_error=((), (0, 1, 3, 20, 22)),
    )
    we = tn.stabilizer_enumerator_polynomial(cotengra=False)

    assert we == SimplePoly(
        {
            5: 35,
            7: 124,
            9: 553,
            11: 1046,
            13: 1173,
            15: 768,
            17: 319,
            19: 78,
        }
    )


def test_d3_rsc_z_coset():
    tn = RotatedSurfaceCodeTN(
        d=3, lego=lambda i: Legos.enconding_tensor_512_z, coset_error=((), (0, 5))
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


def test_d3_rsc_z_coset_reset():
    # this is to ensure that the coset can be set multiple times (I had a bug with this)
    tn = RotatedSurfaceCodeTN(d=3, lego=lambda i: Legos.enconding_tensor_512_z)
    tn.set_coset(((), (1,)))
    we = tn.stabilizer_enumerator_polynomial(cotengra=False)
    print(we)
    assert we == SimplePoly(
        {
            1: 2,
            3: 3,
            5: 8,
            7: 3,
        }
    )

    tn.set_coset(((), (0, 5)))

    we = tn.stabilizer_enumerator_polynomial(cotengra=False)
    print(we)
    assert we == SimplePoly(
        {
            2: 1,
            4: 10,
            6: 5,
        }
    )
