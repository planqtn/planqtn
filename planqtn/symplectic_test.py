from galois import GF2
import numpy as np
from planqtn.legos import Legos
from planqtn.stabilizer_tensor_enumerator import StabilizerCodeTensorEnumerator
from planqtn.symplectic import (
    count_matching_stabilizers_ratio_all_pairs,
    omega,
    symp_to_str,
    weight,
    sympl_to_pauli_repr,
)


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


def test_count_matching_stabilizer_ratio_single_leg():  # TODO: fix this test
    # Test with the [[4,2,2]] code
    pte1 = StabilizerCodeTensorEnumerator(Legos.z_rep_code(3))
    pte2 = StabilizerCodeTensorEnumerator(Legos.x_rep_code(3))
    ratio = count_matching_stabilizers_ratio_all_pairs(pte1, pte2, [(0, 0)], [(0, 2)])
    assert ratio == 0.25

    # Test with the Hadamard tensor
    pte1 = StabilizerCodeTensorEnumerator(Legos.stab_code_parity_422)
    pte2 = StabilizerCodeTensorEnumerator(Legos.stab_code_parity_422)
    ratio = count_matching_stabilizers_ratio_all_pairs(pte1, pte2, [(0, 1)], [(0, 1)])
    assert ratio == 0.25

    h1 = [
        [0, 1, 0, 0, 1, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 1, 1, 1, 0, 1],
        [0, 0, 1, 1, 1, 0, 0, 0, 0, 0],
    ]
    h2 = [[0, 0, 0, 0, 0, 1, 0, 1], [0, 0, 0, 0, 1, 0, 1, 1], [0, 1, 1, 1, 0, 0, 0, 0]]
    pte1 = StabilizerCodeTensorEnumerator(GF2(h1))
    pte2 = StabilizerCodeTensorEnumerator(GF2(h2))
    ratio = count_matching_stabilizers_ratio_all_pairs(pte1, pte2, [(0, 0)], [(0, 0)])
    assert ratio == 0.5


def test_count_matching_stabilizer_ratio_multiple_legs():
    h1 = [
        [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
    ]
    h2 = [
        [1, 0, 0, 1, 0, 0, 0, 1, 0, 1],
        [0, 0, 0, 0, 1, 0, 0, 0, 1, 0],
        [0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
        [0, 1, 0, 1, 0, 0, 0, 1, 0, 1],
    ]
    pte1 = StabilizerCodeTensorEnumerator(GF2(h1))
    pte2 = StabilizerCodeTensorEnumerator(GF2(h2))
    ratio = count_matching_stabilizers_ratio_all_pairs(
        pte1, pte2, [(0, 4), (0, 1)], [(0, 2), (0, 0)]
    )
    assert ratio == 0.0625

    h1 = [
        [0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1],
        [0, 0, 1, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
    ]
    h2 = [[1, 1, 0, 1, 0, 0, 0, 0], [0, 0, 1, 1, 0, 0, 0, 0], [0, 0, 0, 0, 1, 0, 1, 1]]

    pte1 = StabilizerCodeTensorEnumerator(GF2(h1))
    pte2 = StabilizerCodeTensorEnumerator(GF2(h2))
    ratio = count_matching_stabilizers_ratio_all_pairs(
        pte1, pte2, [(0, 3), (0, 6)], [(0, 0), (0, 1)]
    )
    assert ratio == 0.25
