from galois import GF2
import numpy as np

from qlego.codes.rotated_surface_code import RotatedSurfaceCodeTN
from qlego.legos import Legos
from qlego.scalar_stabilizer_enumerator import ScalarStabilizerCodeEnumerator
from qlego.simple_poly import SimplePoly
from qlego.tensor_stabilizer_enumerator import (
    PAULI_X,
    PAULI_Y,
    PAULI_Z,
    TensorStabilizerCodeEnumerator,
)


def test_d3_rsc_with_merged_ptes():
    tn = RotatedSurfaceCodeTN(d=3)
    tn_single_pte = RotatedSurfaceCodeTN(d=3)

    print(tn.traces)
    tn.traces = [
        (0, 1, [(0, 2)], [(1, 1)]),
        (0, 3, [(0, 1)], [(3, 0)]),
        (7, 8, [(7, 3)], [(8, 0)]),
        (5, 8, [(5, 2)], [(8, 3)]),
        (3, 4, [(3, 3)], [(4, 0)]),
        (1, 4, [(1, 2)], [(4, 3)]),
        (1, 2, [(1, 3)], [(2, 0)]),
        (3, 6, [(3, 2)], [(6, 3)]),
        (4, 5, [(4, 2)], [(5, 1)]),
        (2, 5, [(2, 1)], [(5, 0)]),
        (4, 7, [(4, 1)], [(7, 0)]),
        (6, 7, [(6, 2)], [(7, 1)]),
    ]

    assert (
        tn.stabilizer_enumerator_polynomial(verbose=True)
        == tn_single_pte.stabilizer_enumerator_polynomial()
    )


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

    scalar = TensorStabilizerCodeEnumerator(
        rsc,
        coset_flipped_legs=[
            ((0, q), PAULI_X) for q in x_error_bits if q not in z_error_bits
        ]
        + [((0, q), PAULI_Z) for q in z_error_bits if q not in x_error_bits]
        + [
            ((0, q), PAULI_Y) for q in set(x_error_bits).intersection(set(z_error_bits))
        ],
    )
    print(scalar.stabilizer_enumerator())

    tn = RotatedSurfaceCodeTN(
        d=3,
        coset_error=(tuple(x_error_bits), tuple(z_error_bits)),
    )

    we = tn.stabilizer_enumerator_polynomial(cotengra=False)
    print("----")
    assert we == scalar.stabilizer_enumerator_polynomial()


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

    scalar = ScalarStabilizerCodeEnumerator(rsc)
    print(scalar.stabilizer_enumerator)

    tn = RotatedSurfaceCodeTN(d=3)

    we = tn.stabilizer_enumerator_polynomial()
    assert we._dict == {8: 129, 6: 100, 4: 22, 2: 4, 0: 1}


def test_d3_creation():
    tn = RotatedSurfaceCodeTN(3)

    nodes = [
        TensorStabilizerCodeEnumerator(Legos.enconding_tensor_512, idx=i)
        for i in range(9)
    ]

    # top Z boundary
    nodes[0] = nodes[0].trace_with_stopper(PAULI_Z, 3)
    nodes[1] = nodes[1].trace_with_stopper(PAULI_Z, 0)
    nodes[2] = nodes[2].trace_with_stopper(PAULI_Z, 3)

    # bottom Z boundary
    nodes[6] = nodes[6].trace_with_stopper(PAULI_Z, 1)
    nodes[7] = nodes[7].trace_with_stopper(PAULI_Z, 2)
    nodes[8] = nodes[8].trace_with_stopper(PAULI_Z, 1)

    # left X boundary
    nodes[0] = nodes[0].trace_with_stopper(PAULI_X, 0)
    nodes[3] = nodes[3].trace_with_stopper(PAULI_X, 1)
    nodes[6] = nodes[6].trace_with_stopper(PAULI_X, 0)

    # right X boundary
    nodes[2] = nodes[2].trace_with_stopper(PAULI_X, 2)
    nodes[5] = nodes[5].trace_with_stopper(PAULI_X, 3)
    nodes[8] = nodes[8].trace_with_stopper(PAULI_X, 2)

    for i, node in tn.nodes.items():
        assert node.idx == i
        print(node.h)
        print(nodes[i].h)
        assert np.array_equal(
            node.h, nodes[i].h
        ), f"Parities don't match at node {i},\n{node.h}\n{nodes[i].h}"

    assert tn.traces == [
        (0, 1, [(0, 2)], [(1, 1)]),
        (0, 3, [(0, 1)], [(3, 0)]),
        (3, 4, [(3, 3)], [(4, 0)]),
        (1, 4, [(1, 2)], [(4, 3)]),
        (1, 2, [(1, 3)], [(2, 0)]),
        (3, 6, [(3, 2)], [(6, 3)]),
        (4, 5, [(4, 2)], [(5, 1)]),
        (2, 5, [(2, 1)], [(5, 0)]),
        (4, 7, [(4, 1)], [(7, 0)]),
        (6, 7, [(6, 2)], [(7, 1)]),
        (7, 8, [(7, 3)], [(8, 0)]),
        (5, 8, [(5, 2)], [(8, 3)]),
    ], f"Traces are not equal, got:\n{'\n'.join(str(tr)for tr in tn.traces)}"

    assert tn.legs_left_to_join == {
        0: [(0, 2), (0, 1)],
        1: [(1, 1), (1, 2), (1, 3)],
        2: [(2, 0), (2, 1)],
        3: [(3, 0), (3, 3), (3, 2)],
        4: [(4, 0), (4, 3), (4, 2), (4, 1)],
        5: [(5, 1), (5, 0), (5, 2)],
        6: [(6, 3), (6, 2)],
        7: [(7, 0), (7, 1), (7, 3)],
        8: [(8, 0), (8, 3)],
    }


assert {
    0: [(0, 2), (0, 1)],
    1: [(1, 1), (1, 2), (1, 3)],
    2: [(2, 0), (2, 1)],
    3: [(3, 0), (3, 3), (3, 2)],
    4: [(4, 0), (4, 3), (4, 2), (4, 1)],
    5: [(5, 1), (5, 0), (5, 2)],
    6: [(6, 3), (6, 2)],
    7: [(7, 0), (7, 1), (7, 3)],
    8: [(8, 0), (8, 3)],
}, f"Legs to trace are not equal, got:\n{tn.legs_left_to_join}"


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

    we = tn.stabilizer_enumerator_polynomial(
        summed_legs=[(idx, 4) for idx in tn.nodes.keys()], cotengra=False
    )
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
